// supabase.functions.invoke() hides what a function actually said behind a
// generic "non-2xx" error; the real message is in the response body. This reads
// it, and returns it only when it is something a person can act on: Stripe's own
// wording (a declined card, an expired card) or one of our plain messages.
// Anything else comes back null so the caller keeps its generic text, and the
// detail goes to the console for whoever is debugging.

const STRIPE_PREFIX = /^(Stripe (?:customer|subscription) error|Payment method error|Attach error):\s*/;
const PLAIN_MESSAGES = new Set([
  "You already have an active Enterprise subscription.",
  "This card can't be used for this account.",
  "Choose a valid plan.",
  "Too many requests. Please try again shortly.",
]);

export async function functionErrorMessage(error: unknown): Promise<string | null> {
  try {
    const response = (error as { context?: Response } | null)?.context;
    if (!response || typeof response.clone !== "function") return null;
    const body = await response.clone().json().catch(() => null);
    const raw = typeof body?.error === "string" ? body.error.replace(/^Error:\s*/, "") : "";
    if (!raw) return null;
    console.error("Function error:", response.status, raw);
    if (PLAIN_MESSAGES.has(raw)) return raw;
    if (STRIPE_PREFIX.test(raw)) return raw.replace(STRIPE_PREFIX, "");
    return null;
  } catch {
    return null;
  }
}
