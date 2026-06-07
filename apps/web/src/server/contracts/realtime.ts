import type {
  notificationPriorityValues,
  notificationTypeValues,
  taskPriorityValues,
} from "@/server/db/schema";

export type NotificationType = (typeof notificationTypeValues)[number];
export type NotificationPriority = (typeof notificationPriorityValues)[number];
export type TaskPriority = (typeof taskPriorityValues)[number];

export const realtimeEventTypes = [
  "schedule.updated",
  "task.priority_changed",
  "task.status_changed",
  "sop.published",
  "sop.acknowledged",
  "handover.submitted",
  "issue.created",
  "issue.status_changed",
  "notification.created",
] as const;

export type RealtimeEventType = (typeof realtimeEventTypes)[number];

type RealtimeBase<T extends RealtimeEventType, P extends Record<string, unknown>> = {
  id: string;
  type: T;
  channel: string;
  occurredAt: string;
  actorId?: string | null;
  payload: P;
};

export type RealtimeEvent =
  | RealtimeBase<"schedule.updated", { workDate: string; shiftId?: string | null }>
  | RealtimeBase<
      "task.priority_changed",
      { taskId: string; priority: TaskPriority; assignedUserId?: string | null }
    >
  | RealtimeBase<"task.status_changed", { taskId: string; status: string }>
  | RealtimeBase<"sop.published", { procedureVersionId: string; isCritical: boolean }>
  | RealtimeBase<"sop.acknowledged", { procedureVersionId: string; userId: string }>
  | RealtimeBase<"handover.submitted", { handoverId: string; areaId?: string | null }>
  | RealtimeBase<"issue.created", { issueId: string; severity: string; areaId?: string | null }>
  | RealtimeBase<"issue.status_changed", { issueId: string; status: string }>
  | RealtimeBase<
      "notification.created",
      { notificationId: string; notificationType: NotificationType; priority: NotificationPriority }
    >;

export function userChannel(userId: string) {
  return `user:${userId}`;
}

export function roleChannel(role: string) {
  return `role:${role}`;
}

export function areaChannel(areaId: string) {
  return `area:${areaId}`;
}
