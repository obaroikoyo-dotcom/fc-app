import { useState } from "react";

const store = new Map<string, unknown>();

// Same idea as usePersistedState (survive the unmount/remount every page
// goes through on navigation), but backed by a plain in-memory module-level
// Map instead of sessionStorage - for values like File objects (uploaded
// campaign assets) that can't be JSON-serialized but still just need to
// survive a remount within the same browser tab/session, not an actual
// page reload.
export function useMemoryPersistedState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => (store.has(key) ? (store.get(key) as T) : initial));

  const setPersisted = (next: T | ((prev: T) => T)) => {
    setValue(prev => {
      const resolved = typeof next === "function" ? (next as (prev: T) => T)(prev) : next;
      store.set(key, resolved);
      return resolved;
    });
  };

  return [value, setPersisted] as const;
}

export function clearMemoryPersistedState(key: string) {
  store.delete(key);
}
