import { useState, useEffect, useRef } from "react";
import { type Page } from "../App";
import { supabase } from "../lib/supabase";

interface Props {
  navigate: (p: Page) => void;
  role: "brand" | "creator";
  navigateToProfile?: (id: string) => void;
}

interface Conversation {
  id: string;
  participant_1: string;
  participant_2: string;
  last_message: string;
  last_message_at: string;
  other_name?: string;
  other_role?: string;
  other_avatar?: string;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  text: string;
  created_at: string;
}

interface Application {
  id: string;
  campaign_id: string;
  creator_id: string;
  message: string;
  platforms: string[];
  status: string;
  created_at: string;
  creator_name?: string;
  creator_avatar?: string;
  campaign_name?: string;
}

interface Campaign {
  id: string;
  name: string;
  applications: Application[];
}

export default function Messages({ navigate, role, navigateToProfile }: Props) {
  const [view, setView] = useState<"list" | "chat" | "campaign-apps" | "app-detail">("list");
  const [brandTab, setBrandTab] = useState<"applications" | "messages">("applications");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvo, setActiveConvo] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>("Someone");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);
  const [activeApplication, setActiveApplication] = useState<Application | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Track unread conversation IDs locally to place red dots on chats
  const [unreadConvoIds, setUnreadConvoIds] = useState<string[]>([]);
  
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversations();
    if (role === "brand") loadApplications();

    // Listen live for incoming notification rows to update badges instantly
    const channel = supabase
      .channel("messages-badge-sync")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, () => {
        fetchUnreadMessages();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // When opening a chat, automatically clear its unread status
  useEffect(() => {
    if (view === "chat" && activeConvo) {
      clearUnreadForConvo(activeConvo.id);
    }
  }, [view, activeConvo]);

  const loadConversations = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setCurrentUserId(user.id);

    const { data: myProfile } = await supabase
      .from("profiles")
      .select("creator_profiles(name), brand_profiles(name)")
      .eq("id", user.id)
      .single();
    if (myProfile) {
      const myName = (myProfile as any)?.creator_profiles?.name || (myProfile as any)?.brand_profiles?.name || "Someone";
      setCurrentUserName(myName);
    }

    const { data } = await supabase
      .from("conversations")
      .select("*")
      .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
      .order("last_message_at", { ascending: false });

    if (data) {
      const enriched = await Promise.all(data.map(async (c) => {
        const otherId = c.participant_1 === user.id ? c.participant_2 : c.participant_1;
        const { data: profile } = await supabase.from("profiles").select("role, creator_profiles(name, avatar_url), brand_profiles(name, avatar_url)").eq("id", otherId).single();
        const otherName = (profile as any)?.creator_profiles?.name || (profile as any)?.brand_profiles?.name || "Unknown";
        const otherAvatar = (profile as any)?.creator_profiles?.avatar_url || (profile as any)?.brand_profiles?.avatar_url || null;
        return { ...c, other_name: otherName, other_role: profile?.role, other_avatar: otherAvatar };
      }));
      setConversations(enriched);
    }
    fetchUnreadMessages(user.id);
    setLoading(false);
  };

  const fetchUnreadMessages = async (userId = currentUserId) => {
    if (!userId) return;
    const { data } = await supabase
      .from("notifications")
      .select("data")
      .eq("user_id", userId)
      .eq("type", "new_message")
      .eq("is_read", false);

    if (data) {
      const ids = data.map(n => n.data?.conversation_id).filter(Boolean);
      setUnreadConvoIds(ids);
    }
  };

  const clearUnreadForConvo = async (convoId: string) => {
    if (!currentUserId) return;
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", currentUserId)
      .eq("type", "new_message")
      .eq("is_read", false)
      .containedBy("data", { conversation_id: convoId });

    setUnreadConvoIds(prev => prev.filter(id => id !== convoId));
  };

  const loadApplications = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: campaignData } = await supabase
      .from("campaigns")
      .select("id, name")
      .eq("brand_id", user.id)
      .order("created_at", { ascending: false });

    if (!campaignData) return;

    const campaignsWithApps = await Promise.all(campaignData.map(async (camp) => {
      const { data: apps } = await supabase
        .from("applications")
        .select("*")
        .eq("campaign_id", camp.id)
        .order("created_at", { ascending: false });

      const enrichedApps = await Promise.all((apps || []).map(async (app) => {
        const { data: cp } = await supabase.from("creator_profiles").select("name, avatar_url").eq("id", app.creator_id).single();
        return { ...app, creator_name: cp?.name || "Creator", creator_avatar: cp?.avatar_url || null, campaign_name: camp.name };
      }));

      return { ...camp, applications: enrichedApps };
    }));

    setCampaigns(campaignsWithApps);
  };

  const openChat = async (convo: Conversation) => {
    setActiveConvo(convo);
    setView("chat");
    loadMessages(convo.id);

    supabase.channel(`convo-${convo.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${convo.id}` }, payload => {
        setMessages(prev => [...prev, payload.new as Message]);
      })
      .subscribe();
  };

  const loadMessages = async (convoId: string) => {
    const { data } = await supabase.from("messages").select("*").eq("conversation_id", convoId).order("created_at", { ascending: true });
    if (data) setMessages(data);
  };

  const send = async () => {
    if (!input.trim() || !activeConvo || !currentUserId) return;
    const text = input;
    setInput("");
    
    await supabase.from("messages").insert({ conversation_id: activeConvo.id, sender_id: currentUserId, text });
    await supabase.from("conversations").update({ last_message: text, last_message_at: new Date().toISOString() }).eq("id", activeConvo.id);

    const receiverId = activeConvo.participant_1 === currentUserId ? activeConvo.participant_2 : activeConvo.participant_1;

    await supabase.from("notifications").insert({
      user_id: receiverId,
      actor_id: currentUserId,
      type: "new_message",
      title: "New Message",
      body: `${currentUserName} sent you a message: "${text.substring(0, 40)}${text.length > 40 ? "..." : ""}"`,
      data: { conversation_id: activeConvo.id }
    });
  };

  const handleAccept = async (app: Application) => {
    setActionLoading(app.id);
    setActiveApplication(prev => prev ? { ...prev, status: "accepted" } : null);
    
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) { setActionLoading(null); return; }

    await supabase.from("applications").update({ status: "accepted" }).eq("id", app.id);

    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .or(`and(participant_1.eq.${userId},participant_2.eq.${app.creator_id}),and(participant_1.eq.${app.creator_id},participant_2.eq.${userId})`)
      .maybeSingle();

    const welcomeText = `🎉 Application Approved! You have been accepted for the campaign "${app.campaign_name}". Let's discuss deliverables!`;
    const nowTimestamp = new Date().toISOString();

    let targetConvoId = existing?.id || "";

    if (!existing) {
      const { data: newConvo } = await supabase
        .from("conversations")
        .insert({ 
          participant_1: userId, 
          participant_2: app.creator_id,
          last_message: welcomeText,
          last_message_at: nowTimestamp
        })
        .select()
        .single();
        
      if (newConvo) {
        targetConvoId = newConvo.id;
        await supabase.from("messages").insert({
          conversation_id: newConvo.id,
          sender_id: userId,
          text: welcomeText,
          created_at: nowTimestamp
        });
      }
    } else {
      await supabase.from("messages").insert({
        conversation_id: existing.id,
        sender_id: userId,
        text: welcomeText,
        created_at: nowTimestamp
      });
      await supabase.from("conversations").update({ 
        last_message: welcomeText, 
        last_message_at: nowTimestamp 
      }).eq("id", existing.id);
    }

    await supabase.from("notifications").insert({
      user_id: app.creator_id,
      actor_id: userId,
      type: "campaign_accepted",
      title: "Application Approved! 🎉",
      body: `${currentUserName} accepted your application for "${app.campaign_name}".`,
      data: { campaign_id: app.campaign_id, conversation_id: targetConvoId }
    });

    setActionLoading(null);
    await loadApplications();
    await loadConversations();
    setActiveCampaign(prev => prev ? {
      ...prev,
      applications: prev.applications.map(a => a.id === app.id ? { ...a, status: "accepted" } : a)
    } : null);
    setActiveApplication(prev => prev ? { ...prev, status: "accepted" } : null);
  };

  const handleReject = async (app: Application) => {
    setActionLoading(app.id);
    setActiveApplication(prev => prev ? { ...prev, status: "rejected" } : null);
    await supabase.from("applications").update({ status: "rejected" }).eq("id", app.id);
    setActionLoading(null);
    setActiveCampaign(prev => prev ? {
      ...prev,
      applications: prev.applications.map(a => a.id === app.id ? { ...a, status: "rejected" } : a)
    } : null);
    setActiveApplication(prev => prev ? { ...prev, status: "rejected" } : null);
  };

  const getHeader = () => {
    if (view === "chat") return activeConvo?.other_name;
    if (view === "campaign-apps") return activeCampaign?.name;
    if (view === "app-detail") return activeApplication?.creator_name;
    return "Messages";
  };

  const goBack = () => {
    if (view === "chat") { setView("list"); setActiveConvo(null); setMessages([]); }
    else if (view === "campaign-apps") setView("list");
    else if (view === "app-detail") setView("campaign-apps");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');`}</style>

      {/* Top Nav */}
      <div style={{ padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "12px", borderBottom: "1px solid #111" }}>
        {view !== "list" && (
          <span onClick={goBack} style={{ fontSize: "18px", color: "#555", cursor: "pointer" }}>←</span>
        )}
        
        {view === "chat" && activeConvo ? (
          <div 
            onClick={() => {
              const otherId = activeConvo.participant_1 === currentUserId ? activeConvo.participant_2 : activeConvo.participant_1;
              if (activeConvo.other_role === "creator") {
                if (navigateToProfile) {
                  navigateToProfile(otherId);
                } else {
                  navigate("public-profile" as any);
                }
              } else {
                navigate("brand-profile" as any);
              }
            }}
            style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}
          >
            <div style={{ width: "32px", height: "32px", borderRadius: activeConvo.other_role === "creator" ? "50%" : "12px", border: "1px solid #222", background: "#111", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", color: "#333", flexShrink: 0 }}>
              {activeConvo.other_avatar ? (
                <img src={activeConvo.other_avatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                activeConvo.other_role === "creator" ? "◉" : "◈"
              )}
            </div>
            <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff" }}>
              {activeConvo.other_name}
            </span>
          </div>
        ) : (
          <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff" }}>
            {getHeader()}
          </span>
        )}
      </div>

      {/* Brand Tabs Toggle */}
      {role === "brand" && view === "list" && (
        <div style={{ display: "flex", borderBottom: "1px solid #111" }}>
          <div onClick={() => setBrandTab("applications")} style={{ flex: 1, padding: "12px", textAlign: "center", cursor: "pointer", fontSize: "12px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: brandTab === "applications" ? "#fff" : "#444", borderBottom: brandTab === "applications" ? "2px solid #fff" : "2px solid transparent" }}>
            applications
          </div>
          <div onClick={() => setBrandTab("messages")} style={{ flex: 1, padding: "12px", textAlign: "center", cursor: "pointer", fontSize: "12px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: brandTab === "messages" ? "#fff" : "#444", borderBottom: brandTab === "messages" ? "2px solid #fff" : "2px solid transparent", position: "relative" }}>
            messages
            {/* RED NOTIFICATION DOT FOR THE BRAND MESSAGES SWITCHER TAB */}
            {unreadConvoIds.length > 0 && (
              <span style={{ display: "inline-block", width: "6px", height: "6px", background: "#ff3b30", borderRadius: "50%", marginLeft: "4px", verticalAlign: "middle" }} />
            )}
          </div>
        </div>
      )}

      {/* Applications Tab */}
      {role === "brand" && view === "list" && brandTab === "applications" && (
        <div style={{ flex: 1, overflowY: "auto", paddingBottom: "6rem" }}>
          {campaigns.length === 0 ? (
            <div style={{ textAlign: "center", padding: "4rem 2rem" }}>
              <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff", marginBottom: "8px" }}>No campaigns yet</p>
              <p style={{ fontSize: "13px", color: "#444" }}>Post a campaign to start receiving applications.</p>
            </div>
          ) : (
            campaigns.map(camp => (
              <div key={camp.id} onClick={() => { setActiveCampaign(camp); setView("campaign-apps"); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.25rem", borderBottom: "1px solid #111", cursor: "pointer" }}>
                <div>
                  <p style={{ color: "#fff", fontSize: "14px", fontWeight: 600, marginBottom: "4px" }}>{camp.name}</p>
                  <p style={{ color: "#444", fontSize: "12px" }}>{camp.applications.length} application{camp.applications.length !== 1 ? "s" : ""}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {camp.applications.filter(a => a.status === "pending").length > 0 && (
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#fff" }} />
                  )}
                  <span style={{ color: "#444", fontSize: "16px" }}>›</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Campaign Applications List */}
      {view === "campaign-apps" && activeCampaign && (
        <div style={{ flex: 1, overflowY: "auto", paddingBottom: "6rem" }}>
          {activeCampaign.applications.length === 0 ? (
            <div style={{ textAlign: "center", padding: "4rem 2rem" }}>
              <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff", marginBottom: "8px" }}>No applications yet</p>
              <p style={{ fontSize: "13px", color: "#444" }}>Share your campaign to get more creators applying.</p>
            </div>
          ) : (
            activeCampaign.applications.map(app => (
              <div key={app.id} onClick={() => { setActiveApplication(app); setView("app-detail"); }} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "1rem 1.25rem", borderBottom: "1px solid #111", cursor: "pointer" }}>
                <div style={{ width: "44px", height: "44px", borderRadius: "50%", border: "1px solid #222", background: "#111", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", color: "#333" }}>
                  {app.creator_avatar ? <img src={app.creator_avatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "◉"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                    <p style={{ color: "#fff", fontSize: "14px", fontWeight: 600 }}>{app.creator_name}</p>
                    <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "20px", border: `1px solid ${app.status === "accepted" ? "#fff" : app.status === "rejected" ? "#333" : "#555"}`, color: app.status === "accepted" ? "#fff" : app.status === "rejected" ? "#444" : "#777", textTransform: "uppercase" }}>
                      {app.status}
                    </span>
                  </div>
                  <p style={{ fontSize: "12px", color: "#444", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{app.message}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Application Detail */}
      {view === "app-detail" && activeApplication && (
        <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem 1.25rem", paddingBottom: "8rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "1.5rem" }}>
            <div style={{ width: "60px", height: "60px", borderRadius: "50%", border: "1px solid #333", background: "#111", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", color: "#333" }}>
              {activeApplication.creator_avatar ? <img src={activeApplication.creator_avatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "◉"}
            </div>
            <div>
              <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff" }}>{activeApplication.creator_name}</p>
              <p style={{ fontSize: "12px", color: "#444", marginTop: "2px" }}>Applied to {activeApplication.campaign_name}</p>
            </div>
          </div>

          <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "12px", padding: "1rem", marginBottom: "1.5rem" }}>
            <p style={{ fontSize: "10px", color: "#444", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>Their message</p>
            <p style={{ fontSize: "13px", color: "#ccc", lineHeight: 1.7 }}>{activeApplication.message}</p>
          </div>

          {activeApplication.platforms?.length > 0 && (
            <div style={{ marginBottom: "1.5rem" }}>
              <p style={{ fontSize: "10px", color: "#444", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>Platforms</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {activeApplication.platforms.map(p => (
                  <span key={p} style={{ padding: "6px 12px", borderRadius: "20px", border: "1px solid #222", color: "#555", fontSize: "12px" }}>{p}</span>
                ))}
              </div>
            </div>
          )}

          {activeApplication.status === "accepted" && (
            <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "12px", padding: "1.25rem", marginBottom: "1.5rem", textAlign: "center" }}>
              <p style={{ fontSize: "20px", marginBottom: "8px" }}>🎉</p>
              <p style={{ fontSize: "14px", color: "#fff", fontWeight: 600, marginBottom: "4px" }}>You accepted this creator</p>
              <p style={{ fontSize: "12px", color: "#444", lineHeight: 1.6 }}>Head to your messages tab to discuss deliverables and next steps.</p>
            </div>
          )}

          {activeApplication.status === "rejected" && (
            <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "12px", padding: "1.25rem", marginBottom: "1.5rem", textAlign: "center" }}>
              <p style={{ fontSize: "13px", color: "#444", fontWeight: 600 }}>Application declined</p>
            </div>
          )}

          {activeApplication.status === "pending" && actionLoading !== activeApplication.id && (
            <div style={{ display: "flex", gap: "10px", marginBottom: "1rem" }}>
              <div onClick={() => handleAccept(activeApplication)} style={{ flex: 1, padding: "14px", borderRadius: "8px", background: "#fff", color: "#0a0a0a", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase" }}>Accept</div>
              <div onClick={() => handleReject(activeApplication)} style={{ flex: 1, padding: "14px", borderRadius: "8px", background: "transparent", color: "#555", border: "1px solid #222", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase" }}>Decline</div>
            </div>
          )}

          {activeApplication.status === "pending" && actionLoading === activeApplication.id && (
            <div style={{ padding: "14px", borderRadius: "8px", background: "#1a1a1a", color: "#555", fontSize: "13px", fontWeight: 600, textAlign: "center", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "1rem" }}>
              <p>Processing...</p>
            </div>
          )}

          {activeApplication.status === "accepted" && (
            <div onClick={() => { setBrandTab("messages"); setView("list"); }} style={{ padding: "14px", borderRadius: "8px", background: "#fff", color: "#0a0a0a", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Go to Messages →
            </div>
          )}
        </div>
      )}

      {/* Messages Tab List View */}
      {(role === "creator" || (role === "brand" && brandTab === "messages")) && view === "list" && (
        <div style={{ flex: 1, overflowY: "auto", paddingBottom: "6rem" }}>
          {loading ? (
            <p style={{ color: "#444", fontSize: "13px", textAlign: "center", marginTop: "3rem" }}>Loading...</p>
          ) : conversations.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", textAlign: "center", padding: "2rem" }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" style={{ marginBottom: "1rem" }}>
                <path d="M21 11.5C21 16.1944 16.9706 20 12 20C10.2832 20 8.68732 19.5586 7.33333 18.8L3 20L4.26667 16.2C3.46667 14.8333 3 13.2333 3 11.5C3 6.80558 7.02944 3 12 3C16.9706 3 21 6.80558 21 11.5Z" stroke="#333" strokeWidth="2" strokeLinejoin="round"/>
              </svg>
              <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff", marginBottom: "8px" }}>No messages yet</p>
              <p style={{ fontSize: "13px", color: "#444", lineHeight: 1.6 }}>
                {role === "creator" ? "Search for brands or creators to start a conversation." : "Accept applications to start conversations with creators."}
              </p>
              {role === "creator" && (
                <div onClick={() => navigate("search-creator" as Page)} style={{ marginTop: "1.5rem", padding: "10px 20px", background: "#fff", color: "#0a0a0a", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: 600 }}>
                  Find People
                </div>
              )}
            </div>
          ) : (
            conversations.map(c => {
              const isUnread = unreadConvoIds.includes(c.id);
              return (
                <div key={c.id} onClick={() => openChat(c)} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "1rem 1.25rem", borderBottom: "1px solid #111", cursor: "pointer", background: isUnread ? "#11111144" : "transparent" }}>
                  <div style={{ width: "44px", height: "44px", borderRadius: c.other_role === "creator" ? "50%" : "12px", border: "1px solid #222", background: "#111", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", color: "#333", flexShrink: 0, overflow: "hidden", position: "relative" }}>
                    {c.other_avatar ? <img src={c.other_avatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : c.other_role === "creator" ? "◉" : "◈"}
                  </div>
                  
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <p style={{ color: "#fff", fontSize: "14px", fontWeight: isUnread ? 700 : 600 }}>{c.other_name}</p>
                        {/* RED DOT ON THE CHAT ROW IF UNREAD */}
                        {isUnread && (
                          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#ff3b30" }} />
                        )}
                      </div>
                      <span style={{ fontSize: "11px", color: isUnread ? "#fff" : "#444", fontWeight: isUnread ? 600 : 400 }}>
                        {new Date(c.last_message_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p style={{ fontSize: "12px", color: isUnread ? "#eee" : "#444", fontWeight: isUnread ? 500 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.last_message || "Start a conversation"}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Chat View */}
      {view === "chat" && (
        <>
          <div style={{ flex: 1, overflowY: "auto", padding: "1rem 1.25rem", paddingBottom: "7rem", display: "flex", flexDirection: "column", gap: "10px" }}>
            {messages.length === 0 && (
              <p style={{ color: "#333", fontSize: "12px", textAlign: "center", marginTop: "2rem" }}>Start the conversation</p>
            )}
            {messages.map(m => (
              <div key={m.id} style={{ display: "flex", justifyContent: m.sender_id === currentUserId ? "flex-end" : "flex-start" }}>
                <div style={{ maxWidth: "75%", padding: "10px 14px", borderRadius: m.sender_id === currentUserId ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: m.sender_id === currentUserId ? "#fff" : "#111", color: m.sender_id === currentUserId ? "#0a0a0a" : "#fff", fontSize: "13px", lineHeight: 1.5, border: m.sender_id === currentUserId ? "none" : "1px solid #1a1a1a" }}>
                  <p>{m.text}</p>
                  <p style={{ fontSize: "10px", color: m.sender_id === currentUserId ? "#888" : "#444", marginTop: "4px", textAlign: "right" }}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div style={{ position: "fixed", bottom: "72px", left: 0, right: 0, padding: "0.75rem 1.25rem", background: "#0a0a0a", borderTop: "1px solid #111", display: "flex", gap: "10px", alignItems: "center" }}>
            <input
              style={{ flex: 1, background: "#111", border: "1px solid #222", borderRadius: "24px", padding: "10px 16px", color: "#fff", fontSize: "14px", outline: "none", fontFamily: "inherit" }}
              placeholder="Message..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()}
            />
            <div onClick={send} style={{ width: "38px", height: "38px", borderRadius: "50%", background: input ? "#fff" : "#111", border: input ? "none" : "1px solid #222", display: "flex", alignItems: "center", justifyContent: "center", cursor: input ? "pointer" : "default", fontSize: "16px", color: input ? "#0a0a0a" : "#333", transition: "all 0.2s", flexShrink: 0 }}>
              ↑
            </div>
          </div>
        </>
      )}
    </div>
  );
}