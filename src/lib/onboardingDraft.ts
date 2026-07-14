const KEY = "fc_onboarding_draft";

// A Google sign-in is a full-page redirect away to accounts.google.com and
// back, which tears down all in-memory React state. To resume the wizard
// on the same screen with the same answers afterward, the in-progress
// fields are snapshotted here right before the redirect fires.
export function saveOnboardingDraft(role: "brand" | "creator", data: Record<string, unknown>) {
  localStorage.setItem(KEY, JSON.stringify({ role, data }));
}

// Non-destructive read, used by the onboarding page to restore its fields.
// Deliberately NOT cleared here: the app's auth routing (App.tsx) re-checks
// this on every auth state change, and Supabase fires more than one of
// those in quick succession after an OAuth redirect (its own listener,
// plus this app's separately-delayed initial auth check). If the draft
// were wiped as soon as the wizard first read it, that second, later
// check would find nothing and incorrectly bounce back to role-select.
export function peekOnboardingDraft(role: "brand" | "creator"): Record<string, unknown> | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed.role === role ? parsed.data : null;
  } catch {
    return null;
  }
}

// Called once the account is actually finished (handleFinish succeeds) -
// only then is it safe to stop treating this as a resumable draft.
export function clearOnboardingDraft() {
  localStorage.removeItem(KEY);
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
