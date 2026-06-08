"use client";

import Image from "next/image";
import {
  Activity,
  AlertTriangle,
  Archive,
  Bell,
  CheckCircle,
  ClipboardCheck,
  Database,
  Edit3,
  FileClock,
  FileText,
  Gauge,
  Layers3,
  ListChecks,
  Lock,
  LogIn,
  LogOut,
  Moon,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Send,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const APP_NAME = "Cladtek Quality Inspector";
const APP_SHORT_NAME = "Cladtek QI";

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
  permissions?: ApiList;
  sites?: ApiList;
  departments?: ApiList;
  areas?: ApiList;
  shifts?: ApiList;
  systemSettings?: ApiList;
  assignments?: ApiList;
  tasks?: ApiList;
  issues?: ApiList;
  handovers?: ApiList;
  notifications?: ApiList;
  procedures?: ApiList;
  skillMatrix?: ApiList;
  shiftReport?: ApiList;
  taskReport?: ApiList;
  sopReport?: ApiList;
  skillGapReport?: ApiList;
  auditLogs?: ApiList;
  sopAcknowledgements?: ApiList;
};

type ToastState = {
  tone: "success" | "warning" | "danger" | "info";
  text: string;
};

type Notify = (toast: ToastState) => void;

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
  const [toast, setToast] = useState<ToastState | null>(null);

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
      const sessionProbe = await apiRequest<{ authenticated: boolean }>("/api/auth/session");
      if (!sessionProbe.authenticated) {
        setSessionState({ status: "idle" });
        return;
      }
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
      <aside className="sidebar" aria-label={`Navigasi ${APP_NAME}`}>
        <BrandBlock subtitle="Operation Web" />

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
              notify={notify}
              onRefresh={loadView}
              payload={payload}
              session={session}
              onSwitchView={setActiveView}
            />
          )}
        </ViewStateFrame>
        {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
      </section>
    </main>
  );

  function notify(nextToast: ToastState) {
    setToast(nextToast);
    window.setTimeout(() => setToast(null), 4200);
  }

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
      users: can("users:read") ? await maybe(apiRequest<ApiList>("/api/users?limit=25")) : undefined,
      roles: can("roles:manage") ? await maybe(apiRequest<ApiList>("/api/roles")) : undefined,
      permissions: can("roles:manage") ? await maybe(apiRequest<ApiList>("/api/permissions?limit=100")) : undefined,
      sites: can("master-data:manage") ? await maybe(apiRequest<ApiList>("/api/sites?limit=25")) : undefined,
      departments: can("master-data:manage")
        ? await maybe(apiRequest<ApiList>("/api/departments?limit=25"))
        : undefined,
      areas: can("auth:session:read") ? await maybe(apiRequest<ApiList>("/api/areas?limit=25")) : undefined,
      shifts: can("auth:session:read") ? await maybe(apiRequest<ApiList>("/api/shifts?limit=25")) : undefined,
      systemSettings: can("master-data:manage") ? await maybe(apiRequest<ApiList>("/api/system-settings")) : undefined,
    };
  }

  if (view === "operations") {
    return {
      users: can("users:read") ? await maybe(apiRequest<ApiList>("/api/users?role=inspector&status=active&limit=50")) : undefined,
      areas: can("auth:session:read") ? await maybe(apiRequest<ApiList>("/api/areas?status=active&limit=50")) : undefined,
      shifts: can("auth:session:read") ? await maybe(apiRequest<ApiList>("/api/shifts?status=active&limit=20")) : undefined,
      assignments: can("schedule:manage")
        ? await maybe(apiRequest<ApiList>(`/api/shift-assignments?workDate=${today()}&limit=${commonLimit}`))
        : undefined,
      tasks: can("tasks:manage") ? await maybe(apiRequest<ApiList>(`/api/tasks?limit=${commonLimit}`)) : undefined,
      issues: can("issues:manage") ? await maybe(apiRequest<ApiList>(`/api/issues?limit=${commonLimit}`)) : undefined,
      handovers: can("handover:manage") ? await maybe(apiRequest<ApiList>(`/api/handovers?limit=${commonLimit}`)) : undefined,
      notifications: can("notifications:read")
        ? await maybe(apiRequest<ApiList>(`/api/notifications?limit=${commonLimit}`))
        : undefined,
      procedures: can("sop:manage") ? await maybe(apiRequest<ApiList>("/api/procedures?limit=20")) : undefined,
      skillMatrix: can("skill-matrix:manage") ? await maybe(apiRequest<ApiList>("/api/skill-matrix?limit=20")) : undefined,
    };
  }

  if (view === "reports") {
    return {
      summary: can("reports:read") ? await maybe(apiRequest<Record<string, unknown>>("/api/reports/dashboard-summary")) : undefined,
      shiftReport: can("reports:read")
        ? await maybe(apiRequest<ApiList>(`/api/reports/shift-completion?limit=${commonLimit}`))
        : undefined,
      taskReport: can("reports:read")
        ? await maybe(apiRequest<ApiList>(`/api/reports/task-completion?limit=${commonLimit}`))
        : undefined,
      sopReport: can("reports:read")
        ? await maybe(apiRequest<ApiList>(`/api/reports/sop-compliance?limit=${commonLimit}`))
        : undefined,
      issues: can("reports:read")
        ? await maybe(apiRequest<ApiList>(`/api/reports/issues?limit=${commonLimit}`))
        : undefined,
      skillGapReport: can("reports:read")
        ? await maybe(apiRequest<ApiList>(`/api/reports/skill-gap?limit=${commonLimit}`))
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
        <BrandBlock subtitle="Quality Operation" />
        <h1>{APP_NAME}</h1>
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
      <BrandBlock subtitle="Loading session" />
    </main>
  );
}

