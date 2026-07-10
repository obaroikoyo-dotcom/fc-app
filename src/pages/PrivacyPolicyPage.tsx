const SECTIONS = [
  { t: "1. Who We Are", b: "FlipCollab is a creator collaboration marketplace. Contact: Flipcollab@hotmail.com" },
  { t: "2. Data We Collect", b: "Name, email, profile info, payment data via Stripe, messages, campaign content, and device/usage data." },
  { t: "3. How We Use Your Data", b: "To run your account, match brands with creators, process payments, send transactional emails, resolve disputes, and comply with legal obligations." },
  { t: "4. Legal Basis", b: "Contract performance, legitimate interests (security, fraud prevention), and legal obligation." },
  { t: "5. Third-Party Services", b: "Supabase (database/auth, EU), Stripe (payments, PCI-DSS), Vercel (hosting). We do not sell your data." },
  { t: "6. Data Retention", b: "Retained while your account is active. Deleted within 30 days of account deletion, except payment records kept 6 years under UK law." },
  { t: "7. Your Rights", b: "Access, correction, deletion, objection, portability, and the right to complain to the ICO (ico.org.uk). Email us to exercise these." },
  { t: "8. Cookies", b: "Essential cookies only. No tracking or advertising cookies." },
  { t: "9. Security", b: "HTTPS, Supabase auth, and Stripe PCI compliance. Contact us immediately if you suspect unauthorised access." },
  { t: "10. Children", b: "Not for under 18s. Accounts found to belong to minors are deleted immediately." },
  { t: "11. Changes", b: "We'll notify you of significant changes via email or in-app notice." },
  { t: "12. Contact", b: "Flipcollab@hotmail.com" },
];

export default function PrivacyPolicyPage() {
  return (
    <div style={{ height: "100vh", overflowY: "auto", WebkitOverflowScrolling: "touch", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", display: "flex", justifyContent: "center" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');`}</style>
      <div style={{ width: "100%", maxWidth: "640px", padding: "4rem 1.5rem 6rem" }}>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "32px", fontWeight: 800, color: "#fff", marginBottom: "0.5rem" }}>
          Privacy Policy
        </h1>
        <p style={{ color: "#555", fontSize: "11px", marginBottom: "1.5rem" }}>Last updated: January 2026</p>
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
