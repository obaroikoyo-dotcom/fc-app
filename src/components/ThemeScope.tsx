import { useEffect, type ReactNode } from "react";
import { isLightTheme, LIGHT_FILTER } from "../lib/theme";

// Gives a screen that lives outside the app proper (the demo picker, the
// install sheet) the same light or dark look as the app.
export default function ThemeScope({ children, zIndex = 0 }: { children: ReactNode; zIndex?: number }) {
  const light = isLightTheme();

  useEffect(() => {
    document.getElementById("theme-boot")?.remove();
    document.body.style.background = light ? "#ffffff" : "#0a0a0a";
  }, [light]);

  return (
    <div className={light ? "theme-light" : undefined} style={{ position: "fixed", inset: 0, zIndex, overflow: "auto", filter: light ? LIGHT_FILTER : "none" }}>
      {children}
    </div>
  );
}
