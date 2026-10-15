/* eslint-disable @typescript-eslint/no-explicit-any */
// A small PostgREST work-alike: it understands the query strings that
// supabase-js builds (select with embedded tables, eq/neq/in/is/or/not/cs,
// order, limit) and runs them against plain arrays of rows. Only what this app
// actually sends is supported; anything else throws a clear error so a gap
// shows up in testing rather than as silently wrong data.

import { emitChange, type ChangeEvent } from "./realtime";
import { freshId } from "./random";

export type Row = Record<string, any>;
export type Tables = Record<string, Row[]>;

export class PgError extends Error {
  status: number;
  code: string;
  details: string | null;
  constructor(status: number, code: string, message: string, details: string | null = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// ---------------------------------------------------------------------------
// Relationships (what `creator_profiles(name)` inside a select means)
// ---------------------------------------------------------------------------

interface Relation {
  table: string;
  local: string; // column on the table being read
  remote: string; // column on the embedded table
  many: boolean;
}

const one = (table: string, local: string, remote = "id"): Relation => ({ table, local, remote, many: false });
const many = (table: string, local: string, remote: string): Relation => ({ table, local, remote, many: true });

const RELATIONS: Record<string, Record<string, Relation>> = {
  profiles: {
    creator_profiles: one("creator_profiles", "id"),
    brand_profiles: one("brand_profiles", "id"),
  },
  campaigns: {
    brand_profiles: one("brand_profiles", "brand_id"),
    applications: many("applications", "id", "campaign_id"),
  },
  applications: {
    campaigns: one("campaigns", "campaign_id"),
    creator_profiles: one("creator_profiles", "creator_id"),
  },
  campaign_favourites: { campaigns: one("campaigns", "campaign_id") },
  favourites: { creator_profiles: one("creator_profiles", "creator_id") },
  transactions: { campaigns: one("campaigns", "campaign_id") },
  verification_requests: { brand_profiles: one("brand_profiles", "brand_id") },
  brand_reviews: {
    creator_profiles: one("creator_profiles", "creator_id"),
    campaigns: one("campaigns", "campaign_id"),
  },
  creator_reviews: {
    brand_profiles: one("brand_profiles", "brand_id"),
    campaigns: one("campaigns", "campaign_id"),
  },
};

// ---------------------------------------------------------------------------
// select=...
// ---------------------------------------------------------------------------

interface SelectNode {
  name: string;
  alias: string;
  star: boolean;
  inner: boolean;
  children: SelectNode[] | null;
}

function splitTopLevel(input: string, sep = ","): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quoted = false;
  let current = "";
  for (const ch of input) {
    if (ch === '"') quoted = !quoted;
    if (!quoted) {
      if (ch === "(" || ch === "{") depth++;
      else if (ch === ")" || ch === "}") depth--;
      else if (ch === sep && depth === 0) {
        parts.push(current);
        current = "";
        continue;
      }
    }
    current += ch;
  }
  if (current !== "") parts.push(current);
  return parts;
}

export function parseSelect(input: string | null): SelectNode[] {
  const text = (input ?? "").trim();
  if (text === "") return [{ name: "*", alias: "*", star: true, inner: false, children: null }];
  const nodes: SelectNode[] = [];
  for (const raw of splitTopLevel(text)) {
    const token = raw.trim();
    if (token === "") continue;
    if (token === "*") {
      nodes.push({ name: "*", alias: "*", star: true, inner: false, children: null });
      continue;
    }
    const m = /^(?:([A-Za-z0-9_]+):)?([A-Za-z0-9_]+)((?:![A-Za-z0-9_]+)*)(?:\(([\s\S]*)\))?$/.exec(token);
    if (!m) throw new PgError(400, "PGRST100", `Unsupported select expression: ${token}`);
    const hints = m[3] ? m[3].split("!").filter(Boolean) : [];
    nodes.push({
      name: m[2],
      alias: m[1] || m[2],
      star: false,
      inner: hints.includes("inner"),
      children: m[4] !== undefined ? parseSelect(m[4]) : null,
    });
  }
  return nodes;
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

interface Cond {
  kind: "cond";
  path: string[];
  op: string;
  value: string;
  negate: boolean;
}
interface Logic {
  kind: "and" | "or";
  items: FilterNode[];
  negate: boolean;
}
type FilterNode = Cond | Logic;

const OPS = new Set(["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "is", "in", "cs", "cd", "ov", "not"]);

function parseCondition(text: string): FilterNode {
  const segs = text.split(".");
  // not.and(...) / not.or(...) / and(...) / or(...)
  const logic = /^(not\.)?(and|or)\(([\s\S]*)\)$/.exec(text);
  if (logic) return parseLogic(logic[2] as "and" | "or", logic[3], !!logic[1]);
  let opIdx = -1;
  for (let i = 1; i < segs.length; i++) {
    if (OPS.has(segs[i])) {
      opIdx = i;
      break;
    }
  }
  if (opIdx === -1) throw new PgError(400, "PGRST100", `Unsupported filter: ${text}`);
  const path = segs.slice(0, opIdx);
  let op = segs[opIdx];
  let rest = segs.slice(opIdx + 1);
  let negate = false;
  if (op === "not") {
    negate = true;
    op = rest[0];
    rest = rest.slice(1);
    if (!OPS.has(op) || op === "not") throw new PgError(400, "PGRST100", `Unsupported filter: ${text}`);
  }
  return { kind: "cond", path, op, value: rest.join("."), negate };
}

function parseLogic(kind: "and" | "or", body: string, negate: boolean): Logic {
  const inner = body.trim();
  return { kind, items: splitTopLevel(inner).map(s => parseCondition(s.trim())), negate };
}

const RESERVED = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);

export function parseFilters(params: URLSearchParams): FilterNode[] {
  const out: FilterNode[] = [];
  for (const [key, value] of params.entries()) {
    if (RESERVED.has(key)) continue;
    if (key === "or" || key === "and" || key === "not.or" || key === "not.and") {
      const body = /^\(([\s\S]*)\)$/.exec(value.trim());
      if (!body) throw new PgError(400, "PGRST100", `Unsupported ${key} filter: ${value}`);
      out.push(parseLogic(key.endsWith("or") ? "or" : "and", body[1], key.startsWith("not.")));
      continue;
    }
    out.push(parseCondition(`${key}.${value}`));
  }
  return out;
}

function decodeList(value: string): string[] {
  const body = value.trim().replace(/^[({]/, "").replace(/[)}]$/, "");
  return splitTopLevel(body).map(s => {
    const t = s.trim();
    return t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1).replace(/\\"/g, '"') : t;
  });
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

function compare(a: any, b: string): number {
  const na = asNumber(a);
  const nb = asNumber(b);
  if (na !== null && nb !== null) return na - nb;
  const sa = String(a);
  return sa < b ? -1 : sa > b ? 1 : 0;
}

function likeToRegex(pattern: string, flags: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/[*%]/g, ".*").replace(/_/g, ".");
  return new RegExp(`^${escaped}$`, flags);
}

function testCond(row: Row, c: Cond): boolean {
  const col = c.path[c.path.length - 1];
  const rv = row[col];
  let result: boolean;
  switch (c.op) {
    case "is":
      if (c.value === "null") result = rv === null || rv === undefined;
      else if (c.value === "true") result = rv === true;
      else if (c.value === "false") result = rv === false;
      else throw new PgError(400, "PGRST100", `Unsupported is value: ${c.value}`);
      return c.negate ? !result : result;
    case "eq": result = rv !== null && rv !== undefined && (typeof rv === "boolean" ? String(rv) === c.value : compare(rv, c.value) === 0); break;
    case "neq": result = rv !== null && rv !== undefined && compare(rv, c.value) !== 0; break;
    case "gt": result = rv != null && compare(rv, c.value) > 0; break;
    case "gte": result = rv != null && compare(rv, c.value) >= 0; break;
    case "lt": result = rv != null && compare(rv, c.value) < 0; break;
    case "lte": result = rv != null && compare(rv, c.value) <= 0; break;
    case "like": result = rv != null && likeToRegex(c.value, "").test(String(rv)); break;
    case "ilike": result = rv != null && likeToRegex(c.value, "i").test(String(rv)); break;
    case "in": result = rv != null && decodeList(c.value).includes(String(rv)); break;
    case "cs": result = Array.isArray(rv) && decodeList(c.value).every(v => rv.map(String).includes(v)); break;
    case "cd": result = Array.isArray(rv) && rv.map(String).every(v => decodeList(c.value).includes(v)); break;
    case "ov": result = Array.isArray(rv) && decodeList(c.value).some(v => rv.map(String).includes(v)); break;
    default: throw new PgError(400, "PGRST100", `Unsupported operator: ${c.op}`);
  }
  // SQL: NOT (NULL) is NULL, so a missing value never matches a negated test.
  if (c.negate) return rv === null || rv === undefined ? false : !result;
  return result;
}

function testNode(row: Row, node: FilterNode): boolean {
  if (node.kind === "cond") return testCond(row, node);
  const res = node.kind === "and" ? node.items.every(i => testNode(row, i)) : node.items.some(i => testNode(row, i));
  return node.negate ? !res : res;
}

// Conditions on columns of the table itself.
function isOwn(node: FilterNode): boolean {
  if (node.kind === "cond") return node.path.length === 1;
  return node.items.every(isOwn);
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

function clone<T>(v: T): T {
  return v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T);
}

interface Order {
  col: string;
  desc: boolean;
  nullsFirst: boolean;
}

function parseOrder(value: string | null): Order[] {
  if (!value) return [];
  return value.split(",").map(part => {
    const [col, ...mods] = part.split(".");
    const desc = mods.includes("desc");
    const nullsFirst = mods.includes("nullsfirst") ? true : mods.includes("nullslast") ? false : desc;
    return { col, desc, nullsFirst };
  });
}

function sortRows(rows: Row[], orders: Order[]): Row[] {
  if (orders.length === 0) return rows;
  return rows
    .map((row, idx) => ({ row, idx }))
    .sort((x, y) => {
      for (const o of orders) {
        const a = x.row[o.col];
        const b = y.row[o.col];
        const an = a === null || a === undefined;
        const bn = b === null || b === undefined;
        if (an || bn) {
          if (an && bn) continue;
          return (an ? 1 : -1) * (o.nullsFirst ? -1 : 1);
        }
        const na = asNumber(a);
        const nb = asNumber(b);
        const c = na !== null && nb !== null ? na - nb : String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
        if (c !== 0) return o.desc ? -c : c;
      }
      return x.idx - y.idx;
    })
    .map(x => x.row);
}

export interface ReadResult {
  rows: Row[];
  total: number;
}

function shape(tables: Tables, table: string, row: Row, nodes: SelectNode[], embeddedFilters: Cond[]): Row | null {
  const out: Row = {};
  for (const node of nodes) {
    if (node.star) {
      Object.assign(out, row);
      continue;
    }
    if (node.children === null) {
      out[node.alias] = row[node.name] === undefined ? null : row[node.name];
      continue;
    }
    const rel = RELATIONS[table]?.[node.name];
    if (!rel) {
      throw new PgError(400, "PGRST200", `Could not find a relationship between '${table}' and '${node.name}' in the schema cache`);
    }
    const key = row[rel.local];
    let related = (tables[rel.table] || []).filter(r => key !== null && key !== undefined && r[rel.remote] === key);
    // Filters written as `embedded.column=eq.x` apply to the embedded rows.
    const mine = embeddedFilters.filter(f => f.path[0] === node.name || f.path[0] === node.alias);
    if (mine.length) related = related.filter(r => mine.every(f => testCond(r, { ...f, path: f.path.slice(1) })));
    const shaped = related
      .map(r => shape(tables, rel.table, r, node.children as SelectNode[], []))
      .filter((r): r is Row => r !== null);
    if (rel.many) {
      if (node.inner && shaped.length === 0) return null;
      out[node.alias] = shaped;
    } else {
      const first = shaped[0] ?? null;
      if (node.inner && first === null) return null;
      out[node.alias] = first;
    }
  }
  return out;
}

export function runRead(tables: Tables, table: string, params: URLSearchParams): ReadResult {
  const source = tables[table];
  if (!source) throw new PgError(404, "42P01", `relation "public.${table}" does not exist`);
  const nodes = parseSelect(params.get("select"));
  const filters = parseFilters(params);
  const own = filters.filter(isOwn);
  const embedded = filters.filter((f): f is Cond => f.kind === "cond" && f.path.length > 1);

  let rows = source.filter(r => own.every(f => testNode(r, f)));
  rows = sortRows(rows, parseOrder(params.get("order")));

  const shaped: Row[] = [];
  for (const r of rows) {
    const s = shape(tables, table, r, nodes, embedded);
    if (s !== null) shaped.push(s);
  }
  const total = shaped.length;
  const offset = Number(params.get("offset") || 0) || 0;
  const limitParam = params.get("limit");
  const limit = limitParam === null ? Infinity : Number(limitParam);
  const page = shaped.slice(offset, Number.isFinite(limit) ? offset + limit : undefined);
  return { rows: clone(page), total };
}

// Applies a `select=` list to rows that were just written, so an insert or
// update that asks for the row back gets the same shape a read would.
export function shapeRows(tables: Tables, table: string, rows: Row[], select: string | null): Row[] {
  const nodes = parseSelect(select);
  const out: Row[] = [];
  for (const r of rows) {
    const s = shape(tables, table, r, nodes, []);
    if (s !== null) out.push(s);
  }
  return clone(out);
}

// Rows of one table matching the plain (own-column) filters - used by writes.
export function matchRows(tables: Tables, table: string, params: URLSearchParams): Row[] {
  const source = tables[table];
  if (!source) throw new PgError(404, "42P01", `relation "public.${table}" does not exist`);
  const filters = parseFilters(params);
  if (!filters.every(isOwn)) throw new PgError(400, "PGRST100", "Embedded filters are not supported on writes");
  return source.filter(r => filters.every(f => testNode(r, f)));
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

// Columns that must be unique together, as the real tables enforce them.
const UNIQUE: Record<string, string[]> = {
  favourites: ["user_id", "creator_id"],
  campaign_favourites: ["user_id", "campaign_id"],
  blocks: ["blocker_id", "blocked_id"],
  applications: ["campaign_id", "creator_id"],
  message_reactions: ["message_id", "user_id"],
};

function defaultsFor(table: string, now: string): Row {
  const base: Row = { id: freshId(), created_at: now };
  switch (table) {
    case "notifications": return { ...base, read: false, data: null };
    case "applications": return { ...base, status: "pending", revision_count: 0 };
    case "campaigns": return { ...base, is_draft: false, updated_at: now };
    case "conversations": return { ...base, last_message: "", last_message_at: now };
    case "messages": return { ...base, read_at: null };
    case "reports": return { ...base, status: "open" };
    case "verification_requests": return { ...base, status: "pending", requested_at: now };
    case "disputes": return { ...base, status: "open", creator_response: null };
    case "profiles": return { ...base, account_status: "active", status_reason: null };
    case "message_reactions": return { ...base };
    default: return base;
  }
}

export class Db {
  tables: Tables;
  onMutate: () => void = () => {};
  private listeners: Array<(change: ChangeEvent) => void> = [];

  constructor(tables: Tables) {
    this.tables = tables;
  }

  // Lets the simulated "other people" react to what the visitor does.
  subscribe(listener: (change: ChangeEvent) => void) {
    this.listeners.push(listener);
  }

  private emit(change: ChangeEvent) {
    emitChange(change);
    this.onMutate();
    for (const l of this.listeners) {
      try {
        l(change);
      } catch (err) {
        console.error("demo listener failed:", err);
      }
    }
  }

  rows(table: string): Row[] {
    return (this.tables[table] ||= []);
  }

  insert(table: string, input: Row, now = new Date().toISOString()): Row {
    const rows = this.rows(table);
    const row: Row = { ...defaultsFor(table, now), ...clone(input) };
    const keys = UNIQUE[table];
    if (keys && rows.some(r => keys.every(k => r[k] === row[k]))) {
      throw new PgError(409, "23505", `duplicate key value violates unique constraint "${table}_${keys.join("_")}_key"`);
    }
    rows.push(row);
    this.emit({ table, eventType: "INSERT", new: clone(row), old: null });
    return row;
  }

  upsert(table: string, input: Row, onConflict: string[], ignoreDuplicates: boolean, now = new Date().toISOString()): Row {
    const rows = this.rows(table);
    const existing = onConflict.length ? rows.find(r => onConflict.every(k => r[k] === input[k])) : undefined;
    if (!existing) return this.insert(table, input, now);
    if (ignoreDuplicates) return existing;
    const old = clone(existing);
    Object.assign(existing, clone(input));
    this.emit({ table, eventType: "UPDATE", new: clone(existing), old });
    return existing;
  }

  update(table: string, targets: Row[], patch: Row): Row[] {
    const changed: Row[] = [];
    for (const row of targets) {
      const old = clone(row);
      Object.assign(row, clone(patch));
      if (table === "campaigns" && patch.updated_at === undefined) row.updated_at = new Date().toISOString();
      changed.push(row);
      this.emit({ table, eventType: "UPDATE", new: clone(row), old });
    }
    return changed;
  }

  remove(table: string, targets: Row[]): Row[] {
    const ids = new Set(targets);
    const rows = this.rows(table);
    const removed = rows.filter(r => ids.has(r));
    this.tables[table] = rows.filter(r => !ids.has(r));
    for (const r of removed) {
      this.emit({ table, eventType: "DELETE", new: null, old: clone(r) });
      // Children of a deleted row go with it, as the real foreign keys do.
      if (table === "campaigns") {
        const apps = this.rows("applications").filter(a => a.campaign_id === r.id);
        if (apps.length) this.remove("applications", apps);
      }
      if (table === "applications") {
        for (const child of ["campaign_posts", "disputes"]) {
          const kids = this.rows(child).filter(k => k.application_id === r.id);
          if (kids.length) this.remove(child, kids);
        }
      }
      if (table === "conversations") {
        const msgs = this.rows("messages").filter(m => m.conversation_id === r.id);
        if (msgs.length) this.remove("messages", msgs);
      }
      if (table === "messages") {
        const reacts = this.rows("message_reactions").filter(m => m.message_id === r.id);
        if (reacts.length) this.remove("message_reactions", reacts);
      }
    }
    return removed;
  }
}
