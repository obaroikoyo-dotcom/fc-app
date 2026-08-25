import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, clientIdentifier, rateLimitResponse } from "../_shared/rateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRICE_IDS = {
  monthly: "price_1TiAtIPnrgzNkKOX3dgDDZ9r",
  annual: "price_1TiAtePnrgzNkKOXDeW8sKIu",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { brand_id, email, plan, payment_method_id, billing_address } = await req.json();

    const secretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!secretKey) throw new Error("Missing STRIPE_SECRET_KEY");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user || user.id !== brand_id) throw new Error("Unauthorized");

    const withinLimit = await checkRateLimit(supabase, "create-subscription", clientIdentifier(req, user.id), {
      windowSeconds: 600,
      maxRequests: 5,
    });
    if (!withinLimit) return rateLimitResponse(corsHeaders);

const addressParams: Record<string, string> = {};
if (billing_address?.line1) addressParams["address[line1]"] = billing_address.line1;
if (billing_address?.line2) addressParams["address[line2]"] = billing_address.line2;
if (billing_address?.city) addressParams["address[city]"] = billing_address.city;
if (billing_address?.state) addressParams["address[state]"] = billing_address.state;
if (billing_address?.postal_code) addressParams["address[postal_code]"] = billing_address.postal_code;
if (billing_address?.country) addressParams["address[country]"] = billing_address.country;

const { data: existingBrand } = await supabase.from("brand_profiles").select("stripe_customer_id").eq("id", brand_id).single();

let customer;
if (existingBrand?.stripe_customer_id) {
  const updateRes = await fetch(`https://api.stripe.com/v1/customers/${existingBrand.stripe_customer_id}`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${secretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(addressParams),
  });
  customer = await updateRes.json();
} else {
  const customerRes = await fetch("https://api.stripe.com/v1/customers", {
    method: "POST",
    headers: { "Authorization": `Bearer ${secretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ email, "metadata[brand_id]": brand_id, ...addressParams }),
  });
  customer = await customerRes.json();
}
if (customer.error) throw new Error(`Stripe customer error: ${customer.error.message}`);

    const attachRes = await fetch(`https://api.stripe.com/v1/payment_methods/${payment_method_id}/attach`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${secretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ customer: customer.id }),
    });
    const attach = await attachRes.json();
    if (attach.error) throw new Error(`Attach error: ${attach.error.message}`);

    const pmRes = await fetch(`https://api.stripe.com/v1/payment_methods/${payment_method_id}`, {
      headers: { "Authorization": `Bearer ${secretKey}` },
    });
    const pm = await pmRes.json();

    const subRes = await fetch("https://api.stripe.com/v1/subscriptions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${secretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        customer: customer.id,
        "items[0][price]": PRICE_IDS[plan as "monthly" | "annual"],
        default_payment_method: payment_method_id,
      }),
    });
    const subscription = await subRes.json();
    if (subscription.error) throw new Error(`Stripe subscription error: ${subscription.error.message}`);

    // is_enterprise/verified only get set here, server-side, once Stripe
    // confirms the subscription is actually active - previously the client
    // set these itself after this call returned, which let anyone grant
    // themselves both (0% platform fees + a verified badge) for free.
    const { error: dbError } = await supabase.from("brand_profiles").update({
      stripe_customer_id: customer.id,
      stripe_subscription_id: subscription.id,
      stripe_payment_method_id: payment_method_id,
      card_last4: pm.card?.last4 || null,
      card_brand: pm.card?.brand || null,
      billing_address_line1: billing_address?.line1 || null,
      billing_address_line2: billing_address?.line2 || null,
      billing_city: billing_address?.city || null,
      billing_state: billing_address?.state || null,
      billing_postal_code: billing_address?.postal_code || null,
      billing_country: billing_address?.country || null,
      ...(subscription.status === "active" ? { is_enterprise: true, verified: true } : {}),
    }).eq("id", brand_id);

    if (dbError) throw new Error(`Supabase update failed: ${dbError.message}`);

    return new Response(
      JSON.stringify({ subscriptionId: subscription.id, status: subscription.status }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});