const SECTIONS = [
  { t: "1. About FlipCollab", b: "A creator collaboration marketplace connecting brands with content creators for paid and gifted campaigns." },
  { t: "2. Your Account", b: "Keep credentials secure. FlipCollab isn't liable for unauthorised access. You can delete your account anytime from settings." },
  { t: "3. Creator & Brand Responsibilities", b: "Creators must deliver content as described within the agreed timeframe. Brands must post accurate campaign information. Don't pay or accept payment outside FlipCollab to bypass fees — this results in immediate termination." },
  { t: "4. Payments & Escrow", b: "All payments are processed via Stripe. A brand's payment is held in escrow and released to the creator once the deliverable is confirmed live, manually released by the brand, or (if the brand opts out of requiring a confirmed post) immediately on payment. If a brand takes no action within 7 days of delivery, payment releases automatically. Creator payouts are transferred directly to the creator's own connected Stripe account - FlipCollab never holds a creator's bank details. A brand can dispute a delivery in-app within that same 7-day window, which pauses the release while a FlipCollab admin reviews it and decides to refund the brand or release the payment to the creator." },
  { t: "5. Payment Delays", b: "Delays may occur during maintenance or incidents, or due to Stripe's own payout timing once funds are released to a creator's connected account. All escrow funds are guaranteed to be processed once normal operations resume." },
  { t: "6. Platform Fees", b: "FlipCollab deducts a 10% fee from creator earnings per completed collab. A 5% fee is added to brand payments. Enterprise brands get 0% fees for as long as their subscription is active." },
  { t: "7. Prohibited Content", b: "No illegal, hateful, explicit, discriminatory, or misleading content. Violations result in account suspension or termination. For serious violations (fraud, harassment, illegal activity) FlipCollab may permanently withhold funds in the offending account pending investigation." },
  { t: "8. Intellectual Property", b: "Creators retain content ownership. Completing a campaign grants the brand a non-exclusive licence for promotional use as agreed." },
  { t: "9. Privacy", b: "We collect name, email, profile info, and payment data. We use Supabase, Stripe, and Vercel. We don't sell your data." },
  { t: "10. Limitation of Liability", b: "FlipCollab isn't liable for indirect or consequential losses, including brand-creator disputes." },
  { t: "11. Governing Law", b: "Governed by the laws of England and Wales." },
  { t: "12. In-App Purchases", b: "Subscription fees are recurring and cancellable anytime from Settings, with no notice period required. Cancelling stops future billing but takes effect at the end of the current billing period - Enterprise benefits continue until then. No refunds for partial periods." },
  { t: "13. App Store Compliance", b: "If FlipCollab is distributed via the Apple App Store or Google Play Store, use is also subject to that platform's terms. Apple and Google aren't responsible for the app; claims must be directed to FlipCollab, not to them." },
  { t: "14. Contact", b: "hello@flipcollab.com" },
];

export default function TermsPage() {
  return (
    <div style={{ height: "100vh", overflowY: "auto", WebkitOverflowScrolling: "touch", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", display: "flex", justifyContent: "center" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');`}</style>
      <div style={{ width: "100%", maxWidth: "640px", padding: "4rem 1.5rem 6rem" }}>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "32px", fontWeight: 800, color: "#fff", marginBottom: "0.5rem" }}>
          Terms of Service
        </h1>
        <p style={{ color: "#999", fontSize: "11px", marginBottom: "1.5rem" }}>Last updated: August 2026</p>
        <p style={{ fontSize: "13px", color: "#aaa", lineHeight: 1.6, marginBottom: "2rem" }}>
          By using FlipCollab you agree to these Terms. You must be at least 18 years old.
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
