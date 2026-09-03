import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from "https://esm.sh/@aws-sdk/client-s3@3.600.0";
import type { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BUCKET = Deno.env.get("R2_BUCKET_NAME") ?? "";
const ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID") ?? "";

export const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID") ?? "",
    secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY") ?? "",
  },
});

// Deletes every object under a given prefix - R2 (like S3) has no
// recursive "delete folder" call, so this lists then batch-deletes.
export async function deletePrefix(prefix: string): Promise<void> {
  let continuationToken: string | undefined;
  do {
    const list = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, ContinuationToken: continuationToken }));
    const keys = (list.Contents ?? []).map(o => o.Key).filter((k): k is string => !!k);
    if (keys.length > 0) {
      await s3.send(new DeleteObjectsCommand({ Bucket: BUCKET, Delete: { Objects: keys.map(Key => ({ Key })) } }));
    }
    continuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (continuationToken);
}

// Account deletion and bans are the one case where retention rules don't
// apply gradually - everything this person ever uploaded goes immediately,
// full stop. Message TEXT is deliberately left alone even here (only the
// media attached to it) - deleting someone's account shouldn't erase the
// other side of conversations they were never part of choosing to delete.
export async function wipeAllUserMedia(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string
): Promise<void> {
  const { data: ownedCampaigns } = await supabaseAdmin.from("campaigns").select("id").eq("brand_id", userId);
  for (const campaign of (ownedCampaigns ?? []) as { id: string }[]) {
    await deletePrefix(`campaign-assets/${userId}/${campaign.id}/`);
  }

  await deletePrefix(`creators/${userId}.`);
  await deletePrefix(`brands/${userId}.`);
  await deletePrefix(`pitches/${userId}_`);

  const { data: ownApplications } = await supabaseAdmin.from("applications").select("id").eq("creator_id", userId);
  for (const application of (ownApplications ?? []) as { id: string }[]) {
    await deletePrefix(`deliverables/${application.id}_`);
  }

  const { data: conversations } = await supabaseAdmin
    .from("conversations")
    .select("id")
    .or(`participant_1.eq.${userId},participant_2.eq.${userId}`);
  for (const conversation of (conversations ?? []) as { id: string }[]) {
    await deletePrefix(`${conversation.id}/`);
  }
}
