import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";
import { checkRateLimit, clientIdentifier } from "../_shared/rateLimit.ts";
import { releasePayoutForApplication } from "../_shared/releasePayout.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

// Tells the admin in the app (an in-app notification, the same kind a new dispute sends). Best effort:
// whatever happened has already been recorded, so a failed note must never fail the webhook.
async function tellAdmin(supabase: ReturnType<typeof createClient>, title: string, body: string, data: Record<string, unknown>) {
  try {
    const { data: adminId } = await supabase.rpc("get_admin_user_id");
    if (!adminId) return;
    const { error } = await supabase.from("notifications").insert({ user_id: adminId, type: "dispute_raised", title, body, data });
    if (error) console.error("stripe-webhook: couldn't write the admin notification:", error);
  } catch (err) {
    console.error("stripe-webhook: couldn't tell the admin:", err);
  }
}

// A card chargeback is the brand's bank taking the money back, outside the app. It is treated like
// any other dispute: the deal is frozen ("disputed", so nothing can be released or auto-released from
// money that is being reversed), it shows in the admin's dispute list, and the creator can add their
// side. Two events can reveal a chargeback - "payment succeeded" and "chargeback filed" - and Stripe
// doesn't promise which arrives first (for the chargeback test card they arrive in the same second),
// so both handlers below call this. It does nothing until the deal is actually holding the money
// (status "funded"), and the freeze is one conditional update, so only one caller can do it.
async function freezeDealForChargeback(supabase: ReturnType<typeof createClient>, campaignId: string, creatorId: string, reason: string) {
  const { data: application } = await supabase
    .from("applications")
    .select("id, campaigns!inner(brand_id, name)")
    .eq("campaign_id", campaignId)
    .eq("creator_id", creatorId)
    .maybeSingle();
  if (!application) return;
  const campaign = Array.isArray(application.campaigns) ? application.campaigns[0] : application.campaigns;

  const { data: frozen } = await supabase
    .from("applications")
    .update({ status: "disputed", disputed_at: new Date().toISOString() })
    .eq("id", application.id)
    .eq("status", "funded")
    .select("id");
  if (!frozen?.length) return;

  const campaignName = campaign?.name ?? "a campaign";
  const ids = { application_id: application.id, campaign_id: campaignId };
  const { error: disputeError } = await supabase.from("disputes").insert({
    application_id: application.id,
    brand_id: campaign?.brand_id,
    creator_id: creatorId,
    reason,
    raised_by: "brand",
  });
  if (disputeError) console.error("stripe-webhook: couldn't open a dispute for the chargeback:", disputeError);

  await tellAdmin(supabase, "Card Chargeback", `The brand's bank disputed the card payment for "${campaignName}". The deal is frozen. Deal with it in Stripe, then settle it in Admin review.`, ids);
  try {
    await supabase.from("notifications").insert({
      user_id: creatorId,
      type: "dispute_raised",
      title: "Payment On Hold",
      body: `The brand's bank has questioned the card payment for "${campaignName}", so your payout is on hold while FlipCollab looks into it. You can add your side in the chat.`,
      data: ids,
    });
  } catch (err) {
    console.error("stripe-webhook: couldn't tell the creator about the chargeback:", err);
  }
}

