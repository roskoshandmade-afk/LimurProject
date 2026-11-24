import React, { useEffect } from 'react';
import {
  Check,
  Download,
  MoreVertical,
  PlusSquare,
  Share,
  Smartphone,
  WifiOff,
  X,
} from 'lucide-react';
import { LimurLogo } from './LimurLogo';

interface InstallAppModalProps {
  open: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  canPromptNative: boolean;
  onTriggerNativeInstall: () => void;
  onClose: () => void;
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({
  open,
  isIOS,
  isAndroid,
  canPromptNative,
  onTriggerNativeInstall,
  onClose,
}) => {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const iosSection = (
    <div
      className={`border p-4 ${
        isIOS ? 'border-[#0A0A0A] bg-[#FAFAFA]' : 'border-[#E5E7EB] bg-white'
      }`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-[#E5E7EB] pb-2.5">
        <span className="text-xs font-bold tracking-[0.04em] text-[#0A0A0A]">
          Для iPhone / iPad (Safari)
        </span>
        {isIOS && (
          <span className="bg-[#0A0A0A] px-2 py-0.5 text-[10px] font-semibold text-white">
            Ваше устройство
          </span>
        )}
      </div>

      <ol className="mt-3 space-y-3 text-xs leading-relaxed text-[#262626]">
        <li className="flex items-start gap-2.5">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center border border-[#0A0A0A] bg-white text-[#0A0A0A]">
            <Share className="h-3.5 w-3.5" />
          </span>
          <div>
            <span className="font-semibold text-[#0A0A0A]">Шаг 1.</span> Нажмите кнопку{' '}
            <span className="font-semibold text-[#0A0A0A]">«Поделиться»</span> (квадрат со стрелкой
            вверх в нижней панели экрана Safari).
          </div>
        </li>

        <li className="flex items-start gap-2.5">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center border border-[#0A0A0A] bg-white text-[#0A0A0A]">
            <PlusSquare className="h-3.5 w-3.5" />
          </span>
          <div>
            <span className="font-semibold text-[#0A0A0A]">Шаг 2.</span> Прокрутите список вниз и
            выберите <span className="font-semibold text-[#0A0A0A]">«На экран „Домой“»</span>.
          </div>
        </li>

        <li className="flex items-start gap-2.5">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center border border-[#0A0A0A] bg-white text-[#0A0A0A]">
            <Check className="h-3.5 w-3.5" />
          </span>
          <div>
            <span className="font-semibold text-[#0A0A0A]">Шаг 3.</span> Нажмите{' '}
            <span className="font-semibold text-[#0A0A0A]">«Добавить»</span> — фирменная иконка{' '}
            <span className="font-semibold text-[#0A0A0A]">LI.MUR</span> появится на рабочем столе.
          </div>
        </li>
      </ol>
    </div>
  );

  const androidSection = (
    <div
      className={`border p-4 ${
        isAndroid ? 'border-[#0A0A0A] bg-[#FAFAFA]' : 'border-[#E5E7EB] bg-white'
      }`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-[#E5E7EB] pb-2.5">
        <span className="text-xs font-bold tracking-[0.04em] text-[#0A0A0A]">
          Для Android (Chrome)
        </span>
        {isAndroid && (
          <span className="bg-[#0A0A0A] px-2 py-0.5 text-[10px] font-semibold text-white">
            Ваше устройство
          </span>
        )}
      </div>

      <ol className="mt-3 space-y-3 text-xs leading-relaxed text-[#262626]">
        <li className="flex items-start gap-2.5">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center border border-[#0A0A0A] bg-white text-[#0A0A0A]">
            <MoreVertical className="h-3.5 w-3.5" />
          </span>
          <div>
            <span className="font-semibold text-[#0A0A0A]">Шаг 1.</span> Нажмите меню{' '}
            <span className="font-mono font-bold text-[#0A0A0A]">⋮</span> в правом верхнем углу
            браузера Chrome.
          </div>
        </li>

        <li className="flex items-start gap-2.5">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center border border-[#0A0A0A] bg-white text-[#0A0A0A]">
            <Download className="h-3.5 w-3.5" />
          </span>
          <div>
            <span className="font-semibold text-[#0A0A0A]">Шаг 2.</span> Выберите{' '}
            <span className="font-semibold text-[#0A0A0A]">«Установить приложение»</span> или{' '}
            <span className="font-semibold text-[#0A0A0A]">«Добавить на гл. экран»</span> и
            подтвердите установку.
          </div>
        </li>
      </ol>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-app-modal-title"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto border border-[#0A0A0A] bg-white p-5 sm:p-6 text-[#0A0A0A]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with official rectangular LI.MUR / PROJECT logo */}
        <div className="flex items-start justify-between gap-4 border-b border-[#0A0A0A] pb-4">
          <div>
            <LimurLogo className="h-10 w-auto shrink-0" />
            <h2
              id="install-app-modal-title"
              className="mt-3 text-base font-bold tracking-tight text-[#0A0A0A]"
            >
              Установка LI.MUR PROJECT на телефон
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-[#525252]">
              Запускайте студию в один клик с главного экрана в полноэкранном режиме — с поддержкой
              работы без интернета.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center border border-[#D4D4D4] text-[#0A0A0A] transition-colors hover:border-[#0A0A0A]"
            aria-label="Закрыть окно установки"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Native quick-install CTA when browser exposes beforeinstallprompt */}
        {canPromptNative && (
          <div className="mt-4 border border-[#0A0A0A] bg-[#F8F9FA] p-3.5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-[#262626]">
                <div className="font-semibold text-[#0A0A0A]">Быстрая установка доступна</div>
                <div className="mt-0.5 text-[11px] text-[#525252]">
                  Браузер поддерживает установку в один клик.
                </div>
              </div>
              <button
                type="button"
                onClick={onTriggerNativeInstall}
                className="flex h-9 shrink-0 items-center justify-center gap-1.5 bg-[#0A0A0A] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#262626]"
              >
                <Download className="h-3.5 w-3.5" />
                Установить сейчас
              </button>
            </div>
          </div>
        )}

        {/* Step-by-step platform instructions (detected platform shown first) */}
        <div className="mt-4 space-y-3">
          {isAndroid && !isIOS ? (
            <>
              {androidSection}
              {iosSection}
            </>
          ) : (
            <>
              {iosSection}
              {androidSection}
            </>
          )}
        </div>

        {/* Offline-first reassurance strip */}
        <div className="mt-4 flex items-center gap-2.5 border border-[#E5E7EB] bg-[#F8F9FA] px-3.5 py-2.5 text-[11px] text-[#525252]">
          <WifiOff className="h-4 w-4 shrink-0 text-[#0A0A0A]" />
          <span>
            Установленное приложение кэширует интерфейс через Service Worker и синхронизирует
            офлайн-правки с Supabase при возвращении сети.
          </span>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-9 bg-[#0A0A0A] px-5 text-xs font-semibold text-white transition-colors hover:bg-[#262626]"
          >
            Понятно
          </button>
        </div>
      </div>
    </div>
  );
};

interface MobileInstallBannerProps {
  visible: boolean;
  onInstall: () => void;
  onDismiss: () => void;
}

export const MobileInstallBanner: React.FC<MobileInstallBannerProps> = ({
  visible,
  onInstall,
  onDismiss,
}) => {
  if (!visible) return null;

  return (
    <div
      className="no-print fixed inset-x-0 bottom-0 z-40 border-t-2 border-[#0A0A0A] bg-white px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] md:hidden"
      role="region"
      aria-label="Установка приложения на телефон"
    >
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <LimurLogo className="h-8 w-auto shrink-0" />
          <div className="min-w-0">
            <div className="truncate text-xs font-bold text-[#0A0A0A]">
              Установить на телефон
            </div>
            <div className="truncate text-[11px] text-[#525252]">
              Быстрый запуск и работа без сети
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onInstall}
            className="flex h-8 items-center gap-1.5 bg-[#0A0A0A] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#262626] whitespace-nowrap"
          >
            <Smartphone className="h-3.5 w-3.5" />
            На телефон
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="flex h-8 w-8 items-center justify-center border border-[#D4D4D4] bg-white text-[#525252] transition-colors hover:border-[#0A0A0A] hover:text-[#0A0A0A]"
            aria-label="Скрыть плашку установки"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
