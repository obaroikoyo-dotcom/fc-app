import { supabase } from "./supabase";
import { isDemoMode } from "./demo/mode";

// The address the download function was given when it was created in the dashboard. Its name there
// is download-deliverable (source: supabase/functions/download-deliverable), but the dashboard picks
// the address itself and chose this one. If the function is ever recreated, change this to match.
const DOWNLOAD_FUNCTION = "rapid-service";

// Downloads a deal's video as a file, for the brand, once the payment has been released.
// The video in the chat is shown with a "PREVIEW" watermark drawn over it until then; the
// stored file has no watermark, so this saves the clean original.
//
// The download function checks (from the database) that the caller is the
// brand, that the deal is paid out, and that the file is one this app stored, and returns a
// short-lived link that makes the browser save the file rather than play it. Doing it that way
// (instead of fetching the file into the page) works for any size, on phones too.
//
// Until that function has been deployed the call comes back "not found"; then the video's own
// address is opened in a new tab instead, so the person can still save it from there.
export async function downloadDeliverable(applicationId: string, videoUrl: string): Promise<{ openedInTab: boolean }> {
  let link: string;
  let fileName = "video.mp4";

  if (isDemoMode()) {
    // Nothing leaves the device in the demo; the sample clip is on the same site, so it can be saved directly.
    link = videoUrl;
  } else {
    const { data, error } = await supabase.functions.invoke(DOWNLOAD_FUNCTION, { body: { application_id: applicationId } });
    if (error || !data?.downloadUrl) {
      let status: number | undefined;
      let message = "Couldn't get the download link. Try again in a moment.";
      try {
        const res = (error as { context?: Response } | null)?.context;
        status = res?.status;
        const body = await res?.json();
        if (body?.error) message = body.error;
      } catch {
        // keep the general message
      }
      if (status === 404 && !/no video/i.test(message)) {
        window.open(videoUrl, "_blank", "noopener");
        return { openedInTab: true };
      }
      throw new Error(message);
    }
    link = data.downloadUrl as string;
    if (typeof data.fileName === "string" && data.fileName) fileName = data.fileName;
  }

  const a = document.createElement("a");
  a.href = link;
  a.download = fileName; // only honoured for same-site links; the signed link carries its own file name
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  return { openedInTab: false };
}
