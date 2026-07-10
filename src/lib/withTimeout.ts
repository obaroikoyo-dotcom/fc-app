import { resetSupabaseClient } from "./supabase";
import { logEvent } from "./debugLog";

export function withTimeout<T>(promise: PromiseLike<T>, ms = 10000, label = "unlabeled"): Promise<T> {
  logEvent(`withTimeout start [${label}] ms=${ms}`);
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      // A timeout here usually means the Supabase auth client's internal
      // lock got stuck (see resetSupabaseClient) rather than a merely slow
      // network - swap in a fresh client so the *next* call doesn't hang
      // too. Harmless no-op if the timeout was just an ordinary slow
      // request instead.
      logEvent(`withTimeout TIMED OUT [${label}] after ${ms}ms - resetting supabase client`);
      resetSupabaseClient();
      reject(new Error("Request timed out"));
    }, ms);
  });

  const racedPromise = (async () => {
    try {
      const result = await promise;
      logEvent(`withTimeout resolved [${label}]`);
      return result;
    } finally {
      // Without this, the timer above still fires `ms` later regardless of
      // whether this already resolved - silently resetting the Supabase
      // client on every single successful call, not just on real timeouts.
      clearTimeout(timer);
    }
  })();

  return Promise.race([racedPromise, timeoutPromise]);
}
