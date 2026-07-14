const KEY = "fc_onboarding_draft";

// A Google sign-in is a full-page redirect away to accounts.google.com and
// back, which tears down all in-memory React state. To resume the wizard
// on the same screen with the same answers afterward, the in-progress
// fields are snapshotted here right before the redirect fires.
export function saveOnboardingDraft(role: "brand" | "creator", data: Record<string, unknown>) {
  localStorage.setItem(KEY, JSON.stringify({ role, data }));
}

// Consumes (reads + clears) the draft. Called once, by the onboarding page
// itself, when it detects it's resuming a Google sign-in.
export function takeOnboardingDraft(role: "brand" | "creator"): Record<string, unknown> | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  localStorage.removeItem(KEY);
  try {
    const parsed = JSON.parse(raw);
    return parsed.role === role ? parsed.data : null;
  } catch {
    return null;
  }
}

// Non-destructive read used by the app's top-level auth routing to decide
// whether a freshly-authenticated OAuth user with no profile yet should
// land back on the onboarding wizard instead of role selection.
export function peekOnboardingDraftRole(): "brand" | "creator" | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed.role === "brand" || parsed.role === "creator" ? parsed.role : null;
  } catch {
    return null;
  }
}
