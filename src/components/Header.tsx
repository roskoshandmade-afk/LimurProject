import React, { useState } from 'react';
import { Link2, Plus, Menu, X, Database } from 'lucide-react';
import { UserRole } from '../types';
import { SyncStatus } from '../utils/supabaseSync';

export type WorkspaceTab = 'projects' | 'worklog' | 'team';

interface HeaderProps {
  role: UserRole;
  activeTab: WorkspaceTab;
  selectedProjectName?: string;
  canCopyClientLink: boolean;
  syncStatus: SyncStatus;
  onRoleChange: (role: UserRole) => void;
  onTabChange: (tab: WorkspaceTab) => void;
  onOpenNewProject: () => void;
  onCopyClientLink: () => void;
  onOpenBackup: () => void;
  onGoHome: () => void;
}

const ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: 'director', label: 'Руководитель' },
  { value: 'assistant', label: 'Помощник' },
  { value: 'client', label: 'Клиент' },
];

export const SyncIndicator: React.FC<{ status: SyncStatus }> = ({ status }) => {
  const dotClass =
    status === 'online'
      ? 'bg-[#16A34A]'
      : status === 'syncing'
      ? 'bg-[#B45309] animate-pulse'
      : status === 'connecting'
      ? 'bg-[#A3A3A3] animate-pulse'
      : 'bg-[#B91C1C]';

  const label =
    status === 'online'
      ? 'Онлайн'
      : status === 'syncing'
      ? 'Синхронизация...'
      : status === 'connecting'
      ? 'Подключение...'
      : 'Офлайн';

  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#525252] whitespace-nowrap shrink-0"
      title={
        status === 'online'
          ? 'Синхронизация в реальном времени активна'
          : status === 'syncing'
          ? 'Сохранение изменений в облако'
          : status === 'offline'
          ? 'Нет связи с сервером, изменения сохранены локально'
          : 'Подключение к серверу синхронизации'
      }
    >
      <span className={`h-2 w-2 rounded-full ${dotClass}`} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
};

