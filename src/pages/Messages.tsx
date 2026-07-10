import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { type Page } from "../App";
import { supabase } from "../lib/supabase";
import { notifyAndPush } from "../lib/push";
import { withTimeout } from "../lib/withTimeout";
import { useRefetchOnVisible } from "../lib/useRefetchOnVisible";
import { useDelayedLoading } from "../lib/useDelayedLoading";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { stripePromise } from "../lib/stripe";

interface Props {
  navigate: (p: Page) => void;
  role: "brand" | "creator";
  navigateToProfile?: (id: string) => void;
  navigateToBrandProfile?: (id: string) => void;
  openConvoId?: string | null;
  onConvoOpened?: () => void;
  onRead?: () => void;
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
  application_id?: string;
  application_status?: string;
  campaign_id?: string;
  campaign_budget?: number;
  campaign_name?: string;
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
  video_url?: string | null;
}

interface Campaign {
  id: string;
  name: string;
  applications: Application[];
}

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: { fontSize: "14px", color: "#fff", fontFamily: "'DM Sans', sans-serif", "::placeholder": { color: "#555" } },
    invalid: { color: "#ff3b30" },
  },
};

interface PaymentModalProps {
  paymentApp: Application;
  campaignBudget: number;
  isEnterprise: boolean;
  currentUserId: string | null;
  savedCard: { last4: string; brand: string; pm_id: string } | null;
  onSuccess: (app: Application) => void;
  onClose: () => void;
}

