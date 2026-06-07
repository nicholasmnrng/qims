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

List mendukung `page`, `limit`, `areaId`, `shiftId`, `userId`, `workDate`, dan `status`.

Write assignment wajib menyertakan `changeReason` atau `reason`. Create/update mengembalikan `conflicts` untuk:

- `not_inspector`
- `inspector_inactive`
- `double_assignment`
- `area_without_inspector`
- `skill_mismatch`

Publish schedule memakai transaksi, membuat notification `schedule_update`, dan menulis audit log `shift_assignments.publish`.

## Tasks and Priority

- `GET /api/tasks`
- `POST /api/tasks`
- `GET /api/tasks/:id`
- `PATCH /api/tasks/:id`
- `PATCH /api/tasks/:id/status`
- `PATCH /api/tasks/:id/priority`

Permission: `tasks:manage`.

List mendukung `page`, `limit`, `q`, `areaId`, `assignedUserId`, `status`, dan `priority`.

Semua write wajib memiliki `reason`. Priority change memakai transaksi untuk update task dan insert `task_events`, membuat notification `priority_change` ke inspector terkait, dan menulis audit log `tasks.priority_update`.

## SOP and Procedure Versions

- `GET /api/procedures`
- `POST /api/procedures`
- `GET /api/procedures/:id`
- `POST /api/procedures/:id/versions`
- `POST /api/procedure-versions/:id/publish`

Permission: `sop:manage`.

SOP mendukung status `draft`, `in_review`, `published`, dan `archived`. Version target mendukung `all_inspectors`, `area`, `shift`, dan `skill_level`.

Publish version memakai transaksi, mengubah procedure menjadi `published`, membuat notification `new_sop`, dan mencatat audit log `procedure_versions.publish`.

## Skill Matrix

- `GET /api/skill-matrix`
- `POST /api/skill-matrix`
- `GET /api/inspectors/:id/skills`

Permission: `skill-matrix:manage`.

List mendukung `page`, `limit`, `areaId`, `userId`, dan `level`. Response list menyertakan `gaps` untuk skill yang belum memenuhi `minimumSkillLevel` area.

Upsert skill wajib memiliki `reason` dan menulis audit log `skill_matrix.upsert`.

## Handovers

- `GET /api/handovers`
- `GET /api/handovers/:id`

Permission: `handover:manage`.

List mendukung `page`, `limit`, `areaId`, dan `status`. Tahap 3 menyediakan monitoring Supervisor; create/acknowledge handover adalah aksi Inspector di Tahap 4.

## Issues

- `GET /api/issues`
- `GET /api/issues/:id`
- `PATCH /api/issues/:id/status`

Permission: `issues:manage`.

List mendukung `page`, `limit`, `areaId`, `severity`, dan `status`. Status update wajib memiliki `reason`, membuat `issue_events`, membuat notification `issue_alert` untuk reporter/assignee bila ada, dan menulis audit log `issues.status_update`.

Create issue dari mobile adalah aksi Inspector di Tahap 4.

## Notification Records

- `GET /api/notifications`

Permission: `notifications:read`.

List mendukung `page`, `limit`, `type`, dan `priority`. Mark read dan acknowledge notification diselesaikan di Tahap 4 karena status tersebut milik penerima/Inspector.

## Realtime Event Contract

Tahap 3 menyimpan notification record sebagai source of truth. Realtime/push worker pada tahap berikutnya dapat mengirim payload dari record ini.

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
