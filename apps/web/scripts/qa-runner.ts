type ApiEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; details?: unknown } };

type Session = {
  cookie: string;
};

type BackgroundJob = {
  id: string;
  jobType: string;
  status: string;
  result?: {
    success?: boolean;
    downloadUrl?: string;
    rowCount?: number;
  };
};

const baseUrl = (process.env.QIMS_API_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");
const password = process.env.QIMS_DEMO_PASSWORD ?? "QimsDemo123!";
const reason = `Local worker QA ${new Date().toISOString()}`;

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
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`Expected JSON response, received: ${text.slice(0, 200)}`);
  }
}

async function login(): Promise<Session> {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "superadmin@qims.local", password }),
  });
  const payload = (await parseJson(response)) as { user?: { role?: string } } | ApiEnvelope<unknown> | null;
  const directLoginOk = Boolean(
    payload &&
      typeof payload === "object" &&
      "user" in payload &&
      payload.user?.role === "super_admin",
  );
  const envelopeLoginOk = Boolean(payload && typeof payload === "object" && "ok" in payload && payload.ok);
  assert(response.ok && (directLoginOk || envelopeLoginOk), `Super Admin login failed: ${JSON.stringify(payload)}`);
  return { cookie: cookieFrom(response) };
}

async function api<T>(session: Session, path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      cookie: session.cookie,
      ...(init.headers ?? {}),
    },
  });
  const payload = (await parseJson(response)) as ApiEnvelope<T> | null;
  assert(response.ok && payload?.ok, `${init.method ?? "GET"} ${path} failed: ${JSON.stringify(payload)}`);
  return payload.data;
}

const session = await login();

const workerResult = await api<{ job: BackgroundJob }>(session, "/api/worker/run", {
  method: "POST",
  body: JSON.stringify({
    jobType: "dispatch_notification",
    payload: {
      source: "qa-runner",
      mode: "local-dev",
    },
  }),
});
assert(workerResult.job.status === "completed", "Local worker job did not complete.");
assert(workerResult.job.result?.success, "Local worker job did not report success.");

const exportResult = await api<{ job: BackgroundJob }>(session, "/api/reports/export-jobs", {
  method: "POST",
  body: JSON.stringify({
    reportType: "task-completion",
    format: "csv",
    filters: {},
    reason,
  }),
});
assert(exportResult.job.status === "completed", "Export background job did not complete.");
assert(exportResult.job.result?.downloadUrl, "Export job did not return a download URL.");

const download = await fetch(`${baseUrl}${exportResult.job.result.downloadUrl}`, {
  headers: { cookie: session.cookie },
});
assert(download.ok, `Export job download failed with ${download.status}.`);
const content = await download.text();

console.log(
  JSON.stringify(
    {
      workerJob: {
        id: workerResult.job.id,
        status: workerResult.job.status,
      },
      exportJob: {
        id: exportResult.job.id,
        status: exportResult.job.status,
        rowCount: exportResult.job.result.rowCount,
        downloadedBytes: content.length,
      },
    },
    null,
    2,
  ),
);

export {};
