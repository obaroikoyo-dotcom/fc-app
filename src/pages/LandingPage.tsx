import { useState, useEffect } from "react";
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
// drop shadow, no blurred glow behind it.
function HeroPhoto() {
  return (
    <div className="lp-photo">
      <img src={heroPhoto} alt="A creator checking her phone" />
      {FLOATS.map((f, i) => (
        <div key={i} className="lp-float" style={{ top: f.top, left: f.left, animationDelay: f.delay, animationDuration: f.duration }}>
          <HeartIcon size={f.size} />
        </div>
      ))}
    </div>
  );
}

const BRAND_STEPS = [
  { title: "Post a campaign", body: "Describe the content you need and whether it's paid or gifted." },
  { title: "Review who applies", body: "Creators whose audience and niche fit come to you. Look at their profiles and pick who you want." },
  { title: "Pay when it's delivered", body: "Your payment is held in escrow and released once the agreed content is delivered." },
];

const CREATOR_STEPS = [
  { title: "Build your profile", body: "Add your niche and bio, and connect your platforms so brands can see who you are." },
  { title: "Apply to campaigns", body: "Browse open campaigns and apply to the ones that fit your audience." },
  { title: "Get paid", body: "Agree on deliverables in messages, post the work, and the held payment is released to you." },
];

