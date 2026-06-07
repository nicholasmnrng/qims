# QIMS Backend Hardening

Tahap 7 menyiapkan backend agar siap dikonsumsi frontend tanpa masuk ke implementasi UI.

## Rate Limit

Implemented helper:

- `apps/web/src/server/api/rate-limit.ts`

Protected endpoints:

- `POST /api/auth/login`
- `POST /api/auth/[...all]`
- `POST /api/reports/export`
- `PATCH /api/roles/:id/permissions`
- `PATCH /api/system-settings`

Response saat limit terlampaui:

```json
{
  "ok": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Terlalu banyak request. Coba lagi nanti.",
    "details": {
      "resetAt": "2026-06-08T00:00:00.000Z"
    }
  }
}
```

Catatan production: in-memory bucket cukup untuk kontrak MVP lokal, tetapi deployment multi-instance harus memakai Redis/cache sesuai PRD architecture.

## Index Review

Existing schema sudah memiliki index utama untuk `user_id`, `area_id`, `shift_id`, `work_date`, `status`, `priority`, dan `created_at` pada tabel operasional utama.

Tahap 7 menambahkan index query hardening untuk:

- `tasks.due_at`
- `task_events.event_type`
- `skill_matrix.valid_until`
- `procedure_acknowledgements.understood_at`
- `procedure_acknowledgements.created_at`
- `handovers.submitted_by`
- `handovers.created_at`
- `issue_reports.assigned_to`
- `issue_events.event_type`
- `notification_recipients.read_at`
- `notification_recipients.acknowledged_at`
- `offline_drafts.created_at`

Migration:

- `apps/web/drizzle/0004_ambitious_dexter_bennett.sql`

## Transaction Review

Important PRD operations already use transactions:

- publish schedule: `POST /api/shift-assignments/publish`
- change priority: `PATCH /api/tasks/:id/priority`
- SOP publish: `POST /api/procedure-versions/:id/publish`
- handover submit: `POST /api/handovers`
- role permission update: `PATCH /api/roles/:id/permissions`

Follow-up production improvement: wrap notification creation and audit log insertion in an outbox pattern when background workers are introduced.

## Storage Contract

Typed contract:

- `apps/web/src/server/contracts/storage.ts`

Buckets:

- `sop-files`
- `issue-photos`
- `handover-files`

Contract covers:

- allowed content types
- max file size
- object key naming
- signed upload URL response shape

No signed URL route is exposed yet; this prevents frontend from assuming direct upload behavior before object storage credentials and provider are configured.

## Notification Worker Contract

Typed contract:

- `apps/web/src/server/contracts/notification-worker.ts`

Job types:

- `push_notification`
- `sop_reminder`
- `handover_reminder`
- `report_export`
- `issue_escalation`

Contract covers:

- worker job payload
- push notification payload
- retry backoff cap

Notification database records remain source of truth. Worker delivery updates should write back to `notification_recipients.delivery_status`, `delivered_at`, and related timestamps.

## Realtime Contract

Typed contract:

- `apps/web/src/server/contracts/realtime.ts`

Channels:

- `user:{userId}`
- `role:{role}`
- `area:{areaId}`

Event types:

- `schedule.updated`
- `task.priority_changed`
- `task.status_changed`
- `sop.published`
- `sop.acknowledged`
- `handover.submitted`
- `issue.created`
- `issue.status_changed`
- `notification.created`

Realtime events are delivery signals only. PostgreSQL remains source of truth.

## Backend Readiness

Backend is ready for frontend consumption under these constraints:

- Role APIs are documented in `docs/API_REFERENCE.md`.
- Pagination limit is capped at 100.
- RBAC, validation, and error handling have focused tests.
- Rate limit and contract helpers have focused tests.
- Large report export remains direct response for MVP small data only; async export worker is documented as production hardening path.
