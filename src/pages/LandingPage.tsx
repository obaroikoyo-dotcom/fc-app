import { useState, useEffect } from "react";
import logo from "../assets/logo.png";
import heroPhoto from "../assets/landing/phone-goldenhour.jpg";
import { hasDeferredInstallPrompt, onInstallPromptAvailable, triggerInstallPrompt } from "../lib/pwaInstall";

const isIOS = typeof navigator !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent);
const isAndroid = typeof navigator !== "undefined" && /Android/.test(navigator.userAgent);
const isMobile = isIOS || isAndroid;

const ShareIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <path d="M12 3v13M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const HeartIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#fff" style={{ flexShrink: 0, opacity: 0.9 }}>
    <path d="M12 20.5s-7.5-4.6-9.8-9.1C.7 7.4 2.4 4 6 4c2.1 0 3.6 1.2 4.4 2.4C11.2 5.2 12.7 4 14.8 4c3.6 0 5.3 3.4 3.8 6.9C19.5 15.9 12 20.5 12 20.5Z" />
  </svg>
);

// Likes sit right at her hand/phone in the crop below - small and plain,
// not glowing clipart hearts.
const FLOATS = [
  { top: "60%", left: "58%", size: 12, delay: "0s", duration: "3.2s" },
  { top: "74%", left: "70%", size: 15, delay: "1s", duration: "3.6s" },
  { top: "50%", left: "68%", size: 10, delay: "1.9s", duration: "3s" },
];

