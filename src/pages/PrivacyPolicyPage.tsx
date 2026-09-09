import { useEffect } from "react";

const SECTIONS = [
  { t: "1. Who We Are", b: "FlipCollab is a creator collaboration marketplace. Contact: hello@flipcollab.com" },
  { t: "2. Information We Collect", b: "Your name, email, profile details, messages, campaign content, and basic device/usage data. Payment details - and, for creators, the bank details needed for payouts - are collected and verified directly by Stripe. We never see or store them ourselves." },
  { t: "3. How We Use It", b: "To run your account, match brands with creators, process payments and payouts, send you account and payment-related emails, resolve disputes, and meet our legal obligations." },
  { t: "4. Our Legal Basis", b: "We only process your data where it's necessary to provide the service, in our legitimate interest to keep the platform safe, or where the law requires it." },
  { t: "5. Trusted Partners We Work With", b: "We run on a small number of established providers who only get the data they need to do their job: Supabase (our database and sign-in), Stripe (payments and creator payouts), and Vercel (hosting) - plus optional sign-in via Google, Apple, TikTok, or Instagram. We don't sell your data to anyone." },
  { t: "6. Social Sign-In & Linked Accounts", b: "If you sign in or verify your account with Google, Apple, TikTok, or Instagram, we only receive what that provider shares (typically your name and email, or a private relay email if you use Apple's Hide My Email). We use it solely to create and authenticate your account, never for advertising, and we do not attempt to identify you if you choose to keep your email private." },
  { t: "7. How Long We Keep Your Data", b: "For as long as your account is active. Deleted within 30 days of account deletion, except payment records, which UK law requires us to keep for 6 years. Photos and videos shared during a deal are cleared automatically once that deal wraps up or after a period of inactivity - your conversations themselves always stay, so both sides keep a record of what was agreed. Deleting your account or being restricted removes everything, including media, right away." },
  { t: "8. Your Rights", b: "Access, correction, deletion, objection, portability, and the right to complain to the ICO (ico.org.uk). Email us to exercise these." },
  { t: "9. Cookies", b: "Essential cookies only. No tracking or advertising cookies." },
  { t: "10. Keeping Your Data Secure", b: "Every connection to FlipCollab is encrypted, and payments are handled by Stripe, a global leader in payment security - we never see or store your card or bank details ourselves. If you ever notice anything suspicious on your account, let us know straight away." },
  { t: "11. Children", b: "Not for under 18s. Accounts found to belong to minors are deleted immediately." },
  { t: "12. Changes", b: "We'll notify you of significant changes via email or in-app notice." },
  { t: "13. Contact", b: "hello@flipcollab.com" },
];

export default function PrivacyPolicyPage() {
  useEffect(() => {
    document.title = "Privacy Policy | FlipCollab";
  }, []);

  return (
    <div style={{ height: "100vh", overflowY: "auto", WebkitOverflowScrolling: "touch", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", display: "flex", justifyContent: "center" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');`}</style>
      <div style={{ width: "100%", maxWidth: "640px", padding: "4rem 1.5rem 6rem" }}>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "32px", fontWeight: 800, color: "#fff", marginBottom: "0.5rem" }}>
          Privacy Policy
        </h1>
        <p style={{ color: "#999", fontSize: "11px", marginBottom: "1.5rem" }}>Last updated: August 2026</p>
        <p style={{ fontSize: "13px", color: "#aaa", lineHeight: 1.6, marginBottom: "2rem" }}>
          This Privacy Policy explains how FlipCollab collects, uses, and protects your personal data. We comply with UK GDPR and the Data Protection Act 2018.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {SECTIONS.map(({ t, b }) => (
            <div key={t}>
              <span style={{ color: "#fff", fontWeight: 600, fontSize: "13px", display: "block", marginBottom: "4px" }}>{t}</span>
              <span style={{ color: "#aaa", fontSize: "13px", lineHeight: 1.6 }}>{b}</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: "12px", color: "#888", marginTop: "2rem" }}>
          See also our <a href="https://terms.flipcollab.com" style={{ color: "#fff", textDecoration: "underline" }}>Terms of Service</a>.
        </p>
      </div>
    </div>
  );
}
