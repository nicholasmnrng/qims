# QIMS Super Admin API

Tahap 2 menambahkan endpoint backend untuk Super Admin. Semua endpoint di dokumen ini membutuhkan session valid dengan role Super Admin dan server-side permission check.

## Users

- `GET /api/users`
- `POST /api/users`
- `GET /api/users/:id`
- `PATCH /api/users/:id`

List users mendukung `page`, `limit`, `q`, `role`, dan `status`.

Write user wajib menyertakan `reason`. Perubahan role/status menulis audit log `users.role_status_change`.

Permission:

- Read: `users:read`.
- Create/update: `users:write`.
- Role yang hanya memiliki `users:read` dibatasi ke data Inspector; membaca role lain menghasilkan `403 FORBIDDEN`.
- Update user, profile, dan audit log dijalankan dalam satu transaksi database.

## Roles and Permissions

- `GET /api/roles`
- `GET /api/permissions`
- `PATCH /api/roles/:id/permissions`

Role management Tahap 2 mengelola mapping permission untuk role system yang sudah diseed. Update permission wajib menyertakan `reason` dan menulis audit log `roles.permissions_update`.

Runtime RBAC dan `GET /api/me` membaca mapping `role_permissions` dari database. Perubahan permission berlaku pada request berikutnya tanpa logout. Super Admin wajib mempertahankan permission inti session, user, role, master data, dan audit agar sistem tidak terkunci.

## Master Data

- `GET /api/sites`
- `POST /api/sites`
- `GET /api/sites/:id`
- `PATCH /api/sites/:id`
- `GET /api/departments`
- `POST /api/departments`
- `GET /api/departments/:id`
- `PATCH /api/departments/:id`
- `GET /api/areas`
- `POST /api/areas`
- `GET /api/areas/:id`
- `PATCH /api/areas/:id`
- `PATCH /api/areas/:id/archive`
- `GET /api/shifts`
- `POST /api/shifts`
- `GET /api/shifts/:id`
- `PATCH /api/shifts/:id`

List master data mendukung `page`, `limit`, `q`, dan `status`.

Tidak ada hard delete untuk master data. Area archive menggunakan status `archived`.

Write site, department, area, dan shift membutuhkan `master-data:manage`. Write dan audit log terkait dijalankan dalam satu transaksi.

## System Settings

- `GET /api/system-settings`
- `PATCH /api/system-settings`

`PATCH /api/system-settings` memakai body:

```json
{
  "key": "system.defaults",
  "value": {
    "timezone": "Asia/Makassar"
  },
  "reason": "Update default timezone"
}
```

## Audit Logs

- `GET /api/audit-logs`

Filter:

- `page`
- `limit`
- `actorId`
- `actor`: pencarian nama, email, atau employee ID actor
- `action`
- `entityType`
- `entityId`
- `dateFrom`: tanggal UTC inklusif, format `YYYY-MM-DD`
- `dateTo`: tanggal UTC inklusif, format `YYYY-MM-DD`

Response menyertakan konteks actor (`id`, `name`, `email`, `employeeId`) bersama setiap audit row. Audit log bersifat append-only dan tidak memiliki endpoint update/delete.

## Verification

QA khusus tahap ini:

```bash
QIMS_API_URL=http://127.0.0.1:3001 npm run qa:super-admin
```

Script memverifikasi runtime permission database, pembatasan user lintas role, pagination/filter server-side, dan audit actor/date filter. Permission yang diubah sementara dikembalikan pada blok `finally`.

## Audit Coverage

Tahap 2 write actions menghasilkan audit log:

- `users.create`
- `users.update`
- `users.role_status_change`
- `roles.permissions_update`
- `sites.create`
- `sites.update`
- `departments.create`
- `departments.update`
- `areas.create`
- `areas.update`
- `shifts.create`
- `shifts.update`
- `system_settings.upsert`
