import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ConfirmDialog } from './components/ConfirmDialog';
import { ClientView } from './components/ClientView';
import { DataBackupModal } from './components/DataBackupModal';
import { Header, WorkspaceTab } from './components/Header';
import { InstallAppModal, MobileInstallBanner } from './components/InstallAppModal';
import { ProjectDetailView } from './components/ProjectDetailView';
import { ProjectModal } from './components/ProjectModal';
import {
  PROPOSAL_PACKAGE_PRESETS,
  ProposalBuilderView,
} from './components/ProposalBuilderView';
import { StudioPulseView } from './components/StudioPulseView';
import { SupabaseSettingsModal } from './components/SupabaseSettingsModal';
import { TeamView } from './components/TeamView';
import { Toast, ToastMessage } from './components/Toast';
import { WorklogSection } from './components/WorklogSection';
import {
  buildPaymentStagesForScheme,
  createDemoData,
  createEmptyData,
  createId,
  createWorkStagesForScheme,
} from './data/demoData';
import { usePWAInstall } from './hooks/usePWAInstall';
import {
  AppData,
  CommercialProposal,
  DirectExpense,
  Project,
  ProjectStatus,
  StudioSettings,
  TeamMember,
  UserRole,
  WorklogEntry,
} from './types';
import {
  buildClientShareUrl,
  ClientSnapshot,
  copyToClipboard,
  loadAppData,
  loadLastCloudSnapshot,
  loadSyncMeta,
  LocalSyncMeta,
  markSyncCompleted,
  parseClientUrlParams,
  saveLastCloudSnapshot,
  saveLocalMutation,
  saveRemoteSnapshot,
} from './utils/storage';
import { exportProjectFinancialPdf } from './utils/exportProjectPdf';
import {
  fetchStudioState,
  isTransientSyncError,
  RealtimeStatus,
  saveStudioStateRemote,
  subscribeStudioState,
  SupabaseSyncError,
  SyncStatus,
} from './utils/supabaseSync';

const RETRY_DELAY_MS = 3000;
const MAX_AUTO_RETRIES = 6;

function getTodayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

