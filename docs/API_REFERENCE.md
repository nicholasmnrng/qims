# QIMS Backend API Reference

Dokumen ini menjadi index API backend setelah Tahap 7. Frontend web dan mobile harus memakai endpoint yang sudah tercatat di dokumen role berikut:

- Foundation/auth: `docs/API_FOUNDATION.md`
- Super Admin: `docs/API_SUPER_ADMIN.md`
- Supervisor / Leader: `docs/API_SUPERVISOR.md`
- Inspector mobile: `docs/API_INSPECTOR.md`
- QA Manager: `docs/API_QA_MANAGER.md`
- Auditor / Viewer: `docs/API_AUDITOR.md`
- Backend hardening contracts: `docs/BACKEND_HARDENING.md`

## Global Rules

- Semua endpoint selain login membutuhkan session valid, kecuali native Better Auth route yang dipakai library auth.
- Permission selalu dicek server-side.
- Runtime RBAC membaca mapping permission dari database sehingga perubahan role permission berlaku pada request berikutnya.
- List besar wajib memakai pagination dengan `page` dan `limit`; limit maksimum 100.
- Semua body write divalidasi dengan schema.
- Error custom QIMS memakai shape:

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Input tidak valid.",
    "details": {}
  }
}
```

## Rate Limited Endpoints

- `POST /api/auth/login`: 5 request per menit per IP dan email.
- `POST /api/auth/[...all]`: 30 request per menit per IP.
- `POST /api/reports/export`: 10 request per menit per IP.
- `PATCH /api/roles/:id/permissions`: 20 request per 5 menit per IP.
- `PATCH /api/system-settings`: 20 request per 5 menit per IP.

Rate limit Tahap 7 memakai in-memory bucket untuk development/MVP backend contract. Production deployment harus memindahkan backing store ke Redis atau managed rate-limit service seperti yang direncanakan PRD architecture.

## Frontend Consumption Notes

- Web dashboard dapat mulai dari role API docs sesuai permission user.
- Mobile Inspector harus memakai endpoint lightweight `GET /api/inspector/today-mission` untuk home screen.
- Upload file memakai `POST /api/storage/signed-upload` lalu `PUT /api/storage/local-upload?objectKey=...` pada local/dev. Production object storage memakai contract env provider dan credential eksternal.
- Notification worker local/dev memakai `POST /api/notification-worker/dispatch` untuk mock dispatch pending notification ke device token aktif.
- Realtime local/dev memakai `GET /api/realtime-events` sebagai event log/polling fallback. Production websocket/SSE/provider masih dependency deployment eksternal.
- Async report export local/dev memakai `POST /api/reports/export-jobs`, `GET /api/reports/export-jobs/:id`, dan `GET /api/reports/export-jobs/:id/download`.
- Rotation recommendation local/dev memakai `GET /api/rotation-recommendations` untuk ranking inspector per area dari skill matrix dan assignment load.

## Tahap 10.2 Supervisor Runtime Notes

- Assignment list menerima `dateFrom`, `dateTo`, dan `skillLevel`, serta mengembalikan konteks skill inspector pada area.
- Handover dan issue list menerima rentang tanggal; issue juga menerima `shiftAssignmentId`.
- Supervisor notification list menerima filter recipient/delivery/read/acknowledgement dan mengembalikan detail serta summary penerima.
- Schedule, task priority/status, SOP publish, dan issue status menghasilkan event realtime pada channel user/area/role yang relevan.
- Write operasional utama menyimpan perubahan domain, event domain, dan audit log dalam transaksi yang sama. Notification dan realtime tetap dikirim setelah commit; PostgreSQL tetap source of truth.

## Tahap 10.3 Inspector Runtime Notes

- Today Mission mengembalikan `pendingCriticalSops` dan `taskActionsBlocked`.
- Task acknowledge/status ditolak dengan conflict yang actionable sampai SOP critical dikonfirmasi.
- Offline sync membuat handover, issue, atau task progress note secara idempotent dan menyimpan referensi entity hasil sync.
- Offline conflict memakai `clientUpdatedAt` dan pilihan `keep_local`, `use_server`, atau `merge_manually`.
- Realtime polling hanya membuka channel user/role/area yang dimiliki session dan mendukung cursor waktu `since`.
- Handover acknowledgement dibatasi ke next-shift inspector yang relevan; submitter tidak dapat acknowledge miliknya sendiri.

## Runtime Integration Endpoints

### Device Tokens

- `GET /api/device-tokens`
- `POST /api/device-tokens`

Permission: authenticated user.

`POST` body:

```json
{
  "token": "ExponentPushToken[...]",
  "platform": "expo",
  "deviceName": "Inspector phone"
}
```

Writes audit action `device_tokens.register`.

### Storage

- `POST /api/storage/signed-upload`
- `PUT /api/storage/local-upload?objectKey=...`
- `GET /api/storage/local-upload?objectKey=...`

`POST /api/storage/signed-upload` validates bucket, MIME type, file size, and permission:

- `sop-files`: `sop:manage`
- `issue-photos`: `issues:create-own` or `issues:manage`
- `handover-files`: `handover:create-own` or `handover:manage`

Local/dev response returns provider `local-dev`, PUT URL, object key, public URL, expiration timestamp, required headers, and `blockedByExternalCredential: true` when no storage provider env is configured.

### Notification Worker

- `POST /api/notification-worker/dispatch`

Permission: `roles:manage`.

Body:

```json
{
  "limit": 50,
  "mode": "mock",
  "reason": "Manual dispatch QA"
}
```

Processes pending notification recipients and updates delivery status. Local/dev mock marks recipients delivered when the user has an active registered device token and failed otherwise. Writes audit action `notification_worker.dispatch`.

### Realtime Events

- `GET /api/realtime-events?type=notification.created&channel=user:{userId}&page=1&limit=20`

Permission: `notifications:read`.

This is a local/dev event log and lightweight polling fallback. Notification creation publishes `notification.created` events on `user:{userId}` channels. Database notification records remain source of truth.

### Background Jobs & Async Export

- `POST /api/worker/run`
- `POST /api/reports/export-jobs`
- `GET /api/reports/export-jobs/:id`
- `GET /api/reports/export-jobs/:id/download`

`POST /api/worker/run` is a Super Admin local/dev manual runner for job types in `background_jobs`. It records `background_jobs.run` audit entries and is not a production scheduler.

`POST /api/reports/export-jobs` requires `reports:export`, validates reason/filters, creates a `background_jobs` row, runs the existing report export flow locally, writes report export audit through the existing export service, and stores downloadable CSV/JSON content in the job result.

### Rotation Recommendations

- `GET /api/rotation-recommendations`

Permission: `super_admin`, `supervisor`, or `qa_manager`.

Response returns active areas with recommended inspector, current assignment load, area minimum skill, selected skill level, and reason. PostgreSQL skill matrix and assignments remain the source of truth; this endpoint is an assistive recommendation, not automatic assignment.
