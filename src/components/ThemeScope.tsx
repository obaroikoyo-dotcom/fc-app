import { useEffect, type ReactNode } from "react";
import { isLightTheme, applyTheme } from "../lib/theme";

// Gives a screen that lives outside the app proper (the demo picker, the
// install sheet) the same light or dark look as the app.
export default function ThemeScope({ children, zIndex = 0 }: { children: ReactNode; zIndex?: number }) {
  const light = isLightTheme();

  useEffect(() => {
    applyTheme(light);
    document.getElementById("theme-boot")?.remove();
    document.body.style.background = light ? "#ffffff" : "#0a0a0a";
  }, [light]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex, overflow: "auto", background: "var(--c-0a0a0a)" }}>
      {children}
    </div>
  );
}
