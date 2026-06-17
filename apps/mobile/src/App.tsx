import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import * as Notifications from "expo-notifications";
import {
  AlertCircle,
  Bell,
  ClipboardCheck,
  FileText,
  ListChecks,
  LogIn,
  LogOut,
  Moon,
  RefreshCcw,
  Save,
  Send,
  Settings,
  ShieldAlert,
  Upload,
  Wifi,
  WifiOff,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

declare const require: (path: string) => number;

type TabKey = "mission" | "tasks" | "sop" | "handover" | "issues" | "notifications" | "profile";

type ApiOk<T> = { ok: true; data: T };
type ApiFail = { ok: false; error: { code: string; message: string; details?: unknown } };

type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
};

type SessionData = {
  user: SessionUser;
  permissions: string[];
};

type Meta = {
  page: number;
  limit: number;
  total: number;
};

type ListResponse<T> = {
  items: T[];
  meta?: Meta;
};

type TaskRow = {
  task: {
    id: string;
    title: string;
    description?: string | null;
    status: string;
    priority: "critical" | "high" | "medium" | "low";
    dueAt?: string | null;
    checklist?: Array<{ label: string; done?: boolean }> | null;
  };
  area?: {
    id: string;
    code?: string | null;
    name: string;
  };
};

type ProcedureRow = {
  procedure: {
    id: string;
    title: string;
    category: string;
    status: string;
  };
  version?: {
    id: string;
    versionNumber: number;
    isCritical?: boolean;
    content?: string | null;
  };
  acknowledgement?: unknown;
};

type HandoverRow = {
  handover: {
    id: string;
    status: string;
    submittedAt?: string | null;
  };
  area?: { id: string; name: string };
  items?: Array<{ id: string; note: string; category: string }>;
};

type IssueRow = {
  issue: {
    id: string;
    title: string;
    severity: string;
    status: string;
    createdAt?: string;
  };
  area?: { id: string; name: string };
};

type NotificationRow = {
  notification: {
    id: string;
    title: string;
    message: string;
    priority: string;
    type: string;
  };
  recipient: {
    id: string;
    readAt?: string | null;
    acknowledgedAt?: string | null;
  };
};

type Mission = {
  workDate: string;
  assignment?: {
    id: string;
    workDate: string;
    assignmentStatus: string;
    shiftId: string;
    areaId: string;
  } | null;
  shift?: { id: string; name: string; startTime: string; endTime: string } | null;
  area?: { id: string; name: string; code?: string | null } | null;
  topPriorityTask?: TaskRow["task"] | null;
  activeTasks?: Array<TaskRow["task"]>;
  pendingProcedures?: ProcedureRow[];
  latestHandover?: HandoverRow | null;
  unreadNotificationCount?: number;
  settings?: InspectorSettings;
  cacheHints?: Record<string, unknown>;
};

type InspectorSettings = {
  ecoModeEnabled: boolean;
  lowDataModeEnabled: boolean;
  compactModeEnabled: boolean;
  darkModePreferred: boolean;
  backgroundSyncEnabled: boolean;
};

type HandoverDraft = {
  localDraftId: string;
  category: string;
  note: string;
  severity: string;
  updatedAt: string;
};

type IssueDraft = {
  title: string;
  description: string;
  category: string;
  severity: string;
  attachmentUrl?: string | null;
};

type IssuePhoto = {
  uri: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
};

type SignedUpload = {
  url: string;
  objectKey: string;
  publicUrl: string;
  requiredHeaders: {
    "content-type": string;
  };
};

type SyncDraftResult = {
  localDraftId: string;
  accepted: boolean;
  status: "synced" | "conflict" | "failed" | "pending";
  nextAction?: "remove_local_draft" | "replace_local_with_server" | "choose_conflict_resolution" | "fix_payload_or_retry";
  errorMessage?: string;
};

type LoadState = "booting" | "login" | "ready";

const APP_NAME = "Cladtek Quality Inspector";
const APP_SHORT_NAME = "Cladtek QI";
const cladtekLogo = require("../assets/cladtek-logo.png");

const storageKeys = {
  apiUrl: "qims.mobile.apiUrl",
  sessionCookie: "qims.mobile.sessionCookie",
  cachedMission: "qims.mobile.cachedMission",
  handoverDraft: "qims.mobile.handoverDraft",
  issueDraft: "qims.mobile.issueDraft",
};

const defaultApiUrl = "http://127.0.0.1:3000";

const tabs: Array<{ key: TabKey; label: string; icon: typeof ListChecks }> = [
  { key: "mission", label: "Mission", icon: ShieldAlert },
  { key: "tasks", label: "Tasks", icon: ListChecks },
  { key: "sop", label: "SOP", icon: ClipboardCheck },
  { key: "handover", label: "Handover", icon: FileText },
  { key: "issues", label: "Issues", icon: AlertCircle },
  { key: "notifications", label: "Notif", icon: Bell },
  { key: "profile", label: "Profile", icon: Settings },
];

