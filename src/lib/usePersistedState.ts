import { useState } from "react";

// Behaves like useState, but survives the unmount/remount every page goes
// through on navigation (App.tsx keys its content wrapper on the page name)
// by reading/writing sessionStorage - so filters/search terms don't reset
// every time a user views something and comes back. Session-scoped (not
// localStorage) since this is "don't lose my place during this visit," not
// something that should persist across separate app opens.
export function usePersistedState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(key);
      return raw !== null ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  const setPersisted = (next: T | ((prev: T) => T)) => {
    setValue(prev => {
      const resolved = typeof next === "function" ? (next as (prev: T) => T)(prev) : next;
      try {
        sessionStorage.setItem(key, JSON.stringify(resolved));
      } catch {
        // Storage full/unavailable - the in-memory value still works for
        // this session, it just won't survive a remount.
      }
      return resolved;
    });
  };

  return [value, setPersisted] as const;
}
