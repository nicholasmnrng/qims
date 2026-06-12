type ApiEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; details?: unknown } };

type Session = {
  cookie: string;
};

type RoleItem = {
  role: {
    id: string;
  };
  permissions: string[];
};

type MeResponse = {
  user: {
    role: string;
  };
  permissions: string[];
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

type AuditLogItem = {
  action: string;
  createdAt: string;
  actor: {
    id: string | null;
    name: string | null;
    email: string | null;
    employeeId: string | null;
  };
};

const baseUrl = (process.env.QIMS_API_URL ?? "http://127.0.0.1:3001").replace(
  /\/$/,
  "",
);
const password = process.env.QIMS_DEMO_PASSWORD ?? "QimsDemo123!";
const reason = `Tahap 10.1 Super Admin QA ${new Date().toISOString()}`;

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

async function login(email: string): Promise<Session> {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const payload = await parseJson(response);
  assert(response.ok, `Login failed for ${email}: ${JSON.stringify(payload)}`);
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

async function expectError(
  session: Session,
  path: string,
  expectedStatus: number,
) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      "content-type": "application/json",
      cookie: session.cookie,
    },
  });
  const payload = (await parseJson(response)) as ApiEnvelope<unknown> | null;
  assert(
    response.status === expectedStatus,
    `GET ${path} expected ${expectedStatus}, got ${response.status}: ${JSON.stringify(payload)}`,
  );
  assert(payload && !payload.ok, `${path} should return an error envelope.`);
}

const superAdmin = await login("superadmin@qims.local");
const supervisor = await login("supervisor@qims.local");
const auditor = await login("auditor@qims.local");

const roles = await api<{ items: RoleItem[] }>(superAdmin, "/api/roles");
const supervisorRole = roles.items.find((item) => item.role.id === "supervisor");
assert(supervisorRole, "Supervisor role was not returned.");

const originalPermissions = supervisorRole.permissions;
const testPermission = "reports:export";
const testPermissions = originalPermissions.includes(testPermission)
  ? originalPermissions.filter((permission) => permission !== testPermission)
  : [...originalPermissions, testPermission];

try {
  await api(superAdmin, "/api/roles/supervisor/permissions", {
    method: "PATCH",
    body: JSON.stringify({
      permissionIds: testPermissions,
      reason,
    }),
  });

  const changedSession = await api<MeResponse>(supervisor, "/api/me");
  assert(
    changedSession.permissions.includes(testPermission) ===
      testPermissions.includes(testPermission),
    "Database role permission change was not reflected by runtime RBAC.",
  );
} finally {
  await api(superAdmin, "/api/roles/supervisor/permissions", {
    method: "PATCH",
    body: JSON.stringify({
      permissionIds: originalPermissions,
      reason: `${reason} restore`,
    }),
  });
}

const users = await api<ListResponse<unknown>>(
  superAdmin,
  "/api/users?q=cladtek&role=super_admin&status=active&page=1&limit=5",
);
assert(users.meta.page === 1 && users.meta.limit === 5, "User pagination metadata is invalid.");

await expectError(supervisor, "/api/users?role=super_admin&limit=5", 403);
await expectError(auditor, "/api/users?limit=5", 403);

const shifts = await api<ListResponse<unknown>>(
  superAdmin,
  "/api/shifts?q=shift&status=active&page=1&limit=5",
);
assert(shifts.meta.page === 1 && shifts.meta.limit === 5, "Master-data pagination metadata is invalid.");

const today = new Date().toISOString().slice(0, 10);
const audit = await api<ListResponse<AuditLogItem>>(
  superAdmin,
  `/api/audit-logs?actor=superadmin%40qims.local&action=roles.permissions_update&dateFrom=${today}&dateTo=${today}&page=1&limit=10`,
);
assert(audit.items.length > 0, "Filtered audit log did not return the permission update.");
assert(
  audit.items.every((item) => item.actor?.email === "superadmin@qims.local"),
  "Audit actor context is missing or incorrect.",
);

console.log(
  JSON.stringify(
    {
      dynamicPermissionRuntime: "passed",
      supervisorUserScope: "passed",
      auditorWriteScope: "passed",
      userPagination: users.meta,
      masterPagination: shifts.meta,
      filteredAuditRows: audit.items.length,
    },
    null,
    2,
  ),
);

export {};