export default function App() {
  const [loadState, setLoadState] = useState<LoadState>("booting");
  const [apiUrl, setApiUrl] = useState(defaultApiUrl);
  const [sessionCookie, setSessionCookie] = useState<string | null>(null);
  const [session, setSession] = useState<SessionData | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("mission");
  const [online, setOnline] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [mission, setMission] = useState<Mission | null>(null);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [procedures, setProcedures] = useState<ProcedureRow[]>([]);
  const [handovers, setHandovers] = useState<HandoverRow[]>([]);
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [settings, setSettings] = useState<InspectorSettings | null>(null);
  const [handoverDraft, setHandoverDraft] = useState<HandoverDraft>({
    localDraftId: `handover-${Date.now()}`,
    category: "special_note",
    note: "",
    severity: "low",
    updatedAt: new Date().toISOString(),
  });
  const [issueDraft, setIssueDraft] = useState<IssueDraft>({
    title: "",
    description: "",
    category: "quality_issue",
    severity: "medium",
    attachmentUrl: null,
  });
  const [issuePhoto, setIssuePhoto] = useState<IssuePhoto | null>(null);
  const [pushStatus, setPushStatus] = useState("Push token belum diregistrasi.");
  const [priorityNotice, setPriorityNotice] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const lastTopPriorityKey = useRef("");

  const missionStatus = useMemo(() => {
    if (!mission?.assignment) return "Tidak ada assignment aktif";
    if (mission.topPriorityTask) return `Prioritas: ${mission.topPriorityTask.priority}`;
    return "Assignment siap";
  }, [mission]);

  const request = useCallback(
    async <T,>(path: string, options?: RequestInit) => {
      const response = await fetch(`${apiUrl}${path}`, {
        ...options,
        headers: {
          "content-type": "application/json",
          ...(sessionCookie ? { Cookie: sessionCookie } : {}),
          ...(options?.headers ?? {}),
        },
      });
      const payload = (await response.json().catch(() => null)) as ApiOk<T> | ApiFail | null;

      if (!response.ok || !payload?.ok) {
        const error = payload && !payload.ok ? payload.error.message : "Request gagal.";
        throw new Error(error);
      }

      return { data: payload.data, response };
    },
    [apiUrl, sessionCookie],
  );

  const loadCachedDraft = useCallback(async () => {
    const [draft, issue] = await Promise.all([
      AsyncStorage.getItem(storageKeys.handoverDraft),
      AsyncStorage.getItem(storageKeys.issueDraft),
    ]);
    if (draft) setHandoverDraft(JSON.parse(draft) as HandoverDraft);
    if (issue) setIssueDraft(JSON.parse(issue) as IssueDraft);
  }, []);

  const refreshMission = useCallback(async () => {
    if (!sessionCookie) return;
    setLoadingData(true);
    try {
      const [missionResult, taskResult, procedureResult, handoverResult, issueResult, notificationResult, settingsResult] =
        await Promise.all([
          request<Mission>("/api/inspector/today-mission"),
          request<ListResponse<TaskRow>>("/api/tasks?limit=20"),
          request<ListResponse<ProcedureRow>>("/api/procedures?limit=20"),
          request<ListResponse<HandoverRow>>("/api/handovers?limit=10"),
          request<ListResponse<IssueRow>>("/api/issues?limit=10"),
          request<ListResponse<NotificationRow>>("/api/notifications?limit=20"),
          request<InspectorSettings>("/api/inspector/settings"),
        ]);

      const normalizedMission = normalizeMission(missionResult.data);
      const nextPriorityKey = priorityKey(normalizedMission);
      if (lastTopPriorityKey.current && nextPriorityKey && nextPriorityKey !== lastTopPriorityKey.current) {
        setPriorityNotice(
          `Prioritas berubah: ${normalizedMission.topPriorityTask?.title ?? "Task"} (${normalizedMission.topPriorityTask?.priority ?? "-"})`,
        );
      }
      lastTopPriorityKey.current = nextPriorityKey;

      setMission(normalizedMission);
      setTasks(taskResult.data.items ?? []);
      setProcedures(procedureResult.data.items ?? []);
      setHandovers(handoverResult.data.items ?? []);
      setIssues(issueResult.data.items ?? []);
      setNotifications(notificationResult.data.items ?? []);
      setSettings(settingsResult.data);
      setOnline(true);
      await AsyncStorage.setItem(storageKeys.cachedMission, JSON.stringify(normalizedMission));
      setMessage("Data terbaru dimuat.");
    } catch (error) {
      const cached = await AsyncStorage.getItem(storageKeys.cachedMission);
      if (cached) {
        setMission(normalizeMission(JSON.parse(cached) as Mission));
        setMessage("Offline. Jadwal terakhir ditampilkan dari cache.");
      } else {
        setMessage(error instanceof Error ? error.message : "Gagal memuat data.");
      }
      setOnline(false);
    } finally {
      setLoadingData(false);
    }
  }, [request, sessionCookie]);

  const boot = useCallback(async () => {
    const [storedApiUrl, storedCookie] = await Promise.all([
      AsyncStorage.getItem(storageKeys.apiUrl),
      AsyncStorage.getItem(storageKeys.sessionCookie),
      loadCachedDraft(),
    ]);
    if (storedApiUrl) setApiUrl(storedApiUrl);
    if (!storedCookie) {
      setLoadState("login");
      return;
    }

    setSessionCookie(storedCookie);
    try {
      const response = await fetch(`${storedApiUrl ?? defaultApiUrl}/api/me`, {
        headers: { Cookie: storedCookie },
      });
      const payload = (await response.json()) as ApiOk<SessionData> | ApiFail;
      if (!response.ok || !payload.ok || payload.data.user.role !== "inspector") {
        await AsyncStorage.removeItem(storageKeys.sessionCookie);
        setLoadState("login");
        return;
      }
      setSession(payload.data);
      setLoadState("ready");
    } catch {
      const cached = await AsyncStorage.getItem(storageKeys.cachedMission);
      if (cached) setMission(normalizeMission(JSON.parse(cached) as Mission));
      setOnline(false);
      setLoadState("ready");
    }
  }, [loadCachedDraft]);

  useEffect(() => {
    void boot();
  }, [boot]);

  useEffect(() => {
    if (loadState === "ready") void refreshMission();
  }, [loadState, refreshMission]);

  if (loadState === "booting") {
    return <BootScreen />;
  }

  if (loadState === "login") {
    return (
      <LoginScreen
        apiUrl={apiUrl}
        message={message}
        onApiUrlChange={setApiUrl}
        onLogin={async (email, password, nextApiUrl) => {
          await AsyncStorage.setItem(storageKeys.apiUrl, nextApiUrl);
          setApiUrl(nextApiUrl);
          const response = await fetch(`${nextApiUrl}/api/auth/login`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email, password }),
          });
          const cookie = response.headers.get("set-cookie")?.split(";")[0] ?? null;
          const payload = (await response.json().catch(() => null)) as ApiFail | unknown;
          if (!response.ok || !cookie) {
            throw new Error(
              payload && typeof payload === "object" && "error" in payload
                ? String((payload as ApiFail).error.message)
                : "Login gagal.",
            );
          }
          await AsyncStorage.setItem(storageKeys.sessionCookie, cookie);
          setSessionCookie(cookie);
          const sessionResponse = await fetch(`${nextApiUrl}/api/me`, { headers: { Cookie: cookie } });
          const sessionPayload = (await sessionResponse.json()) as ApiOk<SessionData> | ApiFail;
          if (!sessionResponse.ok || !sessionPayload.ok || sessionPayload.data.user.role !== "inspector") {
            await AsyncStorage.removeItem(storageKeys.sessionCookie);
            throw new Error("Mobile app hanya untuk role Inspector.");
          }
          setSession(sessionPayload.data);
          setLoadState("ready");
        }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.shell}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <View style={styles.headerBrand}>
          <CladtekLogo compact />
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>{APP_SHORT_NAME}</Text>
            <Text style={styles.title}>{session?.user.name ?? "Offline Inspector"}</Text>
            <Text style={styles.subtle}>{missionStatus}</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          {online ? <Wifi color={colors.good} size={18} /> : <WifiOff color={colors.warn} size={18} />}
          <IconButton icon={RefreshCcw} label="Sync" onPress={refreshMission} />
        </View>
      </View>

      {message ? <Banner text={message} tone={online ? "info" : "warn"} /> : null}
      {priorityNotice ? (
        <PriorityChangeBanner
          onAcknowledge={() => setPriorityNotice(null)}
          onOpenTasks={() => setActiveTab("tasks")}
          text={priorityNotice}
        />
      ) : null}

      <ScrollView contentContainerStyle={styles.content}>
        {loadingData ? <LoadingBlock /> : null}
        {activeTab === "mission" && (
          <MissionScreen
            mission={mission}
            onOpenHandover={() => setActiveTab("handover")}
            onOpenSop={() => setActiveTab("sop")}
            onOpenTasks={() => setActiveTab("tasks")}
          />
        )}
        {activeTab === "tasks" && (
          <TasksScreen
            onAcknowledge={(taskId) => mutate(() => request(`/api/tasks/${taskId}/acknowledge`, { method: "POST", body: "{}" }), refreshMission)}
            onStatus={(taskId, status) =>
              mutate(
                () =>
                  request(`/api/tasks/${taskId}/status`, {
                    method: "PATCH",
                    body: JSON.stringify({ status, reason: status === "blocked" ? "Blocked from mobile" : undefined }),
                  }),
                refreshMission,
              )
            }
            tasks={tasks}
          />
        )}
        {activeTab === "sop" && (
          <SopScreen
            onAcknowledge={(versionId, critical) =>
              mutate(
                () =>
                  request(`/api/procedure-versions/${versionId}/acknowledge`, {
                    method: "POST",
                    body: JSON.stringify({ read: true, understood: true, criticalConfirmed: critical }),
                  }),
                refreshMission,
              )
            }
            procedures={procedures}
          />
        )}
        {activeTab === "handover" && (
          <HandoverScreen
            draft={handoverDraft}
            handovers={handovers}
            mission={mission}
            onDraftChange={async (draft) => {
              const next = { ...draft, updatedAt: new Date().toISOString() };
              setHandoverDraft(next);
              await AsyncStorage.setItem(storageKeys.handoverDraft, JSON.stringify(next));
            }}
            onSaveDraft={async () => {
              await AsyncStorage.setItem(storageKeys.handoverDraft, JSON.stringify(handoverDraft));
              await mutate(
                () =>
                  request("/api/offline-drafts", {
                    method: "POST",
                    body: JSON.stringify({
                      localDraftId: handoverDraft.localDraftId,
                      draftType: "handover",
                      payload: handoverPayload(mission, handoverDraft, "draft"),
                      clientUpdatedAt: new Date().toISOString(),
                    }),
                  }),
                refreshMission,
              );
            }}
            onSubmit={() =>
              mutate(
                () =>
                  request("/api/handovers", {
                    method: "POST",
                    body: JSON.stringify(handoverPayload(mission, handoverDraft, "submitted")),
                  }),
                async () => {
                  await AsyncStorage.removeItem(storageKeys.handoverDraft);
                  setHandoverDraft({
                    localDraftId: `handover-${Date.now()}`,
                    category: "special_note",
                    note: "",
                    severity: "low",
                    updatedAt: new Date().toISOString(),
                  });
                  await refreshMission();
                },
              )
            }
          />
        )}
        {activeTab === "issues" && (
          <IssuesScreen
            draft={issueDraft}
            issues={issues}
            mission={mission}
            onDraftChange={async (draft) => {
              setIssueDraft(draft);
              await AsyncStorage.setItem(storageKeys.issueDraft, JSON.stringify(draft));
            }}
            onPickPhoto={pickIssuePhoto}
            photo={issuePhoto}
            onSubmit={() =>
              mutate(
                async () => {
                  const attachmentUrl = issuePhoto ? await uploadIssuePhoto(issuePhoto) : issueDraft.attachmentUrl;
                  return request("/api/issues", {
                    method: "POST",
                    body: JSON.stringify(issuePayload(mission, issueDraft, attachmentUrl)),
                  });
                },
                async () => {
                  const emptyIssue = { title: "", description: "", category: "quality_issue", severity: "medium", attachmentUrl: null };
                  setIssueDraft(emptyIssue);
                  setIssuePhoto(null);
                  await AsyncStorage.removeItem(storageKeys.issueDraft);
                  await refreshMission();
                },
              )
            }
            onSaveDraft={async () => {
              await AsyncStorage.setItem(storageKeys.issueDraft, JSON.stringify(issueDraft));
              await mutate(
                () =>
                  request("/api/offline-drafts", {
                    method: "POST",
                    body: JSON.stringify({
                      localDraftId: `issue-${Date.now()}`,
                      draftType: "issue",
                      payload: issuePayload(mission, issueDraft, issueDraft.attachmentUrl),
                      clientUpdatedAt: new Date().toISOString(),
                    }),
                  }),
                refreshMission,
              );
            }}
          />
        )}
        {activeTab === "notifications" && (
          <NotificationsScreen
            notifications={notifications}
            onRead={(recipientId) =>
              mutate(
                () => request(`/api/notifications/${recipientId}/read`, { method: "PATCH", body: "{}" }),
                refreshMission,
              )
            }
          />
        )}
        {activeTab === "profile" && (
          <ProfileScreen
            apiUrl={apiUrl}
            onApiUrlChange={async (value) => {
              setApiUrl(value);
              await AsyncStorage.setItem(storageKeys.apiUrl, value);
            }}
            onLogout={async () => {
              await fetch(`${apiUrl}/api/auth/logout`, {
                method: "POST",
                headers: sessionCookie ? { Cookie: sessionCookie } : undefined,
              }).catch(() => undefined);
              await AsyncStorage.removeItem(storageKeys.sessionCookie);
              setSession(null);
              setSessionCookie(null);
              setLoadState("login");
            }}
            onRegisterPush={registerPushToken}
            onSyncOfflineDrafts={syncOfflineDrafts}
            onSettingsChange={(next) =>
              mutate(
                () =>
                  request("/api/inspector/settings", {
                    method: "PATCH",
                    body: JSON.stringify(next),
                  }),
                refreshMission,
              )
            }
            settings={settings}
            pushStatus={pushStatus}
            user={session?.user}
          />
        )}
      </ScrollView>

      <View style={styles.tabbar}>
        {tabs.map((tab) => (
          <TabButton active={activeTab === tab.key} icon={tab.icon} key={tab.key} label={tab.label} onPress={() => setActiveTab(tab.key)} />
        ))}
      </View>
    </SafeAreaView>
  );

  async function mutate(action: () => Promise<unknown>, after?: () => Promise<void> | void) {
    try {
      const result = await action();
      await after?.();
      setOnline(true);
      setMessage(typeof result === "string" ? result : "Perubahan tersimpan.");
    } catch (error) {
      setOnline(false);
      setMessage(error instanceof Error ? error.message : "Gagal menyimpan. Data tetap aman di perangkat.");
    }
  }

  async function pickIssuePhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setMessage("Permission galeri belum diberikan.");
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    const compressed = await ImageManipulator.manipulateAsync(
      asset.uri,
      [{ resize: { width: Math.min(asset.width ?? 1280, 1280) } }],
      { compress: 0.72, format: ImageManipulator.SaveFormat.JPEG },
    );
    setIssuePhoto({
      uri: compressed.uri,
      fileName: `issue-${Date.now()}.jpg`,
      contentType: "image/jpeg",
      sizeBytes: asset.fileSize ?? 1_000_000,
    });
    setMessage("Foto issue dipilih dan dikompresi.");
  }

  async function uploadIssuePhoto(photo: IssuePhoto) {
    const signed = await request<SignedUpload>("/api/storage/signed-upload", {
      method: "POST",
      body: JSON.stringify({
        bucket: "issue-photos",
        entityType: "issue_reports",
        entityId: `mobile-${Date.now()}`,
        fileName: photo.fileName,
        contentType: photo.contentType,
        sizeBytes: photo.sizeBytes,
      }),
    });
    const file = await fetch(photo.uri);
    const blob = await file.blob();
    const upload = await fetch(signed.data.url, {
      method: "PUT",
      headers: {
        "content-type": photo.contentType,
        ...(sessionCookie ? { Cookie: sessionCookie } : {}),
      },
      body: blob,
    });
    if (!upload.ok) throw new Error("Upload foto issue gagal.");
    return signed.data.publicUrl || signed.data.objectKey;
  }

  async function registerPushToken() {
    try {
      const permission = await Notifications.requestPermissionsAsync();
      let token = `local-dev-token-${session?.user.id ?? Date.now()}`;
      if (permission.granted) {
        const expoToken = await Notifications.getExpoPushTokenAsync().catch(() => null);
        token = expoToken?.data ?? token;
      }
      await request("/api/device-tokens", {
        method: "POST",
        body: JSON.stringify({
          token,
          platform: "expo",
          deviceName: "Cladtek Quality Inspector Mobile",
        }),
      });
      setPushStatus(permission.granted ? "Expo push token terdaftar." : "Local-dev push token terdaftar.");
      setMessage("Device token tersimpan.");
    } catch (error) {
      setPushStatus(error instanceof Error ? error.message : "Push registration gagal.");
    }
  }

  async function syncOfflineDrafts() {
    const [cachedHandover, cachedIssue] = await Promise.all([
      AsyncStorage.getItem(storageKeys.handoverDraft),
      AsyncStorage.getItem(storageKeys.issueDraft),
    ]);
    const drafts: Array<{
      localDraftId: string;
      draftType: "handover" | "issue";
      payload: Record<string, unknown>;
      clientUpdatedAt: string;
    }> = [];

    if (cachedHandover) {
      const draft = JSON.parse(cachedHandover) as HandoverDraft;
      let payload: Record<string, unknown> = draft as unknown as Record<string, unknown>;
      try {
        payload = handoverPayload(mission, draft, "draft");
      } catch {
        payload = { ...draft, syncBlockedReason: "Assignment hari ini belum tersedia di cache." };
      }
      drafts.push({
        localDraftId: draft.localDraftId,
        draftType: "handover",
        payload,
        clientUpdatedAt: draft.updatedAt,
      });
    }

    if (cachedIssue) {
      const draft = JSON.parse(cachedIssue) as IssueDraft;
      drafts.push({
        localDraftId: `issue-manual-sync-${session?.user.id ?? "offline"}`,
        draftType: "issue",
        payload: issuePayload(mission, draft, draft.attachmentUrl),
        clientUpdatedAt: new Date().toISOString(),
      });
    }

    if (drafts.length === 0) {
      setMessage("Tidak ada offline draft untuk disync.");
      return;
    }

    await mutate(
      async () => {
        const synced = await request<{ results: SyncDraftResult[] }>("/api/offline-drafts/sync", {
          method: "POST",
          body: JSON.stringify({ drafts }),
        });
        const syncedDrafts = synced.data.results.filter(
          (result) => result.accepted && result.nextAction === "remove_local_draft",
        );
        if (syncedDrafts.some((result) => result.localDraftId === handoverDraft.localDraftId)) {
          await AsyncStorage.removeItem(storageKeys.handoverDraft);
          setHandoverDraft({
            localDraftId: `handover-${Date.now()}`,
            category: "special_note",
            note: "",
            severity: "low",
            updatedAt: new Date().toISOString(),
          });
        }
        if (syncedDrafts.some((result) => result.localDraftId.startsWith("issue-manual-sync"))) {
          await AsyncStorage.removeItem(storageKeys.issueDraft);
          setIssueDraft({ title: "", description: "", category: "quality_issue", severity: "medium", attachmentUrl: null });
        }
        const failed = synced.data.results.filter((result) => !result.accepted);
        if (failed.length > 0) {
          throw new Error(failed.map((result) => result.errorMessage ?? result.status).join("; "));
        }
        return `${syncedDrafts.length} offline draft berhasil disync.`;
      },
      refreshMission,
    );
  }
}

