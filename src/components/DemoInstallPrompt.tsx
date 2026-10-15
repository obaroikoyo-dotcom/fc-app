import { useEffect, useState } from "react";
import { hasSeenNotice, hasSeenInstallPrompt, markInstallPromptSeen } from "../lib/demo/session";
import { hasDeferredInstallPrompt, onInstallPromptAvailable, triggerInstallPrompt, isRunningAsApp } from "../lib/pwaInstall";

// How long after the demo notice is dismissed before this appears, so the two
// never stack and the visitor has had a moment to look around first.
const DELAY_MS = 8000;

const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
// iPadOS 13+ reports itself as a Mac, so the only tell is the touch screen.
const isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && typeof navigator !== "undefined" && navigator.maxTouchPoints > 1);
const isAndroid = /Android/.test(ua);
const isIOSOtherBrowser = isIOS && /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);

const IOS_STEPS = [
  "Tap the Share button, the square with an arrow, in Safari's bar.",
  "Scroll down and tap Add to Home Screen.",
  "Tap Add in the top right corner.",
];
const ANDROID_STEPS = [
  "Open the browser menu, the three dots at the top right.",
  "Tap Add to Home screen, or Install app.",
  "Tap Add or Install to confirm.",
];

// Offers to put FlipCollab on the home screen, once per demo visit. The
// installed app opens the real FlipCollab (not the demo), so this is the step
// from "looking around" to "using it". Only phones, or any browser that is
// itself offering to install, and never when it is already running as an app.
export default function DemoInstallPrompt() {
  const [open, setOpen] = useState(false);
  const [canInstall, setCanInstall] = useState(hasDeferredInstallPrompt());
  const [showSteps, setShowSteps] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [added, setAdded] = useState(false);

  useEffect(() => onInstallPromptAvailable(() => setCanInstall(true)), []);

  useEffect(() => {
    if (isRunningAsApp() || hasSeenInstallPrompt()) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      timer = setTimeout(() => {
        // Checked at the moment it would show: the browser's own install offer
        // can arrive late, and a desktop browser without one has nothing to add.
        if (isRunningAsApp() || hasSeenInstallPrompt()) return;
        if (isIOS || isAndroid || hasDeferredInstallPrompt()) setOpen(true);
      }, DELAY_MS);
    };
    if (hasSeenNotice()) arm();
    else window.addEventListener("fc-demo-notice-closed", arm, { once: true });
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("fc-demo-notice-closed", arm);
    };
  }, []);

  if (!open) return null;

  const close = () => {
    markInstallPromptSeen();
    setOpen(false);
  };

  const install = async () => {
    setInstalling(true);
    const accepted = await triggerInstallPrompt();
    setInstalling(false);
    setCanInstall(hasDeferredInstallPrompt());
    if (accepted) setAdded(true);
    else setShowSteps(true);
  };

  const steps = isIOS ? IOS_STEPS : ANDROID_STEPS;
  const button: React.CSSProperties = {
    flex: 1, padding: "10px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, textAlign: "center",
    cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.05em",
  };

  return (
    <div style={{
      position: "fixed", left: "1rem", right: "1rem", bottom: "5.5rem", zIndex: 9998,
      background: "#111", border: "1px solid #1a1a1a", borderRadius: "12px", padding: "1rem",
      display: "flex", flexDirection: "column", gap: "0.75rem",
      fontFamily: "'TikTok Sans', 'Helvetica Neue', sans-serif", boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
    }}>
      {added ? (
        <>
          <div>
            <div style={{ color: "#fff", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>FlipCollab is on your home screen</div>
            <div style={{ color: "#999", fontSize: "12px", lineHeight: 1.5 }}>Open it from the new icon whenever you're ready to start for real.</div>
          </div>
          <div style={{ display: "flex" }}>
            <div onClick={close} style={{ ...button, background: "#fff", color: "#0a0a0a" }}>Done</div>
          </div>
        </>
      ) : (
        <>
          <div>
            <div style={{ color: "#fff", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>Add FlipCollab to your home screen</div>
            <div style={{ color: "#999", fontSize: "12px", lineHeight: 1.5 }}>
              It opens full screen like a normal app, ready for when you create a real account.
            </div>
          </div>

          {showSteps && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {isIOSOtherBrowser && (
                <div style={{ color: "#ccc", fontSize: "12px", lineHeight: 1.5 }}>
                  You're not in Safari. Open {window.location.host} in Safari first, then follow these steps.
                </div>
              )}
              {steps.map((text, i) => (
                <div key={text} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                  <span style={{ width: "18px", height: "18px", borderRadius: "50%", border: "1px solid #333", color: "#999", fontSize: "10px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "1px" }}>{i + 1}</span>
                  <span style={{ color: "#bbb", fontSize: "12px", lineHeight: 1.5 }}>{text}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <div onClick={close} style={{ ...button, background: "#1a1a1a", color: "#999" }}>Not now</div>
            {canInstall ? (
              <div onClick={installing ? undefined : install} style={{ ...button, background: "#fff", color: "#0a0a0a", opacity: installing ? 0.6 : 1 }}>
                {installing ? "Adding..." : "Add"}
              </div>
            ) : !showSteps ? (
              <div onClick={() => setShowSteps(true)} style={{ ...button, background: "#fff", color: "#0a0a0a" }}>Show me how</div>
            ) : (
              <div onClick={close} style={{ ...button, background: "#fff", color: "#0a0a0a" }}>Got it</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
