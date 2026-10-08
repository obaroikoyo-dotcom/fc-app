import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// "Delete for everyone" was removed from the app: it blanked a message's text
// and media for good, so either person could erase evidence while a dispute
// was open. The button is gone, and this refuses anyone who calls it directly.
// Messages can still be edited (edit-message) until the other person has seen
// them, and expired media is cleaned up by r2-scheduled-cleanup.
serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return new Response(JSON.stringify({ error: "Deleting messages is no longer available." }), {
    status: 410,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
