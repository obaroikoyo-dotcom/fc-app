import { useRef, useState, useEffect } from "react";

interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PrivacyModal({ isOpen, onClose }: PrivacyModalProps) {
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
            Privacy Policy
          </h3>
          <p style={{ margin: "4px 0 0 0", color: "#999", fontSize: "12px" }}>
            How FlipCollab collects, uses, and protects your data.
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
          <p style={{ marginTop: 0, color: "#999", fontSize: "11px" }}>Last updated: January 2026</p>

          <p>This Privacy Policy explains how FlipCollab ("we", "us", "our") collects, uses, and protects your personal data when you use our platform. FlipCollab is operated from the United Kingdom and complies with the UK GDPR and the Data Protection Act 2018.</p>

          <div>
            <span style={{ color: "#fff", fontWeight: 600, display: "block", marginBottom: "4px" }}>1. Who We Are</span>
            <span>FlipCollab is a creator collaboration marketplace connecting brands with content creators. For data protection queries, contact us at <strong style={{ color: "#fff" }}>hello@flipcollab.com</strong>.</span>
          </div>

          <div>
            <span style={{ color: "#fff", fontWeight: 600, display: "block", marginBottom: "4px" }}>2. Data We Collect</span>
            <span>We collect the following personal data when you use FlipCollab:</span>
            <ul style={{ paddingLeft: "1.25rem", marginTop: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
              <li>Name and email address</li>
              <li>Profile information (avatar, bio, location, niche, social links)</li>
              <li>Payment data processed via Stripe (we do not store card details)</li>
              <li>Messages and campaign content you create on the platform</li>
              <li>Device and usage data (IP address, browser type, session data)</li>
            </ul>
          </div>

          <div>
            <span style={{ color: "#fff", fontWeight: 600, display: "block", marginBottom: "4px" }}>3. How We Use Your Data</span>
            <span>We use your data to:</span>
            <ul style={{ paddingLeft: "1.25rem", marginTop: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
              <li>Create and manage your account</li>
              <li>Match brands with creators</li>
              <li>Process payments and manage escrow</li>
              <li>Send transactional emails (account activity, payment confirmations)</li>
              <li>Resolve disputes and enforce our Terms & Conditions</li>
              <li>Comply with legal obligations</li>
            </ul>
          </div>

          <div>
            <span style={{ color: "#fff", fontWeight: 600, display: "block", marginBottom: "4px" }}>4. Legal Basis for Processing</span>
            <span>We process your data under the following lawful bases: contract performance (to provide the service you signed up for), legitimate interests (platform security, fraud prevention), and legal obligation (where required by law).</span>
          </div>

          <div>
            <span style={{ color: "#fff", fontWeight: 600, display: "block", marginBottom: "4px" }}>5. Third-Party Services</span>
            <span>We use the following third-party services to operate FlipCollab:</span>
            <ul style={{ paddingLeft: "1.25rem", marginTop: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
              <li><strong style={{ color: "#fff" }}>Supabase</strong> — database and authentication (data stored in EU)</li>
              <li><strong style={{ color: "#fff" }}>Stripe</strong> — payment processing (PCI-DSS compliant)</li>
              <li><strong style={{ color: "#fff" }}>Vercel</strong> — app hosting</li>
            </ul>
            <span style={{ display: "block", marginTop: "8px" }}>Each provider has their own privacy policy and data processing terms. We do not sell your data to any third party.</span>
          </div>

          <div>
            <span style={{ color: "#fff", fontWeight: 600, display: "block", marginBottom: "4px" }}>6. Data Retention</span>
            <span>We retain your data for as long as your account is active. If you delete your account, your personal data is deleted within 30 days, except where we are legally required to retain it (e.g. payment records for tax purposes, which are retained for 6 years under UK law).</span>
          </div>

          <div>
            <span style={{ color: "#fff", fontWeight: 600, display: "block", marginBottom: "4px" }}>7. Your Rights</span>
            <span>Under UK GDPR you have the right to:</span>
            <ul style={{ paddingLeft: "1.25rem", marginTop: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Object to or restrict processing</li>
              <li>Data portability</li>
              <li>Lodge a complaint with the ICO (ico.org.uk)</li>
            </ul>
            <span style={{ display: "block", marginTop: "8px" }}>To exercise any of these rights, email <strong style={{ color: "#fff" }}>hello@flipcollab.com</strong>.</span>
          </div>

          <div>
            <span style={{ color: "#fff", fontWeight: 600, display: "block", marginBottom: "4px" }}>8. Cookies</span>
            <span>FlipCollab uses essential cookies and local storage to keep you logged in and remember your preferences. We do not use tracking or advertising cookies.</span>
          </div>

          <div>
            <span style={{ color: "#fff", fontWeight: 600, display: "block", marginBottom: "4px" }}>9. Security</span>
            <span>We use industry-standard security measures including encrypted connections (HTTPS), secure authentication via Supabase, and PCI-compliant payment processing via Stripe. No system is 100% secure — if you suspect unauthorised access to your account, contact us immediately.</span>
          </div>

          <div>
            <span style={{ color: "#fff", fontWeight: 600, display: "block", marginBottom: "4px" }}>10. Children</span>
            <span>FlipCollab is not intended for users under 18. We do not knowingly collect data from minors. If we become aware of this, the account will be deleted immediately.</span>
          </div>

          <div>
            <span style={{ color: "#fff", fontWeight: 600, display: "block", marginBottom: "4px" }}>11. Changes to This Policy</span>
            <span>We may update this policy from time to time. We will notify you of significant changes via email or an in-app notice. Continued use of the platform after changes constitutes acceptance.</span>
          </div>

          <div>
            <span style={{ color: "#fff", fontWeight: 600, display: "block", marginBottom: "4px" }}>12. Contact</span>
            <span>For any privacy-related questions email <strong style={{ color: "#fff" }}>hello@flipcollab.com</strong>.</span>
          </div>

          <p style={{ color: "#777", fontSize: "11px", marginBottom: 0 }}>FlipCollab is operated in England and Wales. This policy is governed by UK law.</p>
        </div>

        {/* Footer */}
        <div style={{ padding: "1rem 1.25rem", borderTop: "1px solid #111" }}>
          <button
            onClick={onClose}
            style={{
              width: "100%",
              padding: "12px",
              background: hasScrolledToBottom ? "#fff" : "#161616",
              border: hasScrolledToBottom ? "1px solid #fff" : "1px solid #222",
              borderRadius: "8px",
              color: hasScrolledToBottom ? "#0a0a0a" : "#444",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s"
            }}
          >
            {hasScrolledToBottom ? "Close" : "Scroll to Read All"}
          </button>
        </div>
      </div>
    </div>
  );
}