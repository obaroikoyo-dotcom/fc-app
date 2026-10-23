import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { S3Client, GetObjectCommand } from "https://esm.sh/@aws-sdk/client-s3@3.600.0";
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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// Gives the BRAND of a deal a short-lived link that downloads the creator's video as a file,
// once the payment has been released ("Yes, I'm happy", or the review time running out).
// The video in the app is the same file with a "PREVIEW" watermark drawn over it on screen;
// the stored file itself has no watermark, so this link gives the clean original.
//
// Everything is decided here, from the database, never from what the browser sends: the
// caller must be the brand that owns the campaign, the deal must be paid out, and the file
// must be one this app stored itself (a deliverables/ path on our own storage).
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !caller) return json({ error: "Not authorized" }, 403);

    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const withinLimit = await checkRateLimit(supabaseAdmin, "download-deliverable", clientIdentifier(req, caller.id), {
      windowSeconds: 60,
      maxRequests: 20,
    });
    if (!withinLimit) return rateLimitResponse(corsHeaders);

    const { application_id } = await req.json();
    if (typeof application_id !== "string" || !/^[0-9a-f-]{36}$/i.test(application_id)) {
      return json({ error: "application_id is required" }, 400);
    }

    const { data: application } = await supabaseAdmin
      .from("applications")
      .select("id, status, deliverable_url, campaigns(brand_id, name)")
      .eq("id", application_id)
      .maybeSingle();
    const campaign = Array.isArray(application?.campaigns) ? application?.campaigns[0] : application?.campaigns;
    if (!application || !campaign || campaign.brand_id !== caller.id) {
      return json({ error: "Not authorized for this application" }, 403);
    }
    if (application.status !== "paid") {
      return json({ error: "The video can be downloaded once the payment has been released." }, 403);
    }
    if (!application.deliverable_url) return json({ error: "There is no video to download yet." }, 404);

    // Only files this app stored itself, and only deliverables: never an arbitrary address or path.
    const prefix = `${PUBLIC_URL}/`;
    if (!PUBLIC_URL || !application.deliverable_url.startsWith(prefix)) return json({ error: "This video can't be downloaded." }, 400);
    let key: string;
    try {
      key = decodeURIComponent(application.deliverable_url.slice(prefix.length).split(/[?#]/)[0]);
    } catch {
      return json({ error: "This video can't be downloaded." }, 400);
    }
    if (!/^deliverables\/[A-Za-z0-9._-]+$/.test(key)) return json({ error: "This video can't be downloaded." }, 400);

    const ext = (key.split(".").pop() || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "mp4";
    const slug = String(campaign.name ?? "video").normalize("NFKD").replace(/[^A-Za-z0-9 _-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "video";
    const fileName = `${slug}.${ext}`;

    const downloadUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: BUCKET, Key: key, ResponseContentDisposition: `attachment; filename="${fileName}"` }),
      { expiresIn: 300 },
    );

    return json({ downloadUrl, fileName });
  } catch (err) {
    console.error("download-deliverable error:", err);
    return json({ error: String((err as Error).message || err) }, 500);
  }
});
