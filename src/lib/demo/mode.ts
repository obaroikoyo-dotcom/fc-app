// Demo mode is switched on by the address (/demo, /demo/creator and
// /demo/brand) together with a valid private link key (see ./access.ts).
// Nothing else turns it on, and nothing in the signed-in app links to it, so a
// normal visit can never end up here by accident.
//
// While it is on, the app talks to a throwaway in-memory copy of the backend
// that lives in the visitor's own tab (see ./client.ts). It never reaches the
// real database, payments, push notifications or file storage.

import { hasDemoAccess } from "./access";

export type DemoRole = "creator" | "brand";

const DEMO_PATH = /^\/demo(?:\/(creator|brand))?\/?$/;

// A demo address, key or not. Without a key the visitor is sent to the front
// page and the demo never starts.
export function isDemoAddress(): boolean {
  return typeof window !== "undefined" && DEMO_PATH.test(window.location.pathname);
}

export function isDemoMode(): boolean {
  return isDemoAddress() && hasDemoAccess();
}

// "/demo/creator" -> "creator", "/demo/brand" -> "brand", "/demo" -> null
// (the page where the visitor picks).
export function demoRoleFromPath(): DemoRole | null {
  if (typeof window === "undefined") return null;
  const match = DEMO_PATH.exec(window.location.pathname);
  return (match?.[1] as DemoRole | undefined) ?? null;
}
