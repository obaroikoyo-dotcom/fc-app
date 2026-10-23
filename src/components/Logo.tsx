import logo from "../assets/logo.png";

export default function Logo() {
  return (
    <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
      <img src={logo} alt="FlipCollab" className="theme-logo" style={{ width: "150px", display: "block", margin: "0 auto 1rem" }} />
      <p style={{
        fontFamily: "'TikTok Sans', sans-serif",
        fontSize: "22px",
        fontWeight: 800,
        color: "var(--t-fff)",
        letterSpacing: "-0.02em",
        margin: 0,
      }}>
        FlipCollab
      </p>
    </div>
  );
}