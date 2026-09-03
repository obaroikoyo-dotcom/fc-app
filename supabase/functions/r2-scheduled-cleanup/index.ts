import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { deletePrefix, s3 } from "../_shared/r2Client.ts";
import { DeleteObjectCommand } from "https://esm.sh/@aws-sdk/client-s3@3.600.0";

const BUCKET = Deno.env.get("R2_BUCKET_NAME") ?? "";

// Runs on a schedule (see the pg_cron migration) - never called by a
// client or gated by verify_jwt, so a shared secret (set by the same
// migration that schedules the cron call) is the only thing stopping
// anyone who finds this URL from triggering it on demand.
serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const realSecret = Deno.env.get("CLEANUP_SECRET") ?? "";

  // Keeps Postgres's copy of this function's own secret in sync so the
  // cron job (which has no way to read this function's environment
  // directly) always has the current value to send back - harmless no
  // matter who triggers it, since the value written is always this
  // function's own, never anything request-supplied.
  if (realSecret) {
    await supabaseAdmin.rpc("set_app_secret", { p_key: "cleanup_secret", p_value: realSecret });
  }

  const providedSecret = req.headers.get("x-cleanup-secret");
  if (!providedSecret || providedSecret !== realSecret) {
    return new Response(JSON.stringify({ error: "Not authorized" }), { status: 403, headers: { "Content-Type": "application/json" } });
  }

  const results = { applications_processed: 0, conversations_wiped: 0, messages_expired: 0, errors: [] as string[] };

  try {
    const { data: due } = await supabaseAdmin
      .from("applications")
      .select("id, campaign_id, creator_id, video_url, deliverable_url, campaigns(brand_id)")
      .eq("media_deleted", false)
      .not("media_delete_at", "is", null)
      .lte("media_delete_at", new Date().toISOString());

    for (const app of (due ?? []) as any[]) {
      try {
        const brandId = app.campaigns?.brand_id;

        // Pitch video and deliverable are cleanly scoped to this one
        // application - always safe to remove regardless of anything else.
        if (app.video_url) await deletePrefix(`pitches/${app.creator_id}_${app.campaign_id}_`);
        if (app.deliverable_url) await deletePrefix(`deliverables/${app.id}_`);

        // The chat conversation is shared per brand+creator pair, not per
        // application - a creator can have multiple deals with the same
        // brand in one thread. Only wipe its media once every application
        // between this exact pair has actually closed (paid/rejected),
        // never while a different deal in the same thread is still active.
        if (brandId) {
          const { data: stillActive } = await supabaseAdmin
            .from("applications")
            .select("id, campaigns!inner(brand_id)")
            .eq("creator_id", app.creator_id)
            .eq("campaigns.brand_id", brandId)
            .eq("status", "accepted")
            .neq("id", app.id);

          if (!stillActive || stillActive.length === 0) {
            const { data: conversation } = await supabaseAdmin
              .from("conversations")
              .select("id")
              .or(`and(participant_1.eq.${brandId},participant_2.eq.${app.creator_id}),and(participant_1.eq.${app.creator_id},participant_2.eq.${brandId})`)
              .maybeSingle();

            if (conversation) {
              const { data: mediaMessages } = await supabaseAdmin
                .from("messages")
                .select("id, video_url, image_url")
                .eq("conversation_id", conversation.id)
                .is("media_expired_at", null)
                .or("video_url.not.is.null,image_url.not.is.null");

              for (const msg of mediaMessages ?? []) {
                const url = msg.video_url || msg.image_url;
                const key = url ? new URL(url).pathname.replace(/^\//, "") : null;
                if (key) {
                  try { await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key })); } catch { /* already gone is fine */ }
                }
              }

              if (mediaMessages && mediaMessages.length > 0) {
                await supabaseAdmin.from("messages")
                  .update({ video_url: null, image_url: null, media_expired_at: new Date().toISOString() })
                  .eq("conversation_id", conversation.id)
                  .is("media_expired_at", null)
                  .or("video_url.not.is.null,image_url.not.is.null");
                results.messages_expired += mediaMessages.length;
              }
              results.conversations_wiped++;
            }
          }
        }

        await supabaseAdmin.from("applications")
          .update({ video_url: null, deliverable_url: null, media_deleted: true })
          .eq("id", app.id);

        results.applications_processed++;
      } catch (err) {
        results.errors.push(`application ${app.id}: ${(err as Error).message || err}`);
      }
    }
  } catch (err) {
    results.errors.push(`top-level: ${(err as Error).message || err}`);
  }

  return new Response(JSON.stringify(results), { status: 200, headers: { "Content-Type": "application/json" } });
});
