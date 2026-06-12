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

type DashboardSummary = {
  filters: {
    dateFrom: string;
    dateTo: string;
  };
};

type ExportJob = {
  job: {
    id: string;
    status: string;
    result?: {
      downloadUrl?: string;
    } | null;
  };
};

const baseUrl = (process.env.QIMS_API_URL ?? "http://127.0.0.1:3001").replace(
  /\/$/,
  "",
);
const password = process.env.QIMS_DEMO_PASSWORD ?? "QimsDemo123!";
const reason = `Tahap 10.4 QA Manager verification ${new Date().toISOString()}`;

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
      email: "qamanager@qims.local",
      password,
    }),
  });
  const payload = await parseJson(response);
  assert(response.ok, `QA Manager login failed: ${JSON.stringify(payload)}`);
  return { cookie: cookieFrom(response) };
}

async function api<T>(
  session: Session,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      cookie: session.cookie,
      ...(init.headers ?? {}),
    },
  });
  const payload = (await parseJson(response)) as ApiEnvelope<T> | null;
  assert(
    response.ok,
    `${init.method ?? "GET"} ${path} failed with ${response.status}: ${JSON.stringify(payload)}`,
  );
  assert(payload?.ok, `${init.method ?? "GET"} ${path} returned non-ok.`);
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
    `${init.method ?? "GET"} ${path} should be forbidden.`,
  );
}

const qaManager = await login();
const range = "dateFrom=2020-01-01&dateTo=2099-12-31";
const dashboard = await api<DashboardSummary>(
  qaManager,
  `/api/reports/dashboard-summary?${range}`,
);
assert(
  dashboard.filters.dateFrom === "2020-01-01" &&
    dashboard.filters.dateTo === "2099-12-31",
  "Dashboard did not apply the requested date range.",
);

const reports = await Promise.all([
  api<ListResponse<unknown>>(
    qaManager,
    `/api/reports/shift-completion?${range}&status=published&page=1&limit=5`,
  ),
  api<ListResponse<unknown>>(
    qaManager,
    `/api/reports/task-completion?${range}&priority=critical&page=1&limit=5`,
  ),
  api<ListResponse<unknown>>(
    qaManager,
    `/api/reports/sop-compliance?${range}&status=pending&page=1&limit=5`,
  ),
  api<ListResponse<unknown>>(
    qaManager,
    "/api/reports/skill-gap?page=1&limit=5",
  ),
  api<ListResponse<unknown>>(
    qaManager,
    `/api/reports/issues?${range}&severity=critical&page=1&limit=5`,
  ),
]);
assert(
  reports.every((report) => report.meta.page === 1 && report.meta.limit === 5),
  "Report pagination metadata is inconsistent.",
);

const directExport = await api<{ reportType: string; rowCount: number }>(
  qaManager,
  "/api/reports/export",
  {
    method: "POST",
    body: JSON.stringify({
      reportType: "task-completion",
      format: "json",
      filters: {
        dateFrom: "2020-01-01",
        dateTo: "2099-12-31",
      },
      reason,
    }),
  },
);
assert(
  directExport.reportType === "task-completion",
  "Direct export returned an unexpected report type.",
);

const asyncExport = await api<ExportJob>(
  qaManager,
  "/api/reports/export-jobs",
  {
    method: "POST",
    body: JSON.stringify({
      reportType: "issues",
      format: "csv",
      filters: {
        dateFrom: "2020-01-01",
        dateTo: "2099-12-31",
      },
      reason,
    }),
  },
);
assert(
  asyncExport.job.status === "completed",
  "Local async export job did not complete.",
);
const job = await api<ExportJob>(
  qaManager,
  `/api/reports/export-jobs/${asyncExport.job.id}`,
);
assert(job.job.id === asyncExport.job.id, "Export job ownership lookup failed.");

const download = await fetch(
  `${baseUrl}/api/reports/export-jobs/${asyncExport.job.id}/download`,
  { headers: { cookie: qaManager.cookie } },
);
assert(download.ok, `Export download failed with ${download.status}.`);

await expectForbidden(qaManager, "/api/tasks", {
  method: "POST",
  body: JSON.stringify({
    title: "QA Manager write must remain forbidden",
    areaId: "33333333-3333-4333-8333-333333333333",
    reason,
  }),
});

console.log(
  JSON.stringify(
    {
      dashboardFilters: "passed",
      reportPagination: "passed",
      directExportRows: directExport.rowCount,
      asyncExportJob: asyncExport.job.id,
      asyncExportDownload: "passed",
      operationalWriteDenied: "passed",
    },
    null,
    2,
  ),
);

export {};