function handoverPayload(mission: Mission | null, draft: HandoverDraft, status: "draft" | "submitted") {
  if (!mission?.assignment?.id || !mission.area?.id) {
    throw new Error("Assignment hari ini belum tersedia.");
  }

  return {
    fromShiftAssignmentId: mission.assignment.id,
    areaId: mission.area.id,
    status,
    items: [
      {
        category: draft.category,
        note: draft.note,
        severity: draft.severity,
      },
    ],
  };
}

function issuePayload(mission: Mission | null, draft: IssueDraft, attachmentUrl?: string | null) {
  return {
    title: draft.title,
    description: draft.description || null,
    category: draft.category,
    severity: draft.severity,
    areaId: mission?.area?.id ?? null,
    shiftAssignmentId: mission?.assignment?.id ?? null,
    attachmentUrl: attachmentUrl || null,
  };
}

function normalizeMission(input: unknown): Mission {
  const raw = asRecord(input);
  const assignmentRow = asRecord(raw.assignment);
  const assignment = asRecord(assignmentRow.assignment ?? raw.assignment);
  const shift = asRecord(assignmentRow.shift ?? raw.shift);
  const area = asRecord(assignmentRow.area ?? raw.area);
  const topPriorityRow = asRecord(raw.topPriorityTask ?? raw.topPriority);
  const topPriorityTask = asRecord(topPriorityRow.task ?? topPriorityRow);
  const activeTasks = asArray(raw.activeTasks).map((item) => {
    const row = asRecord(item);
    return asRecord(row.task ?? row) as TaskRow["task"];
  });
  const pendingProcedures = asArray(raw.pendingProcedures ?? raw.pendingSops) as ProcedureRow[];
  const latestHandoverRow = asArray(raw.latestHandovers)[0] ?? raw.latestHandover ?? null;

  return {
    workDate: String(raw.workDate ?? ""),
    assignment: Object.keys(assignment).length > 0
      ? {
          id: String(assignment.id ?? ""),
          workDate: String(assignment.workDate ?? raw.workDate ?? ""),
          assignmentStatus: String(assignment.assignmentStatus ?? ""),
          shiftId: String(assignment.shiftId ?? ""),
          areaId: String(assignment.areaId ?? ""),
        }
      : null,
    shift: Object.keys(shift).length > 0
      ? {
          id: String(shift.id ?? ""),
          name: String(shift.name ?? ""),
          startTime: String(shift.startTime ?? ""),
          endTime: String(shift.endTime ?? ""),
        }
      : null,
    area: Object.keys(area).length > 0
      ? {
          id: String(area.id ?? ""),
          name: String(area.name ?? ""),
          code: typeof area.code === "string" ? area.code : null,
        }
      : null,
    topPriorityTask: Object.keys(topPriorityTask).length > 0 ? (topPriorityTask as TaskRow["task"]) : null,
    activeTasks,
    pendingProcedures,
    latestHandover: latestHandoverRow
      ? ({ handover: latestHandoverRow } as HandoverRow)
      : null,
    unreadNotificationCount: Number(raw.unreadNotificationCount ?? 0),
    settings: raw.settings as InspectorSettings | undefined,
    cacheHints: asRecord(raw.cacheHints ?? raw.offlineCacheHints),
  };
}

