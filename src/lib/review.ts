// The brand's review window, Vinted-style: once a deliverable has arrived the
// brand has this long to say they're happy, ask for another video, or report a
// problem. If they do nothing, the payment is released to the creator
// automatically. The scheduled job (auto-release-payments) and the dispute
// window (raise-dispute) enforce the same number on the server - if you change
// it, change it in all three places and in the Terms and Help text.
export const REVIEW_WINDOW_DAYS = 5;
export const REVIEW_WINDOW_MS = REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000;

// When the review window closes, as a timestamp - or null if nothing has been
// delivered yet (the clock starts at delivery, or at payment if the creator
// uploaded first; the database keeps deliverable_uploaded_at in step with that).
export function reviewEndsAt(deliveredAtIso: string | null | undefined): number | null {
  if (!deliveredAtIso) return null;
  const t = new Date(deliveredAtIso).getTime();
  return Number.isFinite(t) ? t + REVIEW_WINDOW_MS : null;
}

// "4 days 3 hours", "5 hours", "less than an hour" - for "You have ___ left".
export function formatTimeLeft(msLeft: number): string {
  const mins = Math.max(0, Math.floor(msLeft / 60000));
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  if (days >= 1) {
    return `${days} day${days === 1 ? "" : "s"}${hours ? ` ${hours} hour${hours === 1 ? "" : "s"}` : ""}`;
  }
  if (hours >= 1) return `${hours} hour${hours === 1 ? "" : "s"}`;
  return "less than an hour";
}

// "Tue 14 Oct, 15:48"
export function formatReviewEnd(ms: number): string {
  const d = new Date(ms);
  return `${d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}, ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}
