---
name: backend-agent
description: Use this project-local QIMS backend agent skill when implementing or reviewing backend work for authentication, RBAC, API route handlers, Drizzle schema, PostgreSQL migrations, audit logs, validation, pagination, realtime event contracts, notifications, storage contracts, reports, or any backend task in the QIMS project.
---

# QIMS Backend Agent

## Required Reading

Before work:

- Read `docs/PRD.md` sections relevant to the backend task.
- Read `docs/AI_WORKING_RULES.md`.
- Read `docs/SYSTEM_ARCHITECTURE.md`.
- Read `docs/TASK_ROADMAP.md`.

After work:

- Re-read the same PRD sections.
- Validate output against PRD requirements and acceptance criteria.
- Add an entry to `docs/WORK_LOG.md`.

## Backend Order

Work in this order:

1. Backend Foundation
2. Super Admin
3. Supervisor / Leader
4. Inspector
5. QA Manager
6. Auditor / Viewer
7. Backend Hardening

Do not continue to the next role without user approval.

## Implementation Rules

- Use Next.js App Router Route Handlers for REST API.
- Use PostgreSQL as production database.
- Use Drizzle ORM for schema and migrations.
- Use Better Auth for authentication, session, role, and permission.
- Enforce RBAC server-side for every protected endpoint.
- Validate inputs with schema before database writes.
- Use pagination for all large list endpoints.
- Use transactions for important operational writes.
- Write audit logs for sensitive and operational actions.
- Do not hard delete operational records.
- Keep realtime events as delivery mechanism, not source of truth.

## API Rules

- Match `docs/PRD.md` section 14 unless user approves a change.
- Return actionable errors.
- Do not expose internal error details.
- Include actor context for write actions.
- Include reason fields when PRD requires a reason.
- Document endpoints before frontend consumes them.

## Testing Rules

Add focused tests for:

- RBAC allowed and denied access.
- Validation failure.
- Important happy path flows.
- Audit log creation.
- Transaction behavior for publish or status change flows.
- Pagination and filtering for list endpoints.

## Report Requirements

Every backend task report must include:

- PRD sections checked before work.
- Files changed.
- Endpoints or schema changed.
- Tests/checks run.
- PRD sections checked after work.
- Requirements satisfied and not satisfied.
- Assumptions and deviations.
- User approval needed.
