type ApiEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; details?: unknown } };

type Session = {
  cookie: string;
};

type ListResponse<T> = {
  items: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

const baseUrl = (process.env.QIMS_API_URL ?? "http://127.0.0.1:3001").replace(
  /\/$/,
  "",
);
const password = process.env.QIMS_DEMO_PASSWORD ?? "QimsDemo123!";
const reason = `Tahap 10.5 Auditor denial QA ${new Date().toISOString()}`;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
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
  return text ? (JSON.parse(text) as unknown) : null;
}

async function login(): Promise<Session> {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "auditor@qims.local",
      password,
    }),
  });
  const payload = await parseJson(response);
  assert(response.ok, `Auditor login failed: ${JSON.stringify(payload)}`);
  return { cookie: cookieFrom(response) };
}

async function api<T>(session: Session, path: string): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      "content-type": "application/json",
      cookie: session.cookie,
    },
  });
  const payload = (await parseJson(response)) as ApiEnvelope<T> | null;
  assert(
    response.ok,
    `GET ${path} failed with ${response.status}: ${JSON.stringify(payload)}`,
  );
  assert(payload?.ok, `GET ${path} returned non-ok.`);
  return payload.data;
}

async function expectForbidden(
  session: Session,
  path: string,
  init: RequestInit,
) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      cookie: session.cookie,
      ...(init.headers ?? {}),
    },
  });
  const payload = (await parseJson(response)) as ApiEnvelope<unknown> | null;
  assert(
    response.status === 403 && payload && !payload.ok,
    `${init.method ?? "GET"} ${path} expected 403, got ${response.status}: ${JSON.stringify(payload)}`,
  );
  return payload.error.code;
}

const auditor = await login();
const auditLogs = await api<ListResponse<unknown>>(
  auditor,
  "/api/audit-logs?dateFrom=2020-01-01&dateTo=2099-12-31&page=1&limit=5",
);
const sopEvidence = await api<ListResponse<unknown>>(
  auditor,
  "/api/procedure-acknowledgements?isCritical=true&status=pending&page=1&limit=5",
);
const reports = await api<ListResponse<unknown>>(
  auditor,
  "/api/reports/task-completion?dateFrom=2020-01-01&dateTo=2099-12-31&page=1&limit=5",
);
assert(
  [auditLogs, sopEvidence, reports].every(
    (result) => result.meta.page === 1 && result.meta.limit === 5,
  ),
  "Auditor read endpoints returned inconsistent pagination.",
);

const denied = await Promise.all([
  expectForbidden(auditor, "/api/reports/export", {
    method: "POST",
    body: JSON.stringify({
      reportType: "task-completion",
      format: "json",
      filters: {},
      reason,
    }),
  }),
  expectForbidden(auditor, "/api/reports/export-jobs", {
    method: "POST",
    body: JSON.stringify({
      reportType: "issues",
      format: "csv",
      filters: {},
      reason,
    }),
  }),
  expectForbidden(auditor, "/api/tasks", {
    method: "POST",
    body: JSON.stringify({ title: "Denied", reason }),
  }),
  expectForbidden(auditor, "/api/shift-assignments", {
    method: "POST",
    body: JSON.stringify({ changeReason: reason }),
  }),
  expectForbidden(auditor, "/api/procedures", {
    method: "POST",
    body: JSON.stringify({ title: "Denied", reason }),
  }),
  expectForbidden(auditor, "/api/issues", {
    method: "POST",
    body: JSON.stringify({ title: "Denied" }),
  }),
  expectForbidden(auditor, "/api/areas", {
    method: "POST",
    body: JSON.stringify({ name: "Denied", reason }),
  }),
  expectForbidden(auditor, "/api/roles/supervisor/permissions", {
    method: "PATCH",
    body: JSON.stringify({ permissionIds: [], reason }),
  }),
  expectForbidden(auditor, "/api/system-settings", {
    method: "PATCH",
    body: JSON.stringify({ key: "denied", value: {}, reason }),
  }),
  expectForbidden(auditor, "/api/worker/run", {
    method: "POST",
    body: JSON.stringify({ reason }),
  }),
  expectForbidden(auditor, "/api/notification-worker/dispatch", {
    method: "POST",
    body: JSON.stringify({ limit: 1, mode: "mock", reason }),
  }),
  expectForbidden(auditor, "/api/storage/signed-upload", {
    method: "POST",
    body: JSON.stringify({
      bucket: "sop-files",
      entityType: "procedure_versions",
      entityId: "denied",
      fileName: "denied.pdf",
      contentType: "application/pdf",
      sizeBytes: 100,
    }),
  }),
]);
assert(
  denied.every((code) => code === "FORBIDDEN"),
  "One or more Auditor denial responses were not actionable FORBIDDEN errors.",
);

console.log(
  JSON.stringify(
    {
      auditTrailRead: auditLogs.meta,
      sopEvidenceRead: sopEvidence.meta,
      reportRead: reports.meta,
      deniedWriteRoutes: denied.length,
      denialErrorCode: "FORBIDDEN",
    },
    null,
    2,
  ),
);

export {};
