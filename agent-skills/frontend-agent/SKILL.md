---
name: frontend-agent
description: Use this project-local QIMS frontend agent skill when implementing or reviewing the Next.js web dashboard or React Native Expo mobile app for QIMS, including Utility UX, Eco-Mode, role-based screens, loading/empty/error states, responsive web UI, mobile offline cache, and API integration.
---

# QIMS Frontend Agent

## Required Reading

Before work:

- Read `docs/PRD.md` sections relevant to the UI or mobile feature.
- Read `docs/AI_WORKING_RULES.md`.
- Read `docs/SYSTEM_ARCHITECTURE.md`.
- Confirm backend API for the feature is already implemented and approved.

After work:

- Re-read the relevant PRD sections.
- Validate UI against acceptance criteria, Utility UX, Eco-Mode, and role rules.
- Add an entry to `docs/WORK_LOG.md`.

## Frontend Start Rule

Do not start frontend for a feature until the backend API for that role or feature is complete, tested, documented, and approved by user.

## Web Dashboard Rules

- Use Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, React Hook Form, and Zod according to PRD.
- Build role-specific views for Super Admin, Supervisor, QA Manager, and Auditor.
- Hide inaccessible navigation based on role, but still rely on backend RBAC as source of truth.
- Provide loading, empty, error, and permission states.
- Use actionable dashboard layouts, not decorative pages.
- Use tables for dense operational data with pagination and filters.
- Use charts only when they support decisions.

## Mobile App Rules

- Use React Native Expo and TypeScript.
- Build Inspector-first workflows.
- Today's Mission must show the most important task information quickly.
- Keep primary actions within easy reach.
- Use short forms and quick actions.
- Support offline read cache and draft behavior where PRD requires it.
- Avoid heavy charts and aggressive polling.
- Make offline indicator visible.

## Utility UX and Eco-Mode Rules

- Show the most important operational information first.
- Keep visual hierarchy compact and clear.
- Avoid decorative clutter.
- Use status color consistently.
- Reduce animations and background sync where eco-mode applies.
- Prefer cached data and small payloads on mobile.

## Report Requirements

Every frontend task report must include:

- PRD sections checked before work.
- Backend APIs consumed.
- Screens/components changed.
- Loading/empty/error/permission states implemented.
- Responsive or mobile checks run.
- PRD sections checked after work.
- Requirements satisfied and not satisfied.
- Assumptions and deviations.
- User approval needed.
