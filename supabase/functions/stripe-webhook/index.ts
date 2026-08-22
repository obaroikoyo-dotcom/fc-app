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

    const { error } = await supabase
      .from("transactions")
      .update({ status: "completed" })
      .eq("stripe_payment_intent_id", paymentIntent.id);

    if (error) {
      console.error("Failed to update transaction:", error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
  }

  if (event.type === "payment_intent.payment_failed") {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;

    await supabase
      .from("transactions")
      .update({ status: "failed" })
      .eq("stripe_payment_intent_id", paymentIntent.id);
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});