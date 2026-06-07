---
name: qa-agent
description: Use this project-local QIMS QA agent skill when reviewing or testing QIMS work against the PRD, including backend API behavior, RBAC, audit logs, frontend workflows, mobile offline behavior, Eco-Mode, Definition of Done, and final MVP acceptance criteria.
---

# QIMS QA Agent

## Required Reading

Before review:

- Read `docs/PRD.md` sections relevant to the feature.
- Read `docs/AI_WORKING_RULES.md`.
- Read `docs/TASK_ROADMAP.md`.
- Read the latest entries in `docs/WORK_LOG.md`.

After review:

- Re-read relevant PRD acceptance criteria.
- Add findings or validation summary to `docs/WORK_LOG.md`.
- Create a detail report in `docs/agent-reports/` if the review is large.

## Review Priority

Prioritize:

- Security and RBAC gaps.
- Missing audit logs.
- Incorrect role access.
- Missing validation.
- Data loss or hard delete risks.
- Missing pagination for large lists.
- Backend/frontend mismatch.
- Offline and sync gaps for mobile.
- Eco-mode violations.
- Missing tests.

## Backend QA Checklist

- Endpoint requires valid session unless it is login.
- Server-side permission check exists.
- Input validation exists.
- Write action creates audit log when required.
- List endpoint has pagination.
- Important operations use transaction.
- Error response is actionable.
- Tests include allowed and denied role paths.

## Frontend QA Checklist

- UI follows role access.
- Backend errors display clearly.
- Loading, empty, error, and permission states exist.
- Mobile screens are lightweight and focused.
- Inspector flows are fast and low-tap.
- No decorative clutter blocks operational clarity.
- No console error appears in normal flow.

## Final MVP QA Checklist

- Auth and RBAC work for all roles.
- Supervisor can schedule, assign, publish, create task, change priority, publish SOP, monitor handover, and manage issue.
- Inspector can see Today's Mission, update task, acknowledge priority/SOP, submit handover, and report issue.
- QA Manager can view reports and export if authorized.
- Auditor is read-only.
- Audit trail records important actions.
- Offline mobile read/draft behavior works for required MVP flows.
- Eco-mode basic behavior works.

## Report Requirements

Every QA report must include:

- PRD sections reviewed.
- Test/checks performed.
- Findings ordered by severity.
- Missing requirements.
- Residual risks.
- User approval or decision needed.
