import { AppData, PaymentStage, Project, TeamMember, WorkSubStage } from '../types';

export function createId(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export const DEFAULT_TEAM: TeamMember[] = [
  {
    id: 'tm_designer',
    roleTitle: 'Дизайнер (ведущий)',
    code: 'ДИЗ',
    costGroup: 'Дизайнер',
    paymentType: 'salary',
    monthlySalary: 140000,
    allocationBasis: 'area',
    pieceworkRate: 0,
    pieceworkUnit: 'м²',
  },
  {
    id: 'tm_visualizer',
    roleTitle: 'Визуализатор 3D',
    code: 'ВИЗ',
    costGroup: 'Визуализатор',
    paymentType: 'salary',
    monthlySalary: 110000,
    allocationBasis: 'area',
    pieceworkRate: 0,
    pieceworkUnit: 'м²',
  },
  {
    id: 'tm_drafter',
    roleTitle: 'Чертёжник / Архитектор РД',
    code: 'ЧРТ',
    costGroup: 'Чертёжник',
    paymentType: 'piecework',
    monthlySalary: 0,
    allocationBasis: 'area',
    pieceworkRate: 850,
    pieceworkUnit: 'м²',
  },
  {
    id: 'tm_measurer',
    roleTitle: 'Инженер-замерщик',
    code: 'ЗМР',
    costGroup: 'Замеры',
    paymentType: 'piecework',
    monthlySalary: 0,
    allocationBasis: 'area',
    pieceworkRate: 18000,
    pieceworkUnit: 'выезд',
  },
];

function getRelativeDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getCurrentMonth(offsetMonths = 0): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offsetMonths);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function createDemoData(): AppData {
  const pId = 'proj_demo_presnya';
  const ps1 = 'ps_demo_1';
  const ps2 = 'ps_demo_2';
  const ps3 = 'ps_demo_3';

  const prevMonth = getCurrentMonth(-1);
  const currMonth = getCurrentMonth(0);

  const demoProject: Project = {
    id: pId,
    isDemo: true,
    name: '[ДЕМО] Квартира в ЖК «Пресня Сити»',
    address: 'г. Москва, Ходынская ул., д. 2',
    areaSqm: 118,
    status: 'В работе',
    clientContact: 'Заказчик · +7 (900) 000-00-00 · Telegram',
    startDate: getRelativeDate(-38),
    fotLimitPercent: 40,
    links: {
      proposalUrl: 'https://limurproject.ru/#kp-demo',
      measurementUrl: 'https://limurproject.ru/#obmer-demo',
      folderUrl: 'https://limurproject.ru/#folder-demo',
    },
    teamIds: ['tm_designer', 'tm_visualizer', 'tm_drafter', 'tm_measurer'],
    paymentStages: [
      {
        id: ps1,
        order: 1,
        title: 'Этап 1. Обмеры, планировка и концепция',
        amount: 354000,
        dueDate: getRelativeDate(-36),
        isPaid: true,
        paidDate: getRelativeDate(-35),
      },
      {
        id: ps2,
        order: 2,
        title: 'Этап 2. 3D-визуализация всех помещений',
        amount: 413000,
        dueDate: getRelativeDate(-5),
        isPaid: true,
        paidDate: getRelativeDate(-4),
      },
      {
        id: ps3,
        order: 3,
        title: 'Этап 3. Рабочая документация и ведомости',
        amount: 413000,
        dueDate: getRelativeDate(18),
        isPaid: false,
        paidDate: '',
      },
    ],
    workStages: [
      {
        id: 'ws_demo_1',
        paymentStageId: ps1,
        title: 'Замеры объекта и фотофиксация',
        assigneeId: 'tm_measurer',
        planStart: getRelativeDate(-38),
        planEnd: getRelativeDate(-35),
        actualStart: getRelativeDate(-38),
        actualEnd: getRelativeDate(-35),
        progress: 100,
        delayReason: 'none',
        internalNote: 'Выполнено лазерным дальномером, облако точек загружено в папку.',
      },
      {
        id: 'ws_demo_2',
        paymentStageId: ps1,
        title: 'Стартовые планировочные решения (3 варианта)',
        assigneeId: 'tm_designer',
        planStart: getRelativeDate(-34),
        planEnd: getRelativeDate(-25),
        actualStart: getRelativeDate(-34),
        actualEnd: getRelativeDate(-24),
        progress: 100,
        delayReason: 'none',
        internalNote: 'Согласован вариант №2 с объединением кухни-гостиной.',
      },
      {
        id: 'ws_demo_3',
        paymentStageId: ps1,
        title: 'ТЗ и стилевые коллажи',
        assigneeId: 'tm_designer',
        planStart: getRelativeDate(-24),
        planEnd: getRelativeDate(-18),
        actualStart: getRelativeDate(-24),
        actualEnd: getRelativeDate(-16),
        progress: 100,
        delayReason: 'client',
        internalNote: 'Ожидали правки по оттенкам шпона и камня 2 дня.',
      },
      {
        id: 'ws_demo_4',
        paymentStageId: ps1,
        title: 'Визы кухни-гостиной и мастер-санузла',
        assigneeId: 'tm_visualizer',
        planStart: getRelativeDate(-17),
        planEnd: getRelativeDate(-7),
        actualStart: getRelativeDate(-16),
        actualEnd: getRelativeDate(-6),
        progress: 100,
        delayReason: 'none',
        internalNote: 'Утверждены с первой итерации правок.',
      },
      {
        id: 'ws_demo_5',
        paymentStageId: ps2,
        title: '3D-визуализация спальни, детской и прихожей',
        assigneeId: 'tm_visualizer',
        planStart: getRelativeDate(-6),
        planEnd: getRelativeDate(5),
        actualStart: getRelativeDate(-5),
        actualEnd: '',
        progress: 70,
        delayReason: 'client',
        internalNote: 'Ждём выбор ткани для изголовья кровати от заказчика.',
      },
      {
        id: 'ws_demo_6',
        paymentStageId: ps2,
        title: 'Финальные правки и рендеры высокого разрешения',
        assigneeId: 'tm_visualizer',
        planStart: getRelativeDate(6),
        planEnd: getRelativeDate(11),
        actualStart: '',
        actualEnd: '',
        progress: 15,
        delayReason: 'none',
        internalNote: '',
      },
      {
        id: 'ws_demo_7',
        paymentStageId: ps3,
        title: 'Альбом рабочих чертежей (электрика, сантехника, развёртки)',
        assigneeId: 'tm_drafter',
        planStart: getRelativeDate(12),
        planEnd: getRelativeDate(25),
        actualStart: '',
        actualEnd: '',
        progress: 0,
        delayReason: 'none',
        internalNote: 'Передать чертёжнику после финализации привязок света.',
      },
      {
        id: 'ws_demo_8',
        paymentStageId: ps3,
        title: 'Ведомость чистовых материалов, света и мебели',
        assigneeId: 'tm_designer',
        planStart: getRelativeDate(22),
        planEnd: getRelativeDate(30),
        actualStart: '',
        actualEnd: '',
        progress: 0,
        delayReason: 'none',
        internalNote: '',
      },
    ],
  };

  return {
    version: 1,
    settings: {
      defaultFotLimitPercent: 40,
      studioName: 'LIMUR STUDIO OS',
    },
    team: DEFAULT_TEAM,
    projects: [demoProject],
    worklogs: [
      {
        id: 'wl_demo_1',
        projectId: pId,
        memberId: 'tm_measurer',
        month: prevMonth,
        date: getRelativeDate(-35),
        areaSqm: 118,
        hours: 6,
        pieceworkAmount: 18000,
        comment: 'Выездной лазерный обмер + обмерный план в DWG',
      },
      {
        id: 'wl_demo_2',
        projectId: pId,
        memberId: 'tm_designer',
        month: prevMonth,
        date: getRelativeDate(-18),
        areaSqm: 118,
        hours: 48,
        pieceworkAmount: 0,
        comment: 'Планировка, ТЗ, коллажи, координация',
      },
      {
        id: 'wl_demo_3',
        projectId: pId,
        memberId: 'tm_visualizer',
        month: prevMonth,
        date: getRelativeDate(-10),
        areaSqm: 62,
        hours: 44,
        pieceworkAmount: 0,
        comment: 'Визуализация кухни-гостиной и СУ',
      },
      {
        id: 'wl_demo_4',
        projectId: pId,
        memberId: 'tm_visualizer',
        month: currMonth,
        date: getRelativeDate(-2),
        areaSqm: 56,
        hours: 38,
        pieceworkAmount: 0,
        comment: 'Визуализация спальни, детской и входной группы',
      },
      {
        id: 'wl_demo_5',
        projectId: pId,
        memberId: 'tm_designer',
        month: currMonth,
        date: getRelativeDate(-1),
        areaSqm: 56,
        hours: 22,
        pieceworkAmount: 0,
        comment: 'Авторский контроль 3D-визуализаций, подбор отделки',
      },
      {
        id: 'wl_demo_6',
        projectId: pId,
        memberId: 'tm_drafter',
        month: currMonth,
        date: getRelativeDate(0),
        areaSqm: 40,
        hours: 16,
        pieceworkAmount: 34000,
        comment: 'Авансовая часть планов демонтажа и монтажа перегородок',
      },
    ],
    expenses: [
      {
        id: 'exp_demo_1',
        projectId: pId,
        date: getRelativeDate(-28),
        category: 'Бензин и логистика',
        amount: 4500,
        comment: 'Выезды на обмер и в салоны камня/шпона',
      },
      {
        id: 'exp_demo_2',
        projectId: pId,
        date: getRelativeDate(-12),
        category: 'Выкрасы и образцы',
        amount: 12800,
        comment: 'Образцы микроцемента и выкрасы эмали 6 оттенков',
      },
      {
        id: 'exp_demo_3',
        projectId: pId,
        date: getRelativeDate(-3),
        category: 'Печать и альбомы',
        amount: 6200,
        comment: 'Печать презентации концепции A3 на матовой бумаге',
      },
    ],
  };
}

