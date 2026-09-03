import { supabase } from "./supabase";

export type R2UploadPurpose = "avatar" | "campaign-asset" | "pitch" | "deliverable" | "message-media";

interface R2UploadParams {
  purpose: R2UploadPurpose;
  file: File;
  campaign_id?: string;
  application_id?: string;
  conversation_id?: string;
  folder?: string;
}

// Large files (videos especially) never pass through a Supabase Edge
// Function's own request body - the function only ever hands back a
// short-lived signed URL, and the browser uploads the bytes straight to R2.
// Mirrors the ergonomics of the old supabase.storage.from(bucket).upload()
// call sites this replaces: give it a file and some context, get back a
// public URL.
export async function uploadToR2({ purpose, file, campaign_id, application_id, conversation_id, folder }: R2UploadParams): Promise<string> {
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();

  const { data, error } = await supabase.functions.invoke("r2-presigned-url", {
    body: { purpose, ext, content_type: file.type || undefined, campaign_id, application_id, conversation_id, folder },
  });
  if (error || !data?.uploadUrl) {
    let message = "Failed to prepare upload.";
    try {
      const errBody = await (error as any)?.context?.json();
      if (errBody?.error) message = errBody.error;
    } catch {
      // Fall back to the generic message above.
    }
    throw new Error(message);
  }

  const putRes = await fetch(data.uploadUrl, {
    method: "PUT",
    headers: file.type ? { "Content-Type": file.type } : undefined,
    body: file,
  });
  if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`);

  return data.publicUrl as string;
}
