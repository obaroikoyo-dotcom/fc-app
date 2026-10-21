// The rows above a campaign feed (Closing soon, Top paying, New today), shared by
// Explore (creators) and the brand's Market tab so the two work the same way.

export const DAY_MS = 86_400_000;

export type ShelfKey = "closing" | "top" | "fresh";
export const SHELF_TITLES: Record<ShelfKey, string> = { closing: "Closing soon", top: "Top paying", fresh: "New today" };

interface Dated {
  type: string;
  deadline: string;
  created_at: string;
}

// Whole calendar days from today to a "YYYY-MM-DD" deadline: 0 is today, negative is past.
export function daysLeft(deadline: string, now: Date): number | null {
  const [y, m, d] = (deadline || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  const due = new Date(y, m - 1, d).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((due - today) / DAY_MS);
}

export function dueNote(days: number): string {
  return days === 0 ? "Due today" : days === 1 ? "Due tomorrow" : `Due in ${days} days`;
}

export function createdAtMs(c: { created_at: string }): number {
  return c.created_at ? new Date(c.created_at.endsWith("Z") ? c.created_at : c.created_at + "Z").getTime() : 0;
}

// The one tag on a campaign's colour band: a close deadline outranks being new.
export function bandTag(c: { deadline: string; created_at: string }, now: Date): "Closing soon" | "New" | undefined {
  const d = daysLeft(c.deadline, now);
  if (d !== null && d >= 0 && d <= 3) return "Closing soon";
  return now.getTime() - createdAtMs(c) < DAY_MS ? "New" : undefined;
}

export function emptyShelves<T>(): Record<ShelfKey, T[]> {
  return { closing: [], top: [], fresh: [] };
}

// What goes in each row. `amountOf` is the money to rank by: what the creator
// takes home on Explore, the budget on the brand's Market tab. Campaigns whose
// deadline has passed are left out of every row.
export function buildShelves<T extends Dated>(list: T[], now: Date, amountOf: (c: T) => number): Record<ShelfKey, T[]> {
  const stillOpen = (c: T) => { const d = daysLeft(c.deadline, now); return d === null || d >= 0; };
  return {
    closing: list
      .filter(c => { const d = daysLeft(c.deadline, now); return d !== null && d >= 0 && d <= 7; })
      .sort((a, b) => (daysLeft(a.deadline, now) ?? 0) - (daysLeft(b.deadline, now) ?? 0)),
    top: list.filter(c => c.type === "paid" && amountOf(c) > 0 && stillOpen(c)).sort((a, b) => amountOf(b) - amountOf(a)),
    fresh: list.filter(c => stillOpen(c) && now.getTime() - createdAtMs(c) < DAY_MS).sort((a, b) => createdAtMs(b) - createdAtMs(a)),
  };
}

// A row needs something in it, and Top paying needs at least two to be a ranking.
export function shelfIsShown(key: ShelfKey, list: unknown[]): boolean {
  return key === "top" ? list.length >= 2 : list.length > 0;
}