function generateNextProposalNumber(existing: CommercialProposal[]): string {
  const year = new Date().getFullYear();
  const prefix = `КП-${year}/`;
  let maxSeq = 0;
  for (const item of existing) {
    if (item.number && item.number.startsWith(prefix)) {
      const seq = parseInt(item.number.slice(prefix.length), 10);
      if (Number.isFinite(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }
  return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
}

export default function App() {
  const urlClientState = useMemo(() => parseClientUrlParams(), []);

  const [data, setData] = useState<AppData>(() => loadAppData());
  const [syncMeta, setSyncMeta] = useState<LocalSyncMeta>(() => loadSyncMeta());
  const [lastCloudSnapshotAt, setLastCloudSnapshotAt] = useState<number | null>(
    () => loadLastCloudSnapshot()?.savedAt ?? null
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() =>
    typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'connecting'
  );
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>('idle');
  const [lastSyncError, setLastSyncError] = useState<SupabaseSyncError | null>(null);
  const [syncGeneration, setSyncGeneration] = useState(0);
  const [role, setRole] = useState<UserRole>(
    urlClientState.isLockedClient ? 'client' : 'director'
  );
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('projects');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    urlClientState.projectId
  );
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);

  // Offline-First synchronization refs & mutex
  const mountedRef = useRef(true);
  const isSyncingRef = useRef(false);
  const needsResyncAfterCurrentRef = useRef(false);
  const realtimeAcceptingRef = useRef(false);
  const restConnectedRef = useRef(false);
  const lastSyncedJsonRef = useRef<string>('');
  const lastKnownCloudDataRef = useRef<AppData | null>(loadLastCloudSnapshot()?.data ?? null);
  const saveTimerRef = useRef<number | null>(null);
  const retryTimerRef = useRef<number | null>(null);
  const retryAttemptsRef = useRef<number>(0);
  const latestDataRef = useRef<AppData>(data);
  const syncMetaRef = useRef<LocalSyncMeta>(syncMeta);

  latestDataRef.current = data;
  syncMetaRef.current = syncMeta;

  // Modals & notifications
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [backupModalOpen, setBackupModalOpen] = useState(false);
  const [supabaseModalOpen, setSupabaseModalOpen] = useState(false);
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    danger?: boolean;
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    description: '',
    confirmLabel: 'Подтвердить',
    danger: false,
    onConfirm: () => {},
  });

  const notify = useCallback((text: string, type: 'default' | 'error' = 'default') => {
    const id = Date.now();
    setToast({ id, text, type });
    window.setTimeout(() => {
      setToast((curr) => (curr && curr.id === id ? null : curr));
    }, 3400);
  }, []);

  const {
    canPromptNative,
    isStandalone,
    isIOS,
    isAndroid,
    bannerDismissed,
    dismissBanner,
    promptNativeInstall,
  } = usePWAInstall({
    onInstalled: () => {
      setInstallModalOpen(false);
      notify('Приложение LI.MUR PROJECT установлено');
    },
  });

  const handleRequestInstallApp = useCallback(async () => {
    if (canPromptNative) {
      const outcome = await promptNativeInstall();
      if (outcome === 'unavailable') {
        setInstallModalOpen(true);
      }
      return;
    }
    setInstallModalOpen(true);
  }, [canPromptNative, promptNativeInstall]);

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  /**
   * Core mutex-guarded upload of local state to Supabase `public.studio_state` (`id = 'main'`).
   * - Preserves last known cloud snapshot in `limur_last_cloud_snapshot` before overwriting cloud.
   * - Never clears `hasPendingChanges` until Supabase responds with `!error`.
   * - Never enables incoming Realtime events until upload is confirmed by server.
   * - If additional edits occurred mid-flight, automatically runs another upload pass.
   * - On unstable internet / transient errors, automatically schedules a retry in 3 seconds.
   */
  const pushLocalChangesToCloud = useCallback(
    async (options?: {
      force?: boolean;
      notifyOfflineFlush?: boolean;
    }): Promise<{ ok: boolean; error?: SupabaseSyncError }> => {
      if (urlClientState.isLockedClient) {
        return { ok: true };
      }

      clearRetryTimer();

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        restConnectedRef.current = false;
        realtimeAcceptingRef.current = false;
        if (mountedRef.current) {
          setSyncStatus('offline');
        }
        return { ok: false };
      }

      if (isSyncingRef.current) {
        needsResyncAfterCurrentRef.current = true;
        return { ok: false };
      }

      const storedMeta = loadSyncMeta();
      const hasPendingNow = storedMeta.hasPendingChanges || syncMetaRef.current.hasPendingChanges;
      const pendingBeforePush = Math.max(storedMeta.pendingCount, syncMetaRef.current.pendingCount);

      if (!options?.force && !hasPendingNow) {
        return { ok: true };
      }

      // Safety backup: preserve last known cloud snapshot in `limur_last_cloud_snapshot` before upsert
      if (lastKnownCloudDataRef.current) {
        const backup = saveLastCloudSnapshot(lastKnownCloudDataRef.current);
        if (backup && mountedRef.current) {
          setLastCloudSnapshotAt(backup.savedAt);
        }
      }

      isSyncingRef.current = true;
      realtimeAcceptingRef.current = false;
      needsResyncAfterCurrentRef.current = false;

      if (mountedRef.current) {
        setIsSyncing(true);
        setSyncStatus('syncing');
      }

      let scheduleAutoRetry = false;

      try {
        while (true) {
          const snapshot = latestDataRef.current;
          const snapshotUpdatedAt = syncMetaRef.current.localUpdatedAt;
          const serialized = JSON.stringify(snapshot);

          const res = await saveStudioStateRemote(snapshot);
          if (!mountedRef.current) {
            return { ok: res.ok, error: res.error };
          }

          if (!res.ok) {
            restConnectedRef.current = false;
            realtimeAcceptingRef.current = false;
            setLastSyncError(res.error || null);
            setSyncStatus('offline');

            const isOnlineNow = typeof navigator === 'undefined' || navigator.onLine;
            if (
              isOnlineNow &&
              isTransientSyncError(res.error) &&
              retryAttemptsRef.current < MAX_AUTO_RETRIES
            ) {
              scheduleAutoRetry = true;
            }

            return { ok: false, error: res.error };
          }

          const editedDuringFlight =
            syncMetaRef.current.localUpdatedAt > snapshotUpdatedAt ||
            needsResyncAfterCurrentRef.current;

          if (editedDuringFlight) {
            needsResyncAfterCurrentRef.current = false;
            continue;
          }

          retryAttemptsRef.current = 0;
          lastSyncedJsonRef.current = serialized;
          lastKnownCloudDataRef.current = snapshot;
          restConnectedRef.current = true;

          const clearedMeta = markSyncCompleted(Date.now(), snapshot);
          syncMetaRef.current = clearedMeta;
          setSyncMeta(clearedMeta);
          setLastCloudSnapshotAt(clearedMeta.lastSyncedAt);
          setLastSyncError(null);
          realtimeAcceptingRef.current = true;
          setSyncStatus('online');

          if (options?.notifyOfflineFlush && pendingBeforePush > 0) {
            notify(`Офлайн-изменения (${pendingBeforePush}) успешно отправлены в облако`);
          }

          return { ok: true };
        }
      } finally {
        isSyncingRef.current = false;
        if (mountedRef.current) {
          setIsSyncing(false);
        }

        if (
          scheduleAutoRetry &&
          mountedRef.current &&
          (syncMetaRef.current.hasPendingChanges || loadSyncMeta().hasPendingChanges)
        ) {
          retryAttemptsRef.current += 1;
          clearRetryTimer();
          retryTimerRef.current = window.setTimeout(() => {
            retryTimerRef.current = null;
            if (
              mountedRef.current &&
              (typeof navigator === 'undefined' || navigator.onLine) &&
              (syncMetaRef.current.hasPendingChanges || loadSyncMeta().hasPendingChanges)
            ) {
              void pushLocalChangesToCloud({
                force: true,
                notifyOfflineFlush: true,
              });
            }
          }, RETRY_DELAY_MS);
        }
      }
    },
    [clearRetryTimer, notify, urlClientState.isLockedClient]
  );

  /**
   * Strict Offline-First reconciliation on startup, `window 'online'`,
   * `document 'visibilitychange'`, or Realtime reconnect.
   */
  const reconcileWithCloud = useCallback(
    async (reason: 'startup' | 'online' | 'visibility' | 'realtime-reconnect') => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      clearRetryTimer();

      if (reason === 'online' || reason === 'visibility') {
        retryAttemptsRef.current = 0;
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        restConnectedRef.current = false;
        realtimeAcceptingRef.current = false;
        if (mountedRef.current) {
          setSyncStatus('offline');
        }
        return;
      }

      const currentMeta = loadSyncMeta();
      const effectivePending =
        currentMeta.hasPendingChanges || syncMetaRef.current.hasPendingChanges;

      if (isSyncingRef.current) {
        if (effectivePending) {
          needsResyncAfterCurrentRef.current = true;
        }
        return;
      }

      if (currentMeta.hasPendingChanges && !syncMetaRef.current.hasPendingChanges) {
        syncMetaRef.current = currentMeta;
        if (mountedRef.current) {
          setSyncMeta(currentMeta);
        }
      }

      // STEP 1 & 2: Pending local edits ALWAYS push first; NEVER download over them!
      if (effectivePending && !urlClientState.isLockedClient) {
        realtimeAcceptingRef.current = false;
        if (lastKnownCloudDataRef.current) {
          const backup = saveLastCloudSnapshot(lastKnownCloudDataRef.current);
          if (backup && mountedRef.current) {
            setLastCloudSnapshotAt(backup.savedAt);
          }
        }
        await pushLocalChangesToCloud({
          force: true,
          notifyOfflineFlush: reason !== 'startup',
        });
        return;
      }

      // STEP 3: No pending local changes -> safe to fetch fresh state from cloud
      isSyncingRef.current = true;
      realtimeAcceptingRef.current = false;
      needsResyncAfterCurrentRef.current = false;

      if (mountedRef.current) {
        setIsSyncing(true);
        setSyncStatus(reason === 'startup' ? 'connecting' : 'syncing');
      }

      let shouldPushAfterFetch = false;

      try {
        const res = await fetchStudioState();
        if (!mountedRef.current) return;

        // Re-check dirty flag after network roundtrip: NEVER overwrite mid-flight local edits!
        if (
          syncMetaRef.current.hasPendingChanges ||
          loadSyncMeta().hasPendingChanges ||
          needsResyncAfterCurrentRef.current
        ) {
          shouldPushAfterFetch = true;
          return;
        }

        if (!res.ok) {
          restConnectedRef.current = false;
          realtimeAcceptingRef.current = false;
          setLastSyncError(res.error || null);
          setSyncStatus('offline');
          return;
        }

        setLastSyncError(null);

        if (res.data) {
          const isUntouchedLegacyV1Demo =
            !urlClientState.isLockedClient &&
            (res.data.version || 1) < 2 &&
            res.data.projects.length === 1 &&
            res.data.projects[0]?.id === 'proj_demo_presnya' &&
            Boolean(res.data.projects[0]?.isDemo);

          if (isUntouchedLegacyV1Demo) {
            const upgradedDemo = createDemoData();
            setSyncStatus('syncing');
            const upgradeRes = await saveStudioStateRemote(upgradedDemo);
            if (!mountedRef.current) return;

            if (
              syncMetaRef.current.hasPendingChanges ||
              loadSyncMeta().hasPendingChanges ||
              needsResyncAfterCurrentRef.current
            ) {
              shouldPushAfterFetch = true;
              return;
            }

            if (upgradeRes.ok) {
              const syncedMeta = saveRemoteSnapshot(upgradedDemo);
              latestDataRef.current = upgradedDemo;
              lastKnownCloudDataRef.current = upgradedDemo;
              syncMetaRef.current = syncedMeta;
              lastSyncedJsonRef.current = JSON.stringify(upgradedDemo);
              restConnectedRef.current = true;
              realtimeAcceptingRef.current = true;
              setData(upgradedDemo);
              setSyncMeta(syncedMeta);
              setLastCloudSnapshotAt(syncedMeta.lastSyncedAt);
              setLastSyncError(null);
              setSyncStatus('online');
            } else {
              const dirtyMeta = saveLocalMutation(upgradedDemo, true, res.data);
              latestDataRef.current = upgradedDemo;
              syncMetaRef.current = dirtyMeta;
              restConnectedRef.current = false;
              realtimeAcceptingRef.current = false;
              setData(upgradedDemo);
              setSyncMeta(dirtyMeta);
              setLastSyncError(upgradeRes.error || null);
              setSyncStatus('offline');
            }
          } else {
            const safeRemoteData: AppData = {
              ...res.data,
              commercialProposals: res.data.commercialProposals ?? [],
            };
            const remoteJson = JSON.stringify(safeRemoteData);
            const syncedMeta = saveRemoteSnapshot(safeRemoteData);
            latestDataRef.current = safeRemoteData;
            lastKnownCloudDataRef.current = safeRemoteData;
            syncMetaRef.current = syncedMeta;
            lastSyncedJsonRef.current = remoteJson;
            restConnectedRef.current = true;
            realtimeAcceptingRef.current = true;
            setData(safeRemoteData);
            setSyncMeta(syncedMeta);
            setLastCloudSnapshotAt(syncedMeta.lastSyncedAt);
            setSyncStatus('online');
          }
        } else {
          const seedData = latestDataRef.current;
          if (urlClientState.isLockedClient) {
            restConnectedRef.current = true;
            realtimeAcceptingRef.current = true;
            setSyncStatus('online');
          } else {
            setSyncStatus('syncing');
            const seedRes = await saveStudioStateRemote(seedData);
            if (!mountedRef.current) return;

            if (
              syncMetaRef.current.hasPendingChanges ||
              loadSyncMeta().hasPendingChanges ||
              needsResyncAfterCurrentRef.current
            ) {
              shouldPushAfterFetch = true;
              return;
            }

            if (seedRes.ok) {
              const syncedMeta = markSyncCompleted(Date.now(), seedData);
              lastKnownCloudDataRef.current = seedData;
              syncMetaRef.current = syncedMeta;
              lastSyncedJsonRef.current = JSON.stringify(seedData);
              restConnectedRef.current = true;
              realtimeAcceptingRef.current = true;
              setSyncMeta(syncedMeta);
              setLastCloudSnapshotAt(syncedMeta.lastSyncedAt);
              setLastSyncError(null);
              setSyncStatus('online');
            } else {
              restConnectedRef.current = false;
              realtimeAcceptingRef.current = false;
              setLastSyncError(seedRes.error || null);
              setSyncStatus('offline');
            }
          }
        }
      } finally {
        isSyncingRef.current = false;
        if (mountedRef.current) {
          setIsSyncing(false);
        }
      }

      if (shouldPushAfterFetch && mountedRef.current) {
        needsResyncAfterCurrentRef.current = false;
        void pushLocalChangesToCloud({ force: true });
      }
    },
    [clearRetryTimer, pushLocalChangesToCloud, urlClientState.isLockedClient]
  );

  const schedulePushToCloud = useCallback(() => {
    if (urlClientState.isLockedClient) return;

    clearRetryTimer();

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      restConnectedRef.current = false;
      realtimeAcceptingRef.current = false;
      setSyncStatus('offline');
      return;
    }

    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }

    setSyncStatus('syncing');
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void pushLocalChangesToCloud();
    }, 200);
  }, [clearRetryTimer, pushLocalChangesToCloud, urlClientState.isLockedClient]);

  /**
   * Single entry point for ALL local user mutations.
   * Atomically saves to localStorage with `localUpdatedAt`, `hasPendingChanges: true`,
   * incremented `pendingCount`, and preserves clean baseline in `limur_last_cloud_snapshot`.
   */
  const applyLocalChange = useCallback(
    (updater: AppData | ((prev: AppData) => AppData)) => {
      const prev = latestDataRef.current;
      const wasClean = !syncMetaRef.current.hasPendingChanges && !loadSyncMeta().hasPendingChanges;
      const next = typeof updater === 'function' ? updater(prev) : updater;

      const nextMeta = saveLocalMutation(next, true, wasClean ? prev : undefined);
      if (wasClean) {
        lastKnownCloudDataRef.current = prev;
        const backup = loadLastCloudSnapshot();
        if (backup) {
          setLastCloudSnapshotAt(backup.savedAt);
        }
      }

      retryAttemptsRef.current = 0;
      latestDataRef.current = next;
      syncMetaRef.current = nextMeta;
      realtimeAcceptingRef.current = false;

      setData(next);
      setSyncMeta(nextMeta);

      schedulePushToCloud();
    },
    [schedulePushToCloud]
  );

  const handleForcePushLocalToCloud = useCallback(async () => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    clearRetryTimer();
    retryAttemptsRef.current = 0;

    const res = await pushLocalChangesToCloud({ force: true });
    if (res.ok) {
      notify('Локальные данные принудительно отправлены в Supabase');
    } else if (res.error) {
      notify(res.error.humanHint, 'error');
    } else {
      notify('Нет подключения к сети. Данные сохранены локально.', 'error');
    }
    return res;
  }, [clearRetryTimer, notify, pushLocalChangesToCloud]);

  // 1. Track component lifecycle
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
      clearRetryTimer();
    };
  }, [clearRetryTimer]);

  // 2. Startup reconciliation + Realtime subscription with strict dirty-flag gate
  useEffect(() => {
    let active = true;
    restConnectedRef.current = false;
    realtimeAcceptingRef.current = false;

    void reconcileWithCloud('startup');

    const unsubscribe = subscribeStudioState(
      (remoteData) => {
        if (!active) return;

        // STRICT BLOCK: never apply incoming cloud data while local changes are pending or syncing
        if (
          syncMetaRef.current.hasPendingChanges ||
          loadSyncMeta().hasPendingChanges ||
          isSyncingRef.current ||
          !realtimeAcceptingRef.current
        ) {
          return;
        }

        const safeRemoteData: AppData = {
          ...remoteData,
          commercialProposals: remoteData.commercialProposals ?? [],
        };
        const remoteJson = JSON.stringify(safeRemoteData);
        if (remoteJson === lastSyncedJsonRef.current) {
          return;
        }

        lastSyncedJsonRef.current = remoteJson;
        lastKnownCloudDataRef.current = safeRemoteData;
        restConnectedRef.current = true;
        latestDataRef.current = safeRemoteData;
        const syncedMeta = saveRemoteSnapshot(safeRemoteData);
        syncMetaRef.current = syncedMeta;
        setSyncMeta(syncedMeta);
        setLastCloudSnapshotAt(syncedMeta.lastSyncedAt);
        setData(safeRemoteData);
        setLastSyncError(null);
        setSyncStatus('online');
      },
      (rtStatus) => {
        if (!active) return;
        setRealtimeStatus(rtStatus);
        if (rtStatus === 'subscribed') {
          const hasDirty =
            syncMetaRef.current.hasPendingChanges || loadSyncMeta().hasPendingChanges;
          if (hasDirty || !restConnectedRef.current) {
            void reconcileWithCloud('realtime-reconnect');
          } else {
            realtimeAcceptingRef.current = true;
            setSyncStatus((curr) => (curr === 'syncing' ? curr : 'online'));
          }
        }
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [reconcileWithCloud, syncGeneration]);

  // 2b. Silent REST polling fallback when Realtime channel is unavailable (strictly respects dirty flag)
  useEffect(() => {
    if (realtimeStatus !== 'error') return;

    const timer = window.setInterval(() => {
      if (
        !mountedRef.current ||
        document.visibilityState !== 'visible' ||
        (typeof navigator !== 'undefined' && !navigator.onLine) ||
        isSyncingRef.current ||
        syncMetaRef.current.hasPendingChanges ||
        loadSyncMeta().hasPendingChanges
      ) {
        return;
      }
      void reconcileWithCloud('visibility');
    }, 30000);

    return () => {
      window.clearInterval(timer);
    };
  }, [realtimeStatus, reconcileWithCloud]);

  // 3. Browser online / offline + document visibilitychange event listeners
  useEffect(() => {
    const handleOnline = () => {
      void reconcileWithCloud('online');
    };

    const handleOffline = () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      clearRetryTimer();
      restConnectedRef.current = false;
      realtimeAcceptingRef.current = false;
      setSyncStatus('offline');
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        restConnectedRef.current = false;
        realtimeAcceptingRef.current = false;
        setSyncStatus('offline');
        return;
      }
      void reconcileWithCloud('visibility');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [clearRetryTimer, reconcileWithCloud]);

  // 4. Protect against closing/reloading tab while unsynced changes or active sync exist
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (
        syncMetaRef.current.hasPendingChanges ||
        loadSyncMeta().hasPendingChanges ||
        isSyncingRef.current
      ) {
        const message =
          'Не все изменения успели отправиться в облако. Вы уверены, что хотите закрыть страницу?';
        event.preventDefault();
        event.returnValue = message;
        return message;
      }
      return undefined;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const selectedProject = useMemo(
    () => data.projects.find((p) => p.id === selectedProjectId) || null,
    [data.projects, selectedProjectId]
  );

  const clientViewProject = useMemo(() => {
    if (urlClientState.isLockedClient) {
      if (urlClientState.projectId) {
        const matched = data.projects.find((p) => p.id === urlClientState.projectId);
        if (matched) return matched;
      }
      if (urlClientState.snapshot) {
        return urlClientState.snapshot;
      }
      return null;
    }
    if (selectedProject) return selectedProject;
    return data.projects[0] || null;
  }, [selectedProject, urlClientState, data.projects]);

  const handleCopyClientLink = useCallback(
    async (projectOverride?: Project) => {
      const target = projectOverride || selectedProject || data.projects[0];
      if (!target) {
        notify('Создайте проект, чтобы сформировать ссылку для клиента', 'error');
        return;
      }
      const shareUrl = buildClientShareUrl(target);
      const ok = await copyToClipboard(shareUrl);
      if (ok) {
        notify(`Ссылка для клиента скопирована (${target.name})`);
      } else {
        notify('Не удалось скопировать ссылку автоматически', 'error');
      }
    },
    [selectedProject, data.projects, notify]
  );

  const handleExportPdf = useCallback(
    async (target: Project | ClientSnapshot) => {
      try {
        await exportProjectFinancialPdf(target);
        notify(`PDF-отчёт сформирован (${target.name})`);
      } catch (err) {
        notify(
          err instanceof Error
            ? `Ошибка создания PDF: ${err.message}`
            : 'Не удалось сформировать PDF-отчёт',
          'error'
        );
      }
    },
    [notify]
  );

  // Commercial Proposals CRUD & Conversion
  const handleCreateProposal = () => {
    const defaultPkg = PROPOSAL_PACKAGE_PRESETS.full;
    const defaultArea = 80;
    const defaultTotal = defaultArea * defaultPkg.defaultRate;

    const nextProposal: CommercialProposal = {
      id: createId('kp'),
      number: generateNextProposalNumber(data.commercialProposals),
      createdAt: getTodayIso(),
      status: 'draft',
      clientName: '',
      clientPhone: '',
      objectTitle: '',
      city: 'Москва',
      objectType: 'residential',
      areaSqm: defaultArea,
      ratePerSqm: defaultPkg.defaultRate,
      discountAmount: 0,
      finalContractTotal: defaultTotal,
      hasMeasurementAdvance: true,
      measurementAdvanceAmount: 10000,
      paymentTemplate: '30_50_20',
      packageType: 'full',
      customDeliverables: [...defaultPkg.deliverables],
      options: {
        supervision: false,
        sourcing: false,
      },
      measurementPlanUrl: '',
      revisionRounds: 2,
      validDays: 14,
      albumFormat: 'PDF + печатный альбом А3',
    };

    applyLocalChange((prev) => ({
      ...prev,
      commercialProposals: [nextProposal, ...(prev.commercialProposals ?? [])],
    }));
    setSelectedProposalId(nextProposal.id);
    notify(`Создано коммерческое предложение ${nextProposal.number}`);
  };

  const handleUpdateProposal = (updated: CommercialProposal) => {
    applyLocalChange((prev) => ({
      ...prev,
      commercialProposals: (prev.commercialProposals ?? []).map((p) =>
        p.id === updated.id ? updated : p
      ),
    }));
  };

  const requestDeleteProposal = (proposal: CommercialProposal) => {
    setConfirmState({
      open: true,
      title: 'Удалить коммерческое предложение?',
      description: `Документ ${proposal.number}${
        proposal.objectTitle ? ` («${proposal.objectTitle}»)` : ''
      } будет удалён без возможности восстановления.`,
      confirmLabel: 'Удалить КП',
      danger: true,
      onConfirm: () => {
        applyLocalChange((prev) => ({
          ...prev,
          commercialProposals: (prev.commercialProposals ?? []).filter(
            (p) => p.id !== proposal.id
          ),
        }));
        if (selectedProposalId === proposal.id) {
          setSelectedProposalId(null);
        }
        setConfirmState((s) => ({ ...s, open: false }));
        notify(`КП ${proposal.number} удалено`);
      },
    });
  };

  const handleConvertProposalToProject = (proposal: CommercialProposal) => {
    // Prevent duplicate project creation on double click or re-trigger
    if (proposal.convertedProjectId) {
      const existingProject = data.projects.find((p) => p.id === proposal.convertedProjectId);
      if (existingProject) {
        setSelectedProjectId(existingProject.id);
        setActiveTab('projects');
        return;
      }
    }

    const todayIso = getTodayIso();
    const mappedScheme =
      proposal.paymentTemplate === '30_50_20' ? '3-stage-30-50-20' : '2-stage-50-50';
    const safeArea = Math.max(1, Number(proposal.areaSqm) || 1);
    const contractTotal = Math.max(0, Math.round(Number(proposal.finalContractTotal) || 0));
    const hasAdvance =
      proposal.hasMeasurementAdvance && Math.max(0, proposal.measurementAdvanceAmount) > 0;
    const advanceAmount = hasAdvance
      ? Math.min(contractTotal, Math.max(0, Math.round(proposal.measurementAdvanceAmount)))
      : 0;

    const paymentStages = buildPaymentStagesForScheme({
      scheme: mappedScheme,
      contractTotal,
      startDate: todayIso,
      separateMeasurementFee: hasAdvance,
      measurementFeeAmount: advanceAmount,
    });

    // Requirement: if measurement advance was included, immediately mark "Замеры" row as paid
    if (
      hasAdvance &&
      paymentStages.length > 0 &&
      paymentStages[0].title.toLowerCase().includes('замер')
    ) {
      paymentStages[0] = {
        ...paymentStages[0],
        isPaid: true,
        paidDate: todayIso,
      };
    }

    const workStages = createWorkStagesForScheme(
      mappedScheme,
      paymentStages,
      todayIso,
      data.team
    );

    const newProject: Project = {
      id: createId('proj'),
      isDemo: false,
      name: proposal.objectTitle.trim() || `Объект по ${proposal.number}`,
      address: [
        proposal.city.trim(),
        proposal.objectType === 'commercial' ? 'Коммерческое помещение' : 'Жилой интерьер',
      ]
        .filter(Boolean)
        .join(' · '),
      areaSqm: safeArea,
      ratePerSqm: Math.max(0, Number(proposal.ratePerSqm) || 0),
      contractAmount: contractTotal,
      paymentScheme: mappedScheme,
      separateMeasurementFee: hasAdvance,
      measurementFeeAmount: advanceAmount,
      status: 'В работе',
      clientContact: [proposal.clientName.trim(), proposal.clientPhone.trim()]
        .filter(Boolean)
        .join(' · '),
      startDate: todayIso,
      fotLimitPercent: data.settings.defaultFotLimitPercent,
      links: {
        proposalUrl: '',
        measurementUrl: proposal.measurementPlanUrl.trim(),
        folderUrl: '',
      },
      teamIds: data.team.slice(0, 4).map((m) => m.id),
      costLines: [],
      paymentStages,
      workStages,
    };

    applyLocalChange((prev) => ({
      ...prev,
      projects: [newProject, ...prev.projects],
      commercialProposals: (prev.commercialProposals ?? []).map((p) =>
        p.id === proposal.id
          ? { ...p, status: 'approved', convertedProjectId: newProject.id }
          : p
      ),
    }));

    setSelectedProjectId(newProject.id);
    setActiveTab('projects');
    notify(`КП ${proposal.number} согласовано — создан проект «${newProject.name}»`);
  };

  // Project CRUD
  const handleSaveProject = (project: Project, isNew: boolean) => {
    applyLocalChange((prev) => ({
      ...prev,
      projects: isNew
        ? [project, ...prev.projects]
        : prev.projects.map((p) => (p.id === project.id ? project : p)),
    }));
    if (isNew) {
      setSelectedProjectId(project.id);
      setActiveTab('projects');
      notify(`Проект «${project.name}» создан`);
    } else {
      notify('Изменения проекта сохранены');
    }
  };

  const handleUpdateProject = (updated: Project) => {
    applyLocalChange((prev) => ({
      ...prev,
      projects: prev.projects.map((p) => (p.id === updated.id ? updated : p)),
    }));
  };

  const handleQuickStatusChange = (projectId: string, status: ProjectStatus) => {
    applyLocalChange((prev) => ({
      ...prev,
      projects: prev.projects.map((p) => (p.id === projectId ? { ...p, status } : p)),
    }));
    notify(`Статус обновлён: ${status}`);
  };

  const requestDeleteProject = (project: Project) => {
    setConfirmState({
      open: true,
      title: 'Удалить объект?',
      description: `Проект «${project.name}», его этапы, задачи Ганта и связанные записи журнала будут удалены без возможности восстановления.`,
      confirmLabel: 'Удалить проект',
      danger: true,
      onConfirm: () => {
        applyLocalChange((prev) => ({
          ...prev,
          projects: prev.projects.filter((p) => p.id !== project.id),
          worklogs: prev.worklogs.filter((w) => w.projectId !== project.id),
          expenses: prev.expenses.filter((e) => e.projectId !== project.id),
        }));
        if (selectedProjectId === project.id) {
          setSelectedProjectId(null);
        }
        setConfirmState((s) => ({ ...s, open: false }));
        notify('Проект удалён');
      },
    });
  };

  const handleDeleteAllDemo = () => {
    const demoIds = new Set(
      data.projects
        .filter((p) => p.isDemo || p.name.includes('[ДЕМО]'))
        .map((p) => p.id)
    );
    applyLocalChange((prev) => ({
      ...prev,
      projects: prev.projects.filter((p) => !demoIds.has(p.id)),
      worklogs: prev.worklogs.filter((w) => !demoIds.has(w.projectId)),
      expenses: prev.expenses.filter((e) => !demoIds.has(e.projectId)),
    }));
    if (selectedProjectId && demoIds.has(selectedProjectId)) {
      setSelectedProjectId(null);
    }
    notify('Демо-шаблон удалён. Можно создавать ваши проекты');
  };

  // Team CRUD
  const handleAddMember = (member: TeamMember) => {
    applyLocalChange((prev) => ({ ...prev, team: [...prev.team, member] }));
    notify(`Добавлена должность: ${member.roleTitle}`);
  };

  const handleUpdateMember = (member: TeamMember) => {
    applyLocalChange((prev) => ({
      ...prev,
      team: prev.team.map((m) => (m.id === member.id ? member : m)),
    }));
    notify('Данные должности обновлены');
  };

  const requestDeleteMember = (member: TeamMember) => {
    setConfirmState({
      open: true,
      title: 'Удалить позицию команды?',
      description: `Должность «${member.roleTitle}» будет удалена из справочника. Существующие записи журнала останутся в истории.`,
      confirmLabel: 'Удалить',
      danger: true,
      onConfirm: () => {
        applyLocalChange((prev) => ({
          ...prev,
          team: prev.team.filter((m) => m.id !== member.id),
        }));
        setConfirmState((s) => ({ ...s, open: false }));
        notify('Должность удалена');
      },
    });
  };

  const handleUpdateSettings = (settings: StudioSettings) => {
    applyLocalChange((prev) => ({ ...prev, settings }));
    notify(`Лимит ФОТ обновлён: ${settings.defaultFotLimitPercent}%`);
  };

  // Worklogs & Expenses CRUD
  const handleAddWorklog = (entry: WorklogEntry) => {
    applyLocalChange((prev) => ({ ...prev, worklogs: [entry, ...prev.worklogs] }));
    notify('Запись выработки добавлена');
  };

  const handleUpdateWorklog = (entry: WorklogEntry) => {
    applyLocalChange((prev) => ({
      ...prev,
      worklogs: prev.worklogs.map((w) => (w.id === entry.id ? entry : w)),
    }));
    notify('Запись выработки обновлена');
  };

  const handleDeleteWorklog = (id: string) => {
    applyLocalChange((prev) => ({
      ...prev,
      worklogs: prev.worklogs.filter((w) => w.id !== id),
    }));
    notify('Запись выработки удалена');
  };

  const handleAddExpense = (expense: DirectExpense) => {
    applyLocalChange((prev) => ({ ...prev, expenses: [expense, ...prev.expenses] }));
    notify('Прямой расход добавлен');
  };

  const handleUpdateExpense = (expense: DirectExpense) => {
    applyLocalChange((prev) => ({
      ...prev,
      expenses: prev.expenses.map((e) => (e.id === expense.id ? expense : e)),
    }));
    notify('Расход обновлён');
  };

  const handleDeleteExpense = (id: string) => {
    applyLocalChange((prev) => ({
      ...prev,
      expenses: prev.expenses.filter((e) => e.id !== id),
    }));
    notify('Расход удалён');
  };

  // Locked Client View (opened via copied link ?view=client&project=...)
  if (urlClientState.isLockedClient) {
    return (
      <>
        <ClientView
          project={clientViewProject}
          isLockedClient={true}
          syncStatus={syncStatus}
          onExportPdf={handleExportPdf}
        />
        <Toast toast={toast} onDismiss={() => setToast(null)} />
      </>
    );
  }

  return (
    <div
      className={`min-h-screen bg-white text-[#0A0A0A] ${
        !isStandalone && !bannerDismissed ? 'pb-20 md:pb-0' : ''
      }`}
    >
      <Header
        role={role}
        activeTab={activeTab}
        selectedProjectName={selectedProject?.name}
        canCopyClientLink={data.projects.length > 0}
        showInstallButton={!isStandalone}
        syncStatus={syncStatus}
        hasPendingChanges={syncMeta.hasPendingChanges}
        pendingCount={syncMeta.pendingCount}
        syncErrorHint={lastSyncError?.humanHint}
        onRoleChange={(nextRole) => {
          setRole(nextRole);
          if (nextRole === 'client' && !selectedProjectId && data.projects[0]) {
            setSelectedProjectId(data.projects[0].id);
          }
        }}
        onTabChange={(tab) => {
          setActiveTab(tab);
          if (tab !== 'projects') {
            setSelectedProjectId(null);
          }
        }}
        onOpenNewProject={() => {
          setEditingProject(null);
          setProjectModalOpen(true);
        }}
        onCopyClientLink={() => handleCopyClientLink()}
        onRequestInstallApp={() => {
          void handleRequestInstallApp();
        }}
        onOpenBackup={() => setBackupModalOpen(true)}
        onOpenSupabaseSettings={() => setSupabaseModalOpen(true)}
        onGoHome={() => {
          if (role !== 'client') {
            setActiveTab('projects');
            setSelectedProjectId(null);
          }
        }}
      />

      {role === 'client' ? (
        <ClientView
          project={clientViewProject}
          allProjects={data.projects}
          isLockedClient={false}
          syncStatus={syncStatus}
          onSelectPreviewProject={(id) => setSelectedProjectId(id)}
          onExportPdf={handleExportPdf}
        />
      ) : (
        <main className="kp-print-root mx-auto max-w-[1440px] px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
          {/* Active Role Context Line */}
          <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-2 border-b border-[#D4D4D4] pb-3 text-xs text-[#525252]">
            <div>
              Режим:{' '}
              <span className="font-semibold text-[#0A0A0A]">
                {role === 'director'
                  ? 'Руководитель (полный финансовый и операционный доступ)'
                  : 'Помощник (полный операционный и финансовый доступ)'}
              </span>
            </div>
            <div className="font-mono text-[11px] font-medium tabular-nums text-[#0A0A0A]">
              Лимит ФОТ: {data.settings.defaultFotLimitPercent}%
            </div>
          </div>

          {activeTab === 'proposals' ? (
            <ProposalBuilderView
              proposals={data.commercialProposals ?? []}
              projects={data.projects}
              activeProposalId={selectedProposalId}
              onSelectProposal={(id) => setSelectedProposalId(id)}
              onCreateProposal={handleCreateProposal}
              onUpdateProposal={handleUpdateProposal}
              onRequestDeleteProposal={requestDeleteProposal}
              onConvertToProject={handleConvertProposalToProject}
              onOpenConvertedProject={(projectId) => {
                setSelectedProjectId(projectId);
                setActiveTab('projects');
              }}
              onNotify={notify}
            />
          ) : activeTab === 'projects' && selectedProject ? (
            <ProjectDetailView
              data={data}
              project={selectedProject}
              onBack={() => setSelectedProjectId(null)}
              onUpdateProject={handleUpdateProject}
              onEditProjectModal={(p) => {
                setEditingProject(p);
                setProjectModalOpen(true);
              }}
              onDeleteProject={requestDeleteProject}
              onCopyClientLink={(p) => handleCopyClientLink(p)}
              onExportPdf={handleExportPdf}
              onAddWorklog={handleAddWorklog}
              onUpdateWorklog={handleUpdateWorklog}
              onDeleteWorklog={handleDeleteWorklog}
              onAddExpense={handleAddExpense}
              onUpdateExpense={handleUpdateExpense}
              onDeleteExpense={handleDeleteExpense}
            />
          ) : activeTab === 'projects' ? (
            <StudioPulseView
              data={data}
              onSelectProject={(id) => setSelectedProjectId(id)}
              onOpenNewProject={() => {
                setEditingProject(null);
                setProjectModalOpen(true);
              }}
              onEditProject={(p) => {
                setEditingProject(p);
                setProjectModalOpen(true);
              }}
              onDeleteProject={requestDeleteProject}
              onDeleteAllDemo={handleDeleteAllDemo}
              onCopyClientLink={(p) => handleCopyClientLink(p)}
              onUpdateProjectStatus={handleQuickStatusChange}
              onOpenBackup={() => setBackupModalOpen(true)}
            />
          ) : activeTab === 'worklog' ? (
            <WorklogSection
              data={data}
              onAddWorklog={handleAddWorklog}
              onUpdateWorklog={handleUpdateWorklog}
              onDeleteWorklog={handleDeleteWorklog}
              onAddExpense={handleAddExpense}
              onUpdateExpense={handleUpdateExpense}
              onDeleteExpense={handleDeleteExpense}
            />
          ) : (
            <TeamView
              team={data.team}
              settings={data.settings}
              onAddMember={handleAddMember}
              onUpdateMember={handleUpdateMember}
              onDeleteMember={requestDeleteMember}
              onUpdateSettings={handleUpdateSettings}
            />
          )}
        </main>
      )}

      {/* Modals (Hidden on Print) */}
      <div className="no-print">
        <ProjectModal
          open={projectModalOpen}
          editingProject={editingProject}
          team={data.team}
          defaultFotLimitPercent={data.settings.defaultFotLimitPercent}
          onSave={handleSaveProject}
          onClose={() => {
            setProjectModalOpen(false);
            setEditingProject(null);
          }}
        />

        <DataBackupModal
          open={backupModalOpen}
          data={data}
          syncStatus={syncStatus}
          onClose={() => setBackupModalOpen(false)}
          onOpenSupabaseSettings={() => setSupabaseModalOpen(true)}
          onImport={(imported) => {
            applyLocalChange({
              ...imported,
              commercialProposals: imported.commercialProposals ?? [],
            });
            setSelectedProjectId(null);
          }}
          onResetEmpty={() => {
            applyLocalChange(createEmptyData());
            setSelectedProjectId(null);
            setSelectedProposalId(null);
          }}
          onRestoreDemo={() => {
            applyLocalChange(createDemoData());
            setSelectedProjectId(null);
            setSelectedProposalId(null);
          }}
          onNotify={notify}
        />

        <SupabaseSettingsModal
          open={supabaseModalOpen}
          syncStatus={syncStatus}
          realtimeStatus={realtimeStatus}
          hasPendingChanges={syncMeta.hasPendingChanges}
          pendingCount={syncMeta.pendingCount}
          localUpdatedAt={syncMeta.localUpdatedAt}
          lastSyncedAt={syncMeta.lastSyncedAt}
          lastCloudSnapshotAt={lastCloudSnapshotAt}
          isSyncing={isSyncing}
          lastSyncError={lastSyncError}
          onClose={() => setSupabaseModalOpen(false)}
          onConfigApplied={() => setSyncGeneration((g) => g + 1)}
          onForcePushLocalToCloud={handleForcePushLocalToCloud}
          onNotify={notify}
        />

        <InstallAppModal
          open={installModalOpen && !isStandalone}
          isIOS={isIOS}
          isAndroid={isAndroid}
          canPromptNative={canPromptNative}
          onTriggerNativeInstall={() => {
            void promptNativeInstall();
          }}
          onClose={() => setInstallModalOpen(false)}
        />

        <MobileInstallBanner
          visible={!isStandalone && !bannerDismissed}
          onInstall={() => {
            void handleRequestInstallApp();
          }}
          onDismiss={dismissBanner}
        />

        <ConfirmDialog
          open={confirmState.open}
          title={confirmState.title}
          description={confirmState.description}
          confirmLabel={confirmState.confirmLabel}
          danger={confirmState.danger}
          onConfirm={confirmState.onConfirm}
          onCancel={() => setConfirmState((s) => ({ ...s, open: false }))}
        />

        <Toast toast={toast} onDismiss={() => setToast(null)} />
      </div>
    </div>
  );
}
