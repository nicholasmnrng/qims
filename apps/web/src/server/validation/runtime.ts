import { z } from "zod";

import {
  deviceTokenPlatformValues,
  storageBucketValues,
} from "@/server/validation/runtime-values";
import { realtimeEventTypes } from "@/server/contracts/realtime";

export const signedUploadRequestSchema = z.object({
  bucket: z.enum(storageBucketValues),
  entityType: z.enum(["procedure_versions", "issue_reports", "handovers"] as const),
  entityId: z.string().trim().min(1).max(160),
  fileName: z.string().trim().min(1).max(240),
  contentType: z.string().trim().min(1).max(120),
  sizeBytes: z.coerce.number().int().min(1),
});

export const localUploadQuerySchema = z.object({
  objectKey: z.string().trim().min(1).max(600),
});

export const registerDeviceTokenSchema = z.object({
  token: z.string().trim().min(8).max(4000),
  platform: z.enum(deviceTokenPlatformValues).default("expo"),
  deviceName: z.string().trim().min(1).max(160).nullable().optional(),
});

export const dispatchNotificationsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  mode: z.enum(["mock", "provider"] as const).default("mock"),
  reason: z.string().trim().min(1).max(500).optional(),
});

export const realtimeEventsQuerySchema = z.object({
  channel: z.string().trim().min(1).max(240).optional(),
  type: z.enum(realtimeEventTypes).optional(),
  since: z.string().datetime().optional(),
});
