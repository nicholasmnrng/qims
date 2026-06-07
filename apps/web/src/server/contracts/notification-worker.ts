import type {
  NotificationPriority,
  NotificationType,
} from "./realtime";

export const notificationJobTypes = [
  "push_notification",
  "sop_reminder",
  "handover_reminder",
  "report_export",
  "issue_escalation",
] as const;

export type NotificationJobType = (typeof notificationJobTypes)[number];

export type NotificationWorkerJob = {
  id: string;
  type: NotificationJobType;
  priority: NotificationPriority;
  entityType?: string | null;
  entityId?: string | null;
  recipientIds: string[];
  payload: Record<string, unknown>;
  scheduledAt: string;
  attempts: number;
};

export type PushNotificationPayload = {
  notificationId: string;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  entityType?: string | null;
  entityId?: string | null;
};

export function nextRetryDelayMs(attempts: number) {
  return Math.min(60_000, 2 ** Math.max(attempts, 0) * 1000);
}
