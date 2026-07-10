import { resetSupabaseClient } from "./supabase";

export function withTimeout<T>(promise: PromiseLike<T>, ms = 10000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => {
      // A timeout here usually means the Supabase auth client's internal
      // lock got stuck (see resetSupabaseClient) rather than a merely slow
      // network - swap in a fresh client so the *next* call doesn't hang
      // too. Harmless no-op if the timeout was just an ordinary slow
      // request instead.
      resetSupabaseClient();
      reject(new Error("Request timed out"));
    }, ms)),
  ]);
}
