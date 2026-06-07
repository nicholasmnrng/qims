"use client";

import {
  Activity,
  AlertTriangle,
  Archive,
  Bell,
  ClipboardCheck,
  Database,
  FileClock,
  FileText,
  Gauge,
  Layers3,
  ListChecks,
  Lock,
  LogIn,
  LogOut,
  Moon,
  RefreshCcw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";

type UserRole = "super_admin" | "qa_manager" | "supervisor" | "inspector" | "auditor";
type Permission =
  | "auth:session:read"
  | "users:read"
  | "users:write"
  | "roles:manage"
  | "master-data:manage"
  | "schedule:manage"
  | "tasks:manage"
  | "tasks:update-own"
  | "sop:manage"
  | "sop:acknowledge"
  | "skill-matrix:manage"
  | "handover:manage"
  | "handover:create-own"
  | "issues:manage"
  | "issues:create-own"
  | "notifications:read"
  | "reports:read"
  | "reports:export"
  | "audit:read";

type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: string;
};

type SessionData = {
  user: SessionUser;
  permissions: Permission[];
};

type ApiOk<T> = {
  ok: true;
  data: T;
};

type ApiFail = {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

type ApiList<T = Record<string, unknown>> = {
  items?: T[];
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  summary?: Record<string, unknown>;
};

type LoadState<T> =
  | { status: "idle" | "loading"; data?: T; error?: undefined }
  | { status: "ready"; data: T; error?: undefined }
  | { status: "error"; data?: T; error: string };

type ViewKey = "overview" | "admin" | "operations" | "reports" | "audit";

type ViewConfig = {
  key: ViewKey;
  label: string;
  icon: LucideIcon;
  permissions: Permission[];
};

type ViewPayload = {
  summary?: Record<string, unknown>;
  users?: ApiList;
  roles?: ApiList;
  sites?: ApiList;
  shifts?: ApiList;
  assignments?: ApiList;
  tasks?: ApiList;
  issues?: ApiList;
  handovers?: ApiList;
  notifications?: ApiList;
  taskReport?: ApiList;
  sopReport?: ApiList;
  auditLogs?: ApiList;
  sopAcknowledgements?: ApiList;
};

class ClientApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
  }
}

const views: ViewConfig[] = [
  {
    key: "overview",
    label: "Dashboard",
    icon: Gauge,
    permissions: ["auth:session:read"],
  },
  {
    key: "admin",
    label: "Admin",
    icon: ShieldCheck,
    permissions: ["users:read", "roles:manage", "master-data:manage"],
  },
  {
    key: "operations",
    label: "Command",
    icon: Activity,
    permissions: ["schedule:manage", "tasks:manage", "handover:manage", "issues:manage"],
  },
  {
    key: "reports",
    label: "Reports",
    icon: FileText,
    permissions: ["reports:read"],
  },
  {
    key: "audit",
    label: "Audit",
    icon: FileClock,
    permissions: ["audit:read"],
  },
];

function hasAnyPermission(session: SessionData | null, permissions: Permission[]) {
  if (!session) return false;
  return permissions.some((permission) => session.permissions.includes(permission));
}

function roleLabel(role: UserRole) {
  return {
    super_admin: "Super Admin",
    qa_manager: "QA Manager",
    supervisor: "Supervisor",
    inspector: "Inspector",
    auditor: "Auditor",
  }[role];
}

function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Makassar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function listItems(value?: ApiList) {
  return Array.isArray(value?.items) ? value.items : [];
}

