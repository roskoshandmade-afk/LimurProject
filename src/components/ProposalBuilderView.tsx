import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  Download,
  ExternalLink,
  FileText,
  FolderKanban,
  Loader2,
  Plus,
  Printer,
  Trash2,
  X,
} from 'lucide-react';
import {
  CommercialProposal,
  CommercialProposalPackageType,
  CommercialProposalPaymentTemplate,
  CommercialProposalStatus,
  Project,
} from '../types';
import { formatCurrency, formatDate } from '../utils/calculations';
import { exportProposalPdf } from '../utils/exportProposalPdf';
import { LimurLogo } from './LimurLogo';

interface ProposalBuilderViewProps {
  proposals: CommercialProposal[];
  projects: Project[];
  activeProposalId: string | null;
  onSelectProposal: (id: string) => void;
  onCreateProposal: () => void;
  onUpdateProposal: (updated: CommercialProposal) => void;
  onRequestDeleteProposal: (proposal: CommercialProposal) => void;
  onConvertToProject: (proposal: CommercialProposal) => void;
  onOpenConvertedProject: (projectId: string) => void;
  onNotify?: (msg: string, type?: 'default' | 'error') => void;
}

export interface PackagePreset {
  id: CommercialProposalPackageType;
  title: string;
  shortTitle: string;
  defaultRate: number;
  summary: string;
  deliverables: string[];
}

export const PROPOSAL_PACKAGE_PRESETS: Record<CommercialProposalPackageType, PackagePreset> = {
  planning: {
    id: 'planning',
    title: 'Планировочное решение',
    shortTitle: 'Планировка',
    defaultRate: 1200,
    summary: 'Обмеры, 3 варианта перепланировки, план демонтажа/монтажа, расстановка мебели',
    deliverables: [
      'Обмерный план объекта и фотофиксация помещений',
      '3 варианта планировочного решения с функциональным зонированием',
      'План демонтажа и монтажа перегородок с привязками',
      'План расстановки мебели и оборудования с габаритами',
    ],
  },
  technical: {
    id: 'technical',
    title: 'Рабочий проект (Чертежи)',
    shortTitle: 'Рабочий проект',
    defaultRate: 2200,
    summary: 'Планировка + полный альбом рабочих чертежей для строителей',
    deliverables: [
      'Обмерный план и утверждённое планировочное решение',
      'Планы демонтажа, монтажа перегородок и расстановки мебели',
      'Планы полов, тёплых полов, потолков и привязки светильников',
      'Планы электрики, розеток, выключателей и групп освещения',
      'План сантехнического оборудования и развёртки стен всех помещений',
    ],
  },
  full: {
    id: 'full',
    title: 'Полный дизайн-проект',
    shortTitle: 'Полный проект',
    defaultRate: 3500,
    summary: 'Планировка + 3D-визуализация всех помещений + полный комплект чертежей + ведомость материалов',
    deliverables: [
      'Обмерный план и фотофиксация объекта',
      'Разработка планировочного решения (до 3 вариантов)',
      'Концепция, мудборды и 3D-визуализация всех помещений',
      'Полный комплект рабочей документации для строителей',
      'Ведомость отделочных материалов, мебели и освещения',
    ],
  },
};

const PACKAGE_LIST: PackagePreset[] = [
  PROPOSAL_PACKAGE_PRESETS.planning,
  PROPOSAL_PACKAGE_PRESETS.technical,
  PROPOSAL_PACKAGE_PRESETS.full,
];

const STATUS_META: Record<
  CommercialProposalStatus,
  { label: string; textClass: string; borderClass: string; bgClass: string }
> = {
  draft: {
    label: 'Черновик',
    textClass: 'text-[#525252]',
    borderClass: 'border-[#D4D4D4]',
    bgClass: 'bg-[#F8F9FA]',
  },
  sent: {
    label: 'Отправлено',
    textClass: 'text-[#B45309]',
    borderClass: 'border-[#F59E0B]',
    bgClass: 'bg-[#FFFBEB]',
  },
  approved: {
    label: 'Согласовано',
    textClass: 'text-[#15803D]',
    borderClass: 'border-[#15803D]',
    bgClass: 'bg-[#F0FDF4]',
  },
};

export interface CalculatedPaymentRow {
  key: string;
  label: string;
  percentLabel: string;
  workingDays: string;
  amount: number;
  isAdvance?: boolean;
}

