import { useState } from "react";
import { toneOf } from "../lib/avatar";

// A photo gets a wide banner (5:2, about 135px tall on a phone card): taller than a
// colour band so a good part of the picture shows, short enough that a card still
// reads as a card and several fit on the screen. 16:9 was tried and filled the screen.
export const PHOTO_RATIO = "5 / 2";

// The band across the top of a campaign card. With a cover photo it shows the
// photo; without one, a flat tone picked from the niche (the same eight tones as
// the default pictures, so every Beauty campaign is the same colour) with one big
// flat circle cropped by the corner. Either way the niche is a small label and
// there can be one tag in the top corner. Flat on purpose: no gradients, glows or
// shadows. A photo is left exactly as it is (no dark layer over it, which turned
// bright pictures dull and grey); the label sits on its own small dark pill so it
// reads on any picture.
//
// It sits at the very top of a card and runs to the card's edges, so the card's
// padding is passed in (`bleed`) and cancelled. Nothing here is themed: the tone,
// the photo and the label look the same in the light and the dark look, and a photo
// shows in exactly its own colours.
// `ratio` makes a band the same shape as a photo (a row where some cards have
// photos and some don't, so they line up).
export default function CampaignTile({ niche, height, bleed, tag, photo, radius = "15px 15px 0 0", ratio }: {
  niche: string;
  height: number;
  bleed: string;
  tag?: string;
  photo?: string;
  radius?: string;
  ratio?: string;
}) {
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null); // a photo that won't load falls back to the band
  const showPhoto = !!photo && brokenUrl !== photo;
  const shape = ratio ?? (showPhoto ? PHOTO_RATIO : undefined);
  return (
    <div
      className="campaign-tile"
      style={{ position: "relative", flexShrink: 0, ...(shape ? { aspectRatio: shape } : { height: `${height}px` }), margin: `calc(-1 * ${bleed}) calc(-1 * ${bleed}) 0`, background: toneOf(niche), overflow: "hidden", borderRadius: radius }}
    >
      {showPhoto ? (
        <img
          src={photo}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setBrokenUrl(photo ?? null)}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <div style={{ position: "absolute", right: `-${Math.round(height * 0.3)}px`, bottom: `-${Math.round(height * 0.6)}px`, width: `${Math.round(height * 1.6)}px`, height: `${Math.round(height * 1.6)}px`, borderRadius: "50%", background: "rgba(255,255,255,0.1)" }} />
      )}
      {niche && (showPhoto ? (
        <span style={{ position: "absolute", left: "12px", bottom: "10px", padding: "3px 9px", borderRadius: "20px", background: "rgba(0,0,0,0.6)", color: "#f2f2f2", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>{niche}</span>
      ) : (
        <span style={{ position: "absolute", left: "14px", bottom: "10px", color: "#f2f2f2", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>{niche}</span>
      ))}
      {tag && (
        <span style={{ position: "absolute", right: "12px", top: "10px", padding: "3px 9px", borderRadius: "20px", background: "#ffffff", color: "#111111", fontSize: "11px", fontWeight: 700 }}>{tag}</span>
      )}
    </div>
  );
}
