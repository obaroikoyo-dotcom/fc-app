/* eslint-disable @typescript-eslint/no-explicit-any */
// Stand-in for Supabase Realtime. The real client opens a websocket to the
// real project; in demo mode nothing may do that, so channels here are just
// local objects and the in-memory database calls emitChange() whenever a row
// changes - which is what makes chat messages and notifications arrive live.

type Handler = (payload: any) => void;

interface Binding {
  type: string;
  filter: any;
  cb: Handler;
}

export interface ChangeEvent {
  table: string;
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, any> | null;
  old: Record<string, any> | null;
}

const live = new Set<DemoChannel>();

// "conversation_id=eq.123" -> { col, value }. Only equality is ever used.
function parseRowFilter(filter: unknown): { col: string; value: string } | null {
  if (typeof filter !== "string") return null;
  const m = /^([a-z_]+)=eq\.(.*)$/i.exec(filter);
  return m ? { col: m[1], value: m[2] } : null;
}

export class DemoChannel {
  readonly topic: string;
  private bindings: Binding[] = [];

  constructor(topic: string) {
    this.topic = topic;
  }

  on(type: string, filter: any, cb: Handler): this {
    this.bindings.push({ type, filter, cb });
    return this;
  }

  subscribe(statusCb?: (status: string) => void): this {
    live.add(this);
    if (statusCb) setTimeout(() => statusCb("SUBSCRIBED"), 0);
    return this;
  }

  unsubscribe(): Promise<string> {
    live.delete(this);
    return Promise.resolve("ok");
  }

  // Broadcasts (typing indicators) go nowhere: the only other "person" in the
  // demo is simulated, and it fires its own typing event (see emitBroadcast).
  send(): Promise<string> {
    return Promise.resolve("ok");
  }

  deliver(change: ChangeEvent) {
    for (const b of this.bindings) {
      if (b.type !== "postgres_changes") continue;
      const f = b.filter || {};
      if (f.table && f.table !== "*" && f.table !== change.table) continue;
      if (f.event && f.event !== "*" && f.event !== change.eventType) continue;
      const rowFilter = parseRowFilter(f.filter);
      if (rowFilter) {
        const row = change.new ?? change.old;
        if (!row || String(row[rowFilter.col]) !== rowFilter.value) continue;
      }
      const payload = {
        schema: "public",
        table: change.table,
        commit_timestamp: new Date().toISOString(),
        eventType: change.eventType,
        new: change.new ?? {},
        old: change.old ?? {},
        errors: null,
      };
      try {
        b.cb(payload);
      } catch (err) {
        console.error("demo realtime handler failed:", err);
      }
    }
  }

  deliverBroadcast(event: string, payload: unknown) {
    for (const b of this.bindings) {
      if (b.type !== "broadcast") continue;
      if (b.filter?.event && b.filter.event !== event) continue;
      try {
        b.cb({ type: "broadcast", event, payload });
      } catch (err) {
        console.error("demo broadcast handler failed:", err);
      }
    }
  }
}

export function emitChange(change: ChangeEvent) {
  // A tick of delay, like a real round trip, so a sender's own insert response
  // lands before its realtime echo (the app de-duplicates by id either way).
  setTimeout(() => {
    for (const ch of Array.from(live)) ch.deliver(change);
  }, 40);
}

// Only channels whose topic starts with `topicPrefix` hear it, so a typing
// indicator for one chat never shows up in another.
export function emitBroadcast(topicPrefix: string, event: string, payload: unknown) {
  for (const ch of Array.from(live)) {
    if (ch.topic.startsWith(topicPrefix)) ch.deliverBroadcast(event, payload);
  }
}

export function removeAllChannels() {
  live.clear();
}
