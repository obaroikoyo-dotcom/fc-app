import { useEffect, useState } from "react";

// Only shows a loading skeleton if the load is actually slow. Avoids the
// skeleton flashing in and out on fast connections - the page just appears
// normally once data is ready. Resets immediately the moment loading ends.
export function useDelayedLoading(loading: boolean, delayMs = 400) {
  const [showSkeleton, setShowSkeleton] = useState(false);

  useEffect(() => {
    if (!loading) {
      setShowSkeleton(false);
      return;
    }
    const timer = setTimeout(() => setShowSkeleton(true), delayMs);
    return () => clearTimeout(timer);
  }, [loading, delayMs]);

  return showSkeleton;
}