function BrandBlock({ subtitle }: { subtitle: string }) {
  return (
    <div className="brand-block">
      <div className="brand-logo-frame">
        <Image
          alt="Cladtek"
          className="brand-logo"
          height={40}
          priority
          src="/brand/cladtek-logo.png"
          unoptimized
          width={160}
        />
      </div>
      <div>
        <strong>{APP_SHORT_NAME}</strong>
        <span>{subtitle}</span>
      </div>
    </div>
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
  notify,
  onRefresh,
  payload,
  session,
  onSwitchView,
}: {
  activeView: ViewKey;
  notify: Notify;
  onRefresh: () => Promise<void>;
  payload: ViewPayload;
  session: SessionData;
  onSwitchView: (view: ViewKey) => void;
}) {
  if (activeView === "admin") {
    return <AdminView notify={notify} onRefresh={onRefresh} payload={payload} session={session} />;
  }
  if (activeView === "operations") {
    return <OperationsView notify={notify} onRefresh={onRefresh} payload={payload} session={session} />;
  }
  if (activeView === "reports") {
    return <ReportsView notify={notify} onRefresh={onRefresh} payload={payload} session={session} />;
  }
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

function AdminView({
  notify,
  onRefresh,
  payload,
  session,
}: {
  notify: Notify;
  onRefresh: () => Promise<void>;
  payload: ViewPayload;
  session: SessionData;
}) {
  if (!hasAnyPermission(session, ["users:read", "roles:manage", "master-data:manage"])) {
    return <PermissionState />;
  }

  return (
    <div className="content-grid">
      <section className="metric-row">
        <Metric icon={Users} label="Users" value={String(countRows(payload.users))} />
        <Metric icon={ShieldCheck} label="Roles" value={String(countRows(payload.roles))} />
        <Metric icon={Database} label="Sites" value={String(countRows(payload.sites))} />
        <Metric icon={Layers3} label="Areas" value={String(countRows(payload.areas))} />
      </section>
      <AdminActionCenter notify={notify} onRefresh={onRefresh} payload={payload} session={session} />
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
      <div className="two-column">
        <Panel emptyText="Area belum tersedia." icon={Layers3} rows={listItems(payload.areas)} title="Areas">
          <DataTable
            columns={[
              ["name", "Area"],
              ["code", "Code"],
              ["minimumSkillLevel", "Min Skill"],
              ["status", "Status"],
            ]}
            rows={listItems(payload.areas)}
          />
        </Panel>
        <Panel emptyText="Shift belum tersedia." icon={Settings} rows={listItems(payload.shifts)} title="Shifts">
          <DataTable
            columns={[
              ["name", "Shift"],
              ["startTime", "Start"],
              ["endTime", "End"],
              ["status", "Status"],
            ]}
            rows={listItems(payload.shifts)}
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

function OperationsView({
  notify,
  onRefresh,
  payload,
  session,
}: {
  notify: Notify;
  onRefresh: () => Promise<void>;
  payload: ViewPayload;
  session: SessionData;
}) {
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
      <OperationsActionCenter notify={notify} onRefresh={onRefresh} payload={payload} session={session} />
      <div className="two-column">
        <ShiftCalendarPanel assignments={listItems(payload.assignments)} />
        {session.permissions.includes("tasks:manage") ? (
          <TaskPriorityBoard notify={notify} onRefresh={onRefresh} tasks={listItems(payload.tasks)} />
        ) : (
          <Panel emptyText="Role ini tidak memiliki akses update priority." icon={Lock} rows={[]} title="Priority Board">
            <PermissionState />
          </Panel>
        )}
      </div>
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

function ShiftCalendarPanel({ assignments }: { assignments: Record<string, unknown>[] }) {
  const calendarDate = new Date();
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const monthStart = new Date(year, month, 1);
  const firstDayOffset = monthStart.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const assignmentCountByDate = assignments.reduce<Record<string, number>>((acc, row) => {
    const date = textValue(getPath(row, "assignment.workDate"), "");
    if (date) acc[date] = (acc[date] ?? 0) + 1;
    return acc;
  }, {});
  const cells = [
    ...Array.from({ length: firstDayOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  return (
    <Panel emptyText="Belum ada assignment pada kalender." icon={Layers3} rows={assignments} title="Calendar View">
      <div className="schedule-calendar" aria-label="Shift assignment calendar">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
          <span className="calendar-weekday" key={label}>{label}</span>
        ))}
        {cells.map((day, index) => {
          if (!day) return <span aria-hidden className="calendar-day muted" key={`empty-${index}`} />;
          const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const count = assignmentCountByDate[dateKey] ?? 0;
          return (
            <span className={count > 0 ? "calendar-day active" : "calendar-day"} key={dateKey}>
              <strong>{day}</strong>
              {count > 0 && <em>{count} shift</em>}
            </span>
          );
        })}
      </div>
    </Panel>
  );
}

function TaskPriorityBoard({
  notify,
  onRefresh,
  tasks,
}: {
  notify: Notify;
  onRefresh: () => Promise<void>;
  tasks: Record<string, unknown>[];
}) {
  const [items, setItems] = useState(tasks);
  const [reason, setReason] = useState("");
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => setItems(tasks), 0);
    return () => window.clearTimeout(timeout);
  }, [tasks]);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    if (!reason.trim()) {
      notify({ tone: "warning", text: "Isi reason sebelum mengubah prioritas via drag-and-drop." });
      return;
    }

    const oldIndex = items.findIndex((item) => String(getPath(item, "task.id")) === String(active.id));
    const newIndex = items.findIndex((item) => String(getPath(item, "task.id")) === String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    const nextItems = arrayMove(items, oldIndex, newIndex);
    setItems(nextItems);
    const movedTask = nextItems[newIndex];
    const taskId = String(getPath(movedTask, "task.id"));
    const priority = priorityForBoardIndex(newIndex);

    await runAction(notify, onRefresh, () =>
      apiRequest(`/api/tasks/${taskId}/priority`, {
        method: "PATCH",
        body: JSON.stringify({
          priority,
          reason,
        }),
      }),
    );
  }

  return (
    <Panel emptyText="Belum ada task untuk priority board." icon={ListChecks} rows={items} title="Drag Priority Board">
      <TextField label="Reason for priority changes" onChange={setReason} required value={reason} />
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd} sensors={sensors}>
        <SortableContext
          items={items.map((item) => String(getPath(item, "task.id")))}
          strategy={verticalListSortingStrategy}
        >
          <div className="priority-board">
            {items.map((task, index) => (
              <SortableTaskItem
                index={index}
                key={String(getPath(task, "task.id"))}
                task={task}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <p className="form-hint">Drop position maps priority automatically: top critical, then high, medium, low.</p>
    </Panel>
  );
}

function SortableTaskItem({ index, task }: { index: number; task: Record<string, unknown> }) {
  const id = String(getPath(task, "task.id"));
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const priority = textValue(getPath(task, "task.priority"));
  const nextPriority = priorityForBoardIndex(index);
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article className="priority-item" ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <div>
        <strong>{textValue(getPath(task, "task.title"))}</strong>
        <span>{textValue(getPath(task, "area.name"))} · {textValue(getPath(task, "task.status"))}</span>
      </div>
      <em>{priority} → {nextPriority}</em>
    </article>
  );
}

function priorityForBoardIndex(index: number) {
  if (index === 0) return "critical";
  if (index <= 2) return "high";
  if (index <= 5) return "medium";
  return "low";
}

function ReportsView({
  notify,
  onRefresh,
  payload,
  session,
}: {
  notify: Notify;
  onRefresh: () => Promise<void>;
  payload: ViewPayload;
  session: SessionData;
}) {
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
      <ReportCharts issueSeverity={issueSeverity} taskCompletion={taskCompletion} />
      <ReportsActionCenter notify={notify} onRefresh={onRefresh} payload={payload} session={session} />
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
      <div className="two-column">
        <Panel emptyText="Belum ada shift report." icon={Layers3} rows={listItems(payload.shiftReport)} title="Shift Completion">
          <DataTable
            columns={[
              ["assignment.workDate", "Date"],
              ["inspector.name", "Inspector"],
              ["area.name", "Area"],
              ["metrics.completionRate", "Rate"],
            ]}
            rows={listItems(payload.shiftReport)}
          />
        </Panel>
        <Panel emptyText="Belum ada skill gap." icon={ShieldCheck} rows={listItems(payload.skillGapReport)} title="Skill Gap">
          <DataTable
            columns={[
              ["inspector.email", "Inspector"],
              ["area.name", "Area"],
              ["skill.skillLevel", "Skill"],
              ["area.minimumSkillLevel", "Required"],
            ]}
            rows={listItems(payload.skillGapReport)}
          />
        </Panel>
      </div>
    </div>
  );
}

function ReportCharts({
  issueSeverity,
  taskCompletion,
}: {
  issueSeverity: Record<string, unknown>;
  taskCompletion: Record<string, unknown>;
}) {
  const byStatus = asObject(taskCompletion.byStatus);
  const taskData = Object.entries(byStatus).map(([name, value]) => ({
    name,
    value: Number(value) || 0,
  }));
  const issueData = Object.entries(issueSeverity).map(([name, value]) => ({
    name,
    value: Number(value) || 0,
  }));

  return (
    <div className="two-column">
      <section className="panel chart-panel">
        <header className="panel-header">
          <div>
            <Gauge aria-hidden size={18} />
            <h2>Task Completion Chart</h2>
          </div>
          <span>{taskData.length}</span>
        </header>
        {taskData.length === 0 ? (
          <StateMessage tone="muted" text="Chart task belum punya data." />
        ) : (
          <ResponsiveContainer height={260} width="100%">
            <BarChart data={taskData}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "#aab5a3", fontSize: 11 }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: "#aab5a3", fontSize: 11 }} tickLine={false} />
              <Tooltip contentStyle={{ background: "#181b16", border: "1px solid #30362e", borderRadius: 8 }} />
              <Legend />
              <Bar dataKey="value" fill="#5fc7a5" name="Tasks" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>
      <section className="panel chart-panel">
        <header className="panel-header">
          <div>
            <AlertTriangle aria-hidden size={18} />
            <h2>Issue Severity Chart</h2>
          </div>
          <span>{issueData.length}</span>
        </header>
        {issueData.length === 0 ? (
          <StateMessage tone="muted" text="Chart issue belum punya data." />
        ) : (
          <ResponsiveContainer height={260} width="100%">
            <BarChart data={issueData}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "#aab5a3", fontSize: 11 }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: "#aab5a3", fontSize: 11 }} tickLine={false} />
              <Tooltip contentStyle={{ background: "#181b16", border: "1px solid #30362e", borderRadius: 8 }} />
              <Legend />
              <Bar dataKey="value" fill="#d7b76a" name="Issues" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>
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

function AdminActionCenter({
  notify,
  onRefresh,
  payload,
  session,
}: {
  notify: Notify;
  onRefresh: () => Promise<void>;
  payload: ViewPayload;
  session: SessionData;
}) {
  return (
    <section className="action-grid-panels">
      {session.permissions.includes("users:write") && (
        <>
          <CreateUserForm notify={notify} onRefresh={onRefresh} />
          <UpdateUserForm notify={notify} onRefresh={onRefresh} users={listItems(payload.users)} />
        </>
      )}
      {session.permissions.includes("roles:manage") && (
        <RolePermissionForm
          notify={notify}
          onRefresh={onRefresh}
          permissions={listItems(payload.permissions)}
          roles={listItems(payload.roles)}
        />
      )}
      {session.permissions.includes("master-data:manage") && (
        <>
          <MasterDataForm notify={notify} onRefresh={onRefresh} payload={payload} />
          <SystemSettingForm
            notify={notify}
            onRefresh={onRefresh}
            settings={listItems(payload.systemSettings)}
          />
        </>
      )}
    </section>
  );
}

function OperationsActionCenter({
  notify,
  onRefresh,
  payload,
  session,
}: {
  notify: Notify;
  onRefresh: () => Promise<void>;
  payload: ViewPayload;
  session: SessionData;
}) {
  return (
    <section className="action-grid-panels">
      {session.permissions.includes("schedule:manage") && (
        <>
          <AssignmentForm notify={notify} onRefresh={onRefresh} payload={payload} />
          <SchedulePublishForm notify={notify} onRefresh={onRefresh} payload={payload} />
        </>
      )}
      {session.permissions.includes("tasks:manage") && (
        <TaskActionForm notify={notify} onRefresh={onRefresh} payload={payload} />
      )}
      {session.permissions.includes("sop:manage") && (
        <SopActionForm notify={notify} onRefresh={onRefresh} payload={payload} />
      )}
      {session.permissions.includes("skill-matrix:manage") && (
        <SkillMatrixForm notify={notify} onRefresh={onRefresh} payload={payload} />
      )}
      {session.permissions.includes("issues:manage") && (
        <IssueActionForm notify={notify} onRefresh={onRefresh} payload={payload} />
      )}
    </section>
  );
}

function ReportsActionCenter({
  notify,
  onRefresh,
  session,
}: {
  notify: Notify;
  onRefresh: () => Promise<void>;
  payload: ViewPayload;
  session: SessionData;
}) {
  const [reportType, setReportType] = useState("task-completion");
  const [format, setFormat] = useState("csv");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [reason, setReason] = useState("");
  const [exportPreview, setExportPreview] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");

  if (!session.permissions.includes("reports:export")) {
    return <StateMessage tone="muted" text="Role ini hanya dapat membaca report. Export disembunyikan oleh permission." />;
  }

  return (
    <ActionCard icon={FileText} title="Export Report">
      <div className="form-row">
        <SelectField
          label="Report"
          onChange={setReportType}
          options={[
            ["shift-completion", "Shift Completion"],
            ["task-completion", "Task Completion"],
            ["sop-compliance", "SOP Compliance"],
            ["skill-gap", "Skill Gap"],
            ["issues", "Issues"],
          ]}
          value={reportType}
        />
        <SelectField
          label="Format"
          onChange={setFormat}
          options={[
            ["csv", "CSV"],
            ["json", "JSON"],
          ]}
          value={format}
        />
      </div>
      <div className="form-row">
        <TextField label="Date from" onChange={setDateFrom} type="date" value={dateFrom} />
        <TextField label="Date to" onChange={setDateTo} type="date" value={dateTo} />
      </div>
      <TextField label="Reason" onChange={setReason} required value={reason} />
      <ConfirmActionButton
        icon={Send}
        label="Export"
        message="Export report akan dibuat sebagai background job lokal dan dicatat di audit log."
        onConfirm={() =>
          runAction(notify, onRefresh, async () => {
            const data = await apiRequest<{
              job: {
                id: string;
                status: string;
                result?: { content?: string; rowCount?: number; downloadUrl?: string };
              };
            }>("/api/reports/export-jobs", {
              method: "POST",
              body: JSON.stringify({
                reportType,
                format,
                filters: {
                  dateFrom: dateFrom || undefined,
                  dateTo: dateTo || undefined,
                },
                reason,
              }),
            });
            const content = data.job.result?.content ?? "";
            setExportPreview(content.slice(0, 800));
            setDownloadUrl(data.job.result?.downloadUrl ?? "");
            return `Export job ${data.job.id} ${data.job.status}: ${data.job.result?.rowCount ?? 0} rows.`;
          })
        }
      />
      {downloadUrl && (
        <a className="utility-button" href={downloadUrl}>
          Download export
        </a>
      )}
      {exportPreview && <pre className="export-preview">{exportPreview}</pre>}
    </ActionCard>
  );
}

function CreateUserForm({ notify, onRefresh }: { notify: Notify; onRefresh: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("QimsDemo123!");
  const [employeeId, setEmployeeId] = useState("");
  const [role, setRole] = useState<UserRole>("inspector");
  const [status, setStatus] = useState("active");
  const [reason, setReason] = useState("");

  return (
    <ActionCard icon={Plus} title="Create User">
      <div className="form-row">
        <TextField label="Name" onChange={setName} required value={name} />
        <TextField label="Email" onChange={setEmail} required type="email" value={email} />
      </div>
      <div className="form-row">
        <TextField label="Password" onChange={setPassword} required type="password" value={password} />
        <TextField label="Employee ID" onChange={setEmployeeId} value={employeeId} />
      </div>
      <div className="form-row">
        <RoleSelect value={role} onChange={setRole} />
        <StatusSelect value={status} onChange={setStatus} values={["active", "inactive", "suspended"]} />
      </div>
      <TextField label="Reason" onChange={setReason} required value={reason} />
      <ConfirmActionButton
        icon={Save}
        label="Create"
        message="User baru akan dibuat dan dicatat di audit log."
        onConfirm={() =>
          runAction(notify, onRefresh, () =>
            apiRequest("/api/users", {
              method: "POST",
              body: JSON.stringify({
                name,
                email,
                password,
                employeeId: employeeId || null,
                role,
                status,
                reason,
              }),
            }),
          )
        }
      />
    </ActionCard>
  );
}

function UpdateUserForm({
  notify,
  onRefresh,
  users,
}: {
  notify: Notify;
  onRefresh: () => Promise<void>;
  users: Record<string, unknown>[];
}) {
  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [role, setRole] = useState<UserRole>("inspector");
  const [status, setStatus] = useState("active");
  const [reason, setReason] = useState("");
  const options = selectOptions(users, "user.id", "user.email");

  return (
    <ActionCard icon={Edit3} title="Edit User Status/Role">
      <SelectField label="User" onChange={setUserId} options={options} value={userId} />
      <div className="form-row">
        <TextField label="Name" onChange={setName} value={name} />
        <TextField label="Employee ID" onChange={setEmployeeId} value={employeeId} />
      </div>
      <div className="form-row">
        <RoleSelect value={role} onChange={setRole} />
        <StatusSelect value={status} onChange={setStatus} values={["active", "inactive", "suspended"]} />
      </div>
      <TextField label="Reason" onChange={setReason} required value={reason} />
      <ConfirmActionButton
        icon={Save}
        label="Update"
        message="Perubahan user, role, atau status akan dicatat di audit log."
        onConfirm={() =>
          runAction(notify, onRefresh, () =>
            apiRequest(`/api/users/${userId}`, {
              method: "PATCH",
              body: JSON.stringify({
                ...(name ? { name } : {}),
                ...(employeeId ? { employeeId } : {}),
                role,
                status,
                reason,
              }),
            }),
          )
        }
      />
    </ActionCard>
  );
}

function RolePermissionForm({
  notify,
  onRefresh,
  permissions,
  roles,
}: {
  notify: Notify;
  onRefresh: () => Promise<void>;
  permissions: Record<string, unknown>[];
  roles: Record<string, unknown>[];
}) {
  const [role, setRole] = useState<UserRole>("auditor");
  const [permissionIds, setPermissionIds] = useState<string[]>(["auth:session:read"]);
  const [reason, setReason] = useState("");

  return (
    <ActionCard icon={ShieldCheck} title="Update Role Permissions">
      <RoleSelect value={role} onChange={setRole} />
      <label className="field">
        <span>Permissions</span>
        <select
          multiple
          onChange={(event) =>
            setPermissionIds([...event.currentTarget.selectedOptions].map((option) => option.value))
          }
          value={permissionIds}
        >
          {permissions.map((permission) => (
            <option key={String(permission.id)} value={String(permission.id)}>
              {String(permission.id)}
            </option>
          ))}
        </select>
      </label>
      <TextField label="Reason" onChange={setReason} required value={reason} />
      <p className="form-hint">Role loaded: {roles.length}. Minimal satu permission wajib dipilih.</p>
      <ConfirmActionButton
        icon={Save}
        label="Update permissions"
        message="Permission role akan diganti sesuai pilihan ini."
        onConfirm={() =>
          runAction(notify, onRefresh, () =>
            apiRequest(`/api/roles/${role}/permissions`, {
              method: "PATCH",
              body: JSON.stringify({ permissionIds, reason }),
            }),
          )
        }
      />
    </ActionCard>
  );
}

function MasterDataForm({
  notify,
  onRefresh,
  payload,
}: {
  notify: Notify;
  onRefresh: () => Promise<void>;
  payload: ViewPayload;
}) {
  const [kind, setKind] = useState("areas");
  const [recordId, setRecordId] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [siteId, setSiteId] = useState("");
  const [minimumSkillLevel, setMinimumSkillLevel] = useState("not_trained");
  const [startTime, setStartTime] = useState("07:00");
  const [endTime, setEndTime] = useState("19:00");
  const [timezone, setTimezone] = useState("Asia/Makassar");
  const [status, setStatus] = useState("active");
  const [reason, setReason] = useState("");
  const rows =
    kind === "sites"
      ? listItems(payload.sites)
      : kind === "departments"
        ? listItems(payload.departments)
        : kind === "shifts"
          ? listItems(payload.shifts)
          : listItems(payload.areas);
  const isUpdate = Boolean(recordId);

  return (
    <ActionCard icon={Database} title="Master Data Create/Edit">
      <div className="form-row">
        <SelectField
          label="Type"
          onChange={(value) => {
            setKind(value);
            setRecordId("");
          }}
          options={[
            ["areas", "Areas"],
            ["sites", "Sites"],
            ["departments", "Departments"],
            ["shifts", "Shifts"],
          ]}
          value={kind}
        />
        <SelectField
          label="Existing record"
          onChange={setRecordId}
          options={[["", "Create new"], ...selectOptions(rows, "id", "name")]}
          value={recordId}
        />
      </div>
      <div className="form-row">
        <TextField label="Code/Name ID" onChange={setCode} required={!isUpdate && kind !== "shifts"} value={code} />
        <TextField label="Name" onChange={setName} required={!isUpdate} value={name} />
      </div>
      {kind === "areas" && (
        <div className="form-row">
          <SelectField
            label="Site"
            onChange={setSiteId}
            options={[["", "No site"], ...selectOptions(listItems(payload.sites), "id", "name")]}
            value={siteId}
          />
          <SelectField
            label="Minimum skill"
            onChange={setMinimumSkillLevel}
            options={skillOptions()}
            value={minimumSkillLevel}
          />
        </div>
      )}
      {kind === "shifts" && (
        <div className="form-row">
          <TextField label="Start" onChange={setStartTime} type="time" value={startTime} />
          <TextField label="End" onChange={setEndTime} type="time" value={endTime} />
          <TextField label="Timezone" onChange={setTimezone} value={timezone} />
        </div>
      )}
      <div className="form-row">
        <StatusSelect value={status} onChange={setStatus} values={["active", "inactive", "archived"]} />
        <TextField label="Reason" onChange={setReason} required value={reason} />
      </div>
      <TextAreaField label="Description" onChange={setDescription} value={description} />
      <ConfirmActionButton
        icon={Save}
        label={isUpdate ? "Update" : "Create"}
        message="Perubahan master data akan dicatat di audit log."
        onConfirm={() =>
          runAction(notify, onRefresh, () => {
            const body =
              kind === "shifts"
                ? { name, startTime, endTime, timezone, status, reason }
                : kind === "areas"
                  ? {
                      code,
                      name,
                      description: description || null,
                      siteId: siteId || null,
                      minimumSkillLevel,
                      status,
                      reason,
                    }
                  : { code, name, description: description || null, status, reason };
            return apiRequest(`/api/${kind}${isUpdate ? `/${recordId}` : ""}`, {
              method: isUpdate ? "PATCH" : "POST",
              body: JSON.stringify(body),
            });
          })
        }
      />
    </ActionCard>
  );
}

function SystemSettingForm({
  notify,
  onRefresh,
  settings,
}: {
  notify: Notify;
  onRefresh: () => Promise<void>;
  settings: Record<string, unknown>[];
}) {
  const firstKey = String(settings[0]?.key ?? "system.defaults");
  const [key, setKey] = useState(firstKey);
  const [value, setValue] = useState('{"timezone":"Asia/Makassar","language":"id","ecoModeDefault":true}');
  const [reason, setReason] = useState("");

  return (
    <ActionCard icon={Settings} title="System Settings">
      <SelectField
        label="Existing key"
        onChange={setKey}
        options={settings.length ? selectOptions(settings, "key", "key") : [[firstKey, firstKey]]}
        value={key}
      />
      <TextAreaField label="JSON value" onChange={setValue} value={value} />
      <TextField label="Reason" onChange={setReason} required value={reason} />
      <ConfirmActionButton
        icon={Save}
        label="Save setting"
        message="System setting akan diubah untuk seluruh sistem."
        onConfirm={() =>
          runAction(notify, onRefresh, () =>
            apiRequest("/api/system-settings", {
              method: "PATCH",
              body: JSON.stringify({ key, value: JSON.parse(value) as Record<string, unknown>, reason }),
            }),
          )
        }
      />
    </ActionCard>
  );
}

function AssignmentForm({ notify, onRefresh, payload }: ActionFormProps) {
  const [userId, setUserId] = useState("");
  const [shiftId, setShiftId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [workDate, setWorkDate] = useState(today());
  const [changeReason, setChangeReason] = useState("");

  return (
    <ActionCard icon={Layers3} title="Create Assignment">
      <div className="form-row">
        <SelectField label="Inspector" onChange={setUserId} options={selectOptions(listItems(payload.users), "user.id", "user.email")} value={userId} />
        <SelectField label="Shift" onChange={setShiftId} options={selectOptions(listItems(payload.shifts), "id", "name")} value={shiftId} />
        <SelectField label="Area" onChange={setAreaId} options={selectOptions(listItems(payload.areas), "id", "name")} value={areaId} />
      </div>
      <div className="form-row">
        <TextField label="Work date" onChange={setWorkDate} type="date" value={workDate} />
        <TextField label="Reason" onChange={setChangeReason} required value={changeReason} />
      </div>
      <ConfirmActionButton
        icon={Save}
        label="Create assignment"
        message="Assignment draft akan dibuat dan conflict warning akan dihitung."
        onConfirm={() =>
          runAction(notify, onRefresh, () =>
            apiRequest("/api/shift-assignments", {
              method: "POST",
              body: JSON.stringify({ userId, shiftId, areaId, workDate, assignmentStatus: "draft", changeReason }),
            }),
          )
        }
      />
    </ActionCard>
  );
}

function SchedulePublishForm({ notify, onRefresh, payload }: ActionFormProps) {
  const [assignmentId, setAssignmentId] = useState("");
  const [workDate, setWorkDate] = useState(today());
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState(today());
  const [reason, setReason] = useState("");

  return (
    <ActionCard icon={Send} title="Publish / Duplicate Schedule">
      <SelectField
        label="Assignment"
        onChange={setAssignmentId}
        options={selectOptions(listItems(payload.assignments), "assignment.id", "inspector.name")}
        value={assignmentId}
      />
      <div className="form-row">
        <TextField label="Work date" onChange={setWorkDate} type="date" value={workDate} />
        <TextField label="Reason" onChange={setReason} required value={reason} />
      </div>
      <div className="button-row">
        <ConfirmActionButton
          icon={Send}
          label="Publish selected"
          message="Jadwal akan dipublish dan notifikasi dibuat untuk inspector."
          onConfirm={() =>
            runAction(notify, onRefresh, () =>
              apiRequest("/api/shift-assignments/publish", {
                method: "POST",
                body: JSON.stringify({ workDate, assignmentIds: assignmentId ? [assignmentId] : undefined, reason }),
              }),
            )
          }
        />
      </div>
      <div className="form-row">
        <TextField label="Duplicate from" onChange={setFromDate} type="date" value={fromDate} />
        <TextField label="Duplicate to" onChange={setToDate} type="date" value={toDate} />
      </div>
      <ConfirmActionButton
        icon={Archive}
        label="Duplicate"
        message="Assignment dari tanggal sumber akan disalin sebagai draft."
        onConfirm={() =>
          runAction(notify, onRefresh, () =>
            apiRequest("/api/shift-assignments/duplicate", {
              method: "POST",
              body: JSON.stringify({ fromDate, toDate, reason }),
            }),
          )
        }
      />
    </ActionCard>
  );
}

function TaskActionForm({ notify, onRefresh, payload }: ActionFormProps) {
  const [taskId, setTaskId] = useState("");
  const [title, setTitle] = useState("");
  const [areaId, setAreaId] = useState("");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [priority, setPriority] = useState("high");
  const [status, setStatus] = useState("assigned");
  const [reason, setReason] = useState("");

  return (
    <ActionCard icon={ListChecks} title="Task & Priority">
      <SelectField
        label="Existing task"
        onChange={setTaskId}
        options={[["", "Create new"], ...selectOptions(listItems(payload.tasks), "task.id", "task.title")]}
        value={taskId}
      />
      <div className="form-row">
        <TextField label="Title" onChange={setTitle} required={!taskId} value={title} />
        <SelectField label="Area" onChange={setAreaId} options={selectOptions(listItems(payload.areas), "id", "name")} value={areaId} />
      </div>
      <div className="form-row">
        <SelectField label="Inspector" onChange={setAssignedUserId} options={[["", "Unassigned"], ...selectOptions(listItems(payload.users), "user.id", "user.email")]} value={assignedUserId} />
        <SelectField label="Priority" onChange={setPriority} options={[["critical", "Critical"], ["high", "High"], ["medium", "Medium"], ["low", "Low"]]} value={priority} />
        <SelectField label="Status" onChange={setStatus} options={taskStatusOptions()} value={status} />
      </div>
      <TextField label="Reason" onChange={setReason} required value={reason} />
      <div className="button-row">
        <ConfirmActionButton
          icon={Save}
          label={taskId ? "Update task" : "Create task"}
          message="Task action akan dicatat sebagai task event dan audit log."
          onConfirm={() =>
            runAction(notify, onRefresh, () =>
              apiRequest(`/api/tasks${taskId ? `/${taskId}` : ""}`, {
                method: taskId ? "PATCH" : "POST",
                body: JSON.stringify({
                  title: title || undefined,
                  areaId,
                  assignedUserId: assignedUserId || null,
                  priority,
                  status,
                  checklist: [{ label: "Inspection checklist" }],
                  reason,
                }),
              }),
            )
          }
        />
        {taskId && (
          <ConfirmActionButton
            icon={AlertTriangle}
            label="Priority only"
            message="Perubahan priority akan mengirim notifikasi ke inspector terkait."
            onConfirm={() =>
              runAction(notify, onRefresh, () =>
                apiRequest(`/api/tasks/${taskId}/priority`, {
                  method: "PATCH",
                  body: JSON.stringify({ priority, reason }),
                }),
              )
            }
          />
        )}
      </div>
    </ActionCard>
  );
}

function SopActionForm({ notify, onRefresh, payload }: ActionFormProps) {
  const [procedureId, setProcedureId] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("general_announcement");
  const [content, setContent] = useState("");
  const [targetType, setTargetType] = useState("all_inspectors");
  const [targetId, setTargetId] = useState("");
  const [versionId, setVersionId] = useState("");
  const [isCritical, setIsCritical] = useState(false);
  const [reason, setReason] = useState("");

  return (
    <ActionCard icon={ClipboardCheck} title="SOP Management">
      <SelectField
        label="Procedure"
        onChange={setProcedureId}
        options={[["", "Create new"], ...selectOptions(listItems(payload.procedures), "id", "title")]}
        value={procedureId}
      />
      <div className="form-row">
        <TextField label="Title" onChange={setTitle} required={!procedureId} value={title} />
        <SelectField label="Category" onChange={setCategory} options={procedureCategoryOptions()} value={category} />
      </div>
      <TextAreaField label="Version content" onChange={setContent} value={content} />
      <div className="form-row">
        <SelectField label="Target" onChange={setTargetType} options={[["all_inspectors", "All inspectors"], ["area", "Area"], ["shift", "Shift"], ["skill_level", "Skill level"]]} value={targetType} />
        <TextField label="Target ID" onChange={setTargetId} value={targetId} />
      </div>
      <label className="checkbox-row">
        <input checked={isCritical} onChange={(event) => setIsCritical(event.target.checked)} type="checkbox" />
        <span>Critical SOP</span>
      </label>
      <TextField label="Reason" onChange={setReason} required value={reason} />
      <div className="button-row">
        <ConfirmActionButton
          icon={Save}
          label="Create procedure/version"
          message="Jika procedure belum dipilih, procedure baru akan dibuat lalu version dibuat."
          onConfirm={() =>
            runAction(notify, onRefresh, async () => {
              const procedure =
                procedureId ||
                ((await apiRequest<{ id: string }>("/api/procedures", {
                  method: "POST",
                  body: JSON.stringify({ title, category, status: "draft", reason }),
                })) as { id: string }).id;
              const version = await apiRequest<{ id: string }>(`/api/procedures/${procedure}/versions`, {
                method: "POST",
                body: JSON.stringify({
                  content,
                  isCritical,
                  targets: [{ targetType, targetId: targetId || null }],
                  reason,
                }),
              });
              setVersionId(version.id);
              return `SOP version dibuat: ${version.id}`;
            })
          }
        />
        <TextField label="Version ID to publish" onChange={setVersionId} value={versionId} />
        <ConfirmActionButton
          icon={Send}
          label="Publish version"
          message="Publish SOP akan membuat notifikasi untuk target audience."
          onConfirm={() =>
            runAction(notify, onRefresh, () =>
              apiRequest(`/api/procedure-versions/${versionId}/publish`, {
                method: "POST",
                body: JSON.stringify({ reason }),
              }),
            )
          }
        />
      </div>
    </ActionCard>
  );
}

function SkillMatrixForm({ notify, onRefresh, payload }: ActionFormProps) {
  const [userId, setUserId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [skillLevel, setSkillLevel] = useState("competent");
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");

  return (
    <ActionCard icon={ShieldCheck} title="Skill Matrix">
      <div className="form-row">
        <SelectField label="Inspector" onChange={setUserId} options={selectOptions(listItems(payload.users), "user.id", "user.email")} value={userId} />
        <SelectField label="Area" onChange={setAreaId} options={selectOptions(listItems(payload.areas), "id", "name")} value={areaId} />
        <SelectField label="Skill" onChange={setSkillLevel} options={skillOptions()} value={skillLevel} />
      </div>
      <TextField label="Notes" onChange={setNotes} value={notes} />
      <TextField label="Reason" onChange={setReason} required value={reason} />
      <ConfirmActionButton
        icon={Save}
        label="Upsert skill"
        message="Skill matrix akan dipakai untuk warning assignment."
        onConfirm={() =>
          runAction(notify, onRefresh, () =>
            apiRequest("/api/skill-matrix", {
              method: "POST",
              body: JSON.stringify({ userId, areaId, skillLevel, notes: notes || null, reason }),
            }),
          )
        }
      />
    </ActionCard>
  );
}

function IssueActionForm({ notify, onRefresh, payload }: ActionFormProps) {
  const [issueId, setIssueId] = useState("");
  const [status, setStatus] = useState("under_review");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");

  return (
    <ActionCard icon={AlertTriangle} title="Issue Status">
      <SelectField label="Issue" onChange={setIssueId} options={selectOptions(listItems(payload.issues), "issue.id", "issue.title")} value={issueId} />
      <SelectField label="Status" onChange={setStatus} options={issueStatusOptions()} value={status} />
      <TextField label="Note" onChange={setNote} value={note} />
      <TextField label="Reason" onChange={setReason} required value={reason} />
      <ConfirmActionButton
        icon={Save}
        label="Update issue"
        message="Status issue akan dicatat dan reporter akan menerima notifikasi jika terkait."
        onConfirm={() =>
          runAction(notify, onRefresh, () =>
            apiRequest(`/api/issues/${issueId}/status`, {
              method: "PATCH",
              body: JSON.stringify({ status, note: note || null, reason }),
            }),
          )
        }
      />
    </ActionCard>
  );
}

type ActionFormProps = {
  notify: Notify;
  onRefresh: () => Promise<void>;
  payload: ViewPayload;
};

function ActionCard({
  children,
  icon: Icon,
  title,
}: {
  children: ReactNode;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <section className="action-card">
      <header>
        <Icon aria-hidden size={17} />
        <h2>{title}</h2>
      </header>
      {children}
    </section>
  );
}

function TextField({
  label,
  onChange,
  required,
  type = "text",
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  value: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        onChange={(event) => onChange(event.target.value)}
        required={required}
        type={type}
        value={value}
      />
    </label>
  );
}

function TextAreaField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea onChange={(event) => onChange(event.target.value)} value={value} />
    </label>
  );
}

function SelectField({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: string[][];
  value: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select onChange={(event) => onChange(event.target.value)} value={value}>
        <option value="">Select</option>
        {options.map(([optionValue, labelText]) => (
          <option key={optionValue || labelText} value={optionValue}>
            {labelText}
          </option>
        ))}
      </select>
    </label>
  );
}

function RoleSelect({ onChange, value }: { onChange: (value: UserRole) => void; value: UserRole }) {
  return (
    <SelectField
      label="Role"
      onChange={(next) => onChange(next as UserRole)}
      options={[
        ["super_admin", "Super Admin"],
        ["qa_manager", "QA Manager"],
        ["supervisor", "Supervisor"],
        ["inspector", "Inspector"],
        ["auditor", "Auditor"],
      ]}
      value={value}
    />
  );
}

function StatusSelect({
  onChange,
  value,
  values,
}: {
  onChange: (value: string) => void;
  value: string;
  values: string[];
}) {
  return <SelectField label="Status" onChange={onChange} options={values.map((item) => [item, item])} value={value} />;
}

function ConfirmActionButton({
  icon: Icon,
  label,
  message,
  onConfirm,
}: {
  icon: LucideIcon;
  label: string;
  message: string;
  onConfirm: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <>
      <button className="primary-button" onClick={() => setOpen(true)} type="button">
        <Icon aria-hidden size={16} />
        <span>{label}</span>
      </button>
      {open && (
        <div className="modal-backdrop" role="presentation">
          <section aria-modal="true" className="confirm-modal" role="dialog">
            <CheckCircle aria-hidden size={24} />
            <h2>Konfirmasi aksi</h2>
            <p>{message}</p>
            <div className="button-row">
              <button className="utility-button" disabled={busy} onClick={() => setOpen(false)} type="button">
                Batal
              </button>
              <button
                className="primary-button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await onConfirm();
                    setOpen(false);
                  } finally {
                    setBusy(false);
                  }
                }}
                type="button"
              >
                {busy ? "Processing..." : "Confirm"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function Toast({ onClose, toast }: { onClose: () => void; toast: ToastState }) {
  return (
    <aside className={`toast ${toast.tone}`}>
      <span>{toast.text}</span>
      <button onClick={onClose} title="Close toast" type="button">×</button>
    </aside>
  );
}

async function runAction(notify: Notify, onRefresh: () => Promise<void>, action: () => Promise<unknown>) {
  try {
    const result = await action();
    await onRefresh();
    notify({
      tone: "success",
      text: typeof result === "string" ? result : "Action berhasil disimpan.",
    });
  } catch (error) {
    notify({
      tone: "danger",
      text: error instanceof Error ? error.message : "Action gagal.",
    });
  }
}

function selectOptions(rows: Record<string, unknown>[], idPath: string, labelPath: string) {
  return rows
    .map((row) => {
      const id = getPath(row, idPath);
      const label = getPath(row, labelPath);
      if (!id) return null;
      return [String(id), textValue(label, String(id))];
    })
    .filter((item): item is string[] => Boolean(item));
}

function skillOptions() {
  return ["not_trained", "beginner", "intermediate", "competent", "expert", "trainer"].map((item) => [item, item]);
}

function taskStatusOptions() {
  return ["draft", "assigned", "acknowledged", "in_progress", "blocked", "done", "verified", "closed", "cancelled"].map((item) => [item, item]);
}

function issueStatusOptions() {
  return ["open", "under_review", "action_required", "resolved", "closed", "rejected"].map((item) => [item, item]);
}

function procedureCategoryOptions() {
  return ["safety", "inspection_method", "production_update", "emergency_instruction", "general_announcement"].map((item) => [item, item]);
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
