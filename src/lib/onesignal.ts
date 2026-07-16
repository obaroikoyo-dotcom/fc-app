// Thin wrapper around the OneSignal Web SDK, loaded via a <script defer> tag
// in index.html. The SDK isn't guaranteed to have finished loading by the
// time app code runs, so every call goes through window.OneSignalDeferred -
// the queue OneSignal itself drains once it's ready.
const ONESIGNAL_APP_ID = "66adae38-64f2-425f-b984-83e65f99ce1f";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OneSignalSDK = any;

declare global {
  interface Window {
    OneSignalDeferred?: Array<(OneSignal: OneSignalSDK) => void | Promise<void>>;
  }
}

function withOneSignal(fn: (OneSignal: OneSignalSDK) => void | Promise<void>) {
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(fn);
}

export function initOneSignal() {
  withOneSignal(async (OneSignal) => {
    await OneSignal.init({ appId: ONESIGNAL_APP_ID });
  });
}

// Links this browser's push subscription to the signed-in user, so the
// send-push edge function can target them by Supabase user id.
export function oneSignalLogin(userId: string) {
  withOneSignal(async (OneSignal) => {
    await OneSignal.login(userId);
  });
}

export function oneSignalLogout() {
  withOneSignal(async (OneSignal) => {
    await OneSignal.logout();
  });
}

export function requestOneSignalPermission(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    withOneSignal(async (OneSignal) => {
      try {
        await OneSignal.Notifications.requestPermission();
        // Read the browser's own permission state rather than an SDK
        // property, since that's unambiguous regardless of SDK version.
        resolve(Notification.permission === "granted");
      } catch (err) {
        reject(err);
      }
    });
  });
}

export function optOutOneSignalPush() {
  withOneSignal(async (OneSignal) => {
    await OneSignal.User.PushSubscription.optOut();
  });
}

export function optInOneSignalPush() {
  withOneSignal(async (OneSignal) => {
    await OneSignal.User.PushSubscription.optIn();
  });
}

// Browser Notification permission only ever moves from "default" toward
// "granted"/"denied" and can't be revoked in code - opting out via OneSignal
// doesn't touch it. So the Settings toggle needs OneSignal's own opted-in
// flag, not Notification.permission, or it looks "on" again after opting
// out and revisiting the page.
export function isOneSignalOptedIn(): Promise<boolean> {
  return new Promise((resolve) => {
    withOneSignal((OneSignal) => {
      resolve(!!OneSignal.User.PushSubscription.optedIn);
    });
  });
}
