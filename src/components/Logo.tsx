import logo from "../assets/logo.png";

export default function Logo() {
  return (
    <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
      <img src={logo} alt="FlipCollab" className="no-reinvert" style={{ width: "150px", display: "block", margin: "0 auto 1rem" }} />
      <p style={{
        fontFamily: "'Syne', sans-serif",
        fontSize: "22px",
        fontWeight: 800,
        color: "#fff",
        letterSpacing: "-0.02em",
        margin: 0,
      }}>
        FlipCollab
      </p>
    </div>
  );
}