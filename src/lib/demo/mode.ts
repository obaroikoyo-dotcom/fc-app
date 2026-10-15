// Demo mode is switched on by the address alone: /demo, /demo/creator and
// /demo/brand. Nothing else turns it on, and nothing in the signed-in app
// links to it, so a normal visit can never end up here by accident.
//
// While it is on, the app talks to a throwaway in-memory copy of the backend
// that lives in the visitor's own tab (see ./client.ts). It never reaches the
// real database, payments, push notifications or file storage.

export type DemoRole = "creator" | "brand";

const DEMO_PATH = /^\/demo(?:\/(creator|brand))?\/?$/;

export function isDemoMode(): boolean {
  return typeof window !== "undefined" && DEMO_PATH.test(window.location.pathname);
}

// "/demo/creator" -> "creator", "/demo/brand" -> "brand", "/demo" -> null
// (the page where the visitor picks).
export function demoRoleFromPath(): DemoRole | null {
  if (typeof window === "undefined") return null;
  const match = DEMO_PATH.exec(window.location.pathname);
  return (match?.[1] as DemoRole | undefined) ?? null;
}
