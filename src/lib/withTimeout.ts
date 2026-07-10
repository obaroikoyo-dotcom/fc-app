import { resetSupabaseClient } from "./supabase";
import { logEvent } from "./debugLog";

async function raceOnce<T>(factory: () => PromiseLike<T>, ms: number, label: string): Promise<T> {
  logEvent(`withTimeout start [${label}] ms=${ms}`);
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      // A timeout here usually means the Supabase auth client's internal
      // lock got stuck (see resetSupabaseClient) rather than a merely slow
      // network - swap in a fresh client so the retry (and anything else)
      // doesn't hang too. Harmless no-op if the timeout was just an
      // ordinary slow request instead.
      logEvent(`withTimeout TIMED OUT [${label}] after ${ms}ms - resetting supabase client`);
      resetSupabaseClient();
      reject(new Error("Request timed out"));
    }, ms);
  });

  const racedPromise = (async () => {
    try {
      const result = await factory();
      logEvent(`withTimeout resolved [${label}]`);
      return result;
    } finally {
      clearTimeout(timer);
    }
  })();

  return Promise.race([racedPromise, timeoutPromise]);
}

// Accepts either a promise-returning function (preferred - lets a stalled
// attempt be retried with a fresh request) or a bare promise (kept for call
// sites where the request already fired; a stall there can't be retried,
// only detected).
export async function withTimeout<T>(promiseOrFactory: PromiseLike<T> | (() => PromiseLike<T>), ms = 10000, label = "unlabeled"): Promise<T> {
  const factory = typeof promiseOrFactory === "function" ? promiseOrFactory : () => promiseOrFactory;
  try {
    return await raceOnce(factory, ms, label);
  } catch (err) {
    if (typeof promiseOrFactory !== "function") throw err;
    // The client was just swapped for a fresh one - if the stall was the
    // stuck-auth-lock issue, retrying right away with the new client
    // usually succeeds immediately. Without this, callers fall back to
    // whatever their catch block does (often "treat as logged out"), which
    // is visible as a flash to role-select and back once the real session
    // turns out to be fine after all.
    logEvent(`withTimeout retrying once [${label}]`);
    return await raceOnce(factory, ms, `${label}.retry`);
  }
}
