import { useState, useEffect } from "react";
import RoleSelect from "./pages/RoleSelect";
import BrandSignup from "./pages/BrandSignup";
import CreatorSignup from "./pages/CreatorSignup";
import Login from "./pages/Login";
import BrandDashboard from "./pages/BrandDashboard";
import CreatorDashboard from "./pages/CreatorDashboard";
import CreatorProfile from "./pages/CreatorProfile";
import BrandProfile from "./pages/BrandProfile";
import Explore from "./pages/Explore";
import Messages from "./pages/Messages";
import Search from "./pages/Search";
import { supabase } from "./lib/supabase";

export type Page = "role-select" | "brand-signup" | "creator-signup" | "login" | "brand-dashboard" | "creator-dashboard" | "creator-profile" | "brand-profile" | "explore" | "messages-creator" | "messages-brand" | "search-creator";

const CREATOR_PAGES: Page[] = ["creator-dashboard", "explore", "messages-creator", "search-creator", "creator-profile"];

function CreatorNav({ page, navigate }: { page: Page; navigate: (p: Page) => void }) {
  return (
    <div style={{ borderTop: "1px solid #111", display: "flex", padding: "1rem 0", background: "#0a0a0a", position: "fixed", bottom: 0, width: "100%", zIndex: 100 }}>
      <div onClick={() => navigate("explore")} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", cursor: "pointer" }}>
        <span style={{ fontSize: "20px" }}>◎</span>
        <span style={{ fontSize: "10px", color: page === "explore" ? "#fff" : "#444", letterSpacing: "0.08em", textTransform: "uppercase" }}>Explore</span>
      </div>
      <div onClick={() => navigate("search-creator")} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", cursor: "pointer" }}>
        <span style={{ fontSize: "20px" }}>🔍</span>
        <span style={{ fontSize: "10px", color: page === "search-creator" ? "#fff" : "#444", letterSpacing: "0.08em", textTransform: "uppercase" }}>Search</span>
      </div>
      <div onClick={() => navigate("messages-creator")} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", cursor: "pointer" }}>
        <span style={{ fontSize: "20px" }}>💬</span>
        <span style={{ fontSize: "10px", color: page === "messages-creator" ? "#fff" : "#444", letterSpacing: "0.08em", textTransform: "uppercase" }}>Messages</span>
      </div>
      <div onClick={() => navigate("creator-profile")} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", cursor: "pointer" }}>
        <span style={{ fontSize: "20px" }}>◉</span>
        <span style={{ fontSize: "10px", color: page === "creator-profile" ? "#fff" : "#444", letterSpacing: "0.08em", textTransform: "uppercase" }}>Profile</span>
      </div>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>("role-select");
  const [loading, setLoading] = useState(true);

  const navigate = (p: Page) => setPage(p);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();

        if (profile?.role === "brand") setPage("brand-dashboard");
        else if (profile?.role === "creator") setPage("explore");
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "SIGNED_OUT") setPage("role-select");
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#333", fontSize: "13px", fontFamily: "'DM Sans', sans-serif" }}>Loading...</p>
      </div>
    );
  }

  const renderPage = () => {
    switch (page) {
      case "role-select": return <RoleSelect navigate={navigate} />;
      case "brand-signup": return <BrandSignup navigate={navigate} />;
      case "creator-signup": return <CreatorSignup navigate={navigate} />;
      case "login": return <Login navigate={navigate} />;
      case "brand-dashboard": return <BrandDashboard navigate={navigate} />;
      case "creator-dashboard": return <CreatorDashboard navigate={navigate} />;
      case "creator-profile": return <CreatorProfile navigate={navigate} />;
      case "brand-profile": return <BrandProfile navigate={navigate} />;
      case "explore": return <Explore navigate={navigate} />;
      case "messages-creator": return <Messages navigate={navigate} role="creator" />;
      case "messages-brand": return <Messages navigate={navigate} role="brand" />;
      case "search-creator": return <Search navigate={navigate} />;
      default: return <RoleSelect navigate={navigate} />;
    }
  };

  return (
    <div>
      {renderPage()}
      {CREATOR_PAGES.includes(page) && <CreatorNav page={page} navigate={navigate} />}
    </div>
  );
}