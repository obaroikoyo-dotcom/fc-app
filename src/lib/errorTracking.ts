import * as Sentry from "@sentry/react";
import { getLog } from "./debugLog";

// The project's public key from Sentry (Project Settings -> Client Keys ->
// DSN). It only lets this app SEND error reports to your project - it can't
// read anything back - so it is fine to keep in the code, like the Supabase
// anon key. While this is empty, error tracking is simply switched off.
const SENTRY_DSN = "";

// Only report from the real site, so local development, preview builds and
// test runs never add noise or use up the free monthly quota.
const onRealSite =
  typeof window !== "undefined" && /(^|\.)flipcollab\.com$/.test(window.location.hostname);
const enabled = !!SENTRY_DSN && onRealSite;

// Kept separate from init so the privacy behaviour below can be tested.
export function sentryOptions(dsn: string): Sentry.BrowserOptions {
  return {
    dsn,
    environment: "production",
    // No IP address, cookies or user details attached to reports.
    sendDefaultPii: false,
    // Errors only: no performance tracing, no session replay.
    tracesSampleRate: 0,
    ignoreErrors: [
      // Harmless browser notices, not real failures.
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications.",
      "Non-Error promise rejection captured",
    ],
    denyUrls: [
      // Errors that come from browser extensions or the push-notification
      // vendor's own script rather than from FlipCollab's code.
      /extensions\//i,
      /^chrome-extension:\/\//i,
      /^moz-extension:\/\//i,
      /cdn\.onesignal\.com/i,
    ],
    beforeBreadcrumb(breadcrumb) {
      // Console output is the app's own chatter and can contain user data.
      if (breadcrumb.category === "console") return null;
      // Data requests carry ids and filters in the query string; keep the
      // path (which table/function) and drop the rest.
      if ((breadcrumb.category === "fetch" || breadcrumb.category === "xhr") && typeof breadcrumb.data?.url === "string") {
        breadcrumb.data.url = breadcrumb.data.url.split("?")[0];
      }
      return breadcrumb;
    },
    beforeSend(event) {
      // The app's own on-device debug log: what happened right before the
      // error. It only holds flags, route names, timings and a short id
      // prefix - never emails, names or message text.
      event.extra = { ...event.extra, debugLogTail: getLog().slice(-40) };
      return event;
    },
  };
}

export function initErrorTracking() {
  if (!enabled) return;
  Sentry.init(sentryOptions(SENTRY_DSN));
}

// React 19 reports errors that nothing caught through these hooks. Only set
// when tracking is on, so with it off React keeps its normal behaviour
// (errors show up in the console as before).
export const reactRootErrorHandlers = enabled
  ? {
      onUncaughtError: Sentry.reactErrorHandler((error) => console.error(error)),
      onRecoverableError: Sentry.reactErrorHandler(),
    }
  : {};

// Wraps the app so a crash shows a "Reload" screen instead of a blank one.
// Works with tracking off too - it only reports when tracking is on.
export const AppErrorBoundary = Sentry.ErrorBoundary;
