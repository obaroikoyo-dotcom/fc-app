import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ONESIGNAL_APP_ID = "66adae38-64f2-425f-b984-83e65f99ce1f";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user_id, title, body, data } = await req.json();
    if (!user_id || !title) throw new Error("Missing user_id or title");

    const restApiKey = Deno.env.get("ONESIGNAL_REST_API_KEY");
    if (!restApiKey) throw new Error("Missing ONESIGNAL_REST_API_KEY");

    // Targets the subscriber(s) linked to this Supabase user id via
    // OneSignal.login(userId) on the client (src/lib/onesignal.ts).
    const res = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Key ${restApiKey}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        target_channel: "push",
        include_aliases: { external_id: [user_id] },
        headings: { en: title },
        contents: { en: body ?? "" },
        data: data ?? {},
      }),
    });

    const result = await res.json();
    if (!res.ok) throw new Error(`OneSignal error: ${JSON.stringify(result)}`);

    // A non-empty id means OneSignal accepted and dispatched the message;
    // an empty string id means the request was valid but no subscriber
    // matched the target external_id.
    const sent = typeof result.id === "string" && result.id.length > 0 ? 1 : 0;
    return new Response(JSON.stringify({ sent, id: result.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