function Steps({ heading, steps }: { heading: string; steps: { title: string; body: string }[] }) {
  return (
    <div>
      <h3 className="lp-steps-heading">{heading}</h3>
      <ol className="lp-steps">
        {steps.map((s, i) => (
          <li key={s.title}>
            <span className="lp-step-num">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <p className="lp-step-title">{s.title}</p>
              <p className="lp-step-body">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');

  .lp {
    height: 100vh;
    height: 100dvh;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
    background: #0a0a0a;
    color: #999;
    font-family: 'DM Sans', 'Helvetica Neue', sans-serif;
  }
  .lp *, .lp *::before, .lp *::after { box-sizing: border-box; }
  .lp :where(h1, h2, h3, p, ol) { margin: 0; padding: 0; }
  .lp :where(ol) { list-style: none; }
  .lp a { color: inherit; text-decoration: none; }
  .lp button { font-family: inherit; }
  .lp :focus-visible { outline: 2px solid #fff; outline-offset: 3px; }

  .lp-wrap { width: 100%; max-width: 1080px; margin: 0 auto; padding: 0 1.5rem; }
  .lp-display { font-family: 'Syne', sans-serif; font-weight: 800; color: #fff; letter-spacing: -0.02em; }

  /* Header */
  .lp-header { position: sticky; top: 0; z-index: 10; background: #0a0a0a; border-bottom: 1px solid #1a1a1a; }
  .lp-header .lp-wrap { display: flex; align-items: center; justify-content: space-between; height: 60px; }
  .lp-brand { display: flex; align-items: center; gap: 10px; }
  .lp-brand img { width: 30px; height: 30px; object-fit: contain; }
  .lp-brand span { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 17px; color: #fff; letter-spacing: -0.01em; }
  .lp-nav { display: flex; align-items: center; gap: 1.5rem; }
  .lp-nav a { display: none; font-size: 13px; color: #999; }
  .lp-nav a:hover { color: #fff; }

  /* Buttons */
  .lp-btn { display: block; width: 100%; padding: 14px; border-radius: 8px; font-size: 13px; font-weight: 600; text-align: center; cursor: pointer; letter-spacing: 0.05em; border: 1px solid transparent; transition: background 0.15s, border-color 0.15s, color 0.15s; }
  .lp-btn-primary { background: #fff; color: #0a0a0a; text-transform: uppercase; }
  .lp-btn-primary:hover { background: #e6e6e6; }
  .lp-btn-primary:disabled { background: #1a1a1a; color: #555; cursor: default; }
  .lp-btn-ghost { background: transparent; border-color: #333; color: #ccc; letter-spacing: 0.04em; }
  .lp-btn-ghost:hover { border-color: #666; color: #fff; }
  .lp-btn-small { width: auto; padding: 8px 14px; font-size: 12px; text-transform: none; letter-spacing: 0.02em; }
  .lp-cta { width: 100%; max-width: 360px; display: flex; flex-direction: column; gap: 10px; }
  .lp-hint { display: flex; align-items: flex-start; gap: 10px; background: #111; border: 1px solid #1a1a1a; border-radius: 10px; padding: 14px 16px; }
  .lp-hint p { font-size: 12px; color: #aaa; line-height: 1.6; }
  .lp-hint strong { color: #fff; font-weight: 600; }
  .lp-hint svg { margin-top: 2px; color: #999; }

  /* Hero */
  .lp-hero { padding-block: 3rem 4rem; display: grid; gap: 2.5rem; }
  .lp-hero h1 { font-size: 36px; line-height: 1.12; max-width: 520px; margin-bottom: 14px; }
  .lp-hero-sub { font-size: 15px; line-height: 1.7; max-width: 440px; margin-bottom: 2rem; }
  .lp-photo { position: relative; width: 100%; aspect-ratio: 3 / 2; overflow: hidden; border-radius: 10px; }
  .lp-photo img { width: 100%; height: 100%; object-fit: cover; object-position: 50% 38%; display: block; }
  .lp-float { position: absolute; animation: lpFloat 3.2s ease-out infinite; }
  @keyframes lpFloat {
    0% { opacity: 0; transform: translateY(0) scale(0.7); }
    15% { opacity: 1; transform: translateY(-10px) scale(1); }
    80% { opacity: 1; }
    100% { opacity: 0; transform: translateY(-90px) scale(0.85); }
  }

  /* Sections */
  .lp-section { border-top: 1px solid #1a1a1a; padding-block: 4rem; scroll-margin-top: 60px; }
  .lp-kicker { font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #666; margin-bottom: 12px; }
  .lp-h2 { font-size: 28px; line-height: 1.2; max-width: 560px; }
  .lp-split { display: grid; gap: 3rem; margin-top: 2.5rem; }
  .lp-steps-heading { font-size: 15px; font-weight: 600; color: #fff; padding-bottom: 14px; border-bottom: 1px solid #333; }
  .lp-steps li { display: flex; gap: 1.25rem; padding: 1.25rem 0; border-bottom: 1px solid #1a1a1a; }
  .lp-step-num { flex-shrink: 0; width: 1.5rem; font-size: 12px; color: #666; padding-top: 3px; font-variant-numeric: tabular-nums; }
  .lp-step-title { font-size: 16px; font-weight: 600; color: #fff; margin-bottom: 4px; }
  .lp-step-body { font-size: 14px; line-height: 1.65; }

  .lp-escrow { display: grid; gap: 1.25rem; }
  .lp-escrow p.lp-body { font-size: 15px; line-height: 1.75; max-width: 520px; }

  .lp-final { display: grid; gap: 1.75rem; }
  .lp-final .lp-cta { max-width: 300px; }

  /* Footer */
  .lp-footer { border-top: 1px solid #1a1a1a; padding-block: 2.5rem 3rem; }
  .lp-footer .lp-wrap { display: flex; flex-direction: column; gap: 1.5rem; }
  .lp-footer-tag { font-size: 13px; margin-top: 10px; }
  .lp-footer-links { display: flex; gap: 1.5rem; font-size: 13px; }
  .lp-footer-links a:hover { color: #fff; }
  .lp-legal { font-size: 12px; color: #555; }

  @media (min-width: 880px) {
    .lp-nav a { display: inline; }
    .lp-header .lp-wrap { height: 68px; }
    .lp-hero { grid-template-columns: 1fr 1.1fr; gap: 4rem; align-items: center; padding-block: 5rem 6rem; }
    .lp-hero h1 { font-size: 46px; }
    .lp-hero-sub { font-size: 16px; }
    .lp-section { padding-block: 6rem; }
    .lp-h2 { font-size: 36px; }
    .lp-split { grid-template-columns: 1fr 1fr; gap: 4rem; margin-top: 3.5rem; }
    .lp-escrow { grid-template-columns: 1fr 1fr; gap: 4rem; align-items: start; }
    .lp-final { grid-template-columns: 1fr auto; align-items: center; gap: 4rem; }
    .lp-footer .lp-wrap { flex-direction: row; justify-content: space-between; align-items: flex-start; }
    .lp-footer-right { text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 1.25rem; }
  }

  @media (prefers-reduced-motion: reduce) {
    .lp-float { animation: none; opacity: 0; }
  }
`;

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

  // Device-aware: iOS has no install prompt API so it gets Share-sheet
  // instructions, Android gets a real button once beforeinstallprompt has
  // fired, everything else just launches.
  const cta = (
    <div className="lp-cta">
      {isIOS ? (
        <>
          <div className="lp-hint">
            <ShareIcon />
            <p>
              Tap the <strong>Share</strong> icon in Safari, then <strong>Add to Home Screen</strong> - opens like an app, full screen, no browser bar.
            </p>
          </div>
          <button type="button" className="lp-btn lp-btn-ghost" onClick={onLaunch}>Continue in Browser</button>
        </>
      ) : isAndroid && canInstall ? (
        <>
          <button type="button" className="lp-btn lp-btn-primary" onClick={handleInstall} disabled={installing}>
            {installing ? "Adding..." : "Add to Home Screen"}
          </button>
          <button type="button" className="lp-btn lp-btn-ghost" onClick={onLaunch}>Continue in Browser</button>
        </>
      ) : (
        <button type="button" className="lp-btn lp-btn-primary" onClick={onLaunch}>
          {isMobile ? "Continue in Browser" : "Launch FlipCollab"}
        </button>
      )}
    </div>
  );

  return (
    <div className="lp">
      <style>{STYLES}</style>

      <header className="lp-header">
        <div className="lp-wrap">
          <div className="lp-brand">
            <img src={logo} alt="" />
            <span>FlipCollab</span>
          </div>
          <nav className="lp-nav" aria-label="Main">
            <a
              href="#how-it-works"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              How it works
            </a>
            <a href="https://about.flipcollab.com">About</a>
            <button type="button" className="lp-btn lp-btn-ghost lp-btn-small" onClick={onLaunch}>Launch app</button>
          </nav>
        </div>
      </header>

      <main>
        <section className="lp-wrap lp-hero">
          <div>
            <h1 className="lp-display">Where brands and creators actually connect</h1>
            <p className="lp-hero-sub">
              Post a campaign, apply to one, or just watch the deals happen - payment held securely until the work's delivered.
            </p>
            {cta}
          </div>
          <HeroPhoto />
        </section>

        <section id="how-it-works" className="lp-section">
          <div className="lp-wrap">
            <p className="lp-kicker">How it works</p>
            <h2 className="lp-h2 lp-display">One place for the whole collaboration</h2>
            <div className="lp-split">
              <Steps heading="For brands" steps={BRAND_STEPS} />
              <Steps heading="For creators" steps={CREATOR_STEPS} />
            </div>
          </div>
        </section>

        <section className="lp-section">
          <div className="lp-wrap lp-escrow">
            <div>
              <p className="lp-kicker">Payments</p>
              <h2 className="lp-h2 lp-display">Held in escrow until the work is delivered</h2>
            </div>
            <p className="lp-body">
              For paid campaigns, the brand's payment is secured through Stripe the moment a deal locks in. It's only released to the creator once the agreed content is delivered.
            </p>
          </div>
        </section>

        <section className="lp-section">
          <div className="lp-wrap lp-final">
            <h2 className="lp-h2 lp-display">Post your first campaign, or find your next one.</h2>
            {cta}
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-wrap">
          <div>
            <div className="lp-brand">
              <img src={logo} alt="" />
              <span>FlipCollab</span>
            </div>
            <p className="lp-footer-tag">A creator collaboration marketplace.</p>
          </div>
          <div className="lp-footer-right">
            <nav className="lp-footer-links" aria-label="Footer">
              <a href="https://about.flipcollab.com">About</a>
              <a href="https://privacy.flipcollab.com">Privacy</a>
              <a href="https://terms.flipcollab.com">Terms</a>
            </nav>
            <p className="lp-legal">&copy; {new Date().getFullYear()} FlipCollab</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
