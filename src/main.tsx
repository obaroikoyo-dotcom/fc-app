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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);