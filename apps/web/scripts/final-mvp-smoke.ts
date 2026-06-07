type ApiEnvelope<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        details?: unknown;
      };
    };

type Session = {
  role: string;
  email: string;
  cookie: string;
  userId: string;
};

type ListResponse<T> = {
  items: T[];
  meta: {
    total: number;
  };
};

type UserListItem = {
  user: {
    id: string;
    email: string;
    role: string;
  };
};

type MasterItem = {
  id: string;
  code?: string;
  name: string;
};

type Assignment = {
  id: string;
  userId: string;
  shiftId: string;
  areaId: string;
  workDate: string;
  assignmentStatus: string;
};

type AssignmentConflict = {
  type: string;
  message: string;
};

type Task = {
  id: string;
  title: string;
  priority: string;
  status: string;
  assignedUserId: string | null;
};

type Procedure = {
  id: string;
  title: string;
};

type ProcedureVersion = {
  id: string;
  procedureId: string;
};

type NotificationItem = {
  recipient: {
    id: string;
  };
};

type AuditLog = {
  action: string;
  entityType: string;
  entityId: string | null;
};

const baseUrl = (process.env.QIMS_API_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");
const password = process.env.QIMS_DEMO_PASSWORD ?? "QimsDemo123!";
const suffix = new Date().toISOString().replaceAll(/[-:.TZ]/g, "").slice(0, 14);
const reason = `Final MVP QA smoke ${suffix}`;

const accounts = {
  superAdmin: "superadmin@qims.local",
  qaManager: "qamanager@qims.local",
  supervisor: "supervisor@qims.local",
  inspector: "inspector@qims.local",
  auditor: "auditor@qims.local",
} as const;

function localWorkDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Makassar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function cookieFrom(response: Response) {
  const raw = response.headers.get("set-cookie");
  assert(raw, "Login response did not return a session cookie.");
  return raw
    .split(/,(?=\s*[^;,]+=)/)
    .map((cookie) => cookie.split(";")[0]?.trim())
    .filter(Boolean)
    .join("; ");
}

async function parseJson(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`Expected JSON response, received: ${text.slice(0, 200)}`);
  }
}

async function api<T>(
  session: Session,
  path: string,
  init: RequestInit & { expectedStatus?: number } = {},
): Promise<T> {
  const expectedStatus = init.expectedStatus ?? 200;
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      cookie: session.cookie,
      ...(init.headers ?? {}),
    },
  });
  const payload = (await parseJson(response)) as ApiEnvelope<T> | null;

  if (response.status !== expectedStatus) {
    throw new Error(
      `${init.method ?? "GET"} ${path} expected ${expectedStatus}, got ${response.status}: ${JSON.stringify(payload)}`,
    );
  }

  assert(payload?.ok, `${init.method ?? "GET"} ${path} returned non-ok payload.`);
  return payload.data;
}

async function login(role: string, email: string): Promise<Session> {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const payload = (await parseJson(response)) as { user?: { id?: string } } | null;

  assert(response.status === 200, `Login failed for ${email}: ${response.status} ${JSON.stringify(payload)}`);
  assert(payload?.user?.id, `Login for ${email} did not return user id.`);

  const session: Session = {
    role,
    email,
    cookie: cookieFrom(response),
    userId: payload.user.id,
  };
  const me = await api<{ user: { id: string; email: string; role: string } }>(session, "/api/me");
  assert(me.user.email === email, `/api/me email mismatch for ${email}.`);
  assert(me.user.role === role, `/api/me role mismatch for ${email}: ${me.user.role}`);
  pass(`auth session ${role}`);
  return session;
}

async function expectForbidden(session: Session, path: string, init: RequestInit) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      cookie: session.cookie,
      ...(init.headers ?? {}),
    },
  });
  const payload = await parseJson(response);
  assert(response.status === 403, `${session.role} ${init.method ?? "GET"} ${path} expected 403, got ${response.status}: ${JSON.stringify(payload)}`);
  pass(`RBAC denied ${session.role} ${init.method ?? "GET"} ${path}`);
}

