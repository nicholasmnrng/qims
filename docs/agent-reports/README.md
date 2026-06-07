# Agent Reports

Folder ini menyimpan laporan detail agent jika pekerjaan terlalu panjang untuk dicatat hanya di `docs/WORK_LOG.md`.

## When To Create A Report

Buat laporan detail jika:

- Satu task mengubah banyak file.
- Ada keputusan teknis penting.
- Ada gap terhadap PRD.
- Ada test failure atau risiko implementasi.
- User meminta detail pekerjaan per agent.

## File Naming

Gunakan format:

```txt
YYYY-MM-DD-tahap-role-task.md
```

Contoh:

```txt
2026-06-07-backend-foundation-auth-rbac.md
```

## Required Report Structure

```md
# Report Title

## Context
- PRD sections:
- Agent skill:
- Task:

## Work Completed
- 

## Files Changed
- 

## Tests and Checks
- 

## PRD Validation
- Requirements satisfied:
- Requirements not yet satisfied:
- Deviations:
- Assumptions:

## Risks and Next Step
- 
```

## Rule

Laporan detail tidak menggantikan `docs/WORK_LOG.md`. Agent tetap wajib menambah ringkasan ke `docs/WORK_LOG.md`.
