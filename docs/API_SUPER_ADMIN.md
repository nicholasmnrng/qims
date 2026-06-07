# QIMS Super Admin API

Tahap 2 menambahkan endpoint backend untuk Super Admin. Semua endpoint di dokumen ini membutuhkan session valid dengan role Super Admin dan server-side permission check.

## Users

- `GET /api/users`
- `POST /api/users`
- `GET /api/users/:id`
- `PATCH /api/users/:id`

List users mendukung `page`, `limit`, `q`, `role`, dan `status`.

Write user wajib menyertakan `reason`. Perubahan role/status menulis audit log `users.role_status_change`.

## Roles and Permissions

- `GET /api/roles`
- `GET /api/permissions`
- `PATCH /api/roles/:id/permissions`

Role management Tahap 2 mengelola mapping permission untuk role system yang sudah diseed. Update permission wajib menyertakan `reason` dan menulis audit log `roles.permissions_update`.

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
- `action`
- `entityType`
- `entityId`

Audit log bersifat append-only dan tidak memiliki endpoint update/delete.

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
