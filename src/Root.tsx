import { useState } from "react";
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
  const [showApp, setShowApp] = useState(MARKETING_SUBDOMAINS.includes(subdomain) || isStandalone);

  if (!showApp) return <LandingPage onLaunch={() => setShowApp(true)} />;
  return <App />;
}
