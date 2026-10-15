/* eslint-disable @typescript-eslint/no-explicit-any */
// The fake backend itself: takes the HTTP requests the Supabase client would
// have sent to the real project and answers them from an in-memory database.
// It is loaded only when someone opens /demo, so normal visitors never
// download any of this.

import { demoSessionJson, demoUser } from "./auth";
import { startAutomation, type Scheduler } from "./automation";
import type { Ctx } from "./ctx";
import { runFunction } from "./functions";
import { Db, PgError, matchRows, runRead, shapeRows, type Row, type Tables } from "./query";
import { runRpc } from "./rpc";
import { buildWorld } from "./seed";
import { getDemoSession, readSnapshot, writeSnapshot, type DemoSession } from "./session";

const SNAPSHOT_VERSION = 1;
// sessionStorage holds about 5MB; a snapshot bigger than this just isn't saved
// (the visit keeps working, it only can't survive a reload).
const SNAPSHOT_LIMIT = 3_500_000;

export interface EngineOptions {
  persist?: boolean;
  automate?: boolean;
  schedule?: Scheduler;
  nowMs?: number;
  latencyMs?: number;
}

export interface Engine {
  ctx: Ctx;
  handle(url: string, init?: RequestInit): Promise<Response>;
}

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function pgError(err: PgError): Response {
  return json(err.status, { code: err.code, message: err.message, details: err.details, hint: null });
}

function oneRowOrThrow(rows: unknown[]): unknown {
  if (rows.length !== 1) {
    throw new PgError(406, "PGRST116", "JSON object requested, multiple (or no) rows returned", `The result contains ${rows.length} rows`);
  }
  return rows[0];
}

// A video picked during an earlier page load can't be played again after a
// reload (its temporary address is gone), so those are dropped on restore.
function dropDeadBlobUrls(tables: Tables) {
  for (const rows of Object.values(tables)) {
    for (const row of rows) {
      for (const [k, v] of Object.entries(row)) {
        if (typeof v === "string" && v.startsWith("blob:")) row[k] = null;
      }
    }
  }
}

function restore(session: DemoSession): Tables | null {
  const raw = readSnapshot();
  if (!raw) return null;
  try {
    const snap = JSON.parse(raw);
    if (snap?.v === SNAPSHOT_VERSION && snap.userId === session.userId && snap.tables) {
      dropDeadBlobUrls(snap.tables as Tables);
      return snap.tables as Tables;
    }
  } catch {
    // unreadable - start from a fresh world
  }
  return null;
}

export function createEngine(session: DemoSession, opts: EngineOptions = {}): Engine {
  const persist = opts.persist ?? true;
  const restored = persist ? restore(session) : null;
  const tables = restored ?? buildWorld(session.seed, session.userId, session.role, opts.nowMs).tables;
  const db = new Db(tables);
  const ctx: Ctx = { db, session };

  if (persist) {
    const save = () => {
      try {
        const text = JSON.stringify({ v: SNAPSHOT_VERSION, userId: session.userId, tables: db.tables });
        if (text.length < SNAPSHOT_LIMIT) writeSnapshot(text);
      } catch {
        // storage full or blocked - the visit carries on in memory
      }
    };
    let pending: ReturnType<typeof setTimeout> | null = null;
    db.onMutate = () => {
      if (pending) return;
      pending = setTimeout(() => {
        pending = null;
        save();
      }, 400);
    };
    // A brand-new world is saved straight away, so a reload before the visitor
    // has done anything lands in the same world rather than a rebuilt one.
    if (!restored) save();
  }

  if (opts.automate ?? true) startAutomation(ctx, opts.schedule);

  const latency = opts.latencyMs ?? 40;

  async function handle(rawUrl: string, init?: RequestInit): Promise<Response> {
    if (latency > 0) await new Promise(resolve => setTimeout(resolve, latency));
    try {
      return route(ctx, rawUrl, init);
    } catch (err) {
      if (err instanceof PgError) return pgError(err);
      console.error("demo backend error:", err);
      return json(500, { code: "XX000", message: "Something went wrong in the demo.", details: null, hint: null });
    }
  }

  return { ctx, handle };
}

