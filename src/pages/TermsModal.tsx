import { useState, useRef, useEffect } from "react";

interface TermsModalProps {
  isOpen: boolean;
  onAccept: () => void;
  onClose: () => void;
  role: "brand" | "creator";
}

export default function TermsModal({ isOpen, onAccept, onClose, role }: TermsModalProps) {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const textContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setHasScrolledToBottom(false);
      if (textContainerRef.current) {
        textContainerRef.current.scrollTop = 0;
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleScroll = () => {
    const el = textContainerRef.current;
    if (!el) return;
    
    // Check if user reached within 10px of the bottom scroll boundary
    if (el.scrollHeight - el.scrollTop <= el.clientHeight + 10) {
      setHasScrolledToBottom(true);
    }
  };

  return (
    <div style={{
      position: "fixed",
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(0,0,0,0.85)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
      padding: "1rem",
      fontFamily: "'DM Sans', sans-serif"
    }}>
      <div style={{
        background: "#0a0a0a",
        border: "1px solid #1a1a1a",
        borderRadius: "14px",
        width: "100%",
        maxWidth: "480px",
        display: "flex",
        flexDirection: "column",
        maxHeight: "85vh",
        overflow: "hidden"
      }}>
        {/* Header */}
        <div style={{ padding: "1.25rem", borderBottom: "1px solid #111" }}>
          <h3 style={{ margin: 0, color: "#fff", fontSize: "16px", fontWeight: 600, fontFamily: "'Syne', sans-serif" }}>
            Terms & Conditions
          </h3>
          <p style={{ margin: "4px 0 0 0", color: "#999", fontSize: "12px" }}>
  You must read and accept these terms before creating your account.
</p>
        </div>

        {/* Scrollable Content */}
        <div 
          ref={textContainerRef}
          onScroll={handleScroll}
          style={{ 
            padding: "1.25rem", 
            overflowY: "auto", 
            flex: 1,
            minHeight: 0,
            color: "#aaa", 
            fontSize: "13px", 
            lineHeight: "1.6",
            display: "flex",
            flexDirection: "column",
            gap: "1rem"
          }}
        >
          <p style={{ marginTop: 0, color: "#999", fontSize: "11px" }}>Last updated: August 2026</p>

          <p>Welcome to FlipCollab. By creating an account and using our platform, you agree to these Terms & Conditions. Please read them carefully.</p>

          {/* Fees Block */}
          <div style={{ background: "#111", border: "1px solid #222", borderRadius: "8px", padding: "12px" }}>
            <p style={{ color: "#fff", fontWeight: 600, margin: "0 0 6px 0", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Platform Fees</p>
            {role === "brand" ? (
              <p style={{ margin: 0, color: "#ccc" }}>
                Posting campaigns and reviewing applications is free. When you fund a collaboration, a <strong style={{ color: "#fff" }}>5% platform fee</strong> is added to the campaign budget to cover payment processing and escrow management. Enterprise brands pay no platform fee; instead their payments carry a <strong style={{ color: "#fff" }}>card processing fee of 2.5% + 20p</strong> of the campaign budget, added to the amount charged and shown before you pay. If a deal is refunded, you're refunded everything you paid for it.
              </p>
            ) : (
              <p style={{ margin: 0, color: "#ccc" }}>
                FlipCollab deducts a <strong style={{ color: "#fff" }}>10% platform fee</strong> from your earnings on each completed collaboration. This covers payment processing, escrow protection, and platform operations. If the brand is on Enterprise, there is no platform fee and you keep 100%; any card processing fee is charged to the brand, never deducted from your payout.
              </p>
            )}
          </div>

          <div>
            <span style={{ color: "#fff", fontWeight: 600, display: "block", marginBottom: "4px" }}>1. About FlipCollab</span>
            <span>FlipCollab is a creator collaboration marketplace that connects brands with content creators for paid and gifted campaigns. By using FlipCollab you agree to these terms. You must be at least 18 years old to use FlipCollab.</span>
          </div>

          <div>
            <span style={{ color: "#fff", fontWeight: 600, display: "block", marginBottom: "4px" }}>2. Your Account</span>
            <span>You are responsible for keeping your account credentials secure. FlipCollab is not liable for any loss resulting from unauthorised access to your account. You may delete your account at any time from your profile settings.</span>
          </div>

          {role === "brand" ? (
            <div>
              <span style={{ color: "#fff", fontWeight: 600, display: "block", marginBottom: "4px" }}>3. Brand Responsibilities</span>
              <span>Brands agree to post accurate and truthful campaign information. You agree to pay agreed fees promptly and not attempt to contact or pay creators outside of FlipCollab to avoid platform fees. Doing so will result in immediate account termination.</span>
            </div>
          ) : (
            <div>
              <span style={{ color: "#fff", fontWeight: 600, display: "block", marginBottom: "4px" }}>3. Creator Responsibilities</span>
              <span>Creators agree to deliver content as described in accepted campaigns within the agreed timeframe. You agree not to accept payment from brands outside of FlipCollab to avoid platform fees. Doing so will result in immediate account termination.</span>
            </div>
          )}

          <div>
            <span style={{ color: "#fff", fontWeight: 600, display: "block", marginBottom: "4px" }}>4. Payments, Deliverables & Disputes</span>
            <span>(a) Escrow. All payments are processed via Stripe. A brand's payment is held in escrow and is never paid out instantly. It is released to the creator when the brand releases it after reviewing the deliverable, when a required post is confirmed live (where the campaign requires one), or automatically 7 days after the creator uploads the deliverable (or after the brand pays, if the creator uploaded first) if the brand takes no action. Creator payouts go straight to the creator's own connected Stripe account - FlipCollab never holds a creator's bank details. (b) Previews. Until the payment is released, a brand sees the deliverable only as a watermarked preview, and must not copy, record, download, share or use the preview or the deliverable in any way before then. The full-quality video is available once the payment is released. (c) Revisions. A brand may ask the creator for another video up to 2 times per deal. The creator has 7 days from each request to upload a new one, and if none arrives in that time the payment is refunded to the brand automatically. Each new upload restarts the 7-day review period. (d) Disputes. A brand can dispute a delivery in-app within 7 days of the upload. A creator can dispute a request for another video while they are waiting to resend, and can add their side to a dispute raised against them. While a dispute is open the funds stay held. A FlipCollab admin reviews it, including the deliverable and the chat history between the brand and the creator, and decides to refund the brand or release the payment to the creator. That decision is final within FlipCollab. (e) Active deals. Once a deal is funded, the brand cannot screen out the creator, delete the campaign or block the creator until the deal has been released, refunded or resolved.</span>
          </div>

          <div>
  <span style={{ color: "#fff", fontWeight: 600, display: "block", marginBottom: "4px" }}>5. Payment Processing & Delays</span>
  <span>During scheduled maintenance, software updates, or technical incidents, payment processing may be temporarily delayed. All funds held in escrow are guaranteed to be processed and delivered to the intended recipient once normal operations resume. FlipCollab is not liable for delays caused by third-party payment processors including Stripe.</span>
</div>

          <div>
  <span style={{ color: "#fff", fontWeight: 600, display: "block", marginBottom: "4px" }}>6. Prohibited Content</span>
  <span>Users may not post content that is illegal, hateful, sexually explicit, discriminatory, or misleading. FlipCollab reserves the right to remove content and suspend, delete, or permanently restrict accounts that violate this policy without notice. In cases of serious violations including but not limited to fraud, harassment, or illegal activity, FlipCollab reserves the right to permanently withhold any funds held in the offending account pending investigation, with no obligation to release them.</span>
</div>

          <div>
            <span style={{ color: "#fff", fontWeight: 600, display: "block", marginBottom: "4px" }}>7. Intellectual Property</span>
            <span>Creators retain ownership of their content. By completing a campaign, creators grant the brand a non-exclusive licence to use the content for promotional purposes as agreed in the campaign brief.</span>
          </div>

          <div>
            <span style={{ color: "#fff", fontWeight: 600, display: "block", marginBottom: "4px" }}>8. Privacy</span>
            <span>We collect your name, email, profile information, and payment data to operate the platform. We use Supabase for data storage, Stripe for payments, and Vercel for hosting. We do not sell your personal data. For full details see our Privacy Policy.</span>
          </div>

          <div>
            <span style={{ color: "#fff", fontWeight: 600, display: "block", marginBottom: "4px" }}>9. Limitation of Liability</span>
            <span>FlipCollab is not liable for any indirect or consequential loss arising from use of the platform, including disputes between brands and creators.</span>
          </div>

          <div>
            <span style={{ color: "#fff", fontWeight: 600, display: "block", marginBottom: "4px" }}>10. Governing Law</span>
            <span>These terms are governed by the laws of England and Wales.</span>
          </div>

          <div>
  <span style={{ color: "#fff", fontWeight: 600, display: "block", marginBottom: "4px" }}>11. In-App Purchases</span>
  <span>FlipCollab offers subscription plans and campaign payment processing as in-app purchases. All purchases are final unless otherwise required by applicable law. Subscription fees are charged on a recurring basis and can be cancelled at any time. Cancellation takes effect at the end of the current billing period. No refunds are issued for partial periods.</span>
</div>

<div>
  <span style={{ color: "#fff", fontWeight: 600, display: "block", marginBottom: "4px" }}>12. App Store Compliance</span>
  <span>If FlipCollab is distributed through the Apple App Store or Google Play Store, use of the app is also subject to the respective platform's terms of service. Apple Inc. and Google LLC are not responsible for the app or its content. Any claims relating to the app must be directed to FlipCollab, not to Apple or Google.</span>
</div>

          <div>
            <span style={{ color: "#fff", fontWeight: 600, display: "block", marginBottom: "4px" }}>13. Contact</span>
            <span>For any questions or disputes email us at <strong style={{ color: "#fff" }}>hello@flipcollab.com</strong></span>
          </div>

          <p style={{ color: "#777", fontSize: "11px", marginBottom: 0 }}>By accepting these terms you confirm you are 18 or over and agree to be bound by these Terms & Conditions.</p>
        </div>
        {/* Footer Actions */}
        <div style={{ padding: "1rem 1.25rem", borderTop: "1px solid #111", display: "flex", gap: "10px" }}>
          <button 
            onClick={onClose}
            style={{
              flex: 1,
              padding: "12px",
              background: "transparent",
              border: "1px solid #222",
              borderRadius: "8px",
              color: "#999",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            Decline
          </button>
          
          <button 
            disabled={!hasScrolledToBottom}
            onClick={onAccept}
            style={{
              flex: 2,
              padding: "12px",
              background: hasScrolledToBottom ? "#fff" : "#161616",
              border: hasScrolledToBottom ? "1px solid #fff" : "1px solid #222",
              borderRadius: "8px",
              color: hasScrolledToBottom ? "#0a0a0a" : "#444",
              fontSize: "12px",
              fontWeight: 600,
              cursor: hasScrolledToBottom ? "pointer" : "not-allowed",
              transition: "all 0.2s"
            }}
          >
            {hasScrolledToBottom ? "Accept & Continue" : "Scroll to Read All Terms"}
          </button>
        </div>
      </div>
    </div>
  );
}