import { useEffect } from "react";

const SECTIONS = [
  { t: "1. About FlipCollab", b: "A creator collaboration marketplace connecting brands with content creators for paid and gifted campaigns." },
  { t: "2. Your Account", b: "Keep credentials secure. FlipCollab isn't liable for unauthorised access. You can delete your account anytime from settings." },
  { t: "3. Creator & Brand Responsibilities", b: "Creators must deliver content as described within the agreed timeframe. Brands must post accurate campaign information. Don't pay or accept payment outside FlipCollab to bypass fees — this results in immediate termination." },
  { t: "4. Payments, Deliverables & Disputes", b: "(a) Escrow. All payments are processed via Stripe. A brand's payment is held in escrow and is never paid out instantly. It is released to the creator when the brand releases it after reviewing the deliverable, when a required post is confirmed live (where the campaign requires one), or automatically 7 days after the creator uploads the deliverable if the brand takes no action. Creator payouts go straight to the creator's own connected Stripe account - FlipCollab never holds a creator's bank details. (b) Previews. Until the payment is released, a brand sees the deliverable only as a watermarked preview, and must not copy, record, download, share or use the preview or the deliverable in any way before then. The full-quality video is available once the payment is released. (c) Revisions. A brand may ask the creator for another video up to 2 times per deal. The creator has 7 days from each request to upload a new one, and if none arrives in that time the payment is refunded to the brand automatically. Each new upload restarts the 7-day review period. (d) Disputes. A brand can dispute a delivery in-app within 7 days of the upload. A creator can dispute a request for another video while they are waiting to resend, and can add their side to a dispute raised against them. While a dispute is open the funds stay held. A FlipCollab admin reviews it, including the deliverable and the chat history between the brand and the creator, and decides to refund the brand or release the payment to the creator. That decision is final within FlipCollab. (e) Active deals. Once a deal is funded, the brand cannot screen out the creator, delete the campaign or block the creator until the deal has been released, refunded or resolved." },
  { t: "5. Payment Delays", b: "Delays may occur during maintenance or incidents, or due to Stripe's own payout timing once funds are released to a creator's connected account. All escrow funds are guaranteed to be processed once normal operations resume." },
  { t: "6. Platform Fees", b: "FlipCollab deducts a 10% fee from creator earnings per completed collab. A 5% fee is added to brand payments. Enterprise brands pay 0% platform fees (and their creators keep 100%) for as long as their subscription is active. Enterprise payments instead carry a card processing fee of 2.5% of the campaign budget plus 20p, added to the amount the brand is charged and shown before the brand pays. It goes towards the cost of processing the card payment, is never deducted from the creator's payout, and if a deal is refunded the brand is refunded everything it paid for that deal." },
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
  useEffect(() => {
    document.title = "Terms of Service | FlipCollab";
  }, []);

  return (
    <div style={{ height: "100vh", overflowY: "auto", WebkitOverflowScrolling: "touch", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", display: "flex", justifyContent: "center" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');`}</style>
      <div style={{ width: "100%", maxWidth: "640px", padding: "4rem 1.5rem 6rem" }}>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "32px", fontWeight: 800, color: "#fff", marginBottom: "0.5rem" }}>
          Terms of Service
        </h1>
        <p style={{ color: "#999", fontSize: "11px", marginBottom: "1.5rem" }}>Last updated: October 2026</p>
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
        <p style={{ fontSize: "12px", color: "#888", marginTop: "2rem" }}>
          See also our <a href="https://privacy.flipcollab.com" style={{ color: "#fff", textDecoration: "underline" }}>Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}
