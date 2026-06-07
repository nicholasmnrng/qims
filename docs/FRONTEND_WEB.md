# QIMS Frontend Web

Tahap 8 menambahkan baseline web dashboard di Next.js App Router untuk role:

- Super Admin
- Supervisor / Leader
- QA Manager
- Auditor / Viewer

Frontend hanya memakai API backend yang sudah selesai dan disetujui.

## Entry Point

- `GET /`

File utama:

- `apps/web/src/app/page.tsx`
- `apps/web/src/app/web-dashboard.tsx`
- `apps/web/src/app/globals.css`

## Login & Session

Login menggunakan:

- `POST /api/auth/login`
- `GET /api/me`
- `POST /api/auth/logout`

Jika session tidak valid, user melihat login panel. Jika session valid, dashboard menampilkan menu sesuai permission dari `/api/me`.

## Demo Login Accounts

Normal `npm run db:seed` tidak membuat akun demo agar tidak membuat password default tanpa sengaja.

Untuk local QA, jalankan:

```bash
npm run db:seed:demo
```

Default password:

```txt
QimsDemo123!
```

Password dapat dioverride dengan env `QIMS_DEMO_PASSWORD`.

Accounts:

| Role | Email |
| --- | --- |
| Super Admin | `superadmin@qims.local` |
| QA Manager | `qamanager@qims.local` |
| Supervisor | `supervisor@qims.local` |
| Inspector | `inspector@qims.local` |
| Auditor | `auditor@qims.local` |

## Role-Based Navigation

Menu disembunyikan berdasarkan permission:

- Dashboard: `auth:session:read`
- Admin: `users:read`, `roles:manage`, `master-data:manage`
- Command: `schedule:manage`, `tasks:manage`, `handover:manage`, `issues:manage`
- Reports: `reports:read`
- Audit: `audit:read`

Frontend tetap mengandalkan backend RBAC sebagai source of truth.

## Screens

### Dashboard

Ringkasan role-aware:

- active inspector
- critical task
- SOP unread
- notification count
- quick action ke view yang boleh diakses

### Admin

Memakai:

- `GET /api/users`
- `GET /api/roles`
- `GET /api/sites`
- `GET /api/shifts`

### Command

Memakai:

- `GET /api/shift-assignments`
- `GET /api/tasks`
- `GET /api/issues`
- `GET /api/handovers`
- `GET /api/notifications`

### Reports

Memakai:

- `GET /api/reports/dashboard-summary`
- `GET /api/reports/task-completion`
- `GET /api/reports/sop-compliance`
- `GET /api/reports/issues`

### Audit

Memakai:

- `GET /api/audit-logs`
- `GET /api/procedure-acknowledgements`

Audit view menyediakan filter ringan untuk audit action dan SOP acknowledgement status.

## UI States

Tahap 8 menyediakan:

- loading skeleton
- empty state per panel
- error state dengan pesan actionable
- permission state bila role membuka view tanpa akses
- responsive layout desktop/tablet/mobile
- Eco-mode toggle lokal

## Known Limits

- Tahap 8 baseline belum membuat form CRUD lengkap untuk semua workflow.
- Manual QA role penuh membutuhkan akun user per role di database.
- Browser screenshot tool tidak tersedia di sesi ini; verifikasi lokal dilakukan dengan build dan HTTP render check.
