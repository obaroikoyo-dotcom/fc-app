import { useEffect, useState } from "react";
import { supabase } from "./supabase";

// What is waiting for the admin to look at: brands asking to be verified, open reports about
// people, and open disputes (a card chargeback arrives as one). A red dot shows on the Profile
// tab, the menu button, the "Admin Review" row and the tabs inside Admin Review for whatever
// the admin has not looked at yet; opening a tab counts as looking at what is in it.
//
// Everyone who isn't the admin gets 0 without the database being asked anything. (The database
// refuses the admin-only data to anyone else anyway; this only saves them the question.)

const ADMIN_EMAIL = "obaroikoyo@gmail.com";

export type AdminKind = "verification" | "reports" | "disputes";
type Client = Pick<typeof supabase, "auth" | "from" | "rpc">;

// What has been looked at, kept on this device (the ids of the items that were on show).
const SEEN_KEY = "fc_admin_seen";
type Seen = Partial<Record<AdminKind, string[]>>;
let seenThisVisit: Seen = {};

export function readAdminSeen(): Seen {
  try {
    const saved = localStorage.getItem(SEEN_KEY);
    if (saved) seenThisVisit = JSON.parse(saved) as Seen;
  } catch { /* storage blocked: what was seen this visit is still remembered */ }
  return seenThisVisit;
}

// The admin has looked at these: they stop counting until something new turns up.
export function markAdminSeen(kind: AdminKind, ids: string[]) {
  seenThisVisit = { ...readAdminSeen(), [kind]: ids };
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(seenThisVisit)); } catch { /* as above */ }
}

export function unseenAdminIds(kind: AdminKind, ids: string[]): string[] {
  const seen = readAdminSeen()[kind] ?? [];
  return ids.filter(id => !seen.includes(id));
}

export async function countAdminAttention(client: Client = supabase): Promise<number> {
  try {
    const { data: { session } } = await client.auth.getSession();
    if (session?.user?.email !== ADMIN_EMAIL) return 0;

    // Each kind is read on its own, so one that can't be read doesn't hide the others.
    const [verification, reports, disputes] = await Promise.allSettled([
      client.from("verification_requests").select("id").eq("status", "pending"),
      client.from("reports").select("id").eq("status", "open"),
      client.rpc("admin_open_disputes"),
    ]);
    const idsOf = (result: PromiseSettledResult<{ data: unknown }>): string[] =>
      result.status === "fulfilled" && Array.isArray(result.value.data) ? result.value.data.map((row: { id: string }) => row.id) : [];
    return unseenAdminIds("verification", idsOf(verification)).length
      + unseenAdminIds("reports", idsOf(reports)).length
      + unseenAdminIds("disputes", idsOf(disputes)).length;
  } catch (err) {
    console.error("Couldn't count what is waiting for the admin:", err);
    return 0;
  }
}

// Counted again when `page` changes (so it clears once the admin has been through the review
// screen), every minute, and when the app comes back to the front.
export function useAdminAttention(page?: string): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let live = true;
    const refresh = () => { void countAdminAttention().then(n => { if (live) setCount(n); }); };
    refresh();
    const timer = setInterval(refresh, 60_000);
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { live = false; clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [page]);

  return count;
}
