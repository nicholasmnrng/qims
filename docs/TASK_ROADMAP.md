# QIMS Task Roadmap

## Working Order

Urutan kerja wajib:

1. Dokumentasi dan agent skill.
2. Backend foundation.
3. Backend per role sampai selesai.
4. Backend hardening.
5. Frontend web per role setelah backend disetujui.
6. Mobile app inspector setelah backend disetujui.
7. Final MVP QA.

Agent tidak boleh melompati tahap tanpa approval user.

Setiap tahap wajib memiliki GitHub issue sebelum dikerjakan. Setelah tahap selesai, agent wajib update work log, commit, push ke GitHub, dan melaporkan issue number serta commit hash ke user.

## Tahap 0: Dokumentasi dan Agent Skill

Output:

- `docs/PRD.md`
- `docs/PROJECT_OVERVIEW.md`
- `docs/SYSTEM_ARCHITECTURE.md`
- `docs/TASK_ROADMAP.md`
- `docs/AI_WORKING_RULES.md`
- `docs/GITHUB_ISSUES.md`
- `docs/WORK_LOG.md`
- `docs/agent-reports/README.md`
- `agent-skills/backend-agent/SKILL.md`
- `agent-skills/frontend-agent/SKILL.md`
- `agent-skills/qa-agent/SKILL.md`
- `agent-skills/stage-delivery-agent/SKILL.md`

Acceptance:

- Semua dokumen dan folder tersedia.
- `docs/PRD.md` menjadi canonical PRD.
- Agent skill terpisah dari laporan.
- Aturan baca PRD sebelum dan sesudah kerja tertulis jelas.
- Aturan GitHub issue, commit, push, dan laporan tahap tertulis jelas.
- Belum ada implementasi fitur aplikasi.

## Tahap 1: Backend Foundation

Scope:

- Monorepo.
- Next.js App Router route handlers.
- TypeScript baseline.
- PostgreSQL.
- Drizzle ORM schema dan migration.
- Better Auth.
- Session, role, permission, RBAC server-side.
- Audit log append-only.
- Zod validation.
- Pagination helper.
- Seed role awal.

Acceptance:

- Login, logout, session berjalan.
- Permission bisa dicek dari server.
- Login, logout, failed login, dan role change masuk audit log.
- Migration dan seed bisa dijalankan ulang secara aman.
- Test backend foundation lulus.

## Tahap 2: Backend Super Admin

GitHub issue: https://github.com/nicholasmnrng/qims/issues/1

Scope:

- User management.
- Role and permission management.
- Master data global.
- Audit log API dengan filter.
- System config dasar.
- Archive/inactive behavior untuk data penting.

Acceptance:

- Super Admin bisa mengelola user, role, permission, master data, dan audit log via API.
- Semua write action punya audit log.
- Endpoint terlindungi dari role lain.
- Test permission negatif tersedia.

## Tahap 3: Backend Supervisor / Leader

GitHub issue: https://github.com/nicholasmnrng/qims/issues/2

Scope:

- Shift and schedule management.
- Shift assignment conflict warning.
- Task and priority management.
- Task events.
- Realtime event contract.
- SOP management and versioning.
- Skill matrix basic.
- Handover.
- Issue management.
- Notification records.

Acceptance:

- Supervisor API menjalankan daily operation end-to-end.
- Conflict muncul untuk double assignment, inactive inspector, missing area inspector, dan skill mismatch.
- Priority change membuat task event, notification, dan audit log.
- SOP publish membuat version record dan acknowledgement target.
- Handover dan issue bisa dipantau supervisor.
- RBAC, validation, pagination, dan test tersedia.

## Tahap 4: Backend Inspector

GitHub issue: https://github.com/nicholasmnrng/qims/issues/3

Scope:

- Today's Mission API.
- Task actions.
- Priority acknowledgement.
- SOP acknowledgement.
- Handover submit.
- Issue report create.
- Notification center.
- Offline draft contract.
- Eco-mode setting.

Acceptance:

- Inspector hanya melihat data miliknya.
- Mobile home dapat dipenuhi dari endpoint ringan.
- Semua action utama punya API jelas.
- Offline draft sync punya response sukses/gagal yang actionable.
- Inspector tidak bisa mengakses API manajemen.

## Tahap 5: Backend QA Manager

GitHub issue: https://github.com/nicholasmnrng/qims/issues/4

Scope:

- Dashboard summary semua shift.
- Task completion report.
- SOP compliance report.
- Skill gap report basic.
- Issue trend report basic.
- Export report untuk data kecil.
- Read-only operational monitoring.

Acceptance:

- QA Manager bisa membaca dashboard dan report tanpa write access operasional.
- Export hanya role berwenang.
- Report list memakai pagination/filter.
- Test read-only permission tersedia.

## Tahap 6: Backend Auditor / Viewer

GitHub issue: https://github.com/nicholasmnrng/qims/issues/5

Scope:

- Read-only reports.
- Read-only audit trail.
- Read-only SOP acknowledgement.
- Block all write actions.

Acceptance:

- Auditor tidak bisa membuat atau mengubah data.
- Auditor bisa memfilter audit trail dan SOP acknowledgement.
- Test negatif untuk write endpoint utama lulus.

## Tahap 7: Backend Hardening

GitHub issue: https://github.com/nicholasmnrng/qims/issues/6

Scope:

- Review schema, index, transaction, dan query performance.
- Rate limit login dan endpoint sensitif.
- Storage contract.
- Notification worker contract.
- Realtime channel and payload.
- API documentation.
- Full backend test suite.

Acceptance:

- Backend siap dipakai frontend.
- Semua route punya auth, RBAC, validation, error handling, dan audit log sesuai kebutuhan.
- Tidak ada list besar tanpa pagination.
- Dokumentasi endpoint cukup untuk frontend.

## Tahap 8: Frontend Web

GitHub issue: https://github.com/nicholasmnrng/qims/issues/7

Scope:

- Login and session handling.
- Super Admin dashboard.
- Supervisor command center.
- QA Manager dashboard.
- Auditor viewer.
- Utility UX and Eco-Mode.
- Loading, empty, error, permission state.

Acceptance:

- Web memakai API yang sudah selesai.
- Role tidak melihat menu yang bukan haknya.
- Semua halaman responsive.
- Manual QA per role lulus.

## Tahap 9: Mobile App Inspector

GitHub issue: https://github.com/nicholasmnrng/qims/issues/8

Scope:

- Login.
- Today's Mission.
- Task list/detail/actions.
- SOP list/detail/acknowledgement.
- Handover form/detail.
- Issue report form.
- Notification center.
- Profile and Eco Mode settings.
- Offline read cache and draft handover.

Acceptance:

- Inspector melihat tugas utama maksimal 5 detik setelah app dibuka.
- Action utama maksimal 2 tap.
- Jadwal terakhir tetap tampil saat offline.
- Draft handover tersimpan lokal dan bisa sync.
- Mobile UI ringan dan low-data friendly.

## Tahap 10: Final MVP QA

GitHub issue: https://github.com/nicholasmnrng/qims/issues/9

Scope:

- E2E auth dan RBAC semua role.
- E2E supervisor operation.
- E2E inspector operation.
- E2E QA Manager reporting.
- E2E Auditor read-only.
- Audit trail review.
- Offline mobile smoke test.
- Eco-mode smoke test.

Acceptance:

- Acceptance criteria global MVP dari PRD terpenuhi.
- Tidak ada console error utama.
- Tidak ada hard delete data operasional penting.
- Final PRD validation report dibuat di `docs/agent-reports/`.
