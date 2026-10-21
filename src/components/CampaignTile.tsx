import { toneOf } from "../lib/avatar";

// The coloured band across the top of a campaign card, for campaigns that have
// no photo: a flat tone picked from the niche (the same eight tones as the default
// pictures, so every Beauty campaign is the same colour), one big flat circle
// cropped by the corner, the niche as a small label, and optionally one tag in the
// top corner. Flat on purpose: no gradients, glows or shadows.
//
// It sits at the very top of a card and runs to the card's edges, so the card's
// padding is passed in (`bleed`) and cancelled. true-color keeps the tone and the
// white text as they are in the light look, where the page's colours are flipped.
export default function CampaignTile({ niche, height, bleed, tag }: { niche: string; height: number; bleed: string; tag?: string }) {
  return (
    <div
      className="true-color"
      style={{ position: "relative", flexShrink: 0, height: `${height}px`, margin: `calc(-1 * ${bleed}) calc(-1 * ${bleed}) 0`, background: toneOf(niche), overflow: "hidden", borderRadius: "15px 15px 0 0" }}
    >
      <div style={{ position: "absolute", right: `-${Math.round(height * 0.3)}px`, bottom: `-${Math.round(height * 0.6)}px`, width: `${Math.round(height * 1.6)}px`, height: `${Math.round(height * 1.6)}px`, borderRadius: "50%", background: "rgba(255,255,255,0.1)" }} />
      {niche && (
        <span style={{ position: "absolute", left: "14px", bottom: "10px", color: "#f2f2f2", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>{niche}</span>
      )}
      {tag && (
        <span style={{ position: "absolute", right: "12px", top: "10px", padding: "3px 9px", borderRadius: "20px", background: "#ffffff", color: "#111111", fontSize: "11px", fontWeight: 700 }}>{tag}</span>
      )}
    </div>
  );
}
