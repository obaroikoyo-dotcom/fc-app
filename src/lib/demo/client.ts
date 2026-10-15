/* eslint-disable @typescript-eslint/no-explicit-any */
// The Supabase client the app uses while in demo mode. It is a normal
// supabase-js client, so every page works unchanged, but it is pointed at a
// host that cannot resolve, carries no real key, and routes every request
// into the in-memory backend instead of the network.
//
// The backend itself (./engine) is loaded on the first request, so nobody
// outside the demo ever downloads it.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { demoSessionJson } from "./auth";
import { DemoChannel, removeAllChannels } from "./realtime";
import { getDemoSession } from "./session";

// ".invalid" is reserved and never resolves, so even if a request somehow
// escaped it could not reach anything.
export const DEMO_URL = "https://demo.flipcollab.invalid";
const AUTH_KEY = "fc-demo-auth";

// The app also calls the real project's address directly in a few places
// (payout and posting helpers). In demo mode those get the same treatment.
const REAL_PROJECT = /^https:\/\/[a-z0-9-]+\.supabase\.co(\/|$)/i;

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

export async function demoFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let options = init;
  if (!options && typeof Request !== "undefined" && input instanceof Request) {
    options = { method: input.method, headers: input.headers, body: input.method === "GET" || input.method === "HEAD" ? undefined : await input.text() };
  }
  const { handleRequest } = await import("./engine");
  return handleRequest(urlOf(input), options);
}

let firewallUp = false;

// Anything aimed at the real project (or the demo host) is answered by the
// demo backend and never leaves the page. Everything else passes through
// untouched (fonts, Stripe's script, and so on).
function raiseFirewall() {
  if (firewallUp || typeof window === "undefined") return;
  firewallUp = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = urlOf(input);
    if (url.startsWith(DEMO_URL) || REAL_PROJECT.test(url)) return demoFetch(input, init);
    return realFetch(input, init);
  };
}

let signedOut = false;

// Where the client library looks for "the saved session". It always answers
// with the demo visitor, until they sign out.
const authStorage = {
  getItem(key: string): string | null {
    if (key !== AUTH_KEY || signedOut) return null;
    const session = getDemoSession();
    return session ? JSON.stringify(demoSessionJson(session)) : null;
  },
  setItem(): void {},
  removeItem(key: string): void {
    if (key === AUTH_KEY) signedOut = true;
  },
};

export function createDemoClient(): SupabaseClient {
  raiseFirewall();
  // A made-up world has no business in search results.
  if (typeof document !== "undefined") {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex";
    document.head.appendChild(meta);
  }
  const client = createClient(DEMO_URL, "demo-key-not-a-real-key", {
    auth: {
      storageKey: AUTH_KEY,
      storage: authStorage,
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { fetch: demoFetch },
  });

  // The real realtime client would open a websocket. These stay local.
  const c = client as any;
  c.channel = (name: string) => new DemoChannel(name);
  c.removeChannel = (channel: DemoChannel) => channel.unsubscribe();
  c.removeAllChannels = () => {
    removeAllChannels();
    return Promise.resolve([]);
  };
  c.getChannels = () => [];
  return client;
}
