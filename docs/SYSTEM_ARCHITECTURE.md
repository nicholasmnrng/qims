# QIMS System Architecture

## Canonical Source

Arsitektur ini merangkum `docs/PRD.md`, terutama section 11 sampai 18 dan Final Production Notes. Jika ada konflik, ikuti `docs/PRD.md`.

## High-Level Architecture

QIMS menggunakan monorepo dengan:

- Web dashboard: Next.js App Router untuk Supervisor, QA Manager, Super Admin, dan Auditor.
- API backend: Next.js Route Handlers sebagai REST API / BFF.
- Mobile app: React Native Expo untuk Inspector.
- Auth: Better Auth untuk session, RBAC, dan organization support.
- Database: PostgreSQL sebagai source of truth.
- ORM: Drizzle ORM untuk schema dan migration.
- Realtime: Supabase Realtime Broadcast, Ably, Pusher, atau WebSocket service sesuai infrastruktur.
- Push notification: Expo Push / FCM / APNs.
- Storage: Supabase Storage, S3-compatible storage, atau Cloudflare R2.
- Background job: notification, reminder, escalation, dan report export.
- Observability: structured logs, error tracking, metrics, dan audit trail.

## Backend Principles

- Database tetap source of truth; realtime hanya distribusi event.
- Semua endpoint selain login wajib membutuhkan session valid.
- Role dan permission wajib dicek di server.
- Semua write operation penting wajib menghasilkan audit log.
- Semua input wajib divalidasi dengan schema.
- List besar wajib pagination dan server-side filtering.
- Operasi penting seperti publish schedule, change priority, SOP publish, dan handover submit wajib memakai transaction.
- Tidak boleh hard delete data operasional penting; gunakan archive, inactive, closed, atau final status.

## Core Backend Modules

- Auth and RBAC
- Users and inspectors
- Master data: site, area, shift, department jika dibutuhkan
- Shift assignments
- Tasks and task events
- Priority update and acknowledgement
- SOP and procedure versions
- SOP acknowledgements
- Skill matrix
- Handovers and handover items
- Issue reports and issue events
- Notifications and notification recipients
- Device tokens
- Audit logs
- Reports and exports

## API Standards

- REST API mengikuti `docs/PRD.md` section 14.
- Response list wajib memakai pagination metadata.
- Error response harus jelas, actionable, dan tidak membocorkan internal error.
- Sensitive actions wajib memiliki reason jika PRD mensyaratkan reason.
- Endpoint write harus mencatat actor, timestamp, entity, before/after value jika relevan.

## Frontend Architecture

Web dashboard:

- Next.js App Router
- React + TypeScript
- Tailwind CSS
- shadcn/ui
- TanStack Query
- React Hook Form + Zod
- Recharts atau Tremor untuk chart yang memang diperlukan

Mobile app:

- React Native Expo
- TypeScript
- Expo Notifications
- AsyncStorage atau SQLite untuk local cache
- TanStack Query persistence
- React Hook Form + Zod

## Offline and Eco-Mode

Mobile wajib mendukung:

- Offline read untuk jadwal terakhir, task terakhir, SOP cached, handover terakhir, dan profile.
- Offline draft untuk handover, issue report, dan task note.
- Sync saat koneksi kembali stabil.
- Eco-mode basic untuk mengurangi animasi, kualitas gambar awal, auto-refresh, background sync, dan payload.

## Security and Compliance

- Password ditangani auth provider/library.
- Login dan endpoint sensitif perlu rate limit.
- File upload wajib divalidasi type dan size.
- Private file memakai signed URL.
- Export hanya untuk role berwenang.
- Audit log append-only dan tidak bisa diedit dari UI.
