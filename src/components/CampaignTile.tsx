import { useState } from "react";
import { toneOf } from "../lib/avatar";

// The band across the top of a campaign card. With a cover photo it shows the
// photo; without one, a flat tone picked from the niche (the same eight tones as
// the default pictures, so every Beauty campaign is the same colour) with one big
// flat circle cropped by the corner. Either way the niche is a small label and
// there can be one tag in the top corner. Flat on purpose: no gradients, glows or
// shadows (the photo gets a flat dark layer so the white label always reads).
//
// It sits at the very top of a card and runs to the card's edges, so the card's
// padding is passed in (`bleed`) and cancelled. true-color keeps the colours as
// they are in the light look, where the page's colours are flipped; the photo opts
// out of the flip-back that images normally get, or it would be flipped twice.
export default function CampaignTile({ niche, height, bleed, tag, photo, radius = "15px 15px 0 0" }: {
  niche: string;
  height: number;
  bleed: string;
  tag?: string;
  photo?: string;
  radius?: string;
}) {
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null); // a photo that won't load falls back to the band
  const showPhoto = !!photo && brokenUrl !== photo;
  return (
    <div
      className="true-color"
      style={{ position: "relative", flexShrink: 0, height: `${height}px`, margin: `calc(-1 * ${bleed}) calc(-1 * ${bleed}) 0`, background: toneOf(niche), overflow: "hidden", borderRadius: radius }}
    >
      {showPhoto ? (
        <>
          <img
            className="no-reinvert"
            src={photo}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setBrokenUrl(photo ?? null)}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)" }} />
        </>
      ) : (
        <div style={{ position: "absolute", right: `-${Math.round(height * 0.3)}px`, bottom: `-${Math.round(height * 0.6)}px`, width: `${Math.round(height * 1.6)}px`, height: `${Math.round(height * 1.6)}px`, borderRadius: "50%", background: "rgba(255,255,255,0.1)" }} />
      )}
      {niche && (
        <span style={{ position: "absolute", left: "14px", bottom: "10px", color: "#f2f2f2", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>{niche}</span>
      )}
      {tag && (
        <span style={{ position: "absolute", right: "12px", top: "10px", padding: "3px 9px", borderRadius: "20px", background: "#ffffff", color: "#111111", fontSize: "11px", fontWeight: 700 }}>{tag}</span>
      )}
    </div>
  );
}