// A plain landscape crop of the photo - no floating card, no drop shadow,
// no blurred glow behind it. Just a big rounded photo with a slight tilt.
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
      <h3 className="lp-chip">{heading}</h3>
      <ol className="lp-steps">
        {steps.map((s, i) => (
          <li key={s.title}>
            <span className="lp-step-num">{i + 1}</span>
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

// The wavy shapes are SVG masks over a flat var() fill, so each section can
// recolor them with CSS instead of needing a separate image per color. Each
// one is a single curve stretched across the element (not a tiled pattern),
// so the shapes can be uneven and there are only a few features per line.
const svgMask = (viewBox: string, body: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${viewBox}' preserveAspectRatio='none'>${body}</svg>`
  )}")`;

// A hand-drawn line is a list of anchors: [x, y, kl, kr]. The curve is flat
// (horizontal tangent) at every anchor, so tops and valleys are round, and
// the run between two anchors is a slanted ramp. kl / kr (0 to 0.5) say how
// far the handle reaches back / forward, as a fraction of the gap to the
// neighbouring anchor: near 0.5 is wide and soft, small keeps the ramp
// straight right up to a tight corner, and 0 on both sides is a sharp point.
type Anchor = [x: number, y: number, kl: number, kr: number];

function drawn(anchors: Anchor[]) {
  return anchors.reduce((d, [x, y, kl], i) => {
    if (i === 0) return `M${x} ${y}`;
    const [px, py, , kr] = anchors[i - 1];
    const run = x - px;
    return `${d} C${(px + kr * run).toFixed(1)} ${py} ${(x - kl * run).toFixed(1)} ${y} ${x} ${y}`;
  }, "");
}

// Same line, drawn from the other side, so one sketch gives two shapes.
const flipX = (anchors: Anchor[], width: number): Anchor[] =>
  anchors.map(([x, y, kl, kr]): Anchor => [width - x, y, kr, kl]).reverse();

// Solid shape under (or, with edgeY 0, above) the curve, for section edges.
const fillShape = (viewBox: string, d: string, edgeY: number) =>
  svgMask(viewBox, `<path d='${d} V${edgeY} H0 Z'/>`);

// Just the stroke, for dividers and the headline underline.
const strokeShape = (viewBox: string, d: string, width: number) =>
  svgMask(viewBox, `<path d='${d}' fill='none' stroke='black' stroke-width='${width}' stroke-linecap='round' stroke-linejoin='round'/>`);

// Section edges are drawn in a 1440 x 100 box and filled below the curve, so
// a small y is a high point that rises into the section above. Only two
// sketches; the other two edges are those same sketches drawn backwards.
// Long straight-ish ramps, broad flat tops and valleys, few features.
const HUMP: Anchor[] = [
  [0, 46, 0, 0.3], [60, 66, 0.3, 0.3], [170, 74, 0.4, 0.4], [400, 42, 0.3, 0.3], [540, 52, 0.3, 0.3],
  [930, 6, 0.45, 0.35], [1180, 36, 0.3, 0.3], [1290, 56, 0.3, 0.4], [1440, 46, 0.4, 0],
];
const RIDGE: Anchor[] = [
  [0, 79, 0, 0.3], [210, 55, 0.45, 0.45], [525, 78, 0.45, 0.22], [975, 8, 0.2, 0.35],
  [1125, 9, 0.4, 0.35], [1240, 24, 0.3, 0.35], [1335, 25, 0.35, 0.35], [1440, 5, 0.35, 0],
];
const EDGES = [HUMP, RIDGE, flipX(HUMP, 1440), flipX(RIDGE, 1440)].map((a) =>
  fillShape("0 0 1440 100", drawn(a), 100)
);
// Header edge: a wide shallow dip, filled above the curve so it hangs down
// from the sticky header.
const HEADER_EDGE = fillShape("0 0 1440 40", drawn([
  [0, 3, 0, 0.3], [130, 29, 0.35, 0.3], [360, 30, 0.3, 0.35], [470, 4, 0.35, 0.3], [700, 3, 0.3, 0.3],
  [940, 22, 0.4, 0.3], [1150, 24, 0.3, 0.4], [1290, 4, 0.35, 0.3], [1440, 3, 0.3, 0],
]), 0);
// Small scribbles: pointed tops, rounded valleys, uneven sizes and gaps.
// Three different ones for the step dividers. They were laid out in a box 14
// high, then drawn TALL times taller, so the pointed tops stand up steeply
// instead of reading as a flat line with tiny kinks.
const TALL = 3.3;
// Tight, rounded valleys - anything softer than this reads as a rolling hill.
const SNAP = 0.25;
const LINES = [
  [
    [0, 10, 0, 0], [150, 2, 0, 0], [262, 12, 0.4, 0.4], [371, 7, 0, 0],
    [408, 11.5, 0.35, 0.35], [473, 5.2, 0, 0], [540, 8.5, 0.35, 0.35], [600, 2.5, 0, 0],
  ],
  [
    [0, 9.2, 0, 0.3], [108, 6, 0, 0], [170, 11.7, 0.3, 0.3], [258, 6, 0, 0], [313, 12, 0.35, 0.35],
    [393, 4.2, 0, 0], [455, 8.7, 0.3, 0.3], [522, 2, 0, 0], [564, 8.1, 0.35, 0.35], [600, 4.4, 0, 0],
  ],
  [
    [0, 7.6, 0, 0], [27, 11.75, 0.3, 0.3], [254, 2.4, 0, 0], [269, 6.6, 0.2, 0.2], [403, 2, 0, 0],
    [444, 9.5, 0.3, 0.3], [573, 4.1, 0, 0], [600, 7.4, 0, 0],
  ],
].map((a) =>
  strokeShape("0 0 600 44", drawn((a as Anchor[]).map(([x, y, kl, kr]): Anchor => [x, y * TALL, Math.min(kl, SNAP), Math.min(kr, SNAP)])), 2.6)
);
// Headline underline: the same kind of scribble, stretched to the word.
const UNDERLINE = strokeShape("0 0 200 10", drawn([
  [0, 8, 0, 0.3], [55, 2, 0, 0], [95, 8.5, 0.25, 0.25], [140, 3.5, 0, 0], [175, 7.5, 0.25, 0.25], [200, 4, 0, 0],
]), 1.9);

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');

  .lp {
    --m-edge-a: ${EDGES[0]};
    --m-edge-b: ${EDGES[1]};
    --m-edge-c: ${EDGES[2]};
    --m-edge-d: ${EDGES[3]};
    --m-header: ${HEADER_EDGE};
    --m-line-1: ${LINES[0]};
    --m-line-2: ${LINES[1]};
    --m-line-3: ${LINES[2]};
    --m-underline: ${UNDERLINE};
    --wave-h: clamp(48px, 8.5vw, 128px);
    height: 100vh;
    height: 100dvh;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
    background: #0a0a0a;
    font-family: 'DM Sans', 'Helvetica Neue', sans-serif;
  }
  .lp *, .lp *::before, .lp *::after { box-sizing: border-box; }
  .lp :where(h1, h2, h3, p, ol) { margin: 0; padding: 0; }
  .lp :where(ol) { list-style: none; }
  .lp a { color: inherit; text-decoration: none; }
  .lp button { font-family: inherit; }
  .lp :focus-visible { outline: 3px solid var(--fg); outline-offset: 3px; }

  /* Every section picks a side: black or white, with text flipped to match. */
  .lp-dark { --bg: #0a0a0a; --fg: #fff; --muted: #b3b3b3; }
  .lp-light { --bg: #fff; --fg: #0a0a0a; --muted: #444; }
  .lp-dark, .lp-light { background: var(--bg); color: var(--muted); position: relative; }
  .lp :where(h1, h2, h3), .lp-display { color: var(--fg); }

  /* Wavy edge along the top of a section, hanging over the one above it. */
  .lp-edge::before {
    content: ""; position: absolute; left: 0; right: 0; bottom: calc(100% - 1px); height: calc(var(--wave-h) + 1px);
    background: var(--bg);
    -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat;
    /* Never narrower than 800px, so on a phone it crops the curve instead
       of squashing the ramps into cliffs. */
    -webkit-mask-size: max(100%, 800px) 100%; mask-size: max(100%, 800px) 100%;
    -webkit-mask-position: center bottom; mask-position: center bottom;
    pointer-events: none;
  }
  .lp-edge-a::before { -webkit-mask-image: var(--m-edge-a); mask-image: var(--m-edge-a); }
  .lp-edge-b::before { -webkit-mask-image: var(--m-edge-b); mask-image: var(--m-edge-b); }
  .lp-edge-c::before { -webkit-mask-image: var(--m-edge-c); mask-image: var(--m-edge-c); }
  .lp-edge-d::before { -webkit-mask-image: var(--m-edge-d); mask-image: var(--m-edge-d); }

  .lp-wrap { width: 100%; max-width: 1600px; margin: 0 auto; padding-inline: clamp(1.25rem, 4vw, 4.5rem); }
  .lp-display { font-family: 'Syne', sans-serif; font-weight: 800; letter-spacing: -0.02em; }

  /* Header */
  .lp-header { position: sticky; top: 0; z-index: 10; }
  .lp-header::after {
    content: ""; position: absolute; left: 0; right: 0; top: calc(100% - 1px); height: 30px;
    background: var(--bg);
    -webkit-mask-image: var(--m-header); mask-image: var(--m-header);
    -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat;
    -webkit-mask-size: max(100%, 800px) 100%; mask-size: max(100%, 800px) 100%;
    -webkit-mask-position: center top; mask-position: center top;
    pointer-events: none;
  }
  .lp-header .lp-wrap { display: flex; align-items: center; justify-content: space-between; height: 64px; }
  .lp-brand { display: flex; align-items: center; gap: 10px; }
  .lp-brand img { width: 32px; height: 32px; object-fit: contain; }
  .lp-brand span { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 19px; color: var(--fg); letter-spacing: -0.01em; }
  .lp-nav { display: flex; align-items: center; gap: 1.75rem; }
  .lp-nav a { display: none; font-size: 14px; font-weight: 500; color: var(--muted); }
  .lp-nav a:hover { color: var(--fg); }

  /* Buttons - fat pills */
  .lp-btn { display: block; width: 100%; padding: 16px 20px; border-radius: 999px; font-size: 14px; font-weight: 600; text-align: center; cursor: pointer; letter-spacing: 0.05em; border: 2px solid var(--fg); transition: background 0.15s, color 0.15s, opacity 0.15s; }
  .lp-btn-primary { background: var(--fg); color: var(--bg); text-transform: uppercase; }
  .lp-btn-primary:hover { opacity: 0.85; }
  .lp-btn-primary:disabled { opacity: 0.5; cursor: default; }
  .lp-btn-ghost { background: transparent; color: var(--fg); letter-spacing: 0.03em; }
  .lp-btn-ghost:hover { background: var(--fg); color: var(--bg); }
  .lp-btn-small { width: auto; padding: 9px 18px; font-size: 13px; letter-spacing: 0.02em; }
  .lp-cta { width: 100%; max-width: 380px; display: flex; flex-direction: column; gap: 12px; }
  .lp-hint { display: flex; align-items: flex-start; gap: 12px; border: 2px solid var(--fg); border-radius: 22px; padding: 14px 18px; }
  .lp-hint p { font-size: 13px; line-height: 1.6; color: var(--muted); }
  .lp-hint strong { color: var(--fg); font-weight: 600; }
  .lp-hint svg { margin-top: 2px; color: var(--fg); }

  /* Hero */
  .lp-hero .lp-wrap { display: grid; gap: 3rem; padding-block: 3.5rem calc(2rem + var(--wave-h)); }
  .lp-hero h1 { font-size: clamp(2.25rem, 4.8vw, 5.75rem); line-height: 1.08; margin-bottom: 1.25rem; }
  .lp-hero-sub { font-size: clamp(16px, 1.5vw, 21px); line-height: 1.65; max-width: 30em; margin-bottom: 2.25rem; }
  .lp-photo { position: relative; width: 100%; aspect-ratio: 4 / 3; overflow: hidden; border-radius: 28px; transform: rotate(-2deg); }
  .lp-photo img { width: 100%; height: 100%; object-fit: cover; object-position: 50% 42%; display: block; }
  .lp-float { position: absolute; animation: lpFloat 3.2s ease-out infinite; }
  @keyframes lpFloat {
    0% { opacity: 0; transform: translateY(0) scale(0.7); }
    15% { opacity: 1; transform: translateY(-10px) scale(1); }
    80% { opacity: 1; }
    100% { opacity: 0; transform: translateY(-90px) scale(0.85); }
  }

  /* Wavy underline under a single word of a headline */
  .lp-underline { position: relative; display: inline-block; }
  .lp-underline::after {
    content: ""; position: absolute; left: 0; right: 0; bottom: -0.22em; height: 0.34em;
    background: currentColor;
    -webkit-mask-image: var(--m-underline); mask-image: var(--m-underline);
    -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat;
    -webkit-mask-size: 100% 100%; mask-size: 100% 100%;
  }

  /* Sections */
  .lp-section { padding-block: clamp(4rem, 9vw, 8rem) calc(clamp(4rem, 9vw, 8rem) + var(--wave-h) * 0.4); scroll-margin-top: 64px; }
  .lp-kicker { font-size: 13px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); margin-bottom: 14px; }
  .lp-h2 { font-size: clamp(2rem, 4.4vw, 4.75rem); line-height: 1.12; }
  .lp-split { display: grid; gap: 3.5rem; margin-top: clamp(2.5rem, 5vw, 4.5rem); }
  .lp-chip { display: inline-block; font-size: 15px; font-weight: 600; background: var(--fg); color: var(--bg); padding: 8px 20px; border-radius: 999px; }
  .lp-steps { margin-top: 0.75rem; }
  .lp-steps li { position: relative; display: flex; gap: 1.25rem; padding-block: 1.5rem 4rem; }
  .lp-steps li::after {
    content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 44px;
    background: var(--fg); opacity: 0.4;
    -webkit-mask-image: var(--m-line-1); mask-image: var(--m-line-1);
    -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat;
    -webkit-mask-size: 100% 100%; mask-size: 100% 100%;
  }
  .lp-steps li:nth-child(2)::after { -webkit-mask-image: var(--m-line-2); mask-image: var(--m-line-2); }
  .lp-steps li:nth-child(3)::after { -webkit-mask-image: var(--m-line-3); mask-image: var(--m-line-3); }
  .lp-step-num { flex-shrink: 0; width: 2.5rem; height: 2.5rem; border-radius: 50%; background: var(--fg); color: var(--bg); display: grid; place-items: center; font-weight: 700; font-size: 17px; }
  .lp-step-title { font-size: clamp(18px, 1.6vw, 24px); font-weight: 600; color: var(--fg); margin-bottom: 6px; padding-top: 0.35rem; }
  .lp-step-body { font-size: clamp(15px, 1.2vw, 18px); line-height: 1.65; max-width: 30em; }

  .lp-escrow { display: grid; gap: 1.75rem; }
  .lp-escrow p.lp-body { font-size: clamp(16px, 1.6vw, 23px); line-height: 1.7; max-width: 30em; }

  .lp-final { display: grid; gap: 2rem; }
  .lp-final .lp-cta { max-width: 340px; }

  /* Footer */
  .lp-footer { padding-block: 3.5rem 3rem; }
  .lp-footer .lp-wrap { display: flex; flex-direction: column; gap: 2rem; }
  .lp-footer-tag { font-size: 14px; margin-top: 12px; }
  .lp-footer-right { display: flex; flex-direction: column; gap: 1.25rem; }
  .lp-footer-links { display: flex; gap: 1.75rem; font-size: 14px; font-weight: 500; }
  .lp-footer-links a:hover { color: var(--fg); }
  .lp-legal { font-size: 13px; opacity: 0.7; }

  @media (min-width: 880px) {
    .lp-nav a { display: inline; }
    .lp-header .lp-wrap { height: 72px; }
    .lp-hero .lp-wrap { grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 4vw; align-items: center; min-height: calc(100dvh - 72px); padding-block: 3rem calc(2rem + var(--wave-h)); }
    .lp-split { grid-template-columns: 1fr 1fr; gap: 6vw; }
    .lp-escrow { grid-template-columns: 1fr 1fr; gap: 6vw; align-items: center; }
    .lp-final { grid-template-columns: 1fr auto; align-items: center; gap: 6vw; }
    .lp-footer .lp-wrap { flex-direction: row; justify-content: space-between; align-items: flex-start; }
    .lp-footer-right { align-items: flex-end; }
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

      <header className="lp-header lp-dark">
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
        <section className="lp-hero lp-dark">
          <div className="lp-wrap">
            <div>
              <h1 className="lp-display">
                Where brands and creators <span className="lp-underline">actually</span> connect
              </h1>
              <p className="lp-hero-sub">
                Post a campaign, apply to one, or just watch the deals happen - payment held securely until the work's delivered.
              </p>
              {cta}
            </div>
            <HeroPhoto />
          </div>
        </section>

        <section id="how-it-works" className="lp-section lp-light lp-edge lp-edge-a">
          <div className="lp-wrap">
            <p className="lp-kicker">How it works</p>
            <h2 className="lp-h2 lp-display">One place for the whole collaboration</h2>
            <div className="lp-split">
              <Steps heading="For brands" steps={BRAND_STEPS} />
              <Steps heading="For creators" steps={CREATOR_STEPS} />
            </div>
          </div>
        </section>

        <section className="lp-section lp-dark lp-edge lp-edge-b">
          <div className="lp-wrap lp-escrow">
            <div>
              <p className="lp-kicker">Payments</p>
              <h2 className="lp-h2 lp-display">
                Held in <span className="lp-underline">escrow</span> until the work is delivered
              </h2>
            </div>
            <p className="lp-body">
              For paid campaigns, the brand's payment is secured through Stripe the moment a deal locks in. It's only released to the creator once the agreed content is delivered.
            </p>
          </div>
        </section>

        <section className="lp-section lp-light lp-edge lp-edge-c">
          <div className="lp-wrap lp-final">
            <h2 className="lp-h2 lp-display">Post your first campaign, or find your next one.</h2>
            {cta}
          </div>
        </section>
      </main>

      <footer className="lp-footer lp-dark lp-edge lp-edge-d">
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
