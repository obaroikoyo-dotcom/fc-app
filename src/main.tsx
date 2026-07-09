import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// A window.location.reload() here to "recover" from a stuck page is
// actually risky: right after returning to the foreground, the network
// connection often hasn't reconnected yet, and a browser-level navigation
// has no timeout of its own - if it fires while offline it just hangs with
// a blank screen and nothing to show, which is worse than what it was
// meant to fix. Recovery now happens per-page instead, via
// useRefetchOnVisible, which retries data fetches (not a full navigation)
// and is bounded by withTimeout.

// Separately: standalone PWAs on iOS run in a WKWebView, which can lose its
// GPU compositor while backgrounded and fail to repaint on return - the
// content is fine underneath, the screen just isn't being redrawn. This
// shows up as a black screen on returning from *any* other app, not tied to
// a specific link or loading state. Force a reflow on every visibility
// return to make sure the browser actually repaints.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    const el = document.body;
    el.style.display = "none";
    void el.offsetHeight; // reading layout forces the reflow
    el.style.display = "";
  }
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);