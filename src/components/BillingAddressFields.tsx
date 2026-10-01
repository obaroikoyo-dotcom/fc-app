import { COUNTRIES } from "../lib/countries";
import { type BillingAddress } from "../lib/useBillingAddress";

const fieldLabel: React.CSSProperties = { fontSize: "10px", color: "#999", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: "6px" };
const fieldInput: React.CSSProperties = { background: "#111", border: "1px solid #222", borderRadius: "8px", padding: "11px 14px", color: "#fff", fontSize: "14px", outline: "none", width: "100%", fontFamily: "inherit", boxSizing: "border-box" as const };

// Shared by every screen that collects a billing address (campaign
// payments, enterprise subscriptions, ...) so the search-to-autofill UI
// and the accuracy check are identical everywhere instead of drifting.
export default function BillingAddressFields({ addr }: { addr: BillingAddress }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ position: "relative" }}>
        <label style={fieldLabel}>Address Line 1 <span style={{ color: "#777", textTransform: "none", letterSpacing: 0 }}>— start typing to search</span></label>
        <input
          value={addr.line1}
          onChange={e => addr.setLine1(e.target.value)}
          onFocus={() => addr.suggestions.length > 0 && addr.setShowSuggestions(true)}
          onBlur={() => setTimeout(() => addr.setShowSuggestions(false), 150)}
          placeholder="123 High Street"
          style={fieldInput}
          autoComplete="off"
        />
        {addr.searching && (
          <span style={{ position: "absolute", right: "14px", top: "36px", fontSize: "11px", color: "#999" }}>Searching…</span>
        )}
        {addr.showSuggestions && addr.suggestions.length > 0 && (
          <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#111", border: "1px solid #222", borderRadius: "8px", overflow: "hidden", zIndex: 10, maxHeight: "220px", overflowY: "auto" }}>
            {addr.suggestions.map((s, i) => (
              <div
                key={i}
                onMouseDown={() => addr.selectSuggestion(s)}
                style={{ padding: "10px 14px", fontSize: "12px", color: "#ccc", cursor: "pointer", borderBottom: i < addr.suggestions.length - 1 ? "1px solid #1a1a1a" : "none" }}
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
        <input value={addr.line2} onChange={e => addr.setLine2(e.target.value)} placeholder="Apartment, suite, etc. (optional)" style={fieldInput} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        <div>
          <label style={fieldLabel}>City</label>
          <input value={addr.city} onChange={e => addr.setCity(e.target.value)} placeholder="London" style={fieldInput} />
        </div>
        <div>
          <label style={fieldLabel}>County / State</label>
          {addr.regionsForCountry ? (
            <select value={addr.state} onChange={e => addr.setState(e.target.value)} style={{ ...fieldInput, cursor: "pointer", color: addr.state ? "#fff" : "#999" }}>
              <option value="">Select...</option>
              {addr.regionsForCountry.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}
            </select>
          ) : (
            <input value={addr.state} onChange={e => addr.setState(e.target.value)} placeholder="Greater London" style={fieldInput} />
          )}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        <div>
          <label style={fieldLabel}>Postal Code</label>
          <input value={addr.postalCode} onChange={e => addr.setPostalCode(e.target.value)} placeholder="SE1 9GF" style={fieldInput} />
        </div>
        <div>
          <label style={fieldLabel}>Country</label>
          <select value={addr.country} onChange={e => addr.setCountry(e.target.value)} style={{ ...fieldInput, cursor: "pointer" }}>
            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </div>
      </div>
      {addr.verifyError && <p style={{ fontSize: "11px", color: "#ff3b30", lineHeight: 1.5 }}>{addr.verifyError}</p>}
    </div>
  );
}
