import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { amount, brand_id, creator_id, campaign_id } = await req.json();

    // Calculate fees
    const originalAmount = amount; // in pence
    const brandFee = Math.round(amount * 0.05);
    const brandAmount = amount + brandFee; // brand pays 5% more
    const platformFee = Math.round(amount * 0.10);
    const creatorPayout = amount - platformFee; // creator gets 90%

    // Create Stripe payment intent
    const response = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("STRIPE_SECRET_KEY")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        amount: brandAmount.toString(),
        currency: "gbp",
        "metadata[brand_id]": brand_id,
        "metadata[creator_id]": creator_id,
        "metadata[campaign_id]": campaign_id,
      }),
    });

    const paymentIntent = await response.json();

    // Save transaction to Supabase
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    await supabase.from("transactions").insert({
      brand_id,
      creator_id,
      campaign_id,
      amount: originalAmount,
      creator_payout: creatorPayout,
      platform_fee: brandFee + platformFee,
      status: "pending",
      stripe_payment_intent_id: paymentIntent.id,
    });

    return new Response(JSON.stringify({ 
      clientSecret: paymentIntent.client_secret,
      amount: brandAmount,
      creatorPayout,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});