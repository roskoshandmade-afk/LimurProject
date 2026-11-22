import React, { useMemo } from 'react';
import { ExternalLink, FileText, FolderOpen, Ruler } from 'lucide-react';
import { Project } from '../types';
import { ClientSnapshot } from '../utils/storage';
import { SyncStatus } from '../utils/supabaseSync';
import { SyncIndicator } from './Header';
import {
  formatCurrency,
  formatDate,
  formatShortDate,
} from '../utils/calculations';

interface ClientViewProps {
  project: Project | ClientSnapshot | null;
  allProjects?: Project[];
  isLockedClient: boolean;
  syncStatus?: SyncStatus;
  onSelectPreviewProject?: (projectId: string) => void;
}

function normalizeUrl(url: string): string {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

export const ClientView: React.FC<ClientViewProps> = ({
  project,
  allProjects = [],
  isLockedClient,
  syncStatus,
  onSelectPreviewProject,
}) => {
  const financials = useMemo(() => {
    if (!project) return { total: 0, paid: 0, remaining: 0, paidPct: 0 };
    const total = project.paymentStages.reduce((acc, s) => acc + (Number(s.amount) || 0), 0);
    const paid = project.paymentStages
      .filter((s) => s.isPaid)
      .reduce((acc, s) => acc + (Number(s.amount) || 0), 0);
    const remaining = Math.max(0, total - paid);
    const paidPct = total > 0 ? Math.round((paid / total) * 100) : 0;
    return { total, paid, remaining, paidPct };
  }, [project]);

  const overallProgress = useMemo(() => {
    if (!project || !project.workStages.length) return 0;
    const sum = project.workStages.reduce((acc, ws) => acc + (ws.progress || 0), 0);
    return Math.round(sum / project.workStages.length);
  }, [project]);

  const groupedWork = useMemo(() => {
    if (!project) return [];
    return project.paymentStages.map((ps) => {
      const tasks = project.workStages.filter((ws) => ws.paymentStageId === ps.id);
      const avg = tasks.length
        ? Math.round(tasks.reduce((a, t) => a + (t.progress || 0), 0) / tasks.length)
        : 0;
      return {
        stage: ps,
        tasks,
        progress: avg,
      };
    });
  }, [project]);

  return (
    <div className="min-h-screen bg-[#F7F7F6]">
      {/* Minimal locked client top line (no role switcher) */}
      {isLockedClient && (
        <header className="border-b border-[#E5E5E5] bg-white">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3.5">
              <span className="text-sm font-semibold tracking-[0.16em] text-[#0F0F0F]">
                LIMUR STUDIO
              </span>
              {syncStatus && (
                <>
                  <span className="h-3.5 w-px bg-[#E5E5E5]" aria-hidden="true" />
                  <SyncIndicator status={syncStatus} />
                </>
              )}
            </div>
            <span className="text-xs text-[#525252]">Кабинет проекта</span>
          </div>
        </header>
      )}

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        {/* Preview Project Selector (only when testing via Role Switcher, NEVER in locked client URL) */}
        {!isLockedClient && allProjects.length > 1 && onSelectPreviewProject && project && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border border-[#E5E5E5] bg-white px-4 py-3 text-xs">
            <span className="text-[#525252]">Предпросмотр экрана клиента для объекта:</span>
            <select
              value={project.id}
              onChange={(e) => onSelectPreviewProject(e.target.value)}
              className="h-8 border border-[#D4D4D4] bg-white px-2.5 text-xs font-medium text-[#0F0F0F]"
            >
              {allProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {!project ? (
          <div className="border border-[#E5E5E5] bg-white px-6 py-16 text-center">
            <h1 className="text-lg font-semibold text-[#0F0F0F]">Проект не найден</h1>
            <p className="mt-2 text-xs text-[#525252]">
              Проверьте корректность ссылки или обратитесь в студию для получения актуальной ссылки на объект.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Project Hero Header */}
            <section className="border border-[#E5E5E5] border-t-2 border-t-[#0F0F0F] bg-white p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B6B68]">
                <span className="font-medium text-[#0F0F0F]">{project.status}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums text-[#0F0F0F]">{project.areaSqm} м²</span>
                {project.address && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{project.address}</span>
                  </>
                )}
              </div>

              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[#0F0F0F] sm:text-4xl [text-wrap:balance]">
                {project.name}
              </h1>

              {/* Overall Readiness Bar */}
              <div className="mt-6">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-[#6B6B68]">Общая готовность дизайн-проекта</span>
                  <span className="font-mono text-base font-semibold tabular-nums text-[#0F0F0F]">
                    {overallProgress}%
                  </span>
                </div>
                <div className="mt-2 h-2 w-full bg-[#ECECE9]">
                  <div
                    className="h-full bg-[#0F0F0F]"
                    style={{ width: `${overallProgress}%` }}
                  />
                </div>
              </div>

              {/* Quick Material & Document Links */}
              <div className="mt-7 grid grid-cols-1 gap-3 border-t border-[#E5E5E2] pt-6 sm:grid-cols-3">
                {project.links.proposalUrl ? (
                  <a
                    href={normalizeUrl(project.links.proposalUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-[48px] items-center justify-between bg-[#0F0F0F] px-4 py-3 text-xs font-medium text-white transition-colors hover:bg-[#2A2A2A]"
                  >
                    <span className="flex items-center gap-2.5">
                      <FileText className="h-4 w-4" />
                      Коммерческое предложение
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 opacity-75" />
                  </a>
                ) : (
                  <div className="flex min-h-[48px] items-center gap-2.5 border border-[#E5E5E2] bg-[#FAF9F8] px-4 py-3 text-xs text-[#8A8A86]">
                    <FileText className="h-4 w-4" />
                    КП скоро будет добавлено
                  </div>
                )}

                {project.links.measurementUrl ? (
                  <a
                    href={normalizeUrl(project.links.measurementUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-[48px] items-center justify-between border border-[#0F0F0F] bg-white px-4 py-3 text-xs font-medium text-[#0F0F0F] transition-colors hover:bg-[#F6F6F5]"
                  >
                    <span className="flex items-center gap-2.5">
                      <Ruler className="h-4 w-4" />
                      Обмерный план
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 text-[#6B6B68]" />
                  </a>
                ) : (
                  <div className="flex min-h-[48px] items-center gap-2.5 border border-[#E5E5E2] bg-[#FAF9F8] px-4 py-3 text-xs text-[#8A8A86]">
                    <Ruler className="h-4 w-4" />
                    Обмерный план в подготовке
                  </div>
                )}

                {project.links.folderUrl ? (
                  <a
                    href={normalizeUrl(project.links.folderUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-[48px] items-center justify-between border border-[#0F0F0F] bg-white px-4 py-3 text-xs font-medium text-[#0F0F0F] transition-colors hover:bg-[#F6F6F5]"
                  >
                    <span className="flex items-center gap-2.5">
                      <FolderOpen className="h-4 w-4" />
                      Папка с материалами
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 text-[#6B6B68]" />
                  </a>
                ) : (
                  <div className="flex min-h-[48px] items-center gap-2.5 border border-[#E5E5E2] bg-[#FAF9F8] px-4 py-3 text-xs text-[#8A8A86]">
                    <FolderOpen className="h-4 w-4" />
                    Папка материалов не прикреплена
                  </div>
                )}
              </div>
            </section>

            {/* Transparent Payment Schedule */}
            <section className="border border-[#E5E5E2] bg-white">
              <div className="border-b border-[#E5E5E2] px-6 py-5">
                <h2 className="text-base font-semibold tracking-tight text-[#0F0F0F]">
                  График платежей по КП
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-px border-b border-[#E5E5E2] bg-[#E5E5E2] sm:grid-cols-3">
                <div className="bg-[#FAF9F8] px-6 py-4">
                  <div className="text-xs text-[#6B6B68]">Стоимость проекта</div>
                  <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-[#0F0F0F]">
                    {formatCurrency(financials.total)}
                  </div>
                </div>
                <div className="bg-[#FAF9F8] px-6 py-4">
                  <div className="text-xs text-[#6B6B68]">Оплачено ({financials.paidPct}%)</div>
                  <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-[#15803D]">
                    {formatCurrency(financials.paid)}
                  </div>
                </div>
                <div className="bg-[#FAF9F8] px-6 py-4">
                  <div className="text-xs text-[#6B6B68]">Остаток к оплате</div>
                  <div
                    className={`mt-1 font-mono text-xl font-semibold tabular-nums ${
                      financials.remaining > 0 ? 'text-[#B91C1C]' : 'text-[#15803D]'
                    }`}
                  >
                    {formatCurrency(financials.remaining)}
                  </div>
                </div>
              </div>

              <div className="divide-y divide-[#EFEFEC]">
                {project.paymentStages.map((ps) => (
                  <div
                    key={ps.id}
                    className="flex flex-col justify-between gap-2 px-6 py-4 sm:flex-row sm:items-center"
                  >
                    <div>
                      <div className="text-sm font-medium text-[#0F0F0F]">{ps.title}</div>
                      <div className="mt-0.5 font-mono text-xs tabular-nums text-[#6B6B68]">
                        {ps.isPaid
                          ? `Оплачено ${formatDate(ps.paidDate)}`
                          : `Плановый срок: ${formatDate(ps.dueDate)}`}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-6 sm:justify-end">
                      <span className="font-mono text-sm font-semibold tabular-nums text-[#0F0F0F]">
                        {formatCurrency(ps.amount)}
                      </span>
                      <span
                        className={`w-24 text-right text-xs font-semibold ${
                          ps.isPaid ? 'text-[#15803D]' : 'text-[#B91C1C]'
                        }`}
                      >
                        {ps.isPaid ? 'Оплачено' : 'Ожидается'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Simplified Work Progress & Timeline (No Internal Notes or Staff Info) */}
            <section className="border border-[#E5E5E2] bg-white">
              <div className="border-b border-[#E5E5E2] px-6 py-5">
                <h2 className="text-base font-semibold tracking-tight text-[#0F0F0F]">
                  Этапы работ и график выполнения
                </h2>
              </div>

              <div className="divide-y divide-[#E5E5E2]">
                {groupedWork.map(({ stage, tasks, progress }) => (
                  <div key={stage.id} className="p-6">
                    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                      <h3 className="text-sm font-semibold text-[#0F0F0F]">{stage.title}</h3>
                      <span className="font-mono text-xs font-semibold tabular-nums text-[#0F0F0F]">
                        Готовность этапа: {progress}%
                      </span>
                    </div>

                    {tasks.length === 0 ? (
                      <p className="mt-3 text-xs text-[#8A8A86]">Подэтапы формируются.</p>
                    ) : (
                      <div className="mt-4 space-y-4">
                        {tasks.map((task) => {
                          const statusText =
                            task.progress === 100
                              ? 'Выполнено'
                              : task.delayReason === 'client'
                              ? 'Ожидаем обратную связь'
                              : task.progress > 0
                              ? 'В работе'
                              : 'Запланировано';

                          const statusColor =
                            task.progress === 100
                              ? 'text-[#15803D]'
                              : task.delayReason === 'client'
                              ? 'text-[#B45309]'
                              : 'text-[#52524F]';

                          return (
                            <div key={task.id} className="space-y-1.5">
                              <div className="flex flex-col justify-between gap-1 text-xs sm:flex-row sm:items-center">
                                <span className="font-medium text-[#0F0F0F]">{task.title}</span>
                                <div className="flex items-center gap-2.5 text-[11px]">
                                  <span className="font-mono tabular-nums text-[#6B6B68]">
                                    {formatShortDate(task.planStart)} — {formatShortDate(task.planEnd)}
                                  </span>
                                  <span className="text-[#CFCFCC]">·</span>
                                  <span className={`font-medium ${statusColor}`}>{statusText}</span>
                                  <span className="font-mono font-semibold tabular-nums text-[#0F0F0F]">
                                    {task.progress}%
                                  </span>
                                </div>
                              </div>
                              <div className="h-1.5 w-full bg-[#ECECE9]">
                                <div
                                  className={`h-full ${
                                    task.progress === 100
                                      ? 'bg-[#15803D]'
                                      : task.delayReason === 'client'
                                      ? 'bg-[#D97706]'
                                      : 'bg-[#0F0F0F]'
                                  }`}
                                  style={{ width: `${task.progress}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
};
