// Links built from text that a user typed or saved (a brand's website, a
// campaign link, a cached social post address, a message's media link) must
// only ever be ordinary web addresses. A "javascript:" address saved in one of
// those places would otherwise run script in the app's own origin the moment
// someone clicked it - including the admin, when reviewing a dispute.
//
// Returns the cleaned address, or undefined when it isn't http(s). React drops
// an undefined href, so the element simply stops being a link.
export function safeHttpUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) return undefined;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

// Thumbnails of uploaded assets link out to the full file. An SVG can carry
// script, and opening one directly (rather than showing it in an <img>, which
// is safe) would run it, so SVG thumbnails are shown but not linked.
export function safeAssetLink(value: string | null | undefined): string | undefined {
  const url = safeHttpUrl(value);
  if (!url) return undefined;
  return /\.svgz?(\?|#|$)/i.test(url) ? undefined : url;
}
