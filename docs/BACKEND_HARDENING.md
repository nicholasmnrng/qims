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

- create/update user profile and related audit logs
- create/update master data and related audit logs
- update system settings and related audit logs
- publish schedule: `POST /api/shift-assignments/publish`
- change priority: `PATCH /api/tasks/:id/priority`
- SOP publish: `POST /api/procedure-versions/:id/publish`
- handover submit: `POST /api/handovers`
- role permission update: `PATCH /api/roles/:id/permissions`

## Runtime RBAC

Permission enforcement and `GET /api/me` read `role_permissions` from PostgreSQL. The static map remains the seed/default definition only. Super Admin permission updates therefore apply to subsequent API requests without forcing a new login.

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

Runtime endpoints:

- `POST /api/storage/signed-upload`
- `PUT /api/storage/local-upload?objectKey=...`
- `GET /api/storage/local-upload?objectKey=...`

Local/dev uses `.qims-storage/` and returns `blockedByExternalCredential: true` when no external storage provider is configured. Production still needs object storage credential/env for Supabase/S3/R2 or equivalent provider.

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

Runtime endpoints and schema:

- `POST /api/device-tokens`
- `GET /api/device-tokens`
- `POST /api/notification-worker/dispatch`
- `POST /api/worker/run`
- `background_jobs` table
- `device_tokens` table

Notification database records remain source of truth. The local/dev mock worker updates `notification_recipients.delivery_status`, `delivered_at`, and active token `last_delivered_at`. Production still needs Expo/FCM/APNs credential and managed background runner.

`POST /api/worker/run` is available as a Super Admin local/dev manual runner for testing worker job persistence and completion. Production still needs a managed queue/runner process.

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

Runtime fallback:

- `realtime_events` table
- `GET /api/realtime-events`

Notification creation writes `notification.created` events to `user:{userId}` channels. This provides a testable local/dev polling fallback until a production websocket/SSE/provider is configured.

## Backend Readiness

Backend is ready for frontend consumption under these constraints:

- Role APIs are documented in `docs/API_REFERENCE.md`.
- Pagination limit is capped at 100.
- RBAC, validation, and error handling have focused tests.
- Rate limit and contract helpers have focused tests.
- Local/dev signed upload, notification dispatch, and realtime event log are implemented and covered by MVP smoke.
- Small report export remains available as direct response through `POST /api/reports/export`.
- Async local/dev report export is implemented through `POST /api/reports/export-jobs`, `GET /api/reports/export-jobs/:id`, and download route backed by `background_jobs`.
- Production large export still needs a managed background runner/queue and object storage delivery for large files.

## Supervisor Transaction and Delivery Hardening

Tahap 10.2 memperketat write path Supervisor:

- schedule create/update/duplicate/publish menyimpan audit secara atomik;
- task create/update/priority/status menyimpan task event dan audit secara atomik;
- SOP version create/publish menyimpan target atau status publish dan audit secara atomik;
- issue status menyimpan issue event dan audit secara atomik;
- skill matrix upsert dan audit disimpan dalam satu transaksi;
- realtime event dipublikasikan setelah commit ke channel user, area, dan role yang relevan;
- notification/realtime bukan source of truth dan kegagalan delivery tidak membatalkan data operasional yang sudah committed.

## Inspector Ownership, Sync, and Realtime Hardening

- Task action memiliki server-side critical SOP blocking guard.
- Task/SOP/handover/issue/notification write menyimpan domain record/event dan audit secara atomik.
- Handover next-shift access memeriksa area, target shift, tanggal sumber assignment, dan submitter.
- Offline sync memvalidasi payload per draft type, idempotent berdasarkan `localDraftId`, menyimpan entity reference, serta menangani stale conflict.
- Realtime polling membatasi channel terhadap session user, role, dan area assignment; arbitrary user channel tidak dapat dibaca.

## Reporting Query and Export Hardening

- Report date range divalidasi dan query memakai server-side filters.
- Task/issue shift filters memakai assignment relation.
- Shift completion tidak lagi memuat seluruh task table untuk menghitung satu page.
- SOP compliance dapat membatasi cohort area/shift/inspector dan acknowledgement status.
- Direct export menolak hasil di atas 100 baris agar tidak terjadi silent truncation.
- Local async export melakukan page collection hingga 5000 baris dan menjaga permission serta ownership job.
- Error async job yang tersimpan tidak membocorkan error internal.
