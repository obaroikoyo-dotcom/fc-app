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
const BRAND_PAGES: Page[] = ["brand-dashboard", "messages-brand", "brand-profile"];

function CreatorNav({ page, navigate }: { page: Page; navigate: (p: Page) => void }) {
  const activeColor = "#fff";
  const inactiveColor = "#444";

  return (
    <div style={{ borderTop: "1px solid #111", display: "flex", padding: "0.75rem 0", background: "#0a0a0a", position: "fixed", bottom: 0, width: "100%", zIndex: 100 }}>
      <div onClick={() => navigate("explore")} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", cursor: "pointer" }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke={page === "explore" ? activeColor : inactiveColor} strokeWidth="2"/>
          <polygon points="10,14 14,10 13,15 9,13" fill={page === "explore" ? activeColor : inactiveColor}/>
        </svg>
        <span style={{ fontSize: "10px", color: page === "explore" ? activeColor : inactiveColor, letterSpacing: "0.08em", textTransform: "uppercase" }}>Explore</span>
      </div>
      <div onClick={() => navigate("search-creator")} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", cursor: "pointer" }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="7" stroke={page === "search-creator" ? activeColor : inactiveColor} strokeWidth="2"/>
          <line x1="16.65" y1="16.65" x2="21" y2="21" stroke={page === "search-creator" ? activeColor : inactiveColor} strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <span style={{ fontSize: "10px", color: page === "search-creator" ? activeColor : inactiveColor, letterSpacing: "0.08em", textTransform: "uppercase" }}>Search</span>
      </div>
      <div onClick={() => navigate("messages-creator")} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", cursor: "pointer" }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M21 11.5C21 16.1944 16.9706 20 12 20C10.2832 20 8.68732 19.5586 7.33333 18.8L3 20L4.26667 16.2C3.46667 14.8333 3 13.2333 3 11.5C3 6.80558 7.02944 3 12 3C16.9706 3 21 6.80558 21 11.5Z"
            stroke={page === "messages-creator" ? activeColor : inactiveColor} strokeWidth="2" strokeLinejoin="round"/>
        </svg>
        <span style={{ fontSize: "10px", color: page === "messages-creator" ? activeColor : inactiveColor, letterSpacing: "0.08em", textTransform: "uppercase" }}>Messages</span>
      </div>
      <div onClick={() => navigate("creator-profile")} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", cursor: "pointer" }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8" r="4" stroke={page === "creator-profile" ? activeColor : inactiveColor} strokeWidth="1.8"/>
          <path d="M4 20C4 16.6863 7.58172 14 12 14C16.4183 14 20 16.6863 20 20"
            stroke={page === "creator-profile" ? activeColor : inactiveColor} strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
        <span style={{ fontSize: "10px", color: page === "creator-profile" ? activeColor : inactiveColor, letterSpacing: "0.08em", textTransform: "uppercase" }}>Profile</span>
      </div>
    </div>
  );
}

function BrandNav({ page, navigate, tab, setTab }: { page: Page; navigate: (p: Page) => void; tab: string; setTab: (t: "campaigns" | "post") => void }) {
  const activeColor = "#fff";
  const inactiveColor = "#444";

  const campaignsActive = page === "brand-dashboard" && tab === "campaigns";
  const postActive = page === "brand-dashboard" && tab === "post";
  const messagesActive = page === "messages-brand";
  const profileActive = page === "brand-profile";

  return (
    <div style={{ borderTop: "1px solid #111", display: "flex", padding: "0.75rem 0", background: "#0a0a0a", position: "fixed", bottom: 0, width: "100%", zIndex: 100 }}>
      <div onClick={() => { navigate("brand-dashboard"); setTab("campaigns"); }} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", cursor: "pointer" }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="7" height="7" rx="1" stroke={campaignsActive ? activeColor : inactiveColor} strokeWidth="1.8"/>
          <rect x="14" y="3" width="7" height="7" rx="1" stroke={campaignsActive ? activeColor : inactiveColor} strokeWidth="1.8"/>
          <rect x="3" y="14" width="7" height="7" rx="1" stroke={campaignsActive ? activeColor : inactiveColor} strokeWidth="1.8"/>
          <rect x="14" y="14" width="7" height="7" rx="1" stroke={campaignsActive ? activeColor : inactiveColor} strokeWidth="1.8"/>
        </svg>
        <span style={{ fontSize: "10px", color: campaignsActive ? activeColor : inactiveColor, letterSpacing: "0.08em", textTransform: "uppercase" }}>Campaigns</span>
      </div>
      <div onClick={() => navigate("messages-brand")} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", cursor: "pointer" }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M21 11.5C21 16.1944 16.9706 20 12 20C10.2832 20 8.68732 19.5586 7.33333 18.8L3 20L4.26667 16.2C3.46667 14.8333 3 13.2333 3 11.5C3 6.80558 7.02944 3 12 3C16.9706 3 21 6.80558 21 11.5Z"
            stroke={messagesActive ? activeColor : inactiveColor} strokeWidth="2" strokeLinejoin="round"/>
        </svg>
        <span style={{ fontSize: "10px", color: messagesActive ? activeColor : inactiveColor, letterSpacing: "0.08em", textTransform: "uppercase" }}>Messages</span>
      </div>
      <div onClick={() => { navigate("brand-dashboard"); setTab("post"); }} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", cursor: "pointer" }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <line x1="12" y1="5" x2="12" y2="19" stroke={postActive ? activeColor : inactiveColor} strokeWidth="2" strokeLinecap="round"/>
          <line x1="5" y1="12" x2="19" y2="12" stroke={postActive ? activeColor : inactiveColor} strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <span style={{ fontSize: "10px", color: postActive ? activeColor : inactiveColor, letterSpacing: "0.08em", textTransform: "uppercase" }}>Post</span>
      </div>
      <div onClick={() => navigate("brand-profile")} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", cursor: "pointer" }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8" r="4" stroke={profileActive ? activeColor : inactiveColor} strokeWidth="1.8"/>
          <path d="M4 20C4 16.6863 7.58172 14 12 14C16.4183 14 20 16.6863 20 20"
            stroke={profileActive ? activeColor : inactiveColor} strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
        <span style={{ fontSize: "10px", color: profileActive ? activeColor : inactiveColor, letterSpacing: "0.08em", textTransform: "uppercase" }}>Profile</span>
      </div>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>("role-select");
  const [loading, setLoading] = useState(true);
  const [brandTab, setBrandTab] = useState<"campaigns" | "post">("campaigns");

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
      case "brand-dashboard": return <BrandDashboard navigate={navigate} tab={brandTab} setTab={setBrandTab} />;
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
      {BRAND_PAGES.includes(page) && <BrandNav page={page} navigate={navigate} tab={brandTab} setTab={setBrandTab} />}
    </div>
  );
}