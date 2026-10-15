// The picture shown for someone who hasn't added one: their initials on a
// flat, muted tone, so people and brands are told apart at a glance instead of
// all sharing the same blank glyph. The tone comes from the name itself, so a
// person keeps the same default picture everywhere and on every visit.

const TONES = ["#5b6b7a", "#7a6a5b", "#5e7a6a", "#7a5b6a", "#66667a", "#7a735b", "#5b7a78", "#7a625b"];

const cache = new Map<string, string>();

function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Up to two initials: "Maya Shaw" -> "MS", "Fernhill" -> "F", nothing -> "?".
function initialsOf(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(word => Array.from(word)[0]!.toUpperCase())
    .join("");
  return letters || "?";
}

// A self-contained image address (nothing to host or fetch), usable anywhere
// an <img src> goes.
export function monogram(name: string | null | undefined): string {
  const clean = (name ?? "").trim();
  const hit = cache.get(clean);
  if (hit) return hit;

  let h = 0;
  for (let i = 0; i < clean.length; i++) h = (h * 31 + clean.charCodeAt(i)) >>> 0;
  const tone = TONES[h % TONES.length];
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">' +
    `<rect width="120" height="120" fill="${tone}"/>` +
    '<text x="60" y="60" dy="0.35em" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" ' +
    `font-size="46" font-weight="700" fill="#f2f2f2">${escapeXml(initialsOf(clean))}</text></svg>`;
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  cache.set(clean, url);
  return url;
}

// The picture they chose, or the default one built from their name.
export function avatarSrc(url: string | null | undefined, name: string | null | undefined): string {
  return url || monogram(name);
}
