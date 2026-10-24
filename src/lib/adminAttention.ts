import { useEffect, useState } from "react";
import { supabase } from "./supabase";

// How many things are waiting for the admin to look at: brands asking to be verified, open
// reports about people, and open disputes (a card chargeback arrives as one). It drives the
// red dot on the Profile tab, on the menu button and on the "Admin Review" row.
//
// Everyone who isn't the admin gets 0 without the database being asked anything. (The database
// refuses the admin-only data to anyone else anyway; this only saves them the question.)

const ADMIN_EMAIL = "obaroikoyo@gmail.com";

type Client = Pick<typeof supabase, "auth" | "from" | "rpc">;

export async function countAdminAttention(client: Client = supabase): Promise<number> {
  try {
    const { data: { session } } = await client.auth.getSession();
    if (session?.user?.email !== ADMIN_EMAIL) return 0;

    // Each kind is counted on its own, so one that can't be read doesn't hide the others.
    const kinds = await Promise.allSettled([
      client.from("verification_requests").select("id").eq("status", "pending"),
      client.from("reports").select("id").eq("status", "open"),
      client.rpc("admin_open_disputes"),
    ]);
    return kinds.reduce((total, kind) => total + (kind.status === "fulfilled" && Array.isArray(kind.value.data) ? kind.value.data.length : 0), 0);
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
