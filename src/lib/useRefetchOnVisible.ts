import { useEffect, useRef } from "react";

// If a page comes back to the foreground while it's still stuck on a
// loading skeleton, the original in-flight request likely died during
// backgrounding (dropped connection, throttled/killed timers) and will
// never resolve on its own. Re-issue the fetch immediately rather than
// waiting on it - much faster and less disruptive than a full page reload.
export function useRefetchOnVisible(refetch: () => void, isLoading: boolean) {
  const stateRef = useRef({ refetch, isLoading });
  stateRef.current = { refetch, isLoading };

  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "visible" && stateRef.current.isLoading) {
        stateRef.current.refetch();
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);
}
