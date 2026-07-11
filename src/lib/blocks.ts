import { supabase } from "./supabase";

// A block hides content and contact in both directions - if either side
// blocked the other, neither should see the other's profile/content or be
// able to message them. This returns every user id involved in a block with
// the given user, regardless of who blocked whom.
export async function getBlockedUserIds(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from("blocks")
    .select("blocker_id, blocked_id")
    .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);
  if (!data) return [];
  const ids = new Set<string>();
  data.forEach(b => {
    ids.add(b.blocker_id === userId ? b.blocked_id : b.blocker_id);
  });
  return Array.from(ids);
}
