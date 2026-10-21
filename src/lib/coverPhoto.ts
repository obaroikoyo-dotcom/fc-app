import { isDemoMode } from "./demo/mode";

// A campaign's cover photo is loaded by everyone who scrolls Explore, so it is
// shrunk before it is uploaded: a phone photo is several megabytes, and a feed
// of those would be slow and cost people their data. 1400px wide is sharper than
// any card needs (the band is about 330px wide on a phone, so this covers 4x
// screens), and the result is a few hundred kilobytes.
const MAX_WIDTH = 1400;
const MAX_SOURCE_BYTES = 30 * 1024 * 1024; // only the original, which is read once on this device

export async function prepareCoverPhoto(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml" || file.type === "image/gif") {
    throw new Error("Choose a JPG, PNG or WebP photo.");
  }
  if (file.size > MAX_SOURCE_BYTES) throw new Error("That photo is too big. Choose one under 30 MB.");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("That photo can't be read. Try a JPG or PNG.");
  }
  const scale = Math.min(1, MAX_WIDTH / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("That photo can't be used. Try another.");
  // A PNG with see-through parts would turn black as a JPEG, so lay white under it.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.82));
  if (!blob) throw new Error("That photo can't be used. Try another.");
  return new File([blob], "cover.jpg", { type: "image/jpeg" });
}

// The address to put in an <img> for a saved cover, or undefined to fall back to
// the colour band. Only https addresses are ever loaded (the database only accepts
// files the app stored, and this is a second check on the way out). In the demo a
// photo never leaves the device and is a data address, which is allowed there only.
export function coverSrc(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const value = url.trim();
  if (/^https:\/\//i.test(value)) return value;
  if (isDemoMode() && /^data:image\/(png|jpeg|webp);base64,/i.test(value)) return value;
  return undefined;
}
