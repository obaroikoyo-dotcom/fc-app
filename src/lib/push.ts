import { supabase } from "./supabase";

const VAPID_PUBLIC_KEY = "BEpl600jnije6MO8JWVd_ECj9GL1UOUAZ2w64hBbojXeVDdZxUI1VRJkD-9OLPMXE0E3k1Yi5CQ2Hn3TpisjEaw";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function isPushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window;
}

export async function subscribeToPush(userId: string) {
  if (!isPushSupported()) throw new Error("Push notifications aren't supported on this browser.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission denied.");

  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  const raw = subscription.toJSON();
  await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: raw.endpoint!,
      p256dh: raw.keys!.p256dh,
      auth: raw.keys!.auth,
    },
    { onConflict: "endpoint" }
  );
}

export async function unsubscribeFromPush(userId: string) {
  if (!isPushSupported()) return;

  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  const subscription = await registration?.pushManager.getSubscription();

  if (subscription) {
    await supabase.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
    await subscription.unsubscribe();
  } else {
    // No live subscription in this browser session - clear any rows for this user as a fallback.
    await supabase.from("push_subscriptions").delete().eq("user_id", userId);
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
  const { error } = await supabase.from("notifications").insert(payload);
  if (error) console.error("Failed to insert notification:", error);

  try {
    await supabase.functions.invoke("send-push", { body: payload });
  } catch (err) {
    console.error("Failed to send push notification:", err);
  }
}