function textValue(value: unknown, fallback = "-") {
  if (value === null || value === undefined || value === "") return fallback;
  if (value instanceof Date) return value.toLocaleString("id-ID");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function dateValue(value: unknown) {
  if (!value || typeof value !== "string") return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  const payload = (await response.json().catch(() => null)) as ApiOk<T> | ApiFail | null;

  if (!response.ok || !payload?.ok) {
    const error = payload && !payload.ok ? payload.error : undefined;
    throw new ClientApiError(error?.message ?? "Request gagal.", error?.code ?? "REQUEST_FAILED");
  }

  return payload.data;
}

async function maybe<T>(request: Promise<T>) {
  return request.catch((error: unknown) => {
    if (error instanceof ClientApiError && error.code === "FORBIDDEN") return undefined;
    throw error;
  });
}

function buildQuery(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export function DashboardApp() {
  const [sessionState, setSessionState] = useState<LoadState<SessionData>>({
    status: "loading",
  });
  const [activeView, setActiveView] = useState<ViewKey>("overview");
  const [ecoMode, setEcoMode] = useState(true);
  const [viewState, setViewState] = useState<LoadState<ViewPayload>>({ status: "idle" });
  const [auditAction, setAuditAction] = useState("");
  const [sopAckStatus, setSopAckStatus] = useState("");

  const session = sessionState.status === "ready" ? sessionState.data : null;
  const visibleViews = useMemo(
    () => views.filter((view) => hasAnyPermission(session, view.permissions)),
    [session],
  );
  const currentActiveView = visibleViews.some((view) => view.key === activeView)
    ? activeView
    : "overview";

  const refreshSession = useCallback(async () => {
    setSessionState({ status: "loading" });
    try {
      const data = await apiRequest<SessionData>("/api/me");
      setSessionState({ status: "ready", data });
      setActiveView("overview");
    } catch (error) {
      if (error instanceof ClientApiError && error.code === "UNAUTHENTICATED") {
        setSessionState({ status: "idle" });
        return;
      }
      setSessionState({
        status: "error",
        error: error instanceof Error ? error.message : "Session gagal dimuat.",
      });
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshSession();
  }, [refreshSession]);

  const loadView = useCallback(async () => {
    if (!session) return;
    setViewState({ status: "loading" });
    try {
      const data = await loadViewPayload(currentActiveView, session, {
        auditAction,
        sopAckStatus,
      });
      setViewState({ status: "ready", data });
    } catch (error) {
      setViewState({
        status: "error",
        error: error instanceof Error ? error.message : "Data gagal dimuat.",
      });
    }
  }, [auditAction, currentActiveView, session, sopAckStatus]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadView();
  }, [loadView]);

  if (sessionState.status === "loading") {
    return <BootScreen />;
  }

  if (!session) {
    return (
      <main className={`login-page ${ecoMode ? "eco" : ""}`}>
        <LoginPanel
          error={sessionState.status === "error" ? sessionState.error : undefined}
          ecoMode={ecoMode}
          onEcoModeChange={setEcoMode}
          onAuthenticated={refreshSession}
        />
      </main>
    );
  }

  const currentView = views.find((view) => view.key === currentActiveView) ?? views[0];

  return (
    <main className={`app-shell ${ecoMode ? "eco" : ""}`}>
      <aside className="sidebar" aria-label="Navigasi QIMS">
        <div className="brand-block">
          <div className="brand-mark">QI</div>
          <div>
            <strong>QIMS</strong>
            <span>Operation Web</span>
          </div>
        </div>

        <nav className="nav-list">
          {visibleViews.map((view) => {
            const Icon = view.icon;
            return (
              <button
                className={view.key === currentActiveView ? "nav-item active" : "nav-item"}
                key={view.key}
                onClick={() => setActiveView(view.key)}
                title={view.label}
                type="button"
              >
                <Icon aria-hidden size={18} />
                <span>{view.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button
            className={ecoMode ? "utility-button active" : "utility-button"}
            onClick={() => setEcoMode((value) => !value)}
            title="Eco mode"
            type="button"
          >
            <Moon aria-hidden size={17} />
            <span>Eco</span>
          </button>
          <button className="utility-button" onClick={refreshSession} title="Refresh session" type="button">
            <RefreshCcw aria-hidden size={17} />
            <span>Sync</span>
          </button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">{roleLabel(session.user.role)}</span>
            <h1>{currentView.label}</h1>
          </div>
          <div className="topbar-actions">
            <div className="identity">
              <strong>{session.user.name}</strong>
              <span>{session.user.email}</span>
            </div>
            <button className="icon-button" onClick={loadView} title="Refresh data" type="button">
              <RefreshCcw aria-hidden size={18} />
            </button>
            <button className="icon-button" onClick={logout} title="Logout" type="button">
              <LogOut aria-hidden size={18} />
            </button>
          </div>
        </header>

        {currentActiveView === "audit" && (
          <FilterBar
            auditAction={auditAction}
            sopAckStatus={sopAckStatus}
            onAuditActionChange={setAuditAction}
            onSopAckStatusChange={setSopAckStatus}
            onApply={loadView}
          />
        )}

        <ViewStateFrame state={viewState}>
          {(payload) => (
            <RoleView
              activeView={currentActiveView}
              payload={payload}
              session={session}
              onSwitchView={setActiveView}
            />
          )}
        </ViewStateFrame>
      </section>
    </main>
  );

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => undefined);
    setSessionState({ status: "idle" });
    setViewState({ status: "idle" });
  }
}

async function loadViewPayload(
  view: ViewKey,
  session: SessionData,
  filters: { auditAction: string; sopAckStatus: string },
): Promise<ViewPayload> {
  const can = (permission: Permission) => session.permissions.includes(permission);
  const commonLimit = "6";

  if (view === "admin") {
    return {
      users: can("users:read") ? await maybe(apiRequest<ApiList>("/api/users?limit=6")) : undefined,
      roles: can("roles:manage") ? await maybe(apiRequest<ApiList>("/api/roles")) : undefined,
      sites: can("master-data:manage") ? await maybe(apiRequest<ApiList>("/api/sites?limit=6")) : undefined,
      shifts: can("master-data:manage") ? await maybe(apiRequest<ApiList>("/api/shifts?limit=6")) : undefined,
    };
  }

  if (view === "operations") {
    return {
      assignments: can("schedule:manage")
        ? await maybe(apiRequest<ApiList>(`/api/shift-assignments?workDate=${today()}&limit=${commonLimit}`))
        : undefined,
      tasks: can("tasks:manage") ? await maybe(apiRequest<ApiList>(`/api/tasks?limit=${commonLimit}`)) : undefined,
      issues: can("issues:manage") ? await maybe(apiRequest<ApiList>(`/api/issues?limit=${commonLimit}`)) : undefined,
      handovers: can("handover:manage") ? await maybe(apiRequest<ApiList>(`/api/handovers?limit=${commonLimit}`)) : undefined,
      notifications: can("notifications:read")
        ? await maybe(apiRequest<ApiList>(`/api/notifications?limit=${commonLimit}`))
        : undefined,
    };
  }

  if (view === "reports") {
    return {
      summary: can("reports:read") ? await maybe(apiRequest<Record<string, unknown>>("/api/reports/dashboard-summary")) : undefined,
      taskReport: can("reports:read")
        ? await maybe(apiRequest<ApiList>(`/api/reports/task-completion?limit=${commonLimit}`))
        : undefined,
      sopReport: can("reports:read")
        ? await maybe(apiRequest<ApiList>(`/api/reports/sop-compliance?limit=${commonLimit}`))
        : undefined,
      issues: can("reports:read")
        ? await maybe(apiRequest<ApiList>(`/api/reports/issues?limit=${commonLimit}`))
        : undefined,
    };
  }

  if (view === "audit") {
    const auditQuery = buildQuery({
      limit: commonLimit,
      action: filters.auditAction.trim() || undefined,
    });
    const ackQuery = buildQuery({
      limit: commonLimit,
      status: filters.sopAckStatus || undefined,
    });
    return {
      auditLogs: can("audit:read") ? await maybe(apiRequest<ApiList>(`/api/audit-logs${auditQuery}`)) : undefined,
      sopAcknowledgements: can("audit:read")
        ? await maybe(apiRequest<ApiList>(`/api/procedure-acknowledgements${ackQuery}`))
        : undefined,
    };
  }

  const payload: ViewPayload = {};

  if (can("reports:read")) {
    payload.summary = await maybe(apiRequest<Record<string, unknown>>("/api/reports/dashboard-summary"));
  }

  if (can("schedule:manage") || can("tasks:manage") || can("issues:manage")) {
    const operationPayload = await loadViewPayload("operations", session, filters);
    Object.assign(payload, operationPayload);
  }

  if (can("users:read") || can("roles:manage") || can("master-data:manage")) {
    const adminPayload = await loadViewPayload("admin", session, filters);
    Object.assign(payload, adminPayload);
  }

  if (can("audit:read")) {
    payload.auditLogs = await maybe(apiRequest<ApiList>("/api/audit-logs?limit=5"));
  }

  return payload;
}

function LoginPanel({
  error,
  ecoMode,
  onEcoModeChange,
  onAuthenticated,
}: {
  error?: string;
  ecoMode: boolean;
  onEcoModeChange: (value: boolean) => void;
  onAuthenticated: () => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setLoginError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = (await response.json().catch(() => null)) as ApiFail | ApiOk<unknown> | null;
      if (!response.ok || payload?.ok === false) {
        throw new Error(payload && !payload.ok ? payload.error.message : "Login gagal.");
      }
      await onAuthenticated();
    } catch (loginFailure) {
      setLoginError(loginFailure instanceof Error ? loginFailure.message : "Login gagal.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="login-panel">
      <div className="login-copy">
        <div className="brand-block">
          <div className="brand-mark">QI</div>
          <div>
            <strong>QIMS</strong>
            <span>Quality Operation</span>
          </div>
        </div>
        <h1>Command center</h1>
        <p>
          Masuk untuk mengakses dashboard sesuai role, dengan data padat, cepat dibaca,
          dan minim beban visual.
        </p>
        <button
          className={ecoMode ? "utility-button active" : "utility-button"}
          onClick={() => onEcoModeChange(!ecoMode)}
          type="button"
        >
          <Moon aria-hidden size={17} />
          <span>Eco mode</span>
        </button>
      </div>

      <form className="login-form" onSubmit={submit}>
        <label>
          Email
          <input
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>
        <label>
          Password
          <input
            autoComplete="current-password"
            minLength={8}
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>
        {(loginError || error) && <StateMessage tone="danger" text={loginError ?? error ?? ""} />}
        <button className="primary-button" disabled={loading} type="submit">
          <LogIn aria-hidden size={18} />
          <span>{loading ? "Masuk..." : "Login"}</span>
        </button>
      </form>
    </section>
  );
}

function BootScreen() {
  return (
    <main className="boot-screen">
      <div className="brand-block">
        <div className="brand-mark">QI</div>
        <div>
          <strong>QIMS</strong>
          <span>Loading session</span>
        </div>
      </div>
    </main>
  );
}

function ViewStateFrame<T>({
  state,
  children,
}: {
  state: LoadState<T>;
  children: (payload: T) => ReactNode;
}) {
  if (state.status === "loading" || state.status === "idle") {
    return <SkeletonGrid />;
  }

  if (state.status === "error") {
    return <StateMessage tone="danger" text={state.error} />;
  }

  return children(state.data as T);
}

function RoleView({
  activeView,
  payload,
  session,
  onSwitchView,
}: {
  activeView: ViewKey;
  payload: ViewPayload;
  session: SessionData;
  onSwitchView: (view: ViewKey) => void;
}) {
  if (activeView === "admin") return <AdminView payload={payload} session={session} />;
  if (activeView === "operations") return <OperationsView payload={payload} session={session} />;
  if (activeView === "reports") return <ReportsView payload={payload} session={session} />;
  if (activeView === "audit") return <AuditView payload={payload} session={session} />;
  return <OverviewView payload={payload} session={session} onSwitchView={onSwitchView} />;
}

function OverviewView({
  payload,
  session,
  onSwitchView,
}: {
  payload: ViewPayload;
  session: SessionData;
  onSwitchView: (view: ViewKey) => void;
}) {
  const summary = asObject(payload.summary);
  const canAdmin = hasAnyPermission(session, ["users:read", "roles:manage", "master-data:manage"]);
  const canOperate = hasAnyPermission(session, ["schedule:manage", "tasks:manage", "issues:manage"]);
  const canReport = hasAnyPermission(session, ["reports:read"]);
  const canAudit = hasAnyPermission(session, ["audit:read"]);

  return (
    <div className="content-grid">
      <section className="metric-row">
        <Metric
          icon={Users}
          label="Inspector aktif"
          value={textValue(summary.activeInspectorsToday ?? listItems(payload.users).length, "0")}
        />
        <Metric
          icon={AlertTriangle}
          label="Critical task"
          value={textValue(summary.openCriticalTasks ?? countRows(payload.tasks), "0")}
        />
        <Metric
          icon={ClipboardCheck}
          label="SOP unread"
          value={textValue(summary.sopUnreadCount ?? countRows(payload.sopReport), "0")}
        />
        <Metric
          icon={Bell}
          label="Notifikasi"
          value={textValue(countRows(payload.notifications), "0")}
        />
      </section>

      <section className="quick-actions">
        {canOperate && (
          <ActionButton icon={Activity} label="Command Center" onClick={() => onSwitchView("operations")} />
        )}
        {canReport && <ActionButton icon={FileText} label="Reports" onClick={() => onSwitchView("reports")} />}
        {canAdmin && <ActionButton icon={ShieldCheck} label="Admin" onClick={() => onSwitchView("admin")} />}
        {canAudit && <ActionButton icon={FileClock} label="Audit" onClick={() => onSwitchView("audit")} />}
      </section>

      <div className="two-column">
        <Panel
          emptyText="Belum ada task untuk ditampilkan."
          icon={ListChecks}
          rows={listItems(payload.tasks)}
          title="Task Prioritas"
        >
          <DataTable
            columns={[
              ["title", "Task"],
              ["priority", "Priority"],
              ["status", "Status"],
            ]}
            rows={listItems(payload.tasks)}
          />
        </Panel>
        <Panel
          emptyText="Belum ada audit terbaru."
          icon={FileClock}
          rows={listItems(payload.auditLogs)}
          title="Audit Terbaru"
        >
          <DataTable
            columns={[
              ["action", "Action"],
              ["entityType", "Entity"],
              ["createdAt", "Time"],
            ]}
            formatters={{ createdAt: dateValue }}
            rows={listItems(payload.auditLogs)}
          />
        </Panel>
      </div>
    </div>
  );
}

function AdminView({ payload, session }: { payload: ViewPayload; session: SessionData }) {
  if (!hasAnyPermission(session, ["users:read", "roles:manage", "master-data:manage"])) {
    return <PermissionState />;
  }

  return (
    <div className="content-grid">
      <section className="metric-row">
        <Metric icon={Users} label="Users" value={String(countRows(payload.users))} />
        <Metric icon={ShieldCheck} label="Roles" value={String(countRows(payload.roles))} />
        <Metric icon={Database} label="Sites" value={String(countRows(payload.sites))} />
        <Metric icon={Settings} label="Shifts" value={String(countRows(payload.shifts))} />
      </section>
      <div className="two-column">
        <Panel emptyText="User belum tersedia." icon={Users} rows={listItems(payload.users)} title="User">
          <DataTable
            columns={[
              ["user.name", "Name"],
              ["user.email", "Email"],
              ["user.role", "Role"],
              ["user.status", "Status"],
            ]}
            rows={listItems(payload.users)}
          />
        </Panel>
        <Panel emptyText="Master data site belum tersedia." icon={Database} rows={listItems(payload.sites)} title="Master Data">
          <DataTable
            columns={[
              ["name", "Name"],
              ["code", "Code"],
              ["status", "Status"],
            ]}
            rows={listItems(payload.sites)}
          />
        </Panel>
      </div>
      <Panel emptyText="Role belum tersedia." icon={ShieldCheck} rows={listItems(payload.roles)} title="Role Permission">
        <DataTable
          columns={[
            ["role.name", "Role"],
            ["role.description", "Description"],
            ["permissions", "Permissions"],
          ]}
          formatters={{
            permissions: (value) => (Array.isArray(value) ? `${value.length} permissions` : "-"),
          }}
          rows={listItems(payload.roles)}
        />
      </Panel>
    </div>
  );
}

function OperationsView({ payload, session }: { payload: ViewPayload; session: SessionData }) {
  if (!hasAnyPermission(session, ["schedule:manage", "tasks:manage", "handover:manage", "issues:manage"])) {
    return <PermissionState />;
  }

  return (
    <div className="content-grid">
      <section className="metric-row">
        <Metric icon={Layers3} label="Assignment" value={String(countRows(payload.assignments))} />
        <Metric icon={ListChecks} label="Tasks" value={String(countRows(payload.tasks))} />
        <Metric icon={AlertTriangle} label="Issues" value={String(countRows(payload.issues))} />
        <Metric icon={Archive} label="Handover" value={String(countRows(payload.handovers))} />
      </section>
      <div className="two-column">
        <Panel emptyText="Belum ada assignment hari ini." icon={Layers3} rows={listItems(payload.assignments)} title="Shift Planner">
          <DataTable
            columns={[
              ["assignment.workDate", "Date"],
              ["inspector.name", "Inspector"],
              ["area.name", "Area"],
              ["assignment.assignmentStatus", "Status"],
            ]}
            rows={listItems(payload.assignments)}
          />
        </Panel>
        <Panel emptyText="Belum ada task." icon={ListChecks} rows={listItems(payload.tasks)} title="Tasks & Priority">
          <DataTable
            columns={[
              ["task.title", "Task"],
              ["task.priority", "Priority"],
              ["task.status", "Status"],
              ["area.name", "Area"],
            ]}
            rows={listItems(payload.tasks)}
          />
        </Panel>
      </div>
      <div className="two-column">
        <Panel emptyText="Belum ada issue." icon={AlertTriangle} rows={listItems(payload.issues)} title="Issue Monitoring">
          <DataTable
            columns={[
              ["issue.title", "Issue"],
              ["issue.severity", "Severity"],
              ["issue.status", "Status"],
              ["area.name", "Area"],
            ]}
            rows={listItems(payload.issues)}
          />
        </Panel>
        <Panel emptyText="Belum ada handover." icon={Archive} rows={listItems(payload.handovers)} title="Handover Board">
          <DataTable
            columns={[
              ["handover.status", "Status"],
              ["area.name", "Area"],
              ["handover.submittedAt", "Submitted"],
            ]}
            formatters={{ "handover.submittedAt": dateValue }}
            rows={listItems(payload.handovers)}
          />
        </Panel>
      </div>
    </div>
  );
}

function ReportsView({ payload, session }: { payload: ViewPayload; session: SessionData }) {
  if (!session.permissions.includes("reports:read")) return <PermissionState />;
  const summary = asObject(payload.summary);
  const issueSeverity = asObject(summary.issueSeverity);
  const taskCompletion = asObject(summary.taskCompletion);

  return (
    <div className="content-grid">
      <section className="metric-row">
        <Metric icon={Users} label="Inspector aktif" value={textValue(summary.activeInspectorsToday, "0")} />
        <Metric icon={AlertTriangle} label="Critical task" value={textValue(summary.openCriticalTasks, "0")} />
        <Metric icon={ClipboardCheck} label="SOP unread" value={textValue(summary.sopUnreadCount, "0")} />
        <Metric icon={Gauge} label="Task total" value={textValue(taskCompletion.total, "0")} />
      </section>
      <div className="two-column">
        <Panel emptyText="Belum ada task report." icon={FileText} rows={listItems(payload.taskReport)} title="Task Completion">
          <DataTable
            columns={[
              ["task.title", "Task"],
              ["task.status", "Status"],
              ["task.priority", "Priority"],
              ["area.name", "Area"],
            ]}
            rows={listItems(payload.taskReport)}
          />
        </Panel>
        <Panel emptyText="Belum ada SOP report." icon={ClipboardCheck} rows={listItems(payload.sopReport)} title="SOP Compliance">
          <DataTable
            columns={[
              ["procedure.title", "SOP"],
              ["version.versionNumber", "Version"],
              ["metrics.complianceRate", "Rate"],
              ["metrics.pendingCount", "Pending"],
            ]}
            rows={listItems(payload.sopReport)}
          />
        </Panel>
      </div>
      <Panel emptyText="Issue summary belum tersedia." icon={AlertTriangle} rows={Object.entries(issueSeverity)} title="Issue Severity">
        <KeyValueGrid value={issueSeverity} />
      </Panel>
    </div>
  );
}

function AuditView({ payload, session }: { payload: ViewPayload; session: SessionData }) {
  if (!session.permissions.includes("audit:read")) return <PermissionState />;

  return (
    <div className="content-grid">
      <div className="two-column">
        <Panel emptyText="Audit log belum tersedia." icon={FileClock} rows={listItems(payload.auditLogs)} title="Audit Trail">
          <DataTable
            columns={[
              ["action", "Action"],
              ["actorRole", "Role"],
              ["entityType", "Entity"],
              ["createdAt", "Time"],
            ]}
            formatters={{ createdAt: dateValue }}
            rows={listItems(payload.auditLogs)}
          />
        </Panel>
        <Panel
          emptyText="SOP acknowledgement belum tersedia."
          icon={ClipboardCheck}
          rows={listItems(payload.sopAcknowledgements)}
          title="SOP Acknowledgement"
        >
          <DataTable
            columns={[
              ["procedure.title", "SOP"],
              ["user.name", "User"],
              ["status", "Status"],
              ["acknowledgedAt", "Time"],
            ]}
            formatters={{ acknowledgedAt: dateValue }}
            rows={listItems(payload.sopAcknowledgements)}
          />
        </Panel>
      </div>
    </div>
  );
}

function FilterBar({
  auditAction,
  sopAckStatus,
  onAuditActionChange,
  onSopAckStatusChange,
  onApply,
}: {
  auditAction: string;
  sopAckStatus: string;
  onAuditActionChange: (value: string) => void;
  onSopAckStatusChange: (value: string) => void;
  onApply: () => void;
}) {
  return (
    <section className="filter-bar">
      <label>
        <Search aria-hidden size={16} />
        <input
          onChange={(event) => onAuditActionChange(event.target.value)}
          placeholder="Filter audit action"
          value={auditAction}
        />
      </label>
      <label>
        <SlidersHorizontal aria-hidden size={16} />
        <select onChange={(event) => onSopAckStatusChange(event.target.value)} value={sopAckStatus}>
          <option value="">All SOP status</option>
          <option value="pending">Pending</option>
          <option value="read">Read</option>
          <option value="understood">Understood</option>
          <option value="critical_confirmed">Critical confirmed</option>
        </select>
      </label>
      <button className="utility-button" onClick={onApply} type="button">
        <RefreshCcw aria-hidden size={16} />
        <span>Apply</span>
      </button>
    </section>
  );
}

function Metric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <article className="metric">
      <Icon aria-hidden size={18} />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function ActionButton({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button className="action-button" onClick={onClick} type="button">
      <Icon aria-hidden size={18} />
      <span>{label}</span>
    </button>
  );
}

function Panel({
  children,
  emptyText,
  icon: Icon,
  rows,
  title,
}: {
  children: ReactNode;
  emptyText: string;
  icon: LucideIcon;
  rows: unknown[];
  title: string;
}) {
  return (
    <section className="panel">
      <header className="panel-header">
        <div>
          <Icon aria-hidden size={18} />
          <h2>{title}</h2>
        </div>
        <span>{rows.length}</span>
      </header>
      {rows.length === 0 ? <StateMessage tone="muted" text={emptyText} /> : children}
    </section>
  );
}

function DataTable({
  columns,
  rows,
  formatters,
}: {
  columns: Array<[string, string]>;
  rows: Record<string, unknown>[];
  formatters?: Record<string, (value: unknown) => string>;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map(([, label]) => (
              <th key={label}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={String(row.id ?? index)}>
              {columns.map(([path, label]) => {
                const value = getPath(row, path);
                return <td key={`${label}-${path}`}>{formatters?.[path]?.(value) ?? textValue(value)}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KeyValueGrid({ value }: { value: Record<string, unknown> }) {
  const items = Object.entries(value);
  if (items.length === 0) return <StateMessage tone="muted" text="Belum ada data." />;
  return (
    <div className="key-grid">
      {items.map(([key, item]) => (
        <div key={key}>
          <span>{key}</span>
          <strong>{textValue(item)}</strong>
        </div>
      ))}
    </div>
  );
}

function StateMessage({ text, tone }: { text: string; tone: "danger" | "muted" }) {
  return (
    <div className={`state-message ${tone}`}>
      {tone === "danger" ? <AlertTriangle aria-hidden size={18} /> : <Lock aria-hidden size={18} />}
      <span>{text}</span>
    </div>
  );
}

function PermissionState() {
  return <StateMessage tone="danger" text="Role kamu tidak memiliki akses untuk halaman ini." />;
}

function SkeletonGrid() {
  return (
    <div className="content-grid">
      <section className="metric-row">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="skeleton metric" key={index} />
        ))}
      </section>
      <div className="two-column">
        <div className="skeleton panel" />
        <div className="skeleton panel" />
      </div>
    </div>
  );
}

function countRows(value?: ApiList) {
  return listItems(value).length;
}

function getPath(row: Record<string, unknown>, path: string) {
  return path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, row);
}
