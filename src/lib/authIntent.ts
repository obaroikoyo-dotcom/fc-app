const KEY = "fc_google_login_intent";

// Supabase's signInWithIdToken silently creates a brand new account when no
// user exists yet for that Google identity - fine for the onboarding pages
// (that's a signup), but the Login page means the user is trying to sign
// IN to an existing account. Set right before that attempt so the app's
// top-level auth routing (App.tsx) can tell the two cases apart when it
// sees the same "no profile row yet" state, and defer to Login's own
// "no account found" handling instead of racing ahead into onboarding.
export function markGoogleLoginIntent() {
  sessionStorage.setItem(KEY, "1");
}

// Non-destructive - App.tsx's routing checks this on the SIGNED_IN event,
// then again on the SIGNED_OUT event that follows Login's own cleanup, so
// it can't be cleared after the first read.
export function peekGoogleLoginIntent(): boolean {
  return sessionStorage.getItem(KEY) === "1";
}

export function clearGoogleLoginIntent() {
  sessionStorage.removeItem(KEY);
}

const APPLE_KEY = "fc_apple_login_intent";

// Same purpose as the Google flag above, kept as a separate key so the two
// providers can't clobber each other if both somehow fire in one session.
export function markAppleLoginIntent() {
  sessionStorage.setItem(APPLE_KEY, "1");
}

export function peekAppleLoginIntent(): boolean {
  return sessionStorage.getItem(APPLE_KEY) === "1";
}

export function clearAppleLoginIntent() {
  sessionStorage.removeItem(APPLE_KEY);
}
