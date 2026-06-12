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

Dashboard menerima filter `dateFrom`, `dateTo`, `shiftId`, `areaId`, `inspectorId`, `severity`, dan `priority`. Tanpa date range, data default memakai hari ini. Response mengembalikan filter efektif.

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
- `shiftId`

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

Filters:

- `page`
- `limit`
- `dateFrom`
- `dateTo`
- `shiftId`
- `areaId`
- `inspectorId`
- `status` (`acknowledged` atau `pending`)

Filter area/shift/inspector membatasi cohort penerima yang dihitung dalam compliance.

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
- `shiftId`

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

Direct export dibatasi maksimal 100 baris. Jika hasil lebih besar, endpoint mengembalikan conflict yang mengarahkan client memakai async export:

- `POST /api/reports/export-jobs`
- `GET /api/reports/export-jobs/:id`
- `GET /api/reports/export-jobs/:id/download`

Local async export mengumpulkan pagination hingga 5000 baris. Dataset lebih besar membutuhkan production worker. Job status/download hanya dapat dibaca pembuat job yang masih memiliki `reports:export`, atau Super Admin.

## Audit Coverage

Export mencatat audit log:

- `reports.export`

Read-only dashboard/report endpoint tidak mengubah data operasional.

QA Manager tetap tidak memiliki operational write permission. Ketentuan role section 4 menjadikan QA Manager reporting/export read-only; SOP authoring tidak diaktifkan pada role ini karena PRD section 7.6 bertentangan dengan role definition dan belum mendapat keputusan perubahan permission.
