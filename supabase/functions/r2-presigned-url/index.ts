import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { S3Client, PutObjectCommand } from "https://esm.sh/@aws-sdk/client-s3@3.600.0";
import { getSignedUrl } from "https://esm.sh/@aws-sdk/s3-request-presigner@3.600.0?deps=@aws-sdk/client-s3@3.600.0";
import { checkRateLimit, clientIdentifier, rateLimitResponse } from "../_shared/rateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKET = Deno.env.get("R2_BUCKET_NAME") ?? "";
const PUBLIC_URL = (Deno.env.get("R2_PUBLIC_URL") ?? "").replace(/\/$/, "");
const ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID") ?? "";

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID") ?? "",
    secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY") ?? "",
  },
});

// Every upload site in the app used to construct its own storage path
// client-side and rely on Supabase Storage's RLS policies to enforce who
// could actually write there. R2 has no equivalent per-request policy
// layer, so this function now IS that boundary - it builds the path
// itself from the authenticated caller's own id (never trusts a
// client-supplied path), checking ownership per purpose before ever
// issuing a signed URL.
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const withinLimit = await checkRateLimit(supabaseAdmin, "r2-presigned-url", clientIdentifier(req, caller.id), {
      windowSeconds: 60,
      maxRequests: 40,
    });
    if (!withinLimit) return rateLimitResponse(corsHeaders);

    const { purpose, ext, content_type, campaign_id, application_id, conversation_id, folder } = await req.json();
    if (!purpose || !ext || typeof ext !== "string" || !/^[a-z0-9]{1,8}$/i.test(ext)) {
      return new Response(JSON.stringify({ error: "purpose and a valid ext are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let path: string;

    if (purpose === "avatar") {
      const { data: profile } = await supabaseAdmin.from("profiles").select("role").eq("id", caller.id).maybeSingle();
      const folderName = profile?.role === "brand" ? "brands" : "creators";
      path = `${folderName}/${caller.id}.${ext}`;

    } else if (purpose === "campaign-asset") {
      const ASSET_FOLDERS = ["logos", "overlays", "style-videos", "broll"];
      if (!campaign_id || !folder || !ASSET_FOLDERS.includes(folder)) {
        return new Response(JSON.stringify({ error: "campaign_id and a valid folder are required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: campaign } = await supabaseAdmin.from("campaigns").select("id").eq("id", campaign_id).eq("brand_id", caller.id).maybeSingle();
      if (!campaign) {
        return new Response(JSON.stringify({ error: "Not authorized for this campaign" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      path = `campaign-assets/${caller.id}/${campaign_id}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    } else if (purpose === "pitch") {
      if (!campaign_id) {
        return new Response(JSON.stringify({ error: "campaign_id is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      path = `pitches/${caller.id}_${campaign_id}_${Date.now()}.${ext}`;

    } else if (purpose === "deliverable") {
      if (!application_id) {
        return new Response(JSON.stringify({ error: "application_id is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: application } = await supabaseAdmin.from("applications").select("id").eq("id", application_id).eq("creator_id", caller.id).maybeSingle();
      if (!application) {
        return new Response(JSON.stringify({ error: "Not authorized for this application" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      path = `deliverables/${application_id}_${Date.now()}.${ext}`;

    } else if (purpose === "message-media") {
      if (!conversation_id) {
        return new Response(JSON.stringify({ error: "conversation_id is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: conversation } = await supabaseAdmin
        .from("conversations")
        .select("id")
        .eq("id", conversation_id)
        .or(`participant_1.eq.${caller.id},participant_2.eq.${caller.id}`)
        .maybeSingle();
      if (!conversation) {
        return new Response(JSON.stringify({ error: "Not authorized for this conversation" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      path = `${conversation_id}/${caller.id}_${Date.now()}.${ext}`;

    } else {
      return new Response(JSON.stringify({ error: "Unknown purpose" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: path,
      ContentType: typeof content_type === "string" ? content_type : undefined,
    });
    // 5 minutes is enough to actually send even a large video over a slow
    // connection, without leaving a long-lived write credential floating
    // around in the client.
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

    return new Response(JSON.stringify({ uploadUrl, publicUrl: `${PUBLIC_URL}/${path}`, path }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("r2-presigned-url error:", err);
    return new Response(JSON.stringify({ error: String((err as Error).message || err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