export const Header: React.FC<HeaderProps> = ({
  role,
  activeTab,
  canCopyClientLink,
  syncStatus,
  onRoleChange,
  onTabChange,
  onOpenNewProject,
  onCopyClientLink,
  onOpenBackup,
  onGoHome,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-[#E5E5E5] bg-white">
      {/* Primary Top Bar */}
      <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Brand Wordmark + Live Sync Status */}
        <div className="flex items-center gap-3.5 shrink-0">
          <button
            type="button"
            onClick={onGoHome}
            className="text-left text-sm font-semibold tracking-[0.16em] text-[#0F0F0F] transition-opacity hover:opacity-75 whitespace-nowrap shrink-0"
          >
            LIMUR STUDIO OS
          </button>
          <span className="h-3.5 w-px bg-[#E5E5E5]" aria-hidden="true" />
          <SyncIndicator status={syncStatus} />
        </div>

        {/* Zone 2: Primary Navigation (Desktop, hidden for Client role) */}
        {role !== 'client' ? (
          <nav className="hidden items-center gap-6 md:flex">
            <button
              type="button"
              onClick={() => onTabChange('projects')}
              className={`border-b-2 py-4 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'projects'
                  ? 'border-[#0F0F0F] text-[#0F0F0F]'
                  : 'border-transparent text-[#525252] hover:text-[#0F0F0F]'
              }`}
            >
              Пульс студии
            </button>
            <button
              type="button"
              onClick={() => onTabChange('worklog')}
              className={`border-b-2 py-4 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'worklog'
                  ? 'border-[#0F0F0F] text-[#0F0F0F]'
                  : 'border-transparent text-[#525252] hover:text-[#0F0F0F]'
              }`}
            >
              Журнал и расходы
            </button>
            <button
              type="button"
              onClick={() => onTabChange('team')}
              className={`border-b-2 py-4 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'team'
                  ? 'border-[#0F0F0F] text-[#0F0F0F]'
                  : 'border-transparent text-[#525252] hover:text-[#0F0F0F]'
              }`}
            >
              Команда и ФОТ
            </button>
            <button
              type="button"
              onClick={onOpenBackup}
              className="border-b-2 border-transparent py-4 text-xs font-medium text-[#525252] transition-colors hover:text-[#0F0F0F] whitespace-nowrap shrink-0"
            >
              Резервная копия
            </button>
          </nav>
        ) : (
          <div className="hidden text-xs text-[#525252] md:block whitespace-nowrap">
            Режим предпросмотра для клиента
          </div>
        )}

        {/* Zone 3: Role Switcher + Primary Action (Desktop) */}
        <div className="hidden items-center gap-3 lg:flex shrink-0">
          <div
            className="flex items-center border border-[#E5E5E5] bg-[#F7F7F6] p-0.5"
            role="group"
            aria-label="Переключатель режима роли"
          >
            {ROLE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onRoleChange(opt.value)}
                className={`px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  role === opt.value
                    ? 'bg-[#0F0F0F] text-white'
                    : 'text-[#525252] hover:text-[#0F0F0F]'
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
              className="flex h-9 items-center gap-1.5 border border-[#D4D4D4] bg-white px-3 text-xs font-medium text-[#0F0F0F] transition-colors hover:border-[#0F0F0F] hover:bg-[#F7F7F6] whitespace-nowrap shrink-0"
              title="Скопировать прямую ссылку в режиме Client View без панели ролей"
            >
              <Link2 className="h-3.5 w-3.5" />
              Ссылка клиенту
            </button>
          )}

          {role !== 'client' && (
            <button
              type="button"
              onClick={onOpenNewProject}
              className="flex h-9 items-center gap-1.5 bg-[#0F0F0F] px-3.5 text-xs font-medium text-white transition-colors hover:bg-[#262626] whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              Новый проект
            </button>
          )}
        </div>

        {/* Mobile / Tablet compact controls */}
        <div className="flex items-center gap-2 lg:hidden">
          {role !== 'client' && (
            <button
              type="button"
              onClick={onOpenNewProject}
              className="flex h-9 items-center gap-1 bg-[#0F0F0F] px-3 text-xs font-medium text-white whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              Проект
            </button>
          )}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center border border-[#E5E5E5] bg-white text-[#0F0F0F]"
            aria-label="Открыть меню"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Drawer */}
      {mobileMenuOpen && (
        <div className="border-t border-[#E5E5E2] bg-white px-4 py-4 lg:hidden">
          <div className="space-y-4">
            <div>
              <div className="mb-2 text-[11px] font-medium text-[#6B6B68]">Режим просмотра</div>
              <div className="grid grid-cols-3 border border-[#E5E5E2] bg-[#F6F6F5] p-0.5">
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
                        ? 'bg-[#0F0F0F] text-white'
                        : 'text-[#6B6B68]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {role !== 'client' && (
              <div className="grid grid-cols-1 gap-1 border-t border-[#E5E5E2] pt-3">
                <button
                  type="button"
                  onClick={() => {
                    onTabChange('projects');
                    setMobileMenuOpen(false);
                  }}
                  className={`flex min-h-[40px] items-center justify-between px-3 text-left text-sm ${
                    activeTab === 'projects'
                      ? 'bg-[#F6F6F5] font-semibold text-[#0F0F0F]'
                      : 'text-[#52524F]'
                  }`}
                >
                  Пульс проектов
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onTabChange('worklog');
                    setMobileMenuOpen(false);
                  }}
                  className={`flex min-h-[40px] items-center justify-between px-3 text-left text-sm ${
                    activeTab === 'worklog'
                      ? 'bg-[#F6F6F5] font-semibold text-[#0F0F0F]'
                      : 'text-[#52524F]'
                  }`}
                >
                  Журнал выработки и расходов
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onTabChange('team');
                    setMobileMenuOpen(false);
                  }}
                  className={`flex min-h-[40px] items-center justify-between px-3 text-left text-sm ${
                    activeTab === 'team'
                      ? 'bg-[#F6F6F5] font-semibold text-[#0F0F0F]'
                      : 'text-[#52524F]'
                  }`}
                >
                  Команда и лимит ФОТ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onOpenBackup();
                    setMobileMenuOpen(false);
                  }}
                  className="flex min-h-[40px] items-center gap-2 px-3 text-left text-sm text-[#52524F]"
                >
                  <Database className="h-4 w-4" />
                  Резервная копия (JSON / Сброс)
                </button>
              </div>
            )}

            {canCopyClientLink && (
              <div className="border-t border-[#E5E5E2] pt-3">
                <button
                  type="button"
                  onClick={() => {
                    onCopyClientLink();
                    setMobileMenuOpen(false);
                  }}
                  className="flex min-h-[42px] w-full items-center justify-center gap-2 border border-[#0F0F0F] bg-white px-4 text-xs font-medium text-[#0F0F0F]"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Скопировать ссылку для клиента
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
