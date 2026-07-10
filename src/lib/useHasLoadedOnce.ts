import { useRef } from "react";

// Once a page has painted real content, a later re-fetch (e.g. triggered by
// returning from background) should never hide that content behind a
// skeleton/blank state again - if the re-fetch hangs or is slow, the user
// just keeps seeing the last-known content instead of getting stuck staring
// at a loading placeholder forever.
export function useHasLoadedOnce(loading: boolean) {
  const hasLoadedRef = useRef(false);
  if (!loading) hasLoadedRef.current = true;
  return hasLoadedRef.current;
}
