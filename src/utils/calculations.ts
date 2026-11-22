import {
  AppData,
  CostBreakdownItem,
  CostRoleGroup,
  Project,
  ProjectFinanceSummary,
  RiskItem,
  SalaryAllocationDetail,
} from '../types';

export function formatCurrency(value: number): string {
  const rounded = Math.round(value);
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 0,
  }).format(rounded) + ' ₽';
}

export function formatNumber(value: number, maxDecimals = 1): string {
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: maxDecimals,
  }).format(value);
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

export function formatShortDate(dateStr: string): string {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}.${parts[1]}`;
}

const MONTH_NAMES = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

export function formatMonthLabel(monthStr: string): string {
  if (!monthStr) return '—';
  const [y, m] = monthStr.split('-');
  const idx = Number(m) - 1;
  if (idx < 0 || idx > 11) return monthStr;
  return `${MONTH_NAMES[idx]} ${y}`;
}

export function getTodayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getCurrentMonthIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function getProjectProgress(project: Project): number {
  if (!project.workStages.length) return 0;
  const sum = project.workStages.reduce((acc, s) => acc + (s.progress || 0), 0);
  return Math.round(sum / project.workStages.length);
}

/**
 * Calculates monthly salary allocations for a specific project across all months.
 * Formula: For each salaried employee in a given month (YYYY-MM),
 * their monthly salary is distributed across projects proportionally to their
 * logged м² (if allocationBasis === 'area') or hours (if allocationBasis === 'hours')
 * across ALL projects during that month.
 */
export function calculateProjectSalaryAllocations(
  data: AppData,
  projectId: string
): SalaryAllocationDetail[] {
  const salariedMembers = data.team.filter((m) => m.paymentType === 'salary' && m.monthlySalary > 0);
  const memberMap = new Map(salariedMembers.map((m) => [m.id, m]));

  // Aggregate total studio volume per (month, memberId)
  const totalByMonthMember = new Map<string, number>();
  // Aggregate this project's volume per (month, memberId)
  const projectByMonthMember = new Map<string, number>();

  for (const entry of data.worklogs) {
    const member = memberMap.get(entry.memberId);
    if (!member) continue;
    const key = `${entry.month}::${entry.memberId}`;
    const vol = member.allocationBasis === 'area' ? entry.areaSqm : entry.hours;
    if (vol <= 0) continue;

    totalByMonthMember.set(key, (totalByMonthMember.get(key) || 0) + vol);
    if (entry.projectId === projectId) {
      projectByMonthMember.set(key, (projectByMonthMember.get(key) || 0) + vol);
    }
  }

  const results: SalaryAllocationDetail[] = [];

  for (const [key, projectVol] of projectByMonthMember.entries()) {
    const [month, memberId] = key.split('::');
    const member = memberMap.get(memberId);
    if (!member) continue;

    const totalVol = totalByMonthMember.get(key) || 0;
    if (totalVol <= 0) continue;

    const ratio = projectVol / totalVol;
    const allocatedAmount = member.monthlySalary * ratio;

    results.push({
      month,
      memberId,
      memberRole: member.roleTitle,
      memberCode: member.code,
      costGroup: member.costGroup,
      monthlySalary: member.monthlySalary,
      basis: member.allocationBasis,
      projectVolume: projectVol,
      totalMonthVolume: totalVol,
      sharePercent: ratio * 100,
      allocatedAmount,
    });
  }

  return results.sort((a, b) => b.month.localeCompare(a.month) || b.allocatedAmount - a.allocatedAmount);
}

export function calculateProjectFinance(data: AppData, project: Project): ProjectFinanceSummary {
  const contractTotal = project.paymentStages.reduce((acc, s) => acc + (Number(s.amount) || 0), 0);
  const paidTotal = project.paymentStages
    .filter((s) => s.isPaid)
    .reduce((acc, s) => acc + (Number(s.amount) || 0), 0);
  const remainingTotal = Math.max(0, contractTotal - paidTotal);
  const paidPercent = contractTotal > 0 ? Math.round((paidTotal / contractTotal) * 100) : 0;

  const salaryAllocations = calculateProjectSalaryAllocations(data, project.id);
  const allocatedSalaryTotal = salaryAllocations.reduce((acc, item) => acc + item.allocatedAmount, 0);

  const memberMap = new Map(data.team.map((m) => [m.id, m]));

  // Piecework costs from worklogs for this project
  const projectWorklogs = data.worklogs.filter((w) => w.projectId === project.id);
  const pieceworkByGroup = new Map<CostRoleGroup, number>();
  let pieceworkTotal = 0;

  for (const wl of projectWorklogs) {
    const member = memberMap.get(wl.memberId);
    const amt = Number(wl.pieceworkAmount) || 0;
    if (amt > 0) {
      pieceworkTotal += amt;
      const group: CostRoleGroup = member?.costGroup || 'Прочие роли';
      pieceworkByGroup.set(group, (pieceworkByGroup.get(group) || 0) + amt);
    }
  }

  // Direct expenses (printing, samples, logistics, other)
  const projectExpenses = data.expenses.filter((e) => e.projectId === project.id);
  const directExpensesTotal = projectExpenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

  const fotTotal = allocatedSalaryTotal + pieceworkTotal;
  const totalCosts = fotTotal + directExpensesTotal;

  const netBalanceFromPaid = paidTotal - totalCosts;
  const projectedMarginAmount = contractTotal - totalCosts;
  const projectedMarginPercent =
    contractTotal > 0 ? (projectedMarginAmount / contractTotal) * 100 : 0;
  const fotPercentOfContract = contractTotal > 0 ? (fotTotal / contractTotal) * 100 : 0;
  const fotLimitPercent = project.fotLimitPercent || data.settings.defaultFotLimitPercent || 40;

  // Build cost breakdown by role/category
  const groupTotals = new Map<CostRoleGroup, number>();
  const orderedGroups: CostRoleGroup[] = [
    'Дизайнер',
    'Визуализатор',
    'Чертёжник',
    'Замеры',
    'Руководитель проекта',
    'Печать и логистика',
    'Прочие роли',
  ];

  for (const alloc of salaryAllocations) {
    groupTotals.set(alloc.costGroup, (groupTotals.get(alloc.costGroup) || 0) + alloc.allocatedAmount);
  }
  for (const [grp, amt] of pieceworkByGroup.entries()) {
    groupTotals.set(grp, (groupTotals.get(grp) || 0) + amt);
  }
  if (directExpensesTotal > 0) {
    groupTotals.set(
      'Печать и логистика',
      (groupTotals.get('Печать и логистика') || 0) + directExpensesTotal
    );
  }

  const costBreakdown: CostBreakdownItem[] = orderedGroups
    .map((group) => {
      const amount = groupTotals.get(group) || 0;
      return {
        group,
        amount,
        percent: totalCosts > 0 ? (amount / totalCosts) * 100 : 0,
      };
    })
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  return {
    contractTotal,
    paidTotal,
    remainingTotal,
    paidPercent,
    allocatedSalaryTotal,
    pieceworkTotal,
    fotTotal,
    directExpensesTotal,
    totalCosts,
    netBalanceFromPaid,
    projectedMarginAmount,
    projectedMarginPercent,
    fotPercentOfContract,
    fotLimitPercent,
    isOverFotLimit: contractTotal > 0 && fotPercentOfContract > fotLimitPercent,
    isNegativeMargin: projectedMarginAmount < 0,
    isCashNegative: netBalanceFromPaid < 0,
    salaryAllocations,
    costBreakdown,
  };
}

export const CORE_COST_CATEGORIES: CostRoleGroup[] = [
  'Дизайнер',
  'Визуализатор',
  'Чертёжник',
  'Замеры',
  'Печать и логистика',
];

const DEFAULT_CATEGORY_WEIGHTS: Record<CostRoleGroup, number> = {
  Дизайнер: 0.34,
  Визуализатор: 0.30,
  Чертёжник: 0.22,
  Замеры: 0.05,
  'Печать и логистика': 0.09,
  'Руководитель проекта': 0,
  'Прочие роли': 0,
};

/**
 * Computes planned cost budget per category for a project.
 * Uses user-saved overrides if present; otherwise derives sensible architectural
 * studio allocations from contractTotal * (fotLimitPercent + 4% direct expenses).
 */
export function getPlannedCategoryBudgets(
  project: Project,
  contractTotal: number,
  defaultFotLimitPercent: number
): Record<CostRoleGroup, number> {
  const fotPct = (project.fotLimitPercent || defaultFotLimitPercent || 40) / 100;
  const totalPlannedCostBudget = Math.round(contractTotal * Math.min(0.85, fotPct + 0.04));

  const result: Record<CostRoleGroup, number> = {
    Дизайнер: 0,
    Визуализатор: 0,
    Чертёжник: 0,
    Замеры: 0,
    'Руководитель проекта': 0,
    'Печать и логистика': 0,
    'Прочие роли': 0,
  };

  for (const cat of Object.keys(result) as CostRoleGroup[]) {
    const custom = project.plannedCategoryBudgets?.[cat];
    if (typeof custom === 'number' && !Number.isNaN(custom)) {
      result[cat] = Math.max(0, custom);
    } else {
      result[cat] = Math.round(totalPlannedCostBudget * (DEFAULT_CATEGORY_WEIGHTS[cat] || 0));
    }
  }

  return result;
}

export interface StudioPulseSummary {
  totalContract: number;
  totalPaid: number;
  totalReceivables: number;
  totalCosts: number;
  totalAllocatedSalary: number;
  totalPiecework: number;
  totalDirectExpenses: number;
  totalFot: number;
  cashBalance: number; // totalPaid - (totalCosts + unallocatedCurrentMonthSalary)
  totalMargin: number;
  averageMarginPercent: number;
  activeProjectsCount: number;
  pausedProjectsCount: number;
  riskProjectsCount: number;
  totalAreaSqm: number;
  monthlySalaryBurn: number;
  unallocatedCurrentMonthSalary: number;
  studioCostBreakdown: CostBreakdownItem[];
  risks: RiskItem[];
  projectFinances: Record<string, ProjectFinanceSummary>;
  projectRiskLevel: Record<string, 'ok' | 'warning' | 'critical'>;
  projectAtRisk: Record<string, boolean>;
  projectRiskReasons: Record<string, string[]>;
}

export function calculateStudioPulse(data: AppData): StudioPulseSummary {
  const today = getTodayIso();
  const currMonth = getCurrentMonthIso();

  let totalContract = 0;
  let totalPaid = 0;
  let totalReceivables = 0;
  let totalCosts = 0;
  let totalAllocatedSalary = 0;
  let totalPiecework = 0;
  let totalDirectExpenses = 0;
  let totalFot = 0;
  let activeProjectsCount = 0;
  let pausedProjectsCount = 0;
  let totalAreaSqm = 0;

  const projectFinances: Record<string, ProjectFinanceSummary> = {};
  const projectRiskLevel: Record<string, 'ok' | 'warning' | 'critical'> = {};
  const projectAtRisk: Record<string, boolean> = {};
  const projectRiskReasons: Record<string, string[]> = {};
  const studioGroupTotals = new Map<CostRoleGroup, number>();
  const risks: RiskItem[] = [];

  const elevateRisk = (projectId: string, level: 'warning' | 'critical') => {
    const curr = projectRiskLevel[projectId] || 'ok';
    if (curr === 'critical') return;
    if (level === 'critical' || curr === 'ok') {
      projectRiskLevel[projectId] = level;
    }
  };

  const flagProjectRisk = (projectId: string, reason: string) => {
    projectAtRisk[projectId] = true;
    if (!projectRiskReasons[projectId]) {
      projectRiskReasons[projectId] = [];
    }
    if (!projectRiskReasons[projectId].includes(reason)) {
      projectRiskReasons[projectId].push(reason);
    }
  };

  for (const project of data.projects) {
    const fin = calculateProjectFinance(data, project);
    projectFinances[project.id] = fin;
    projectRiskLevel[project.id] = 'ok';
    projectAtRisk[project.id] = false;
    projectRiskReasons[project.id] = [];

    totalContract += fin.contractTotal;
    totalPaid += fin.paidTotal;
    totalReceivables += fin.remainingTotal;
    totalCosts += fin.totalCosts;
    totalAllocatedSalary += fin.allocatedSalaryTotal;
    totalPiecework += fin.pieceworkTotal;
    totalDirectExpenses += fin.directExpensesTotal;
    totalFot += fin.fotTotal;
    totalAreaSqm += Number(project.areaSqm) || 0;

    for (const item of fin.costBreakdown) {
      studioGroupTotals.set(item.group, (studioGroupTotals.get(item.group) || 0) + item.amount);
    }

    if (project.status === 'В работе') {
      activeProjectsCount += 1;
    } else if (project.status === 'На паузе' || project.status === 'Заморожен') {
      pausedProjectsCount += 1;
    }

    // Risk 1: Over FOT limit (перерасход бюджета на команду)
    if (fin.isOverFotLimit) {
      elevateRisk(project.id, 'critical');
      flagProjectRisk(project.id, `Перерасход ФОТ (${fin.fotPercentOfContract.toFixed(0)}%)`);
      risks.push({
        id: `risk_fot_${project.id}`,
        severity: 'critical',
        category: 'fot',
        projectId: project.id,
        title: `Превышен лимит ФОТ: ${project.name}`,
        detail: `ФОТ составляет ${fin.fotPercentOfContract.toFixed(1)}% от КП при лимите ${fin.fotLimitPercent}% (${formatCurrency(fin.fotTotal)}).`,
      });
    }

    // Risk 2: Negative margin or cash deficit
    if (fin.isNegativeMargin) {
      elevateRisk(project.id, 'critical');
      flagProjectRisk(project.id, 'Уход в минус по бюджету');
      risks.push({
        id: `risk_margin_${project.id}`,
        severity: 'critical',
        category: 'margin',
        projectId: project.id,
        title: `Убыточный проект: ${project.name}`,
        detail: `Расходы превышают сумму КП на ${formatCurrency(Math.abs(fin.projectedMarginAmount))}.`,
      });
    } else if (fin.isCashNegative && project.status !== 'Сдан') {
      elevateRisk(project.id, 'warning');
      flagProjectRisk(project.id, 'Кассовый разрыв');
      risks.push({
        id: `risk_cash_${project.id}`,
        severity: 'warning',
        category: 'salary',
        projectId: project.id,
        title: `Кассовый разрыв по проекту: ${project.name}`,
        detail: `Накопленные расходы (${formatCurrency(fin.totalCosts)}) выше оплаченных клиентом этапов (${formatCurrency(fin.paidTotal)}).`,
      });
    }

    // Risk 3: Overdue unpaid payment stages (неоплаченный вовремя этап КП)
    const overduePayments = project.paymentStages.filter(
      (s) => !s.isPaid && s.dueDate && s.dueDate < today && project.status !== 'Заморожен'
    );
    if (overduePayments.length > 0) {
      flagProjectRisk(
        project.id,
        overduePayments.length === 1
          ? 'Просрочка оплаты КП'
          : `Просрочка оплаты (${overduePayments.length} эт.)`
      );
    }
    for (const ps of overduePayments) {
      elevateRisk(project.id, 'warning');
      risks.push({
        id: `risk_pay_${ps.id}`,
        severity: 'warning',
        category: 'payment',
        projectId: project.id,
        title: `Просрочка оплаты: ${project.name}`,
        detail: `${ps.title} (${formatCurrency(ps.amount)}) — плановый срок ${formatDate(ps.dueDate)}.`,
      });
    }

    // Risk 4: Overdue or studio-delayed work stages (просрочка по вине студии)
    const overdueTasks = project.workStages.filter(
      (ws) =>
        ws.progress < 100 &&
        project.status === 'В работе' &&
        ((ws.planEnd && ws.planEnd < today) || ws.delayReason === 'studio' || ws.delayReason === 'client')
    );
    if (overdueTasks.length > 0) {
      const studioDelays = overdueTasks.filter(
        (t) => t.delayReason === 'studio' || (t.delayReason === 'none' && t.planEnd && t.planEnd < today)
      ).length;
      if (studioDelays > 0) {
        flagProjectRisk(
          project.id,
          studioDelays === 1
            ? 'Просрочка студии'
            : `Просрочка студии (${studioDelays})`
        );
      }
      elevateRisk(project.id, studioDelays > 0 ? 'critical' : 'warning');
      risks.push({
        id: `risk_task_${project.id}`,
        severity: studioDelays > 0 ? 'critical' : 'warning',
        category: 'deadline',
        projectId: project.id,
        title: `Сдвиг сроков (${overdueTasks.length}): ${project.name}`,
        detail: overdueTasks
          .slice(0, 2)
          .map((t) => `${t.title} (${t.delayReason === 'studio' ? 'задержка студии' : t.delayReason === 'client' ? 'ждём ОС клиента' : `план до ${formatShortDate(t.planEnd)}`})`)
          .join('; '),
      });
    }
  }

  // Risk 5: Salaried staff with zero worklog in current month (unallocated salary burn)
  const salariedMembers = data.team.filter((m) => m.paymentType === 'salary' && m.monthlySalary > 0);
  const monthlySalaryBurn = salariedMembers.reduce((acc, m) => acc + m.monthlySalary, 0);
  let unallocatedCurrentMonthSalary = 0;

  if (data.projects.length > 0) {
    for (const member of salariedMembers) {
      const loggedThisMonth = data.worklogs
        .filter((w) => w.memberId === member.id && w.month === currMonth)
        .reduce((acc, w) => acc + (member.allocationBasis === 'area' ? w.areaSqm : w.hours), 0);
      if (loggedThisMonth <= 0) {
        unallocatedCurrentMonthSalary += member.monthlySalary;
        risks.push({
          id: `risk_idle_${member.id}_${currMonth}`,
          severity: 'warning',
          category: 'salary',
          title: `Нераспределённый оклад: ${member.roleTitle}`,
          detail: `За ${formatMonthLabel(currMonth)} не внесена выработка — оклад ${formatCurrency(member.monthlySalary)} идёт в прямой убыток студии.`,
        });
      }
    }
  }

  const orderedGroups: CostRoleGroup[] = [
    'Дизайнер',
    'Визуализатор',
    'Чертёжник',
    'Замеры',
    'Руководитель проекта',
    'Печать и логистика',
    'Прочие роли',
  ];

  const studioCostBreakdown: CostBreakdownItem[] = orderedGroups
    .map((group) => {
      const amount = studioGroupTotals.get(group) || 0;
      return {
        group,
        amount,
        percent: totalCosts > 0 ? (amount / totalCosts) * 100 : 0,
      };
    })
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const riskProjectsCount = Object.values(projectAtRisk).filter(Boolean).length;
  const totalOutflow = totalCosts + unallocatedCurrentMonthSalary;
  const cashBalance = totalPaid - totalOutflow;
  const totalMargin = totalContract - totalOutflow;
  const averageMarginPercent = totalContract > 0 ? (totalMargin / totalContract) * 100 : 0;

  return {
    totalContract,
    totalPaid,
    totalReceivables,
    totalCosts,
    totalAllocatedSalary,
    totalPiecework,
    totalDirectExpenses,
    totalFot,
    cashBalance,
    totalMargin,
    averageMarginPercent,
    activeProjectsCount,
    pausedProjectsCount,
    riskProjectsCount,
    totalAreaSqm,
    monthlySalaryBurn,
    unallocatedCurrentMonthSalary,
    studioCostBreakdown,
    risks,
    projectFinances,
    projectRiskLevel,
    projectAtRisk,
    projectRiskReasons,
  };
}
