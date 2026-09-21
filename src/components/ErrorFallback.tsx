// Shown instead of a blank screen if the app crashes while rendering. It sits
// outside the app's own theme wrapper, so it reads the saved theme itself.
export default function ErrorFallback() {
  let light = false;
  try {
    light = localStorage.getItem("theme") === "inverted";
  } catch {
    // storage unavailable - fall back to the default dark look
  }
  const bg = light ? "#ffffff" : "#0a0a0a";
  const fg = light ? "#0a0a0a" : "#ffffff";
  const muted = light ? "#666666" : "#999999";

  return (
    <div
      role="alert"
      style={{
        minHeight: "100vh",
        background: bg,
        color: fg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        textAlign: "center",
        fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
      }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');`}</style>
      <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "22px", fontWeight: 800, marginBottom: "0.75rem" }}>
        Something went wrong
      </p>
      <p style={{ fontSize: "13px", color: muted, lineHeight: 1.7, maxWidth: "320px", marginBottom: "1.5rem" }}>
        The app hit a problem it couldn't recover from. Reloading usually fixes it.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{
          padding: "12px 24px",
          borderRadius: "8px",
          border: "none",
          background: fg,
          color: bg,
          fontSize: "13px",
          fontWeight: 600,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        Reload
      </button>
    </div>
  );
}
