// beforeinstallprompt can fire before React ever mounts, so it's captured
// here at module load (imported as early as possible from main.tsx) instead
// of inside a component that might not exist yet when it fires.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => void;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let listeners: Array<() => void> = [];

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    listeners.forEach(fn => fn());
  });
}

export function hasDeferredInstallPrompt() {
  return !!deferredPrompt;
}

export function onInstallPromptAvailable(cb: () => void) {
  listeners.push(cb);
  return () => { listeners = listeners.filter(fn => fn !== cb); };
}

export async function triggerInstallPrompt(): Promise<boolean> {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  return choice.outcome === "accepted";
}
