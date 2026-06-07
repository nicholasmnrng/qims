# QIMS Backend API Reference

Dokumen ini menjadi index API backend setelah Tahap 7. Frontend web dan mobile harus memakai endpoint yang sudah tercatat di dokumen role berikut:

- Foundation/auth: `docs/API_FOUNDATION.md`
- Super Admin: `docs/API_SUPER_ADMIN.md`
- Supervisor / Leader: `docs/API_SUPERVISOR.md`
- Inspector mobile: `docs/API_INSPECTOR.md`
- QA Manager: `docs/API_QA_MANAGER.md`
- Auditor / Viewer: `docs/API_AUDITOR.md`
- Backend hardening contracts: `docs/BACKEND_HARDENING.md`

## Global Rules

- Semua endpoint selain login membutuhkan session valid, kecuali native Better Auth route yang dipakai library auth.
- Permission selalu dicek server-side.
- List besar wajib memakai pagination dengan `page` dan `limit`; limit maksimum 100.
- Semua body write divalidasi dengan schema.
- Error custom QIMS memakai shape:

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

## Rate Limited Endpoints

- `POST /api/auth/login`: 5 request per menit per IP dan email.
- `POST /api/auth/[...all]`: 30 request per menit per IP.
- `POST /api/reports/export`: 10 request per menit per IP.
- `PATCH /api/roles/:id/permissions`: 20 request per 5 menit per IP.
- `PATCH /api/system-settings`: 20 request per 5 menit per IP.

Rate limit Tahap 7 memakai in-memory bucket untuk development/MVP backend contract. Production deployment harus memindahkan backing store ke Redis atau managed rate-limit service seperti yang direncanakan PRD architecture.

## Frontend Consumption Notes

- Web dashboard dapat mulai dari role API docs sesuai permission user.
- Mobile Inspector harus memakai endpoint lightweight `GET /api/inspector/today-mission` untuk home screen.
- Upload file belum memiliki signed URL route pada MVP backend; frontend harus menunggu tahap storage implementation sebelum mengirim file besar.
- Realtime dan notification worker contract sudah typed, tetapi transport/worker runtime aktual masuk tahap hardening lanjutan atau deployment integration.
