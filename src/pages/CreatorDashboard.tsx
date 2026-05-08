import { type Page } from "../App";

interface Props { navigate: (p: Page) => void; }

export default function CreatorDashboard({ navigate }: Props) {
  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');`}</style>

      {/* Top Nav */}
      <div style={{ padding: "1rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #111" }}>
        <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff" }}>FlipCollab</span>
        <span onClick={() => navigate("role-select")} style={{ fontSize: "12px", color: "#555", cursor: "pointer" }}>Sign out</span>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem 1.25rem", textAlign: "center", paddingBottom: "6rem" }}>
        <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "20px", fontWeight: 800, color: "#fff", marginBottom: "8px" }}>Welcome back</p>
        <p style={{ fontSize: "13px", color: "#444" }}>Explore brand campaigns or update your profile.</p>
        <div onClick={() => navigate("explore")} style={{ marginTop: "2rem", padding: "13px 2rem", background: "#fff", color: "#0a0a0a", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Browse Campaigns
        </div>
      </div>

    </div>
  );
}