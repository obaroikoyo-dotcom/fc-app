import { useEffect, useRef } from "react";

// Saves a scrollable container's scroll offset to sessionStorage as the
// user scrolls, and restores it once content has painted after the page
// remounts (App.tsx keys its content wrapper on the page name, so every
// navigation is a fresh DOM node - scroll position doesn't survive on its
// own). Restoration is retried across a few animation frames since list
// content (e.g. after a data fetch) may not have its final height yet on
// the very first paint.
export function useScrollRestoration(key: string, ready: boolean) {
  const ref = useRef<HTMLDivElement | null>(null);
  const restoredRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      try {
        sessionStorage.setItem(key, String(el.scrollTop));
      } catch {
        // Non-fatal - just means scroll position won't be restored next time.
      }
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [key]);

  useEffect(() => {
    if (!ready || restoredRef.current) return;
    const el = ref.current;
    if (!el) return;
    const saved = Number(sessionStorage.getItem(key) || "0");
    if (!saved) { restoredRef.current = true; return; }

    let attempts = 0;
    const tryRestore = () => {
      attempts++;
      el.scrollTop = saved;
      if (el.scrollTop >= saved - 4 || attempts >= 5) {
        restoredRef.current = true;
      } else {
        requestAnimationFrame(tryRestore);
      }
    };
    requestAnimationFrame(tryRestore);
  }, [key, ready]);

  return ref;
}
