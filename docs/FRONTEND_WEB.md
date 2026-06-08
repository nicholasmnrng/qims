# Cladtek Quality Inspector Frontend Web

Tahap 8 menambahkan web dashboard di Next.js App Router dan post Tahap 10 gap pass memperluasnya menjadi action-oriented dashboard untuk Cladtek Quality Inspector role:

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

Branding:

- App display name: `Cladtek Quality Inspector`
- Logo asset: `apps/web/public/brand/cladtek-logo.svg`
- Browser title/icon are configured in `apps/web/src/app/layout.tsx`

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
- `POST /api/users`
- `PATCH /api/users/:id`
- `GET /api/roles`
- `GET /api/permissions`
- `PATCH /api/roles/:id/permissions`
- `GET /api/sites`
- `POST /api/sites`
- `PATCH /api/sites/:id`
- `GET /api/departments`
- `POST /api/departments`
- `PATCH /api/departments/:id`
- `GET /api/areas`
- `POST /api/areas`
- `PATCH /api/areas/:id`
- `GET /api/shifts`
- `POST /api/shifts`
- `PATCH /api/shifts/:id`
- `GET /api/system-settings`
- `PATCH /api/system-settings`

Implemented:

- user list/search/filter/pagination
- create user
- update role/status/profile fields
- reason field for important changes
- role permission update with confirmation
- site/department/area/shift create/edit/status form
- system setting JSON edit with reason
- audit log filter/detail summary

### Command

Memakai:

- `GET /api/shift-assignments`
- `POST /api/shift-assignments`
- `PATCH /api/shift-assignments/:id`
- `POST /api/shift-assignments/duplicate`
- `POST /api/shift-assignments/publish`
- `GET /api/tasks`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`
- `PATCH /api/tasks/:id/priority`
- `GET /api/issues`
- `PATCH /api/issues/:id/status`
- `GET /api/handovers`
- `GET /api/notifications`
- `GET /api/procedures`
- `POST /api/procedures`
- `POST /api/procedures/:id/versions`
- `POST /api/procedure-versions/:id/publish`
- `GET /api/skill-matrix`
- `POST /api/skill-matrix`
- `GET /api/realtime-events`

Implemented:

- command center metrics
- assignment create/edit/duplicate/publish form
- conflict warnings from backend response
- task create/edit/status/priority form
- critical priority confirmation and reason field
- SOP create, version, publish action
- skill matrix upsert and skill gap table
- handover and issue monitoring tables
- notification list and local realtime event feed

### Reports

Memakai:

- `GET /api/reports/dashboard-summary`
- `GET /api/reports/task-completion`
- `GET /api/reports/sop-compliance`
- `GET /api/reports/issues`
- `GET /api/reports/shift-completion`
- `GET /api/reports/skill-gap`
- `POST /api/reports/export`

Implemented:

- report filters for date/shift/area/inspector/status/severity where supported
- compact visual summary bars
- CSV/JSON export UI with reason field
- read-only guard for roles without export permission

### Audit

Memakai:

- `GET /api/audit-logs`
- `GET /api/procedure-acknowledgements`

Audit view menyediakan filter ringan untuk audit action dan SOP acknowledgement status.

## UI States

Implemented:

- loading skeleton
- empty state per panel
- error state dengan pesan actionable
- permission state bila role membuka view tanpa akses
- responsive layout desktop/tablet/mobile
- Eco-mode toggle lokal
- toast success/error/warning/info/loading pattern
- confirmation modal for important actions
- status/priority/notification badges
- API error details surfaced in forms

## Browser QA

Repeatable browser smoke:

```bash
QIMS_WEB_URL=http://127.0.0.1:3003 npm run qa:web-browser
```

Coverage:

- login Super Admin, Supervisor, QA Manager, Auditor
- dashboard render
- no major console errors
- mobile viewport has no horizontal overflow

## Known Limits

- Drag-and-drop priority board is not implemented; current priority board uses compact action forms and backend-backed refresh.
- Browser QA is automated with Playwright smoke, but stakeholder manual UX review is still needed before Final MVP approval.
