# QIMS Project Overview

## Product Summary

Quality Inspector Operation Management System (QIMS) adalah sistem operasional untuk tim Quality Inspector di lingkungan manufaktur dan migas. Sistem ini membantu pengaturan jadwal, manpower, area inspeksi, prioritas task, SOP, handover shift, skill matrix, issue reporting, notification, audit trail, dan reporting.

PRD resmi project berada di `docs/PRD.md`. Semua keputusan teknis, urutan pekerjaan, dan validasi agent wajib mengacu ke dokumen tersebut.

## Product Principles

- Fast First Win: user langsung melihat informasi terpenting setelah login.
- Minimal Cognitive Load: tampilan dan data dibatasi sesuai kebutuhan role.
- Action-Oriented UI: layar harus mendorong aksi yang jelas.
- Real-Time When Needed: realtime hanya untuk prioritas, emergency instruction, handover, issue, dan update penting.
- Offline-Friendly: mobile tetap menampilkan data terakhir dan menyimpan draft.
- Eco-Mode by Default: hemat data, baterai, animasi, polling, dan payload.
- Audit-Ready: semua aktivitas penting tercatat otomatis.

## Roles

- Super Admin: konfigurasi sistem, company/site, role, permission, master data, audit log, integrasi.
- QA Manager: monitoring semua shift, performa inspector/area, SOP compliance, report, export.
- Supervisor / Leader: schedule, assignment, priority, task, broadcast, SOP publish, handover, skill matrix, issue approval.
- Inspector: today mission, task update, SOP acknowledgement, handover, issue report, upload foto.
- Auditor / Viewer: read-only report, audit trail, SOP acknowledgement.

## MVP Focus

Phase 1 MVP mencakup auth/RBAC, dashboard supervisor, mobile inspector home, shift assignment, task priority, notification priority change, SOP acknowledgement, handover, skill matrix basic, issue reporting basic, audit trail, master data, basic report, offline cache/draft handover, dan eco-mode basic.

Phase 2 dan Phase 3 tidak boleh dikerjakan sebelum Phase 1 MVP disetujui user.

## Work Strategy

- Tahap awal hanya dokumentasi dan agent skill.
- Backend dikerjakan lebih dulu, satu role sampai selesai.
- Frontend dimulai hanya setelah backend role terkait selesai, diuji, divalidasi ke PRD, dan disetujui user.
- Agent tidak boleh mengerjakan seluruh fitur sekaligus.
- Agent wajib melaporkan hasil kerja ke `docs/WORK_LOG.md`.

## Canonical References

- PRD: `docs/PRD.md`
- Architecture: `docs/SYSTEM_ARCHITECTURE.md`
- Roadmap: `docs/TASK_ROADMAP.md`
- AI rules: `docs/AI_WORKING_RULES.md`
- Work log: `docs/WORK_LOG.md`
- Agent reports: `docs/agent-reports/`
- Agent skills: `agent-skills/`
