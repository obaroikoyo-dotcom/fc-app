import { useState, useEffect } from "react";
import logo from "../assets/logo.png";
import { hasDeferredInstallPrompt, onInstallPromptAvailable, triggerInstallPrompt } from "../lib/pwaInstall";

const isIOS = typeof navigator !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent);
const isAndroid = typeof navigator !== "undefined" && /Android/.test(navigator.userAgent);
const isMobile = isIOS || isAndroid;

const ShareIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <path d="M12 3v13M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function LandingPage({ onLaunch }: { onLaunch: () => void }) {
  const [canInstall, setCanInstall] = useState(hasDeferredInstallPrompt());
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    document.title = "FlipCollab";
    return onInstallPromptAvailable(() => setCanInstall(true));
  }, []);

  const handleInstall = async () => {
    setInstalling(true);
    const accepted = await triggerInstallPrompt();
    setInstalling(false);
    if (accepted) onLaunch();
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem 1.5rem" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');`}</style>

      <div style={{ width: "100%", maxWidth: "420px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <img src={logo} alt="FlipCollab" style={{ width: "88px", marginBottom: "1.5rem" }} />
        <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "30px", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", marginBottom: "10px" }}>FlipCollab</p>
        <p style={{ fontSize: "14px", color: "#999", lineHeight: 1.7, marginBottom: "2.5rem", maxWidth: "320px" }}>
          The creator collaboration marketplace. Brands post campaigns, creators apply, and payment is held securely until the work is delivered.
        </p>

        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "10px" }}>
          {isIOS ? (
            <>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "14px 16px", textAlign: "left" }}>
                <span style={{ color: "#999", marginTop: "1px" }}><ShareIcon /></span>
                <p style={{ fontSize: "12px", color: "#aaa", lineHeight: 1.6 }}>
                  Tap the <strong style={{ color: "#fff", fontWeight: 600 }}>Share</strong> icon in Safari, then <strong style={{ color: "#fff", fontWeight: 600 }}>Add to Home Screen</strong> - opens like an app, full screen, no browser bar.
                </p>
              </div>
              <div onClick={onLaunch} style={{ padding: "13px", borderRadius: "8px", border: "1px solid #333", color: "#ccc", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: "pointer", letterSpacing: "0.04em" }}>
                Continue in Browser
              </div>
            </>
          ) : isAndroid && canInstall ? (
            <>
              <div onClick={!installing ? handleInstall : undefined} style={{ padding: "14px", borderRadius: "8px", background: installing ? "#1a1a1a" : "#fff", color: installing ? "#555" : "#0a0a0a", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: installing ? "default" : "pointer", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                {installing ? "Adding..." : "Add to Home Screen"}
              </div>
              <div onClick={onLaunch} style={{ padding: "13px", borderRadius: "8px", border: "1px solid #333", color: "#ccc", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: "pointer", letterSpacing: "0.04em" }}>
                Continue in Browser
              </div>
            </>
          ) : (
            <div onClick={onLaunch} style={{ padding: "14px", borderRadius: "8px", background: "#fff", color: "#0a0a0a", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: "pointer", letterSpacing: "0.05em", textTransform: "uppercase" }}>
              {isMobile ? "Continue in Browser" : "Launch FlipCollab"}
            </div>
          )}
        </div>
      </div>

      <p style={{ position: "fixed", bottom: "1.5rem", fontSize: "11px", color: "#555" }}>
        <a href="https://about.flipcollab.com" style={{ color: "#555", textDecoration: "none" }}>About</a>
        {" · "}
        <a href="https://privacy.flipcollab.com" style={{ color: "#555", textDecoration: "none" }}>Privacy</a>
        {" · "}
        <a href="https://terms.flipcollab.com" style={{ color: "#555", textDecoration: "none" }}>Terms</a>
      </p>
    </div>
  );
}
