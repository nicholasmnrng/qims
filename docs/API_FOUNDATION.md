# QIMS Backend Foundation API

Dokumen ini hanya mencakup endpoint foundation Tahap 1. Endpoint role spesifik akan ditambahkan setelah tahap terkait disetujui.

## Auth

### POST `/api/auth/login`

Login email/password melalui Better Auth.

Body:

```json
{
  "email": "user@example.com",
  "password": "minimum-8-character"
}
```

Audit:

- Success: `auth.login`
- Failure from Better Auth: `auth.failed_login`

### POST `/api/auth/logout`

Logout session aktif melalui Better Auth.

Audit:

- Success: `auth.logout`

### GET `/api/auth/session`

Mengembalikan session aktif jika ada.

### Better Auth Native Routes

Better Auth juga dimount di:

```txt
/api/auth/[...all]
```

Ini diperlukan untuk kompatibilitas client Better Auth dan endpoint internal library.

## Current User

### GET `/api/me`

Mengembalikan user session aktif dan permission hasil RBAC server-side.

Requires:

- Session valid.
- User status `active`.

## Health

### GET `/api/health`

Mengembalikan status dasar API.

```json
{
  "ok": true,
  "data": {
    "service": "qims-api",
    "status": "ok"
  }
}
```

## Error Shape

Custom QIMS route handler memakai bentuk error:

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Input tidak valid.",
    "details": {}
  }
}
```
