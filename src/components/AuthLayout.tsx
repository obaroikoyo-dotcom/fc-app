import type { ReactNode } from "react";

interface AuthLayoutProps {
  children: ReactNode;
}

// The page the sign-up, log-in and role screens sit on. It is sized from its
// own box (100% of the page area), not from the browser's 100vh, which on an
// iPhone can be taller than what is actually visible and pushes everything
// down or makes the screen scroll. The padding keeps content clear of the
// notch and the home bar on phones that run edge to edge; on phones that
// don't, those insets are 0 and the padding is the same 2rem as before.
export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div data-auth-layout style={{
      minHeight: "100%",
      background: "var(--c-0a0a0a)",
      display: "flex",
      flexDirection: "column",
      padding: "calc(2rem + env(safe-area-inset-top, 0px)) 1rem calc(2rem + env(safe-area-inset-bottom, 0px))",
      fontFamily: "'TikTok Sans', 'Helvetica Neue', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=TikTok+Sans:wght@300..900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input:-webkit-autofill {
          -webkit-box-shadow: 0 0 0px 1000px var(--c-111) inset !important;
          -webkit-text-fill-color: var(--c-fff) !important;
        }
      `}</style>
      {/* margin: auto centres the content both ways when it fits, and when it
          is taller than the screen it simply grows and scrolls from the top
          (justify-content: center would cut the top off instead). */}
      <div style={{ margin: "auto", width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
        {children}
      </div>
    </div>
  );
}
