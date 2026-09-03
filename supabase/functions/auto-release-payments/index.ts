import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { releasePayoutForApplication } from "../_shared/releasePayout.ts";

// Runs on a schedule (see the pg_cron migration) - a delivered deal the
// brand hasn't released *or* disputed within 7 days releases itself, so a
// creator who's actually done the work is never stuck waiting on a brand
// that's gone quiet. A dispute raised inside that window (application
// status flips to "disputed") is excluded here - it's already accounted
// for by the status filter below, not by a separate check.
serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const realSecret = Deno.env.get("CLEANUP_SECRET") ?? "";

  // Shares the same cron secret r2-scheduled-cleanup bootstraps into
  // Postgres - no need for a second one.
  if (realSecret) {
    await supabaseAdmin.rpc("set_app_secret", { p_key: "cleanup_secret", p_value: realSecret });
  }

  const providedSecret = req.headers.get("x-cleanup-secret");
  if (!providedSecret || providedSecret !== realSecret) {
    return new Response(JSON.stringify({ error: "Not authorized" }), { status: 403, headers: { "Content-Type": "application/json" } });
  }

  const results = { released: 0, errors: [] as string[] };

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: due } = await supabaseAdmin
      .from("applications")
      .select("id")
      .eq("status", "funded")
      .not("deliverable_uploaded_at", "is", null)
      .lte("deliverable_uploaded_at", sevenDaysAgo);

    for (const app of due ?? []) {
      try {
        const result = await releasePayoutForApplication(supabaseAdmin, app.id);
        if (result.released) results.released++;
        else results.errors.push(`application ${app.id}: ${result.reason} - ${result.error ?? ""}`);
      } catch (err) {
        results.errors.push(`application ${app.id}: ${(err as Error).message || err}`);
      }
    }
  } catch (err) {
    results.errors.push(`top-level: ${(err as Error).message || err}`);
  }

  return new Response(JSON.stringify(results), { status: 200, headers: { "Content-Type": "application/json" } });
});