function priorityKey(mission: Mission) {
  if (!mission.topPriorityTask?.id) return "";
  return `${mission.topPriorityTask.id}:${mission.topPriorityTask.priority}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function LoginScreen({
  apiUrl,
  message,
  onApiUrlChange,
  onLogin,
}: {
  apiUrl: string;
  message: string | null;
  onApiUrlChange: (value: string) => void;
  onLogin: (email: string, password: string, apiUrl: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("inspector@qims.local");
  const [password, setPassword] = useState("QimsDemo123!");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <SafeAreaView style={styles.loginShell}>
      <StatusBar barStyle="light-content" />
      <View style={styles.loginPanel}>
        <CladtekLogo />
        <Text style={styles.loginTitle}>Today&apos;s Mission</Text>
        <Text style={styles.loginText}>Masuk ke {APP_NAME} untuk melihat shift, task prioritas, SOP, dan draft handover terakhir.</Text>
        <Field label="API URL" onChangeText={onApiUrlChange} value={apiUrl} />
        <Field autoCapitalize="none" label="Email" onChangeText={setEmail} value={email} />
        <Field label="Password" onChangeText={setPassword} secureTextEntry value={password} />
        {message ? <Banner text={message} tone="warn" /> : null}
        {error ? <Banner text={error} tone="warn" /> : null}
        <PrimaryButton
          disabled={submitting}
          icon={LogIn}
          label={submitting ? "Masuk..." : "Login"}
          onPress={async () => {
            setSubmitting(true);
            setError(null);
            try {
              await onLogin(email, password, apiUrl);
            } catch (loginError) {
              setError(loginError instanceof Error ? loginError.message : "Login gagal.");
            } finally {
              setSubmitting(false);
            }
          }}
        />
      </View>
    </SafeAreaView>
  );
}

function MissionScreen({
  mission,
  onOpenHandover,
  onOpenSop,
  onOpenTasks,
}: {
  mission: Mission | null;
  onOpenHandover: () => void;
  onOpenSop: () => void;
  onOpenTasks: () => void;
}) {
  return (
    <View style={styles.stack}>
      <Card title="Today's Mission">
        <Text style={styles.missionArea}>{mission?.area?.name ?? "Area belum tersedia"}</Text>
        <Text style={styles.subtle}>
          {mission?.shift ? `${mission.shift.name} ${mission.shift.startTime}-${mission.shift.endTime}` : "Shift belum tersedia"}
        </Text>
        <View style={styles.metricRow}>
          <Metric label="Task" value={String(mission?.activeTasks?.length ?? 0)} />
          <Metric label="SOP" value={String(mission?.pendingProcedures?.length ?? 0)} />
          <Metric label="Notif" value={String(mission?.unreadNotificationCount ?? 0)} />
        </View>
        <Text style={styles.sectionLabel}>Top priority</Text>
        <Text style={styles.cardTitle}>{mission?.topPriorityTask?.title ?? "Belum ada task prioritas."}</Text>
      </Card>

      <View style={styles.actionGrid}>
        <PrimaryButton icon={ListChecks} label="Tasks" onPress={onOpenTasks} />
        <PrimaryButton icon={ClipboardCheck} label="SOP" onPress={onOpenSop} />
        <PrimaryButton icon={FileText} label="Handover" onPress={onOpenHandover} />
      </View>
    </View>
  );
}

function TasksScreen({
  tasks,
  onAcknowledge,
  onStatus,
}: {
  tasks: TaskRow[];
  onAcknowledge: (taskId: string) => void;
  onStatus: (taskId: string, status: string) => void;
}) {
  if (tasks.length === 0) return <EmptyState text="Belum ada task untuk inspector ini." />;
  return (
    <View style={styles.stack}>
      {tasks.map((row) => (
        <Card key={row.task.id} title={row.task.title}>
          <Text style={styles.subtle}>{row.area?.name ?? "Area"} · {row.task.status}</Text>
          <Badge text={row.task.priority} />
          <Text style={styles.bodyText}>{row.task.description ?? "Tidak ada deskripsi."}</Text>
          <View style={styles.buttonRow}>
            <SmallButton label="Ack" onPress={() => onAcknowledge(row.task.id)} />
            <SmallButton label="Start" onPress={() => onStatus(row.task.id, "in_progress")} />
            <SmallButton label="Blocked" onPress={() => onStatus(row.task.id, "blocked")} />
            <SmallButton label="Done" onPress={() => onStatus(row.task.id, "done")} />
          </View>
        </Card>
      ))}
    </View>
  );
}

function SopScreen({ procedures, onAcknowledge }: { procedures: ProcedureRow[]; onAcknowledge: (versionId: string, critical: boolean) => void }) {
  if (procedures.length === 0) return <EmptyState text="Belum ada SOP pending." />;
  return (
    <View style={styles.stack}>
      {procedures.map((row) => (
        <Card key={row.version?.id ?? row.procedure.id} title={row.procedure.title}>
          <Text style={styles.subtle}>v{row.version?.versionNumber ?? "-"} · {row.procedure.category}</Text>
          {row.version?.isCritical ? <Badge text="critical" tone="warn" /> : null}
          <Text style={styles.bodyText} numberOfLines={5}>
            {row.version?.content ?? "Buka attachment SOP dari dashboard saat tersedia."}
          </Text>
          {row.version?.id ? (
            <PrimaryButton icon={ClipboardCheck} label="Dibaca & dipahami" onPress={() => onAcknowledge(row.version!.id, Boolean(row.version?.isCritical))} />
          ) : null}
        </Card>
      ))}
    </View>
  );
}

function HandoverScreen({
  draft,
  handovers,
  mission,
  onDraftChange,
  onSaveDraft,
  onSubmit,
}: {
  draft: HandoverDraft;
  handovers: HandoverRow[];
  mission: Mission | null;
  onDraftChange: (draft: HandoverDraft) => void;
  onSaveDraft: () => void;
  onSubmit: () => void;
}) {
  return (
    <View style={styles.stack}>
      <Card title="Draft Handover">
        <Text style={styles.subtle}>{mission?.area?.name ?? "Area belum tersedia"}</Text>
        <Field label="Kategori" onChangeText={(category) => onDraftChange({ ...draft, category })} value={draft.category} />
        <Field label="Severity" onChangeText={(severity) => onDraftChange({ ...draft, severity })} value={draft.severity} />
        <Field label="Catatan" multiline onChangeText={(note) => onDraftChange({ ...draft, note })} value={draft.note} />
        <View style={styles.buttonRow}>
          <PrimaryButton icon={Save} label="Save draft" onPress={onSaveDraft} />
          <PrimaryButton icon={Send} label="Submit" onPress={onSubmit} />
        </View>
      </Card>
      {handovers.map((row) => (
        <Card key={row.handover.id} title={`Handover ${row.handover.status}`}>
          <Text style={styles.subtle}>{row.area?.name ?? "Area"} · {formatDate(row.handover.submittedAt)}</Text>
        </Card>
      ))}
    </View>
  );
}

function IssuesScreen({
  draft,
  issues,
  mission,
  onDraftChange,
  onPickPhoto,
  onSaveDraft,
  onSubmit,
  photo,
}: {
  draft: IssueDraft;
  issues: IssueRow[];
  mission: Mission | null;
  onDraftChange: (draft: IssueDraft) => void;
  onPickPhoto: () => void;
  onSaveDraft: () => void;
  onSubmit: () => void;
  photo: IssuePhoto | null;
}) {
  return (
    <View style={styles.stack}>
      <Card title="Report Issue">
        <Text style={styles.subtle}>{mission?.area?.name ?? "Area dari assignment hari ini"}</Text>
        <Field label="Judul" onChangeText={(title) => onDraftChange({ ...draft, title })} value={draft.title} />
        <Field label="Kategori" onChangeText={(category) => onDraftChange({ ...draft, category })} value={draft.category} />
        <Field label="Severity" onChangeText={(severity) => onDraftChange({ ...draft, severity })} value={draft.severity} />
        <Field label="Deskripsi" multiline onChangeText={(description) => onDraftChange({ ...draft, description })} value={draft.description} />
        <Text style={styles.subtle}>{photo ? `Attachment siap: ${photo.fileName}` : "Attachment foto optional."}</Text>
        <View style={styles.buttonRow}>
          <PrimaryButton icon={Upload} label="Photo" onPress={onPickPhoto} />
          <PrimaryButton icon={Save} label="Save draft" onPress={onSaveDraft} />
          <PrimaryButton icon={Send} label="Submit Issue" onPress={onSubmit} />
        </View>
      </Card>
      {issues.map((row) => (
        <Card key={row.issue.id} title={row.issue.title}>
          <Text style={styles.subtle}>{row.issue.severity} · {row.issue.status}</Text>
        </Card>
      ))}
    </View>
  );
}

function NotificationsScreen({ notifications, onRead }: { notifications: NotificationRow[]; onRead: (recipientId: string) => void }) {
  if (notifications.length === 0) return <EmptyState text="Tidak ada notifikasi." />;
  return (
    <View style={styles.stack}>
      {notifications.map((row) => (
        <Card key={row.recipient.id} title={row.notification.title}>
          <Text style={styles.bodyText}>{row.notification.message}</Text>
          <Text style={styles.subtle}>{row.notification.type} · {row.notification.priority}</Text>
          {!row.recipient.readAt ? <PrimaryButton icon={Bell} label="Mark read" onPress={() => onRead(row.recipient.id)} /> : null}
        </Card>
      ))}
    </View>
  );
}

function ProfileScreen({
  apiUrl,
  onApiUrlChange,
  onLogout,
  onRegisterPush,
  onSyncOfflineDrafts,
  onSettingsChange,
  pushStatus,
  settings,
  user,
}: {
  apiUrl: string;
  onApiUrlChange: (value: string) => void;
  onLogout: () => void;
  onRegisterPush: () => void;
  onSyncOfflineDrafts: () => void;
  onSettingsChange: (settings: Partial<InspectorSettings>) => void;
  pushStatus: string;
  settings: InspectorSettings | null;
  user?: SessionUser;
}) {
  return (
    <View style={styles.stack}>
      <Card title="Profile & Eco Mode">
        <Text style={styles.cardTitle}>{user?.name ?? "Inspector"}</Text>
        <Text style={styles.subtle}>{user?.email ?? "offline session"}</Text>
        <Field label="API URL" onChangeText={onApiUrlChange} value={apiUrl} />
        <ToggleRow label="Eco mode" value={Boolean(settings?.ecoModeEnabled)} onValueChange={(ecoModeEnabled) => onSettingsChange({ ecoModeEnabled })} />
        <ToggleRow label="Low data" value={Boolean(settings?.lowDataModeEnabled)} onValueChange={(lowDataModeEnabled) => onSettingsChange({ lowDataModeEnabled })} />
        <ToggleRow label="Background sync" value={Boolean(settings?.backgroundSyncEnabled)} onValueChange={(backgroundSyncEnabled) => onSettingsChange({ backgroundSyncEnabled })} />
        <Text style={styles.subtle}>{pushStatus}</Text>
        <PrimaryButton icon={Bell} label="Register push" onPress={onRegisterPush} />
        <PrimaryButton icon={RefreshCcw} label="Sync offline drafts" onPress={onSyncOfflineDrafts} />
        <PrimaryButton icon={LogOut} label="Logout" onPress={onLogout} />
      </Card>
    </View>
  );
}

function BootScreen() {
  return (
    <SafeAreaView style={styles.loginShell}>
      <CladtekLogo />
      <ActivityIndicator color={colors.accent} />
      <Text style={styles.subtle}>Loading {APP_NAME}...</Text>
    </SafeAreaView>
  );
}

function CladtekLogo({ compact = false }: { compact?: boolean }) {
  return (
    <View style={compact ? styles.brandCompact : styles.brandLockup}>
      <Image
        accessibilityLabel="Cladtek"
        resizeMode="contain"
        source={cladtekLogo}
        style={compact ? styles.brandImageCompact : styles.brandImage}
      />
    </View>
  );
}

function LoadingBlock() {
  return (
    <View style={styles.loadingBlock}>
      <ActivityIndicator color={colors.accent} />
      <Text style={styles.subtle}>Syncing...</Text>
    </View>
  );
}

function Card({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.subtle}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function Field({
  label,
  multiline,
  onChangeText,
  secureTextEntry,
  value,
  autoCapitalize = "none",
}: {
  label: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  value: string;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        autoCapitalize={autoCapitalize}
        multiline={multiline}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        style={[styles.input, multiline ? styles.textArea : null]}
        value={value}
      />
    </View>
  );
}

function ToggleRow({ label, onValueChange, value }: { label: string; onValueChange: (value: boolean) => void; value: boolean }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.bodyText}>{label}</Text>
      <Switch onValueChange={onValueChange} value={value} />
    </View>
  );
}

function PrimaryButton({
  disabled,
  icon: Icon,
  label,
  onPress,
}: {
  disabled?: boolean;
  icon: typeof ListChecks;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.primaryButton, pressed ? styles.pressed : null, disabled ? styles.disabled : null]}>
      <Icon color={colors.bg} size={17} />
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function SmallButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.smallButton, pressed ? styles.pressed : null]}>
      <Text style={styles.smallButtonText}>{label}</Text>
    </Pressable>
  );
}

function IconButton({ icon: Icon, label, onPress }: { icon: typeof ListChecks; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.iconButton}>
      <Icon color={colors.text} size={17} />
      <Text style={styles.iconButtonText}>{label}</Text>
    </Pressable>
  );
}

function TabButton({
  active,
  icon: Icon,
  label,
  onPress,
}: {
  active: boolean;
  icon: typeof ListChecks;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.tabButton, active ? styles.tabButtonActive : null]}>
      <Icon color={active ? colors.accent : colors.muted} size={18} />
      <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function Banner({ text, tone }: { text: string; tone: "info" | "warn" }) {
  return (
    <View style={[styles.banner, tone === "warn" ? styles.bannerWarn : null]}>
      <Text style={styles.bannerText}>{text}</Text>
    </View>
  );
}

function PriorityChangeBanner({
  onAcknowledge,
  onOpenTasks,
  text,
}: {
  onAcknowledge: () => void;
  onOpenTasks: () => void;
  text: string;
}) {
  return (
    <View style={[styles.banner, styles.priorityBanner]}>
      <Text style={styles.bannerText}>{text}</Text>
      <View style={styles.buttonRow}>
        <SmallButton label="Buka Tasks" onPress={onOpenTasks} />
        <SmallButton label="OK" onPress={onAcknowledge} />
      </View>
    </View>
  );
}

function Badge({ text, tone = "info" }: { text: string; tone?: "info" | "warn" }) {
  return (
    <View style={[styles.badge, tone === "warn" ? styles.badgeWarn : null]}>
      <Text style={styles.badgeText}>{text}</Text>
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.subtle}>{text}</Text>
    </View>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("id-ID");
}

const colors = {
  bg: "#10120f",
  surface: "#171a15",
  surface2: "#1f251e",
  line: "#30372d",
  text: "#eef4e8",
  muted: "#aab5a3",
  accent: "#5fc7a5",
  brand: "#12b7df",
  good: "#71d08f",
  warn: "#e7b65c",
  danger: "#ee7d68",
};

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loginShell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    padding: 18,
    backgroundColor: colors.bg,
  },
  loginPanel: {
    width: "100%",
    gap: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  brandLockup: {
    width: 176,
    height: 64,
    alignSelf: "flex-start",
    justifyContent: "center",
  },
  brandCompact: {
    width: 96,
    height: 38,
    justifyContent: "center",
  },
  brandImage: {
    width: "100%",
    height: "100%",
  },
  brandImageCompact: {
    width: "100%",
    height: "100%",
  },
  loginTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
  },
  loginText: {
    color: colors.muted,
    lineHeight: 21,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.surface,
  },
  headerBrand: {
    minWidth: 0,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerText: {
    minWidth: 0,
    flex: 1,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  subtle: {
    color: colors.muted,
    fontSize: 12,
  },
  content: {
    padding: 12,
    paddingBottom: 92,
  },
  stack: {
    gap: 12,
  },
  card: {
    gap: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  bodyText: {
    color: colors.text,
    lineHeight: 20,
  },
  missionArea: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "900",
  },
  sectionLabel: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  metricRow: {
    flexDirection: "row",
    gap: 8,
  },
  metric: {
    flex: 1,
    minHeight: 58,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    backgroundColor: colors.surface2,
  },
  metricValue: {
    marginTop: 2,
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
  },
  actionGrid: {
    gap: 10,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  input: {
    minHeight: 42,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    color: colors.text,
    backgroundColor: colors.surface2,
  },
  textArea: {
    minHeight: 92,
    paddingTop: 10,
    textAlignVertical: "top",
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  primaryButton: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 13,
    borderRadius: 8,
    backgroundColor: colors.accent,
  },
  primaryButtonText: {
    color: colors.bg,
    fontWeight: "900",
  },
  smallButton: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    backgroundColor: colors.surface2,
  },
  smallButtonText: {
    color: colors.text,
    fontWeight: "700",
  },
  iconButton: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
  },
  iconButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.76,
  },
  disabled: {
    opacity: 0.55,
  },
  banner: {
    marginHorizontal: 12,
    marginTop: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    backgroundColor: colors.surface2,
  },
  bannerWarn: {
    borderColor: colors.warn,
  },
  priorityBanner: {
    borderColor: colors.accent,
  },
  bannerText: {
    color: colors.text,
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.surface2,
  },
  badgeWarn: {
    backgroundColor: "#4a3420",
  },
  badgeText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  toggleRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  loadingBlock: {
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyState: {
    minHeight: 160,
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  tabbar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.surface,
  },
  tabButton: {
    flex: 1,
    minHeight: 66,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  tabButtonActive: {
    backgroundColor: "#1f3028",
  },
  tabText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700",
  },
  tabTextActive: {
    color: colors.accent,
  },
});
