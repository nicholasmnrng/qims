# QIMS QA Manager API

Tahap 5 menambahkan endpoint backend read-only untuk QA Manager. Semua endpoint membutuhkan session valid dan permission server-side.

## Permissions

- Read dashboard/report: `reports:read`
- Export report: `reports:export`

QA Manager tidak mendapat permission operational write seperti `tasks:manage`, `issues:manage`, `schedule:manage`, atau `sop:manage`.

## Dashboard Summary

- `GET /api/reports/dashboard-summary`

Ringkasan untuk dashboard QA Manager:

- active inspectors today
- open critical tasks
- area coverage
- SOP unread count
- pending handovers
- issue severity summary
- task completion summary
- recent priority change timeline

Default tanggal memakai `Asia/Makassar`.

## Shift Completion

- `GET /api/reports/shift-completion`

Filters:

- `page`
- `limit`
- `dateFrom`
- `dateTo`
- `shiftId`
- `areaId`
- `inspectorId`
- `status`

Response berisi assignment, inspector, area, shift, dan metrics task completion per assignment.

## Task Completion

- `GET /api/reports/task-completion`

Filters:

- `page`
- `limit`
- `dateFrom`
- `dateTo`
- `areaId`
- `inspectorId`
- `status`
- `priority`

Response menyertakan summary:

- total task
- completed task
- completion rate
- by status
- by priority

## SOP Compliance

- `GET /api/reports/sop-compliance`

Response per SOP version:

- target count
- acknowledged count
- pending count
- compliance rate

Target mengikuti SOP target record dari Tahap 3.

## Skill Gap

- `GET /api/reports/skill-gap`

Filters:

- `page`
- `limit`
- `areaId`
- `inspectorId`

Response berisi inspector-area skill yang berada di bawah `minimumSkillLevel`, plus summary coverage area.

## Issues

- `GET /api/reports/issues`

Filters:

- `page`
- `limit`
- `dateFrom`
- `dateTo`
- `areaId`
- `inspectorId`
- `status`
- `severity`

Response menyertakan issue list dan summary:

- by severity
- by status
- trend by date

## Export Small Report

- `POST /api/reports/export`

Body:

```json
{
  "reportType": "task-completion",
  "format": "csv",
  "filters": {
    "dateFrom": "2026-06-01",
    "dateTo": "2026-06-08"
  },
  "reason": "Weekly QA review"
}
```

Supported `reportType`:

- `shift-completion`
- `task-completion`
- `sop-compliance`
- `skill-gap`
- `issues`

Supported `format`:

- `csv`
- `json`

Export Tahap 5 dibatasi untuk data kecil dan mengembalikan content langsung di response. Export besar/async masuk Tahap Backend Hardening.

## Audit Coverage

Export mencatat audit log:

- `reports.export`

Read-only dashboard/report endpoint tidak mengubah data operasional.
