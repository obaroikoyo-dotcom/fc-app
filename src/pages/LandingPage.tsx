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

const HeartIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#ff3b5c" style={{ flexShrink: 0, filter: "drop-shadow(0 2px 6px rgba(255,59,92,0.5))" }}>
    <path d="M12 20.5s-7.5-4.6-9.8-9.1C.7 7.4 2.4 4 6 4c2.1 0 3.6 1.2 4.4 2.4C11.2 5.2 12.7 4 14.8 4c3.6 0 5.3 3.4 3.8 6.9C19.5 15.9 12 20.5 12 20.5Z" />
  </svg>
);

// Likes cluster right around where her hand/phone actually sits in the
// photo (roughly x 64-80%, y 60-88% of the wider boxed/cropped band below),
// not randomized across the whole card.
const FLOATS = [
  { top: "58%", left: "64%", size: 16, delay: "0s", duration: "3.2s" },
  { top: "74%", left: "80%", size: 24, delay: "1s", duration: "3.6s" },
  { top: "44%", left: "78%", size: 14, delay: "1.9s", duration: "3s" },
  { top: "88%", left: "68%", size: 20, delay: "0.5s", duration: "3.4s" },
];

// The image "breaks its frame": the top ~30% (her head/hair) renders
// unclipped and fades into the boxed card beneath it, which is the same
// photo cropped to start where the fade ends - same pixels, same scale, so
// the seam is invisible and it reads as one figure stepping out of the card.
function HeroPortrait({ scrollContainerRef }: { scrollContainerRef: React.RefObject<HTMLDivElement | null> }) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scrollEl = scrollContainerRef.current;
    if (!scrollEl) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = wrapRef.current;
        if (!el) return;
        const y = scrollEl.scrollTop;
        const portrait = el.querySelector<HTMLElement>("[data-portrait]");
        const backdrop = el.querySelector<HTMLElement>("[data-backdrop]");
        if (portrait) portrait.style.transform = `translateY(${y * 0.08}px)`;
        if (backdrop) backdrop.style.transform = `translateY(${y * 0.25}px) scale(1.15)`;
      });
    };
    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    return () => { scrollEl.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, [scrollContainerRef]);

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%" }}>
      {/* Blurred full-bleed backdrop - breaks out to the full viewport width
          so the section reads as a wide landscape scene even though the
          sharp portrait card itself stays portrait-cropped. */}
      <div data-backdrop style={{ position: "absolute", top: "-6%", left: "50%", width: "100vw", height: "112%", transform: "translateX(-50%) scale(1.15)", backgroundImage: `url(${heroPhoto})`, backgroundSize: "cover", backgroundPosition: "center 20%", filter: "blur(50px) brightness(0.35) saturate(1.2)", zIndex: 0 }} />

      <div data-portrait style={{ position: "relative", width: "min(92vw, 760px)", margin: "0 auto", zIndex: 1 }}>
        {/* Unclipped top layer - her head, fading into the boxed band below */}
        <img
          src={heroPhoto}
          alt="A creator checking her phone"
          style={{
            width: "100%", display: "block", position: "relative", zIndex: 2,
            WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 17%, transparent 30%)",
            maskImage: "linear-gradient(to bottom, black 0%, black 17%, transparent 30%)",
          }}
        />
        {/* Boxed band - same photo, cropped to a wide horizontal slice
            (17%-70% down the original 1350px-tall photo) starting exactly
            where the fade ends. marginTop is relative to the parent's WIDTH
            (a CSS quirk for vertical margins), not the top layer's height,
            so this pulls the band up to overlap the top layer starting at
            the 17%-down mark. aspectRatio matches that crop window so
            overflow:hidden has a fixed box to clip against - much wider
            than tall now, instead of the old near-square card. */}
        <div style={{ position: "relative", marginTop: "-124.5%", zIndex: 1, aspectRatio: "900 / 715.5", borderRadius: "26px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 30px 70px -18px rgba(0,0,0,0.85)" }}>
          <img src={heroPhoto} alt="" style={{ width: "100%", display: "block", transform: "translateY(-17%)" }} />

          {FLOATS.map((f, i) => (
            <div key={i} className="float-like" style={{ position: "absolute", top: f.top, left: f.left, animationDelay: f.delay, animationDuration: f.duration, zIndex: 3 }}>
              <HeartIcon size={f.size} />
            </div>
          ))}
        </div>
      </div>
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
    <div style={{ width: "100%", maxWidth: "360px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "10px" }}>
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
      `}</style>

      {/* Hero */}
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "3rem 1.5rem 2rem", textAlign: "center" }}>
        <img src={logo} alt="FlipCollab" style={{ width: "52px", marginBottom: "1.25rem" }} />

        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "34px", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1.15, maxWidth: "380px", marginBottom: "12px" }}>
          Where brands and creators actually connect
        </h1>
        <p style={{ fontSize: "14px", color: "#999", lineHeight: 1.7, marginBottom: "2rem", maxWidth: "320px" }}>
          Post a campaign, apply to one, or just watch the deals happen - payment held securely until the work's delivered.
        </p>

        <HeroPortrait scrollContainerRef={scrollRef} />

        <div style={{ marginTop: "2.25rem", width: "100%" }}>{ctaButtons}</div>

        <div
          className="scroll-cue"
          onClick={() => scrollRef.current?.scrollBy({ top: window.innerHeight * 0.85, behavior: "smooth" })}
          style={{ marginTop: "2.5rem", color: "#555", cursor: "pointer" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
      </div>

      {/* Features */}
      <div style={{ padding: "1rem 1.5rem 4rem", display: "flex", flexDirection: "column", gap: "1.25rem", maxWidth: "420px", margin: "0 auto" }}>
        {FEATURES.map((f, i) => (
          <div key={i} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "12px", padding: "1.25rem" }}>
            <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "16px", fontWeight: 800, color: "#fff", marginBottom: "6px" }}>{f.title}</p>
            <p style={{ fontSize: "13px", color: "#999", lineHeight: 1.6 }}>{f.body}</p>
          </div>
        ))}

        <div style={{ marginTop: "1rem" }}>{ctaButtons}</div>
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
