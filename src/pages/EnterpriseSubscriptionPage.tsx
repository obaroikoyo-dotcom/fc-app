import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { type Page } from "../App";
import { supabase } from "../lib/supabase";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { stripePromise } from "../lib/stripe";

const CARD_ELEMENT_OPTIONS = {
  hidePostalCode: true,
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

const fieldLabel: React.CSSProperties = { fontSize: "10px", color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: "6px" };
const fieldInput: React.CSSProperties = { background: "#111", border: "1px solid #222", borderRadius: "8px", padding: "11px 14px", color: "#fff", fontSize: "14px", outline: "none", width: "100%", fontFamily: "inherit", boxSizing: "border-box" as const };

const COUNTRIES: { code: string; name: string }[] = [
  { code: "GB", name: "United Kingdom" }, { code: "US", name: "United States" }, { code: "IE", name: "Ireland" },
  { code: "AF", name: "Afghanistan" }, { code: "AL", name: "Albania" }, { code: "DZ", name: "Algeria" }, { code: "AD", name: "Andorra" },
  { code: "AO", name: "Angola" }, { code: "AG", name: "Antigua and Barbuda" }, { code: "AR", name: "Argentina" }, { code: "AM", name: "Armenia" },
  { code: "AU", name: "Australia" }, { code: "AT", name: "Austria" }, { code: "AZ", name: "Azerbaijan" }, { code: "BS", name: "Bahamas" },
  { code: "BH", name: "Bahrain" }, { code: "BD", name: "Bangladesh" }, { code: "BB", name: "Barbados" }, { code: "BY", name: "Belarus" },
  { code: "BE", name: "Belgium" }, { code: "BZ", name: "Belize" }, { code: "BJ", name: "Benin" }, { code: "BT", name: "Bhutan" },
  { code: "BO", name: "Bolivia" }, { code: "BA", name: "Bosnia and Herzegovina" }, { code: "BW", name: "Botswana" }, { code: "BR", name: "Brazil" },
  { code: "BN", name: "Brunei" }, { code: "BG", name: "Bulgaria" }, { code: "BF", name: "Burkina Faso" }, { code: "BI", name: "Burundi" },
  { code: "KH", name: "Cambodia" }, { code: "CM", name: "Cameroon" }, { code: "CA", name: "Canada" }, { code: "CV", name: "Cape Verde" },
  { code: "CF", name: "Central African Republic" }, { code: "TD", name: "Chad" }, { code: "CL", name: "Chile" }, { code: "CN", name: "China" },
  { code: "CO", name: "Colombia" }, { code: "KM", name: "Comoros" }, { code: "CG", name: "Congo" }, { code: "CR", name: "Costa Rica" },
  { code: "HR", name: "Croatia" }, { code: "CU", name: "Cuba" }, { code: "CY", name: "Cyprus" }, { code: "CZ", name: "Czech Republic" },
  { code: "DK", name: "Denmark" }, { code: "DJ", name: "Djibouti" }, { code: "DM", name: "Dominica" }, { code: "DO", name: "Dominican Republic" },
  { code: "EC", name: "Ecuador" }, { code: "EG", name: "Egypt" }, { code: "SV", name: "El Salvador" }, { code: "GQ", name: "Equatorial Guinea" },
  { code: "ER", name: "Eritrea" }, { code: "EE", name: "Estonia" }, { code: "SZ", name: "Eswatini" }, { code: "ET", name: "Ethiopia" },
  { code: "FJ", name: "Fiji" }, { code: "FI", name: "Finland" }, { code: "FR", name: "France" }, { code: "GA", name: "Gabon" },
  { code: "GM", name: "Gambia" }, { code: "GE", name: "Georgia" }, { code: "DE", name: "Germany" }, { code: "GH", name: "Ghana" },
  { code: "GR", name: "Greece" }, { code: "GD", name: "Grenada" }, { code: "GT", name: "Guatemala" }, { code: "GN", name: "Guinea" },
  { code: "GW", name: "Guinea-Bissau" }, { code: "GY", name: "Guyana" }, { code: "HT", name: "Haiti" }, { code: "HN", name: "Honduras" },
  { code: "HK", name: "Hong Kong" }, { code: "HU", name: "Hungary" }, { code: "IS", name: "Iceland" }, { code: "IN", name: "India" },
  { code: "ID", name: "Indonesia" }, { code: "IR", name: "Iran" }, { code: "IQ", name: "Iraq" }, { code: "IL", name: "Israel" },
  { code: "IT", name: "Italy" }, { code: "JM", name: "Jamaica" }, { code: "JP", name: "Japan" }, { code: "JO", name: "Jordan" },
  { code: "KZ", name: "Kazakhstan" }, { code: "KE", name: "Kenya" }, { code: "KI", name: "Kiribati" }, { code: "KW", name: "Kuwait" },
  { code: "KG", name: "Kyrgyzstan" }, { code: "LA", name: "Laos" }, { code: "LV", name: "Latvia" }, { code: "LB", name: "Lebanon" },
  { code: "LS", name: "Lesotho" }, { code: "LR", name: "Liberia" }, { code: "LY", name: "Libya" }, { code: "LI", name: "Liechtenstein" },
  { code: "LT", name: "Lithuania" }, { code: "LU", name: "Luxembourg" }, { code: "MO", name: "Macau" }, { code: "MG", name: "Madagascar" },
  { code: "MW", name: "Malawi" }, { code: "MY", name: "Malaysia" }, { code: "MV", name: "Maldives" }, { code: "ML", name: "Mali" },
  { code: "MT", name: "Malta" }, { code: "MH", name: "Marshall Islands" }, { code: "MR", name: "Mauritania" }, { code: "MU", name: "Mauritius" },
  { code: "MX", name: "Mexico" }, { code: "FM", name: "Micronesia" }, { code: "MD", name: "Moldova" }, { code: "MC", name: "Monaco" },
  { code: "MN", name: "Mongolia" }, { code: "ME", name: "Montenegro" }, { code: "MA", name: "Morocco" }, { code: "MZ", name: "Mozambique" },
  { code: "MM", name: "Myanmar" }, { code: "NA", name: "Namibia" }, { code: "NR", name: "Nauru" }, { code: "NP", name: "Nepal" },
  { code: "NL", name: "Netherlands" }, { code: "NZ", name: "New Zealand" }, { code: "NI", name: "Nicaragua" }, { code: "NE", name: "Niger" },
  { code: "NG", name: "Nigeria" }, { code: "KP", name: "North Korea" }, { code: "MK", name: "North Macedonia" }, { code: "NO", name: "Norway" },
  { code: "OM", name: "Oman" }, { code: "PK", name: "Pakistan" }, { code: "PW", name: "Palau" }, { code: "PA", name: "Panama" },
  { code: "PG", name: "Papua New Guinea" }, { code: "PY", name: "Paraguay" }, { code: "PE", name: "Peru" }, { code: "PH", name: "Philippines" },
  { code: "PL", name: "Poland" }, { code: "PT", name: "Portugal" }, { code: "QA", name: "Qatar" }, { code: "RO", name: "Romania" },
  { code: "RU", name: "Russia" }, { code: "RW", name: "Rwanda" }, { code: "KN", name: "Saint Kitts and Nevis" }, { code: "LC", name: "Saint Lucia" },
  { code: "WS", name: "Samoa" }, { code: "SM", name: "San Marino" }, { code: "ST", name: "Sao Tome and Principe" }, { code: "SA", name: "Saudi Arabia" },
  { code: "SN", name: "Senegal" }, { code: "RS", name: "Serbia" }, { code: "SC", name: "Seychelles" }, { code: "SL", name: "Sierra Leone" },
  { code: "SG", name: "Singapore" }, { code: "SK", name: "Slovakia" }, { code: "SI", name: "Slovenia" }, { code: "SB", name: "Solomon Islands" },
  { code: "SO", name: "Somalia" }, { code: "ZA", name: "South Africa" }, { code: "KR", name: "South Korea" }, { code: "SS", name: "South Sudan" },
  { code: "ES", name: "Spain" }, { code: "LK", name: "Sri Lanka" }, { code: "SD", name: "Sudan" }, { code: "SR", name: "Suriname" },
  { code: "SE", name: "Sweden" }, { code: "CH", name: "Switzerland" }, { code: "SY", name: "Syria" }, { code: "TW", name: "Taiwan" },
  { code: "TJ", name: "Tajikistan" }, { code: "TZ", name: "Tanzania" }, { code: "TH", name: "Thailand" }, { code: "TL", name: "Timor-Leste" },
  { code: "TG", name: "Togo" }, { code: "TO", name: "Tonga" }, { code: "TT", name: "Trinidad and Tobago" }, { code: "TN", name: "Tunisia" },
  { code: "TR", name: "Turkey" }, { code: "TM", name: "Turkmenistan" }, { code: "TV", name: "Tuvalu" }, { code: "UG", name: "Uganda" },
  { code: "UA", name: "Ukraine" }, { code: "AE", name: "United Arab Emirates" }, { code: "UY", name: "Uruguay" }, { code: "UZ", name: "Uzbekistan" },
  { code: "VU", name: "Vanuatu" }, { code: "VA", name: "Vatican City" }, { code: "VE", name: "Venezuela" }, { code: "VN", name: "Vietnam" },
  { code: "YE", name: "Yemen" }, { code: "ZM", name: "Zambia" }, { code: "ZW", name: "Zimbabwe" },
];

interface NominatimResult {
  display_name: string;
  address?: {
    house_number?: string;
    road?: string;
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country_code?: string;
  };
}

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
  const [billingOpen, setBillingOpen] = useState(false);
  const [billingLine1, setBillingLine1] = useState("");
  const [billingLine2, setBillingLine2] = useState("");
  const [billingCity, setBillingCity] = useState("");
  const [billingState, setBillingState] = useState("");
  const [billingPostalCode, setBillingPostalCode] = useState("");
  const [billingCountry, setBillingCountry] = useState("GB");
  const [addressSuggestions, setAddressSuggestions] = useState<NominatimResult[]>([]);
  const [addressSearching, setAddressSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const billingRef = useRef<HTMLDivElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);

  const handleAddressLine1Change = (value: string) => {
    setBillingLine1(value);
    setShowSuggestions(true);

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (searchAbortRef.current) searchAbortRef.current.abort();

    if (value.trim().length < 3) {
      setAddressSuggestions([]);
      setAddressSearching(false);
      return;
    }

    searchDebounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      searchAbortRef.current = controller;
      setAddressSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&q=${encodeURIComponent(value)}`,
          { signal: controller.signal }
        );
        const data: NominatimResult[] = await res.json();
        setAddressSuggestions(data);
      } catch {
        // Ignore aborted/failed lookups — user can still type the address manually.
      } finally {
        setAddressSearching(false);
      }
    }, 500);
  };

  const selectAddressSuggestion = (result: NominatimResult) => {
    const a = result.address || {};
    const line1 = [a.house_number, a.road].filter(Boolean).join(" ");
    setBillingLine1(line1 || result.display_name.split(",")[0]);
    setBillingCity(a.city || a.town || a.village || "");
    setBillingState(a.state || a.county || "");
    setBillingPostalCode(a.postcode || "");
    if (a.country_code) {
      const upper = a.country_code.toUpperCase();
      if (COUNTRIES.some(c => c.code === upper)) setBillingCountry(upper);
    }
    setAddressSuggestions([]);
    setShowSuggestions(false);
  };

  const toggleBilling = () => {
    setBillingOpen(prev => {
      const next = !prev;
      if (next) setTimeout(() => billingRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
      return next;
    });
  };

  const handlePayment = async () => {
    if (!stripe || !elements) return;
    const cardElement = elements.getElement(CardElement);
    if (!cardElement) return;

    if (!cardName.trim()) { onError("Please enter the cardholder name."); return; }

    if (!billingLine1.trim() || !billingCity.trim() || !billingPostalCode.trim() || !billingCountry.trim()) {
      onError("Please fill in your billing address.");
      if (!billingOpen) setBillingOpen(true);
      setTimeout(() => billingRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
      return;
    }

    onError("");
    onLoadingChange(true);

    const { error, paymentMethod } = await stripe.createPaymentMethod({
      type: "card",
      card: cardElement,
      billing_details: {
        name: cardName,
        address: {
          line1: billingLine1 || undefined,
          line2: billingLine2 || undefined,
          city: billingCity || undefined,
          state: billingState || undefined,
          postal_code: billingPostalCode || undefined,
          country: billingCountry || undefined,
        },
      },
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
      body: {
        brand_id: user.id,
        email: user.email,
        plan: selectedPlan,
        payment_method_id: paymentMethod.id,
        billing_address: {
          line1: billingLine1,
          line2: billingLine2,
          city: billingCity,
          state: billingState,
          postal_code: billingPostalCode,
          country: billingCountry,
        },
      }
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
          <label style={fieldLabel}>Cardholder Name</label>
          <input value={cardName} onChange={e => setCardName(e.target.value)} placeholder="Name on card" style={fieldInput} />
        </div>
        <div>
          <label style={fieldLabel}>Card Details</label>
          <div style={{ background: "#111", border: "1px solid #222", borderRadius: "8px", padding: "13px 14px" }}>
            <CardElement options={CARD_ELEMENT_OPTIONS} />
          </div>
        </div>

        <div
          className="tap-btn"
          onClick={toggleBilling}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", borderRadius: "8px", border: "1px solid #222", background: "transparent", cursor: "pointer" }}
        >
          <span style={{ fontSize: "12px", color: "#aaa", fontWeight: 500 }}>Billing address <span style={{ color: "#ff3b30" }}>*</span></span>
          <span style={{ fontSize: "11px", color: "#555", transform: billingOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}>▼</span>
        </div>

        {billingOpen && (
          <div ref={billingRef} className="billing-address-in" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ position: "relative" }}>
              <label style={fieldLabel}>Address Line 1 <span style={{ color: "#333", textTransform: "none", letterSpacing: 0 }}>— start typing to search</span></label>
              <input
                value={billingLine1}
                onChange={e => handleAddressLine1Change(e.target.value)}
                onFocus={() => addressSuggestions.length > 0 && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder="123 High Street"
                style={fieldInput}
                autoComplete="off"
              />
              {addressSearching && (
                <span style={{ position: "absolute", right: "14px", top: "36px", fontSize: "11px", color: "#555" }}>Searching…</span>
              )}
              {showSuggestions && addressSuggestions.length > 0 && (
                <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#111", border: "1px solid #222", borderRadius: "8px", overflow: "hidden", zIndex: 10, maxHeight: "220px", overflowY: "auto" }}>
                  {addressSuggestions.map((s, i) => (
                    <div
                      key={i}
                      onMouseDown={() => selectAddressSuggestion(s)}
                      style={{ padding: "10px 14px", fontSize: "12px", color: "#ccc", cursor: "pointer", borderBottom: i < addressSuggestions.length - 1 ? "1px solid #1a1a1a" : "none" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#1a1a1a")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      {s.display_name}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label style={fieldLabel}>Address Line 2</label>
              <input value={billingLine2} onChange={e => setBillingLine2(e.target.value)} placeholder="Apartment, suite, etc. (optional)" style={fieldInput} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <label style={fieldLabel}>City</label>
                <input value={billingCity} onChange={e => setBillingCity(e.target.value)} placeholder="London" style={fieldInput} />
              </div>
              <div>
                <label style={fieldLabel}>County / State</label>
                <input value={billingState} onChange={e => setBillingState(e.target.value)} placeholder="Greater London" style={fieldInput} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <label style={fieldLabel}>Postal Code</label>
                <input value={billingPostalCode} onChange={e => setBillingPostalCode(e.target.value)} placeholder="SE1 9GF" style={fieldInput} />
              </div>
              <div>
                <label style={fieldLabel}>Country</label>
                <select value={billingCountry} onChange={e => setBillingCountry(e.target.value)} style={{ ...fieldInput, cursor: "pointer" }}>
                  {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
      {paymentError && <p style={{ fontSize: "12px", color: "#ff4444", marginBottom: "10px" }}>{paymentError}</p>}
      <div className="tap-btn" onClick={!paymentLoading ? handlePayment : undefined} style={{ padding: "14px", borderRadius: "8px", background: paymentLoading ? "#1a1a1a" : "#fff", color: paymentLoading ? "#555" : "#0a0a0a", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: paymentLoading ? "default" : "pointer", letterSpacing: "0.08em", textTransform: "uppercase", transition: "all 0.2s" }}>
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
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');
        @keyframes enterpriseModalOverlayIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes enterpriseModalIn { from { opacity: 0; transform: scale(0.94) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .enterprise-modal-overlay { animation: enterpriseModalOverlayIn 0.15s ease-out forwards; }
        .enterprise-modal-card { animation: enterpriseModalIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .tap-btn { transition: transform 0.12s ease; }
        .tap-btn:active { transform: scale(0.96); }
        @keyframes billingAddressIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        .billing-address-in { animation: billingAddressIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>

      <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #111", display: "flex", alignItems: "center", gap: "12px", position: "fixed", top: 0, left: 0, right: 0, background: "#0a0a0a", zIndex: 100 }}>
        <span onClick={() => navigate("brand-dashboard")} style={{ fontSize: "20px", color: "#555", cursor: "pointer" }}>←</span>
        <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#fff" }}>FlipCollab Enterprise</span>
      </div>

      <div style={{ padding: "2rem 1.25rem", paddingTop: "6rem", paddingBottom: "6rem", maxWidth: "480px", margin: "0 auto" }}>

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
          <div className="tap-btn" onClick={() => setShowModal(true)} style={{ padding: "14px", borderRadius: "8px", background: "#fff", color: "#0a0a0a", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase" }}>
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

      {showModal && createPortal(
  <div className="enterprise-modal-overlay" onClick={() => !paymentLoading && setShowModal(false)} style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(0,0,0,0.85)", zIndex: 99999, overflowY: "auto", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", color: "#fff" }}>
  <div className="enterprise-modal-card" onClick={e => e.stopPropagation()} style={{ position: "relative", maxWidth: "750px", width: "95%", margin: "20px", background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: "14px", padding: "1.5rem" }}>
            {paymentSuccess ? (
              <div style={{ textAlign: "center", padding: "1rem 0" }}>
                <div style={{ fontSize: "40px", marginBottom: "1rem" }}>🎉</div>
                <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "20px", fontWeight: 800, color: "#fff", marginBottom: "8px" }}>You're on Enterprise!</p>
                <p style={{ fontSize: "13px", color: "#555", lineHeight: 1.7, marginBottom: "1.5rem" }}>Platform fees are now waived for you and your creators. Enjoy zero-fee campaigns.</p>
                <div className="tap-btn" onClick={() => { setShowModal(false); navigate("brand-dashboard"); }} style={{ padding: "13px", borderRadius: "8px", background: "#fff", color: "#0a0a0a", fontSize: "13px", fontWeight: 600, cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Back to Dashboard
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
                  <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "16px", fontWeight: 800, color: "#fff" }}>Complete Your Upgrade</p>
                  <span className="tap-btn" onClick={() => setShowModal(false)} style={{ color: "#444", fontSize: "20px", cursor: "pointer", lineHeight: 1 }}>×</span>
                </div>

                <div style={{ display: "flex", gap: "8px", marginBottom: "1.25rem" }}>
                  {[{ label: "Monthly", price: "£97/mo", val: "monthly" }, { label: "Annual", price: "£82/mo", val: "annual" }].map(({ label, price, val }) => (
                    <div key={val} className="tap-btn" onClick={() => setSelectedPlan(val as "monthly" | "annual")} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: `1px solid ${selectedPlan === val ? "#fff" : "#222"}`, background: selectedPlan === val ? "#fff" : "transparent", cursor: "pointer", textAlign: "center", transition: "all 0.15s" }}>
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
        </div>,
        document.body
      )}
    </div>
  );
}