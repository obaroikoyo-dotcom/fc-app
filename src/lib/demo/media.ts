// In the demo an "upload" never leaves the device: the file is turned into an
// address that works inside this page and nothing is sent anywhere.

const MAX_IMAGE_SIDE = 1280;

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Couldn't read the file"));
    reader.readAsDataURL(file);
  });
}

// Photos are shrunk first so they stay small enough to survive in the saved
// visit. The returned address ends in "#" on purpose: the app adds
// "?t=<time>" to avatar and logo addresses to bust caches, and after a "#"
// that is ignored instead of corrupting the picture.
async function imageDataUrl(file: File): Promise<string> {
  try {
    if (file.type === "image/svg+xml" || typeof createImageBitmap !== "function") throw new Error("not scalable");
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const keepsAlpha = file.type === "image/png" || file.type === "image/webp";
    return `${canvas.toDataURL(keepsAlpha ? "image/png" : "image/jpeg", 0.86)}#`;
  } catch {
    return `${await readAsDataUrl(file)}#`;
  }
}

export async function localMediaUrl(file: File): Promise<string> {
  if (file.type.startsWith("image/")) return imageDataUrl(file);
  // Videos stay as a temporary in-page address; they play for as long as the
  // page is open and are simply gone after a reload.
  return URL.createObjectURL(file);
}
