# QIMS Inspector API

Tahap 4 menambahkan backend mobile Inspector. Semua endpoint membutuhkan session valid, user aktif, role `inspector`, dan server-side ownership check.

## Today Mission

- `GET /api/inspector/today-mission`

Query:

- `workDate` optional, format `YYYY-MM-DD`. Default memakai tanggal `Asia/Makassar`.

Response memuat data ringan untuk mobile home:

- inspector shift assignment hari ini
- shift dan area
- top priority task
- active tasks
- pending SOP
- latest handover untuk area
- unread notification count
- eco-mode settings
- offline cache hints

## Own Tasks

- `GET /api/tasks`
- `GET /api/tasks/:id`
- `PATCH /api/tasks/:id/status`
- `POST /api/tasks/:id/acknowledge`

Untuk role Inspector, endpoint task hanya mengembalikan task dengan `assignedUserId` sesuai session user.

Status yang dapat diubah Inspector:

- `acknowledged`
- `in_progress`
- `blocked`
- `done`

`blocked` wajib memiliki `reason`. Setiap update status membuat `task_events` dan audit log `tasks.status_update_own`.

`POST /api/tasks/:id/acknowledge` dipakai untuk acknowledge task atau perubahan prioritas. Endpoint ini menulis `task_events`, audit log `tasks.acknowledge`, dan mengisi acknowledgement notification terkait task.

## SOP Acknowledgement

- `GET /api/procedures`
- `GET /api/procedures/:id`
- `POST /api/procedure-versions/:id/acknowledge`

Untuk role Inspector, list SOP hanya menampilkan SOP published yang targetnya relevan:

- semua inspector
- area assignment inspector
- shift assignment inspector
- skill level inspector

Acknowledgement wajib menyatakan sudah dibaca dan dipahami. Untuk SOP critical, `criticalConfirmed` wajib `true`.

Evidence acknowledgement disimpan di `procedure_acknowledgements` dengan timestamp `readAt`, `understoodAt`, dan `criticalConfirmedAt` bila relevan.

## Handovers

- `GET /api/handovers`
- `POST /api/handovers`
- `GET /api/handovers/:id`
- `POST /api/handovers/:id/acknowledge`

Inspector hanya dapat membuat handover dari shift assignment miliknya. `areaId` handover harus sama dengan area assignment.

Handover item memakai kategori PRD:

- `area_condition`
- `completed_work`
- `pending_work`
- `blocker`
- `safety_concern`
- `special_note`

Submit handover menulis audit log `handovers.submit`. Acknowledge handover menulis audit log `handovers.acknowledge`.

## Issues

- `GET /api/issues`
- `POST /api/issues`
- `GET /api/issues/:id`
- `POST /api/issues/:id/comment`

Inspector hanya melihat issue yang dia report sendiri.

Create issue mendukung:

- title
- description
- category
- severity
- areaId
- taskId
- shiftAssignmentId
- attachmentUrl

Issue High dan Critical membuat notification record `issue_alert` untuk Supervisor aktif. Semua create/comment issue menulis `issue_events` dan audit log.

## Notifications

- `GET /api/notifications`
- `PATCH /api/notifications/:id/read`
- `PATCH /api/notifications/:id/acknowledge`

Inspector hanya melihat notification recipient miliknya. `unreadOnly=true` tersedia untuk list ringan.

## Offline Drafts

- `GET /api/offline-drafts`
- `POST /api/offline-drafts`
- `POST /api/offline-drafts/sync`

Draft type:

- `handover`
- `issue`
- `task_note`

Offline draft endpoint menyimpan draft mobile dengan `localDraftId` agar sync idempotent. `sync` mengembalikan hasil per draft:

- `accepted`
- `status`
- `serverDraftId`
- `errorCode`
- `errorMessage`
- `nextAction`

Tahap 4 tidak melakukan auto-submit draft secara diam-diam. Saat online, mobile tetap memakai endpoint eksplisit seperti `POST /api/handovers` atau `POST /api/issues`.

## Eco-Mode Settings

- `GET /api/inspector/settings`
- `PATCH /api/inspector/settings`

Settings:

- `ecoModeEnabled`
- `lowDataModeEnabled`
- `compactModeEnabled`
- `darkModePreferred`
- `backgroundSyncEnabled`

Default backend mengikuti PRD eco-mode: eco, low-data, compact, dan dark mode aktif; background sync nonaktif.

## Audit Coverage

Tahap 4 write actions menghasilkan audit log:

- `tasks.status_update_own`
- `tasks.acknowledge`
- `procedure_versions.acknowledge`
- `handovers.submit`
- `handovers.draft`
- `handovers.acknowledge`
- `issues.create`
- `issues.comment`
- `offline_drafts.upsert`
- `inspector_settings.update`
