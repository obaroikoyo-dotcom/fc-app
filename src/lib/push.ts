import { supabase } from "./supabase";
import { oneSignalLogin, requestOneSignalPermission, optOutOneSignalPush, optInOneSignalPush, isOneSignalOptedIn } from "./onesignal";

export { isOneSignalOptedIn as isPushEnabled };

export function isPushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window;
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
}

export async function subscribeToPush(userId: string) {
  if (isIOS() && !isStandalone()) {
    throw new Error("On iPhone/iPad, add FlipCollab to your Home Screen first (Share button → Add to Home Screen), then open it from there to enable notifications.");
  }

  if (!isPushSupported()) throw new Error("Push notifications aren't supported on this browser.");

  // Links this browser's OneSignal subscriber record to the Supabase user id
  // so send-push can target them by external_id, then prompts for permission
  // (a no-op if already granted from a previous opt-out/opt-in cycle) and
  // explicitly opts back in, since opting out again wouldn't otherwise be
  // undone by requesting permission alone.
  oneSignalLogin(userId);
  const granted = await requestOneSignalPermission();
  if (!granted) {
    // Once a browser has blocked a site's notifications, no page can
    // re-prompt it via code - the user has to flip it back on themselves
    // in the browser's own site settings, so tell them that directly.
    throw new Error("Notifications are blocked for this site in your browser. Turn them on in your browser's site settings, then try again.");
  }
  optInOneSignalPush();
}

export async function unsubscribeFromPush(_userId: string) {
  if (!isPushSupported()) return;
  optOutOneSignalPush();
}

// Silent, best-effort version of subscribeToPush for auto-prompting shortly
// after a user lands in the app, rather than waiting for them to find the
// Settings toggle. Swallows every failure (declined, blocked, unsupported
// browser, iOS not installed to home screen) since there's no dedicated UI
// showing the result of an automatic attempt - it either results in the
// native OS permission dialog appearing, or silently does nothing.
export async function autoRequestPush(userId: string) {
  try {
    const already = await isOneSignalOptedIn();
    if (already) return;
    await subscribeToPush(userId);
  } catch {
    // Expected in plenty of cases (declined, blocked, unsupported) - no
    // user-facing error surface for a background attempt like this one.
  }
}

interface NotifyPayload {
  user_id: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export async function notifyAndPush(payload: NotifyPayload) {
  const { error } = await supabase.rpc("notify_user", {
    target_user_id: payload.user_id,
    notif_type: payload.type,
    notif_title: payload.title,
    notif_body: payload.body,
    notif_data: payload.data ?? {},
  });
  if (error) console.error("Failed to insert notification:", error);

  try {
    await supabase.functions.invoke("send-push", { body: payload });
  } catch (err) {
    console.error("Failed to send push notification:", err);
  }
}