export function calculateProposalSchedule(proposal: CommercialProposal): {
  safeArea: number;
  baseTotal: number;
  finalTotal: number;
  discountAmount: number;
  discountPercent: number;
  effectiveAdvance: number;
  advanceExceedsStage1: boolean;
  totalWorkingDays: number;
  rows: CalculatedPaymentRow[];
} {
  const safeArea = Math.max(1, Number(proposal.areaSqm) || 0);
  const safeRate = Math.max(0, Number(proposal.ratePerSqm) || 0);
  const baseTotal = Math.round(safeArea * safeRate);
  const finalTotal = Math.max(0, Math.round(Number(proposal.finalContractTotal) || 0));
  const discountAmount = Math.max(0, baseTotal - finalTotal);
  const discountPercent =
    baseTotal > 0 && discountAmount > 0 ? Math.round((discountAmount / baseTotal) * 1000) / 10 : 0;

  const rawAdvance = proposal.hasMeasurementAdvance
    ? Math.max(0, Math.round(Number(proposal.measurementAdvanceAmount) || 0))
    : 0;
  const effectiveAdvance = Math.min(finalTotal, rawAdvance);

  // Estimate realistic studio duration in working days based on package & area
  const areaFactor = safeArea <= 60 ? 1 : safeArea <= 120 ? 1.25 : safeArea <= 200 ? 1.55 : 1.9;
  const baseDays =
    proposal.packageType === 'planning'
      ? 10
      : proposal.packageType === 'technical'
      ? 24
      : 40;
  const totalWorkingDays = Math.round(baseDays * areaFactor);

  const rows: CalculatedPaymentRow[] = [];
  let advanceExceedsStage1 = false;

  if (proposal.hasMeasurementAdvance && effectiveAdvance > 0) {
    rows.push({
      key: 'advance',
      label: 'Аванс за выезд и обмеры (учтён в стоимости договора)',
      percentLabel: 'Замеры',
      workingDays: '1–3 р.д.',
      amount: effectiveAdvance,
      isAdvance: true,
    });
  }

  if (proposal.paymentTemplate === '30_50_20') {
    const rawStage1 = Math.round(finalTotal * 0.3);
    const rawStage2 = Math.round(finalTotal * 0.5);
    const rawStage3 = Math.max(0, finalTotal - rawStage1 - rawStage2);

    if (effectiveAdvance > rawStage1) {
      advanceExceedsStage1 = true;
    }

    const stage1 = Math.max(0, rawStage1 - effectiveAdvance);
    const excessAfter1 = Math.max(0, effectiveAdvance - rawStage1);
    const stage2 = Math.max(0, rawStage2 - excessAfter1);
    const stage3 = Math.max(0, finalTotal - effectiveAdvance - stage1 - stage2);

    const d1 = Math.max(5, Math.round(totalWorkingDays * 0.25));
    const d2 = Math.max(8, Math.round(totalWorkingDays * 0.45));
    const d3 = Math.max(5, totalWorkingDays - d1 - d2);

    rows.push(
      {
        key: 'stage1',
        label:
          effectiveAdvance > 0
            ? 'Этап 1. Планировочное решение и концепция (за вычетом аванса за замеры)'
            : 'Этап 1. Планировочное решение и концепция',
        percentLabel: '30%',
        workingDays: `${d1} р.д.`,
        amount: stage1,
      },
      {
        key: 'stage2',
        label:
          proposal.packageType === 'full'
            ? 'Этап 2. 3D-визуализация всех помещений'
            : 'Этап 2. Основной комплект рабочих чертежей',
        percentLabel: '50%',
        workingDays: `${d2} р.д.`,
        amount: stage2,
      },
      {
        key: 'stage3',
        label: 'Этап 3. Финальный альбом чертежей, ведомости и передача проекта',
        percentLabel: '20%',
        workingDays: `${d3} р.д.`,
        amount: stage3,
      }
    );
  } else {
    const rawStage1 = Math.round(finalTotal * 0.5);
    if (effectiveAdvance > rawStage1) {
      advanceExceedsStage1 = true;
    }

    const stage1 = Math.max(0, rawStage1 - effectiveAdvance);
    const stage2 = Math.max(0, finalTotal - effectiveAdvance - stage1);

    const d1 = Math.max(5, Math.round(totalWorkingDays * 0.45));
    const d2 = Math.max(5, totalWorkingDays - d1);

    rows.push(
      {
        key: 'stage1',
        label:
          effectiveAdvance > 0
            ? 'Этап 1. Планировка, концепция и старт-визуализации (за вычетом замеров)'
            : 'Этап 1. Планировка, концепция и старт-визуализации',
        percentLabel: '50%',
        workingDays: `${d1} р.д.`,
        amount: stage1,
      },
      {
        key: 'stage2',
        label: 'Этап 2. Полный комплект чертежей, ведомости и передача альбома',
        percentLabel: '50%',
        workingDays: `${d2} р.д.`,
        amount: stage2,
      }
    );
  }

  return {
    safeArea,
    baseTotal,
    finalTotal,
    discountAmount,
    discountPercent,
    effectiveAdvance,
    advanceExceedsStage1,
    totalWorkingDays,
    rows,
  };
}

