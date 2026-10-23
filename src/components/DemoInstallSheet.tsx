import { useEffect, useState } from "react";
import logo from "../assets/logo.png";
import ThemeScope from "./ThemeScope";
import { hasSeenInstallPrompt, markInstallPromptSeen } from "../lib/demo/session";
import { hasDeferredInstallPrompt, onInstallPromptAvailable, triggerInstallPrompt, isRunningAsApp } from "../lib/pwaInstall";

const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
// iPadOS 13+ reports itself as a Mac, so the only tell is the touch screen.
const isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && typeof navigator !== "undefined" && navigator.maxTouchPoints > 1);
const isAndroid = /Android/.test(ua);
const isIOSOtherBrowser = isIOS && /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);

const ShareIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <path d="M12 3v13M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

interface Step { title: string; body: string; icon?: boolean }

const IOS_STEPS: Step[] = [
  { title: "Tap the Share button", body: "It's the square with an arrow, in the bar at the bottom of Safari. On iPad it's at the top right.", icon: true },
  { title: "Tap Add to Home Screen", body: "Scroll down the menu until you see it." },
  { title: "Tap Add", body: "It's in the top right corner. FlipCollab gets its own icon." },
];
const ANDROID_STEPS: Step[] = [
  { title: "Open the browser menu", body: "Tap the three dots at the top right of your browser." },
  { title: "Tap Add to Home screen", body: "Some phones call it Install app." },
  { title: "Tap Add or Install", body: "FlipCollab gets its own icon." },
];

// Shown the moment the demo link opens (the picker and the direct
// /demo/creator and /demo/brand links alike), before anything else, and big
// enough to be the one thing on screen: FlipCollab is meant to run from the
// home screen, so this is the ask to put it there. Phones always get it; a
// desktop browser only when it is itself offering to install. Once dismissed
// it stays away for the rest of that tab.
export default function DemoInstallSheet() {
  const [canInstall, setCanInstall] = useState(hasDeferredInstallPrompt());
  const [dismissed, setDismissed] = useState(() => isRunningAsApp() || hasSeenInstallPrompt());
  const [installing, setInstalling] = useState(false);
  const [added, setAdded] = useState(false);

  useEffect(() => onInstallPromptAvailable(() => setCanInstall(true)), []);

  const eligible = isIOS || isAndroid || canInstall;
  if (dismissed || !eligible) return null;

  const close = () => {
    markInstallPromptSeen();
    setDismissed(true);
  };

  const install = async () => {
    setInstalling(true);
    const accepted = await triggerInstallPrompt();
    setInstalling(false);
    setCanInstall(hasDeferredInstallPrompt());
    if (accepted) setAdded(true);
  };

  // With the browser's own install dialog available the single big button is
  // the whole ask; without it (iPhone, some Android browsers) the steps are.
  const steps = isIOS ? IOS_STEPS : ANDROID_STEPS;
  const showSteps = !canInstall && !added;

  const primary: React.CSSProperties = {
    width: "100%", padding: "17px", borderRadius: "12px", background: "var(--c-fff)", color: "var(--t-0a0a0a)", fontSize: "15px",
    fontWeight: 700, textAlign: "center", cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.06em", border: "none",
    fontFamily: "inherit",
  };

  return (
    <ThemeScope zIndex={10000}>
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-install-title"
      style={{
        position: "fixed", inset: 0, zIndex: 10000, background: "var(--a-0-0-0-0_82)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        fontFamily: "'TikTok Sans', 'Helvetica Neue', sans-serif",
      }}
    >
      <div style={{
        width: "100%", maxWidth: "480px", maxHeight: "calc(92 * var(--vh))", overflowY: "auto", boxSizing: "border-box",
        background: "var(--c-0a0a0a)", border: "1px solid var(--c-1a1a1a)", borderBottom: "none", borderRadius: "20px 20px 0 0",
        padding: "1.75rem 1.5rem calc(1.5rem + env(safe-area-inset-bottom, 0px))",
        display: "flex", flexDirection: "column", gap: "1.25rem",
      }}>
        <img src={logo} className="theme-logo" alt="" style={{ width: "64px", height: "64px", objectFit: "contain", alignSelf: "flex-start" }} />

        {added ? (
          <>
            <div>
              <h2 id="demo-install-title" style={{ color: "var(--t-fff)", fontSize: "24px", fontWeight: 800, lineHeight: 1.2, margin: 0 }}>FlipCollab is on your home screen</h2>
              <p style={{ color: "var(--t-999)", fontSize: "15px", lineHeight: 1.55, margin: "10px 0 0" }}>Open it from the new icon whenever you're ready to start for real. You can keep looking around here for now.</p>
            </div>
            <button type="button" onClick={close} style={primary}>Keep looking around</button>
          </>
        ) : (
          <>
            <div>
              <h2 id="demo-install-title" style={{ color: "var(--t-fff)", fontSize: "24px", fontWeight: 800, lineHeight: 1.2, margin: 0 }}>Add FlipCollab to your home screen</h2>
              <p style={{ color: "var(--t-999)", fontSize: "15px", lineHeight: 1.55, margin: "10px 0 0" }}>It opens full screen like a normal app, with its own icon. It takes a few seconds.</p>
            </div>

            {isIOSOtherBrowser && (
              <p style={{ color: "var(--t-ccc)", fontSize: "14px", lineHeight: 1.5, margin: 0 }}>
                You're not in Safari. Open <strong style={{ color: "var(--t-fff)" }}>{window.location.host}</strong> in Safari first, then follow these steps.
              </p>
            )}

            {showSteps && (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {steps.map((step, i) => (
                  <div key={step.title} style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                    <span style={{ width: "28px", height: "28px", borderRadius: "50%", background: "var(--c-fff)", color: "var(--t-0a0a0a)", fontSize: "13px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                    <div>
                      <div style={{ color: "var(--t-fff)", fontSize: "16px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}>
                        {step.title}
                        {step.icon && <span style={{ color: "var(--t-ccc)", display: "inline-flex" }}><ShareIcon /></span>}
                      </div>
                      <div style={{ color: "var(--t-888)", fontSize: "13px", lineHeight: 1.5, marginTop: "2px" }}>{step.body}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {canInstall && (
              <button type="button" onClick={installing ? undefined : install} style={{ ...primary, opacity: installing ? 0.6 : 1 }}>
                {installing ? "Adding..." : "Add to Home Screen"}
              </button>
            )}

            <button
              type="button"
              onClick={close}
              style={{ background: "transparent", border: "none", color: "var(--t-999)", fontSize: "14px", padding: "6px", cursor: "pointer", fontFamily: "inherit", alignSelf: "center" }}
            >
              {showSteps ? "Continue in browser" : "Not now"}
            </button>
          </>
        )}
      </div>
    </div>
    </ThemeScope>
  );
}
