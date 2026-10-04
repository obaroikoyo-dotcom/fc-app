import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type ReleaseResult =
  | { released: true; alreadyReleased?: boolean; transferId?: string }
  | { released: false; reason: "not_connected" | "transfer_failed" | "no_transaction"; error?: string };

// stripe_transfer_id has three shapes:
//   null                 - nothing sent yet
//   "pending:<uuid>"     - a transfer is being attempted with that uuid as its
//                          Stripe Idempotency-Key. Stripe returns the same
//                          result for the same key, so re-running after a
//                          crash or timeout can never create a second transfer,
//                          and can't skip the transfer the way a bare marker did.
//   "tr_..."             - a real Stripe transfer id; the money has moved.
const PENDING_PREFIX = "pending:";
const LEGACY_PENDING = "pending";

// Centralizes what happens when funds held in escrow for an application get
// released, regardless of which of the three triggers fired it (TikTok
// auto-confirm, a brand's manual release, or an ungated instant payment).
// Creates the actual Stripe Transfer to the creator's connected account,
// then flips applications.status - previously each trigger duplicated a
// DB-only status flip with no real money movement behind it.
export async function releasePayoutForApplication(
  supabaseAdmin: ReturnType<typeof createClient>,
  applicationId: string
): Promise<ReleaseResult> {
  const { data: application, error: appError } = await supabaseAdmin
    .from("applications")
    .select("id, campaign_id, creator_id")
    .eq("id", applicationId)
    .single();
  if (appError || !application) {
    return { released: false, reason: "no_transaction", error: "Application not found" };
  }

  // Not filtered by transactions.status: the Stripe webhook flips that to
  // "completed" as soon as the card charge itself succeeds, well before
  // release happens - it means "charge succeeded", not "creator paid".
  // Filtering on it (as the old client-side release code did) would match
  // zero rows by the time release actually runs.
  const { data: transaction, error: txError } = await supabaseAdmin
    .from("transactions")
    .select("id, creator_payout, stripe_charge_id, stripe_transfer_id")
    .eq("campaign_id", application.campaign_id)
    .eq("creator_id", application.creator_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (txError || !transaction) {
    return { released: false, reason: "no_transaction", error: "No matching transaction found" };
  }

  let existingTransfer = transaction.stripe_transfer_id as string | null;

  if (existingTransfer === LEGACY_PENDING) {
    // Left behind by the old code, which had no idempotency key. A transfer
    // may or may not have gone out before it stopped, so ask Stripe instead
    // of guessing in either direction.
    const listRes = await fetch(
      `https://api.stripe.com/v1/transfers?transfer_group=${encodeURIComponent(`application_${applicationId}`)}&limit=10`,
      { headers: { "Authorization": `Bearer ${Deno.env.get("STRIPE_SECRET_KEY")}` } }
    );
    const list = await listRes.json();
    if (list.error) {
      return { released: false, reason: "transfer_failed", error: "Couldn't check Stripe for an earlier payout - try again shortly." };
    }
    const found = (list.data || []).find((t: { amount: number; reversed?: boolean }) =>
      t.amount === transaction.creator_payout && !t.reversed
    );
    if (found) {
      await supabaseAdmin.from("transactions").update({
        stripe_transfer_id: found.id,
        payout_released_at: new Date().toISOString(),
      }).eq("id", transaction.id);
      await supabaseAdmin.from("applications").update({ status: "paid" }).eq("id", applicationId);
      return { released: true, alreadyReleased: true, transferId: found.id };
    }
    // Stripe has no transfer for this deal, so nothing was paid. Clear the
    // legacy marker and fall through to a normal claim.
    await supabaseAdmin.from("transactions").update({ stripe_transfer_id: null })
      .eq("id", transaction.id).eq("stripe_transfer_id", LEGACY_PENDING);
    existingTransfer = null;
  }

  if (existingTransfer && !existingTransfer.startsWith(PENDING_PREFIX)) {
    // A real transfer already exists - just make sure the application agrees.
    await supabaseAdmin.from("applications").update({ status: "paid" }).eq("id", applicationId);
    return { released: true, alreadyReleased: true, transferId: existingTransfer };
  }

  if (transaction.creator_payout > 0) {
    const { data: account } = await supabaseAdmin
      .from("creator_stripe_accounts")
      .select("stripe_account_id, payouts_enabled")
      .eq("user_id", application.creator_id)
      .maybeSingle();

    if (!account || !account.payouts_enabled) {
      // Best-effort nudge - failure here shouldn't block reporting the
      // real reason release didn't happen.
      try {
        await supabaseAdmin.from("notifications").insert({
          user_id: application.creator_id,
          type: "payout_setup_needed",
          title: "Set up payouts to get paid",
          body: "A brand has released a payment to you, but you need to finish setting up payouts first.",
          data: { application_id: applicationId },
        });
      } catch (err) {
        console.error("Failed to insert payout-setup-needed notification:", err);
      }
      return { released: false, reason: "not_connected" };
    }

    if (!transaction.stripe_charge_id) {
      // The underlying charge's webhook hasn't landed yet (rare - webhooks
      // are near-instant relative to how release is triggered).
      return { released: false, reason: "transfer_failed", error: "Payment hasn't finished settling yet - try again shortly." };
    }

    // The idempotency key for this payout. A fresh claim mints a new one; a
    // row already stuck in "pending:" reuses its key, so the retry is
    // deduplicated by Stripe against whatever the earlier attempt did.
    let attemptKey: string;
    if (existingTransfer) {
      attemptKey = existingTransfer;
    } else {
      // Atomically claim this transaction. Only one concurrent caller can win
      // the null -> pending update; the loser backs off instead of racing.
      attemptKey = `${PENDING_PREFIX}${crypto.randomUUID()}`;
      const { data: claimed } = await supabaseAdmin
        .from("transactions")
        .update({ stripe_transfer_id: attemptKey })
        .eq("id", transaction.id)
        .is("stripe_transfer_id", null)
        .select("id")
        .maybeSingle();

      if (!claimed) {
        // Another trigger is mid-payout right now. Don't report success
        // before its transfer has actually landed.
        return { released: false, reason: "transfer_failed", error: "This payout is already being processed - try again shortly." };
      }
    }

    const params = new URLSearchParams({
      amount: String(transaction.creator_payout),
      currency: "gbp",
      destination: account.stripe_account_id,
      source_transaction: transaction.stripe_charge_id,
      transfer_group: `application_${applicationId}`,
    });

    // If this throws (network drop), the row stays "pending:<key>" on purpose:
    // the next attempt reuses the key and Stripe returns the original result
    // instead of sending the money twice.
    const transferRes = await fetch("https://api.stripe.com/v1/transfers", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("STRIPE_SECRET_KEY")}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": attemptKey,
      },
      body: params,
    });
    const transfer = await transferRes.json();

    if (!transfer.id) {
      console.error("Stripe transfer failed for application", applicationId, transfer);
      // Stripe answered with an error, so no money moved. Release the claim
      // so the next attempt gets a fresh key rather than a replayed error.
      await supabaseAdmin.from("transactions")
        .update({ stripe_transfer_id: null })
        .eq("id", transaction.id)
        .eq("stripe_transfer_id", attemptKey);
      return { released: false, reason: "transfer_failed", error: transfer.error?.message || "Stripe transfer failed" };
    }

    const { error: updateError } = await supabaseAdmin.from("transactions").update({
      stripe_transfer_id: transfer.id,
      payout_released_at: new Date().toISOString(),
    }).eq("id", transaction.id);
    if (updateError) console.error("Failed to record transfer id:", updateError);

    await supabaseAdmin.from("applications").update({ status: "paid" }).eq("id", applicationId);
    return { released: true, transferId: transfer.id };
  }

  // Nothing to transfer (e.g. a $0 deal) - just release.
  await supabaseAdmin.from("applications").update({ status: "paid" }).eq("id", applicationId);
  return { released: true };
}

