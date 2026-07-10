const KEY = "fc-debug-log";
const MAX_ENTRIES = 300;

// A visible, on-device record of what actually happened right before a
// freeze - the only way to debug this on a PWA where the console isn't
// reachable. Writes to localStorage synchronously so entries land even if
// the page hangs and never repaints right after. Read it from Settings ->
// Debug Log, which stays reachable even when other pages are stuck.
export function logEvent(msg: string) {
  try {
    const entries: string[] = JSON.parse(localStorage.getItem(KEY) || "[]");
    const ts = new Date().toISOString().slice(11, 23);
    entries.push(`${ts} ${msg}`);
    while (entries.length > MAX_ENTRIES) entries.shift();
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // storage full or unavailable - nothing we can do, don't crash the app over it
  }
}

export function getLog(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function clearLog() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