function route(ctx: Ctx, rawUrl: string, init?: RequestInit): Response {
  const url = new URL(rawUrl, "https://demo.flipcollab.invalid");
  const method = (init?.method ?? "GET").toUpperCase();
  const headers = new Headers(init?.headers ?? undefined);
  let body: any;
  if (typeof init?.body === "string" && init.body !== "") {
    try {
      body = JSON.parse(init.body);
    } catch {
      body = undefined;
    }
  }
  const path = url.pathname.replace(/\/+$/, "");

  if (path.startsWith("/rest/v1/rpc/")) return rpc(ctx, path.slice("/rest/v1/rpc/".length), body, headers);
  if (path.startsWith("/rest/v1/")) return table(ctx, path.slice("/rest/v1/".length), method, url, body, headers);
  if (path.startsWith("/auth/v1")) return auth(ctx, path.slice("/auth/v1".length), method, url);
  if (path.startsWith("/functions/v1/")) {
    const result = runFunction(ctx, path.slice("/functions/v1/".length), body ?? {});
    return json(result.status, result.json);
  }
  return json(404, { error: "Not found" });
}

function rpc(ctx: Ctx, fn: string, body: Row | undefined, headers: Headers): Response {
  const result = runRpc(ctx, fn, body ?? {});
  const wantsObject = (headers.get("accept") ?? "").includes("application/vnd.pgrst.object+json");
  if (wantsObject && Array.isArray(result)) return json(200, oneRowOrThrow(result));
  return json(200, result === undefined ? null : result);
}

function table(ctx: Ctx, name: string, method: string, url: URL, body: any, headers: Headers): Response {
  const { db } = ctx;
  const prefer = headers.get("prefer") ?? "";
  const wantsObject = (headers.get("accept") ?? "").includes("application/vnd.pgrst.object+json");
  const wantsRows = prefer.includes("return=representation");
  const select = url.searchParams.get("select");

  if (method === "GET" || method === "HEAD") {
    const { rows, total } = runRead(db.tables, name, url.searchParams);
    const range = rows.length ? `0-${rows.length - 1}/${total}` : `*/${total}`;
    if (method === "HEAD") return new Response(null, { status: 200, headers: { "content-range": range } });
    return json(200, wantsObject ? oneRowOrThrow(rows) : rows, { "content-range": range });
  }

  if (method === "POST") {
    const items: Row[] = Array.isArray(body) ? body : [body ?? {}];
    const merge = prefer.includes("resolution=merge-duplicates");
    const ignore = prefer.includes("resolution=ignore-duplicates");
    const onConflict = (url.searchParams.get("on_conflict") ?? "").split(",").filter(Boolean);
    const written = items.map(item => (merge || ignore ? db.upsert(name, item, onConflict, ignore) : db.insert(name, item)));
    if (!wantsRows) return new Response(null, { status: 201 });
    const shaped = shapeRows(db.tables, name, written, select);
    return json(201, wantsObject ? oneRowOrThrow(shaped) : shaped);
  }

  if (method === "PATCH") {
    const changed = db.update(name, matchRows(db.tables, name, url.searchParams), body ?? {});
    if (!wantsRows) return new Response(null, { status: 204 });
    const shaped = shapeRows(db.tables, name, changed, select);
    return json(200, wantsObject ? oneRowOrThrow(shaped) : shaped);
  }

  if (method === "DELETE") {
    const removed = db.remove(name, matchRows(db.tables, name, url.searchParams));
    if (!wantsRows) return new Response(null, { status: 204 });
    return json(200, wantsObject ? oneRowOrThrow(removed) : removed);
  }

  return json(405, { message: `Method ${method} not allowed` });
}

function auth(ctx: Ctx, sub: string, method: string, url: URL): Response {
  const { session } = ctx;
  if (sub === "/user" && (method === "GET" || method === "PUT")) return json(200, demoUser(session));
  if (sub === "/logout") return new Response(null, { status: 204 });
  if (sub === "/token" && url.searchParams.get("grant_type") === "refresh_token") return json(200, demoSessionJson(session));
  const msg = "Signing in and out isn't available in the demo.";
  return json(400, { code: 400, error_code: "demo_disabled", error: "demo_disabled", error_description: msg, msg, message: msg });
}

// --- the engine the app actually uses (one per page load) -------------------

let current: Engine | null = null;

export function handleRequest(url: string, init?: RequestInit): Promise<Response> {
  if (!current) {
    const session = getDemoSession();
    if (!session) return Promise.resolve(json(401, { message: "Pick a demo role first." }));
    current = createEngine(session);
  }
  return current.handle(url, init);
}
