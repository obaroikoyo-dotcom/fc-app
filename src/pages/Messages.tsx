import { useState, useEffect, useRef } from "react";
import { type Page } from "../App";
import { supabase } from "../lib/supabase";

interface Props {
  navigate: (p: Page) => void;
  role: "brand" | "creator";
}

interface Conversation {
  id: string;
  participant_1: string;
  participant_2: string;
  last_message: string;
  last_message_at: string;
  other_name?: string;
  other_role?: string;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  text: string;
  created_at: string;
}

export default function Messages({ navigate, role }: Props) {
  const [view, setView] = useState<"list" | "chat">("list");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvo, setActiveConvo] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadConversations = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setCurrentUserId(user.id);

    const { data } = await supabase
      .from("conversations")
      .select("*")
      .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
      .order("last_message_at", { ascending: false });

    if (data) {
      const enriched = await Promise.all(data.map(async (c) => {
        const otherId = c.participant_1 === user.id ? c.participant_2 : c.participant_1;
        const { data: profile } = await supabase.from("profiles").select("role, creator_profiles(name), brand_profiles(name)").eq("id", otherId).single();
        const otherName = (profile as any)?.creator_profiles?.name || (profile as any)?.brand_profiles?.name || "Unknown";
        return { ...c, other_name: otherName, other_role: profile?.role };
      }));
      setConversations(enriched);
    }
    setLoading(false);
  };

  const openChat = async (convo: Conversation) => {
    setActiveConvo(convo);
    setView("chat");
    loadMessages(convo.id);

    // Subscribe to realtime
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

    await supabase.from("messages").insert({
      conversation_id: activeConvo.id,
      sender_id: currentUserId,
      text,
    });

    await supabase.from("conversations").update({
      last_message: text,
      last_message_at: new Date().toISOString(),
    }).eq("id", activeConvo.id);
  };

  const profilePage = role === "creator" ? "creator-profile" : "brand-profile";
  const explorePage = role === "creator" ? "explore" : "brand-dashboard";

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');`}</style>

      {/* Top Nav */}
      <div style={{ padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "12px", borderBottom: "1px solid #111" }}>
        {view === "chat" && (
          <span onClick={() => { setView("list"); setActiveConvo(null); setMessages([]); }} style={{ fontSize: "18px", color: "#555", cursor: "pointer" }}>←</span>
        )}
        <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff" }}>
          {view === "list" ? "Messages" : activeConvo?.other_name}
        </span>
      </div>

      {/* Conversation List */}
      {view === "list" && (
        <div style={{ flex: 1, overflowY: "auto", paddingBottom: "6rem" }}>
          {loading ? (
            <p style={{ color: "#444", fontSize: "13px", textAlign: "center", marginTop: "3rem" }}>Loading...</p>
          ) : conversations.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", textAlign: "center", padding: "2rem" }}>
              <div style={{ fontSize: "36px", marginBottom: "1rem" }}>💬</div>
              <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff", marginBottom: "8px" }}>No messages yet</p>
              <p style={{ fontSize: "13px", color: "#444", lineHeight: 1.6 }}>
                {role === "creator" ? "Search for brands or creators to start a conversation." : "Creators who apply will appear here."}
              </p>
              {role === "creator" && (
                <div onClick={() => navigate("search-creator" as Page)} style={{ marginTop: "1.5rem", padding: "10px 20px", background: "#fff", color: "#0a0a0a", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: 600 }}>
                  Find People
                </div>
              )}
            </div>
          ) : (
            conversations.map(c => (
              <div key={c.id} onClick={() => openChat(c)} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "1rem 1.25rem", borderBottom: "1px solid #111", cursor: "pointer" }}>
                <div style={{ width: "44px", height: "44px", borderRadius: c.other_role === "creator" ? "50%" : "12px", border: "1px solid #222", background: "#111", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", color: "#333", flexShrink: 0 }}>
                  {c.other_role === "creator" ? "◉" : "◈"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <p style={{ color: "#fff", fontSize: "14px", fontWeight: 600 }}>{c.other_name}</p>
                    <span style={{ fontSize: "11px", color: "#444" }}>{new Date(c.last_message_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <p style={{ fontSize: "12px", color: "#444", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.last_message || "Start a conversation"}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Chat */}
      {view === "chat" && (
        <>
          <div style={{ flex: 1, overflowY: "auto", padding: "1rem 1.25rem", paddingBottom: "7rem", display: "flex", flexDirection: "column", gap: "10px" }}>
            {messages.length === 0 && (
              <p style={{ color: "#333", fontSize: "12px", textAlign: "center", marginTop: "2rem" }}>Start the conversation</p>
            )}
            {messages.map(m => (
              <div key={m.id} style={{ display: "flex", justifyContent: m.sender_id === currentUserId ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: "75%",
                  padding: "10px 14px",
                  borderRadius: m.sender_id === currentUserId ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  background: m.sender_id === currentUserId ? "#fff" : "#111",
                  color: m.sender_id === currentUserId ? "#0a0a0a" : "#fff",
                  fontSize: "13px",
                  lineHeight: 1.5,
                  border: m.sender_id === currentUserId ? "none" : "1px solid #1a1a1a",
                }}>
                  <p>{m.text}</p>
                  <p style={{ fontSize: "10px", color: m.sender_id === currentUserId ? "#888" : "#444", marginTop: "4px", textAlign: "right" }}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ position: "fixed", bottom: "72px", left: 0, right: 0, padding: "0.75rem 1.25rem", background: "#0a0a0a", borderTop: "1px solid #111", display: "flex", gap: "10px", alignItems: "center" }}>
            <input
              style={{ flex: 1, background: "#111", border: "1px solid #222", borderRadius: "24px", padding: "10px 16px", color: "#fff", fontSize: "14px", outline: "none", fontFamily: "inherit" }}
              placeholder="Message..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()}
            />
            <div
              onClick={send}
              style={{ width: "38px", height: "38px", borderRadius: "50%", background: input ? "#fff" : "#111", border: input ? "none" : "1px solid #222", display: "flex", alignItems: "center", justifyContent: "center", cursor: input ? "pointer" : "default", fontSize: "16px", color: input ? "#0a0a0a" : "#333", transition: "all 0.2s", flexShrink: 0 }}
            >
              ↑
            </div>
          </div>
        </>
      )}

      {/* Bottom Nav */}
      <div style={{ borderTop: "1px solid #111", display: "flex", padding: "1rem 0", background: "#0a0a0a", position: "fixed", bottom: 0, width: "100%" }}>
        <div onClick={() => navigate(explorePage as Page)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", cursor: "pointer" }}>
          <span style={{ fontSize: "20px" }}>{role === "creator" ? "◎" : "◈"}</span>
          <span style={{ fontSize: "10px", color: "#444", letterSpacing: "0.08em", textTransform: "uppercase" }}>{role === "creator" ? "Explore" : "Campaigns"}</span>
        </div>
        {role === "creator" && (
          <div onClick={() => navigate("search-creator" as Page)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", cursor: "pointer" }}>
            <span style={{ fontSize: "20px" }}>🔍</span>
            <span style={{ fontSize: "10px", color: "#444", letterSpacing: "0.08em", textTransform: "uppercase" }}>Search</span>
          </div>
        )}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", cursor: "pointer" }}>
          <span style={{ fontSize: "20px" }}>💬</span>
          <span style={{ fontSize: "10px", color: "#fff", letterSpacing: "0.08em", textTransform: "uppercase" }}>Messages</span>
        </div>
        <div onClick={() => navigate(profilePage as Page)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", cursor: "pointer" }}>
          <span style={{ fontSize: "20px" }}>◉</span>
          <span style={{ fontSize: "10px", color: "#444", letterSpacing: "0.08em", textTransform: "uppercase" }}>Profile</span>
        </div>
      </div>
    </div>
  );
}