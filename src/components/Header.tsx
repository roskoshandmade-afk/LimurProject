import React, { useState } from 'react';
import { Link2, Plus, Menu, X, Database, Smartphone } from 'lucide-react';
import { UserRole } from '../types';
import { SyncStatus } from '../utils/supabaseSync';
import { LimurLogo } from './LimurLogo';

export type WorkspaceTab = 'projects' | 'proposals' | 'worklog' | 'team';

const NAV_TABS: Array<{ id: WorkspaceTab; label: string }> = [
  { id: 'projects', label: 'Пульс студии' },
  { id: 'proposals', label: 'Конструктор КП' },
  { id: 'worklog', label: 'Журнал и расходы' },
  { id: 'team', label: 'Команда и ФОТ' },
];

interface HeaderProps {
  role: UserRole;
  activeTab: WorkspaceTab;
  selectedProjectName?: string;
  canCopyClientLink: boolean;
  showInstallButton?: boolean;
  syncStatus: SyncStatus;
  hasPendingChanges?: boolean;
  pendingCount?: number;
  syncErrorHint?: string;
  onRoleChange: (role: UserRole) => void;
  onTabChange: (tab: WorkspaceTab) => void;
  onOpenNewProject: () => void;
  onCopyClientLink: () => void;
  onRequestInstallApp?: () => void;
  onOpenBackup: () => void;
  onOpenSupabaseSettings: () => void;
  onGoHome: () => void;
}

const ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: 'director', label: 'Руководитель' },
  { value: 'assistant', label: 'Помощник' },
  { value: 'client', label: 'Клиент' },
];

