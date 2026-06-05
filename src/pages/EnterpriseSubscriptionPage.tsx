import { useState } from "react";
import { type Page } from "../App";

export default function EnterpriseSubscriptionPage({ navigate }: { navigate: (page: Page) => void }) {
  const [showModal, setShowModal] = useState(false);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", color: "#fff" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');`}</style>

      {/* Header */}
      <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #111", display: "flex", alignItems: "center", gap: "12px" }}>
        <span onClick={() => navigate("brand-dashboard")} style={{ fontSize: "20px", color: "#555", cursor: "pointer" }}>←</span>
        <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff" }}>FlipCollab Enterprise</span>
      </div>

      <div style={{ padding: "2rem 1.25rem", paddingBottom: "6rem", maxWidth: "480px", margin: "0 auto" }}>

        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <span style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#555", display: "block", marginBottom: "1rem" }}>
            Tier Upgrade
          </span>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "30px", fontWeight: 800, lineHeight: 1.15, color: "#fff", marginBottom: "1rem" }}>
            Scale Your Campaigns.<br />Pay Zero Fees.
          </h1>
          <p style={{ fontSize: "14px", color: "#555", lineHeight: 1.7 }}>
            Unlock 0% platform fees for you and your creators, plus advanced tools built for high-volume brand operations.
          </p>
        </div>

        {/* Fee Comparison */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "2.5rem" }}>
          {/* Standard */}
          <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "12px", padding: "1.25rem" }}>
            <p style={{ fontSize: "12px", color: "#444", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600, marginBottom: "12px" }}>Standard</p>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "8px" }}>
              <span style={{ color: "#555" }}>Brand platform fee</span>
              <span style={{ color: "#777" }}>+5% per checkout</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
              <span style={{ color: "#555" }}>Creator platform fee</span>
              <span style={{ color: "#777" }}>-10% from payout</span>
            </div>
          </div>

          {/* Enterprise */}
          <div style={{ background: "#fff", border: "1px solid #fff", borderRadius: "12px", padding: "1.25rem", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, right: 0, background: "#0a0a0a", color: "#fff", fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", padding: "4px 12px", borderBottomLeftRadius: "8px" }}>
              Maximize ROI
            </div>
            <p style={{ fontSize: "12px", color: "#888", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600, marginBottom: "12px" }}>Enterprise</p>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "8px" }}>
              <span style={{ color: "#333" }}>Brand platform fee</span>
              <span style={{ color: "#0a0a0a", fontWeight: 700 }}>0% waived</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
              <span style={{ color: "#333" }}>Creator platform fee</span>
              <span style={{ color: "#0a0a0a", fontWeight: 700 }}>0% waived</span>
            </div>
          </div>
        </div>

        {/* Features */}
        <div style={{ marginBottom: "2.5rem" }}>
          <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "16px", fontWeight: 800, color: "#fff", marginBottom: "1rem" }}>What's included</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[
              { title: "Zero Platform Fees", sub: "No percentage cuts on brand or creator side — ever." },
              { title: "Unlimited Campaigns", sub: "Run as many concurrent campaigns as your brand needs." },
              { title: "Advanced Creator Filters", sub: "Filter by deeper metric brackets and audience data." },
              { title: "Priority Support", sub: "Direct line to resolve disputes, payments, or workflow issues." },
              { title: "Team Access", sub: "Multiple brand team members under one account." },
            ].map(({ title, sub }) => (
              <div key={title} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem", display: "flex", gap: "12px", alignItems: "flex-start" }}>
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#fff", flexShrink: 0, marginTop: "5px" }} />
                <div>
                  <p style={{ fontSize: "13px", fontWeight: 600, color: "#fff", marginBottom: "3px" }}>{title}</p>
                  <p style={{ fontSize: "12px", color: "#555", lineHeight: 1.5 }}>{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing block */}
        <div style={{ background: "#111", border: "1px solid #222", borderRadius: "14px", padding: "1.5rem", textAlign: "center", marginBottom: "2.5rem" }}>
          <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "20px", fontWeight: 800, color: "#fff", marginBottom: "4px" }}>Enterprise Plan</p>
          <p style={{ fontSize: "12px", color: "#444", marginBottom: "1.5rem" }}>Scalable access for modern brand workflows</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "1.5rem" }}>
            <div style={{ background: "#0a0a0a", border: "1px solid #222", borderRadius: "10px", padding: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ textAlign: "left" }}>
                <p style={{ fontSize: "11px", color: "#444", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600, marginBottom: "4px" }}>Monthly</p>
                <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "26px", fontWeight: 800, color: "#fff" }}>£82<span style={{ fontSize: "13px", color: "#555", fontWeight: 400 }}>/mo</span></p>
              </div>
              <span style={{ fontSize: "11px", color: "#555", border: "1px solid #222", borderRadius: "20px", padding: "4px 10px" }}>Cancel anytime</span>
            </div>
            <div style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: "10px", padding: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, right: 0, background: "#fff", color: "#0a0a0a", fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", padding: "3px 10px", borderBottomLeftRadius: "6px" }}>Best Value</div>
              <div style={{ textAlign: "left" }}>
                <p style={{ fontSize: "11px", color: "#444", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600, marginBottom: "4px" }}>Annual</p>
                <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "26px", fontWeight: 800, color: "#fff" }}>£52<span style={{ fontSize: "13px", color: "#555", fontWeight: 400 }}>/mo</span></p>
                <p style={{ fontSize: "11px", color: "#555", marginTop: "2px" }}>£624 billed annually</p>
              </div>
              <span style={{ fontSize: "11px", color: "#fff", border: "1px solid #333", borderRadius: "20px", padding: "4px 10px" }}>Save £360/yr</span>
            </div>
          </div>
          <div onClick={() => setShowModal(true)} style={{ padding: "14px", borderRadius: "8px", background: "#fff", color: "#0a0a0a", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Upgrade to Enterprise
          </div>
        </div>

        {/* FAQ */}
        <div>
          <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "16px", fontWeight: 800, color: "#fff", marginBottom: "1rem" }}>FAQs</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[
              { q: "How does 0% fees work?", a: "Once Enterprise activates, platform fee calculations are bypassed at checkout — for both you and every creator you work with." },
              { q: "Are card processing fees separate?", a: "Yes. Standard Stripe processing fees remain. Enterprise only waives FlipCollab's own platform service fees." },
              { q: "Can I cancel anytime?", a: "Yes. Enterprise is subscription-based and can be cancelled with 30 days' notice. No lock-in contracts." },
            ].map(({ q, a }) => (
              <div key={q} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem" }}>
                <p style={{ fontSize: "13px", fontWeight: 600, color: "#fff", marginBottom: "6px" }}>{q}</p>
                <p style={{ fontSize: "12px", color: "#555", lineHeight: 1.6 }}>{a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Coming Soon Modal */}
      {showModal && (
        <div onClick={() => setShowModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.25rem" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: "14px", padding: "2rem", width: "100%", maxWidth: "380px", textAlign: "center" }}>
            <div style={{ fontSize: "36px", marginBottom: "1rem" }}>🚀</div>
            <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "20px", fontWeight: 800, color: "#fff", marginBottom: "8px" }}>Coming Soon</p>
            <p style={{ fontSize: "13px", color: "#555", lineHeight: 1.7, marginBottom: "1.5rem" }}>
              Enterprise subscriptions are launching very soon. Drop your email and we'll notify you the moment it goes live.
            </p>
            <input
              placeholder="your@email.com"
              style={{ background: "#111", border: "1px solid #222", borderRadius: "8px", padding: "11px 14px", color: "#fff", fontSize: "14px", outline: "none", width: "100%", fontFamily: "inherit", marginBottom: "10px", boxSizing: "border-box" }}
            />
            <div onClick={() => setShowModal(false)} style={{ padding: "13px", borderRadius: "8px", background: "#fff", color: "#0a0a0a", fontSize: "13px", fontWeight: 600, cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Notify Me
            </div>
            <p onClick={() => setShowModal(false)} style={{ fontSize: "12px", color: "#333", marginTop: "12px", cursor: "pointer" }}>Dismiss</p>
          </div>
        </div>
      )}
    </div>
  );
}