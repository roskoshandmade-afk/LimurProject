import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  LayoutGrid,
  Link2,
  Pencil,
  Plus,
  Search,
  Table2,
  Trash2,
} from 'lucide-react';
import { AppData, Project, ProjectStatus } from '../types';
import {
  calculateStudioPulse,
  formatCurrency,
  getProjectProgress,
} from '../utils/calculations';
import { ArchitecturalDonutChart, DonutSlice } from './ArchitecturalDonutChart';

interface StudioPulseViewProps {
  data: AppData;
  onSelectProject: (projectId: string) => void;
  onOpenNewProject: () => void;
  onEditProject: (project: Project) => void;
  onDeleteProject: (project: Project) => void;
  onDeleteAllDemo: () => void;
  onCopyClientLink: (project: Project) => void;
  onOpenBackup: () => void;
}

const STATUS_FILTERS: Array<'Все' | ProjectStatus> = [
  'Все',
  'В работе',
  'На паузе',
  'Заморожен',
  'Сдан',
];

const STUDIO_DONUT_COLORS = [
  '#0F0F0F',
  '#404040',
  '#737373',
  '#A3A3A3',
  '#D4D4D4',
  '#E5E5E5',
];

function getStatusColorClass(status: ProjectStatus): string {
  switch (status) {
    case 'В работе':
      return 'text-[#0F0F0F] font-medium';
    case 'Сдан':
      return 'text-[#15803D] font-medium';
    case 'На паузе':
      return 'text-[#B45309] font-medium';
    case 'Заморожен':
      return 'text-[#737373]';
  }
}

function getTrafficSignal(level: 'ok' | 'warning' | 'critical'): {
  label: string;
  textClass: string;
  barClass: string;
} {
  if (level === 'critical') {
    return {
      label: 'Зона риска',
      textClass: 'text-[#B91C1C]',
      barClass: 'bg-[#B91C1C]',
    };
  }
  if (level === 'warning') {
    return {
      label: 'Внимание',
      textClass: 'text-[#B45309]',
      barClass: 'bg-[#B45309]',
    };
  }
  return {
    label: 'В графике',
    textClass: 'text-[#15803D]',
    barClass: 'bg-[#15803D]',
  };
}

