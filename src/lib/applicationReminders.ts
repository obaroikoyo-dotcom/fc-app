import { supabase } from "./supabase";

const STALE_HOURS = 24;

// There's no server-side cron in this project, so this runs opportunistically
// from a creator's own client whenever they view their profile/applications -
// good enough to nudge brands who've sat on a pending application, without
// needing a scheduled job. reminder_sent_at keeps it from firing more than
// once per application.
export async function checkAndSendReminders(creatorId: string): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000).toISOString();

  const { data: stale } = await supabase
    .from("applications")
    .select("id, campaign_id, campaigns(name, brand_id)")
    .eq("creator_id", creatorId)
    .eq("status", "pending")
    .is("reminder_sent_at", null)
    .lt("created_at", cutoff);

  if (!stale || stale.length === 0) return;

  for (const app of stale as any[]) {
    const brandId = app.campaigns?.brand_id;
    if (!brandId) continue;

    const { error } = await supabase.from("notifications").insert({
      user_id: brandId,
      type: "application_reminder",
      title: "Application waiting on you",
      body: `A creator applied to "${app.campaigns?.name || "your campaign"}" over a day ago and is still waiting to hear back.`,
      data: { campaign_id: app.campaign_id },
    });
    if (error) continue;

    try {
      await supabase.functions.invoke("send-push", {
        body: { user_id: brandId, title: "Application waiting on you", body: `A creator is waiting on a reply for "${app.campaigns?.name || "your campaign"}".` },
      });
    } catch {
      // Push is best-effort - the in-app notification above already landed.
    }

    await supabase.from("applications").update({ reminder_sent_at: new Date().toISOString() }).eq("id", app.id);
  }
}