export const SyncIndicator: React.FC<{
  status: SyncStatus;
  hasPendingChanges?: boolean;
  pendingCount?: number;
  errorHint?: string;
  onClick?: () => void;
}> = ({ status, hasPendingChanges = false, pendingCount = 0, errorHint, onClick }) => {
  const isSyncingState = status === 'syncing' || status === 'connecting';
  const isOfflineOrPending = !isSyncingState && (status === 'offline' || hasPendingChanges);
  const effectivePending = Math.max(pendingCount, hasPendingChanges ? 1 : 0);

  const dotClass = isSyncingState
    ? 'bg-[#2563EB] animate-pulse'
    : isOfflineOrPending
    ? effectivePending > 0
      ? 'bg-[#EA580C]'
      : 'bg-[#DC2626]'
    : 'bg-[#15803D]';

  const buttonClass = isSyncingState
    ? 'border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8] hover:bg-[#1D4ED8] hover:text-white'
    : isOfflineOrPending
    ? effectivePending > 0
      ? 'border-[#EA580C] bg-[#FFF7ED] text-[#C2410C] hover:bg-[#EA580C] hover:text-white'
      : 'border-[#DC2626] bg-[#FEF2F2] text-[#DC2626] hover:bg-[#DC2626] hover:text-white'
    : 'border-transparent text-[#525252] hover:border-[#0A0A0A] hover:text-[#0A0A0A]';

  const title = isSyncingState
    ? effectivePending > 0
      ? `Отправка офлайн-изменений (${effectivePending}) в Supabase...`
      : 'Синхронизация данных с Supabase...'
    : isOfflineOrPending
    ? effectivePending > 0
      ? `Офлайн: ${effectivePending} несинхронизированных правок сохранены локально и отправятся при восстановлении сети. ${errorHint || ''}`
      : `${errorHint || 'Нет связи с Supabase, изменения сохраняются локально'} · Нажмите для настройки`
    : 'Онлайн · Все изменения синхронизированы с Supabase · Нажмите для настроек';

  const renderLabel = () => {
    if (isSyncingState) {
      return <span>Синхронизация...</span>;
    }
    if (isOfflineOrPending) {
      if (effectivePending > 0) {
        return (
          <>
            <span className="hidden sm:inline">Офлайн (в очереди: {effectivePending})</span>
            <span className="sm:hidden">Офлайн ({effectivePending})</span>
          </>
        );
      }
      return <span>Офлайн</span>;
    }
    return <span>Онлайн</span>;
  };

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1.5 border px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${buttonClass}`}
        title={title}
      >
        <span className={`h-2 w-2 rounded-none ${dotClass}`} aria-hidden="true" />
        {renderLabel()}
      </button>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#525252] whitespace-nowrap shrink-0"
      title={title}
    >
      <span className={`h-2 w-2 rounded-none ${dotClass}`} aria-hidden="true" />
      {renderLabel()}
    </span>
  );
};

export const Header: React.FC<HeaderProps> = ({
  role,
  activeTab,
  canCopyClientLink,
  showInstallButton = false,
  syncStatus,
  hasPendingChanges = false,
  pendingCount = 0,
  syncErrorHint,
  onRoleChange,
  onTabChange,
  onOpenNewProject,
  onCopyClientLink,
  onRequestInstallApp,
  onOpenBackup,
  onOpenSupabaseSettings,
  onGoHome,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="no-print sticky top-0 z-30 border-b border-[#0A0A0A] bg-white">
      {/* Primary Top Bar */}
      <div className="mx-auto flex h-14 sm:h-16 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Brand Logo + Live Sync Status */}
        <div className="flex items-center gap-3.5 shrink-0">
          <button
            type="button"
            onClick={onGoHome}
            className="flex shrink-0 items-center transition-opacity hover:opacity-80"
            aria-label="LI.MUR PROJECT — на главную"
          >
            <LimurLogo className="h-10 w-auto shrink-0 sm:h-12" />
          </button>
          <span className="h-3.5 w-px bg-[#D4D4D4]" aria-hidden="true" />
          <SyncIndicator
            status={syncStatus}
            hasPendingChanges={hasPendingChanges}
            pendingCount={pendingCount}
            errorHint={syncErrorHint}
            onClick={role !== 'client' ? onOpenSupabaseSettings : undefined}
          />
        </div>

        {/* Zone 2: Primary Navigation (Single desktop nav from NAV_TABS; hidden for Client role) */}
        {role !== 'client' ? (
          <nav className="hidden items-center gap-5 lg:flex" aria-label="Основная навигация">
            {NAV_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={`border-b-2 py-4 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === tab.id
                    ? 'border-[#0A0A0A] text-[#0A0A0A]'
                    : 'border-transparent text-[#525252] hover:text-[#0A0A0A]'
                }`}
              >
                {tab.label}
              </button>
            ))}
            <button
              type="button"
              onClick={onOpenBackup}
              className="border-b-2 border-transparent py-4 text-xs font-medium text-[#525252] transition-colors hover:text-[#0A0A0A] whitespace-nowrap shrink-0"
            >
              Резервная копия
            </button>
          </nav>
        ) : (
          <div className="hidden text-xs font-medium text-[#525252] lg:block whitespace-nowrap">
            Режим предпросмотра для клиента
          </div>
        )}

        {/* Zone 3: Role Switcher + Primary Action (Desktop) */}
        <div className="hidden items-center gap-2 lg:flex shrink-0">
          <div
            className="flex items-center border border-[#0A0A0A] bg-[#F4F4F4] p-0.5"
            role="group"
            aria-label="Переключатель режима роли"
          >
            {ROLE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onRoleChange(opt.value)}
                className={`px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  role === opt.value
                    ? 'bg-[#0A0A0A] text-white'
                    : 'text-[#525252] hover:text-[#0A0A0A]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {canCopyClientLink && (
            <button
              type="button"
              onClick={onCopyClientLink}
              className="flex h-9 items-center gap-1.5 border border-[#0A0A0A] bg-white px-2.5 text-xs font-medium text-[#0A0A0A] transition-colors hover:bg-[#0A0A0A] hover:text-white whitespace-nowrap shrink-0"
              title="Скопировать прямую ссылку в режиме Client View без панели ролей"
            >
              <Link2 className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">Ссылка клиенту</span>
            </button>
          )}

          {showInstallButton && onRequestInstallApp && (
            <button
              type="button"
              onClick={onRequestInstallApp}
              className="flex h-9 items-center gap-1.5 border border-[#0A0A0A] bg-white px-2.5 text-xs font-medium text-[#0A0A0A] transition-colors hover:bg-[#0A0A0A] hover:text-white whitespace-nowrap shrink-0"
              title="Установить приложение LI.MUR PROJECT на телефон или ПК"
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">На телефон</span>
            </button>
          )}

          {role !== 'client' && (
            <button
              type="button"
              onClick={onOpenNewProject}
              className="flex h-9 items-center gap-1.5 bg-[#0A0A0A] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#262626] whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              Новый проект
            </button>
          )}
        </div>

        {/* Mobile / Tablet compact controls (flex lg:hidden) */}
        <div className="flex items-center gap-2 lg:hidden">
          {showInstallButton && onRequestInstallApp && (
            <button
              type="button"
              onClick={onRequestInstallApp}
              className="flex h-9 items-center gap-1 border border-[#0A0A0A] bg-white px-2.5 text-xs font-medium text-[#0A0A0A] transition-colors hover:bg-[#0A0A0A] hover:text-white whitespace-nowrap shrink-0"
              title="Скачать приложение на телефон"
              aria-label="Скачать приложение на телефон"
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">На телефон</span>
            </button>
          )}
          {role !== 'client' && (
            <button
              type="button"
              onClick={onOpenNewProject}
              className="flex h-9 items-center gap-1 bg-[#0A0A0A] px-3 text-xs font-semibold text-white whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              Проект
            </button>
          )}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center border border-[#0A0A0A] bg-white text-[#0A0A0A]"
            aria-label="Открыть меню"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Drawer (flex lg:hidden, renders from same NAV_TABS array) */}
      {mobileMenuOpen && (
        <div className="flex flex-col border-t border-[#0A0A0A] bg-white px-4 py-4 lg:hidden">
          <div className="space-y-4">
            <div>
              <div className="mb-2 text-[11px] font-medium text-[#525252]">Режим просмотра</div>
              <div className="grid grid-cols-3 border border-[#0A0A0A] bg-[#F4F4F4] p-0.5">
                {ROLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onRoleChange(opt.value);
                      setMobileMenuOpen(false);
                    }}
                    className={`py-2 text-xs font-medium transition-colors ${
                      role === opt.value
                        ? 'bg-[#0A0A0A] text-white'
                        : 'text-[#525252]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {role !== 'client' && (
              <nav className="grid grid-cols-1 gap-1 border-t border-[#D4D4D4] pt-3">
                {NAV_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      onTabChange(tab.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`flex min-h-[40px] items-center justify-between px-3 text-left text-sm ${
                      activeTab === tab.id
                        ? 'bg-[#0A0A0A] font-semibold text-white'
                        : 'text-[#0A0A0A] hover:bg-[#F4F4F4]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    onOpenBackup();
                    setMobileMenuOpen(false);
                  }}
                  className="flex min-h-[40px] items-center gap-2 px-3 text-left text-sm text-[#0A0A0A] hover:bg-[#F4F4F4]"
                >
                  <Database className="h-4 w-4" />
                  Резервная копия (JSON / Сброс)
                </button>
              </nav>
            )}

            {canCopyClientLink && (
              <div className="border-t border-[#D4D4D4] pt-3">
                <button
                  type="button"
                  onClick={() => {
                    onCopyClientLink();
                    setMobileMenuOpen(false);
                  }}
                  className="flex min-h-[42px] w-full items-center justify-center gap-2 border border-[#0A0A0A] bg-white px-4 text-xs font-semibold text-[#0A0A0A]"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Скопировать ссылку для клиента
                </button>
              </div>
            )}

            {showInstallButton && onRequestInstallApp && (
              <div className="border-t border-[#D4D4D4] pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onRequestInstallApp();
                  }}
                  className="flex min-h-[42px] w-full items-center justify-center gap-2 border border-[#0A0A0A] bg-[#0A0A0A] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#262626]"
                >
                  <Smartphone className="h-3.5 w-3.5" />
                  Скачать приложение на телефон
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
