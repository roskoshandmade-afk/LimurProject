export type UserRole = 'director' | 'assistant' | 'client';

export type ProjectStatus = 'В работе' | 'На паузе' | 'Заморожен' | 'Сдан';

export type PaymentType = 'salary' | 'piecework';

export type AllocationBasis = 'area' | 'hours';

export type DelayReason = 'none' | 'client' | 'studio';

export type ExpenseCategory =
  | 'Печать и альбомы'
  | 'Выкрасы и образцы'
  | 'Бензин и логистика'
  | 'Прочие расходы';

export type CostRoleGroup =
  | 'Дизайнер'
  | 'Визуализатор'
  | 'Чертёжник'
  | 'Замеры'
  | 'Руководитель проекта'
  | 'Печать и логистика'
  | 'Прочие роли';

export interface TeamMember {
  id: string;
  roleTitle: string; // e.g., "Визуализатор", "Дизайнер (ведущий)" — no personal names
  code: string; // Short code/initials e.g., "ВИЗ", "ДИЗ", "ЧРТ", "ЗМР"
  costGroup: Exclude<CostRoleGroup, 'Печать и логистика'>;
  paymentType: PaymentType;
  monthlySalary: number; // Used when paymentType === 'salary'
  allocationBasis: AllocationBasis; // 'area' (м²) or 'hours' (ч)
  pieceworkRate: number; // Default rate per м² or stage when paymentType === 'piecework'
  pieceworkUnit: 'м²' | 'этап' | 'выезд';
}

export interface PaymentStage {
  id: string;
  order: number;
  title: string; // e.g., "Этап 1. Планировка и концепция"
  amount: number;
  dueDate: string; // YYYY-MM-DD
  isPaid: boolean;
  paidDate: string; // YYYY-MM-DD or ''
}

export interface WorkSubStage {
  id: string;
  paymentStageId: string;
  title: string; // e.g., "Замеры", "Стартовые планы", "ТЗ", "Визы кухни и СУ"
  assigneeId: string; // TeamMember.id or ''
  planStart: string; // YYYY-MM-DD
  planEnd: string; // YYYY-MM-DD
  actualStart: string; // YYYY-MM-DD or ''
  actualEnd: string; // YYYY-MM-DD or ''
  progress: number; // 0..100
  delayReason: DelayReason;
  internalNote: string; // Never shown in Client View
}

export interface ProjectLinks {
  proposalUrl: string; // КП
  measurementUrl: string; // Обмерный план
  folderUrl: string; // Папка исходников / материалов
}

export interface Project {
  id: string;
  isDemo?: boolean;
  name: string;
  address: string;
  areaSqm: number;
  status: ProjectStatus;
  clientContact: string;
  startDate: string; // YYYY-MM-DD
  fotLimitPercent: number; // e.g. 40
  plannedCategoryBudgets?: Partial<Record<CostRoleGroup, number>>;
  links: ProjectLinks;
  teamIds: string[];
  paymentStages: PaymentStage[];
  workStages: WorkSubStage[];
}

export interface WorklogEntry {
  id: string;
  projectId: string;
  memberId: string;
  month: string; // YYYY-MM
  date: string; // YYYY-MM-DD
  areaSqm: number; // Worked м² (for salaried allocation or piecework)
  hours: number; // Worked hours (for salaried allocation)
  pieceworkAmount: number; // Direct accrued ₽ for piecework roles
  comment: string;
}

export interface DirectExpense {
  id: string;
  projectId: string;
  date: string; // YYYY-MM-DD
  category: ExpenseCategory;
  amount: number;
  comment: string;
}

export interface StudioSettings {
  defaultFotLimitPercent: number;
  studioName: string;
}

export interface AppData {
  version: number;
  settings: StudioSettings;
  team: TeamMember[];
  projects: Project[];
  worklogs: WorklogEntry[];
  expenses: DirectExpense[];
}

export interface SalaryAllocationDetail {
  month: string;
  memberId: string;
  memberRole: string;
  memberCode: string;
  costGroup: CostRoleGroup;
  monthlySalary: number;
  basis: AllocationBasis;
  projectVolume: number;
  totalMonthVolume: number;
  sharePercent: number;
  allocatedAmount: number;
}

export interface CostBreakdownItem {
  group: CostRoleGroup;
  amount: number;
  percent: number;
}

export interface ProjectFinanceSummary {
  contractTotal: number;
  paidTotal: number;
  remainingTotal: number;
  paidPercent: number;
  allocatedSalaryTotal: number;
  pieceworkTotal: number;
  fotTotal: number; // allocatedSalaryTotal + pieceworkTotal
  directExpensesTotal: number;
  totalCosts: number;
  netBalanceFromPaid: number; // paidTotal - totalCosts
  projectedMarginAmount: number; // contractTotal - totalCosts
  projectedMarginPercent: number; // (contractTotal - totalCosts) / contractTotal * 100
  fotPercentOfContract: number; // fotTotal / contractTotal * 100
  fotLimitPercent: number;
  isOverFotLimit: boolean;
  isNegativeMargin: boolean;
  isCashNegative: boolean;
  salaryAllocations: SalaryAllocationDetail[];
  costBreakdown: CostBreakdownItem[];
}

export interface RiskItem {
  id: string;
  severity: 'critical' | 'warning';
  category: 'salary' | 'fot' | 'deadline' | 'payment' | 'margin';
  projectId?: string;
  title: string;
  detail: string;
}
