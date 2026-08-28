import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";
import { checkRateLimit, clientIdentifier } from "../_shared/rateLimit.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature!,
      webhookSecret
    );
  } catch (err) {
    return new Response(`Webhook signature verification failed: ${err}`, { status: 400 });
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
      .update({ status: "completed", stripe_charge_id: paymentIntent.latest_charge as string })
      .eq("stripe_payment_intent_id", paymentIntent.id)
      .select("campaign_id, creator_id, payout_release_mode")
      .maybeSingle();

    if (error) {
      console.error("Failed to update transaction:", error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
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
        .not("status", "in", "(funded,paid,rejected)");
    }
  }

  if (event.type === "payment_intent.payment_failed") {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;

    await supabase
      .from("transactions")
      .update({ status: "failed" })
      .eq("stripe_payment_intent_id", paymentIntent.id);
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

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});