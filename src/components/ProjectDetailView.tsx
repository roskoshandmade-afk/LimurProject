import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ExternalLink,
  FolderOpen,
  FileText,
  Link2,
  Pencil,
  Plus,
  Ruler,
  Trash2,
  X,
} from 'lucide-react';
import { createId } from '../data/demoData';
import {
  AppData,
  DirectExpense,
  PaymentStage,
  Project,
  ProjectStatus,
  WorkSubStage,
  WorklogEntry,
} from '../types';
import {
  calculateProjectFinance,
  formatCurrency,
  formatDate,
  getProjectProgress,
  getTodayIso,
} from '../utils/calculations';
import { GanttChart } from './GanttChart';
import { ProjectAnalytics } from './ProjectAnalytics';
import { WorklogSection } from './WorklogSection';

interface ProjectDetailViewProps {
  data: AppData;
  project: Project;
  onBack: () => void;
  onUpdateProject: (updated: Project) => void;
  onEditProjectModal: (project: Project) => void;
  onDeleteProject: (project: Project) => void;
  onCopyClientLink: (project: Project) => void;
  onAddWorklog: (entry: WorklogEntry) => void;
  onUpdateWorklog: (entry: WorklogEntry) => void;
  onDeleteWorklog: (id: string) => void;
  onAddExpense: (expense: DirectExpense) => void;
  onUpdateExpense: (expense: DirectExpense) => void;
  onDeleteExpense: (id: string) => void;
}

const STATUSES: ProjectStatus[] = ['В работе', 'На паузе', 'Заморожен', 'Сдан'];

