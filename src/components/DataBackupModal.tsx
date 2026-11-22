import React, { useRef, useState } from 'react';
import { Download, Upload, Trash2, RotateCcw, X } from 'lucide-react';
import { AppData } from '../types';
import { exportDataToJson, parseImportedJson } from '../utils/storage';

interface DataBackupModalProps {
  open: boolean;
  data: AppData;
  onClose: () => void;
  onImport: (imported: AppData) => void;
  onResetEmpty: () => void;
  onRestoreDemo: () => void;
  onNotify: (msg: string, type?: 'default' | 'error') => void;
}

export const DataBackupModal: React.FC<DataBackupModalProps> = ({
  open,
  data,
  onClose,
  onImport,
  onResetEmpty,
  onRestoreDemo,
  onNotify,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  if (!open) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const result = parseImportedJson(text);
      if (!result.ok) {
        onNotify(result.error, 'error');
        return;
      }
      onImport(result.data);
      onNotify(`Резервная копия загружена: ${result.data.projects.length} пр.`);
      onClose();
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="backup-modal-title"
    >
      <div className="w-full max-w-lg border border-[#E5E5E2] bg-white p-6">
        <div className="flex items-start justify-between gap-4 border-b border-[#E5E5E2] pb-4">
          <div>
            <h2 id="backup-modal-title" className="text-lg font-semibold tracking-tight text-[#0F0F0F]">
              Данные и резервные копии
            </h2>
            <p className="mt-1 text-xs text-[#525252]">
              Все изменения синхронизируются в реальном времени (Supabase) и кэшируются локально
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center text-[#6B6B68] transition-colors hover:bg-[#F6F6F5] hover:text-[#0F0F0F]"
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-4 border-b border-[#E5E5E2] pb-5">
          <div>
            <div className="text-xs text-[#6B6B68]">Проекты</div>
            <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-[#0F0F0F]">
              {data.projects.length}
            </div>
          </div>
          <div>
            <div className="text-xs text-[#6B6B68]">Позиции команды</div>
            <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-[#0F0F0F]">
              {data.team.length}
            </div>
          </div>
          <div>
            <div className="text-xs text-[#6B6B68]">Записи журнала</div>
            <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-[#0F0F0F]">
              {data.worklogs.length + data.expenses.length}
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                exportDataToJson(data);
                onNotify('JSON-резервная копия сохранена');
              }}
              className="flex min-h-[42px] flex-1 items-center justify-center gap-2 bg-[#0F0F0F] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#2A2A2A] whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" />
              Экспорт JSON
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex min-h-[42px] flex-1 items-center justify-center gap-2 border border-[#0F0F0F] bg-white px-4 py-2 text-xs font-medium text-[#0F0F0F] transition-colors hover:bg-[#F6F6F5] whitespace-nowrap"
            >
              <Upload className="h-3.5 w-3.5" />
              Импорт JSON
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          <div className="border-t border-[#E5E5E2] pt-4">
            <div className="text-xs font-medium text-[#0F0F0F]">Управление демо-данными</div>
            <p className="mt-1 text-xs leading-relaxed text-[#6B6B68]">
              Вы можете очистить все проекты и журнал для работы с чистого листа (сохранив стандартный справочник ролей) или вернуть демонстрационный шаблон.
            </p>

            {!confirmClear ? (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="flex min-h-[40px] flex-1 items-center justify-center gap-2 border border-[#DC2626] bg-white px-4 py-2 text-xs font-medium text-[#B91C1C] transition-colors hover:bg-[#FEF2F2] whitespace-nowrap"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Очистить демо / Начать с нуля
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onRestoreDemo();
                    onNotify('Загружен демонстрационный шаблон');
                    onClose();
                  }}
                  className="flex min-h-[40px] flex-1 items-center justify-center gap-2 border border-[#D4D4D0] bg-white px-4 py-2 text-xs font-medium text-[#0F0F0F] transition-colors hover:bg-[#F6F6F5] whitespace-nowrap"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Загрузить [ДЕМО] шаблон
                </button>
              </div>
            ) : (
              <div className="mt-3 border border-[#FECACA] bg-[#FEF2F2] p-3">
                <p className="text-xs font-medium text-[#991B1B]">
                  Удалить все текущие проекты, записи выработки и чеки?
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onResetEmpty();
                      setConfirmClear(false);
                      onNotify('Все данные очищены. Можно создавать проекты с нуля');
                      onClose();
                    }}
                    className="min-h-[36px] bg-[#B91C1C] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#991B1B]"
                  >
                    Да, начать с нуля
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="min-h-[36px] border border-[#D4D4D0] bg-white px-3 py-1.5 text-xs font-medium text-[#0F0F0F] hover:bg-[#F6F6F5]"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
