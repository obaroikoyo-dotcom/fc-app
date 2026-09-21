import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { listUsers, setAccountStatus, type UserSearchResult } from "../lib/moderation";
import { useDelayedLoading } from "../lib/useDelayedLoading";
import { useHasLoadedOnce } from "../lib/useHasLoadedOnce";

const ADMIN_EMAIL = "obaroikoyo@gmail.com";

interface Props {
  goBack: () => void;
}

interface VerificationRequest {
  id: string;
  brand_id: string;
  note: string | null;
  requested_at: string;
  brand_name: string;
  brand_logo: string | null;
}

interface ReportRow {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  reason: string;
  created_at: string;
  reporter_name: string;
  reported_name: string;
}

interface DisputeRow {
  id: string;
  application_id: string;
  reason: string;
  created_at: string;
  brand_name: string;
  creator_name: string;
  campaign_name: string;
}

export default function AdminReview({ goBack }: Props) {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"verification" | "reports" | "disputes" | "accounts">("verification");
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDelayedLoading(loading);
  const hasLoadedOnce = useHasLoadedOnce(loading);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [users, setUsers] = useState<UserSearchResult[]>([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [userQuery, setUserQuery] = useState("");

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (tab === "accounts" && !usersLoaded) {
      listUsers().then(u => { setUsers(u); setUsersLoaded(true); });
    }
  }, [tab, usersLoaded]);

  const handleSetStatus = async (userId: string, status: "active" | "suspended" | "banned") => {
    setActioningId(userId);
    const { error } = await setAccountStatus(userId, status);
    setActioningId(null);
    if (!error) setUsers(prev => prev.map(u => u.id === userId ? { ...u, account_status: status } : u));
  };

  const filteredUsers = userQuery.trim()
    ? users.filter(u => u.name.toLowerCase().includes(userQuery.toLowerCase()) || u.email.toLowerCase().includes(userQuery.toLowerCase()))
    : users;

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.email !== ADMIN_EMAIL) {
      setAuthorized(false);
      setLoading(false);
      return;
    }
    setAuthorized(true);

    const { data: reqs } = await supabase
      .from("verification_requests")
      .select("id, brand_id, note, requested_at, brand_profiles(name, logo_url)")
      .eq("status", "pending")
      .order("requested_at", { ascending: true });
    setRequests((reqs || []).map((r: any) => ({
      id: r.id,
      brand_id: r.brand_id,
      note: r.note,
      requested_at: r.requested_at,
      brand_name: r.brand_profiles?.name || "Brand",
      brand_logo: r.brand_profiles?.logo_url || null,
    })));

    const { data: reportRows } = await supabase
      .from("reports")
      .select("id, reporter_id, reported_user_id, reason, created_at")
      .eq("status", "open")
      .order("created_at", { ascending: true });

    if (reportRows && reportRows.length > 0) {
      const ids = Array.from(new Set([...reportRows.map(r => r.reporter_id), ...reportRows.map(r => r.reported_user_id)]));
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, role, creator_profiles(name), brand_profiles(name)")
        .in("id", ids);
      const nameFor = (id: string) => {
        const p = profiles?.find((p: any) => p.id === id) as any;
        if (!p) return "Unknown user";
        return (p.role === "creator" ? p.creator_profiles?.name : p.brand_profiles?.name) || "Unknown user";
      };
      setReports(reportRows.map(r => ({
        id: r.id,
        reporter_id: r.reporter_id,
        reported_user_id: r.reported_user_id,
        reason: r.reason,
        created_at: r.created_at,
        reporter_name: nameFor(r.reporter_id),
        reported_name: nameFor(r.reported_user_id),
      })));
    } else {
      setReports([]);
    }

    const { data: disputeRows } = await supabase
      .from("disputes")
      .select("id, application_id, reason, created_at, applications(campaign_id, campaigns(name, brand_id, brand_profiles(name)), creator_id, creator_profiles(name))")
      .eq("status", "open")
      .order("created_at", { ascending: true });

    setDisputes((disputeRows || []).map((d: any) => ({
      id: d.id,
      application_id: d.application_id,
      reason: d.reason,
      created_at: d.created_at,
      brand_name: d.applications?.campaigns?.brand_profiles?.name || "Brand",
      creator_name: d.applications?.creator_profiles?.name || "Creator",
      campaign_name: d.applications?.campaigns?.name || "Campaign",
    })));

    setLoading(false);
  };

  const handleApprove = async (id: string) => {
    setActioningId(id);
    const { error } = await supabase.rpc("approve_verification_request", { target_request_id: id });
    setActioningId(null);
    if (!error) setRequests(prev => prev.filter(r => r.id !== id));
  };

  const handleReject = async (id: string) => {
    setActioningId(id);
    const { error } = await supabase.rpc("reject_verification_request", { target_request_id: id });
    setActioningId(null);
    if (!error) setRequests(prev => prev.filter(r => r.id !== id));
  };

  const handleResolveReport = async (id: string) => {
    setActioningId(id);
    const { error } = await supabase.rpc("resolve_report", { target_report_id: id });
    setActioningId(null);
    if (!error) setReports(prev => prev.filter(r => r.id !== id));
  };

  const handleResolveDispute = async (id: string, resolution: "refund" | "release") => {
    setResolvingId(id);
    const { error } = await supabase.functions.invoke("resolve-dispute", { body: { dispute_id: id, resolution } });
    setResolvingId(null);
    if (!error) {
      setDisputes(prev => prev.filter(d => d.id !== id));
    } else {
      let message = "Failed to resolve dispute.";
      try {
        const errBody = await (error as any)?.context?.json();
        if (errBody?.error) message = errBody.error;
      } catch { /* fall back to generic message */ }
      alert(message);
    }
  };

  const header = (
    <div style={{ padding: "1rem 1.25rem", paddingTop: "calc(1rem + env(safe-area-inset-top, 0px))", display: "flex", alignItems: "center", gap: "12px", borderBottom: "1px solid #111", background: "#0a0a0a", position: "sticky", top: 0, zIndex: 10 }}>
      <span onClick={goBack} style={{ fontSize: "20px", color: "#fff", cursor: "pointer" }}>←</span>
      <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff" }}>Admin Review</span>
    </div>
  );

  if (loading && !hasLoadedOnce && !showSkeleton) {
    return <div style={{ minHeight: "100vh", background: "#0a0a0a" }}>{header}</div>;
  }

  if (loading && !hasLoadedOnce) {
    const pulse = "pulse 1.5s ease-in-out infinite";
    const bar = (w: string, h: string, extra: React.CSSProperties = {}) => (
      <div style={{ width: w, height: h, borderRadius: "4px", background: "#1a1a1a", animation: pulse, ...extra }} />
    );
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif" }}>
        <style>{`@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }`}</style>
        {header}
        <div style={{ display: "flex", borderBottom: "1px solid #111" }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ flex: 1, padding: "14px", display: "flex", justifyContent: "center" }}>{bar("60px", "12px")}</div>
          ))}
        </div>
        <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "10px" }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                {bar("32px", "32px", { borderRadius: "8px" })}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {bar("120px", "13px")}
                  {bar("80px", "10px")}
                </div>
              </div>
              {bar("100%", "32px", { borderRadius: "8px" })}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', sans-serif" }}>
        {header}
        <p style={{ padding: "2rem", color: "#999", fontSize: "13px", textAlign: "center" }}>Not authorized.</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", paddingBottom: "4rem" }}>
      {header}

      <div style={{ display: "flex", borderBottom: "1px solid #111" }}>
        <button onClick={() => setTab("verification")} style={{ flex: 1, padding: "14px", background: "transparent", border: "none", borderBottom: tab === "verification" ? "2px solid #fff" : "2px solid transparent", color: tab === "verification" ? "#fff" : "#444", fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit" }}>
          Verification ({requests.length})
        </button>
        <button onClick={() => setTab("reports")} style={{ flex: 1, padding: "14px", background: "transparent", border: "none", borderBottom: tab === "reports" ? "2px solid #fff" : "2px solid transparent", color: tab === "reports" ? "#fff" : "#444", fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit" }}>
          Reports ({reports.length})
        </button>
        <button onClick={() => setTab("disputes")} style={{ flex: 1, padding: "14px", background: "transparent", border: "none", borderBottom: tab === "disputes" ? "2px solid #fff" : "2px solid transparent", color: tab === "disputes" ? "#fff" : "#444", fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit" }}>
          Disputes ({disputes.length})
        </button>
        <button onClick={() => setTab("accounts")} style={{ flex: 1, padding: "14px", background: "transparent", border: "none", borderBottom: tab === "accounts" ? "2px solid #fff" : "2px solid transparent", color: tab === "accounts" ? "#fff" : "#444", fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit" }}>
          Accounts
        </button>
      </div>

      <div style={{ padding: "1.25rem" }}>
        {tab === "verification" && (
          requests.length === 0 ? (
            <p style={{ color: "#777", fontSize: "12px", textAlign: "center", padding: "2rem" }}>No pending verification requests.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {requests.map(r => (
                <div key={r.id} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                    <div style={{ width: "32px", height: "32px", borderRadius: "8px", border: "1px solid #222", background: "#0a0a0a", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", color: "#777" }}>
                      {r.brand_logo ? <img src={r.brand_logo} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "◈"}
                    </div>
                    <div>
                      <p style={{ color: "#fff", fontSize: "13px", fontWeight: 600 }}>{r.brand_name}</p>
                      <p style={{ color: "#888", fontSize: "10px" }}>{new Date(r.requested_at).toLocaleString()}</p>
                    </div>
                  </div>
                  {r.note && <p style={{ color: "#bbb", fontSize: "12px", lineHeight: 1.6, marginBottom: "10px" }}>{r.note}</p>}
                  <div style={{ display: "flex", gap: "8px" }}>
                    <div
                      onClick={() => actioningId ? undefined : handleApprove(r.id)}
                      style={{ flex: 1, padding: "10px", borderRadius: "8px", background: "#fff", color: "#0a0a0a", fontSize: "12px", fontWeight: 600, textAlign: "center", cursor: actioningId ? "default" : "pointer", opacity: actioningId === r.id ? 0.6 : 1 }}
                    >
                      {actioningId === r.id ? "..." : "Approve"}
                    </div>
                    <div
                      onClick={() => actioningId ? undefined : handleReject(r.id)}
                      style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid rgba(255,77,77,0.3)", color: "#ff4d4d", fontSize: "12px", fontWeight: 600, textAlign: "center", cursor: actioningId ? "default" : "pointer", opacity: actioningId === r.id ? 0.6 : 1 }}
                    >
                      Reject
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {tab === "reports" && (
          reports.length === 0 ? (
            <p style={{ color: "#777", fontSize: "12px", textAlign: "center", padding: "2rem" }}>No open reports.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {reports.map(r => (
                <div key={r.id} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem" }}>
                  <p style={{ color: "#fff", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>{r.reporter_name} reported {r.reported_name}</p>
                  <p style={{ color: "#bbb", fontSize: "12px", lineHeight: 1.6, marginBottom: "6px" }}>{r.reason}</p>
                  <p style={{ color: "#888", fontSize: "10px", marginBottom: "10px" }}>{new Date(r.created_at).toLocaleString()}</p>
                  <div
                    onClick={() => actioningId ? undefined : handleResolveReport(r.id)}
                    style={{ padding: "10px", borderRadius: "8px", border: "1px solid #222", color: "#ccc", fontSize: "12px", fontWeight: 600, textAlign: "center", cursor: actioningId ? "default" : "pointer", opacity: actioningId === r.id ? 0.6 : 1 }}
                  >
                    {actioningId === r.id ? "..." : "Mark Resolved"}
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {tab === "disputes" && (
          disputes.length === 0 ? (
            <p style={{ color: "#777", fontSize: "12px", textAlign: "center", padding: "2rem" }}>No open disputes.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {disputes.map(d => {
                const daysOpen = Math.floor((Date.now() - new Date(d.created_at).getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={d.id} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                      <p style={{ color: "#fff", fontSize: "13px", fontWeight: 600 }}>{d.brand_name} vs {d.creator_name}</p>
                      <span style={{ fontSize: "9px", padding: "2px 7px", borderRadius: "4px", background: daysOpen >= 3 ? "rgba(255,59,48,0.1)" : "#1a1a1a", border: `1px solid ${daysOpen >= 3 ? "rgba(255,59,48,0.3)" : "#222"}`, color: daysOpen >= 3 ? "#ff4d4d" : "#888", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.05em", flexShrink: 0 }}>
                        {daysOpen === 0 ? "Today" : `${daysOpen}d open`}
                      </span>
                    </div>
                    <p style={{ color: "#888", fontSize: "10px", marginBottom: "8px" }}>{d.campaign_name} · {new Date(d.created_at).toLocaleString()}</p>
                    <p style={{ color: "#bbb", fontSize: "12px", lineHeight: 1.6, marginBottom: "12px" }}>{d.reason}</p>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <div
                        onClick={() => resolvingId ? undefined : handleResolveDispute(d.id, "refund")}
                        style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid rgba(255,77,77,0.3)", color: "#ff4d4d", fontSize: "12px", fontWeight: 600, textAlign: "center", cursor: resolvingId ? "default" : "pointer", opacity: resolvingId === d.id ? 0.6 : 1 }}
                      >
                        {resolvingId === d.id ? "..." : "Refund Brand"}
                      </div>
                      <div
                        onClick={() => resolvingId ? undefined : handleResolveDispute(d.id, "release")}
                        style={{ flex: 1, padding: "10px", borderRadius: "8px", background: "#fff", color: "#0a0a0a", fontSize: "12px", fontWeight: 600, textAlign: "center", cursor: resolvingId ? "default" : "pointer", opacity: resolvingId === d.id ? 0.6 : 1 }}
                      >
                        Release to Creator
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {tab === "accounts" && (
          <>
            <input
              value={userQuery}
              onChange={e => setUserQuery(e.target.value)}
              placeholder="Search by name or email..."
              style={{ width: "100%", background: "#111", border: "1px solid #222", borderRadius: "8px", padding: "11px 14px", color: "#fff", fontSize: "14px", outline: "none", fontFamily: "inherit", marginBottom: "1rem", boxSizing: "border-box" as const }}
            />
            {!usersLoaded ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <style>{`@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }`}</style>
                {[1, 2, 3].map(i => (
                  <div key={i} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem", display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#1a1a1a", animation: "pulse 1.5s ease-in-out infinite", flexShrink: 0 }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
                      <div style={{ width: "120px", height: "13px", borderRadius: "4px", background: "#1a1a1a", animation: "pulse 1.5s ease-in-out infinite" }} />
                      <div style={{ width: "160px", height: "10px", borderRadius: "4px", background: "#1a1a1a", animation: "pulse 1.5s ease-in-out infinite" }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredUsers.length === 0 ? (
              <p style={{ color: "#777", fontSize: "12px", textAlign: "center", padding: "2rem" }}>{userQuery ? "No matching accounts." : "No accounts found."}</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {filteredUsers.slice(0, 30).map(u => (
                  <div key={u.id} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                      <div style={{ width: "32px", height: "32px", borderRadius: u.role === "creator" ? "50%" : "8px", border: "1px solid #222", background: "#0a0a0a", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", color: "#777" }}>
                        {u.avatar_url ? <img src={u.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : u.role === "creator" ? "◉" : "◈"}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ color: "#fff", fontSize: "13px", fontWeight: 600 }}>{u.name}</p>
                        <p style={{ color: "#888", fontSize: "10px", textTransform: "capitalize" }}>{u.role} · {u.email}</p>
                      </div>
                      <span style={{
                        fontSize: "10px", padding: "3px 9px", borderRadius: "20px", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.04em", flexShrink: 0,
                        border: `1px solid ${u.account_status === "active" ? "#333" : u.account_status === "suspended" ? "rgba(255,149,0,0.4)" : "rgba(255,77,77,0.4)"}`,
                        color: u.account_status === "active" ? "#888" : u.account_status === "suspended" ? "#ff9500" : "#ff4d4d",
                      }}>
                        {u.account_status}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      {u.account_status !== "active" ? (
                        <div
                          onClick={() => actioningId ? undefined : handleSetStatus(u.id, "active")}
                          style={{ flex: 1, padding: "10px", borderRadius: "8px", background: "#fff", color: "#0a0a0a", fontSize: "12px", fontWeight: 600, textAlign: "center", cursor: actioningId ? "default" : "pointer", opacity: actioningId === u.id ? 0.6 : 1 }}
                        >
                          {actioningId === u.id ? "..." : "Reactivate"}
                        </div>
                      ) : (
                        <>
                          <div
                            onClick={() => actioningId ? undefined : handleSetStatus(u.id, "suspended")}
                            style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid rgba(255,149,0,0.35)", color: "#ff9500", fontSize: "12px", fontWeight: 600, textAlign: "center", cursor: actioningId ? "default" : "pointer", opacity: actioningId === u.id ? 0.6 : 1 }}
                          >
                            Suspend
                          </div>
                          <div
                            onClick={() => actioningId ? undefined : handleSetStatus(u.id, "banned")}
                            style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid rgba(255,77,77,0.35)", color: "#ff4d4d", fontSize: "12px", fontWeight: 600, textAlign: "center", cursor: actioningId ? "default" : "pointer", opacity: actioningId === u.id ? 0.6 : 1 }}
                          >
                            Ban
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