function addCalendarDays(isoDate: string, days: number): string {
  const base = isoDate ? new Date(isoDate) : new Date();
  const next = new Date(base);
  next.setDate(next.getDate() + Math.max(1, days || 14));
  const y = next.getFullYear();
  const m = String(next.getMonth() + 1).padStart(2, '0');
  const d = String(next.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const ProposalBuilderView: React.FC<ProposalBuilderViewProps> = ({
  proposals,
  projects,
  activeProposalId,
  onSelectProposal,
  onCreateProposal,
  onUpdateProposal,
  onRequestDeleteProposal,
  onConvertToProject,
  onOpenConvertedProject,
  onNotify,
}) => {
  const [mobilePane, setMobilePane] = useState<'editor' | 'preview'>('editor');
  const [newDeliverableText, setNewDeliverableText] = useState('');
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const activeProposal = useMemo(() => {
    if (!proposals.length) return null;
    if (activeProposalId) {
      const found = proposals.find((p) => p.id === activeProposalId);
      if (found) return found;
    }
    return proposals[0];
  }, [proposals, activeProposalId]);

  const calc = useMemo(() => {
    if (!activeProposal) return null;
    return calculateProposalSchedule(activeProposal);
  }, [activeProposal]);

  const linkedProject = useMemo(() => {
    if (!activeProposal?.convertedProjectId) return null;
    return projects.find((p) => p.id === activeProposal.convertedProjectId) || null;
  }, [activeProposal, projects]);

  const handlePatch = (patch: Partial<CommercialProposal>) => {
    if (!activeProposal) return;
    onUpdateProposal({ ...activeProposal, ...patch });
  };

  const handleAreaOrRateChange = (nextAreaRaw: number, nextRateRaw: number) => {
    if (!activeProposal) return;
    const nextArea = Math.max(0, nextAreaRaw);
    const nextRate = Math.max(0, nextRateRaw);
    const effectiveArea = Math.max(1, nextArea);
    const nextBase = Math.round(effectiveArea * nextRate);
    const preservedDiscount = Math.min(nextBase, Math.max(0, activeProposal.discountAmount || 0));
    const nextFinal = Math.max(0, nextBase - preservedDiscount);

    onUpdateProposal({
      ...activeProposal,
      areaSqm: nextArea,
      ratePerSqm: nextRate,
      discountAmount: preservedDiscount,
      finalContractTotal: nextFinal,
    });
  };

  const handlePackageSelect = (pkgId: CommercialProposalPackageType) => {
    if (!activeProposal) return;
    const preset = PROPOSAL_PACKAGE_PRESETS[pkgId];
    const effectiveArea = Math.max(1, Number(activeProposal.areaSqm) || 0);
    const nextTotal = Math.round(effectiveArea * preset.defaultRate);

    onUpdateProposal({
      ...activeProposal,
      packageType: pkgId,
      ratePerSqm: preset.defaultRate,
      customDeliverables: [...preset.deliverables],
      discountAmount: 0,
      finalContractTotal: nextTotal,
    });
  };

  const handleFinalContractChange = (rawFinal: number) => {
    if (!activeProposal) return;
    const effectiveArea = Math.max(1, Number(activeProposal.areaSqm) || 0);
    const baseTotal = Math.round(effectiveArea * Math.max(0, activeProposal.ratePerSqm || 0));
    const nextFinal = Math.max(0, Math.round(rawFinal || 0));
    const nextDiscount = Math.max(0, baseTotal - nextFinal);

    onUpdateProposal({
      ...activeProposal,
      finalContractTotal: nextFinal,
      discountAmount: nextDiscount,
    });
  };

  const handleAddDeliverable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProposal) return;
    const trimmed = newDeliverableText.trim();
    if (!trimmed) return;
    onUpdateProposal({
      ...activeProposal,
      customDeliverables: [...activeProposal.customDeliverables, trimmed],
    });
    setNewDeliverableText('');
  };

  const handleUpdateDeliverable = (index: number, value: string) => {
    if (!activeProposal) return;
    const next = [...activeProposal.customDeliverables];
    next[index] = value;
    onUpdateProposal({ ...activeProposal, customDeliverables: next });
  };

  const handleRemoveDeliverable = (index: number) => {
    if (!activeProposal) return;
    onUpdateProposal({
      ...activeProposal,
      customDeliverables: activeProposal.customDeliverables.filter((_, idx) => idx !== index),
    });
  };

  const handleDownloadPdf = async () => {
    if (!activeProposal || !calc || downloadingPdf) return;
    setDownloadingPdf(true);
    try {
      const preset = PROPOSAL_PACKAGE_PRESETS[activeProposal.packageType];
      await exportProposalPdf({
        proposal: activeProposal,
        packageTitle: preset.title,
        calc,
      });
      onNotify?.('PDF-файл КП скачан');
    } catch (err) {
      onNotify?.(
        err instanceof Error
          ? `Не удалось сформировать PDF: ${err.message}`
          : 'Не удалось сформировать PDF-файл КП',
        'error'
      );
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handlePrintPdf = () => {
    if (!activeProposal) return;
    const previousTitle = document.title;
    const safeObj = activeProposal.objectTitle.trim() || 'Дизайн-проект';
    document.title = `LIMUR PROJECT — ${activeProposal.number} — ${safeObj}`;
    try {
      window.print();
    } catch {
      onNotify?.('Печать ограничена в окне предпросмотра — используйте кнопку «Скачать PDF»', 'error');
    }
    window.setTimeout(() => {
      document.title = previousTitle;
    }, 300);
  };

  // Empty state when no proposals exist yet
  if (!activeProposal || !calc) {
    return (
      <div className="border border-[#E5E7EB] bg-[#F8F9FA] px-6 py-16 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center border border-[#111827] bg-white text-[#0A0A0A]">
          <FileText className="h-5 w-5" />
        </div>
        <h2 className="mt-4 text-lg font-semibold tracking-tight text-[#0A0A0A]">
          Коммерческие предложения пока не созданы
        </h2>
        <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-[#525252]">
          Сформируйте первое архитектурное КП в фирменном стиле LIMUR PROJECT, рассчитайте смету с учётом замеров, экспортируйте чистый PDF формата А4 и переведите объект в работу в один клик.
        </p>
        <button
          type="button"
          onClick={onCreateProposal}
          className="mt-6 inline-flex h-10 items-center gap-2 bg-[#0A0A0A] px-5 text-xs font-semibold text-white transition-colors hover:bg-[#262626]"
        >
          <Plus className="h-4 w-4" />
          Создать первое КП
        </button>
      </div>
    );
  }

  const activePreset = PROPOSAL_PACKAGE_PRESETS[activeProposal.packageType];
  const validUntilDate = addCalendarDays(activeProposal.createdAt, activeProposal.validDays || 14);
  const areaInvalid = !activeProposal.areaSqm || activeProposal.areaSqm <= 0;
  const albumFormatText = activeProposal.albumFormat?.trim() || 'PDF + печатный альбом А3';

  return (
    <div className="kp-print-root space-y-6">
      {/* TOP TOOLBAR: Saved proposals history + primary document actions (Hidden on Print) */}
      <section className="no-print border border-[#E5E7EB] bg-[#F8F9FA] p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[#0A0A0A]">
              Конструктор коммерческих предложений
            </h1>
            <p className="mt-0.5 text-xs text-[#525252]">
              Расчёт стоимости, график платежей с вычетом замеров, печать бланка А4 и перевод объекта в работу
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onCreateProposal}
              className="flex h-9 items-center gap-1.5 border border-[#111827] bg-white px-3.5 text-xs font-semibold text-[#0A0A0A] transition-colors hover:bg-[#0A0A0A] hover:text-white whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              Новое КП
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf || areaInvalid}
              className="flex h-9 items-center gap-1.5 border border-[#111827] bg-[#111827] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-[#262626] disabled:opacity-50 whitespace-nowrap shrink-0"
              title="Сгенерировать и скачать PDF-файл формата А4 на устройство"
            >
              {downloadingPdf ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {downloadingPdf ? 'Генерация PDF...' : 'Скачать PDF'}
            </button>

            <button
              type="button"
              onClick={handlePrintPdf}
              className="flex h-9 items-center gap-1.5 border border-[#111827] bg-white px-3 text-xs font-medium text-[#0A0A0A] transition-colors hover:bg-[#0A0A0A] hover:text-white whitespace-nowrap shrink-0"
              title="Печать бланка А4 напрямую из браузера (в режиме предпросмотра iframe может быть заблокирована песочницей — используйте «Скачать PDF»)"
            >
              <Printer className="h-3.5 w-3.5" />
              Печать
            </button>

            {linkedProject ? (
              <button
                type="button"
                onClick={() => onOpenConvertedProject(linkedProject.id)}
                className="flex h-9 items-center gap-1.5 border border-[#15803D] bg-[#15803D] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#166534] whitespace-nowrap shrink-0"
              >
                <FolderKanban className="h-3.5 w-3.5" />
                Открыть проект в студии
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onConvertToProject(activeProposal)}
                disabled={areaInvalid}
                className="flex h-9 items-center gap-1.5 bg-[#0A0A0A] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#262626] disabled:opacity-40 whitespace-nowrap shrink-0"
              >
                <span>Согласовано → Создать проект в студии</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Saved Proposals Strip + Status Control + Delete */}
        <div className="mt-4 flex flex-col gap-3 border-t border-[#E5E7EB] pt-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
            {proposals.map((item) => {
              const isSelected = item.id === activeProposal.id;
              const statusInfo = STATUS_META[item.status];
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectProposal(item.id)}
                  className={`flex min-h-[42px] shrink-0 items-center gap-3 border px-3 py-1.5 text-left transition-colors ${
                    isSelected
                      ? 'border-[#111827] bg-[#111827] text-white'
                      : 'border-[#E5E7EB] bg-white text-[#0A0A0A] hover:border-[#111827]'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold">
                      <span className="font-mono tabular-nums">{item.number}</span>
                      <span
                        className={`text-[11px] font-medium ${
                          isSelected
                            ? item.status === 'approved'
                              ? 'text-[#86EFAC]'
                              : item.status === 'sent'
                              ? 'text-[#FCD34D]'
                              : 'text-[#D4D4D4]'
                            : statusInfo.textClass
                        }`}
                      >
                        · {statusInfo.label}
                      </span>
                    </div>
                    <div
                      className={`max-w-[190px] truncate text-[11px] ${
                        isSelected ? 'text-[#D4D4D4]' : 'text-[#525252]'
                      }`}
                    >
                      {item.objectTitle.trim() || 'Новый объект'} ·{' '}
                      <span className="font-mono tabular-nums">
                        {formatCurrency(item.finalContractTotal)}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div
              className="flex items-center border border-[#E5E7EB] bg-white p-0.5"
              role="group"
              aria-label="Статус КП"
            >
              {(['draft', 'sent', 'approved'] as CommercialProposalStatus[]).map((st) => {
                const isActive = activeProposal.status === st;
                const activeStyle =
                  st === 'approved'
                    ? 'bg-[#15803D] text-white'
                    : st === 'sent'
                    ? 'bg-[#D97706] text-white'
                    : 'bg-[#111827] text-white';
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => handlePatch({ status: st })}
                    className={`px-2.5 py-1.5 text-[11px] font-medium transition-colors whitespace-nowrap ${
                      isActive ? activeStyle : 'text-[#525252] hover:text-[#0A0A0A]'
                    }`}
                  >
                    {STATUS_META[st].label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => onRequestDeleteProposal(activeProposal)}
              className="flex h-9 items-center gap-1.5 border border-[#E5E7EB] bg-white px-3 text-xs font-medium text-[#525252] transition-colors hover:border-[#DC2626] hover:text-[#DC2626] whitespace-nowrap"
              title="Удалить это коммерческое предложение"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Удалить КП
            </button>
          </div>
        </div>
      </section>

      {/* Mobile Pane Toggle (< lg) */}
      <div className="no-print flex border border-[#111827] bg-[#F8F9FA] p-0.5 lg:hidden">
        <button
          type="button"
          onClick={() => setMobilePane('editor')}
          className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
            mobilePane === 'editor' ? 'bg-[#111827] text-white' : 'text-[#525252]'
          }`}
        >
          Редактор КП
        </button>
        <button
          type="button"
          onClick={() => setMobilePane('preview')}
          className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
            mobilePane === 'preview' ? 'bg-[#111827] text-white' : 'text-[#525252]'
          }`}
        >
          Предпросмотр листа А4
        </button>
      </div>

      {/* MAIN TWO-COLUMN WORKSPACE */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
        {/* LEFT COLUMN: Builder Form (Hidden on Print) */}
        <div
          className={`no-print space-y-6 lg:col-span-5 ${
            mobilePane === 'preview' ? 'hidden lg:block' : 'block'
          }`}
        >
          {/* SECTION 01: Object Passport & Client */}
          <div className="border border-[#E5E7EB] bg-white p-5">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
              <h2 className="text-sm font-semibold text-[#0A0A0A]">
                01. Паспорт объекта и заказчик
              </h2>
              <span className="font-mono text-xs tabular-nums text-[#525252]">
                {activeProposal.number}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#111827]">
                  ФИО клиента
                </label>
                <input
                  type="text"
                  value={activeProposal.clientName}
                  onChange={(e) => handlePatch({ clientName: e.target.value })}
                  placeholder="Иван Петров"
                  className="h-10 w-full border border-[#E5E7EB] bg-white px-3 text-xs text-[#0A0A0A] focus:border-[#111827] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#111827]">
                  Телефон / мессенджер
                </label>
                <input
                  type="text"
                  value={activeProposal.clientPhone}
                  onChange={(e) => handlePatch({ clientPhone: e.target.value })}
                  placeholder="+7 (999) 000-00-00 / @telegram"
                  className="h-10 w-full border border-[#E5E7EB] bg-white px-3 text-xs text-[#0A0A0A] focus:border-[#111827] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#111827]">
                  Город
                </label>
                <input
                  type="text"
                  value={activeProposal.city}
                  onChange={(e) => handlePatch({ city: e.target.value })}
                  placeholder="Москва"
                  className="h-10 w-full border border-[#E5E7EB] bg-white px-3 text-xs text-[#0A0A0A] focus:border-[#111827] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#111827]">
                  Название ЖК / объекта
                </label>
                <input
                  type="text"
                  value={activeProposal.objectTitle}
                  onChange={(e) => handlePatch({ objectTitle: e.target.value })}
                  placeholder="ЖК Лазурный берег, кв. 42"
                  className="h-10 w-full border border-[#E5E7EB] bg-white px-3 text-xs text-[#0A0A0A] focus:border-[#111827] focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-[#111827]">
                  Тип объекта
                </label>
                <div className="grid grid-cols-2 border border-[#111827] bg-[#F8F9FA] p-0.5">
                  <button
                    type="button"
                    onClick={() => handlePatch({ objectType: 'residential' })}
                    className={`py-2 text-xs font-medium transition-colors ${
                      activeProposal.objectType === 'residential'
                        ? 'bg-[#111827] text-white'
                        : 'text-[#525252] hover:text-[#0A0A0A]'
                    }`}
                  >
                    Жилой интерьер
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePatch({ objectType: 'commercial' })}
                    className={`py-2 text-xs font-medium transition-colors ${
                      activeProposal.objectType === 'commercial'
                        ? 'bg-[#111827] text-white'
                        : 'text-[#525252] hover:text-[#0A0A0A]'
                    }`}
                  >
                    Коммерческое помещение
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#111827]">
                  Площадь по обмерному плану, м²
                </label>
                <input
                  type="number"
                  min={1}
                  step="0.1"
                  value={activeProposal.areaSqm || ''}
                  onChange={(e) =>
                    handleAreaOrRateChange(
                      Math.max(0, parseFloat(e.target.value) || 0),
                      activeProposal.ratePerSqm
                    )
                  }
                  className={`h-10 w-full border px-3 font-mono text-xs tabular-nums focus:outline-none ${
                    areaInvalid
                      ? 'border-[#DC2626] bg-[#FEF2F2] text-[#DC2626]'
                      : 'border-[#E5E7EB] bg-white text-[#0A0A0A] focus:border-[#111827]'
                  }`}
                />
                {areaInvalid && (
                  <p className="mt-1 text-[11px] font-medium text-[#DC2626]">
                    Укажите площадь больше 0 м² для корректного расчёта сметы.
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#111827]">
                  Дата КП
                </label>
                <input
                  type="date"
                  value={activeProposal.createdAt}
                  onChange={(e) => handlePatch({ createdAt: e.target.value })}
                  className="h-10 w-full border border-[#E5E7EB] bg-white px-3 font-mono text-xs tabular-nums text-[#0A0A0A] focus:border-[#111827] focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-[#111827]">
                  Ссылка на обмерный план (PDF / DWG / Облако)
                </label>
                <input
                  type="text"
                  value={activeProposal.measurementPlanUrl}
                  onChange={(e) => handlePatch({ measurementPlanUrl: e.target.value })}
                  placeholder="https://disk.yandex.ru/... или Google Drive"
                  className="h-10 w-full border border-[#E5E7EB] bg-white px-3 text-xs text-[#0A0A0A] focus:border-[#111827] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* SECTION 02: Service Package & Estimate */}
          <div className="border border-[#E5E7EB] bg-white p-5">
            <div className="border-b border-[#E5E7EB] pb-3">
              <h2 className="text-sm font-semibold text-[#0A0A0A]">
                02. Пакет услуг и расчёт сметы
              </h2>
            </div>

            {/* Package Cards */}
            <div className="mt-4 space-y-2.5">
              {PACKAGE_LIST.map((pkg) => {
                const isSelected = activeProposal.packageType === pkg.id;
                return (
                  <button
                    key={pkg.id}
                    type="button"
                    onClick={() => handlePackageSelect(pkg.id)}
                    className={`w-full border p-3.5 text-left transition-colors ${
                      isSelected
                        ? 'border-[#111827] bg-[#111827] text-white'
                        : 'border-[#E5E7EB] bg-white text-[#0A0A0A] hover:border-[#111827]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold">{pkg.title}</span>
                      <span
                        className={`font-mono text-xs font-semibold tabular-nums ${
                          isSelected ? 'text-white' : 'text-[#0A0A0A]'
                        }`}
                      >
                        {formatCurrency(pkg.defaultRate)}/м²
                      </span>
                    </div>
                    <p
                      className={`mt-1 text-[11px] leading-relaxed ${
                        isSelected ? 'text-[#D4D4D4]' : 'text-[#525252]'
                      }`}
                    >
                      {pkg.summary}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Editable Rate & Final Contract Total */}
            <div className="mt-5 grid grid-cols-1 gap-4 border-t border-[#E5E7EB] pt-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#111827]">
                  Ставка, ₽/м²
                </label>
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={activeProposal.ratePerSqm}
                  onChange={(e) =>
                    handleAreaOrRateChange(
                      activeProposal.areaSqm,
                      Math.max(0, parseFloat(e.target.value) || 0)
                    )
                  }
                  className="h-10 w-full border border-[#E5E7EB] bg-white px-3 font-mono text-xs tabular-nums text-[#0A0A0A] focus:border-[#111827] focus:outline-none"
                />
                <div className="mt-1 font-mono text-[11px] tabular-nums text-[#525252]">
                  База: {calc.safeArea} м² × {formatCurrency(activeProposal.ratePerSqm)} ={' '}
                  <span className="font-semibold text-[#0A0A0A]">
                    {formatCurrency(calc.baseTotal)}
                  </span>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#111827]">
                  Итоговая сумма по договору (с округлением/скидкой), ₽
                </label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={activeProposal.finalContractTotal}
                  onChange={(e) =>
                    handleFinalContractChange(Math.max(0, parseFloat(e.target.value) || 0))
                  }
                  className="h-10 w-full border border-[#111827] bg-white px-3 font-mono text-xs font-semibold tabular-nums text-[#0A0A0A] focus:outline-none"
                />
                <div className="mt-1 flex items-center justify-between text-[11px]">
                  {calc.discountAmount > 0 ? (
                    <>
                      <span className="font-mono font-medium tabular-nums text-[#15803D]">
                        Скидка: −{formatCurrency(calc.discountAmount)} (−{calc.discountPercent}%)
                      </span>
                      <button
                        type="button"
                        onClick={() => handleFinalContractChange(calc.baseTotal)}
                        className="text-[#525252] underline hover:text-[#0A0A0A]"
                      >
                        Сбросить
                      </button>
                    </>
                  ) : calc.finalTotal > calc.baseTotal ? (
                    <span className="font-mono tabular-nums text-[#525252]">
                      Корректировка: +{formatCurrency(calc.finalTotal - calc.baseTotal)}
                    </span>
                  ) : (
                    <span className="text-[#525252]">Без скидки (по базовой ставке)</span>
                  )}
                </div>
              </div>
            </div>

            {/* Editable Deliverables */}
            <div className="mt-5 border-t border-[#E5E7EB] pt-4">
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-semibold text-[#111827]">
                  Состав работ в КП ({activeProposal.customDeliverables.length})
                </label>
              </div>
              <div className="space-y-2">
                {activeProposal.customDeliverables.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="w-5 shrink-0 font-mono text-[11px] tabular-nums text-[#737373]">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => handleUpdateDeliverable(idx, e.target.value)}
                      className="h-9 flex-1 border border-[#E5E7EB] bg-white px-2.5 text-xs text-[#0A0A0A] focus:border-[#111827] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveDeliverable(idx)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center border border-[#E5E7EB] text-[#737373] transition-colors hover:border-[#DC2626] hover:text-[#DC2626]"
                      aria-label="Удалить пункт"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <form onSubmit={handleAddDeliverable} className="mt-2.5 flex gap-2">
                <input
                  type="text"
                  value={newDeliverableText}
                  onChange={(e) => setNewDeliverableText(e.target.value)}
                  placeholder="Добавить пункт в состав работ..."
                  className="h-9 flex-1 border border-[#E5E7EB] bg-[#F8F9FA] px-3 text-xs text-[#0A0A0A] focus:border-[#111827] focus:bg-white focus:outline-none"
                />
                <button
                  type="submit"
                  className="flex h-9 items-center gap-1 border border-[#111827] bg-white px-3 text-xs font-medium text-[#0A0A0A] transition-colors hover:bg-[#111827] hover:text-white whitespace-nowrap"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Добавить
                </button>
              </form>
            </div>

            {/* Additional Options */}
            <div className="mt-5 border-t border-[#E5E7EB] pt-4">
              <div className="mb-2.5 text-xs font-semibold text-[#111827]">
                Дополнительные опции (отображаются в КП)
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <label className="flex cursor-pointer items-start gap-2.5 border border-[#E5E7EB] bg-[#F8F9FA] p-3 transition-colors hover:border-[#111827]">
                  <input
                    type="checkbox"
                    checked={activeProposal.options.supervision}
                    onChange={(e) =>
                      handlePatch({
                        options: { ...activeProposal.options, supervision: e.target.checked },
                      })
                    }
                    className="mt-0.5 h-4 w-4 accent-[#0A0A0A]"
                  />
                  <div>
                    <div className="text-xs font-semibold text-[#0A0A0A]">Авторский надзор</div>
                    <div className="mt-0.5 text-[11px] text-[#525252]">
                      Выезды на стройку, контроль соответствия чертежам
                    </div>
                  </div>
                </label>

                <label className="flex cursor-pointer items-start gap-2.5 border border-[#E5E7EB] bg-[#F8F9FA] p-3 transition-colors hover:border-[#111827]">
                  <input
                    type="checkbox"
                    checked={activeProposal.options.sourcing}
                    onChange={(e) =>
                      handlePatch({
                        options: { ...activeProposal.options, sourcing: e.target.checked },
                      })
                    }
                    className="mt-0.5 h-4 w-4 accent-[#0A0A0A]"
                  />
                  <div>
                    <div className="text-xs font-semibold text-[#0A0A0A]">Комплектация</div>
                    <div className="mt-0.5 text-[11px] text-[#525252]">
                      Подбор поставщиков, сметы, график закупок и поставок
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* SECTION 03: Payment Schedule, Measurement Advance & Terms */}
          <div className="border border-[#E5E7EB] bg-white p-5">
            <div className="border-b border-[#E5E7EB] pb-3">
              <h2 className="text-sm font-semibold text-[#0A0A0A]">
                03. График платежей и условия работы
              </h2>
            </div>

            {/* Measurement Advance Toggle */}
            <div className="mt-4 border border-[#E5E7EB] bg-[#F8F9FA] p-3.5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={activeProposal.hasMeasurementAdvance}
                    onChange={(e) =>
                      handlePatch({ hasMeasurementAdvance: e.target.checked })
                    }
                    className="h-4 w-4 accent-[#0A0A0A]"
                  />
                  <span className="text-xs font-semibold text-[#0A0A0A]">
                    Учесть аванс за замеры (вычесть из 1-го этапа)
                  </span>
                </label>

                {activeProposal.hasMeasurementAdvance && (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={activeProposal.measurementAdvanceAmount}
                      onChange={(e) =>
                        handlePatch({
                          measurementAdvanceAmount: Math.max(0, parseFloat(e.target.value) || 0),
                        })
                      }
                      className="h-9 w-28 border border-[#111827] bg-white px-2.5 text-right font-mono text-xs font-semibold tabular-nums text-[#0A0A0A] focus:outline-none"
                    />
                    <span className="text-xs text-[#525252]">₽</span>
                  </div>
                )}
              </div>

              {calc.advanceExceedsStage1 && (
                <p className="mt-2 text-[11px] font-medium text-[#B45309]">
                  Аванс за замеры превышает долю 1-го этапа — 1-й платёж обнулён (0 ₽), остаток вычета перенесён на следующий этап.
                </p>
              )}
            </div>

            {/* Payment Scheme Switcher */}
            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-medium text-[#111827]">
                Схема этапов оплаты
              </label>
              <div className="grid grid-cols-2 border border-[#111827] bg-[#F8F9FA] p-0.5">
                {(
                  [
                    { id: '30_50_20', label: '3 этапа (30% / 50% / 20%)' },
                    { id: '50_50', label: '2 этапа (50% / 50%)' },
                  ] as Array<{ id: CommercialProposalPaymentTemplate; label: string }>
                ).map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => handlePatch({ paymentTemplate: tpl.id })}
                    className={`py-2 text-xs font-medium transition-colors ${
                      activeProposal.paymentTemplate === tpl.id
                        ? 'bg-[#111827] text-white'
                        : 'text-[#525252] hover:text-[#0A0A0A]'
                    }`}
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Compact Live Payment Summary inside Editor */}
            <div className="mt-3 divide-y divide-[#E5E7EB] border border-[#E5E7EB] text-xs">
              {calc.rows.map((row) => (
                <div
                  key={row.key}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-[#0A0A0A]">{row.label}</div>
                    <div className="font-mono text-[11px] text-[#525252]">
                      {row.percentLabel} · {row.workingDays}
                    </div>
                  </div>
                  <div className="shrink-0 font-mono font-semibold tabular-nums text-[#0A0A0A]">
                    {formatCurrency(row.amount)}
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between bg-[#F8F9FA] px-3 py-2 font-semibold">
                <span>Итого по графику</span>
                <span className="font-mono tabular-nums text-[#0A0A0A]">
                  {formatCurrency(calc.finalTotal)}
                </span>
              </div>
            </div>

            {/* Work Terms */}
            <div className="mt-4 grid grid-cols-1 gap-3 border-t border-[#E5E7EB] pt-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#111827]">
                  Кругов правок
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={activeProposal.revisionRounds}
                  onChange={(e) =>
                    handlePatch({
                      revisionRounds: Math.max(1, parseInt(e.target.value, 10) || 1),
                    })
                  }
                  className="h-9 w-full border border-[#E5E7EB] bg-white px-2.5 font-mono text-xs tabular-nums text-[#0A0A0A] focus:border-[#111827] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[#111827]">
                  Срок действия, дней
                </label>
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={activeProposal.validDays}
                  onChange={(e) =>
                    handlePatch({
                      validDays: Math.max(1, parseInt(e.target.value, 10) || 14),
                    })
                  }
                  className="h-9 w-full border border-[#E5E7EB] bg-white px-2.5 font-mono text-xs tabular-nums text-[#0A0A0A] focus:border-[#111827] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[#111827]">
                  Формат выдачи
                </label>
                <input
                  type="text"
                  value={activeProposal.albumFormat ?? 'PDF + печатный альбом А3'}
                  onChange={(e) => handlePatch({ albumFormat: e.target.value })}
                  className="h-9 w-full border border-[#E5E7EB] bg-white px-2.5 text-xs text-[#0A0A0A] focus:border-[#111827] focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Architectural A4 Printable Document Sheet */}
        <div
          className={`lg:col-span-7 ${
            mobilePane === 'editor' ? 'hidden lg:block' : 'block'
          }`}
        >
          <article className="kp-print-sheet mx-auto w-full max-w-[820px] border border-[#111827] bg-white p-6 sm:p-10 text-[#0A0A0A]">
            {/* A4 Masthead */}
            <header className="kp-print-avoid-break border-b-2 border-[#0A0A0A] pb-5">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <LimurLogo className="h-16 w-auto shrink-0 sm:h-20" />
                  <div className="mt-2 text-xs text-[#525252]">
                    Студия архитектуры и дизайна интерьера · limurproject.ru
                  </div>
                </div>

                <div className="sm:text-right">
                  <div className="text-[11px] font-semibold tracking-[0.14em] text-[#525252]">
                    КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ
                  </div>
                  <div className="mt-1 font-mono text-base font-bold tabular-nums text-[#0A0A0A]">
                    {activeProposal.number}
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] tabular-nums text-[#525252]">
                    от {formatDate(activeProposal.createdAt)} · действительно до{' '}
                    {formatDate(validUntilDate)}
                  </div>
                </div>
              </div>
            </header>

            {/* Object & Client Passport Grid */}
            <section className="kp-print-avoid-break mt-6 grid grid-cols-1 border border-[#E5E7EB] sm:grid-cols-2">
              <div className="border-b border-[#E5E7EB] p-4 sm:border-r">
                <div className="text-[11px] font-medium text-[#525252]">Заказчик</div>
                <div className="mt-1 text-sm font-semibold text-[#0A0A0A]">
                  {activeProposal.clientName.trim() || 'Не указан'}
                </div>
                {activeProposal.clientPhone.trim() && (
                  <div className="mt-0.5 font-mono text-xs tabular-nums text-[#525252]">
                    {activeProposal.clientPhone.trim()}
                  </div>
                )}
              </div>

              <div className="border-b border-[#E5E7EB] p-4">
                <div className="text-[11px] font-medium text-[#525252]">Объект проектирования</div>
                <div className="mt-1 text-sm font-semibold text-[#0A0A0A]">
                  {activeProposal.objectTitle.trim() || 'Объект не указан'}
                </div>
                <div className="mt-0.5 text-xs text-[#525252]">
                  {[
                    activeProposal.city.trim(),
                    activeProposal.objectType === 'commercial'
                      ? 'Коммерческое помещение'
                      : 'Жилой интерьер',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>

              <div className="border-b border-[#E5E7EB] p-4 sm:border-b-0 sm:border-r">
                <div className="text-[11px] font-medium text-[#525252]">
                  Площадь по обмерному плану
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-2">
                  <span className="font-mono text-base font-bold tabular-nums text-[#0A0A0A]">
                    {calc.safeArea} м²
                  </span>
                  {activeProposal.measurementPlanUrl.trim() && (
                    <a
                      href={
                        /^https?:\/\//i.test(activeProposal.measurementPlanUrl.trim())
                          ? activeProposal.measurementPlanUrl.trim()
                          : `https://${activeProposal.measurementPlanUrl.trim()}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="no-print inline-flex items-center gap-1 text-[11px] font-medium text-[#0A0A0A] underline"
                    >
                      Обмерный план
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>

              <div className="p-4">
                <div className="text-[11px] font-medium text-[#525252]">
                  Выбранный пакет и срок разработки
                </div>
                <div className="mt-1 text-sm font-semibold text-[#0A0A0A]">
                  {activePreset.title}
                </div>
                <div className="mt-0.5 font-mono text-xs tabular-nums text-[#525252]">
                  Ориентировочно ~{calc.totalWorkingDays} рабочих дней
                </div>
              </div>
            </section>

            {/* Section 01: Scope of Work Table */}
            <section className="mt-7">
              <div className="mb-2.5 flex items-baseline justify-between border-b border-[#111827] pb-1.5">
                <h3 className="text-xs font-bold tracking-[0.06em] text-[#0A0A0A]">
                  01. СОСТАВ ПРОЕКТНЫХ РАБОТ
                </h3>
                <span className="text-[11px] text-[#525252]">{activePreset.title}</span>
              </div>

              <table className="w-full border-collapse text-left text-xs">
                <tbody>
                  {activeProposal.customDeliverables.map((item, index) => (
                    <tr
                      key={index}
                      className="kp-print-avoid-break border-b border-[#E5E7EB]"
                    >
                      <td className="w-10 py-2.5 pr-3 align-top font-mono text-[11px] tabular-nums text-[#525252]">
                        {String(index + 1).padStart(2, '0')}
                      </td>
                      <td className="py-2.5 text-[#0A0A0A]">{item || '—'}</td>
                      <td className="w-20 py-2.5 pl-3 text-right font-mono text-[11px] text-[#15803D]">
                        Включено
                      </td>
                    </tr>
                  ))}
                  {activeProposal.options.supervision && (
                    <tr className="kp-print-avoid-break border-b border-[#E5E7EB] bg-[#F8F9FA]">
                      <td className="w-10 py-2.5 pr-3 align-top font-mono text-[11px] text-[#0A0A0A]">
                        +
                      </td>
                      <td className="py-2.5 font-medium text-[#0A0A0A]">
                        Авторский надзор (выезды на объект, контроль соответствия проекту, уточнение узлов)
                      </td>
                      <td className="w-24 py-2.5 pl-3 text-right font-mono text-[11px] text-[#0A0A0A]">
                        Доп. опция
                      </td>
                    </tr>
                  )}
                  {activeProposal.options.sourcing && (
                    <tr className="kp-print-avoid-break border-b border-[#E5E7EB] bg-[#F8F9FA]">
                      <td className="w-10 py-2.5 pr-3 align-top font-mono text-[11px] text-[#0A0A0A]">
                        +
                      </td>
                      <td className="py-2.5 font-medium text-[#0A0A0A]">
                        Комплектация объекта (подбор поставщиков, сметы, график закупок и поставок)
                      </td>
                      <td className="w-24 py-2.5 pl-3 text-right font-mono text-[11px] text-[#0A0A0A]">
                        Доп. опция
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>

            {/* Section 02: Transparent Cost Estimate */}
            <section className="kp-print-avoid-break mt-7">
              <div className="mb-2.5 flex items-baseline justify-between border-b border-[#111827] pb-1.5">
                <h3 className="text-xs font-bold tracking-[0.06em] text-[#0A0A0A]">
                  02. РАСЧЁТ СТОИМОСТИ ПРОЕКТА
                </h3>
                <span className="font-mono text-[11px] text-[#525252]">Валюта: RUB (₽)</span>
              </div>

              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA] text-[11px] text-[#525252]">
                    <th className="px-3 py-2 text-left font-medium">Наименование</th>
                    <th className="px-3 py-2 text-right font-medium">Площадь</th>
                    <th className="px-3 py-2 text-right font-medium">Ставка</th>
                    <th className="px-3 py-2 text-right font-medium">Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="kp-print-avoid-break border-b border-[#E5E7EB]">
                    <td className="px-3 py-3 font-medium text-[#0A0A0A]">
                      Дизайн-проект — «{activePreset.title}»
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-[#0A0A0A]">
                      {calc.safeArea} м²
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-[#0A0A0A]">
                      {formatCurrency(activeProposal.ratePerSqm)}/м²
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-semibold tabular-nums text-[#0A0A0A]">
                      {formatCurrency(calc.baseTotal)}
                    </td>
                  </tr>

                  {calc.discountAmount > 0 && (
                    <tr className="kp-print-avoid-break border-b border-[#E5E7EB]">
                      <td className="px-3 py-2.5 text-[#525252]" colSpan={3}>
                        Персональная скидка / округление по договору (−{calc.discountPercent}%)
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-semibold tabular-nums text-[#15803D]">
                        −{formatCurrency(calc.discountAmount)}
                      </td>
                    </tr>
                  )}

                  {calc.finalTotal > calc.baseTotal && (
                    <tr className="kp-print-avoid-break border-b border-[#E5E7EB]">
                      <td className="px-3 py-2.5 text-[#525252]" colSpan={3}>
                        Корректировка стоимости (дополнительный объём / сложность)
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-semibold tabular-nums text-[#0A0A0A]">
                        +{formatCurrency(calc.finalTotal - calc.baseTotal)}
                      </td>
                    </tr>
                  )}

                  <tr className="kp-print-avoid-break border-t-2 border-[#111827] bg-[#111827] text-white">
                    <td className="px-3 py-3 text-xs font-bold tracking-[0.04em]" colSpan={3}>
                      ИТОГО ПО ДОГОВОРУ
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-base font-bold tabular-nums">
                      {formatCurrency(calc.finalTotal)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </section>

            {/* Section 03: Payment Schedule */}
            <section className="mt-7">
              <div className="mb-2.5 flex items-baseline justify-between border-b border-[#111827] pb-1.5">
                <h3 className="text-xs font-bold tracking-[0.06em] text-[#0A0A0A]">
                  03. ГРАФИК ЭТАПОВ И ПОРЯДОК ОПЛАТЫ
                </h3>
                <span className="font-mono text-[11px] text-[#525252]">
                  {activeProposal.paymentTemplate === '30_50_20'
                    ? 'Схема 30% / 50% / 20%'
                    : 'Схема 50% / 50%'}
                </span>
              </div>

              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA] text-[11px] text-[#525252]">
                    <th className="px-3 py-2 text-left font-medium">Этап оплаты</th>
                    <th className="px-3 py-2 text-right font-medium">Срок</th>
                    <th className="px-3 py-2 text-right font-medium">Доля</th>
                    <th className="px-3 py-2 text-right font-medium">Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {calc.rows.map((row) => (
                    <tr
                      key={row.key}
                      className={`kp-print-avoid-break border-b border-[#E5E7EB] ${
                        row.isAdvance ? 'bg-[#F8F9FA]' : ''
                      }`}
                    >
                      <td className="px-3 py-2.5 text-[#0A0A0A]">{row.label}</td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[#525252] whitespace-nowrap">
                        {row.workingDays}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[#525252] whitespace-nowrap">
                        {row.percentLabel}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-semibold tabular-nums text-[#0A0A0A] whitespace-nowrap">
                        {formatCurrency(row.amount)}
                      </td>
                    </tr>
                  ))}
                  <tr className="kp-print-avoid-break border-t border-[#111827] bg-[#F8F9FA] font-semibold">
                    <td className="px-3 py-2.5 text-[#0A0A0A]" colSpan={3}>
                      Всего к оплате по договору
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[#0A0A0A]">
                      {formatCurrency(calc.finalTotal)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </section>

            {/* Section 04: Conditions & Deliverables Format */}
            <section className="kp-print-avoid-break mt-7">
              <div className="mb-2.5 border-b border-[#111827] pb-1.5">
                <h3 className="text-xs font-bold tracking-[0.06em] text-[#0A0A0A]">
                  04. УСЛОВИЯ РАБОТЫ И ФОРМАТ ПЕРЕДАЧИ
                </h3>
              </div>

              <div className="grid grid-cols-1 border border-[#E5E7EB] text-xs sm:grid-cols-3">
                <div className="border-b border-[#E5E7EB] p-3.5 sm:border-b-0 sm:border-r">
                  <div className="text-[11px] text-[#525252]">Круги правок</div>
                  <div className="mt-1 font-mono font-semibold tabular-nums text-[#0A0A0A]">
                    {activeProposal.revisionRounds} круга на каждом этапе
                  </div>
                </div>
                <div className="border-b border-[#E5E7EB] p-3.5 sm:border-b-0 sm:border-r">
                  <div className="text-[11px] text-[#525252]">Формат выдачи проекта</div>
                  <div className="mt-1 font-semibold text-[#0A0A0A]">{albumFormatText}</div>
                </div>
                <div className="p-3.5">
                  <div className="text-[11px] text-[#525252]">Срок действия КП</div>
                  <div className="mt-1 font-mono font-semibold tabular-nums text-[#0A0A0A]">
                    {activeProposal.validDays} дней (до {formatDate(validUntilDate)})
                  </div>
                </div>
              </div>
            </section>

            {/* Footer & Signature Block */}
            <footer className="kp-print-avoid-break mt-9 border-t-2 border-[#0A0A0A] pt-5">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <LimurLogo className="h-12 w-auto shrink-0" />
                  <div className="mt-2 text-[11px] text-[#525252]">
                    Архитектурное проектирование и дизайн интерьеров
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-[#0A0A0A]">
                    https://limurproject.ru
                  </div>
                  <div className="mt-6 flex items-end justify-between border-b border-[#111827] pb-1 text-[11px] text-[#525252]">
                    <span>Руководитель студии</span>
                    <span>Подпись / дата</span>
                  </div>
                </div>

                <div className="flex flex-col justify-between">
                  <div>
                    <div className="text-xs font-semibold text-[#0A0A0A]">
                      Согласование заказчика
                    </div>
                    <div className="mt-1 text-[11px] text-[#525252]">
                      {activeProposal.clientName.trim() || 'Заказчик'}
                      {activeProposal.status === 'approved' && (
                        <span className="ml-2 inline-flex items-center gap-1 font-semibold text-[#15803D]">
                          <Check className="h-3 w-3" />
                          Согласовано
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-6 flex items-end justify-between border-b border-[#111827] pb-1 text-[11px] text-[#525252]">
                    <span>Заказчик</span>
                    <span>Подпись / дата</span>
                  </div>
                </div>
              </div>
            </footer>
          </article>
        </div>
      </div>
    </div>
  );
};
