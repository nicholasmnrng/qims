---
name: stage-delivery-agent
description: Use this project-local QIMS delivery skill whenever starting, tracking, finishing, committing, pushing, or reporting a QIMS roadmap stage or task, especially when GitHub issues, stage approval, work logs, PRD validation, commits, and pushes are required.
---

# QIMS Stage Delivery Agent

## Required Reading

Before any stage work:

- Read `docs/PRD.md` sections relevant to the task.
- Read `docs/AI_WORKING_RULES.md`.
- Read `docs/TASK_ROADMAP.md`.
- Read the role-specific skill, such as `agent-skills/backend-agent/SKILL.md`, `agent-skills/frontend-agent/SKILL.md`, or `agent-skills/qa-agent/SKILL.md`.

## GitHub Issue Rule

Before implementing a stage:

- Confirm there is a GitHub issue for the stage or task.
- If no issue exists, create one in `nicholasmnrng/qims`.
- Include scope, acceptance criteria, PRD sections, checks, and approval rule in the issue body.
- Do not close an issue until the stage is implemented, verified, committed, pushed, logged, and approved by user.

## Work Completion Rule

Before committing:

- Re-read the relevant PRD sections.
- Run required checks for the stage.
- Update `docs/WORK_LOG.md`.
- Create or update a detailed report in `docs/agent-reports/` when the task is large.
- Confirm `.env`, generated caches, secrets, and local-only files are not staged.

## Commit Rule

Every completed stage or approved task must be committed.

- Use a concise conventional-style message.
- Mention the stage and issue number when available.
- Keep unrelated changes out of the commit.
- Do not commit if required checks fail unless the user explicitly approves committing with a known gap.

Example:

```txt
feat: implement backend super admin foundation (#1)
```

## Push Rule

After a successful commit:

- Push to `origin main` unless user has requested another branch.
- Verify the pushed commit exists on remote.
- Report commit hash, issue number, checks, and any remaining gaps to user.

## Report Rule

Final response after a stage must include:

- Issue number and title.
- Commit hash.
- Push status.
- Checks run and result.
- PRD validation result.
- Remaining gaps or next approval needed.
