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
  if (!granted) throw new Error("Notification permission denied.");
  optInOneSignalPush();
}

export async function unsubscribeFromPush(_userId: string) {
  if (!isPushSupported()) return;
  optOutOneSignalPush();
}

interface NotifyPayload {
  user_id: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export async function notifyAndPush(payload: NotifyPayload) {
  const { error } = await supabase.from("notifications").insert(payload);
  if (error) console.error("Failed to insert notification:", error);

  try {
    await supabase.functions.invoke("send-push", { body: payload });
  } catch (err) {
    console.error("Failed to send push notification:", err);
  }
}
