import AboutPage from "./pages/AboutPage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import TermsPage from "./pages/TermsPage";
import SplashScreen from "./pages/SplashScreen";
import BrandOnboarding from "./pages/BrandOnboarding";
import PublicProfile from "./pages/PublicProfile";
import CreatorOnboarding from "./pages/CreatorOnboarding";
import BrandPublicProfile from "./pages/BrandPublicProfile";
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
import Notifications from "./pages/Notifications"; 
import EnterpriseSubscriptionPage from "./pages/EnterpriseSubscriptionPage";
import ApplyCampaign from "./pages/ApplyCampaign";
import VerifyEmail from "./pages/VerifyEmail";
import { supabase } from "./lib/supabase";
import { withTimeout } from "./lib/withTimeout";
import { logEvent } from "./lib/debugLog";
import { peekOnboardingDraftRole } from "./lib/onboardingDraft";
import { peekGoogleLoginIntent, clearGoogleLoginIntent } from "./lib/authIntent";
import { initOneSignal, oneSignalLogin, oneSignalLogout } from "./lib/onesignal";
import { autoRequestPush } from "./lib/push";


export type Page = 
  | "splash"
  | "role-select" 
  | "brand-signup" 
  | "brand-onboarding" 
  | "creator-signup" 
  | "login" 
  | "brand-dashboard" 
  | "creator-dashboard" 
  | "creator-profile" 
  | "brand-profile" 
  | "explore" 
  | "messages-creator" 
  | "messages-brand" 
  | "search-creator" 
  | "search-brand" 
  | "public-profile" 
  | "creator-onboarding"
  | "brand-public-profile" 
  | "notifications-creator"
  | "notifications-brand"
  | "enterprise"
  | "apply-campaign"
  | "verify-email";

const CREATOR_PAGES: Page[] = ["creator-dashboard", "explore", "messages-creator", "search-creator", "creator-profile", "notifications-creator", "brand-public-profile", "apply-campaign"];
const BRAND_PAGES: Page[] = ["brand-dashboard", "search-brand", "messages-brand", "brand-profile", "notifications-brand"];


interface NavProps {
  page: Page;
  navigate: (p: Page) => void;
  isInverted: boolean;
  unreadCount?: number;
}

