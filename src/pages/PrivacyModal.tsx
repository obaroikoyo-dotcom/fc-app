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
          <p style={{ marginTop: 0, color: "#999", fontSize: "11px" }}>Last updated: August 2026</p>

          <p>This Privacy Policy explains how FlipCollab ("we", "us", "our") collects, uses, and protects your personal data when you use our platform. FlipCollab is operated from the United Kingdom and complies with the UK GDPR and the Data Protection Act 2018.</p>

          <div>
            <span style={{ color: "#fff", fontWeight: 600, display: "block", marginBottom: "4px" }}>1. Who We Are</span>
            <span>FlipCollab is a creator collaboration marketplace connecting brands with content creators. If you have any questions about how we handle your data, reach us at <strong style={{ color: "#fff" }}>hello@flipcollab.com</strong>.</span>
          </div>

          <div>
            <span style={{ color: "#fff", fontWeight: 600, display: "block", marginBottom: "4px" }}>2. Information We Collect</span>
            <span>To run FlipCollab, we collect:</span>
            <ul style={{ paddingLeft: "1.25rem", marginTop: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
              <li>Your name and email address</li>
              <li>Profile details you choose to share (photo, bio, location, niche, social links)</li>
              <li>Messages and campaign content you create on the platform</li>
              <li>Basic device and usage data, like your browser type and IP address</li>
              <li>Payment details, handled directly by Stripe - we never see or store your card number</li>
            </ul>
          </div>

          <div>
            <span style={{ color: "#fff", fontWeight: 600, display: "block", marginBottom: "4px" }}>3. How We Use It</span>
            <span>We use this information to:</span>
            <ul style={{ paddingLeft: "1.25rem", marginTop: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
              <li>Create and manage your account</li>
              <li>Match brands with creators</li>
              <li>Process payments and manage escrow</li>
              <li>Send you account and payment-related emails</li>
              <li>Resolve disputes and enforce our Terms & Conditions</li>
              <li>Meet our legal obligations</li>
            </ul>
          </div>

          <div>
            <span style={{ color: "#fff", fontWeight: 600, display: "block", marginBottom: "4px" }}>4. Our Legal Basis</span>
            <span>We only process your data when we have a proper legal reason to - most commonly because it's necessary to provide the service you've signed up for, because it's in our legitimate interest to keep the platform safe and fraud-free, or because we're required to by law.</span>
          </div>

          <div>
            <span style={{ color: "#fff", fontWeight: 600, display: "block", marginBottom: "4px" }}>5. Trusted Partners We Work With</span>
            <span>FlipCollab runs on a small number of established, reputable service providers, each of which only receives the data they need to do their job:</span>
            <ul style={{ paddingLeft: "1.25rem", marginTop: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
              <li><strong style={{ color: "#fff" }}>Supabase</strong> — our database and account sign-in</li>
              <li><strong style={{ color: "#fff" }}>Stripe</strong> — payments and creator payouts, a global leader in payment security</li>
              <li><strong style={{ color: "#fff" }}>Vercel</strong> — hosting the app</li>
            </ul>
            <span style={{ display: "block", marginTop: "8px" }}>We don't sell your data to anyone, for any reason.</span>
          </div>

          <div>
            <span style={{ color: "#fff", fontWeight: 600, display: "block", marginBottom: "4px" }}>6. Social Sign-In & Linked Accounts</span>
            <span>You may sign in or verify your account using Google, Apple, TikTok, or Instagram. We only receive what the provider shares when you sign in — typically your name and email, or a private relay email if you use Apple's Hide My Email. We use this data solely to create and authenticate your account, never for advertising, and we do not attempt to identify you if you choose to keep your email private.</span>
          </div>

          <div>
            <span style={{ color: "#fff", fontWeight: 600, display: "block", marginBottom: "4px" }}>7. How Long We Keep Your Data</span>
            <span>We keep your information for as long as your account is active. If you delete your account, your personal data is removed within 30 days - except records we're legally required to hold onto for longer, such as payment records, which UK law requires us to keep for 6 years. Photos and videos exchanged during a deal aren't kept forever either: they're automatically cleared once a deal is complete or after a period of inactivity, though the conversation itself always stays so both sides have a record of what was agreed. If your account is deleted or restricted, everything - including media - is removed immediately.</span>
          </div>

          <div>
            <span style={{ color: "#fff", fontWeight: 600, display: "block", marginBottom: "4px" }}>8. Your Rights</span>
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
            <span style={{ color: "#fff", fontWeight: 600, display: "block", marginBottom: "4px" }}>9. Cookies</span>
            <span>FlipCollab uses essential cookies and local storage to keep you logged in and remember your preferences. We do not use tracking or advertising cookies.</span>
          </div>

          <div>
            <span style={{ color: "#fff", fontWeight: 600, display: "block", marginBottom: "4px" }}>10. Keeping Your Data Secure</span>
            <span>Security is something we take seriously, not an afterthought. Every connection to FlipCollab is encrypted, and all payments are handled by Stripe, which meets the highest global standard for payment security - we never see or store your card or bank details ourselves. No system is completely immune to risk, so if you ever notice anything suspicious on your account, let us know straight away.</span>
          </div>

          <div>
            <span style={{ color: "#fff", fontWeight: 600, display: "block", marginBottom: "4px" }}>11. Children</span>
            <span>FlipCollab is not intended for users under 18. We do not knowingly collect data from minors. If we become aware of this, the account will be deleted immediately.</span>
          </div>

          <div>
            <span style={{ color: "#fff", fontWeight: 600, display: "block", marginBottom: "4px" }}>12. Changes to This Policy</span>
            <span>We may update this policy from time to time. We will notify you of significant changes via email or an in-app notice. Continued use of the platform after changes constitutes acceptance.</span>
          </div>

          <div>
            <span style={{ color: "#fff", fontWeight: 600, display: "block", marginBottom: "4px" }}>13. Contact</span>
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