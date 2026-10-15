/* eslint-disable @typescript-eslint/no-explicit-any */
// The signed-in "user" the demo's fake auth hands the app. There is no real
// token behind it: the access token is only shaped like one so the client
// library is happy, and nothing ever sends it to a server.

import type { DemoSession } from "./session";

function b64url(input: string): string {
  return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function demoEmail(session: DemoSession): string {
  return `demo-${session.userId.slice(0, 8)}@demo.flipcollab.invalid`;
}

export function demoUser(session: DemoSession): Record<string, any> {
  const created = new Date(session.startedAt).toISOString();
  return {
    id: session.userId,
    aud: "authenticated",
    role: "authenticated",
    email: demoEmail(session),
    email_confirmed_at: created,
    confirmed_at: created,
    phone: "",
    last_sign_in_at: created,
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { demo: true },
    identities: [],
    created_at: created,
    updated_at: created,
    is_anonymous: false,
  };
}

export function demoSessionJson(session: DemoSession): Record<string, any> {
  const nowSec = Math.floor(Date.now() / 1000);
  const tenYears = 10 * 365 * 24 * 3600;
  const header = b64url(JSON.stringify({ alg: "none", typ: "JWT" }));
  const payload = b64url(JSON.stringify({ sub: session.userId, role: "authenticated", aud: "authenticated", demo: true, iat: nowSec, exp: nowSec + tenYears }));
  return {
    access_token: `${header}.${payload}.demo`,
    refresh_token: "demo-refresh-token",
    token_type: "bearer",
    expires_in: tenYears,
    expires_at: nowSec + tenYears,
    user: demoUser(session),
  };
}
