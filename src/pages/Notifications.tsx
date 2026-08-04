import { useState, useEffect } from "react";
import { type Page } from "../App";
import { supabase } from "../lib/supabase";
import { withTimeout } from "../lib/withTimeout";
import { useRefetchOnVisible } from "../lib/useRefetchOnVisible";
import { useDelayedLoading } from "../lib/useDelayedLoading";

interface Props {
  navigate: (p: Page) => void;
  setTargetData?: (data: any) => void;
  onRead?: () => void;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
  data: {
    conversation_id?: string;
    campaign_id?: string;
  } | null;
  actor_name?: string;
  actor_avatar?: string | null;
}

export default function Notifications({ navigate, setTargetData, onRead }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDelayedLoading(loading);

  useEffect(() => {
    // 1. Initial run fetches historical notifications as they stand
    fetchNotifications().then(() => {
      markAllAsRead().then(() => {
        if (onRead) onRead();
      });
    });

    // Subscribe to new incoming notifications live
    const channel = supabase
      .channel("live-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        () => {
          // Pass true to bypass global layout skeleton loading flickers on updates
          fetchNotifications(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchNotifications = async (isBackgroundUpdate = false) => {
    if (!isBackgroundUpdate) setLoading(true);
    try {
      await withTimeout(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { return; }

        const { data, error } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (!error && data) {
          const parsed = data.map((n: any) => ({
            ...n,
            actor_name: "Someone",
            actor_avatar: null
          }));
          setNotifications(parsed);
        }
      }, 10000, "Notifications.fetch");
    } catch (err) {
      console.error("Failed to load notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  useRefetchOnVisible(() => fetchNotifications(), loading);

  const markAllAsRead = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);
  };

  const handleNotificationClick = (notif: Notification) => {
    if (!notif.data) return;

    if (notif.type === "new_message" && notif.data.conversation_id) {
      if (setTargetData) setTargetData({ activeConversationId: notif.data.conversation_id });
      navigate("messages" as Page);
    } else if (notif.type === "campaign_application" || notif.type === "campaign_accepted") {
      navigate("messages" as Page); 
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');`}</style>

      {/* Fixed Layout Typography: justifyValue -> justifyContent */}
      <div style={{ padding: "1rem 1.25rem", paddingTop: "calc(1rem + env(safe-area-inset-top, 0px))", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #111", position: "fixed", top: 0, left: 0, right: 0, background: "#0a0a0a", zIndex: 100 }}>
        <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff" }}>Notifications</span>
      </div>

      {/* Feed List */}
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: "6rem", paddingTop: "calc(57px + env(safe-area-inset-top, 0px))" }}>
        {showSkeleton && notifications.length === 0 ? (
          <p style={{ color: "#888", fontSize: "13px", textAlign: "center", marginTop: "3rem" }}>Loading activity feed...</p>
        ) : loading && notifications.length === 0 ? null : notifications.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", textAlign: "center", padding: "2rem" }}>
            <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff", marginBottom: "8px" }}>All caught up</p>
            <p style={{ fontSize: "13px", color: "#888" }}>When updates occur, they'll land right here.</p>
          </div>
        ) : (
          notifications.map((n) => (
            <div 
              key={n.id} 
              onClick={() => handleNotificationClick(n)}
              style={{ 
                display: "flex", 
                alignItems: "flex-start", 
                gap: "12px", 
                padding: "1.1rem 1.25rem", 
                borderBottom: "1px solid #111", 
                background: n.read ? "transparent" : "rgba(255, 255, 255, 0.03)",
                cursor: n.data ? "pointer" : "default",
                position: "relative"
              }}
            >
              {/* Visible Unread Flag Indicator Dot */}
              {!n.read && (
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#fff", position: "absolute", left: "6px", top: "50%", transform: "translateY(-50%)" }} />
              )}

              {/* Actor Profile Avatar Frame */}
              <div style={{ width: "40px", height: "40px", borderRadius: n.type === "campaign_application" ? "50%" : "8px", border: "1px solid #222", background: "#111", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                {n.actor_avatar ? (
                  <img src={n.actor_avatar} alt={n.actor_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ fontSize: "14px", color: "#888" }}>◉</span>
                )}
              </div>

              {/* Body Text Context Area */}
              <div style={{ flex: 1, minWidth: 0, paddingLeft: !n.read ? "4px" : "0px" }}>
                <p style={{ color: "#fff", fontSize: "13px", fontWeight: 600, marginBottom: "3px" }}>{n.title}</p>
                <p style={{ color: "#bbb", fontSize: "12px", lineHeight: 1.4 }}>{n.body}</p>
                <p style={{ color: "#777", fontSize: "10px", marginTop: "6px" }}>
                  {new Date(n.created_at).toLocaleDateString([], { month: "short", day: "numeric" })} at {new Date(n.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>

              {/* Action Routing Indicator Arrow */}
              {n.data && (
                <span style={{ color: "#777", fontSize: "14px", alignSelf: "center", paddingLeft: "8px" }}>&rarr;</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}