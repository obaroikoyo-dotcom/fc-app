import { useState } from "react";
import { type Page } from "../App";
import { supabase } from "../lib/supabase";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { stripePromise } from "../lib/stripe";

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: "14px",
      color: "#fff",
      fontFamily: "'DM Sans', sans-serif",
      "::placeholder": { color: "#555" },
    },
    invalid: { color: "#ff3b30" },
  },
};

interface SubscriptionFormProps {
  selectedPlan: "monthly" | "annual";
  onSuccess: () => void;
  onLoadingChange: (v: boolean) => void;
  onError: (e: string) => void;
  paymentLoading: boolean;
  paymentError: string;
}

function SubscriptionForm({ selectedPlan, onSuccess, onLoadingChange, onError, paymentLoading, paymentError }: SubscriptionFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [cardName, setCardName] = useState("");

  const handlePayment = async () => {
    if (!stripe || !elements) return;
    const cardElement = elements.getElement(CardElement);
    if (!cardElement) return;

    if (!cardName.trim()) { onError("Please enter the cardholder name."); return; }

    onError("");
    onLoadingChange(true);

    const { error, paymentMethod } = await stripe.createPaymentMethod({
      type: "card",
      card: cardElement,
      billing_details: { name: cardName },
    });

    if (error) {
      onError(error.message || "Card error.");
      onLoadingChange(false);
      return;
    }

    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) { onLoadingChange(false); return; }

    const res = await supabase.functions.invoke("create-subscription", {
      body: { brand_id: user.id, email: user.email, plan: selectedPlan, payment_method_id: paymentMethod.id }
    });

    if (res.error || !res.data?.subscriptionId) {
      onError("Failed to start subscription. Try again.");
      onLoadingChange(false);
      return;
    }

    await supabase.from("brand_profiles").update({ is_enterprise: true }).eq("id", user.id);
    onLoadingChange(false);
    onSuccess();
  };

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "1.25rem" }}>
        <div>
          <label style={{ fontSize: "10px", color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Cardholder Name</label>
          <input value={cardName} onChange={e => setCardName(e.target.value)} placeholder="Name on card" style={{ background: "#111", border: "1px solid #222", borderRadius: "8px", padding: "11px 14px", color: "#fff", fontSize: "14px", outline: "none", width: "100%", fontFamily: "inherit", boxSizing: "border-box" as const }} />
        </div>
        <div>
          <label style={{ fontSize: "10px", color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Card Details</label>
          <div style={{ background: "#111", border: "1px solid #222", borderRadius: "8px", padding: "13px 14px" }}>
            <CardElement options={CARD_ELEMENT_OPTIONS} />
          </div>
        </div>
      </div>
      {paymentError && <p style={{ fontSize: "12px", color: "#ff4444", marginBottom: "10px" }}>{paymentError}</p>}
      <div onClick={!paymentLoading ? handlePayment : undefined} style={{ padding: "14px", borderRadius: "8px", background: paymentLoading ? "#1a1a1a" : "#fff", color: paymentLoading ? "#555" : "#0a0a0a", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: paymentLoading ? "default" : "pointer", letterSpacing: "0.08em", textTransform: "uppercase", transition: "all 0.2s" }}>
        {paymentLoading ? "Processing..." : `Confirm — ${selectedPlan === "monthly" ? "£97/mo" : "£984/yr"}`}
      </div>
      <p style={{ fontSize: "11px", color: "#333", textAlign: "center", marginTop: "10px" }}>🔒 Secured by Stripe. Cancel anytime.</p>
    </>
  );
}

export default function EnterpriseSubscriptionPage({ navigate }: { navigate: (page: Page) => void }) {
  const [showModal, setShowModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "annual">("annual");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", color: "#fff" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');`}</style>

      <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #111", display: "flex", alignItems: "center", gap: "12px" }}>
        <span onClick={() => navigate("brand-dashboard")} style={{ fontSize: "20px", color: "#555", cursor: "pointer" }}>←</span>
        <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff" }}>FlipCollab Enterprise</span>
      </div>

      <div style={{ padding: "2rem 1.25rem", paddingBottom: "6rem", maxWidth: "480px", margin: "0 auto" }}>

        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <span style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#555", display: "block", marginBottom: "1rem" }}>Tier Upgrade</span>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "30px", fontWeight: 800, lineHeight: 1.15, color: "#fff", marginBottom: "1rem" }}>Scale Your Campaigns.<br />Pay Zero Fees.</h1>
          <p style={{ fontSize: "14px", color: "#555", lineHeight: 1.7 }}>Unlock 0% platform fees for you and your creators, plus advanced tools built for high-volume brand operations.</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "2.5rem" }}>
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

          <div style={{ background: "#fff", border: "1px solid #fff", borderRadius: "12px", padding: "1.25rem", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, right: 0, background: "#0a0a0a", color: "#fff", fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", padding: "4px 12px", borderBottomLeftRadius: "8px" }}>Maximize ROI</div>
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

        <div style={{ background: "#111", border: "1px solid #222", borderRadius: "14px", padding: "1.5rem", textAlign: "center", marginBottom: "2.5rem" }}>
          <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "20px", fontWeight: 800, color: "#fff", marginBottom: "4px" }}>Enterprise Plan</p>
          <p style={{ fontSize: "12px", color: "#444", marginBottom: "1.5rem" }}>Scalable access for modern brand workflows</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "1.5rem" }}>
            <div style={{ background: "#0a0a0a", border: "1px solid #222", borderRadius: "10px", padding: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ textAlign: "left" }}>
                <p style={{ fontSize: "11px", color: "#444", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600, marginBottom: "4px" }}>Monthly</p>
                <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "26px", fontWeight: 800, color: "#fff" }}>£97<span style={{ fontSize: "13px", color: "#555", fontWeight: 400 }}>/mo</span></p>
              </div>
              <span style={{ fontSize: "11px", color: "#555", border: "1px solid #222", borderRadius: "20px", padding: "4px 10px" }}>Cancel anytime</span>
            </div>
            <div style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: "10px", padding: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, right: 0, background: "#fff", color: "#0a0a0a", fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", padding: "3px 10px", borderBottomLeftRadius: "6px" }}>Best Value</div>
              <div style={{ textAlign: "left" }}>
                <p style={{ fontSize: "11px", color: "#444", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600, marginBottom: "4px" }}>Annual</p>
                <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "26px", fontWeight: 800, color: "#fff" }}>£82<span style={{ fontSize: "13px", color: "#555", fontWeight: 400 }}>/mo</span></p>
                <p style={{ fontSize: "11px", color: "#555", marginTop: "2px" }}>£984 billed annually</p>
              </div>
              <span style={{ fontSize: "11px", color: "#fff", border: "1px solid #333", borderRadius: "20px", padding: "4px 10px" }}>Save £180/yr</span>
            </div>
          </div>
          <div onClick={() => { console.log("button clicked"); setShowModal(true); }} style={{ padding: "14px", borderRadius: "8px", background: "#fff", color: "#0a0a0a", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase" }}>
  Upgrade to Enterprise
</div>
          <p style={{ fontSize: "11px", color: "#333", marginTop: "10px", textAlign: "center" }}> Secured by Stripe. Cancel anytime.</p>
          <p style={{ fontSize: "11px", color: "#333", marginTop: "6px", textAlign: "center" }}>Plan cannot be changed after subscribing. Cancel and resubscribe to switch.</p>
        </div>

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

      {showModal && (
  <div onClick={() => !paymentLoading && setShowModal(false)} style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(0,0,0,0.85)", zIndex: 99999, overflowY: "auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
  <div onClick={e => e.stopPropagation()} style={{ position: "relative", maxWidth: "750px", width: "95%", margin: "20px", background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: "14px", padding: "1.5rem" }}>
            {paymentSuccess ? (
              <div style={{ textAlign: "center", padding: "1rem 0" }}>
                <div style={{ fontSize: "40px", marginBottom: "1rem" }}>🎉</div>
                <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "20px", fontWeight: 800, color: "#fff", marginBottom: "8px" }}>You're on Enterprise!</p>
                <p style={{ fontSize: "13px", color: "#555", lineHeight: 1.7, marginBottom: "1.5rem" }}>Platform fees are now waived for you and your creators. Enjoy zero-fee campaigns.</p>
                <div onClick={() => { setShowModal(false); navigate("brand-dashboard"); }} style={{ padding: "13px", borderRadius: "8px", background: "#fff", color: "#0a0a0a", fontSize: "13px", fontWeight: 600, cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Back to Dashboard
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
                  <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "16px", fontWeight: 800, color: "#fff" }}>Complete Your Upgrade</p>
                  <span onClick={() => setShowModal(false)} style={{ color: "#444", fontSize: "20px", cursor: "pointer", lineHeight: 1 }}>×</span>
                </div>

                <div style={{ display: "flex", gap: "8px", marginBottom: "1.25rem" }}>
                  {[{ label: "Monthly", price: "£97/mo", val: "monthly" }, { label: "Annual", price: "£82/mo", val: "annual" }].map(({ label, price, val }) => (
                    <div key={val} onClick={() => setSelectedPlan(val as "monthly" | "annual")} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: `1px solid ${selectedPlan === val ? "#fff" : "#222"}`, background: selectedPlan === val ? "#fff" : "transparent", cursor: "pointer", textAlign: "center", transition: "all 0.15s" }}>
                      <p style={{ fontSize: "11px", fontWeight: 600, color: selectedPlan === val ? "#0a0a0a" : "#555", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
                      <p style={{ fontSize: "14px", fontWeight: 700, color: selectedPlan === val ? "#0a0a0a" : "#fff", marginTop: "2px" }}>{price}</p>
                    </div>
                  ))}
                </div>

                <Elements stripe={stripePromise}>
                  <SubscriptionForm
                    selectedPlan={selectedPlan}
                    onSuccess={() => setPaymentSuccess(true)}
                    onLoadingChange={setPaymentLoading}
                    onError={setPaymentError}
                    paymentLoading={paymentLoading}
                    paymentError={paymentError}
                  />
                </Elements>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}