export function createEmptyData(): AppData {
  return {
    version: 1,
    settings: {
      defaultFotLimitPercent: 40,
      studioName: 'LIMUR STUDIO OS',
    },
    team: DEFAULT_TEAM,
    projects: [],
    worklogs: [],
    expenses: [],
  };
}

export function createStandardWorkTemplate(
  paymentStages: PaymentStage[],
  startDateStr: string,
  team: TeamMember[]
): WorkSubStage[] {
  const base = startDateStr ? new Date(startDateStr) : new Date();
  const addDays = (days: number): string => {
    const d = new Date(base);
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const findByGroup = (group: string) =>
    team.find((m) => m.costGroup === group)?.id || team[0]?.id || '';

  const ps1 = paymentStages[0]?.id || '';
  const ps2 = paymentStages[1]?.id || ps1;
  const ps3 = paymentStages[2]?.id || ps2;

  if (!ps1) return [];

  return [
    {
      id: createId('ws'),
      paymentStageId: ps1,
      title: 'Замеры и фотофиксация',
      assigneeId: findByGroup('Замеры'),
      planStart: addDays(0),
      planEnd: addDays(3),
      actualStart: '',
      actualEnd: '',
      progress: 0,
      delayReason: 'none',
      internalNote: '',
    },
    {
      id: createId('ws'),
      paymentStageId: ps1,
      title: 'Стартовые планировочные решения',
      assigneeId: findByGroup('Дизайнер'),
      planStart: addDays(4),
      planEnd: addDays(14),
      actualStart: '',
      actualEnd: '',
      progress: 0,
      delayReason: 'none',
      internalNote: '',
    },
    {
      id: createId('ws'),
      paymentStageId: ps1,
      title: 'ТЗ и стилевая концепция',
      assigneeId: findByGroup('Дизайнер'),
      planStart: addDays(15),
      planEnd: addDays(22),
      actualStart: '',
      actualEnd: '',
      progress: 0,
      delayReason: 'none',
      internalNote: '',
    },
    {
      id: createId('ws'),
      paymentStageId: ps2,
      title: '3D-визуализация основных зон',
      assigneeId: findByGroup('Визуализатор'),
      planStart: addDays(23),
      planEnd: addDays(40),
      actualStart: '',
      actualEnd: '',
      progress: 0,
      delayReason: 'none',
      internalNote: '',
    },
    {
      id: createId('ws'),
      paymentStageId: ps3,
      title: 'Рабочая документация и чертежи',
      assigneeId: findByGroup('Чертёжник'),
      planStart: addDays(41),
      planEnd: addDays(60),
      actualStart: '',
      actualEnd: '',
      progress: 0,
      delayReason: 'none',
      internalNote: '',
    },
  ];
}