export type RefundResult =
  | { refunded: true; refundId?: string }
  | { refunded: false; reason: "no_transaction" | "already_released" | "refund_failed"; error?: string };

// The admin-review counterpart to releasePayoutForApplication - refunds the
// brand's original charge. Only ever reachable for a transaction that
// hasn't been released yet (a real dispute is raised while status is still
// "funded", before any Stripe Transfer to the creator exists), so this is
// always a clean charge refund, never a transfer clawback.
export async function refundApplication(
  supabaseAdmin: ReturnType<typeof createClient>,
  applicationId: string
): Promise<RefundResult> {
  const { data: application, error: appError } = await supabaseAdmin
    .from("applications")
    .select("id, campaign_id, creator_id")
    .eq("id", applicationId)
    .single();
  if (appError || !application) {
    return { refunded: false, reason: "no_transaction", error: "Application not found" };
  }

  const { data: transaction, error: txError } = await supabaseAdmin
    .from("transactions")
    .select("id, stripe_charge_id, stripe_transfer_id, status")
    .eq("campaign_id", application.campaign_id)
    .eq("creator_id", application.creator_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (txError || !transaction) {
    return { refunded: false, reason: "no_transaction", error: "No matching transaction found" };
  }
  if (transaction.stripe_transfer_id) {
    // Includes an in-flight or unconfirmed "pending:" payout - refusing is
    // the safe choice until Stripe has been checked.
    return { refunded: false, reason: "already_released", error: "Funds were already released (or a payout is unconfirmed) - this needs manual handling, not a refund." };
  }
  if (!transaction.stripe_charge_id) {
    return { refunded: false, reason: "no_transaction", error: "Payment hasn't finished settling yet - try again shortly." };
  }

  const refundRes = await fetch("https://api.stripe.com/v1/refunds", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${Deno.env.get("STRIPE_SECRET_KEY")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      // Same key on a double-click or retry, so Stripe can't refund twice.
      "Idempotency-Key": `refund_${transaction.id}`,
    },
    body: new URLSearchParams({ charge: transaction.stripe_charge_id }),
  });
  const refund = await refundRes.json();

  if (!refund.id) {
    console.error("Stripe refund failed for application", applicationId, refund);
    return { refunded: false, reason: "refund_failed", error: refund.error?.message || "Stripe refund failed" };
  }

  await supabaseAdmin.from("transactions").update({ status: "refunded" }).eq("id", transaction.id);
  await supabaseAdmin.from("applications").update({ status: "refunded" }).eq("id", applicationId);
  return { refunded: true, refundId: refund.id };
}
