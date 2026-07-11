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
    const { brand_id, creator_id, campaign_id, is_enterprise, stripe_customer_id, billing_address, billing_name } = await req.json();

    console.log("Received payment request:", { brand_id, creator_id, campaign_id, is_enterprise, stripe_customer_id });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: campaign } = await supabase.from("campaigns").select("budget, brand_id").eq("id", campaign_id).single();
    if (!campaign) throw new Error("Campaign not found");
    if (campaign.brand_id !== brand_id) throw new Error("Unauthorized");
    const amount = Math.round(parseFloat(campaign.budget) * 100);

    // New card: persist the billing address on the brand so it can be reused
    // (and snapshotted) on future payments made with the saved card.
    let billing = billing_address;
    if (billing?.line1) {
      await supabase.from("brand_profiles").update({
        billing_address_line1: billing.line1,
        billing_address_line2: billing.line2 || null,
        billing_city: billing.city || null,
        billing_state: billing.state || null,
        billing_postal_code: billing.postal_code || null,
        billing_country: billing.country || null,
      }).eq("id", brand_id);
    } else {
      const { data: bp } = await supabase.from("brand_profiles")
        .select("billing_address_line1, billing_address_line2, billing_city, billing_state, billing_postal_code, billing_country")
        .eq("id", brand_id).single();
      if (bp?.billing_address_line1) {
        billing = {
          line1: bp.billing_address_line1,
          line2: bp.billing_address_line2,
          city: bp.billing_city,
          state: bp.billing_state,
          postal_code: bp.billing_postal_code,
          country: bp.billing_country,
        };
      }
    }

    const brandFee = is_enterprise ? 0 : Math.round(amount * 0.05);
    const totalCharge = amount + brandFee;
    const creatorCut = is_enterprise ? 0 : Math.round(amount * 0.10);
    const creatorPayout = amount - creatorCut;

    const params: Record<string, string> = {
      amount: totalCharge.toString(),
      currency: "gbp",
      "automatic_payment_methods[enabled]": "true",
      "automatic_payment_methods[allow_redirects]": "never",
      "metadata[brand_id]": brand_id,
      "metadata[creator_id]": creator_id,
      "metadata[campaign_id]": campaign_id,
    };

    if (stripe_customer_id) {
      params["customer"] = stripe_customer_id;
    }

    const stripeRes = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("STRIPE_SECRET_KEY")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params),
    });

    const paymentIntent = await stripeRes.json();
    console.log("Stripe response:", paymentIntent.id, paymentIntent.status);

    if (!paymentIntent.id) {
      throw new Error("Stripe failed: " + JSON.stringify(paymentIntent));
    }

    const { error: insertError } = await supabase.from("transactions").insert({
      brand_id,
      creator_id,
      campaign_id,
      amount,
      creator_payout: creatorPayout,
      platform_fee: brandFee + creatorCut,
      status: "pending",
      stripe_payment_intent_id: paymentIntent.id,
      billing_name: billing_name || null,
      billing_address_line1: billing?.line1 || null,
      billing_address_line2: billing?.line2 || null,
      billing_city: billing?.city || null,
      billing_state: billing?.state || null,
      billing_postal_code: billing?.postal_code || null,
      billing_country: billing?.country || null,
    });

    if (insertError) console.error("Failed to insert transaction:", insertError);

    return new Response(JSON.stringify({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      creatorPayout,
      totalCharge,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (err) {
    console.error("Function error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
