import { supabase } from "./supabase";
import { isDemoMode } from "./demo/mode";

// Downloads a deal's video as a file, for the brand, once the payment has been released.
// The video in the chat is shown with a "PREVIEW" watermark drawn over it until then; the
// stored file has no watermark, so this saves the clean original.
//
// The download-deliverable edge function checks (from the database) that the caller is the
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
    const { data, error } = await supabase.functions.invoke("download-deliverable", { body: { application_id: applicationId } });
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
