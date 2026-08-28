const SECTIONS = [
  { t: "1. Who We Are", b: "FlipCollab is a creator collaboration marketplace. Contact: hello@flipcollab.com" },
  { t: "2. Data We Collect", b: "Name, email, profile info, billing address, messages, campaign content, and device/usage data. Card details and, for creators, bank/identity details for payouts are collected and verified directly by Stripe - FlipCollab never sees or stores them." },
  { t: "3. How We Use Your Data", b: "To run your account, match brands with creators, process payments and payouts, send transactional emails, resolve disputes, and comply with legal obligations." },
  { t: "4. Legal Basis", b: "Contract performance, legitimate interests (security, fraud prevention), and legal obligation." },
  { t: "5. Third-Party Services", b: "Supabase (database/auth, EU), Stripe and Stripe Connect (payments and creator payouts, PCI-DSS), Vercel (hosting), and optional sign-in via Google, Apple, TikTok, or Instagram. We do not sell your data." },
  { t: "6. Social Sign-In & Linked Accounts", b: "If you sign in or verify your account with Google, Apple, TikTok, or Instagram, we only receive what that provider shares (typically your name and email, or a private relay email if you use Apple's Hide My Email). We use it solely to create and authenticate your account, never for advertising, and we do not attempt to identify you if you choose to keep your email private." },
  { t: "7. Data Retention", b: "Retained while your account is active. Deleted within 30 days of account deletion, except payment records kept 6 years under UK law." },
  { t: "8. Your Rights", b: "Access, correction, deletion, objection, portability, and the right to complain to the ICO (ico.org.uk). Email us to exercise these." },
  { t: "9. Cookies", b: "Essential cookies only. No tracking or advertising cookies." },
  { t: "10. Security", b: "HTTPS, Supabase auth, and Stripe PCI compliance. Contact us immediately if you suspect unauthorised access." },
  { t: "11. Children", b: "Not for under 18s. Accounts found to belong to minors are deleted immediately." },
  { t: "12. Changes", b: "We'll notify you of significant changes via email or in-app notice." },
  { t: "13. Contact", b: "hello@flipcollab.com" },
];

export default function PrivacyPolicyPage() {
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
      </div>
    </div>
  );
}