function CreatorNav({ page, navigate, isInverted, unreadCount = 0 }: NavProps) {
  const activeColor = isInverted ? "#0a0a0a" : "#fff";
  const inactiveColor = isInverted ? "#a3a3a3" : "#444";
  const bgColor = isInverted ? "#ffffff" : "#0a0a0a";
  const borderColor = isInverted ? "#e5e5e5" : "#111";

  return (
    <div style={{ borderTop: `1px solid ${borderColor}`, display: "flex", padding: "0.5rem 0 calc(0.375rem + env(safe-area-inset-bottom, 0px)) 0", background: bgColor, position: "fixed", bottom: 0, width: "100%", zIndex: 100, filter: isInverted ? "invert(1) hue-rotate(180deg)" : "none", transition: "background 0.2s ease, border-color 0.2s ease" }}>
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
      
      <div onClick={() => navigate("messages-creator")} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", cursor: "pointer", position: "relative" }}>
        <div style={{ position: "relative" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M21 11.5C21 16.1944 16.9706 20 12 20C10.2832 20 8.68732 19.5586 7.33333 18.8L3 20L4.26667 16.2C3.46667 14.8333 3 13.2333 3 11.5C3 6.80558 7.02944 3 12 3C16.9706 3 21 6.80558 21 11.5Z"
              stroke={page === "messages-creator" || page === "notifications-creator" ? activeColor : inactiveColor} strokeWidth="2" strokeLinejoin="round"/>
          </svg>
          {unreadCount > 0 && (
            <div style={{ position: "absolute", top: "-2px", right: "-4px", width: "8px", height: "8px", borderRadius: "50%", background: "#ff3b30", border: `2px solid ${bgColor}` }} />
          )}
        </div>
        <span style={{ fontSize: "10px", color: page === "messages-creator" || page === "notifications-creator" ? activeColor : inactiveColor, letterSpacing: "0.08em", textTransform: "uppercase" }}>Messages</span>
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

interface BrandNavProps extends NavProps {
  tab: string;
  setTab: (t: "campaigns" | "post") => void;
  setViewingProfileId: (id: string | null) => void;
}

function BrandNav({ page, navigate, tab, setTab, setViewingProfileId, isInverted, unreadCount = 0 }: BrandNavProps) {
  const activeColor = isInverted ? "#0a0a0a" : "#fff";
  const inactiveColor = isInverted ? "#a3a3a3" : "#444";
  const bgColor = isInverted ? "#ffffff" : "#0a0a0a";
  const borderColor = isInverted ? "#e5e5e5" : "#111";

  const campaignsActive = page === "brand-dashboard" && tab === "campaigns";
  const postActive = page === "brand-dashboard" && tab === "post";
  const searchActive = page === "search-brand";
  const messagesActive = page === "messages-brand" || page === "notifications-brand";
  const profileActive = page === "brand-profile";

  return (
    <div style={{ borderTop: `1px solid ${borderColor}`, display: "flex", padding: "0.5rem 0 calc(0.375rem + env(safe-area-inset-bottom, 0px)) 0", background: bgColor, position: "fixed", bottom: 0, width: "100%", zIndex: 100, filter: isInverted ? "invert(1) hue-rotate(180deg)" : "none", touchAction: "manipulation", transition: "background 0.2s ease, border-color 0.2s ease" }}>
      <div onClick={() => { setViewingProfileId(null); navigate("brand-dashboard"); setTab("campaigns"); }} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", cursor: "pointer" }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="7" height="7" rx="1" stroke={campaignsActive ? activeColor : inactiveColor} strokeWidth="1.8"/>
          <rect x="14" y="3" width="7" height="7" rx="1" stroke={campaignsActive ? activeColor : inactiveColor} strokeWidth="1.8"/>
          <rect x="3" y="14" width="7" height="7" rx="1" stroke={campaignsActive ? activeColor : inactiveColor} strokeWidth="1.8"/>
          <rect x="14" y="14" width="7" height="7" rx="1" stroke={campaignsActive ? activeColor : inactiveColor} strokeWidth="1.8"/>
        </svg>
        <span style={{ fontSize: "9px", color: campaignsActive ? activeColor : inactiveColor, letterSpacing: "0.04em", textTransform: "uppercase" }}>Campaigns</span>
      </div>
      <div onClick={() => { setViewingProfileId(null); navigate("search-brand"); }} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", cursor: "pointer" }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="7" stroke={searchActive ? activeColor : inactiveColor} strokeWidth="2"/>
          <line x1="16.65" y1="16.65" x2="21" y2="21" stroke={searchActive ? activeColor : inactiveColor} strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <span style={{ fontSize: "10px", color: searchActive ? activeColor : inactiveColor, letterSpacing: "0.04em", textTransform: "uppercase" }}>Search</span>
      </div>

      <div onClick={() => { setViewingProfileId(null); navigate("messages-brand"); }} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", cursor: "pointer", position: "relative" }}>
        <div style={{ position: "relative" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M21 11.5C21 16.1944 16.9706 20 12 20C10.2832 20 8.68732 19.5586 7.33333 18.8L3 20L4.26667 16.2C3.46667 14.8333 3 13.2333 3 11.5C3 6.80558 7.02944 3 12 3C16.9706 3 21 6.80558 21 11.5Z"
              stroke={messagesActive ? activeColor : inactiveColor} strokeWidth="2" strokeLinejoin="round"/>
          </svg>
          {unreadCount > 0 && (
            <div style={{ position: "absolute", top: "-2px", right: "-4px", width: "8px", height: "8px", borderRadius: "50%", background: "#ff3b30", border: `2px solid ${bgColor}` }} />
          )}
        </div>
        <span style={{ fontSize: "10px", color: messagesActive ? activeColor : inactiveColor, letterSpacing: "0.04em", textTransform: "uppercase" }}>Messages</span>
      </div>

      <div onClick={() => { setViewingProfileId(null); navigate("brand-dashboard"); setTab("post"); }} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", cursor: "pointer" }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <line x1="12" y1="5" x2="12" y2="19" stroke={postActive ? activeColor : inactiveColor} strokeWidth="2" strokeLinecap="round"/>
          <line x1="5" y1="12" x2="19" y2="12" stroke={postActive ? activeColor : inactiveColor} strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <span style={{ fontSize: "10px", color: postActive ? activeColor : inactiveColor, letterSpacing: "0.04em", textTransform: "uppercase" }}>Post</span>
      </div>
      <div onClick={() => { setViewingProfileId(null); navigate("brand-profile"); }} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", cursor: "pointer" }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8" r="4" stroke={profileActive ? activeColor : inactiveColor} strokeWidth="1.8"/>
          <path d="M4 20C4 16.6863 7.58172 14 12 14C16.4183 14 20 16.6863 20 20"
            stroke={profileActive ? activeColor : inactiveColor} strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
        <span style={{ fontSize: "10px", color: profileActive ? activeColor : inactiveColor, letterSpacing: "0.04em", textTransform: "uppercase" }}>Profile</span>
      </div>
    </div>
  );
}

export default function App() {
  const subdomain = window.location.hostname.split(".")[0];
  if (subdomain === "about") return <AboutPage />;
  if (subdomain === "privacy") return <PrivacyPolicyPage />;
  if (subdomain === "terms") return <TermsPage />;

  const [page, setPage] = useState<Page>("splash");
  const [, setHistory] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [brandTab, setBrandTab] = useState<"campaigns" | "post">("campaigns");
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);
  const [viewingBrandId, setViewingBrandId] = useState<string | null>(null); 
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [openConvoId, setOpenConvoId] = useState<string | null>(null);
  const [applyingCampaignId, setApplyingCampaignId] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string>("");
  
  const [isInverted, setIsInverted] = useState<boolean>(() => {  
    return localStorage.getItem("theme") === "inverted";
  });

  const toggleTheme = () => {  
    setIsInverted(prev => {    
      const next = !prev;    
      localStorage.setItem("theme", next ? "inverted" : "normal");    
      return next;  
    });
  };

  const navigate = (p: Page) => {
  setHistory(prev => [...prev, page]);
  setPage(p);
  window.scrollTo(0, 0);
};

  const goBack = () => {
  setHistory(prev => {
    const newHistory = [...prev];
    const last = newHistory.pop();
    if (last) setPage(last);
    return newHistory;
  });
  window.scrollTo(0, 0);
};

  const navigateToMessages = (p: "messages-creator" | "messages-brand", convoId: string) => {
    setOpenConvoId(convoId);
    navigate(p);
  };

  const navigateToProfile = (id: string) => {
    setViewingProfileId(id);
    setPage("public-profile");
  };

  const navigateToBrandProfile = (id: string) => {
    setViewingBrandId(id);
    navigate("brand-public-profile"); 
  };

  const fetchGlobalUnreadCount = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("read", false);

    if (!error && count !== null) {
      setUnreadCount(count);
    }
  };

  const syncUserRoute = async (userId: string) => {
    try {
      await withTimeout(async () => {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .maybeSingle();

        logEvent(`syncUserRoute: userId=${userId.slice(0, 8)} profileFound=${!!profile} role=${profile?.role ?? "n/a"} error=${profileError?.message ?? "none"}`);

        if (profileError || !profile) {
          // A Google sign-in attempt from the Login page (as opposed to an
          // onboarding page) means the user believes they already have an
          // account - a missing profile row here means they don't, and
          // Login.tsx handles telling them that and signing the phantom
          // session back out itself. Stay out of its way rather than
          // routing to role-select first.
          if (peekGoogleLoginIntent()) {
            logEvent("syncUserRoute: no profile, Google login-intent flag set - deferring to Login page");
            return;
          }

          // No profile row yet. Email/password signups are mid-onboarding at
          // this point (authenticated post-OTP, but handleFinish hasn't run
          // yet) - their own wizard's local state carries them through, so
          // leave them alone. OAuth sign-ins land here with no wizard
          // in progress at all and need to be routed - back to the same
          // onboarding wizard they left (if they clicked "Continue with
          // Google" mid-onboarding - see src/lib/onboardingDraft.ts), or to
          // role selection for a first-touch sign-in.
          const { data: { user } } = await supabase.auth.getUser();
          const provider = user?.app_metadata?.provider;
          if (provider && provider !== "email") {
            const pendingRole = peekOnboardingDraftRole();
            logEvent(`syncUserRoute: no profile, provider=${provider}, pendingDraftRole=${pendingRole ?? "none"} -> routing to ${pendingRole ? pendingRole + "-onboarding" : "role-select"}`);
            if (pendingRole === "brand") setPage("brand-onboarding");
            else if (pendingRole === "creator") setPage("creator-onboarding");
            else setPage("role-select");
          } else {
            logEvent(`syncUserRoute: no profile, provider=${provider ?? "none"} (email/password mid-signup) - leaving page as-is`);
          }
          return;
        }

        if (profile.role === "brand") {
          const { data: brandProfile } = await supabase
            .from("brand_profiles")
            .select("onboarding_complete")
            .eq("id", userId)
            .maybeSingle();

          if (brandProfile?.onboarding_complete) {
            setPage("brand-dashboard");
          } else {
            setPage("brand-onboarding");
          }
        } else if (profile.role === "creator") {
          const { data: creatorProfile } = await supabase
            .from("creator_profiles")
            .select("onboarding_complete")
            .eq("id", userId)
            .maybeSingle();

          if (creatorProfile?.onboarding_complete) {
            setPage("explore");
          } else {
            setPage("creator-onboarding");
          }
        } else {
          setPage("role-select");
        }
      }, 10000, "App.syncUserRoute");
    } catch (err) {
      console.log("Routing error:", err);
      logEvent(`App.syncUserRoute failed: ${(err as Error)?.message || err} - falling back to role-select`);
      setPage("role-select");
    }
  };

  useEffect(() => {
    initOneSignal();
  }, []);

  useEffect(() => {
    let isMounted = true;
    let lastAuthUserId: string | null = null;

    const fallbackTimeout = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 3500);

    const initializeAuth = async () => {
      try {
        const sessionPromise = withTimeout(() => supabase.auth.getSession(), 10000, "App.initializeAuth.getSession");
        const minSplashDuration = new Promise<void>(resolve => setTimeout(resolve, 3000));

        const { data: { session } } = await sessionPromise;
        if (!isMounted) return;

        logEvent(`initializeAuth: hasSession=${!!session} provider=${session?.user?.app_metadata?.provider ?? "n/a"} emailConfirmed=${!!session?.user?.email_confirmed_at}`);

        // Don't swap away from the splash page until its own animation
        // has had time to finish, but don't add this on top of network time.
        await minSplashDuration;
        if (!isMounted) return;

        if (session?.user) {
          if (!session.user.email_confirmed_at) {
            setPendingEmail(session.user.email || "");
            setPage("verify-email");
          } else {
            lastAuthUserId = session.user.id;
            oneSignalLogin(session.user.id);
            setTimeout(() => autoRequestPush(session.user.id), 3000);
            await syncUserRoute(session.user.id);
            fetchGlobalUnreadCount();
          }
        } else {
          setPage("role-select");
        }
      } catch (e) {
        console.log("Auth catch error:", e);
        logEvent(`App.initializeAuth failed: ${(e as Error)?.message || e} - falling back to role-select`);
        if (isMounted) setPage("role-select");
      } finally {
        if (isMounted) {
          clearTimeout(fallbackTimeout);
          setLoading(false);
        }
      }
    };

    initializeAuth();

    const channel = supabase
      .channel("global-nav-counter")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => {
        if (isMounted) fetchGlobalUnreadCount();
      })
      .subscribe();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      logEvent(`onAuthStateChange: event=${event} hasSession=${!!session} provider=${session?.user?.app_metadata?.provider ?? "n/a"} emailConfirmed=${!!session?.user?.email_confirmed_at}`);
      if (!isMounted) return;

      if (event === "SIGNED_OUT") {
        lastAuthUserId = null;
        oneSignalLogout();
        setUnreadCount(0);
        setLoading(false);
        // Login.tsx signs the phantom "no account found" session back out
        // itself and shows its own error in place - it's already sitting on
        // the Login page, so don't yank it away to role-select.
        if (peekGoogleLoginIntent()) {
          clearGoogleLoginIntent();
        } else {
          setPage("role-select");
        }
      } else if (event === "SIGNED_IN" && session?.user) {
        // Supabase re-fires SIGNED_IN when the tab regains focus and the
        // client re-validates its session (e.g. switching back to the app)
        // - not just on an actual new login. Re-running the route sync for
        // the same user just re-navigates mid-use, freezing the UI for a
        // beat and then dropping whatever screen the user was on.
        if (lastAuthUserId === session.user.id) return;
        lastAuthUserId = session.user.id;

        if (!session.user.email_confirmed_at) {
          setPendingEmail(session.user.email || "");
          setPage("verify-email");
          setLoading(false);
          return;
        }
        oneSignalLogin(session.user.id);
        setTimeout(() => autoRequestPush(session.user.id), 3000);
        await syncUserRoute(session.user.id);
        fetchGlobalUnreadCount();
      } else if (event === "USER_UPDATED" && session?.user) {
        if (session.user.email_confirmed_at) {
          await syncUserRoute(session.user.id);
          fetchGlobalUnreadCount();
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      supabase.removeChannel(channel);
      clearTimeout(fallbackTimeout);
    };
  }, []);

  if (loading && page !== "splash") {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#333", fontSize: "13px", fontFamily: "'DM Sans', sans-serif" }}>Loading...</p>
      </div>
    );
  }

  const renderPage = () => {
    switch (page) {
      case "splash": return <SplashScreen navigate={navigate} />;
      case "role-select": return <RoleSelect navigate={navigate} />;
      case "brand-signup": return <BrandSignup navigate={navigate} />;
      case "brand-onboarding": return <BrandOnboarding navigate={navigate} setPendingEmail={setPendingEmail} />;
      case "creator-signup": return <CreatorSignup navigate={navigate} />;
      case "login": return <Login navigate={navigate} />;
      case "brand-dashboard": 
        return <BrandDashboard navigate={navigate} tab={brandTab} setTab={setBrandTab} navigateToProfile={navigateToProfile} />;
      case "creator-dashboard": return <CreatorDashboard navigate={navigate} />;
      case "creator-profile": 
        return (
          <CreatorProfile 
            navigate={navigate} 
            navigateToProfile={navigateToProfile}
            toggleTheme={toggleTheme}
            isInverted={isInverted}
          />
        );
      case "brand-profile": 
  return (
    <BrandProfile 
      navigate={navigate} 
      toggleTheme={toggleTheme} 
      isInverted={isInverted} 
    />
  );
      case "explore": return <Explore navigate={navigate} navigateToProfile={navigateToBrandProfile} navigateToApply={(id) => { setApplyingCampaignId(id); navigate("apply-campaign"); }} />;
      case "messages-creator": return <Messages navigate={navigate} role="creator" navigateToProfile={navigateToProfile} navigateToBrandProfile={navigateToBrandProfile} openConvoId={openConvoId} onConvoOpened={() => setOpenConvoId(null)} onRead={fetchGlobalUnreadCount} />;
      case "messages-brand": return <Messages navigate={navigate} role="brand" navigateToProfile={navigateToProfile} navigateToBrandProfile={navigateToBrandProfile} openConvoId={openConvoId} onConvoOpened={() => setOpenConvoId(null)} onRead={fetchGlobalUnreadCount} />;
      case "notifications-creator":
case "notifications-brand":
  return <Notifications navigate={navigate} onRead={fetchGlobalUnreadCount} />;
case "enterprise":
  return <EnterpriseSubscriptionPage navigate={navigate} />;
case "apply-campaign":
  console.log("apply-campaign route hit, id:", applyingCampaignId);
  return <ApplyCampaign navigate={navigate} campaignId={applyingCampaignId || ""} goBack={goBack} />;
      case "search-creator":
      case "search-brand": 
        return <Search navigate={navigate} navigateToProfile={navigateToProfile} navigateToMessages={navigateToMessages} />;
      case "public-profile": {
        return (
          <PublicProfile 
            navigate={navigate} 
            profileId={viewingProfileId || ""} 
            goBack={goBack}
            navigateToMessages={navigateToMessages}
          />
        );
      }
      case "verify-email": return <VerifyEmail navigate={navigate} email={pendingEmail} />;
      case "creator-onboarding": return <CreatorOnboarding navigate={navigate} setPendingEmail={setPendingEmail} />;
      case "brand-public-profile": return <BrandPublicProfile navigate={navigate} profileId={viewingBrandId || ""} goBack={goBack} />; 
    }
  };

  return (
    <div style={{ filter: isInverted ? "invert(1) hue-rotate(180deg)" : "none", transition: "filter 0.2s ease", height: "100vh", overflow: "hidden" }}>
      <style>{`
  ${isInverted ? `img { filter: invert(1) hue-rotate(180deg); } img.no-reinvert { filter: none; }` : ""}
  @keyframes pageEnter {
  from { opacity: 0; transform: translateX(18px); }
  to { opacity: 1; transform: translateX(0); }
}
  .page-enter {
    animation: pageEnter 0.18s ease-out;
  }
  @keyframes itemEnter {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .item-enter {
    animation: itemEnter 0.28s ease-out backwards;
  }
`}</style>
     <div key={page} className="page-enter" style={{ height: "100%", overflowY: "auto", overflowX: "hidden", overscrollBehavior: "contain" }}>
  {renderPage()}
</div>
      {CREATOR_PAGES.includes(page) && (
        <CreatorNav page={page} navigate={navigate} isInverted={isInverted} unreadCount={unreadCount} />
      )}
      {BRAND_PAGES.includes(page) && (
        <BrandNav page={page} navigate={navigate} tab={brandTab} setTab={setBrandTab} setViewingProfileId={setViewingProfileId} isInverted={isInverted} unreadCount={unreadCount} />
      )}
    </div>
  );
}