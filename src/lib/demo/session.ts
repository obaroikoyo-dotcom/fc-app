import { makeRng, uuid } from "./random";
import { demoRoleFromPath, type DemoRole } from "./mode";

// One demo visit = one session: who the visitor is playing and the seed that
// generates their world. It lives in sessionStorage, so a reload (or the
// phone discarding the tab in the background) carries on as the same person,
// and closing the tab ends it. Nothing here is ever sent anywhere.

const SESSION_KEY = "fc_demo_session";
const SNAPSHOT_KEY = "fc_demo_db";
const NOTICE_KEY = "fc_demo_notice_seen";
const INSTALL_KEY = "fc_demo_install_seen";

export interface DemoSession {
  role: DemoRole;
  seed: number;
  userId: string;
  startedAt: number;
}

// Falls back to memory if the browser blocks sessionStorage, so the demo
// still works (it just can't survive a reload).
const memory = new Map<string, string>();

function read(key: string): string | null {
  try {
    const v = window.sessionStorage.getItem(key);
    if (v !== null) return v;
  } catch {
    // blocked - fall through to memory
  }
  return memory.get(key) ?? null;
}

function write(key: string, value: string) {
  memory.set(key, value);
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // blocked or full - memory copy above still holds
  }
}

function remove(key: string) {
  memory.delete(key);
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // nothing to do
  }
}

function parseSession(raw: string | null): DemoSession | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Partial<DemoSession>;
    if ((s.role === "creator" || s.role === "brand") && typeof s.seed === "number" && typeof s.userId === "string") {
      return { role: s.role, seed: s.seed, userId: s.userId, startedAt: s.startedAt ?? Date.now() };
    }
  } catch {
    // corrupt - treated as no session
  }
  return null;
}

export function startDemoSession(role: DemoRole): DemoSession {
  const seed = Math.floor(Math.random() * 0xffffffff);
  const session: DemoSession = {
    role,
    seed,
    userId: uuid(makeRng(seed ^ 0x9e3779b9)),
    startedAt: Date.now(),
  };
  write(SESSION_KEY, JSON.stringify(session));
  remove(SNAPSHOT_KEY);
  remove(NOTICE_KEY);
  cached = session;
  return session;
}

let cached: DemoSession | null | undefined;

// The session for this page load. A /demo/creator or /demo/brand address with
// no matching session starts a fresh one; plain /demo just reports whatever
// exists (usually nothing) so the picker can show.
export function getDemoSession(): DemoSession | null {
  if (cached !== undefined) return cached;
  const stored = parseSession(read(SESSION_KEY));
  const wanted = demoRoleFromPath();
  if (wanted && (!stored || stored.role !== wanted)) {
    return startDemoSession(wanted);
  }
  cached = stored;
  return stored;
}

export function endDemoSession() {
  remove(SESSION_KEY);
  remove(SNAPSHOT_KEY);
  remove(NOTICE_KEY);
  cached = null;
}

export function readSnapshot(): string | null {
  return read(SNAPSHOT_KEY);
}

export function writeSnapshot(json: string) {
  write(SNAPSHOT_KEY, json);
}

export function hasSeenNotice(): boolean {
  return read(NOTICE_KEY) === "1";
}

export function markNoticeSeen() {
  write(NOTICE_KEY, "1");
}

export function hasSeenInstallPrompt(): boolean {
  return read(INSTALL_KEY) === "1";
}

export function markInstallPromptSeen() {
  write(INSTALL_KEY, "1");
}
