import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import AuthLayout from "./AuthLayout";
import logo from "../assets/logo.png";

// The "brand or creator?" screen. The real app (RoleSelect) and the demo
// (DemoEntry) both show it, so they are built from this one component and
// can't drift apart.

export interface RoleOption {
  title: string;
  sub: string;
  onChoose: () => void;
}

interface Props {
  eyebrow: string;
  brand: RoleOption;
  creator: RoleOption;
  // Shown under the cards. Uses the rs-foot / rs-foot-2 classes for its spacing.
  footer: ReactNode;
}

const BuildingIcon = (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
    <rect x="5" y="3" width="10" height="18" rx="1" stroke="currentColor" strokeWidth="1.6" />
    <path d="M15 9h4v12H5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8 7h1M11 7h1M8 11h1M11 11h1M8 15h1M11 15h1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M17.5 12.5h1M17.5 15.5h1M17.5 18.5h1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const CreatorIcon = (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.6" />
    <path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

// Spacing lives in classes (not inline) so it can tighten on short screens:
// this page is meant to sit still and fit, so on a short phone like an
// iPhone SE it gets a more compact version instead of turning into a scroll.
// Which version is used is decided by measuring the room the phone actually
// gives us (see the effect below), so a phone that has the room keeps the
// full layout. Colours and type stay inline, as on every other page.
const SPACING = `
  .rs-logo { width: 150px; height: auto; display: block; margin: 0 auto 1rem; }
  .rs-name { margin-bottom: 1.5rem; }
  .rs-eyebrow { margin-bottom: 2rem; }
  .rs-cards { display: flex; gap: 1rem; flex-wrap: wrap; }
  .rs-card { padding: 2rem 1.5rem; }
  .rs-icon { margin-bottom: 12px; }
  .rs-card-title { margin-bottom: 6px; }
  .rs-foot { margin-top: 2rem; }
  .rs-foot-2 { margin-top: 1rem; }

  [data-tier="1"] .rs-logo { width: 120px; margin-bottom: 12px; }
  [data-tier="1"] .rs-name { margin-bottom: 1rem; }
  [data-tier="1"] .rs-eyebrow { margin-bottom: 1.25rem; }
  [data-tier="1"] .rs-cards { gap: 12px; }
  [data-tier="1"] .rs-card { padding: 1.25rem 1.5rem; }
  [data-tier="1"] .rs-icon { margin-bottom: 8px; }
  [data-tier="1"] .rs-card-title { margin-bottom: 4px; }
  [data-tier="1"] .rs-foot { margin-top: 1.25rem; }
  [data-tier="1"] .rs-foot-2 { margin-top: 0.75rem; }

  [data-tier="2"] .rs-logo { width: 96px; margin-bottom: 8px; }
  [data-tier="2"] .rs-name { margin-bottom: 0.625rem; }
  [data-tier="2"] .rs-eyebrow { margin-bottom: 0.875rem; }
  [data-tier="2"] .rs-cards { gap: 10px; }
  [data-tier="2"] .rs-card { display: flex; align-items: center; gap: 14px; padding: 0.875rem 1rem; }
  [data-tier="2"] .rs-icon { margin-bottom: 0; flex-shrink: 0; }
  [data-tier="2"] .rs-foot { margin-top: 0.875rem; }
  [data-tier="2"] .rs-foot-2 { margin-top: 0.5rem; }
`;

export default function RoleChooser({ eyebrow, brand, creator, footer }: Props) {
  const [hovered, setHovered] = useState<"brand" | "creator" | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Use the roomiest layout that fits without scrolling: try the full one,
  // then the compact ones, against the room this phone actually has (which
  // already accounts for the notch and home bar). Runs before the first paint,
  // so nothing jumps, and again when the room changes (rotation, window size)
  // or the font arrives. It watches the room, never the content, because
  // switching layouts changes the content's size and would set it off again.
  useLayoutEffect(() => {
    const content = contentRef.current;
    const layout = content?.closest<HTMLElement>("[data-auth-layout]");
    const area = layout?.parentElement;
    if (!content || !layout || !area) return;
    const fit = () => {
      if (!content.isConnected) return;
      const pad = getComputedStyle(layout);
      const room = area.clientHeight - parseFloat(pad.paddingTop) - parseFloat(pad.paddingBottom);
      for (const tier of ["0", "1", "2"]) {
        content.dataset.tier = tier;
        if (content.offsetHeight <= room) break;
      }
    };
    fit();
    // Later re-checks wait for the next frame so they never run inside the
    // observer's own callback.
    let frame = 0;
    const refit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    };
    const watcher = typeof ResizeObserver !== "undefined" ? new ResizeObserver(refit) : null;
    watcher?.observe(area);
    document.fonts?.addEventListener?.("loadingdone", refit);
    return () => {
      watcher?.disconnect();
      cancelAnimationFrame(frame);
      document.fonts?.removeEventListener?.("loadingdone", refit);
    };
  }, []);

  const card = (role: "brand" | "creator", option: RoleOption, icon: ReactNode) => {
    const isHovered = hovered === role;
    return (
      <div
        className="rs-card"
        onClick={option.onChoose}
        onMouseEnter={() => setHovered(role)}
        onMouseLeave={() => setHovered(null)}
        style={{
          border: `1px solid ${isHovered ? "#fff" : "#222"}`,
          borderRadius: "12px",
          cursor: "pointer",
          // Only the hover colours animate. If the size animated too, the
          // measuring above would read a half-way height.
          transition: "border-color 0.2s, background 0.2s",
          background: isHovered ? "#111" : "transparent",
          flex: 1,
          minWidth: "200px",
        }}
      >
        <div className="rs-icon" style={{ color: "#fff" }}>{icon}</div>
        <div>
          <p className="rs-card-title" style={{
            fontFamily: "'TikTok Sans', sans-serif",
            fontSize: "18px",
            fontWeight: 700,
            color: "#fff",
          }}>{option.title}</p>
          <p style={{ fontSize: "13px", color: "#999", lineHeight: 1.5 }}>{option.sub}</p>
        </div>
      </div>
    );
  };

  return (
    <AuthLayout>
      <style>{SPACING}</style>
      <div ref={contentRef} style={{ width: "100%", maxWidth: "480px" }}>
        {/* width and height are the file's own size, so the space is reserved before it loads */}
        <img src={logo} width={365} height={219} alt="" className="no-reinvert rs-logo" />
        <p className="rs-name" style={{ fontFamily: "'TikTok Sans', sans-serif", fontSize: "22px", fontWeight: 800, color: "#fff", textAlign: "center" }}>FlipCollab</p>
        <p className="rs-eyebrow" style={{
          textAlign: "center",
          fontSize: "13px",
          color: "#888",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}>{eyebrow}</p>

        <div className="rs-cards">
          {card("brand", brand, BuildingIcon)}
          {card("creator", creator, CreatorIcon)}
        </div>

        {footer}
      </div>
    </AuthLayout>
  );
}
