import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://otbcvpgtxxidgtbxgzpo.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90YmN2cGd0eHhpZGd0YnhnenBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxOTE5MDUsImV4cCI6MjA5Mzc2NzkwNX0.g4fE1nkcI8vQac0iahsiBsts46lxFD4IhAE4lrwYNBE";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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