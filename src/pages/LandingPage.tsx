import { useState, useEffect, useRef } from "react";
import logo from "../assets/logo.png";
import heroPhoto from "../assets/landing/phone-goldenhour.jpg";
import { hasDeferredInstallPrompt, onInstallPromptAvailable, triggerInstallPrompt } from "../lib/pwaInstall";

const isIOS = typeof navigator !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent);
const isAndroid = typeof navigator !== "undefined" && /Android/.test(navigator.userAgent);
const isMobile = isIOS || isAndroid;

const ShareIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <path d="M12 3v13M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const HeartIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#fff" style={{ flexShrink: 0, opacity: 0.9 }}>
    <path d="M12 20.5s-7.5-4.6-9.8-9.1C.7 7.4 2.4 4 6 4c2.1 0 3.6 1.2 4.4 2.4C11.2 5.2 12.7 4 14.8 4c3.6 0 5.3 3.4 3.8 6.9C19.5 15.9 12 20.5 12 20.5Z" />
  </svg>
);

// Likes sit right at her hand/phone in the crop below (roughly x 58-72%,
// y 60-85% of the frame) - small and plain, not glowing clipart hearts.
const FLOATS = [
  { top: "60%", left: "58%", size: 12, delay: "0s", duration: "3.2s" },
  { top: "74%", left: "70%", size: 15, delay: "1s", duration: "3.6s" },
  { top: "50%", left: "68%", size: 10, delay: "1.9s", duration: "3s" },
];

// A plain, honestly-wide (3:2) crop of the photo - no floating card, no
// drop shadow, no blurred glow behind it. Just a real landscape photo the
// same width as the text above it.
function HeroPortrait() {
  return (
    <div style={{ position: "relative", width: "100%", aspectRatio: "3 / 2", overflow: "hidden", borderRadius: "10px" }}>
      <img
        src={heroPhoto}
        alt="A creator checking her phone"
        style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 38%", display: "block" }}
      />
      {FLOATS.map((f, i) => (
        <div key={i} className="float-like" style={{ position: "absolute", top: f.top, left: f.left, animationDelay: f.delay, animationDuration: f.duration }}>
          <HeartIcon size={f.size} />
        </div>
      ))}
    </div>
  );
}

const FEATURES = [
  { title: "Brands post campaigns", body: "Describe the content you need - paid or gifted - and let creators who actually fit your audience come to you." },
  { title: "Creators get discovered", body: "Build a profile, connect your platforms, and apply to campaigns that match your niche." },
  { title: "Payment held in escrow", body: "Funds are secured the moment a deal locks in and only released once the work is delivered." },
];

export default function LandingPage({ onLaunch }: { onLaunch: () => void }) {
  const [canInstall, setCanInstall] = useState(hasDeferredInstallPrompt());
  const [installing, setInstalling] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  const ctaButtons = (
    <div style={{ width: "100%", maxWidth: "360px", display: "flex", flexDirection: "column", gap: "10px" }}>
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
  );

  return (
    <div ref={scrollRef} style={{ height: "100vh", overflowY: "auto", overflowX: "hidden", WebkitOverflowScrolling: "touch", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');
        @keyframes floatLike {
          0% { opacity: 0; transform: translateY(0) scale(0.7); }
          15% { opacity: 1; transform: translateY(-10px) scale(1); }
          80% { opacity: 1; }
          100% { opacity: 0; transform: translateY(-90px) scale(0.85); }
        }
        .float-like { animation-name: floatLike; animation-iteration-count: infinite; animation-timing-function: ease-out; }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(6px); } }
        .scroll-cue { animation: bounce 1.8s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .float-like, .scroll-cue { animation: none !important; }
        }

        /* Below this, unchanged - the same centered mobile layout as
           before. Above it, a real desktop site: wide two-column hero
           instead of a narrow stacked mobile-width column. The app itself
           (post-launch) stays intentionally mobile-width regardless of
           screen size - this split only applies to this landing page. */
        .landing-hero { display: flex; flex-direction: column; align-items: center; text-align: center; }
        .landing-hero-text { display: flex; flex-direction: column; align-items: center; }
        .landing-features { display: flex; flex-direction: column; gap: 1.25rem; max-width: 420px; margin: 0 auto; }
        @media (min-width: 880px) {
          .landing-hero { flex-direction: row; align-items: center; gap: 4rem; text-align: left; max-width: 1080px; margin: 0 auto; }
          .landing-hero-text { align-items: flex-start; flex: 1; }
          .landing-hero-visual { flex: 1.1; }
          .landing-hero h1 { font-size: 48px !important; max-width: 460px !important; }
          .landing-hero p.subhead { max-width: 420px !important; text-align: left; }
          .landing-cta { justify-content: flex-start !important; }
          .landing-features { flex-direction: row; max-width: 1080px; }
        }
      `}</style>

      {/* Hero */}
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", padding: "3rem 1.5rem 2rem" }}>
        <div className="landing-hero" style={{ width: "100%" }}>
          <div className="landing-hero-text">
            <img src={logo} alt="FlipCollab" style={{ width: "52px", marginBottom: "1.25rem" }} />

            <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "34px", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1.15, maxWidth: "380px", marginBottom: "12px" }}>
              Where brands and creators actually connect
            </h1>
            <p className="subhead" style={{ fontSize: "14px", color: "#999", lineHeight: 1.7, marginBottom: "2rem", maxWidth: "320px" }}>
              Post a campaign, apply to one, or just watch the deals happen - payment held securely until the work's delivered.
            </p>

            <div className="landing-cta" style={{ width: "100%", display: "flex", justifyContent: "center" }}>{ctaButtons}</div>

            <div
              className="scroll-cue"
              onClick={() => scrollRef.current?.scrollBy({ top: window.innerHeight * 0.85, behavior: "smooth" })}
              style={{ marginTop: "2.5rem", color: "#555", cursor: "pointer" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
          </div>

          <div className="landing-hero-visual" style={{ width: "100%", maxWidth: "420px" }}>
            <HeroPortrait />
          </div>
        </div>
      </div>

      {/* Features */}
      <div style={{ padding: "1rem 1.5rem 4rem" }}>
        <div className="landing-features" style={{ margin: "0 auto" }}>
          {FEATURES.map((f, i) => (
            <div key={i} style={{ flex: 1, background: "#111", border: "1px solid #1a1a1a", borderRadius: "12px", padding: "1.25rem" }}>
              <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "16px", fontWeight: 800, color: "#fff", marginBottom: "6px" }}>{f.title}</p>
              <p style={{ fontSize: "13px", color: "#999", lineHeight: 1.6 }}>{f.body}</p>
            </div>
          ))}
        </div>
        <div style={{ maxWidth: "420px", margin: "1.25rem auto 0" }}>{ctaButtons}</div>
      </div>

      <p style={{ textAlign: "center", padding: "0 0 2rem", fontSize: "11px", color: "#555" }}>
        <a href="https://about.flipcollab.com" style={{ color: "#555", textDecoration: "none" }}>About</a>
        {" · "}
        <a href="https://privacy.flipcollab.com" style={{ color: "#555", textDecoration: "none" }}>Privacy</a>
        {" · "}
        <a href="https://terms.flipcollab.com" style={{ color: "#555", textDecoration: "none" }}>Terms</a>
      </p>
    </div>
  );
}
