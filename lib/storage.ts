import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutBucketLifecycleConfigurationCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Readable } from "node:stream";

export type ObjectMeta = {
  size: number;
  contentType?: string;
};

function s3Config() {
  const bucket = process.env.S3_BUCKET ?? process.env.FILES_S3_BUCKET;
  const region = process.env.AWS_REGION ?? process.env.S3_REGION ?? "us-west-2";
  if (!bucket) return null;
  return { bucket, region };
}

function requireS3() {
  const config = s3Config();
  if (!config) {
    throw Object.assign(
      new Error("Amazon S3 is not configured. Set S3_BUCKET and AWS_REGION."),
      { status: 503 },
    );
  }
  return {
    config,
    s3: new S3Client({ region: config.region }),
  };
}

export function usesRemoteStore() {
  return s3Config() !== null;
}

export function objectKey(id: string, state: "upload" | "published" | "quarantine") {
  return `${state}/${id}`;
}

export async function createConstrainedUpload(input: {
  id: string;
  sizeBytes: number;
  contentType: string;
  origin: string;
}): Promise<{ method: "PUT"; url: string; headers: Record<string, string> }> {
  void input.origin;
  const remote = requireS3();
  const headers = {
    "content-length": String(input.sizeBytes),
    "content-type": input.contentType,
  };
  const command = new PutObjectCommand({
    Bucket: remote.config.bucket,
    Key: objectKey(input.id, "upload"),
    ContentLength: input.sizeBytes,
    ContentType: input.contentType,
  });
  const url = await getSignedUrl(remote.s3, command, { expiresIn: 15 * 60 });
  return { method: "PUT", url, headers };
}

export async function putLocalUpload() {
  throw Object.assign(new Error("Local uploads are disabled. Use the Amazon S3 presigned URL."), {
    status: 400,
  });
}

export async function headObject(
  id: string,
  state: "upload" | "published" | "quarantine" = "upload",
): Promise<ObjectMeta | null> {
  const remote = requireS3();
  try {
    const result = await remote.s3.send(
      new HeadObjectCommand({
        Bucket: remote.config.bucket,
        Key: objectKey(id, state),
      }),
    );
    return {
      size: result.ContentLength ?? 0,
      contentType: result.ContentType,
    };
  } catch {
    return null;
  }
}

export async function publishObject(_id: string) {
  requireS3();
}

export async function quarantineAndDelete(id: string) {
  const remote = requireS3();
  for (const state of ["upload", "published"] as const) {
    await remote.s3
      .send(
        new DeleteObjectCommand({
          Bucket: remote.config.bucket,
          Key: objectKey(id, state),
        }),
      )
      .catch(() => undefined);
  }
}

export async function deletePublished(id: string) {
  await quarantineAndDelete(id);
}

export async function openPublished(id: string) {
  const remote = requireS3();
  const result = await remote.s3.send(
    new GetObjectCommand({
      Bucket: remote.config.bucket,
      Key: objectKey(id, "upload"),
    }),
  );
  if (!result.Body) throw new Error("Empty object body");
  return result.Body as Readable;
}

export async function applyLifecycleBackup() {
  const remote = requireS3();
  await remote.s3.send(
    new PutBucketLifecycleConfigurationCommand({
      Bucket: remote.config.bucket,
      LifecycleConfiguration: {
        Rules: [
          {
            ID: "expire-all-objects-7-days",
            Status: "Enabled",
            Filter: { Prefix: "" },
            Expiration: { Days: 7 },
          },
          {
            ID: "expire-quarantine-1-day",
            Status: "Enabled",
            Filter: { Prefix: "quarantine/" },
            Expiration: { Days: 1 },
          },
        ],
      },
    }),
  );
}
