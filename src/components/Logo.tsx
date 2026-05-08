export default function Logo() {
  return (
    <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
      {/* Replace src with FlipCollab logo path when ready */}
      <img
        src=""
        alt="FlipCollab"
        style={{ height: "40px", display: "none" }}
        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
      <span style={{
        fontFamily: "'Syne', sans-serif",
        fontSize: "26px",
        fontWeight: 800,
        color: "#fff",
        letterSpacing: "-0.02em",
      }}>
        Flip<span style={{ color: "#fff", opacity: 0.4 }}>Collab</span>
      </span>
    </div>
  );
}