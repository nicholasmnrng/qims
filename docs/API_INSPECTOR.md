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
- daftar SOP critical yang belum dikonfirmasi
- `taskActionsBlocked` untuk blocking prompt sebelum task dilanjutkan

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

`blocked` wajib memiliki `reason`. Inspector tidak dapat acknowledge atau mengubah status task selama masih ada SOP critical yang belum dikonfirmasi. Setiap update status menyimpan task, `task_events`, dan audit log `tasks.status_update_own` secara atomik.

`POST /api/tasks/:id/acknowledge` dipakai untuk acknowledge task atau perubahan prioritas. Endpoint ini secara atomik menulis `task_events`, audit log `tasks.acknowledge`, dan acknowledgement notification terkait task, lalu mempublikasikan `task.status_changed`.

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

Evidence acknowledgement dan audit disimpan atomik di `procedure_acknowledgements` dengan timestamp `readAt`, `understoodAt`, dan `criticalConfirmedAt` bila relevan. Event `sop.acknowledged` dipublikasikan untuk monitoring Supervisor.

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

Submit handover dan audit log `handovers.submit` disimpan dalam satu transaksi. Handover submitted membuat notification untuk assignment shift berikutnya yang relevan serta event `handover.submitted`. Hanya inspector shift berikutnya yang sesuai area/target shift yang dapat acknowledge; pembuat tidak dapat acknowledge handover sendiri.

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

Issue High dan Critical membuat notification record `issue_alert` untuk Supervisor aktif. Semua issue membuat event `issue.created`. Create/comment issue menyimpan `issue_events` dan audit log secara atomik.

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

`POST /api/offline-drafts/sync` memvalidasi payload berdasarkan tipe dan melakukan sinkronisasi aktual:

- `handover` membuat handover beserta item;
- `issue` membuat issue report;
- `task_note` membuat task progress event.

Sync bersifat idempotent berdasarkan `localDraftId`. Draft yang berhasil berubah menjadi `synced` dan menyimpan `syncedEntityType`/`syncedEntityId`. Conflict mendukung pilihan `keep_local`, `use_server`, dan `merge_manually`; error per draft dikembalikan secara actionable tanpa membocorkan error internal.

`POST /api/offline-drafts` juga mendeteksi stale update memakai `clientUpdatedAt`.

## Realtime Polling

- `GET /api/realtime-events`

Inspector hanya dapat membaca channel `user:{ownUserId}`, `role:inspector`, dan area dari assignment miliknya. Query mendukung `channel`, `type`, `since`, `page`, dan `limit`. Permintaan channel user lain ditolak.

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
- `tasks.progress_note`
- `notifications.read`
- `notifications.acknowledge`
- `inspector_settings.update`
