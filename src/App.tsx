import { useState } from "react";
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

export type Page = "role-select" | "brand-signup" | "creator-signup" | "login" | "brand-dashboard" | "creator-dashboard" | "creator-profile" | "brand-profile" | "explore" | "messages-creator" | "messages-brand" | "search-creator";

export default function App() {
  const [page, setPage] = useState<Page>("role-select");
  const navigate = (p: Page) => setPage(p);

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
}