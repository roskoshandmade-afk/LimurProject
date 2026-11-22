import React, { useEffect, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { createId, createStandardWorkTemplate } from '../data/demoData';
import { PaymentStage, Project, ProjectStatus, TeamMember } from '../types';
import { getTodayIso } from '../utils/calculations';

interface ProjectModalProps {
  open: boolean;
  editingProject: Project | null;
  team: TeamMember[];
  defaultFotLimitPercent: number;
  onSave: (project: Project, isNew: boolean) => void;
  onClose: () => void;
}

const STATUSES: ProjectStatus[] = ['В работе', 'На паузе', 'Заморожен', 'Сдан'];

function buildInitialPaymentStages(startDate: string): PaymentStage[] {
  const base = startDate ? new Date(startDate) : new Date();
  const addDays = (days: number) => {
    const d = new Date(base);
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  return [
    {
      id: createId('ps'),
      order: 1,
      title: 'Этап 1. Обмеры, планировка и концепция',
      amount: 300000,
      dueDate: addDays(2),
      isPaid: false,
      paidDate: '',
    },
    {
      id: createId('ps'),
      order: 2,
      title: 'Этап 2. 3D-визуализация помещений',
      amount: 350000,
      dueDate: addDays(25),
      isPaid: false,
      paidDate: '',
    },
    {
      id: createId('ps'),
      order: 3,
      title: 'Этап 3. Рабочая документация и ведомости',
      amount: 350000,
      dueDate: addDays(50),
      isPaid: false,
      paidDate: '',
    },
  ];
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  open,
  editingProject,
  team,
  defaultFotLimitPercent,
  onSave,
  onClose,
}) => {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [areaSqm, setAreaSqm] = useState<string>('85');
  const [status, setStatus] = useState<ProjectStatus>('В работе');
  const [clientContact, setClientContact] = useState('');
  const [startDate, setStartDate] = useState(getTodayIso());
  const [fotLimitPercent, setFotLimitPercent] = useState<string>(String(defaultFotLimitPercent));
  const [proposalUrl, setProposalUrl] = useState('');
  const [measurementUrl, setMeasurementUrl] = useState('');
  const [folderUrl, setFolderUrl] = useState('');
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [paymentStages, setPaymentStages] = useState<PaymentStage[]>([]);
  const [useStandardWorkStages, setUseStandardWorkStages] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (editingProject) {
      setName(editingProject.name);
      setAddress(editingProject.address);
      setAreaSqm(String(editingProject.areaSqm));
      setStatus(editingProject.status);
      setClientContact(editingProject.clientContact);
      setStartDate(editingProject.startDate || getTodayIso());
      setFotLimitPercent(String(editingProject.fotLimitPercent || defaultFotLimitPercent));
      setProposalUrl(editingProject.links.proposalUrl);
      setMeasurementUrl(editingProject.links.measurementUrl);
      setFolderUrl(editingProject.links.folderUrl);
      setTeamIds(editingProject.teamIds);
      setPaymentStages(editingProject.paymentStages.map((ps) => ({ ...ps })));
      setUseStandardWorkStages(false);
    } else {
      const today = getTodayIso();
      setName('');
      setAddress('');
      setAreaSqm('90');
      setStatus('В работе');
      setClientContact('');
      setStartDate(today);
      setFotLimitPercent(String(defaultFotLimitPercent));
      setProposalUrl('');
      setMeasurementUrl('');
      setFolderUrl('');
      setTeamIds(team.map((m) => m.id));
      setPaymentStages(buildInitialPaymentStages(today));
      setUseStandardWorkStages(true);
    }
  }, [open, editingProject, team, defaultFotLimitPercent]);

  if (!open) return null;

  const toggleTeamMember = (id: string) => {
    setTeamIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const addPaymentStage = () => {
    setPaymentStages((prev) => [
      ...prev,
      {
        id: createId('ps'),
        order: prev.length + 1,
        title: `Этап ${prev.length + 1}. Новый этап`,
        amount: 0,
        dueDate: startDate || getTodayIso(),
        isPaid: false,
        paidDate: '',
      },
    ]);
  };

  const updatePaymentStage = (id: string, patch: Partial<PaymentStage>) => {
    setPaymentStages((prev) =>
      prev.map((ps) => (ps.id === id ? { ...ps, ...patch } : ps))
    );
  };

  const removePaymentStage = (id: string) => {
    setPaymentStages((prev) =>
      prev
        .filter((ps) => ps.id !== id)
        .map((ps, index) => ({ ...ps, order: index + 1 }))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Укажите название проекта');
      return;
    }

    const parsedArea = Math.max(0, Number(areaSqm) || 0);
    const parsedLimit = Math.min(100, Math.max(5, Number(fotLimitPercent) || defaultFotLimitPercent));
    const normalizedStages = paymentStages.map((ps, idx) => ({
      ...ps,
      order: idx + 1,
      amount: Math.max(0, Number(ps.amount) || 0),
    }));

    const isNew = !editingProject;
    const workStages = editingProject
      ? editingProject.workStages
      : useStandardWorkStages
      ? createStandardWorkTemplate(normalizedStages, startDate, team)
      : [];

    const project: Project = {
      id: editingProject ? editingProject.id : createId('proj'),
      isDemo: editingProject?.isDemo && name.includes('[ДЕМО]'),
      name: name.trim(),
      address: address.trim(),
      areaSqm: parsedArea,
      status,
      clientContact: clientContact.trim(),
      startDate: startDate || getTodayIso(),
      fotLimitPercent: parsedLimit,
      links: {
        proposalUrl: proposalUrl.trim(),
        measurementUrl: measurementUrl.trim(),
        folderUrl: folderUrl.trim(),
      },
      teamIds,
      paymentStages: normalizedStages,
      workStages,
    };

    onSave(project, isNew);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-modal-title"
    >
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col border border-[#E5E5E2] bg-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E5E5E2] px-6 py-4">
          <h2 id="project-modal-title" className="text-base font-semibold tracking-tight text-[#0F0F0F]">
            {editingProject ? 'Редактирование объекта' : 'Новый дизайн-проект'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center text-[#6B6B68] hover:bg-[#F6F6F5] hover:text-[#0F0F0F]"
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto px-6 py-5">
          <div className="space-y-6">
            {error && (
              <div className="border border-[#FECACA] bg-[#FEF2F2] px-4 py-2.5 text-xs font-medium text-[#991B1B]">
                {error}
              </div>
            )}

            {/* Passport */}
            <div className="space-y-4">
              <div className="text-xs font-semibold text-[#0F0F0F]">01. Паспорт объекта</div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs text-[#6B6B68]">Название проекта *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Например: ЖК «Садовые Кварталы», кв. 42"
                    className="h-10 w-full border border-[#D4D4D0] bg-white px-3 text-sm text-[#0F0F0F] focus:border-[#0F0F0F] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[#6B6B68]">Адрес объекта</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Город, улица, дом"
                    className="h-10 w-full border border-[#D4D4D0] bg-white px-3 text-sm text-[#0F0F0F] focus:border-[#0F0F0F] focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-[#6B6B68]">Площадь, м²</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={areaSqm}
                      onChange={(e) => setAreaSqm(e.target.value)}
                      className="h-10 w-full border border-[#D4D4D0] bg-white px-3 font-mono text-sm tabular-nums text-[#0F0F0F] focus:border-[#0F0F0F] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-[#6B6B68]">Статус</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                      className="h-10 w-full border border-[#D4D4D0] bg-white px-2.5 text-sm text-[#0F0F0F] focus:border-[#0F0F0F] focus:outline-none"
                    >
                      {STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[#6B6B68]">Контакт клиента</label>
                  <input
                    type="text"
                    value={clientContact}
                    onChange={(e) => setClientContact(e.target.value)}
                    placeholder="Телефон, Telegram или e-mail"
                    className="h-10 w-full border border-[#D4D4D0] bg-white px-3 text-sm text-[#0F0F0F] focus:border-[#0F0F0F] focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-[#6B6B68]">Дата старта</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="h-10 w-full border border-[#D4D4D0] bg-white px-3 font-mono text-xs text-[#0F0F0F] focus:border-[#0F0F0F] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-[#6B6B68]">Лимит ФОТ, %</label>
                    <input
                      type="number"
                      min="5"
                      max="100"
                      value={fotLimitPercent}
                      onChange={(e) => setFotLimitPercent(e.target.value)}
                      className="h-10 w-full border border-[#D4D4D0] bg-white px-3 font-mono text-sm tabular-nums text-[#0F0F0F] focus:border-[#0F0F0F] focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Links */}
            <div className="space-y-4 border-t border-[#E5E5E2] pt-5">
              <div className="text-xs font-semibold text-[#0F0F0F]">02. Ссылки на документы и исходники</div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs text-[#6B6B68]">Ссылка на КП</label>
                  <input
                    type="url"
                    value={proposalUrl}
                    onChange={(e) => setProposalUrl(e.target.value)}
                    placeholder="https://..."
                    className="h-10 w-full border border-[#D4D4D0] bg-white px-3 text-xs text-[#0F0F0F] focus:border-[#0F0F0F] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[#6B6B68]">Обмерный план</label>
                  <input
                    type="url"
                    value={measurementUrl}
                    onChange={(e) => setMeasurementUrl(e.target.value)}
                    placeholder="https://..."
                    className="h-10 w-full border border-[#D4D4D0] bg-white px-3 text-xs text-[#0F0F0F] focus:border-[#0F0F0F] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[#6B6B68]">Папка с материалами</label>
                  <input
                    type="url"
                    value={folderUrl}
                    onChange={(e) => setFolderUrl(e.target.value)}
                    placeholder="https://..."
                    className="h-10 w-full border border-[#D4D4D0] bg-white px-3 text-xs text-[#0F0F0F] focus:border-[#0F0F0F] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Payment Stages */}
            <div className="space-y-3 border-t border-[#E5E5E2] pt-5">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-[#0F0F0F]">03. Этапы оплаты по КП</div>
                <button
                  type="button"
                  onClick={addPaymentStage}
                  className="flex items-center gap-1 text-xs font-medium text-[#0F0F0F] underline-offset-4 hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Добавить этап
                </button>
              </div>
              <div className="space-y-2.5">
                {paymentStages.map((ps, idx) => (
                  <div
                    key={ps.id}
                    className="grid grid-cols-1 gap-2 border border-[#E5E5E2] bg-[#FAF9F8] p-3 sm:grid-cols-12 sm:items-center"
                  >
                    <div className="sm:col-span-6">
                      <input
                        type="text"
                        value={ps.title}
                        onChange={(e) => updatePaymentStage(ps.id, { title: e.target.value })}
                        placeholder={`Этап ${idx + 1}`}
                        className="h-9 w-full border border-[#D4D4D0] bg-white px-2.5 text-xs text-[#0F0F0F] focus:border-[#0F0F0F] focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={ps.amount}
                        onChange={(e) =>
                          updatePaymentStage(ps.id, { amount: Number(e.target.value) || 0 })
                        }
                        placeholder="Сумма ₽"
                        className="h-9 w-full border border-[#D4D4D0] bg-white px-2.5 font-mono text-xs tabular-nums text-[#0F0F0F] focus:border-[#0F0F0F] focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2 sm:col-span-3">
                      <input
                        type="date"
                        value={ps.dueDate}
                        onChange={(e) => updatePaymentStage(ps.id, { dueDate: e.target.value })}
                        className="h-9 flex-1 border border-[#D4D4D0] bg-white px-2 font-mono text-[11px] text-[#0F0F0F] focus:border-[#0F0F0F] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => removePaymentStage(ps.id)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center border border-[#D4D4D0] bg-white text-[#6B6B68] hover:border-[#B91C1C] hover:text-[#B91C1C]"
                        aria-label="Удалить этап оплаты"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Team Assignment */}
            <div className="space-y-3 border-t border-[#E5E5E2] pt-5">
              <div className="text-xs font-semibold text-[#0F0F0F]">04. Команда проекта (роли)</div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {team.map((member) => {
                  const checked = teamIds.includes(member.id);
                  return (
                    <label
                      key={member.id}
                      className={`flex cursor-pointer items-center justify-between border px-3 py-2.5 text-xs transition-colors ${
                        checked
                          ? 'border-[#0F0F0F] bg-[#FAF9F8] text-[#0F0F0F]'
                          : 'border-[#E5E5E2] bg-white text-[#6B6B68]'
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTeamMember(member.id)}
                          className="h-4 w-4 accent-[#0F0F0F]"
                        />
                        <span className="font-medium text-[#0F0F0F]">{member.roleTitle}</span>
                      </span>
                      <span className="font-mono text-[11px] text-[#6B6B68]">{member.code}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {!editingProject && (
              <div className="border-t border-[#E5E5E2] pt-4">
                <label className="flex cursor-pointer items-center gap-2.5 text-xs text-[#0F0F0F]">
                  <input
                    type="checkbox"
                    checked={useStandardWorkStages}
                    onChange={(e) => setUseStandardWorkStages(e.target.checked)}
                    className="h-4 w-4 accent-[#0F0F0F]"
                  />
                  <span>
                    Создать базовый набор рабочих подэтапов для диаграммы Ганта (Замеры → Планировка → ТЗ → 3D → РД)
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* Footer Buttons */}
          <div className="mt-6 flex items-center justify-end gap-3 border-t border-[#E5E5E2] pt-5">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] border border-[#D4D4D0] bg-white px-5 py-2 text-xs font-medium text-[#0F0F0F] transition-colors hover:bg-[#F6F6F5]"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="min-h-[40px] bg-[#0F0F0F] px-6 py-2 text-xs font-medium text-white transition-colors hover:bg-[#2A2A2A]"
            >
              {editingProject ? 'Сохранить изменения' : 'Создать проект'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
