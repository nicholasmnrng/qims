# QIMS Auditor / Viewer API

Tahap 6 menambahkan dan menegaskan endpoint backend read-only untuk Auditor / Viewer. Semua endpoint membutuhkan session valid dan permission server-side.

## Permissions

- Read reports: `reports:read`
- Read audit trail: `audit:read`
- Read SOP acknowledgement evidence: `audit:read`

Auditor tidak mendapat permission write atau export seperti `tasks:manage`, `issues:manage`, `schedule:manage`, `sop:manage`, `tasks:update-own`, `issues:create-own`, `handover:create-own`, atau `reports:export`.

## Read-Only Reports

Auditor memakai endpoint report yang sama dengan QA Manager, tetapi hanya untuk read:

- `GET /api/reports/dashboard-summary`
- `GET /api/reports/shift-completion`
- `GET /api/reports/task-completion`
- `GET /api/reports/sop-compliance`
- `GET /api/reports/skill-gap`
- `GET /api/reports/issues`

`POST /api/reports/export` tetap ditolak untuk Auditor karena membutuhkan `reports:export`.

## Audit Trail

- `GET /api/audit-logs`

Filters:

- `page`
- `limit`
- `actorId`
- `actor` (name, email, atau employee ID)
- `action`
- `entityType`
- `entityId`
- `dateFrom`
- `dateTo`

Endpoint ini sekarang memakai permission `audit:read`, sehingga Super Admin, QA Manager, dan Auditor yang memiliki permission tersebut dapat membaca audit trail. Tidak ada route write untuk audit log.

## SOP Acknowledgement Evidence

- `GET /api/procedure-acknowledgements`

Filters:

- `page`
- `limit`
- `procedureId`
- `procedureVersionId`
- `q` (judul SOP)
- `category`
- `isCritical`
- `userId`
- `status`: `pending`, `read`, `understood`, `critical_confirmed`
- `dateFrom`
- `dateTo`

Response berisi target SOP per user, status acknowledgement, timestamp acknowledgement jika sudah ada, data SOP, data version, dan data user. Target yang belum acknowledge tetap muncul sebagai `pending`.

Rentang tanggal mengacu pada timestamp acknowledgement terakhir (`criticalConfirmedAt`, `understoodAt`, lalu `readAt`) dan rentang terbalik ditolak.

## Read-Only Guardrails

Tahap 6 tidak menambahkan endpoint write untuk Auditor. Negative RBAC test memastikan Auditor tidak memiliki permission:

- report export
- schedule management
- task management
- own task update
- SOP management
- issue management
- own issue create
- own handover create

Route-level QA juga memastikan Auditor ditolak pada:

- direct dan async report export
- task, schedule, SOP, issue, dan master-data write
- role/permission dan system-setting update
- worker/notification dispatch
- signed upload request

Semua denial mengembalikan error `FORBIDDEN` yang actionable.
