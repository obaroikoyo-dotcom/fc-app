import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Returning to a standalone PWA after it handed off to Safari (e.g. an
// external link) can restore a frozen bfcache snapshot instead of properly
// reactivating the page - taps still fire and network calls still complete,
// but nothing repaints. Force a real reload whenever that happens.
window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    window.location.reload();
  }
});

// pageshow/bfcache is a browser back-forward navigation concept and isn't
// guaranteed to fire when iOS backgrounds a standalone PWA (e.g. handing off
// to Safari for an external link, then switching back via the app switcher).
// visibilitychange is the reliable cross-platform signal for "app came back
// to the foreground" regardless of how it left. If it was hidden long enough
// to plausibly have been suspended, force a reload rather than risk a frozen
// page - a brief tab switch won't cross the threshold.
let hiddenAt: number | null = null;
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    hiddenAt = Date.now();
  } else if (document.visibilityState === "visible" && hiddenAt !== null) {
    const hiddenForMs = Date.now() - hiddenAt;
    hiddenAt = null;
    if (hiddenForMs > 8000) {
      window.location.reload();
    }
  }
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);