function normalizeUrl(url: string): string {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

export const ProjectDetailView: React.FC<ProjectDetailViewProps> = ({
  data,
  project,
  onBack,
  onUpdateProject,
  onEditProjectModal,
  onDeleteProject,
  onCopyClientLink,
  onAddWorklog,
  onUpdateWorklog,
  onDeleteWorklog,
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
}) => {
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [stageTitle, setStageTitle] = useState('');
  const [stageAmount, setStageAmount] = useState('');
  const [stageDueDate, setStageDueDate] = useState('');
  const [addingStage, setAddingStage] = useState(false);

  const finance = useMemo(() => calculateProjectFinance(data, project), [data, project]);
  const progress = useMemo(() => getProjectProgress(project), [project]);
  const todayIso = getTodayIso();

  const handleStatusChange = (status: ProjectStatus) => {
    onUpdateProject({ ...project, status });
  };

  const handleTogglePayment = (stageId: string) => {
    const nextStages = project.paymentStages.map((ps) => {
      if (ps.id !== stageId) return ps;
      const nextPaid = !ps.isPaid;
      return {
        ...ps,
        isPaid: nextPaid,
        paidDate: nextPaid ? ps.paidDate || todayIso : '',
      };
    });
    onUpdateProject({ ...project, paymentStages: nextStages });
  };

  const handlePaidDateChange = (stageId: string, paidDate: string) => {
    const nextStages = project.paymentStages.map((ps) =>
      ps.id === stageId ? { ...ps, paidDate } : ps
    );
    onUpdateProject({ ...project, paymentStages: nextStages });
  };

  const startEditStage = (ps: PaymentStage) => {
    setAddingStage(false);
    setEditingStageId(ps.id);
    setStageTitle(ps.title);
    setStageAmount(String(ps.amount));
    setStageDueDate(ps.dueDate);
  };

  const startAddStage = () => {
    setEditingStageId(null);
    setAddingStage(true);
    setStageTitle(`Этап ${project.paymentStages.length + 1}. `);
    setStageAmount('0');
    setStageDueDate(todayIso);
  };

  const saveStageEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stageTitle.trim()) return;
    const amt = Math.max(0, Number(stageAmount) || 0);

    if (addingStage) {
      const nextStage: PaymentStage = {
        id: createId('ps'),
        order: project.paymentStages.length + 1,
        title: stageTitle.trim(),
        amount: amt,
        dueDate: stageDueDate || todayIso,
        isPaid: false,
        paidDate: '',
      };
      onUpdateProject({
        ...project,
        paymentStages: [...project.paymentStages, nextStage],
      });
    } else if (editingStageId) {
      const nextStages = project.paymentStages.map((ps) =>
        ps.id === editingStageId
          ? {
              ...ps,
              title: stageTitle.trim(),
              amount: amt,
              dueDate: stageDueDate,
            }
          : ps
      );
      onUpdateProject({ ...project, paymentStages: nextStages });
    }
    setEditingStageId(null);
    setAddingStage(false);
  };

  const deletePaymentStage = (stageId: string) => {
    const nextStages = project.paymentStages
      .filter((ps) => ps.id !== stageId)
      .map((ps, idx) => ({ ...ps, order: idx + 1 }));
    onUpdateProject({ ...project, paymentStages: nextStages });
  };

  const handleUpdateWorkStages = (workStages: WorkSubStage[]) => {
    onUpdateProject({ ...project, workStages });
  };

  return (
    <div className="space-y-8">
      {/* Breadcrumb Back Action */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-medium text-[#52524F] transition-colors hover:text-[#0F0F0F]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Все проекты
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onCopyClientLink(project)}
            className="flex h-9 items-center gap-1.5 border border-[#0F0F0F] bg-white px-3.5 text-xs font-medium text-[#0F0F0F] transition-colors hover:bg-[#0F0F0F] hover:text-white whitespace-nowrap"
          >
            <Link2 className="h-3.5 w-3.5" />
            Скопировать ссылку для клиента
          </button>
          <button
            type="button"
            onClick={() => onEditProjectModal(project)}
            className="flex h-9 items-center gap-1.5 border border-[#D4D4D0] bg-white px-3.5 text-xs font-medium text-[#0F0F0F] transition-colors hover:border-[#0F0F0F] whitespace-nowrap"
          >
            <Pencil className="h-3.5 w-3.5" />
            Редактировать
          </button>
          <button
            type="button"
            onClick={() => onDeleteProject(project)}
            className="flex h-9 w-9 items-center justify-center border border-[#D4D4D0] bg-white text-[#6B6B68] transition-colors hover:border-[#B91C1C] hover:text-[#B91C1C]"
            aria-label="Удалить проект"
            title="Удалить проект"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Block 1: Project Passport & Quick Links */}
      <section aria-label="Паспорт объекта" className="border border-[#E5E5E5] border-t-2 border-t-[#0F0F0F] bg-white p-6">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#525252]">
              <span>Старт {formatDate(project.startDate)}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono font-medium tabular-nums text-[#0F0F0F]">
                {project.areaSqm} м²
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-[#0F0F0F]">Готовность {progress}%</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">Лимит ФОТ {project.fotLimitPercent}%</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#0F0F0F] sm:text-3xl">
              {project.name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#525252]">
              <span>{project.address || 'Адрес не указан'}</span>
              {project.clientContact && (
                <>
                  <span className="text-[#D4D4D4]">/</span>
                  <span>Клиент: {project.clientContact}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <label htmlFor="project-status-select" className="text-xs text-[#525252] whitespace-nowrap">
                Статус:
              </label>
              <select
                id="project-status-select"
                value={project.status}
                onChange={(e) => handleStatusChange(e.target.value as ProjectStatus)}
                className="h-9 border border-[#0F0F0F] bg-white px-3 text-xs font-medium text-[#0F0F0F] focus:outline-none"
              >
                {STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Quick Links Row */}
        <div className="mt-6 grid grid-cols-1 gap-3 border-t border-[#E5E5E5] pt-5 sm:grid-cols-3">
          {project.links.proposalUrl ? (
            <a
              href={normalizeUrl(project.links.proposalUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[44px] items-center justify-between border border-[#E5E5E5] bg-[#F7F7F6] px-4 py-2.5 text-xs font-medium text-[#0F0F0F] transition-colors hover:border-[#0F0F0F] hover:bg-white"
            >
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#525252]" />
                Коммерческое предложение (КП)
              </span>
              <ExternalLink className="h-3.5 w-3.5 text-[#737373]" />
            </a>
          ) : (
            <button
              type="button"
              onClick={() => onEditProjectModal(project)}
              className="flex min-h-[44px] items-center justify-between border border-dashed border-[#D4D4D4] bg-white px-4 py-2.5 text-xs text-[#737373] transition-colors hover:border-[#0F0F0F] hover:text-[#0F0F0F]"
            >
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Добавить ссылку на КП
              </span>
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}

          {project.links.measurementUrl ? (
            <a
              href={normalizeUrl(project.links.measurementUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[44px] items-center justify-between border border-[#E5E5E5] bg-[#F7F7F6] px-4 py-2.5 text-xs font-medium text-[#0F0F0F] transition-colors hover:border-[#0F0F0F] hover:bg-white"
            >
              <span className="flex items-center gap-2">
                <Ruler className="h-4 w-4 text-[#525252]" />
                Обмерный план
              </span>
              <ExternalLink className="h-3.5 w-3.5 text-[#737373]" />
            </a>
          ) : (
            <button
              type="button"
              onClick={() => onEditProjectModal(project)}
              className="flex min-h-[44px] items-center justify-between border border-dashed border-[#D4D4D4] bg-white px-4 py-2.5 text-xs text-[#737373] transition-colors hover:border-[#0F0F0F] hover:text-[#0F0F0F]"
            >
              <span className="flex items-center gap-2">
                <Ruler className="h-4 w-4" />
                Добавить обмерный план
              </span>
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}

          {project.links.folderUrl ? (
            <a
              href={normalizeUrl(project.links.folderUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[44px] items-center justify-between border border-[#E5E5E5] bg-[#F7F7F6] px-4 py-2.5 text-xs font-medium text-[#0F0F0F] transition-colors hover:border-[#0F0F0F] hover:bg-white"
            >
              <span className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-[#525252]" />
                Папка с материалами
              </span>
              <ExternalLink className="h-3.5 w-3.5 text-[#737373]" />
            </a>
          ) : (
            <button
              type="button"
              onClick={() => onEditProjectModal(project)}
              className="flex min-h-[44px] items-center justify-between border border-dashed border-[#D4D4D4] bg-white px-4 py-2.5 text-xs text-[#737373] transition-colors hover:border-[#0F0F0F] hover:text-[#0F0F0F]"
            >
              <span className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                Добавить папку исходников
              </span>
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </section>

      {/* Block 2: Payment Schedule by KP */}
      <section aria-label="Финансы по КП" className="border border-[#E5E5E5] bg-white">
        <div className="flex flex-col justify-between gap-4 border-b border-[#E5E5E5] px-5 py-4 sm:flex-row sm:items-center">
          <div>
            <div className="text-[11px] text-[#737373]">График расчётов</div>
            <h2 className="mt-0.5 text-base font-semibold tracking-tight text-[#0F0F0F]">
              Финансы по КП · Этапы оплаты
            </h2>
          </div>
          <button
            type="button"
            onClick={startAddStage}
            className="flex h-9 items-center gap-1.5 self-start border border-[#0F0F0F] bg-white px-3.5 text-xs font-medium text-[#0F0F0F] transition-colors hover:bg-[#0F0F0F] hover:text-white sm:self-auto whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            Этап оплаты
          </button>
        </div>

        {/* Summary Strip */}
        <div className="grid grid-cols-1 gap-px border-b border-[#E5E5E5] bg-[#E5E5E5] sm:grid-cols-3">
          <div className="bg-[#F7F7F6] px-5 py-3.5">
            <div className="text-[11px] text-[#525252]">Всего по КП</div>
            <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-[#0F0F0F]">
              {formatCurrency(finance.contractTotal)}
            </div>
          </div>
          <div className="bg-[#F7F7F6] px-5 py-3.5">
            <div className="text-[11px] text-[#525252]">Оплачено ({finance.paidPercent}%)</div>
            <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-[#15803D]">
              {formatCurrency(finance.paidTotal)}
            </div>
          </div>
          <div className="bg-[#F7F7F6] px-5 py-3.5">
            <div className="text-[11px] text-[#525252]">Остаток на сегодня</div>
            <div
              className={`mt-1 font-mono text-lg font-semibold tabular-nums ${
                finance.remainingTotal > 0 ? 'text-[#0F0F0F]' : 'text-[#15803D]'
              }`}
            >
              {formatCurrency(finance.remainingTotal)}
            </div>
          </div>
        </div>

        {/* Inline Add/Edit Stage Form */}
        {(addingStage || editingStageId) && (
          <form
            onSubmit={saveStageEdit}
            className="border-b border-[#0F0F0F] bg-[#F7F7F6] px-5 py-4"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-end">
              <div className="sm:col-span-5">
                <label className="mb-1 block text-[11px] text-[#525252]">Название этапа</label>
                <input
                  type="text"
                  required
                  value={stageTitle}
                  onChange={(e) => setStageTitle(e.target.value)}
                  className="h-9 w-full border border-[#D4D4D4] bg-white px-3 text-xs text-[#0F0F0F]"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="mb-1 block text-[11px] text-[#525252]">Сумма, ₽</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="1000"
                  value={stageAmount}
                  onChange={(e) => setStageAmount(e.target.value)}
                  className="h-9 w-full border border-[#D4D4D4] bg-white px-3 font-mono text-xs tabular-nums text-[#0F0F0F]"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-[11px] text-[#525252]">План. срок</label>
                <input
                  type="date"
                  value={stageDueDate}
                  onChange={(e) => setStageDueDate(e.target.value)}
                  className="h-9 w-full border border-[#D4D4D4] bg-white px-2 font-mono text-[11px] text-[#0F0F0F]"
                />
              </div>
              <div className="flex items-center gap-1.5 sm:col-span-2">
                <button
                  type="submit"
                  className="flex h-9 flex-1 items-center justify-center bg-[#0F0F0F] px-3 text-xs font-medium text-white"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddingStage(false);
                    setEditingStageId(null);
                  }}
                  className="flex h-9 w-9 items-center justify-center border border-[#D4D4D4] bg-white text-[#525252]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Payment Stages Table (Sticky Left Column on Mobile) */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[#E5E5E5] text-[11px] font-medium text-[#525252]">
                <th className="sticky left-0 z-10 border-r border-[#E5E5E5] bg-white px-5 py-3">
                  Этап оплаты
                </th>
                <th className="px-4 py-3 text-right">Сумма</th>
                <th className="px-4 py-3">Срок по КП</th>
                <th className="px-4 py-3">Статус оплаты</th>
                <th className="px-4 py-3">Дата поступления</th>
                <th className="px-5 py-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFEFED] text-xs">
              {project.paymentStages.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-[#525252]">
                    Этапы оплаты ещё не добавлены.
                  </td>
                </tr>
              ) : (
                project.paymentStages.map((ps) => {
                  const isOverdue = !ps.isPaid && ps.dueDate && ps.dueDate < todayIso;
                  return (
                    <tr key={ps.id} className="group hover:bg-[#F7F7F6]">
                      <td className="sticky left-0 z-10 border-r border-[#E5E5E5] bg-white px-5 py-3.5 font-medium text-[#0F0F0F] group-hover:bg-[#F7F7F6]">
                        {ps.title}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-semibold tabular-nums text-[#0F0F0F] whitespace-nowrap">
                        {formatCurrency(ps.amount)}
                      </td>
                      <td
                        className={`px-4 py-3.5 font-mono tabular-nums whitespace-nowrap ${
                          isOverdue ? 'font-medium text-[#B91C1C]' : 'text-[#525252]'
                        }`}
                      >
                        {formatDate(ps.dueDate)}
                        {isOverdue && <span className="ml-1.5 font-sans text-[11px]">(просрочено)</span>}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <label className="inline-flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={ps.isPaid}
                            onChange={() => handleTogglePayment(ps.id)}
                            className="h-4 w-4 accent-[#0F0F0F]"
                          />
                          <span
                            className={
                              ps.isPaid
                                ? 'font-medium text-[#15803D]'
                                : 'font-medium text-[#B91C1C]'
                            }
                          >
                            {ps.isPaid ? 'Оплачено' : 'Ожидается'}
                          </span>
                        </label>
                      </td>
                      <td className="px-4 py-3.5">
                        {ps.isPaid ? (
                          <input
                            type="date"
                            value={ps.paidDate}
                            onChange={(e) => handlePaidDateChange(ps.id, e.target.value)}
                            className="h-8 border border-[#E5E5E5] bg-white px-2 font-mono text-[11px] text-[#0F0F0F]"
                          />
                        ) : (
                          <span className="text-[#A3A3A3]">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => startEditStage(ps)}
                            className="flex h-7 w-7 items-center justify-center border border-[#E5E5E5] bg-white text-[#525252] hover:border-[#0F0F0F] hover:text-[#0F0F0F]"
                            aria-label="Редактировать этап"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deletePaymentStage(ps.id)}
                            className="flex h-7 w-7 items-center justify-center border border-[#E5E5E5] bg-white text-[#737373] hover:border-[#B91C1C] hover:text-[#B91C1C]"
                            aria-label="Удалить этап"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Block 3: Interactive Gantt Chart */}
      <GanttChart
        project={project}
        team={data.team}
        onUpdateWorkStages={handleUpdateWorkStages}
      />

      {/* Block 4: Analytics & Two Architectural Charts */}
      <ProjectAnalytics
        project={project}
        finance={finance}
        defaultFotLimitPercent={data.settings.defaultFotLimitPercent}
        onUpdateProject={onUpdateProject}
      />

      {/* Block 5: Project Worklog & Direct Expenses */}
      <div className="space-y-3 border-t border-[#0F0F0F] pt-6">
        <div>
          <div className="text-[11px] text-[#737373]">Первичные данные</div>
          <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-[#0F0F0F]">
            Журнал выработки и прямых расходов объекта
          </h2>
          <p className="mt-0.5 text-xs text-[#525252]">
            Записи выработки автоматически обновляют распределение окладов и графики бюджета выше
          </p>
        </div>
        <WorklogSection
          data={data}
          fixedProjectId={project.id}
          onAddWorklog={onAddWorklog}
          onUpdateWorklog={onUpdateWorklog}
          onDeleteWorklog={onDeleteWorklog}
          onAddExpense={onAddExpense}
          onUpdateExpense={onUpdateExpense}
          onDeleteExpense={onDeleteExpense}
        />
      </div>
    </div>
  );
};
