import { createClient } from "@supabase/supabase-js";
import { isDemoMode } from "./demo/mode";
import { createDemoClient } from "./demo/client";
import { endDemoSession } from "./demo/session";

const supabaseUrl = "https://otbcvpgtxxidgtbxgzpo.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90YmN2cGd0eHhpZGd0YnhnenBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxOTE5MDUsImV4cCI6MjA5Mzc2NzkwNX0.g4fE1nkcI8vQac0iahsiBsts46lxFD4IhAE4lrwYNBE";

// At /demo the app runs against a throwaway in-memory backend (see
// ./demo/client.ts) and never gets a client for the real project at all.
export let supabase = isDemoMode() ? createDemoClient() : createClient(supabaseUrl, supabaseAnonKey);

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
  // The demo's in-memory backend has no auth lock to get stuck, and a fresh
  // client here would be a real one.
  if (isDemoMode()) return;
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

// Used by GoogleSignInButton's onCredential callback. Runs entirely
// client-side (Google Identity Services popup + a direct API call here) -
// no redirect through Supabase's own domain, which is what lets Google's
// UI show flipcollab.com instead of the raw supabase.co project ref.
export async function signInWithGoogleIdToken(idToken: string, nonce: string) {
  return supabase.auth.signInWithIdToken({ provider: "google", token: idToken, nonce });
}

// Same shape as signInWithGoogleIdToken, used by AppleSignInButton's
// onCredential callback.
export async function signInWithAppleIdToken(idToken: string, nonce: string) {
  return supabase.auth.signInWithIdToken({ provider: "apple", token: idToken, nonce });
}

// Supabase's internal auth lock (serializes token-refresh across tabs) can
// get stuck if a refresh was in-flight when the tab was backgrounded and
// timer throttling prevented it from ever completing - every subsequent
// auth call, including signOut(), then waits on it forever. This guarantees
// the user ends up signed out and the page reloads regardless of whether
// the underlying call ever actually completes.
export async function forceSignOut() {
  // Leaving the demo: forget the made-up visitor and go back to the picker.
  // The real session in this browser (if any) is never touched.
  if (isDemoMode()) {
    endDemoSession();
    window.location.assign("/demo");
    return;
  }
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