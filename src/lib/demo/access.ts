// Who can open the demo. It is an unlisted link, the same idea as a Google
// Docs "anyone with the link" share: the address carries a secret key
// (flipcollab.com/demo?k=...), and without a valid one the demo does not start
// and /demo sends the visitor to the normal front page, as though there were
// nothing there.
//
// Only a fingerprint (SHA-256) of each key is kept here, never the key, so
// reading this file or the site's code does not reveal a working link.
//
// To give someone a link, or take one away, edit ALLOWED below:
//   node scripts/demo-link.mjs        makes a new key, its link and its line
//   node scripts/demo-link.mjs hash <key>   fingerprints a key you already have
// Removing a line and publishing the site switches that link off.

import { sha256Hex } from "./sha256";

export const ALLOWED: readonly string[] = [
  // first link
  "7aef9c281d77abfe552d436a7ea54829babb4d4e170b3e064f15d7ae792f29b8",
];

const KEY_PARAM = "k";
const TAB_KEY = "fc_demo_key";
// Only ever accepted while running the local dev server (the build strips it),
// so the automated tests can open the demo without a real link.
const DEV_KEY = "e2e-dev-key";

function isAllowed(key: string): boolean {
  if (import.meta.env.DEV && key === DEV_KEY) return true;
  return ALLOWED.includes(sha256Hex(key));
}

function keyFromUrl(): string | null {
  try {
    return new URLSearchParams(window.location.search).get(KEY_PARAM);
  } catch {
    return null;
  }
}

function keyFromTab(): string | null {
  try {
    return window.sessionStorage.getItem(TAB_KEY);
  } catch {
    return null;
  }
}

let granted: string | null | undefined;

// The valid key for this visit, from the address or from earlier in this tab,
// or null. Decided once per page load, synchronously, before the demo starts.
// A valid key is remembered for the tab so a reload without it in the address
// keeps working; anything else is forgotten.
function validKey(): string | null {
  if (granted !== undefined) return granted;
  granted = null;
  if (typeof window === "undefined") return granted;
  for (const key of [keyFromUrl(), keyFromTab()]) {
    if (key && isAllowed(key)) {
      granted = key;
      break;
    }
  }
  try {
    if (granted) window.sessionStorage.setItem(TAB_KEY, granted);
    else window.sessionStorage.removeItem(TAB_KEY);
  } catch {
    // storage blocked: the address carries the key instead
  }
  return granted;
}

export function hasDemoAccess(): boolean {
  return validKey() !== null;
}

// "/demo/creator" -> "/demo/creator?k=<key>" so a link copied from the address
// bar part-way through still works for whoever it is sent to.
export function withDemoKey(path: string): string {
  const key = validKey();
  return key ? `${path}?${KEY_PARAM}=${encodeURIComponent(key)}` : path;
}
