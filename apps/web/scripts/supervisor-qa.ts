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

type AssignmentItem = {
  assignment: {
    workDate: string;
  };
  skill: {
    level: string | null;
    validUntil: string | null;
  };
};

type NotificationItem = {
  notification: {
    id: string;
  };
  recipients: Array<{
    recipient: {
      notificationId: string;
      deliveryStatus: string;
    };
  }>;
  summary: {
    total: number;
    delivered: number;
    failed: number;
    read: number;
    acknowledged: number;
  };
};

const baseUrl = (process.env.QIMS_API_URL ?? "http://127.0.0.1:3001").replace(
  /\/$/,
  "",
);
const password = process.env.QIMS_DEMO_PASSWORD ?? "QimsDemo123!";

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
      email: "supervisor@qims.local",
      password,
    }),
  });
  const payload = await parseJson(response);
  assert(response.ok, `Supervisor login failed: ${JSON.stringify(payload)}`);
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
  assert(payload?.ok, `GET ${path} returned a non-ok envelope.`);
  return payload.data;
}

const supervisor = await login();
const assignments = await api<ListResponse<AssignmentItem>>(
  supervisor,
  "/api/shift-assignments?dateFrom=2020-01-01&dateTo=2099-12-31&page=1&limit=5",
);
assert(
  assignments.meta.page === 1 && assignments.meta.limit === 5,
  "Assignment pagination metadata is invalid.",
);
assert(
  assignments.items.every((item) => "skill" in item),
  "Assignment response does not include inspector skill context.",
);

const handovers = await api<ListResponse<unknown>>(
  supervisor,
  "/api/handovers?dateFrom=2020-01-01&dateTo=2099-12-31&page=1&limit=5",
);
const issues = await api<ListResponse<unknown>>(
  supervisor,
  "/api/issues?dateFrom=2020-01-01&dateTo=2099-12-31&page=1&limit=5",
);
const notifications = await api<ListResponse<NotificationItem>>(
  supervisor,
  "/api/notifications?readStatus=unread&page=1&limit=5",
);

for (const item of notifications.items) {
  assert(
    item.summary.total === item.recipients.length,
    `Notification ${item.notification.id} recipient summary is inconsistent.`,
  );
}

console.log(
  JSON.stringify(
    {
      assignmentFilters: "passed",
      assignmentSkillContext: "passed",
      handoverDateFilters: handovers.meta,
      issueDateFilters: issues.meta,
      notificationRecipientStatus: "passed",
      notificationRowsChecked: notifications.items.length,
    },
    null,
    2,
  ),
);

export {};
