import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

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

export default function AdminReview({ goBack }: Props) {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"verification" | "reports">("verification");
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

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

  const header = (
    <div style={{ padding: "1rem 1.25rem", paddingTop: "calc(1rem + env(safe-area-inset-top, 0px))", display: "flex", alignItems: "center", gap: "12px", borderBottom: "1px solid #111", background: "#0a0a0a", position: "sticky", top: 0, zIndex: 10 }}>
      <span onClick={goBack} style={{ fontSize: "20px", color: "#fff", cursor: "pointer" }}>←</span>
      <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff" }}>Admin Review</span>
    </div>
  );

  if (loading) {
    return <div style={{ minHeight: "100vh", background: "#0a0a0a" }}>{header}</div>;
  }

  if (!authorized) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', sans-serif" }}>
        {header}
        <p style={{ padding: "2rem", color: "#555", fontSize: "13px", textAlign: "center" }}>Not authorized.</p>
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
      </div>

      <div style={{ padding: "1.25rem" }}>
        {tab === "verification" && (
          requests.length === 0 ? (
            <p style={{ color: "#333", fontSize: "12px", textAlign: "center", padding: "2rem" }}>No pending verification requests.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {requests.map(r => (
                <div key={r.id} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                    <div style={{ width: "32px", height: "32px", borderRadius: "8px", border: "1px solid #222", background: "#0a0a0a", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", color: "#333" }}>
                      {r.brand_logo ? <img src={r.brand_logo} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "◈"}
                    </div>
                    <div>
                      <p style={{ color: "#fff", fontSize: "13px", fontWeight: 600 }}>{r.brand_name}</p>
                      <p style={{ color: "#444", fontSize: "10px" }}>{new Date(r.requested_at).toLocaleString()}</p>
                    </div>
                  </div>
                  {r.note && <p style={{ color: "#777", fontSize: "12px", lineHeight: 1.6, marginBottom: "10px" }}>{r.note}</p>}
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
            <p style={{ color: "#333", fontSize: "12px", textAlign: "center", padding: "2rem" }}>No open reports.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {reports.map(r => (
                <div key={r.id} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem" }}>
                  <p style={{ color: "#fff", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>{r.reporter_name} reported {r.reported_name}</p>
                  <p style={{ color: "#777", fontSize: "12px", lineHeight: 1.6, marginBottom: "6px" }}>{r.reason}</p>
                  <p style={{ color: "#444", fontSize: "10px", marginBottom: "10px" }}>{new Date(r.created_at).toLocaleString()}</p>
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
      </div>
    </div>
  );
}