function pass(message: string) {
  console.log(`[PASS] ${message}`);
}

async function main() {
  console.log(`QIMS Final MVP smoke against ${baseUrl}`);
  const health = await fetch(`${baseUrl}/api/health`);
  assert(health.ok, `Health check failed: ${health.status}`);
  pass("health");

  const superAdmin = await login("super_admin", accounts.superAdmin);
  const qaManager = await login("qa_manager", accounts.qaManager);
  const supervisor = await login("supervisor", accounts.supervisor);
  const inspector = await login("inspector", accounts.inspector);
  const auditor = await login("auditor", accounts.auditor);

  await expectForbidden(inspector, "/api/users?limit=1", { method: "GET" });
  await expectForbidden(supervisor, "/api/sites", {
    method: "POST",
    body: JSON.stringify({
      code: `DEN${suffix.slice(-8)}`,
      name: `Denied Site ${suffix}`,
      status: "active",
      reason,
    }),
  });

  const users = await api<ListResponse<UserListItem>>(
    superAdmin,
    `/api/users?q=${encodeURIComponent(accounts.inspector)}&limit=5`,
  );
  const inspectorUser = users.items.find((item) => item.user.email === accounts.inspector)?.user;
  assert(inspectorUser, "Demo inspector user was not found. Run npm run db:seed:demo first.");

  const shifts = await api<ListResponse<MasterItem>>(superAdmin, "/api/shifts?status=active&limit=10");
  const shift = shifts.items[0];
  assert(shift, "No active shift found. Run npm run db:seed first.");

  const site = await api<MasterItem>(superAdmin, "/api/sites", {
    method: "POST",
    expectedStatus: 201,
    body: JSON.stringify({
      code: `SMK${suffix.slice(-8)}`,
      name: `MVP Smoke Site ${suffix}`,
      status: "active",
      reason,
    }),
  });
  const area = await api<MasterItem>(superAdmin, "/api/areas", {
    method: "POST",
    expectedStatus: 201,
    body: JSON.stringify({
      code: `SMA${suffix.slice(-8)}`,
      name: `MVP Smoke Area ${suffix}`,
      siteId: site.id,
      minimumSkillLevel: "not_trained",
      status: "active",
      reason,
    }),
  });
  const gapArea = await api<MasterItem>(superAdmin, "/api/areas", {
    method: "POST",
    expectedStatus: 201,
    body: JSON.stringify({
      code: `SMG${suffix.slice(-8)}`,
      name: `MVP Smoke Skill Gap Area ${suffix}`,
      siteId: site.id,
      minimumSkillLevel: "competent",
      status: "active",
      reason,
    }),
  });
  pass("super admin master data");

  const workDate = localWorkDate();
  const skillGapAssignment = await api<{ assignment: Assignment; conflicts: AssignmentConflict[] }>(
    supervisor,
    "/api/shift-assignments",
    {
      method: "POST",
      expectedStatus: 201,
      body: JSON.stringify({
        userId: inspectorUser.id,
        shiftId: shift.id,
        areaId: gapArea.id,
        workDate,
        assignmentStatus: "draft",
        changeReason: reason,
      }),
    },
  );
  assert(
    skillGapAssignment.conflicts.some((conflict) => conflict.type === "skill_mismatch"),
    "Expected skill_mismatch conflict for area requiring competent skill.",
  );
  await api(supervisor, "/api/skill-matrix", {
    method: "POST",
    body: JSON.stringify({
      userId: inspectorUser.id,
      areaId: area.id,
      skillLevel: "competent",
      notes: reason,
      reason,
    }),
  });
  pass("skill matrix validation");

  const assignmentResult = await api<{ assignment: Assignment; conflicts: unknown[] }>(
    supervisor,
    "/api/shift-assignments",
    {
      method: "POST",
      expectedStatus: 201,
      body: JSON.stringify({
        userId: inspectorUser.id,
        shiftId: shift.id,
        areaId: area.id,
        workDate,
        assignmentStatus: "draft",
        changeReason: reason,
      }),
    },
  );
  const publishResult = await api<{ publishedCount: number; assignments: Assignment[] }>(
    supervisor,
    "/api/shift-assignments/publish",
    {
      method: "POST",
      body: JSON.stringify({
        workDate,
        assignmentIds: [assignmentResult.assignment.id],
        reason,
      }),
    },
  );
  assert(publishResult.publishedCount === 1, "Expected one published shift assignment.");

  const task = await api<Task>(supervisor, "/api/tasks", {
    method: "POST",
    expectedStatus: 201,
    body: JSON.stringify({
      title: `MVP Smoke Task ${suffix}`,
      description: "Final MVP QA smoke task.",
      areaId: area.id,
      assignedUserId: inspectorUser.id,
      shiftAssignmentId: assignmentResult.assignment.id,
      priority: "high",
      status: "assigned",
      checklist: [{ label: "Visual inspection", done: false }],
      reason,
    }),
  });
  const priorityTask = await api<Task>(supervisor, `/api/tasks/${task.id}/priority`, {
    method: "PATCH",
    body: JSON.stringify({ priority: "critical", reason }),
  });
  assert(priorityTask.priority === "critical", "Task priority did not update to critical.");

  const procedure = await api<Procedure>(supervisor, "/api/procedures", {
    method: "POST",
    expectedStatus: 201,
    body: JSON.stringify({
      title: `MVP Smoke SOP ${suffix}`,
      category: "general_announcement",
      status: "draft",
      reason,
    }),
  });
  const version = await api<ProcedureVersion>(supervisor, `/api/procedures/${procedure.id}/versions`, {
    method: "POST",
    expectedStatus: 201,
    body: JSON.stringify({
      content: "Final MVP QA smoke SOP content.",
      isCritical: false,
      targets: [{ targetType: "all_inspectors" }],
      reason,
    }),
  });
  await api<{ version: ProcedureVersion; recipientCount: number }>(
    supervisor,
    `/api/procedure-versions/${version.id}/publish`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
    },
  );
  pass("supervisor schedule task priority SOP");

  const mission = await api<{
    assignment: { assignment: Assignment } | null;
    topPriority: { task: Task } | null;
    activeTasks: { task: Task }[];
    pendingSops: { version: ProcedureVersion }[];
    offlineCacheHints: { draftTypes: string[] };
  }>(inspector, `/api/inspector/today-mission?workDate=${workDate}`);
  assert(mission.assignment?.assignment.userId === inspectorUser.id, "Inspector mission did not include an assignment for the demo inspector.");
  assert(mission.activeTasks.some((item) => item.task.id === task.id), "Inspector mission did not include smoke task.");
  assert(mission.offlineCacheHints.draftTypes.includes("handover"), "Today mission did not expose handover offline draft hint.");

  await api<Task>(inspector, `/api/tasks/${task.id}/acknowledge`, {
    method: "POST",
    body: JSON.stringify({ note: reason }),
  });
  const inProgressTask = await api<Task>(inspector, `/api/tasks/${task.id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: "in_progress", progressNote: reason }),
  });
  assert(inProgressTask.status === "in_progress", "Inspector task status did not update.");

  await api(inspector, `/api/procedure-versions/${version.id}/acknowledge`, {
    method: "POST",
    body: JSON.stringify({ read: true, understood: true, note: reason }),
  });

  await api(inspector, "/api/handovers", {
    method: "POST",
    expectedStatus: 201,
    body: JSON.stringify({
      fromShiftAssignmentId: assignmentResult.assignment.id,
      areaId: area.id,
      status: "submitted",
      items: [{ category: "special_note", note: reason, severity: "low" }],
    }),
  });
  const issue = await api<{ id: string }>(inspector, "/api/issues", {
    method: "POST",
    expectedStatus: 201,
    body: JSON.stringify({
      title: `MVP Smoke Issue ${suffix}`,
      description: "Final MVP QA smoke issue.",
      category: "quality_issue",
      severity: "medium",
      areaId: area.id,
      taskId: task.id,
      shiftAssignmentId: assignmentResult.assignment.id,
    }),
  });
  await api(supervisor, `/api/issues/${issue.id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: "under_review", note: reason, reason }),
  });

  const notifications = await api<ListResponse<NotificationItem>>(inspector, "/api/notifications?limit=10");
  const firstNotification = notifications.items[0];
  if (firstNotification) {
    await api(inspector, `/api/notifications/${firstNotification.recipient.id}/read`, {
      method: "PATCH",
    });
  }

  const settings = await api<{ ecoModeEnabled: boolean; lowDataModeEnabled: boolean }>(
    inspector,
    "/api/inspector/settings",
    {
      method: "PATCH",
      body: JSON.stringify({
        ecoModeEnabled: true,
        lowDataModeEnabled: true,
        compactModeEnabled: true,
      }),
    },
  );
  assert(settings.ecoModeEnabled && settings.lowDataModeEnabled, "Eco or low-data setting did not persist.");

  await api(inspector, "/api/offline-drafts", {
    method: "POST",
    expectedStatus: 201,
    body: JSON.stringify({
      localDraftId: `mvp-smoke-${suffix}`,
      draftType: "handover",
      payload: { note: reason },
      clientUpdatedAt: new Date().toISOString(),
    }),
  });
  pass("inspector mission task SOP handover issue notification offline eco");

  await api(qaManager, "/api/reports/dashboard-summary");
  await api(qaManager, "/api/reports/task-completion?limit=5");
  const exportResult = await api<{ reportType: string; format: string; rowCount: number }>(
    qaManager,
    "/api/reports/export",
    {
      method: "POST",
      body: JSON.stringify({
        reportType: "task-completion",
        format: "json",
        filters: {},
        reason,
      }),
    },
  );
  assert(exportResult.reportType === "task-completion", "QA Manager export returned unexpected report type.");
  await expectForbidden(qaManager, "/api/tasks", {
    method: "POST",
    body: JSON.stringify({
      title: `Denied ${suffix}`,
      areaId: area.id,
      priority: "low",
      status: "draft",
      reason,
    }),
  });
  pass("qa manager reports export");

  await api(auditor, "/api/audit-logs?limit=10");
  await api(auditor, "/api/procedure-acknowledgements?limit=10");
  await expectForbidden(auditor, "/api/reports/export", {
    method: "POST",
    body: JSON.stringify({
      reportType: "task-completion",
      format: "json",
      filters: {},
      reason,
    }),
  });
  await expectForbidden(auditor, "/api/tasks", {
    method: "POST",
    body: JSON.stringify({
      title: `Denied ${suffix}`,
      areaId: area.id,
      priority: "low",
      status: "draft",
      reason,
    }),
  });
  pass("auditor read-only access");

  const requiredAuditActions = [
    "shift_assignments.publish",
    "tasks.priority_update",
    "procedure_versions.publish",
    "tasks.acknowledge",
    "handovers.submit",
    "issues.create",
    "reports.export",
    "offline_drafts.upsert",
    "inspector_settings.update",
    "skill_matrix.upsert",
  ];
  for (const action of requiredAuditActions) {
    const audit = await api<ListResponse<AuditLog>>(
      auditor,
      `/api/audit-logs?action=${encodeURIComponent(action)}&limit=5`,
    );
    assert(audit.items.length > 0, `Expected audit log for ${action}.`);
  }
  pass("audit trail required actions");

  console.log(`Final MVP smoke completed. Created QA records with suffix ${suffix}.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