export const StudioPulseView: React.FC<StudioPulseViewProps> = ({
  data,
  onSelectProject,
  onOpenNewProject,
  onEditProject,
  onDeleteProject,
  onDeleteAllDemo,
  onCopyClientLink,
  onOpenBackup,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Все' | ProjectStatus>('Все');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  const pulse = useMemo(() => calculateStudioPulse(data), [data]);

  const demoProjects = useMemo(
    () => data.projects.filter((p) => p.isDemo || p.name.includes('[ДЕМО]')),
    [data.projects]
  );

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.projects.filter((p) => {
      if (statusFilter !== 'Все' && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q) ||
        p.clientContact.toLowerCase().includes(q)
      );
    });
  }, [data.projects, search, statusFilter]);

  // Max financial value across all projects for normalized 3-bar comparative chart
  const maxProjectChartValue = useMemo(() => {
    let maxVal = 1;
    for (const p of data.projects) {
      const f = pulse.projectFinances[p.id];
      if (!f) continue;
      maxVal = Math.max(maxVal, f.contractTotal, f.paidTotal, f.totalCosts);
    }
    return maxVal;
  }, [data.projects, pulse.projectFinances]);

  const studioCostSlices: DonutSlice[] = useMemo(
    () =>
      pulse.studioCostBreakdown.map((item, idx) => ({
        id: item.group,
        label: item.group,
        value: item.amount,
        percent: item.percent,
        color: STUDIO_DONUT_COLORS[idx % STUDIO_DONUT_COLORS.length],
      })),
    [pulse.studioCostBreakdown]
  );

  const paidOverallPct =
    pulse.totalContract > 0
      ? Math.round((pulse.totalPaid / pulse.totalContract) * 100)
      : 0;
  const totalOutflow = pulse.totalCosts + pulse.unallocatedCurrentMonthSalary;

  return (
    <div className="space-y-10">
      {/* Editorial Hero Header */}
      <div className="flex flex-col justify-between gap-5 border-b border-[#0F0F0F] pb-6 md:flex-row md:items-end">
        <div>
          <div className="text-xs text-[#525252]">
            Сводный аналитический дашборд · {data.projects.length}{' '}
            {data.projects.length === 1 ? 'объект' : 'объектов'} ·{' '}
            <span className="font-mono tabular-nums text-[#0F0F0F]">
              {pulse.totalAreaSqm} м²
            </span>
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#0F0F0F] sm:text-4xl">
            Пульс студии
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenBackup}
            className="min-h-[40px] border border-[#D4D4D4] bg-white px-4 py-2 text-xs font-medium text-[#0F0F0F] transition-colors hover:border-[#0F0F0F] whitespace-nowrap shrink-0"
          >
            Резервная копия JSON
          </button>
          <button
            type="button"
            onClick={onOpenNewProject}
            className="flex min-h-[40px] items-center gap-1.5 bg-[#0F0F0F] px-5 py-2 text-xs font-medium text-white transition-colors hover:bg-[#262626] whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            Новый проект
          </button>
        </div>
      </div>

      {/* Demo Template Notice */}
      {demoProjects.length > 0 && (
        <div className="flex flex-col items-start justify-between gap-3 border border-[#E5E5E5] bg-white px-5 py-4 sm:flex-row sm:items-center">
          <p className="text-xs leading-relaxed text-[#525252]">
            <span className="font-semibold text-[#0F0F0F]">Активен демонстрационный шаблон.</span>{' '}
            Загружен 1 пример объекта для проверки графиков, Ганта и формулы распределения окладов. Вы можете удалить его в один клик.
          </p>
          <button
            type="button"
            onClick={onDeleteAllDemo}
            className="min-h-[36px] border border-[#0F0F0F] bg-white px-3.5 py-1.5 text-xs font-medium text-[#0F0F0F] transition-colors hover:bg-[#0F0F0F] hover:text-white whitespace-nowrap shrink-0"
          >
            Удалить [ДЕМО] и начать с нуля
          </button>
        </div>
      )}

      {/* 1. Top 4 Editorial KPI Cards */}
      <section aria-label="Ключевые показатели студии">
        <div className="grid grid-cols-1 gap-px border border-[#E5E5E5] bg-[#E5E5E5] sm:grid-cols-2 xl:grid-cols-4">
          {/* KPI 1: Objects Portfolio */}
          <div className="flex flex-col justify-between bg-white p-6">
            <div>
              <div className="text-xs text-[#525252]">01. Объекты студии</div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-mono text-3xl font-semibold tabular-nums text-[#0F0F0F]">
                  {pulse.activeProjectsCount}
                </span>
                <span className="text-xs text-[#525252]">в работе</span>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2 border-t border-[#E5E5E5] pt-3.5 text-xs">
              <div>
                <div className="text-[11px] text-[#737373]">На паузе / заморожены</div>
                <div className="mt-0.5 font-mono font-semibold tabular-nums text-[#0F0F0F]">
                  {pulse.pausedProjectsCount}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#737373]">В зоне риска</div>
                <div
                  className={`mt-0.5 font-mono font-semibold tabular-nums ${
                    pulse.riskProjectsCount > 0 ? 'text-[#B91C1C]' : 'text-[#15803D]'
                  }`}
                >
                  {pulse.riskProjectsCount}
                </div>
              </div>
            </div>
          </div>

          {/* KPI 2: Revenue by KP (Received vs Receivables) */}
          <div className="flex flex-col justify-between bg-white p-6">
            <div>
              <div className="text-xs text-[#525252]">02. Выручка по КП</div>
              <div className="mt-3 font-mono text-3xl font-semibold tabular-nums text-[#0F0F0F]">
                {formatCurrency(pulse.totalContract)}
              </div>
              <div className="mt-3 h-1.5 w-full bg-[#ECECE9]">
                <div
                  className="h-full bg-[#15803D]"
                  style={{ width: `${paidOverallPct}%` }}
                />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[#E5E5E5] pt-3.5 text-xs">
              <div>
                <div className="text-[11px] text-[#737373]">Получено ({paidOverallPct}%)</div>
                <div className="mt-0.5 font-mono font-semibold tabular-nums text-[#15803D]">
                  {formatCurrency(pulse.totalPaid)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#737373]">Остаток к получению</div>
                <div className="mt-0.5 font-mono font-semibold tabular-nums text-[#0F0F0F]">
                  {formatCurrency(pulse.totalReceivables)}
                </div>
              </div>
            </div>
          </div>

          {/* KPI 3: Total Team Costs & Expenses */}
          <div className="flex flex-col justify-between bg-white p-6">
            <div>
              <div className="text-xs text-[#525252]">03. Затраты на команду и чеки</div>
              <div className="mt-3 font-mono text-3xl font-semibold tabular-nums text-[#0F0F0F]">
                {formatCurrency(totalOutflow)}
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2 border-t border-[#E5E5E5] pt-3.5 text-xs">
              <div>
                <div className="text-[11px] text-[#737373]">Оклады</div>
                <div className="mt-0.5 font-mono font-medium tabular-nums text-[#0F0F0F]">
                  {formatCurrency(pulse.totalAllocatedSalary + pulse.unallocatedCurrentMonthSalary)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#737373]">Сдельная</div>
                <div className="mt-0.5 font-mono font-medium tabular-nums text-[#0F0F0F]">
                  {formatCurrency(pulse.totalPiecework)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#737373]">Чеки</div>
                <div className="mt-0.5 font-mono font-medium tabular-nums text-[#0F0F0F]">
                  {formatCurrency(pulse.totalDirectExpenses)}
                </div>
              </div>
            </div>
          </div>

          {/* KPI 4: Studio Cash Balance & Average Margin */}
          <div className="flex flex-col justify-between bg-white p-6">
            <div>
              <div className="text-xs text-[#525252]">04. Текущее сальдо и маржа</div>
              <div
                className={`mt-3 font-mono text-3xl font-semibold tabular-nums ${
                  pulse.cashBalance < 0 ? 'text-[#B91C1C]' : 'text-[#0F0F0F]'
                }`}
              >
                {pulse.cashBalance >= 0 ? '+' : ''}
                {formatCurrency(pulse.cashBalance)}
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2 border-t border-[#E5E5E5] pt-3.5 text-xs">
              <div>
                <div className="text-[11px] text-[#737373]">Прогноз прибыли</div>
                <div
                  className={`mt-0.5 font-mono font-semibold tabular-nums ${
                    pulse.totalMargin < 0 ? 'text-[#B91C1C]' : 'text-[#0F0F0F]'
                  }`}
                >
                  {formatCurrency(pulse.totalMargin)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#737373]">Средняя маржа</div>
                <div
                  className={`mt-0.5 font-mono font-semibold tabular-nums ${
                    pulse.averageMarginPercent < 20
                      ? 'text-[#B91C1C]'
                      : pulse.averageMarginPercent < 35
                      ? 'text-[#B45309]'
                      : 'text-[#15803D]'
                  }`}
                >
                  {pulse.averageMarginPercent.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Studio-Wide Summary Charts (Comparison Across Projects + Cost Structure Donut) */}
      {data.projects.length > 0 && (
        <section
          aria-label="Сводная аналитика по всем проектам"
          className="grid grid-cols-1 gap-6 xl:grid-cols-12"
        >
          {/* Chart A: Horizontal 3-Bar Comparison Across All Projects */}
          <div className="border border-[#E5E5E5] bg-white p-6 xl:col-span-7">
            <div className="flex flex-col justify-between gap-3 border-b border-[#E5E5E5] pb-4 sm:flex-row sm:items-end">
              <div>
                <div className="text-[11px] text-[#737373]">Сравнительный срез портфеля</div>
                <h2 className="mt-0.5 text-base font-semibold tracking-tight text-[#0F0F0F]">
                  Бюджет КП vs Получено vs Затраты по объектам
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-3.5 text-[11px] text-[#525252]">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-3.5 border border-[#A3A3A3] bg-[#E5E5E5]" />
                  Бюджет КП
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-3.5 bg-[#15803D]" />
                  Получено
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-3.5 bg-[#0F0F0F]" />
                  Затраты
                </span>
              </div>
            </div>

            <div className="mt-5 divide-y divide-[#E5E5E5]">
              {data.projects.map((project) => {
                const fin = pulse.projectFinances[project.id];
                const kpW = (fin.contractTotal / maxProjectChartValue) * 100;
                const paidW = (fin.paidTotal / maxProjectChartValue) * 100;
                const costW = (fin.totalCosts / maxProjectChartValue) * 100;
                const isDanger = fin.isOverFotLimit || fin.isNegativeMargin || fin.isCashNegative;

                return (
                  <div key={project.id} className="py-4 first:pt-1 last:pb-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectProject(project.id)}
                        className="text-left text-xs font-semibold text-[#0F0F0F] underline-offset-4 hover:underline"
                      >
                        {project.name}
                      </button>
                      <div className="flex items-center gap-2 font-mono text-[11px] tabular-nums">
                        <span className="text-[#525252]">
                          ФОТ {fin.fotPercentOfContract.toFixed(0)}% / {fin.fotLimitPercent}%
                        </span>
                        <span className="text-[#D4D4D4]">·</span>
                        <span
                          className={
                            fin.isNegativeMargin
                              ? 'font-semibold text-[#B91C1C]'
                              : fin.isCashNegative
                              ? 'font-semibold text-[#B45309]'
                              : 'font-semibold text-[#15803D]'
                          }
                        >
                          Маржа {fin.projectedMarginPercent.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* 3 Stacked Horizontal Bars */}
                    <div className="mt-2.5 space-y-1.5">
                      {/* Bar 1: Total KP Budget */}
                      <div className="grid grid-cols-12 items-center gap-2">
                        <span className="col-span-3 text-[11px] text-[#737373] sm:col-span-2">
                          КП
                        </span>
                        <div className="col-span-6 h-2.5 bg-[#F7F7F6] sm:col-span-7">
                          <div
                            className="h-full border border-[#BDBDBD] bg-[#E5E5E5]"
                            style={{ width: `${Math.max(kpW > 0 ? 1.5 : 0, kpW)}%` }}
                          />
                        </div>
                        <span className="col-span-3 text-right font-mono text-[11px] tabular-nums text-[#525252]">
                          {formatCurrency(fin.contractTotal)}
                        </span>
                      </div>

                      {/* Bar 2: Received from Client */}
                      <div className="grid grid-cols-12 items-center gap-2">
                        <span className="col-span-3 text-[11px] text-[#737373] sm:col-span-2">
                          Оплачено
                        </span>
                        <div className="col-span-6 h-2.5 bg-[#F7F7F6] sm:col-span-7">
                          <div
                            className="h-full bg-[#15803D]"
                            style={{ width: `${Math.max(paidW > 0 ? 1.5 : 0, paidW)}%` }}
                          />
                        </div>
                        <span className="col-span-3 text-right font-mono text-[11px] font-medium tabular-nums text-[#15803D]">
                          {formatCurrency(fin.paidTotal)}
                        </span>
                      </div>

                      {/* Bar 3: Team + Direct Costs */}
                      <div className="grid grid-cols-12 items-center gap-2">
                        <span className="col-span-3 text-[11px] text-[#737373] sm:col-span-2">
                          Затраты
                        </span>
                        <div className="col-span-6 h-2.5 bg-[#F7F7F6] sm:col-span-7">
                          <div
                            className={`h-full ${isDanger ? 'bg-[#B91C1C]' : 'bg-[#0F0F0F]'}`}
                            style={{ width: `${Math.max(costW > 0 ? 1.5 : 0, costW)}%` }}
                          />
                        </div>
                        <span
                          className={`col-span-3 text-right font-mono text-[11px] font-medium tabular-nums ${
                            isDanger ? 'text-[#B91C1C]' : 'text-[#0F0F0F]'
                          }`}
                        >
                          {formatCurrency(fin.totalCosts)}
                        </span>
                      </div>
                    </div>

                    {isDanger && (
                      <div className="mt-2 text-[11px] font-medium text-[#B91C1C]">
                        {fin.isNegativeMargin
                          ? 'Превышение бюджета КП — проект уходит в минус'
                          : fin.isOverFotLimit
                          ? `Превышен порог ФОТ (${fin.fotPercentOfContract.toFixed(1)}% при лимите ${fin.fotLimitPercent}%)`
                          : 'Кассовый разрыв — расходы превысили полученные от клиента оплаты'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chart B: Studio Cost Structure Donut Chart + Breakdown Table */}
          <div className="border border-[#E5E5E5] bg-white p-6 xl:col-span-5">
            <div className="border-b border-[#E5E5E5] pb-4">
              <div className="text-[11px] text-[#737373]">Распределение себестоимости</div>
              <h2 className="mt-0.5 text-base font-semibold tracking-tight text-[#0F0F0F]">
                Структура затрат студии
              </h2>
            </div>

            <div className="mt-6">
              <ArchitecturalDonutChart
                slices={studioCostSlices}
                centerLabel="Всего затрат"
                centerValue={formatCurrency(pulse.totalCosts)}
                centerSublabel="100% по объектам"
                emptyText="Затраты появятся после внесения выработки команды и чеков в журнале"
              />
            </div>

            {pulse.unallocatedCurrentMonthSalary > 0 && (
              <div className="mt-5 border-t border-[#E5E5E5] pt-3.5 text-xs text-[#B45309]">
                Нераспределённый оклад текущего месяца:{' '}
                <span className="font-mono font-semibold tabular-nums">
                  {formatCurrency(pulse.unallocatedCurrentMonthSalary)}
                </span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Risk Alerts Strip */}
      {pulse.risks.length > 0 && (
        <section aria-label="Сигналы и риски" className="border border-[#E5E5E5] bg-white">
          <div className="flex items-center justify-between border-b border-[#E5E5E5] px-5 py-3.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#0F0F0F]">
              <AlertTriangle className="h-4 w-4 text-[#B91C1C]" />
              Контроль рисков и отклонений
            </div>
            <span className="font-mono text-xs tabular-nums text-[#525252]">
              {pulse.risks.length}
            </span>
          </div>
          <div className="divide-y divide-[#E5E5E5]">
            {pulse.risks.map((risk) => (
              <div
                key={risk.id}
                className="flex flex-col justify-between gap-2 px-5 py-3.5 sm:flex-row sm:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={
                        risk.severity === 'critical'
                          ? 'font-semibold text-[#B91C1C]'
                          : 'font-semibold text-[#B45309]'
                      }
                    >
                      {risk.severity === 'critical' ? 'Критично' : 'Внимание'}
                    </span>
                    <span className="text-[#D4D4D4]">·</span>
                    <span className="font-medium text-[#0F0F0F]">{risk.title}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-[#525252]">{risk.detail}</p>
                </div>
                {risk.projectId && (
                  <button
                    type="button"
                    onClick={() => onSelectProject(risk.projectId!)}
                    className="inline-flex items-center gap-1 self-start text-xs font-medium text-[#0F0F0F] underline-offset-4 hover:underline sm:self-center whitespace-nowrap shrink-0"
                  >
                    К объекту
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3. Projects Registry with Cards / Table Switcher */}
      <section aria-label="Реестр проектов" className="space-y-4">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          {/* Status Filter Bar */}
          <div className="flex flex-wrap items-center gap-1 border border-[#E5E5E5] bg-white p-1">
            {STATUS_FILTERS.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === st
                    ? 'bg-[#0F0F0F] text-white'
                    : 'text-[#525252] hover:text-[#0F0F0F]'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Search + View Mode Switcher */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1 sm:w-64">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#737373]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск объекта или адреса..."
                className="h-10 w-full border border-[#E5E5E5] bg-white pr-3 pl-9 text-xs text-[#0F0F0F] placeholder:text-[#737373] focus:border-[#0F0F0F] focus:outline-none"
              />
            </div>

            <div
              className="flex items-center border border-[#E5E5E5] bg-white p-1 self-start sm:self-auto"
              role="group"
              aria-label="Переключатель вида списка"
            >
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`flex h-8 items-center gap-1.5 px-3 text-xs font-medium transition-colors whitespace-nowrap ${
                  viewMode === 'cards'
                    ? 'bg-[#0F0F0F] text-white'
                    : 'text-[#525252] hover:text-[#0F0F0F]'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Плитки
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`flex h-8 items-center gap-1.5 px-3 text-xs font-medium transition-colors whitespace-nowrap ${
                  viewMode === 'table'
                    ? 'bg-[#0F0F0F] text-white'
                    : 'text-[#525252] hover:text-[#0F0F0F]'
                }`}
              >
                <Table2 className="h-3.5 w-3.5" />
                Таблица
              </button>
            </div>
          </div>
        </div>

        {filteredProjects.length === 0 ? (
          <div className="border border-[#E5E5E5] bg-white px-6 py-16 text-center">
            <p className="text-sm font-medium text-[#0F0F0F]">
              {data.projects.length === 0
                ? 'Список проектов пуст'
                : 'По вашему запросу проекты не найдены'}
            </p>
            <p className="mt-1.5 text-xs text-[#525252]">
              {data.projects.length === 0
                ? 'Создайте первый объект с нуля — настройте КП, этапы Ганта и бюджет.'
                : 'Измените статус фильтрации или очистите поиск.'}
            </p>
            {data.projects.length === 0 && (
              <button
                type="button"
                onClick={onOpenNewProject}
                className="mt-5 inline-flex min-h-[40px] items-center gap-1.5 bg-[#0F0F0F] px-5 py-2 text-xs font-medium text-white hover:bg-[#262626]"
              >
                <Plus className="h-3.5 w-3.5" />
                Создать первый проект
              </button>
            )}
          </div>
        ) : viewMode === 'cards' ? (
          /* Editorial Cards Grid View */
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredProjects.map((project) => {
              const fin = pulse.projectFinances[project.id];
              const progress = getProjectProgress(project);
              const riskLevel = pulse.projectRiskLevel[project.id] || 'ok';
              const signal = getTrafficSignal(riskLevel);

              return (
                <article
                  key={project.id}
                  className="flex flex-col justify-between border border-[#E5E5E5] bg-white transition-colors hover:border-[#0F0F0F]"
                >
                  {/* Top Editorial Hairline Indicator */}
                  <div className={`h-[3px] w-full ${signal.barClass}`} />

                  <div className="flex flex-1 flex-col justify-between p-6">
                    <div>
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <div className="flex items-center gap-2 text-[#525252]">
                          <span className={getStatusColorClass(project.status)}>
                            {project.status}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums text-[#0F0F0F]">
                            {project.areaSqm} м²
                          </span>
                        </div>
                        <span className={`font-medium ${signal.textClass}`}>
                          {signal.label}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => onSelectProject(project.id)}
                        className="mt-3 block text-left"
                      >
                        <h3 className="text-base font-semibold tracking-tight text-[#0F0F0F] underline-offset-4 hover:underline">
                          {project.name}
                        </h3>
                        <p className="mt-1 text-xs text-[#525252]">
                          {project.address || 'Адрес не указан'}
                        </p>
                      </button>

                      {/* Mini Progress Bar */}
                      <div className="mt-5">
                        <div className="flex items-baseline justify-between text-[11px]">
                          <span className="text-[#737373]">Готовность проекта</span>
                          <span className="font-mono font-semibold tabular-nums text-[#0F0F0F]">
                            {progress}%
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full bg-[#ECECE9]">
                          <div
                            className="h-full bg-[#0F0F0F]"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>

                      {/* Financial Snapshot Grid */}
                      <div className="mt-5 grid grid-cols-3 gap-2 border-t border-[#E5E5E5] pt-4 text-xs">
                        <div>
                          <div className="text-[10px] text-[#737373]">КП / Оплачено</div>
                          <div className="mt-0.5 font-mono font-semibold tabular-nums text-[#0F0F0F]">
                            {formatCurrency(fin.contractTotal)}
                          </div>
                          <div className="font-mono text-[10px] tabular-nums text-[#15803D]">
                            {fin.paidPercent}% опл.
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-[#737373]">Затраты</div>
                          <div className="mt-0.5 font-mono font-semibold tabular-nums text-[#0F0F0F]">
                            {formatCurrency(fin.totalCosts)}
                          </div>
                          <div
                            className={`font-mono text-[10px] tabular-nums ${
                              fin.isOverFotLimit ? 'font-semibold text-[#B91C1C]' : 'text-[#525252]'
                            }`}
                          >
                            ФОТ {fin.fotPercentOfContract.toFixed(0)}%
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] text-[#737373]">Маржа</div>
                          <div
                            className={`mt-0.5 font-mono font-semibold tabular-nums ${
                              fin.isNegativeMargin ? 'text-[#B91C1C]' : 'text-[#0F0F0F]'
                            }`}
                          >
                            {fin.projectedMarginPercent.toFixed(1)}%
                          </div>
                          <div className="font-mono text-[10px] tabular-nums text-[#525252]">
                            {formatCurrency(fin.projectedMarginAmount)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card Action Strip */}
                    <div className="mt-5 flex items-center justify-between gap-2 border-t border-[#E5E5E5] pt-4">
                      <button
                        type="button"
                        onClick={() => onSelectProject(project.id)}
                        className="flex min-h-[38px] flex-1 items-center justify-center gap-1.5 bg-[#0F0F0F] px-3 text-xs font-medium text-white transition-colors hover:bg-[#262626]"
                      >
                        Открыть объект
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onCopyClientLink(project)}
                        className="flex h-[38px] w-[38px] items-center justify-center border border-[#E5E5E5] bg-white text-[#525252] transition-colors hover:border-[#0F0F0F] hover:text-[#0F0F0F]"
                        title="Скопировать ссылку для клиента"
                        aria-label="Скопировать ссылку для клиента"
                      >
                        <Link2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditProject(project)}
                        className="flex h-[38px] w-[38px] items-center justify-center border border-[#E5E5E5] bg-white text-[#525252] transition-colors hover:border-[#0F0F0F] hover:text-[#0F0F0F]"
                        title="Редактировать"
                        aria-label="Редактировать"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteProject(project)}
                        className="flex h-[38px] w-[38px] items-center justify-center border border-[#E5E5E5] bg-white text-[#737373] transition-colors hover:border-[#B91C1C] hover:text-[#B91C1C]"
                        title="Удалить"
                        aria-label="Удалить"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          /* Compact Summary Table with Sticky Left Column */
          <div className="overflow-x-auto border border-[#E5E5E5] bg-white">
            <table className="w-full min-w-[920px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#E5E5E5] bg-[#F7F7F6] text-[11px] font-medium text-[#525252]">
                  <th className="sticky left-0 z-10 border-r border-[#E5E5E5] bg-[#F7F7F6] px-5 py-3.5">
                    Объект
                  </th>
                  <th className="px-4 py-3.5">Статус / Светофор</th>
                  <th className="px-4 py-3.5 text-right">Готовность</th>
                  <th className="px-4 py-3.5 text-right">Бюджет КП</th>
                  <th className="px-4 py-3.5 text-right">Получено</th>
                  <th className="px-4 py-3.5 text-right">Затраты / ФОТ</th>
                  <th className="px-4 py-3.5 text-right">Маржа</th>
                  <th className="px-5 py-3.5 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E5]">
                {filteredProjects.map((project) => {
                  const fin = pulse.projectFinances[project.id];
                  const progress = getProjectProgress(project);
                  const signal = getTrafficSignal(pulse.projectRiskLevel[project.id] || 'ok');

                  return (
                    <tr key={project.id} className="group transition-colors hover:bg-[#F7F7F6]">
                      <td className="sticky left-0 z-10 border-r border-[#E5E5E5] bg-white px-5 py-3.5 group-hover:bg-[#F7F7F6]">
                        <button
                          type="button"
                          onClick={() => onSelectProject(project.id)}
                          className="text-left"
                        >
                          <div className="text-xs font-semibold text-[#0F0F0F] underline-offset-4 group-hover:underline">
                            {project.name}
                          </div>
                          <div className="mt-0.5 text-[11px] text-[#737373]">
                            {project.areaSqm} м² · {project.address || 'Без адреса'}
                          </div>
                        </button>
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className={`text-xs ${getStatusColorClass(project.status)}`}>
                          {project.status}
                        </div>
                        <div className={`mt-0.5 text-[11px] font-medium ${signal.textClass}`}>
                          {signal.label}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="font-mono text-xs font-semibold tabular-nums text-[#0F0F0F]">
                          {progress}%
                        </div>
                        <div className="mt-1 ml-auto h-1 w-16 bg-[#ECECE9]">
                          <div className="h-full bg-[#0F0F0F]" style={{ width: `${progress}%` }} />
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-right font-mono text-xs font-semibold tabular-nums text-[#0F0F0F] whitespace-nowrap">
                        {formatCurrency(fin.contractTotal)}
                      </td>

                      <td className="px-4 py-3.5 text-right font-mono text-xs tabular-nums whitespace-nowrap">
                        <div className="font-semibold text-[#15803D]">
                          {formatCurrency(fin.paidTotal)}
                        </div>
                        <div className="text-[11px] text-[#737373]">{fin.paidPercent}%</div>
                      </td>

                      <td className="px-4 py-3.5 text-right font-mono text-xs tabular-nums whitespace-nowrap">
                        <div className="font-medium text-[#0F0F0F]">
                          {formatCurrency(fin.totalCosts)}
                        </div>
                        <div
                          className={`text-[11px] ${
                            fin.isOverFotLimit ? 'font-semibold text-[#B91C1C]' : 'text-[#737373]'
                          }`}
                        >
                          ФОТ {fin.fotPercentOfContract.toFixed(1)}%
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-right font-mono text-xs tabular-nums whitespace-nowrap">
                        <div
                          className={`font-semibold ${
                            fin.isNegativeMargin ? 'text-[#B91C1C]' : 'text-[#0F0F0F]'
                          }`}
                        >
                          {formatCurrency(fin.projectedMarginAmount)}
                        </div>
                        <div
                          className={`text-[11px] ${
                            fin.projectedMarginPercent < 20 ? 'text-[#B91C1C]' : 'text-[#15803D]'
                          }`}
                        >
                          {fin.projectedMarginPercent.toFixed(1)}%
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => onSelectProject(project.id)}
                            className="h-8 bg-[#0F0F0F] px-3 text-xs font-medium text-white hover:bg-[#262626]"
                          >
                            Открыть
                          </button>
                          <button
                            type="button"
                            onClick={() => onCopyClientLink(project)}
                            className="flex h-8 w-8 items-center justify-center border border-[#E5E5E5] bg-white text-[#525252] hover:border-[#0F0F0F] hover:text-[#0F0F0F]"
                            aria-label="Ссылка клиенту"
                          >
                            <Link2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onEditProject(project)}
                            className="flex h-8 w-8 items-center justify-center border border-[#E5E5E5] bg-white text-[#525252] hover:border-[#0F0F0F] hover:text-[#0F0F0F]"
                            aria-label="Редактировать"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteProject(project)}
                            className="flex h-8 w-8 items-center justify-center border border-[#E5E5E5] bg-white text-[#737373] hover:border-[#B91C1C] hover:text-[#B91C1C]"
                            aria-label="Удалить"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