function PaymentModalContent({ paymentApp, campaignBudget, isEnterprise, currentUserId, savedCard, onSuccess, onClose }: PaymentModalProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [useNewCard, setUseNewCard] = useState(!savedCard);
  const [cardName, setCardName] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  const brandFee = isEnterprise ? 0 : Math.round(campaignBudget * 0.05);
  const totalCharge = campaignBudget + brandFee;

  const handlePay = async () => {
    if (!stripe || !currentUserId) return;
    setProcessing(true);
    setError("");

    const res = await supabase.functions.invoke("create-payment-intent", {
  body: { amount: campaignBudget, brand_id: currentUserId, creator_id: paymentApp.creator_id, campaign_id: paymentApp.campaign_id, is_enterprise: isEnterprise, stripe_customer_id: savedCard ? (await supabase.from("brand_profiles").select("stripe_customer_id").eq("id", currentUserId!).single()).data?.stripe_customer_id : null }
});

    if (res.error || !res.data?.clientSecret) {
      setError("Failed to create payment. Try again.");
      setProcessing(false);
      return;
    }

    let confirmResult;
    if (!useNewCard && savedCard) {
      confirmResult = await stripe.confirmCardPayment(res.data.clientSecret, { payment_method: savedCard.pm_id });
    } else {
      const cardElement = elements?.getElement(CardElement);
      if (!cardElement) { setError("Card details missing."); setProcessing(false); return; }
      confirmResult = await stripe.confirmCardPayment(res.data.clientSecret, {
        payment_method: { card: cardElement, billing_details: { name: cardName } },
      });
    }

    if (confirmResult.error) {
      setError(confirmResult.error.message || "Payment failed.");
      setProcessing(false);
      return;
    }

    if (confirmResult.paymentIntent?.status === "succeeded") {
      const { error: updateError } = await supabase
        .from("applications")
        .update({ status: "paid" })
        .eq("id", paymentApp.id);

      if (updateError) {
        console.error("Failed to update application status:", updateError);
        setError("Payment succeeded but we couldn't update your records. Contact support.");
        setProcessing(false);
        return;
      }

      // Mark the transaction completed immediately rather than waiting on the
      // Stripe webhook, so the creator's payout balance updates right away.
      const { error: txError } = await supabase
        .from("transactions")
        .update({ status: "completed" })
        .eq("stripe_payment_intent_id", confirmResult.paymentIntent.id);

      if (txError) console.error("Failed to mark transaction completed:", txError);

      await notifyAndPush({
        user_id: paymentApp.creator_id,
        type: "payment_received",
        title: "Payment Received",
        body: `Funds for "${paymentApp.campaign_name}" have been secured in escrow. Refresh and check Payouts in Settings to see your balance.`,
        data: { campaign_id: paymentApp.campaign_id }
      });

      setProcessing(false);
      onSuccess(paymentApp);
    } else {
      console.warn("Payment not yet succeeded, status:", confirmResult.paymentIntent?.status);
      setError(`Payment status: ${confirmResult.paymentIntent?.status || "unknown"}. Please try again.`);
      setProcessing(false);
    }
  };

  return (
    <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: "14px", width: "100%", maxWidth: "480px", padding: "1.5rem" }}>
      <h3 style={{ fontFamily: "'Syne', sans-serif", color: "#fff", fontSize: "18px", fontWeight: 800, marginBottom: "8px" }}>Confirm Deal & Pay</h3>
      <p style={{ color: "#555", fontSize: "13px", marginBottom: "1.5rem" }}>Locking in with {paymentApp.creator_name} for "{paymentApp.campaign_name}"</p>

      <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
          <span style={{ color: "#555", fontSize: "13px" }}>Creator Payout {isEnterprise ? "(100%)" : "(90%)"}</span>
          <span style={{ color: "#fff", fontSize: "13px" }}>£{((campaignBudget * (isEnterprise ? 1 : 0.90)) / 100).toFixed(2)}</span>
        </div>
        {!isEnterprise && (
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ color: "#555", fontSize: "13px" }}>Platform Fee (5%)</span>
            <span style={{ color: "#fff", fontSize: "13px" }}>£{(brandFee / 100).toFixed(2)}</span>
          </div>
        )}
        <div style={{ borderTop: "1px solid #222", paddingTop: "8px", display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "#fff", fontSize: "14px", fontWeight: 600 }}>Total</span>
          <span style={{ color: "#fff", fontSize: "14px", fontWeight: 600 }}>£{(totalCharge / 100).toFixed(2)}</span>
        </div>
      </div>

      {savedCard && (
        <div style={{ marginBottom: "1rem", display: "flex", flexDirection: "column", gap: "8px" }}>
          <div onClick={() => setUseNewCard(false)} style={{ display: "flex", alignItems: "center", gap: "12px", background: !useNewCard ? "#1a1a1a" : "#111", border: `1px solid ${!useNewCard ? "#fff" : "#222"}`, borderRadius: "8px", padding: "12px 14px", cursor: "pointer" }}>
            <div style={{ width: "16px", height: "16px", borderRadius: "50%", border: `2px solid ${!useNewCard ? "#fff" : "#444"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {!useNewCard && <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#fff" }} />}
            </div>
            <div>
              <p style={{ color: "#fff", fontSize: "13px", fontWeight: 600 }}>{savedCard.brand.charAt(0).toUpperCase() + savedCard.brand.slice(1)} •••• {savedCard.last4}</p>
              <p style={{ color: "#444", fontSize: "11px", marginTop: "2px" }}>Saved card</p>
            </div>
          </div>
          <div onClick={() => setUseNewCard(true)} style={{ display: "flex", alignItems: "center", gap: "12px", background: useNewCard ? "#1a1a1a" : "#111", border: `1px solid ${useNewCard ? "#fff" : "#222"}`, borderRadius: "8px", padding: "12px 14px", cursor: "pointer" }}>
            <div style={{ width: "16px", height: "16px", borderRadius: "50%", border: `2px solid ${useNewCard ? "#fff" : "#444"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {useNewCard && <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#fff" }} />}
            </div>
            <p style={{ color: useNewCard ? "#fff" : "#555", fontSize: "13px", fontWeight: 600 }}>Use a different card</p>
          </div>
        </div>
      )}

      {useNewCard && (
        <div style={{ marginBottom: "1.25rem", display: "flex", flexDirection: "column", gap: "10px" }}>
          <div>
            <label style={{ fontSize: "10px", color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Cardholder Name</label>
            <input value={cardName} onChange={e => setCardName(e.target.value)} placeholder="Name on card" style={{ background: "#111", border: "1px solid #222", borderRadius: "8px", padding: "11px 14px", color: "#fff", fontSize: "14px", outline: "none", width: "100%", fontFamily: "inherit", boxSizing: "border-box" as const }} />
          </div>
          <div>
            <label style={{ fontSize: "10px", color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Card Details</label>
            <div style={{ background: "#111", border: "1px solid #222", borderRadius: "8px", padding: "13px 14px" }}>
              <CardElement options={CARD_ELEMENT_OPTIONS} />
            </div>
          </div>
        </div>
      )}

      {error && <p style={{ fontSize: "12px", color: "#ff3b30", marginBottom: "10px" }}>{error}</p>}

      <div style={{ display: "flex", gap: "10px" }}>
        <div onClick={onClose} style={{ flex: 1, padding: "14px", borderRadius: "8px", background: "transparent", border: "1px solid #222", color: "#555", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: "pointer", textTransform: "uppercase" as const }}>Cancel</div>
        <div onClick={!processing ? handlePay : undefined} style={{ flex: 2, padding: "14px", borderRadius: "8px", background: processing ? "#1a1a1a" : "#fff", color: processing ? "#555" : "#0a0a0a", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: processing ? "default" : "pointer", textTransform: "uppercase" as const, transition: "all 0.2s" }}>
          {processing ? "Processing..." : `Pay £${(totalCharge / 100).toFixed(2)}`}
        </div>
      </div>
    </div>
  );
}

export default function Messages({ navigate, role, openConvoId, onConvoOpened, navigateToProfile, navigateToBrandProfile, onRead }: Props) {
  const [view, setView] = useState<"list" | "chat" | "campaign-apps" | "app-detail">("list");
  const [brandTab, setBrandTab] = useState<"applications" | "messages">("applications");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvo, setActiveConvo] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDelayedLoading(loading);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>("Someone");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);
  const [activeApplication, setActiveApplication] = useState<Application | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentApp, setPaymentApp] = useState<Application | null>(null);
  const [campaignBudget, setCampaignBudget] = useState(0);
  const [isEnterprise, setIsEnterprise] = useState(false);
  const [savedCard, setSavedCard] = useState<{ last4: string; brand: string; pm_id: string } | null>(null);
  const [paymentPopup, setPaymentPopup] = useState<{ title: string; body: string } | null>(null);
  
  // Track unread conversation IDs locally to place red dots on chats
  const [unreadConvoIds, setUnreadConvoIds] = useState<string[]>([]);
  const [seenCampaignIds, setSeenCampaignIds] = useState<string[]>([]);
  
  const stickyRef = useRef<HTMLDivElement>(null);
  const [stickyHeight, setStickyHeight] = useState(0);
  const inputBarRef = useRef<HTMLDivElement>(null);
  const [inputBarHeight, setInputBarHeight] = useState(0);

  useEffect(() => {
  const init = async () => {
    let user;
    try {
      const result = await withTimeout(supabase.auth.getUser());
      user = result.data.user;
    } catch (err) {
      console.error("Failed to get user:", err);
      setLoading(false);
      return;
    }
    if (!user) { setLoading(false); return; }
    setCurrentUserId(user.id);

    if (role === "brand") {
      try {
        const { data: bp } = await withTimeout(
          supabase.from("brand_profiles").select("is_enterprise, stripe_payment_method_id, card_last4, card_brand").eq("id", user.id).single()
        );
        if (bp?.is_enterprise) setIsEnterprise(true);
        if (bp?.stripe_payment_method_id && bp?.card_last4) {
          setSavedCard({ last4: bp.card_last4, brand: bp.card_brand || "card", pm_id: bp.stripe_payment_method_id });
        }
      } catch (err) {
        console.error("Failed to load brand payment info:", err);
      }
    }
    await loadConversations();
    if (role === "brand") {
      loadApplications();
      await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
      if (onRead) onRead();
    }
    await fetchUnreadMessages(user.id);

    const channel = supabase
      .channel("messages-badge-sync")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, (payload) => {
        fetchUnreadMessages(user.id); // use local var, not state
        const n = payload.new as { user_id: string; type: string; title: string; body: string };
        if (role === "creator" && n.user_id === user.id && n.type === "payment_received") {
          setPaymentPopup({ title: n.title, body: n.body });
        }
      })
      .subscribe();

    if (role === "brand") {
      supabase
        .channel("applications-update")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "applications" }, () => {
          loadApplications();
        })
        .subscribe();
    }

    const convoChannel = supabase
      .channel("conversations-reorder")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversations" }, (payload) => {
        const updated = payload.new as Conversation;
        setConversations(prev => {
          const exists = prev.find(c => c.id === updated.id);
          if (!exists) { loadConversations(); return prev; }
          const merged = prev.map(c => c.id === updated.id ? { ...c, last_message: updated.last_message, last_message_at: updated.last_message_at } : c);
          return merged.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(convoChannel);
      supabase.removeChannel(supabase.channel("applications-update"));
    };
  };

  init();
}, []);

  useEffect(() => {
    if (view === "chat") {
      const scroller = document.querySelector(".page-enter");
      if (scroller) scroller.scrollTop = scroller.scrollHeight;
    }
  }, [messages, view]);

  useLayoutEffect(() => {
    if (stickyRef.current) setStickyHeight(stickyRef.current.offsetHeight);
    if (inputBarRef.current) setInputBarHeight(inputBarRef.current.offsetHeight);
  }, [view, role, brandTab, activeConvo]);

  // When opening a chat, automatically clear its unread status
  useEffect(() => {
    if (view === "chat" && activeConvo) {
      clearUnreadForConvo(activeConvo.id);
    }
  }, [view, activeConvo]);

  const loadConversations = async () => {
    setLoading(true);
    try {
      await withTimeout((async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { return; }
        setCurrentUserId(user.id);

        const { data: myRole } = await supabase.from("profiles").select("role").eq("id", user.id).single();
        if (myRole?.role === "creator") {
          const { data: cp } = await supabase.from("creator_profiles").select("name").eq("id", user.id).single();
          setCurrentUserName(cp?.name || "Someone");
        } else {
          const { data: bp } = await supabase.from("brand_profiles").select("name").eq("id", user.id).single();
          setCurrentUserName(bp?.name || "Someone");
        }

        const { data } = await supabase
          .from("conversations")
          .select("*")
          .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
          .order("last_message_at", { ascending: false });

        if (data) {
          const enriched = await Promise.all(data.map(async (c) => {
            const otherId = c.participant_1 === user.id ? c.participant_2 : c.participant_1;

            // Fetch counter-party information
            const { data: profile } = await supabase.from("profiles").select("role").eq("id", otherId).single();
            let otherName = "Unknown";
            let otherAvatar = null;
            if (profile?.role === "creator") {
              const { data: cp } = await supabase.from("creator_profiles").select("name, avatar_url").eq("id", otherId).single();
              otherName = cp?.name || "Unknown";
              otherAvatar = cp?.avatar_url || null;
            } else {
              const { data: bp } = await supabase.from("brand_profiles").select("name, avatar_url").eq("id", otherId).single();
              otherName = bp?.name || "Unknown";
              otherAvatar = bp?.avatar_url || null;
            }

            // Match live app link properties to conversational items to maintain in-chat actions
            const creatorSearchId = profile?.role === "creator" ? otherId : user.id;
            const brandSearchId = profile?.role === "brand" ? otherId : user.id;

            const { data: linkedApp } = await supabase
              .from("applications")
              .select("id, status, campaign_id, campaigns(name, budget, brand_id)")
              .eq("creator_id", creatorSearchId)
              .eq("campaigns.brand_id", brandSearchId)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            return {
              ...c,
              other_name: otherName,
              other_role: profile?.role,
              other_avatar: otherAvatar,
              application_id: linkedApp?.id,
              application_status: linkedApp?.status,
              campaign_id: linkedApp?.campaign_id,
              campaign_name: (linkedApp?.campaigns as any)?.name,
              campaign_budget: parseInt((linkedApp?.campaigns as any)?.budget, 10) || 0
            };
          }));
          const sorted = enriched.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
          setConversations(sorted);
          if (openConvoId) {
            const target = enriched.find(c => c.id === openConvoId);
            if (target) {
              openChat(target);
              onConvoOpened?.();
            }
          }
        }
        fetchUnreadMessages(user.id);
      })(), 15000);
    } catch (err) {
      console.error("Failed to load conversations:", err);
    } finally {
      setLoading(false);
    }
  };

  useRefetchOnVisible(loadConversations, loading);

  const fetchUnreadMessages = async (userId = currentUserId) => {
    if (!userId) return;
    const { data } = await supabase
      .from("notifications")
      .select("id, data")
      .eq("user_id", userId)
      .eq("type", "new_message")
      .eq("read", false);

    if (data) {
      const ids = data
        .map(n => n.data?.conversation_id)
        .filter(Boolean);
      setUnreadConvoIds([...new Set(ids)]);
    }
  };

  const clearUnreadForConvo = async (convoId: string) => {
  // Clear the dot immediately rather than waiting on the round-trip below.
  setUnreadConvoIds(prev => prev.filter(id => id !== convoId));

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const currentUserId = user.id;
  const { data: notifs } = await supabase
    .from("notifications")
    .select("id, data")
    .eq("user_id", currentUserId)
    .eq("type", "new_message")
    .eq("read", false);

  if (notifs) {
    const toMark = notifs.filter(n => n.data?.conversation_id === convoId).map(n => n.id);
    if (toMark.length > 0) {
      await supabase.from("notifications").update({ read: true }).in("id", toMark); // fixed: was is_read
      if (onRead) onRead();
    }
  }
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

    setCampaigns(campaignsWithApps.sort((a, b) => {
      const aLatest = a.applications[0]?.created_at || "0";
      const bLatest = b.applications[0]?.created_at || "0";
      return new Date(bLatest).getTime() - new Date(aLatest).getTime();
    }));
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
    
    const now = new Date().toISOString();
    await supabase.from("messages").insert({ conversation_id: activeConvo.id, sender_id: currentUserId, text });
    await supabase.from("conversations").update({ last_message: text, last_message_at: now }).eq("id", activeConvo.id);
    setConversations(prev => {
      const updated = prev.map(c => c.id === activeConvo.id ? { ...c, last_message: text, last_message_at: now } : c);
      return updated.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
    });

    const receiverId = activeConvo.participant_1 === currentUserId ? activeConvo.participant_2 : activeConvo.participant_1;

    await notifyAndPush({
      user_id: receiverId,
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

    // Swap instant approval to chatting phase so terms can be negotiated inside messages first
    await supabase.from("applications").update({ status: "accepted" }).eq("id", app.id);
    await supabase.from("campaigns").update({ updated_at: new Date().toISOString() }).eq("id", app.campaign_id);

    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .or(`and(participant_1.eq.${userId},participant_2.eq.${app.creator_id}),and(participant_1.eq.${app.creator_id},participant_2.eq.${userId})`)
      .maybeSingle();

    const welcomeText = `👋 Chat Opened! The brand is interested in talking details for "${app.campaign_name}". Let's align on dates and deliverables before finalizing the deal!`;
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

    await notifyAndPush({
      user_id: app.creator_id,
      type: "campaign_chatting",
      title: "Chat Opened! 💬",
      body: `${currentUserName} initiated a discussion for your "${app.campaign_name}" pitch.`,
      data: { campaign_id: app.campaign_id, conversation_id: targetConvoId }
    });

    setActionLoading(null);
    await loadApplications();
    await loadConversations();
    
    setActiveCampaign(prev => prev ? {
      ...prev,
      applications: prev.applications.map(a => a.id === app.id ? { ...a, status: "chatting" } : a)
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
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');
        @keyframes shimmer { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
      `}</style>

      {/* Sticky header group: header + brand tabs stack with zero gap since they share one fixed box */}
      <div ref={stickyRef} style={{ position: "fixed", top: 0, left: 0, right: 0, background: "#0a0a0a", zIndex: 100 }}>
        {/* Header Bar */}
        <div style={{ padding: "1.25rem", borderBottom: "1px solid #111", display: "flex", alignItems: "center", gap: "12px", background: "#0a0a0a" }}>
          {view !== "list" && (
            <div onClick={goBack} style={{ cursor: "pointer", color: "#fff", fontSize: "20px", paddingRight: "4px" }}>
              ←
            </div>
          )}
          {view === "chat" && activeConvo ? (
    <div
      onClick={() => {
        const otherId = activeConvo.participant_1 === currentUserId ? activeConvo.participant_2 : activeConvo.participant_1;
        if (activeConvo.other_role === "brand") {
          navigateToBrandProfile?.(otherId);
        } else {
          navigateToProfile?.(otherId);
        }
      }}
      style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}
    >
      <div style={{ width: "32px", height: "32px", borderRadius: activeConvo.other_role === "creator" ? "50%" : "10px", border: "1px solid #222", background: "#111", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", color: "#333" }}>
        {activeConvo.other_avatar ? <img src={activeConvo.other_avatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : activeConvo.other_role === "creator" ? "◉" : "◈"}
      </div>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>{activeConvo.other_name}</h1>
    </div>
  ) : (
    <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "20px", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>
      {getHeader()}
    </h1>
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
              {unreadConvoIds.length > 0 && (
                <span style={{ display: "inline-block", width: "6px", height: "6px", background: "#ff3b30", borderRadius: "50%", marginLeft: "4px", verticalAlign: "middle" }} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Applications Tab */}
      {role === "brand" && view === "list" && brandTab === "applications" && (
        <div style={{ paddingTop: stickyHeight ? `${stickyHeight}px` : "6rem", paddingBottom: "6rem" }}>
          {campaigns.length === 0 ? (
            <div style={{ textAlign: "center", padding: "4rem 2rem" }}>
              <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff", marginBottom: "8px" }}>No campaigns yet</p>
              <p style={{ fontSize: "13px", color: "#444" }}>Post a campaign to start receiving applications.</p>
            </div>
          ) : (
            campaigns.map(camp => (
              <div key={camp.id} onClick={async () => { 
                setActiveCampaign(camp); 
                setView("campaign-apps"); 
                setSeenCampaignIds(prev => [...prev, camp.id]);
                if (currentUserId) {
                  await supabase.from("notifications").update({ read: true })
                    .eq("user_id", currentUserId)
                    .eq("type", "campaign_application")
                    .eq("read", false);
                  if (onRead) onRead();
                }
              }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.25rem", borderBottom: "1px solid #111", cursor: "pointer" }}>
                <div>
                  <p style={{ color: "#fff", fontSize: "14px", fontWeight: 600, marginBottom: "4px" }}>{camp.name}</p>
                  <p style={{ color: "#444", fontSize: "12px" }}>{camp.applications.length} application{camp.applications.length !== 1 ? "s" : ""}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {camp.applications.filter(a => a.status === "pending").length > 0 && !seenCampaignIds.includes(camp.id) && (
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#ff3b30" }} />
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
        <div style={{ paddingTop: stickyHeight ? `${stickyHeight}px` : "6rem", paddingBottom: "6rem" }}>
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
                    <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "20px", border: `1px solid ${app.status === "chatting" || app.status === "accepted" ? "#fff" : app.status === "rejected" ? "#333" : "#555"}`, color: app.status === "chatting" || app.status === "accepted" ? "#fff" : app.status === "rejected" ? "#444" : "#777", textTransform: "uppercase" }}>
                      {app.status === "chatting" ? "chatting" : app.status}
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
        <div style={{ padding: "1.5rem 1.25rem", paddingBottom: "8rem", paddingTop: stickyHeight ? `${stickyHeight}px` : "6rem" }}>
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
{activeApplication.video_url && (
  <div style={{ marginBottom: "1.5rem" }}>
    <p style={{ fontSize: "10px", color: "#444", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>Video Pitch</p>
    <video src={activeApplication.video_url} controls style={{ width: "100%", borderRadius: "10px", background: "#000", maxHeight: "280px" }} />
  </div>
)}
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

          {(activeApplication.status === "accepted" || activeApplication.status === "chatting") && (
            <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "12px", padding: "1.25rem", marginBottom: "1.5rem", textAlign: "center" }}>
              <p style={{ fontSize: "20px", marginBottom: "8px" }}>💬</p>
              <p style={{ fontSize: "14px", color: "#fff", fontWeight: 600, marginBottom: "4px" }}>Chat open with creator</p>
              <p style={{ fontSize: "12px", color: "#444", lineHeight: 1.6 }}>Discuss deliverables in the chat tab. You can safely lock in the deal and process payments straight from the conversation bar anytime.</p>
            </div>
          )}

          {activeApplication.status === "rejected" && (
            <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "12px", padding: "1.25rem", marginBottom: "1.5rem", textAlign: "center" }}>
              <p style={{ fontSize: "13px", color: "#444", fontWeight: 600 }}>Application declined</p>
            </div>
          )}

          {activeApplication.status === "pending" && actionLoading !== activeApplication.id && (
            <div style={{ display: "flex", gap: "10px", marginBottom: "1rem" }}>
              <div onClick={() => handleAccept(activeApplication)} style={{ flex: 1, padding: "14px", borderRadius: "8px", background: "#fff", color: "#0a0a0a", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase" }}>Accept & Chat</div>
              <div onClick={() => handleReject(activeApplication)} style={{ flex: 1, padding: "14px", borderRadius: "8px", background: "transparent", color: "#555", border: "1px solid #222", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase" }}>Decline</div>
            </div>
          )}

          {activeApplication.status === "pending" && actionLoading === activeApplication.id && (
            <div style={{ padding: "14px", borderRadius: "8px", background: "#1a1a1a", color: "#555", fontSize: "13px", fontWeight: 600, textAlign: "center", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "1rem" }}>
              <p>Opening Conversation...</p>
            </div>
          )}

          {(activeApplication.status === "accepted" || activeApplication.status === "chatting") && (
            <div onClick={() => { setBrandTab("messages"); setView("list"); }} style={{ padding: "14px", borderRadius: "8px", background: "#fff", color: "#0a0a0a", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Go to Messages →
            </div>
          )}
        </div>
      )}

      {/* Messages Tab List View */}
      {(role === "creator" || (role === "brand" && brandTab === "messages")) && view === "list" && (
        <div style={{ paddingTop: stickyHeight ? `${stickyHeight}px` : "6rem", paddingBottom: "6rem" }}>
          {showSkeleton ? (
  <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
    {[1, 2, 3, 4, 5].map(i => (
      <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "1rem 1.25rem", borderBottom: "1px solid #111" }}>
        <div style={{ width: "44px", height: "44px", borderRadius: "50%", background: "#1a1a1a", flexShrink: 0, animation: "shimmer 1.5s ease-in-out infinite" }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ width: "120px", height: "13px", borderRadius: "4px", background: "#1a1a1a", animation: "shimmer 1.5s ease-in-out infinite" }} />
          <div style={{ width: "200px", height: "11px", borderRadius: "4px", background: "#1a1a1a", animation: "shimmer 1.5s ease-in-out infinite" }} />
        </div>
        <div style={{ width: "35px", height: "11px", borderRadius: "4px", background: "#1a1a1a", animation: "shimmer 1.5s ease-in-out infinite" }} />
      </div>
    ))}
  </div>
) : loading ? null : conversations.length === 0 ? (
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
                        {isUnread && (
                          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#ff3b30" }} />
                        )}
                      </div>
                      <span style={{ fontSize: "11px", color: isUnread ? "#fff" : "#444", fontWeight: isUnread ? 600 : 400 }}>
                        {new Date(c.last_message_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })}
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

     {/* Chat View Component */}
      {view === "chat" && (
        <>
          {/* IN-CHAT DEAL DESK WIDGET */}
          {activeConvo?.application_id && role === "brand" && (
            <div style={{ background: "#0d0d0d", borderBottom: "1px solid #1a1a1a", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ textTransform: "uppercase", fontSize: "9px", color: "#444", letterSpacing: "0.1em", fontWeight: 600 }}>Campaign Brief Trade</p>
                <p style={{ color: "#ccc", fontSize: "13px", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: "2px" }}>{activeConvo.campaign_name || "Active Brief"}</p>
              </div>

              {role === "brand" ? (
                <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                  {activeConvo.application_status !== "rejected" && activeConvo.application_status !== "paid" ? (
                    <>
                      <button
                        onClick={() => {
                          setCampaignBudget((activeConvo.campaign_budget || 0) * 100);
                          setPaymentApp({
                            id: activeConvo.application_id!,
                            campaign_id: activeConvo.campaign_id!,
                            creator_id: activeConvo.participant_1 === currentUserId ? activeConvo.participant_2 : activeConvo.participant_1,
                            status: activeConvo.application_status!,
                            message: "", platforms: [], created_at: "",
                            creator_name: activeConvo.other_name,
                            campaign_name: activeConvo.campaign_name
                          });
                          setShowPayment(true);
                        }}
                        style={{ background: "#fff", color: "#0a0a0a", border: "none", borderRadius: "6px", padding: "6px 12px", fontSize: "11px", fontWeight: 600, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.05em" }}
                      >
                        Lock Deal & Pay
                      </button>
                      <button
                        onClick={async () => {
                          if (!activeConvo.application_id) return;
                          await supabase.from("applications").update({ status: "rejected" }).eq("id", activeConvo.application_id);
                          setActiveConvo(prev => prev ? { ...prev, application_status: "rejected" } : null);
                          loadConversations();
                        }}
                        style={{ background: "transparent", color: "#ff3b30", border: "1px solid #222", borderRadius: "6px", padding: "6px 12px", fontSize: "11px", fontWeight: 600, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.05em" }}
                      >
                        Decline Creator
                      </button>
                    </>
                  ) : activeConvo.application_status === "paid" ? (
                    <span style={{ fontSize: "11px", color: "#34c759", background: "#0a1f0a", padding: "4px 10px", borderRadius: "12px", border: "1px solid #1a3a1a" }}>
                      Deal Locked — Paid
                    </span>
                  ) : (
                    <span style={{ fontSize: "11px", color: "#444", background: "#111", padding: "4px 10px", borderRadius: "12px", border: "1px solid #1a1a1a" }}>
                      Folder Closed (Declined)
                    </span>
                  )}
                </div>
              ) : (
                /* Creator Side Logic */
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-end", flexShrink: 0 }}>
                  {activeConvo.application_status === "rejected" ? (
                    <>
                      <span style={{ fontSize: "11px", color: "#ff3b30", background: "#221111", padding: "4px 10px", borderRadius: "12px", border: "1px solid #3a1a1a", fontWeight: 500 }}>
                        Application Screened Out
                      </span>
                      <p style={{ fontSize: "10px", color: "#666", margin: 0, textAlign: "right", maxWidth: "260px", lineHeight: "1.4" }}>
                        The brand decided to pass on this specific campaign brief. Keep your head up! Landing the right brand partnerships takes time—keep refining your pitch and the right match will click.
                      </p>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: "11px", color: "#666", background: "#111", padding: "4px 10px", borderRadius: "12px", border: "1px solid #1a1a1a", fontWeight: 500 }}>
                        ⚠️ Pending Terms Review
                      </span>
                      <p style={{ fontSize: "10px", color: "#444", margin: 0, textAlign: "right", maxWidth: "240px", lineHeight: "1.4" }}>
                        Brands can screen you out whenever they choose. Always sound professional even if you aren't their exact target.
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* CHAT MESSAGES STREAM */}
          <div style={{ padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "10px", paddingTop: stickyHeight ? `${stickyHeight}px` : "6rem", paddingBottom: inputBarHeight ? `${inputBarHeight + 112}px` : "12rem" }}>
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
          </div>

          {/* INPUT BAR CONTROLLER */}
          <div ref={inputBarRef} style={{ position: "fixed", bottom: "6.5rem", left: 0, right: 0, padding: "0.75rem 1.25rem", background: "#0a0a0a", borderTop: "1px solid #111", display: "flex", gap: "10px", alignItems: "center", zIndex: 100 }}>
            {activeConvo?.application_status === "rejected" ? (
              <div style={{ flex: 1, background: "#111", border: "1px solid #1a1a1a", borderRadius: "8px", padding: "12px", textTransform: "uppercase", fontSize: "11px", letterSpacing: "0.05em", color: "#444", textAlign: "center", fontWeight: 600 }}>
                🔒 Messaging disabled (application finalized)
              </div>
            ) : (
              <>
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
              </>
            )}
          </div>
        </>
      )}

      {paymentPopup && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }} onClick={() => setPaymentPopup(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: "14px", width: "100%", maxWidth: "360px", padding: "1.5rem", textAlign: "center" }}>
            <p style={{ fontFamily: "'Syne', sans-serif", color: "#fff", fontSize: "17px", fontWeight: 800, marginBottom: "10px" }}>{paymentPopup.title}</p>
            <p style={{ color: "#888", fontSize: "13px", lineHeight: 1.6, marginBottom: "1.5rem" }}>{paymentPopup.body}</p>
            <div onClick={() => setPaymentPopup(null)} style={{ padding: "12px", borderRadius: "8px", background: "#fff", color: "#0a0a0a", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: "pointer", textTransform: "uppercase" as const }}>
              Got it
            </div>
          </div>
        </div>
      )}

      {showPayment && paymentApp && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <Elements stripe={stripePromise}>
            <PaymentModalContent
              paymentApp={paymentApp}
              campaignBudget={campaignBudget}
              isEnterprise={isEnterprise}
              currentUserId={currentUserId}
              savedCard={savedCard}
              onClose={() => setShowPayment(false)}
              onSuccess={async (_app) => {
                setShowPayment(false);
                setActiveConvo(prev => prev ? { ...prev, application_status: "paid" } : null);
                await loadConversations();
              }}
            />
          </Elements>
        </div>
      )}

    </div>
  );
}