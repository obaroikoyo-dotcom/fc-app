import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from "https://esm.sh/@aws-sdk/client-s3@3.600.0";

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
