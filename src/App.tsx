import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ConfirmDialog } from './components/ConfirmDialog';
import { ClientView } from './components/ClientView';
import { DataBackupModal } from './components/DataBackupModal';
import { Header, WorkspaceTab } from './components/Header';
import { ProjectDetailView } from './components/ProjectDetailView';
import { ProjectModal } from './components/ProjectModal';
import { StudioPulseView } from './components/StudioPulseView';
import { SupabaseSettingsModal } from './components/SupabaseSettingsModal';
import { TeamView } from './components/TeamView';
import { Toast, ToastMessage } from './components/Toast';
import { WorklogSection } from './components/WorklogSection';
import { createDemoData, createEmptyData } from './data/demoData';
import {
  AppData,
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
  parseClientUrlParams,
  saveAppData,
} from './utils/storage';
import { exportProjectFinancialPdf } from './utils/exportProjectPdf';
import {
  fetchStudioState,
  RealtimeStatus,
  saveStudioStateRemote,
  subscribeStudioState,
  SupabaseSyncError,
  SyncStatus,
} from './utils/supabaseSync';

export default function App() {
  const urlClientState = useMemo(() => parseClientUrlParams(), []);

  const [data, setData] = useState<AppData>(() => loadAppData());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('connecting');
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

  // Sync guards to prevent redundant write-backs on remote updates
  const isHydratedRef = useRef(false);
  const restConnectedRef = useRef(false);
  const lastSyncedJsonRef = useRef<string>('');
  const saveTimerRef = useRef<number | null>(null);
  const latestDataRef = useRef<AppData>(data);
  latestDataRef.current = data;

  // Modals & notifications
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [backupModalOpen, setBackupModalOpen] = useState(false);
  const [supabaseModalOpen, setSupabaseModalOpen] = useState(false);
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

  // 1. Initial hydration from Supabase `studio_state` (id = 'main') + Realtime subscription
  useEffect(() => {
    let active = true;
    restConnectedRef.current = false;

    const initSync = async () => {
      setSyncStatus('connecting');
      const res = await fetchStudioState();
      if (!active) return;

      if (!res.ok) {
        // Offline / unreachable fallback — keep localStorage state active & preserve exact error
        isHydratedRef.current = true;
        restConnectedRef.current = false;
        setLastSyncError(res.error || null);
        setSyncStatus('offline');
        return;
      }

      setLastSyncError(null);

      if (res.data) {
        const remoteJson = JSON.stringify(res.data);
        lastSyncedJsonRef.current = remoteJson;
        isHydratedRef.current = true;
        restConnectedRef.current = true;
        setData(res.data);
        saveAppData(res.data);
        setSyncStatus('online');
      } else {
        // `payload` is empty in Supabase — seed with current local data (unless read-only client view)
        const seedData = latestDataRef.current;
        if (urlClientState.isLockedClient) {
          isHydratedRef.current = true;
          restConnectedRef.current = true;
          setSyncStatus('online');
        } else {
          setSyncStatus('syncing');
          const seedRes = await saveStudioStateRemote(seedData);
          if (!active) return;
          if (seedRes.ok) {
            lastSyncedJsonRef.current = JSON.stringify(seedData);
            restConnectedRef.current = true;
            setLastSyncError(null);
            setSyncStatus('online');
          } else {
            restConnectedRef.current = false;
            setLastSyncError(seedRes.error || null);
            setSyncStatus('offline');
          }
          isHydratedRef.current = true;
        }
      }
    };

    void initSync();

    // Subscribe to realtime updates on `studio_state` (`id=eq.main`)
    // Note: Realtime WebSocket errors do NOT override a healthy REST connection to 'offline'.
    const unsubscribe = subscribeStudioState(
      (remoteData) => {
        if (!active) return;
        const remoteJson = JSON.stringify(remoteData);
        if (remoteJson === lastSyncedJsonRef.current) {
          return;
        }
        lastSyncedJsonRef.current = remoteJson;
        restConnectedRef.current = true;
        saveAppData(remoteData);
        setData(remoteData);
        setLastSyncError(null);
        setSyncStatus('online');
      },
      (rtStatus) => {
        if (!active) return;
        setRealtimeStatus(rtStatus);
        if (rtStatus === 'subscribed' && restConnectedRef.current) {
          setSyncStatus((curr) => (curr === 'syncing' ? curr : 'online'));
        }
      }
    );

    return () => {
      active = false;
      unsubscribe();
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [urlClientState.isLockedClient, syncGeneration]);

  // 2. Persist locally immediately & sync any local mutation to Supabase `studio_state` (`id = 'main'`)
  useEffect(() => {
    saveAppData(data);

    if (!isHydratedRef.current || urlClientState.isLockedClient) {
      return;
    }

    const serialized = JSON.stringify(data);
    if (serialized === lastSyncedJsonRef.current) {
      return;
    }

    setSyncStatus('syncing');
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(async () => {
      const res = await saveStudioStateRemote(data);
      if (res.ok) {
        lastSyncedJsonRef.current = serialized;
        restConnectedRef.current = true;
        setLastSyncError(null);
        setSyncStatus('online');
      } else {
        restConnectedRef.current = false;
        setLastSyncError(res.error || null);
        setSyncStatus('offline');
      }
    }, 220);
  }, [data, urlClientState.isLockedClient]);

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

  // Project CRUD
  const handleSaveProject = (project: Project, isNew: boolean) => {
    setData((prev) => ({
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
    setData((prev) => ({
      ...prev,
      projects: prev.projects.map((p) => (p.id === updated.id ? updated : p)),
    }));
  };

  const handleQuickStatusChange = (projectId: string, status: ProjectStatus) => {
    setData((prev) => ({
      ...prev,
      projects: prev.projects.map((p) =>
        p.id === projectId ? { ...p, status } : p
      ),
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
        setData((prev) => ({
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
    setData((prev) => ({
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
    setData((prev) => ({ ...prev, team: [...prev.team, member] }));
    notify(`Добавлена должность: ${member.roleTitle}`);
  };

  const handleUpdateMember = (member: TeamMember) => {
    setData((prev) => ({
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
        setData((prev) => ({
          ...prev,
          team: prev.team.filter((m) => m.id !== member.id),
        }));
        setConfirmState((s) => ({ ...s, open: false }));
        notify('Должность удалена');
      },
    });
  };

  const handleUpdateSettings = (settings: StudioSettings) => {
    setData((prev) => ({ ...prev, settings }));
    notify(`Лимит ФОТ обновлён: ${settings.defaultFotLimitPercent}%`);
  };

  // Worklogs & Expenses CRUD
  const handleAddWorklog = (entry: WorklogEntry) => {
    setData((prev) => ({ ...prev, worklogs: [entry, ...prev.worklogs] }));
    notify('Запись выработки добавлена');
  };

  const handleUpdateWorklog = (entry: WorklogEntry) => {
    setData((prev) => ({
      ...prev,
      worklogs: prev.worklogs.map((w) => (w.id === entry.id ? entry : w)),
    }));
    notify('Запись выработки обновлена');
  };

  const handleDeleteWorklog = (id: string) => {
    setData((prev) => ({
      ...prev,
      worklogs: prev.worklogs.filter((w) => w.id !== id),
    }));
    notify('Запись выработки удалена');
  };

  const handleAddExpense = (expense: DirectExpense) => {
    setData((prev) => ({ ...prev, expenses: [expense, ...prev.expenses] }));
    notify('Прямой расход добавлен');
  };

  const handleUpdateExpense = (expense: DirectExpense) => {
    setData((prev) => ({
      ...prev,
      expenses: prev.expenses.map((e) => (e.id === expense.id ? expense : e)),
    }));
    notify('Расход обновлён');
  };

  const handleDeleteExpense = (id: string) => {
    setData((prev) => ({
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
    <div className="min-h-screen bg-white text-[#0A0A0A]">
      <Header
        role={role}
        activeTab={activeTab}
        selectedProjectName={selectedProject?.name}
        canCopyClientLink={data.projects.length > 0}
        syncStatus={syncStatus}
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
        <main className="mx-auto max-w-[1440px] px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
          {/* Active Role Context Line */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-2 border-b border-[#D4D4D4] pb-3 text-xs text-[#525252]">
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

          {activeTab === 'projects' && selectedProject ? (
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

      {/* Modals */}
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
          setData(imported);
          setSelectedProjectId(null);
        }}
        onResetEmpty={() => {
          setData(createEmptyData());
          setSelectedProjectId(null);
        }}
        onRestoreDemo={() => {
          setData(createDemoData());
          setSelectedProjectId(null);
        }}
        onNotify={notify}
      />

      <SupabaseSettingsModal
        open={supabaseModalOpen}
        syncStatus={syncStatus}
        realtimeStatus={realtimeStatus}
        lastSyncError={lastSyncError}
        onClose={() => setSupabaseModalOpen(false)}
        onConfigApplied={() => setSyncGeneration((g) => g + 1)}
        onNotify={notify}
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
  );
}
