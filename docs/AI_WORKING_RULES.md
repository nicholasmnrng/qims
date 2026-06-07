# QIMS AI Working Rules

## Source of Truth

`docs/PRD.md` adalah sumber kebenaran utama. Jika dokumen lain berbeda dengan PRD, agent wajib mengikuti PRD atau meminta approval user sebelum mengubah arah.

## Mandatory PRD Reading

Sebelum bekerja, agent wajib:

- Membaca `docs/PRD.md`, minimal section yang relevan dengan task.
- Membaca skill yang relevan di `agent-skills/`.
- Mencatat section PRD yang dipakai sebagai dasar kerja.
- Membandingkan task dengan `docs/TASK_ROADMAP.md`.
- Meminta klarifikasi jika task bertentangan dengan PRD.

Sesudah bekerja, agent wajib:

- Membaca ulang section PRD yang relevan.
- Membandingkan hasil kerja dengan functional requirements, acceptance criteria, security, performance, offline/eco-mode jika relevan, dan Definition of Done.
- Menulis validasi di `docs/WORK_LOG.md`.
- Membuat laporan detail di `docs/agent-reports/` jika pekerjaan panjang.
- Menyebutkan gap, risiko, asumsi, dan approval yang dibutuhkan.

## Anti-Hallucination Rules

Agent tidak boleh:

- Menambah requirement baru tanpa approval user.
- Menambah endpoint, field, table, business rule, workflow, atau UI flow yang tidak berasal dari PRD tanpa menandainya sebagai asumsi.
- Mengubah urutan backend-first menjadi frontend-first.
- Menggabungkan banyak role sekaligus tanpa approval.
- Melanjutkan tahap berikutnya tanpa laporan dan approval user.
- Menghapus atau mengubah PRD canonical tanpa instruksi eksplisit.

Agent wajib:

- Mengutip section PRD yang relevan di laporan.
- Menyebutkan jika ada kebutuhan yang belum terpenuhi.
- Menyebutkan jika test tidak dijalankan.
- Menjaga scope tetap kecil dan selesai per tahap.

## Work Order

Urutan wajib:

1. Dokumentasi dan agent skill.
2. Backend foundation.
3. Backend role Super Admin.
4. Backend role Supervisor / Leader.
5. Backend role Inspector.
6. Backend role QA Manager.
7. Backend role Auditor / Viewer.
8. Backend hardening.
9. Frontend web.
10. Mobile app inspector.
11. Final MVP QA.

## Backend Definition of Done

Satu backend task dianggap selesai jika:

- API selesai sesuai PRD.
- Input validation tersedia.
- Server-side permission check tersedia.
- Audit log tersedia untuk action penting.
- Pagination tersedia untuk list besar.
- Error response jelas dan tidak expose internal error.
- Unit/integration test minimal untuk logic utama tersedia.
- Endpoint terdokumentasi jika sudah siap dipakai frontend.
- PRD validation dicatat di `docs/WORK_LOG.md`.

## Frontend Definition of Done

Satu frontend task dianggap selesai jika:

- UI responsive.
- UI memakai API yang sudah disetujui.
- Permission state ditangani.
- Loading, empty, and error state tersedia.
- UX mengikuti Utility UX dan Eco-Mode.
- Tidak ada decorative clutter.
- Tidak ada console error utama.
- Manual QA dicatat.
- PRD validation dicatat di `docs/WORK_LOG.md`.

## Reporting Format

Gunakan format ini di `docs/WORK_LOG.md`:

```md
## YYYY-MM-DD - [Tahap/Role/Task]

### PRD Validation
- PRD sections checked before work:
- Agent skill used:
- Work completed:
- Files changed:
- Tests/checks run:
- PRD sections checked after work:
- Requirements satisfied:
- Requirements not yet satisfied:
- Assumptions made:
- Deviations from PRD:
- User approval needed:

### Notes
- 
```

## User Approval Rule

Agent boleh menyelesaikan task yang diminta user, tetapi tidak boleh lanjut ke tahap berikutnya sebelum user menyetujui hasil tahap berjalan.
