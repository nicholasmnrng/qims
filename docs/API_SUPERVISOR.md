# QIMS Supervisor / Leader API

Tahap 3 menambahkan backend operasional harian untuk Supervisor / Leader. Semua endpoint membutuhkan session valid dan permission server-side sesuai modul.

## Shift Assignments

- `GET /api/shift-assignments`
- `POST /api/shift-assignments`
- `GET /api/shift-assignments/:id`
- `PATCH /api/shift-assignments/:id`
- `POST /api/shift-assignments/publish`
- `POST /api/shift-assignments/duplicate`

Permission: `schedule:manage`.

List mendukung `page`, `limit`, `areaId`, `shiftId`, `userId`, `workDate`, `dateFrom`, `dateTo`, `status`, dan `skillLevel`. Setiap item menyertakan level skill inspector pada area assignment.

Write assignment wajib menyertakan `changeReason` atau `reason`. Create/update mengembalikan `conflicts` untuk:

- `not_inspector`
- `inspector_inactive`
- `double_assignment`
- `area_without_inspector`
- `skill_mismatch`

Create, update, duplicate, dan publish schedule menyimpan perubahan serta audit log secara atomik. Semua perubahan mempublikasikan event `schedule.updated` ke channel user, area, dan role Supervisor; publish juga membuat notification `schedule_update`.

## Tasks and Priority

- `GET /api/tasks`
- `POST /api/tasks`
- `GET /api/tasks/:id`
- `PATCH /api/tasks/:id`
- `PATCH /api/tasks/:id/status`
- `PATCH /api/tasks/:id/priority`

Permission: `tasks:manage`.

List mendukung `page`, `limit`, `q`, `areaId`, `assignedUserId`, `status`, dan `priority`.

Semua write wajib memiliki `reason`. Perubahan task menyimpan task, `task_events`, dan audit log secara atomik. Priority/status change mempublikasikan `task.priority_changed` atau `task.status_changed`; perubahan assignment/priority juga membuat notification untuk inspector terkait.

## SOP and Procedure Versions

- `GET /api/procedures`
- `POST /api/procedures`
- `GET /api/procedures/:id`
- `POST /api/procedures/:id/versions`
- `POST /api/procedure-versions/:id/publish`

Permission: `sop:manage`.

SOP mendukung status `draft`, `in_review`, `published`, dan `archived`. Version target mendukung `all_inspectors`, `area`, `shift`, dan `skill_level`.

Create version menyimpan version, target, dan audit secara atomik. Publish version memakai transaksi untuk mengubah procedure menjadi `published` dan mencatat audit, lalu membuat notification `new_sop` serta event `sop.published`.

## Skill Matrix

- `GET /api/skill-matrix`
- `POST /api/skill-matrix`
- `GET /api/inspectors/:id/skills`

Permission: `skill-matrix:manage`.

List mendukung `page`, `limit`, `areaId`, `userId`, dan `level`. Response list menyertakan `gaps` untuk skill yang belum memenuhi `minimumSkillLevel` area.

Upsert skill wajib memiliki `reason`; perubahan dan audit log `skill_matrix.upsert` disimpan dalam satu transaksi.

## Handovers

- `GET /api/handovers`
- `GET /api/handovers/:id`

Permission: `handover:manage`.

List mendukung `page`, `limit`, `areaId`, `status`, `dateFrom`, dan `dateTo`. Tahap 3 menyediakan monitoring Supervisor; create/acknowledge handover adalah aksi Inspector.

## Issues

- `GET /api/issues`
- `GET /api/issues/:id`
- `PATCH /api/issues/:id/status`

Permission: `issues:manage`.

List mendukung `page`, `limit`, `areaId`, `shiftAssignmentId`, `severity`, `status`, `dateFrom`, dan `dateTo`. Status update wajib memiliki `reason`; issue, `issue_events`, dan audit disimpan atomik, lalu notification `issue_alert` dan event `issue.status_changed` dikirim.

Create issue dari mobile adalah aksi Inspector di Tahap 4.

## Notification Records

- `GET /api/notifications`

Permission: `notifications:read`.

List mendukung `page`, `limit`, `type`, `priority`, `recipientUserId`, `deliveryStatus`, `readStatus`, dan `acknowledgementStatus`. Response menyertakan penerima beserta ringkasan delivered, failed, read, dan acknowledged. Mark read/acknowledge tetap merupakan aksi penerima.

## Realtime Event Contract

PostgreSQL menyimpan notification dan operational record sebagai source of truth. Local/dev realtime event log hanya menjadi delivery signal dan polling fallback.

```json
{
  "eventId": "notification.id",
  "type": "priority_change",
  "priority": "critical",
  "entityType": "tasks",
  "entityId": "task-id",
  "title": "Prioritas task berubah",
  "message": "Task A sekarang critical.",
  "createdAt": "2026-06-07T00:00:00.000Z"
}
```

Event penting Tahap 3:

- `schedule_update`
- `assignment_change`
- `priority_change`
- `new_sop`
- `issue_alert`

## Audit Coverage

Tahap 3 write actions menghasilkan audit log:

- `shift_assignments.create`
- `shift_assignments.update`
- `shift_assignments.publish`
- `shift_assignments.duplicate`
- `tasks.create`
- `tasks.update`
- `tasks.status_update`
- `tasks.priority_update`
- `procedures.create`
- `procedure_versions.create`
- `procedure_versions.publish`
- `skill_matrix.upsert`
- `issues.status_update`
