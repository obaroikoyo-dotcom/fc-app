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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);