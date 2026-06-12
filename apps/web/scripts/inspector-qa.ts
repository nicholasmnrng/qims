type ApiEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; details?: unknown } };

type Session = {
  cookie: string;
};

type MeResponse = {
  user: {
    id: string;
    role: string;
  };
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

type TodayMission = {
  pendingCriticalSops: unknown[];
  taskActionsBlocked: boolean;
  offlineCacheHints: {
    cacheable: string[];
    draftTypes: string[];
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
      email: "inspector@qims.local",
      password,
    }),
  });
  const payload = await parseJson(response);
  assert(response.ok, `Inspector login failed: ${JSON.stringify(payload)}`);
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

const inspector = await login();
const me = await api<MeResponse>(inspector, "/api/me");
assert(me.user.role === "inspector", "Demo account is not an Inspector.");

const mission = await api<TodayMission>(
  inspector,
  "/api/inspector/today-mission",
);
assert(
  mission.taskActionsBlocked === (mission.pendingCriticalSops.length > 0),
  "Critical SOP blocking state is inconsistent.",
);
assert(
  mission.offlineCacheHints.draftTypes.includes("task_note"),
  "Today Mission does not advertise the task note offline contract.",
);

const ownEvents = await api<ListResponse<unknown>>(
  inspector,
  `/api/realtime-events?channel=${encodeURIComponent(`user:${me.user.id}`)}&page=1&limit=5`,
);
assert(
  ownEvents.meta.page === 1 && ownEvents.meta.limit === 5,
  "Realtime pagination metadata is invalid.",
);

const forbiddenResponse = await fetch(
  `${baseUrl}/api/realtime-events?channel=${encodeURIComponent("user:another-user")}`,
  {
    headers: {
      "content-type": "application/json",
      cookie: inspector.cookie,
    },
  },
);
const forbiddenPayload = (await parseJson(
  forbiddenResponse,
)) as ApiEnvelope<unknown> | null;
assert(
  forbiddenResponse.status === 403 && forbiddenPayload && !forbiddenPayload.ok,
  "Inspector could read a realtime channel owned by another user.",
);

const drafts = await api<ListResponse<unknown>>(
  inspector,
  "/api/offline-drafts?page=1&limit=5",
);
assert(
  drafts.meta.page === 1 && drafts.meta.limit === 5,
  "Offline draft pagination metadata is invalid.",
);

console.log(
  JSON.stringify(
    {
      todayMissionCriticalSopState: "passed",
      offlineContract: "passed",
      ownRealtimeChannel: "passed",
      foreignRealtimeChannelDenied: "passed",
      offlineDraftPagination: drafts.meta,
    },
    null,
    2,
  ),
);

export {};