serve(async (req) => {
  // Fail closed. With an empty secret the signature check below would still
  // "pass" for anyone who signs a fake event with an empty key (the Stripe
  // library accepts that), so a missing or mistyped secret has to stop every
  // event rather than let forged ones through. Real signing secrets always
  // start with whsec_.
  if (!webhookSecret.startsWith("whsec_")) {
    console.error("stripe-webhook: STRIPE_WEBHOOK_SECRET is missing or malformed - refusing every event");
    return new Response("Webhook is not configured", { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });
  const body = await req.text();

  let event;
  try {
    // Raw body plus the signature header, checked against the signing secret.
    // Anything that wasn't signed by Stripe with that secret, was changed after
    // signing, or is older than 5 minutes is refused here, before it touches
    // the database.
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error("stripe-webhook: signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // Signature is already verified above, so this only guards against
  // abnormal volume (retries/DoS), not spoofed callers - generous limit.
  const withinLimit = await checkRateLimit(supabase, "stripe-webhook", clientIdentifier(req), {
    windowSeconds: 60,
    maxRequests: 60,
  });
  if (!withinLimit) return new Response(JSON.stringify({ error: "Too many requests" }), { status: 429 });

  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;

    // latest_charge is captured so release-payout can later create a
    // Stripe Transfer tied to this specific charge's funds (source_transaction)
    // rather than the platform's general balance.
    const { data: tx, error } = await supabase
      .from("transactions")
      .update({ stripe_charge_id: paymentIntent.latest_charge as string })
      .eq("stripe_payment_intent_id", paymentIntent.id)
      .select("id, campaign_id, creator_id, payout_release_mode")
      .maybeSingle();

    if (error) {
      console.error("Failed to update transaction:", error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    // Now "completed" - but only from "pending" (or "failed"). Stripe doesn't promise the order its events
    // arrive in, and a chargeback or refund that landed a moment earlier must not be written over.
    if (tx) {
      await supabase
        .from("transactions")
        .update({ status: "completed" })
        .eq("id", tx.id)
        .in("status", ["pending", "failed"]);
    }

    // Only save the card as "reusable" once Stripe has actually confirmed the
    // charge went through - doing this here (not client-side) means a
    // declined/abandoned card never gets remembered as if it worked.
    const brandId = paymentIntent.metadata?.brand_id;
    if (brandId && paymentIntent.payment_method) {
      try {
        const pm = await stripe.paymentMethods.retrieve(paymentIntent.payment_method as string);
        await supabase.from("brand_profiles").update({
          stripe_payment_method_id: pm.id,
          card_last4: pm.card?.last4 || null,
          card_brand: pm.card?.brand || null,
        }).eq("id", brandId);
      } catch (err) {
        console.error("Failed to save reusable card for brand", brandId, err);
      }
    }

    // Safety net: the client normally flips the matching application to
    // "funded" itself right after the charge confirms, but if that update
    // never lands (dropped connection, closed tab), the application would
    // stay "accepted" - which still looks payable, risking a second real
    // charge for the same deal on retry. The webhook is the one thing
    // guaranteed to fire once Stripe confirms the charge, so it reconciles
    // this independently of whatever the client managed to do.
    if (tx) {
      await supabase
        .from("applications")
        .update({ status: "funded", payout_release_mode: tx.payout_release_mode || "tiktok_gated" })
        .eq("campaign_id", tx.campaign_id)
        .eq("creator_id", tx.creator_id)
        .not("status", "in", "(funded,paid,rejected,disputed)");

      // If the chargeback was filed before this confirmation arrived, the deal only just became
      // "funded" - freeze it now. (The chargeback handler does the same from its side; whichever
      // of the two runs second sees both facts, and the freeze can only happen once.)
      const { data: current } = await supabase.from("transactions").select("status").eq("id", tx.id).maybeSingle();
      if (current?.status === "disputed") {
        await freezeDealForChargeback(supabase, tx.campaign_id, tx.creator_id, "Card chargeback: the brand's bank disputed this payment with Stripe.");
      }
    }
  }

  if (event.type === "payment_intent.payment_failed") {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;

    await supabase
      .from("transactions")
      .update({ status: "failed" })
      .eq("stripe_payment_intent_id", paymentIntent.id);
  }

  // A card chargeback (the brand's bank reversing the payment) happens entirely
  // outside the app. Record it, freeze the deal while it still holds the money
  // (see freezeDealForChargeback) and tell the admin. We can't claw back a
  // Transfer automatically, so if the creator was already paid this is flagged
  // for manual handling, not silently ignored.
  if (event.type === "charge.dispute.created") {
    const dispute = event.data.object as Stripe.Dispute;
    const paymentIntentId = typeof dispute.payment_intent === "string" ? dispute.payment_intent : dispute.payment_intent?.id;
    if (paymentIntentId) {
      const { data: tx } = await supabase
        .from("transactions")
        .update({ status: "disputed" })
        .eq("stripe_payment_intent_id", paymentIntentId)
        .select("campaign_id, creator_id, stripe_transfer_id")
        .maybeSingle();
      if (tx?.stripe_transfer_id) {
        console.error("CHARGEBACK ON A PAID-OUT DEAL - manual recovery needed", { paymentIntentId, disputeId: dispute.id });
        await tellAdmin(supabase, "Card Chargeback On A Paid Deal",
          "The brand's bank disputed a card payment that has already been paid out to the creator. This needs handling by hand in Stripe.",
          { campaign_id: tx.campaign_id });
      } else if (tx) {
        await freezeDealForChargeback(supabase, tx.campaign_id, tx.creator_id, `Card chargeback: the brand's bank disputed this payment with Stripe (${dispute.reason}).`);
      }
    }
  }

  // A refund issued from the Stripe dashboard (not from inside the app) would
  // otherwise leave the transaction and deal looking paid. Mirror it here.
  // Refunds issued by refundApplication already set these, so this is a no-op
  // for them.
  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
    if (paymentIntentId && charge.amount_refunded >= charge.amount) {
      const { data: tx } = await supabase
        .from("transactions")
        .update({ status: "refunded" })
        .eq("stripe_payment_intent_id", paymentIntentId)
        .select("campaign_id, creator_id, stripe_transfer_id")
        .maybeSingle();
      if (tx && tx.stripe_transfer_id) {
        console.error("REFUND ISSUED AFTER PAYOUT - creator was already paid, manual recovery needed", { paymentIntentId });
      } else if (tx) {
        await supabase
          .from("applications")
          .update({ status: "refunded" })
          .eq("campaign_id", tx.campaign_id)
          .eq("creator_id", tx.creator_id)
          .not("status", "in", "(paid)");
      }
    }
  }

  // Fires when a subscription actually ends - either the brand canceled
  // (cancel-subscription sets cancel_at_period_end, this fires once that
  // period is up) or Stripe gave up retrying a failed renewal charge. This
  // is the only place is_enterprise ever gets turned back off - verified
  // is deliberately left alone, since it can also come from the separate
  // admin verification_requests approval flow and a lapsed subscription
  // shouldn't silently strip a badge earned that way.
  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    await supabase
      .from("brand_profiles")
      .update({ is_enterprise: false, subscription_cancel_at_period_end: false })
      .eq("stripe_subscription_id", subscription.id);
  }

  // If Stripe's failed-payment setting is "mark as unpaid" rather than
  // "cancel", a lapsed subscription is never deleted and Enterprise would stay
  // on without being paid for. Treat a subscription that has become unpaid (or
  // otherwise dead) the same as a deleted one. (past_due is left alone: that
  // is Stripe still retrying the card.) Needs the endpoint to receive
  // customer.subscription.updated events in Stripe.
  if (event.type === "customer.subscription.updated") {
    const subscription = event.data.object as Stripe.Subscription;
    if (["unpaid", "canceled", "incomplete_expired"].includes(subscription.status)) {
      await supabase
        .from("brand_profiles")
        .update({ is_enterprise: false, subscription_cancel_at_period_end: false })
        .eq("stripe_subscription_id", subscription.id);
    }
  }

  // A creator's payout release can fail with "not_connected" if their
  // Stripe payout setup wasn't finished yet at the moment a post got
  // confirmed live or an instant payment landed - nothing previously
  // retried that once they actually finished setup, leaving them stuck
  // showing "payout pending" until the brand happened to click manual
  // release again. This picks it back up automatically.
  if (event.type === "account.updated") {
    const account = event.data.object as Stripe.Account;
    if (account.payouts_enabled) {
      const { data: creatorAccount } = await supabase
        .from("creator_stripe_accounts")
        .update({
          payouts_enabled: true,
          charges_enabled: !!account.charges_enabled,
          details_submitted: !!account.details_submitted,
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_account_id", account.id)
        .select("user_id")
        .maybeSingle();

      if (creatorAccount) {
        const { data: pendingApps } = await supabase
          .from("applications")
          .select("id, payout_release_mode")
          .eq("creator_id", creatorAccount.user_id)
          .eq("status", "funded")
          .not("payout_release_mode", "is", null);

        for (const app of pendingApps || []) {
          // Money only ever lands once the deliverable is met - a creator's
          // payouts becoming enabled (or Stripe re-sending account.updated,
          // which it does often) is never itself a reason to release. Only
          // a post-gated deal whose required post is already confirmed live
          // is retried here; everything else waits for the brand's release,
          // a confirmed post, or the 5-day auto-release after upload.
          let eligible = false;
          if (app.payout_release_mode === "tiktok_gated") {
            const { data: post } = await supabase
              .from("campaign_posts")
              .select("id")
              .eq("application_id", app.id)
              .eq("posted_by_role", "creator")
              .eq("status", "published")
              .maybeSingle();
            eligible = !!post;
          }
          if (eligible) {
            try {
              await releasePayoutForApplication(supabase, app.id);
            } catch (err) {
              console.error("Auto-retry release failed for application", app.id, err);
            }
          }
        }
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});