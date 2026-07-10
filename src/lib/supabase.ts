import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://otbcvpgtxxidgtbxgzpo.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90YmN2cGd0eHhpZGd0YnhnenBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxOTE5MDUsImV4cCI6MjA5Mzc2NzkwNX0.g4fE1nkcI8vQac0iahsiBsts46lxFD4IhAE4lrwYNBE";

export let supabase = createClient(supabaseUrl, supabaseAnonKey);

// @supabase/auth-js can get permanently stuck: if a token refresh is
// in-flight when the tab is backgrounded and iOS suspends the request
// mid-flight, the client's internal auth lock never gets released - unlike
// the initial lock acquisition, that reentrant wait path has no timeout of
// its own, so every subsequent supabase.auth.* call (and anything that
// depends on it, including plain data fetches that check the session)
// hangs forever for the rest of the session. Swapping in a fresh client
// instance is the only way to actually clear that stuck state; it reads
// the same persisted session from localStorage, so the user stays signed
// in. withTimeout() calls this whenever a request times out.
export function resetSupabaseClient() {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

export async function signInWithGoogle() {
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
}

// Supabase's internal auth lock (serializes token-refresh across tabs) can
// get stuck if a refresh was in-flight when the tab was backgrounded and
// timer throttling prevented it from ever completing - every subsequent
// auth call, including signOut(), then waits on it forever. This guarantees
// the user ends up signed out and the page reloads regardless of whether
// the underlying call ever actually completes.
export async function forceSignOut() {
  try {
    await Promise.race([
      supabase.auth.signOut(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("signOut timed out")), 5000)),
    ]);
  } catch (err) {
    console.error("signOut didn't complete in time, clearing session locally:", err);
    Object.keys(localStorage)
      .filter((k) => k.startsWith("sb-"))
      .forEach((k) => localStorage.removeItem(k));
  } finally {
    window.location.reload();
  }
}