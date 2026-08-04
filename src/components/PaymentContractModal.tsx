import { useState } from "react";

interface CampaignData {
  id: string;
  name: string;
  description: string; // Used as the core deliverables list
  budget: string;      // The raw base budget from Supabase
  deadline: string;
  platforms: string[];
}

interface CreatorData {
  id: string;
  name: string;
}

interface Props {
  isOpen: boolean;
  campaign: CampaignData;
  creator: CreatorData;
  onClose: () => void;
  onConfirmFunding: (totalAmount: number) => Promise<void>;
}

export default function PaymentContractModal({
  isOpen,
  campaign,
  creator,
  onClose,
  onConfirmFunding
}: Props) {
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  // --- ESCROW MATHEMATICS ---
  const baseBudget = parseInt(campaign.budget, 10) || 0;
  const brandPlatformFee = baseBudget * 0.05; // 5% added platform fee
  const totalEscrowCharge = baseBudget + brandPlatformFee;

  const handlePaymentInitiation = async () => {
    setLoading(true);
    try {
      // Passes calculated final billing cost up to your Stripe initialization endpoint
      await onConfirmFunding(totalEscrowCharge);
    } catch (err) {
      console.error("Escrow funding sequence failed:", err);
    } finally {
      setLoading(false);
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
        maxWidth: "500px",
        display: "flex",
        flexDirection: "column",
        maxHeight: "85vh",
        overflow: "hidden"
      }}>
        
        {/* Modal Title Block */}
        <div style={{ padding: "1.25rem", borderBottom: "1px solid #111" }}>
          <span style={{ color: "#34c759", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Secure Collaboration Registry
          </span>
          <h3 style={{ margin: "4px 0 0 0", color: "#fff", fontSize: "16px", fontWeight: 600, fontFamily: "'Syne', sans-serif" }}>
            Review & Fund Milestone Escrow
          </h3>
        </div>

        {/* Dynamic Statement of Work Content */}
        <div style={{ padding: "1.25rem", overflowY: "auto", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          
          {/* Summary Meta Registry card */}
          <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "8px", padding: "14px", display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
            <div>
              <span style={{ color: "#999", fontSize: "10px", textTransform: "uppercase", fontWeight: 600, display: "block" }}>Project Scope</span>
              <span style={{ color: "#fff", fontWeight: 500 }}>{campaign.name}</span>
            </div>
            <div>
              <span style={{ color: "#999", fontSize: "10px", textTransform: "uppercase", fontWeight: 600, display: "block" }}>Hired Content Creator</span>
              <span style={{ color: "#fff", fontWeight: 500 }}>{creator.name}</span>
            </div>
            <div>
              <span style={{ color: "#999", fontSize: "10px", textTransform: "uppercase", fontWeight: 600, display: "block" }}>Required Channels</span>
              <span style={{ color: "#aaa" }}>{campaign.platforms.join(", ")}</span>
            </div>
            <div>
              <span style={{ color: "#999", fontSize: "10px", textTransform: "uppercase", fontWeight: 600, display: "block" }}>Contractual Deliverables</span>
              <p style={{ margin: "2px 0 0 0", color: "#ccc", fontSize: "12px", lineHeight: "1.5" }}>{campaign.description}</p>
            </div>
          </div>

          {/* Legal Escrow Protection Guarantee */}
          <div style={{ borderLeft: "2px solid #34c759", paddingLeft: "10px", margin: 0 }}>
            <p style={{ margin: 0, color: "#aaa", fontSize: "11px", lineHeight: "1.6" }}>
              <strong>Escrow Protection:</strong> Funds are safely charged via Stripe and securely held in our escrow vault. The creator can see the funds are secured but cannot withdraw them until you review and approve the finalized content uploads.
            </p>
          </div>

          {/* Mathematical Financial Breakdown Ledger */}
          <div style={{ background: "#141414", borderRadius: "8px", padding: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
              <span style={{ color: "#aaa" }}>Base Campaign Budget:</span>
              <span style={{ color: "#fff" }}>£{baseBudget.toLocaleString()}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
              <span style={{ color: "#aaa" }}>Platform Booking Fee (+5%):</span>
              <span style={{ color: "#fff" }}>£{brandPlatformFee.toLocaleString()}</span>
            </div>
            
            <hr style={{ border: 0, borderTop: "1px solid #222", margin: "4px 0" }} />
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#fff", fontSize: "13px", fontWeight: 600 }}>Total Due Now to Escrow:</span>
              <span style={{ color: "#34c759", fontSize: "18px", fontWeight: 800, fontFamily: "'Syne', sans-serif" }}>
                £{totalEscrowCharge.toLocaleString()}
              </span>
            </div>
          </div>

        </div>

        {/* Modal Actions */}
        <div style={{ padding: "1rem 1.25rem", borderTop: "1px solid #111", display: "flex", gap: "10px" }}>
          <button 
            onClick={onClose}
            disabled={loading}
            style={{
              flex: 1,
              padding: "12px",
              background: "transparent",
              border: "1px solid #222",
              borderRadius: "8px",
              color: "#999",
              fontSize: "12px",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer"
            }}
          >
            Go Back
          </button>
          
          <button 
            onClick={handlePaymentInitiation}
            disabled={loading}
            style={{
              flex: 2,
              padding: "12px",
              background: "#fff",
              border: "1px solid #fff",
              borderRadius: "8px",
              color: "#0a0a0a",
              fontSize: "12px",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "all 0.2s"
            }}
          >
            {loading ? "Authorizing Stripe Gateway..." : "Confirm & Deposit Funds"}
          </button>
        </div>

      </div>
    </div>
  );
}