import { useState, useEffect } from "react";
import App from "./App";
import LandingPage from "./pages/LandingPage";

// The about/privacy/terms subdomains already short-circuit inside App() to
// their own standalone content, not the actual app - they should never show
// this landing page first. A launch from an already-installed home screen
// icon (display-mode: standalone) skips it too, same as GeForce NOW: the
// marketing page is the front door for a browser visit, not for the app
// you already added.
const MARKETING_SUBDOMAINS = ["about", "privacy", "terms"];

export default function Root() {
  const subdomain = window.location.hostname.split(".")[0];
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
  const skipLanding = MARKETING_SUBDOMAINS.includes(subdomain) || isStandalone;
  const [showApp, setShowApp] = useState(skipLanding);

  // Launching pushes a real history entry, so the browser's own back
  // button/gesture takes them back to the landing page instead of doing
  // nothing (the app itself never pushes history - it's all in-memory
  // state - so without this there was no "back" to land on at all).
  useEffect(() => {
    if (skipLanding) return;
    const onPopState = () => setShowApp(false);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [skipLanding]);

  const launch = () => {
    window.history.pushState({ flipcollabApp: true }, "", window.location.pathname);
    setShowApp(true);
  };

  if (!showApp) return <LandingPage onLaunch={launch} />;
  return <App />;
}
