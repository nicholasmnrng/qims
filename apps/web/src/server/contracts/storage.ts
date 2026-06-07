export const storageBuckets = ["sop-files", "issue-photos", "handover-files"] as const;
export type StorageBucket = (typeof storageBuckets)[number];

export const uploadContentTypes: Record<StorageBucket, readonly string[]> = {
  "sop-files": ["application/pdf", "image/png", "image/jpeg"],
  "issue-photos": ["image/png", "image/jpeg", "image/webp"],
  "handover-files": ["image/png", "image/jpeg", "application/pdf"],
};

export const uploadMaxBytes: Record<StorageBucket, number> = {
  "sop-files": 10 * 1024 * 1024,
  "issue-photos": 5 * 1024 * 1024,
  "handover-files": 10 * 1024 * 1024,
};

export type StorageUploadIntent = {
  bucket: StorageBucket;
  entityType: "procedure_versions" | "issue_reports" | "handovers";
  entityId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
};

export function isAllowedUpload(intent: StorageUploadIntent) {
  return (
    uploadContentTypes[intent.bucket].includes(intent.contentType) &&
    intent.sizeBytes > 0 &&
    intent.sizeBytes <= uploadMaxBytes[intent.bucket]
  );
}

export function storageObjectKey(intent: StorageUploadIntent) {
  const safeFileName = intent.fileName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${intent.bucket}/${intent.entityType}/${intent.entityId}/${Date.now()}-${safeFileName}`;
}

export type SignedUploadUrlContract = {
  method: "PUT";
  url: string;
  objectKey: string;
  expiresAt: string;
  requiredHeaders: {
    "content-type": string;
  };
};
