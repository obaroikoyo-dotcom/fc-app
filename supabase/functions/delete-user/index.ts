import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, clientIdentifier, rateLimitResponse } from "../_shared/rateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user_id } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";

    // This function (like every other one in this project) isn't gated by
    // verify_jwt, so confirm the caller is deleting their OWN account before
    // touching auth.admin - previously anyone who found this URL could
    // delete any user by id.
    const authHeader = req.headers.get("Authorization") ?? "";
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !caller || caller.id !== user_id) {
      return new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const withinLimit = await checkRateLimit(supabaseAdmin, "delete-user", clientIdentifier(req, caller.id), {
      windowSeconds: 3600,
      maxRequests: 3,
    });
    if (!withinLimit) return rateLimitResponse(corsHeaders);

    // Deleting the DB rows (or the auth user, which cascades to them) never
    // touched Storage - uploaded files were left behind forever, silently
    // eating quota. Best-effort cleanup before the account itself goes;
    // failures here shouldn't block the actual account deletion.
    try {
      const ASSET_FOLDERS = ["logos", "overlays", "style-videos", "broll"];
      const { data: ownedCampaigns } = await supabaseAdmin
        .from("campaigns")
        .select("id")
        .eq("brand_id", user_id);

      for (const campaign of ownedCampaigns ?? []) {
        for (const folder of ASSET_FOLDERS) {
          const dirPath = `campaign-assets/${user_id}/${campaign.id}/${folder}`;
          const { data: files } = await supabaseAdmin.storage.from("campaign-assets").list(dirPath);
          if (files && files.length > 0) {
            await supabaseAdmin.storage.from("campaign-assets").remove(files.map(f => `${dirPath}/${f.name}`));
          }
        }
      }

      for (const folder of ["creators", "brands"]) {
        const { data: avatarFiles } = await supabaseAdmin.storage.from("avatars").list(folder, { search: user_id });
        if (avatarFiles && avatarFiles.length > 0) {
          await supabaseAdmin.storage.from("avatars").remove(avatarFiles.map(f => `${folder}/${f.name}`));
        }
      }
    } catch (storageErr) {
      console.error("Storage cleanup failed (continuing with account deletion):", storageErr);
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { 
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ success: true }), { 
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { 
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});