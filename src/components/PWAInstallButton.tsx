import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  fullWidth?: boolean;
  onActionComplete?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  fullWidth = false,
  onActionComplete,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={async () => {
          await install();
          onActionComplete?.();
        }}
        className={
          fullWidth
            ? 'flex min-h-[42px] w-full items-center justify-center gap-2 border border-[#0A0A0A] bg-white px-4 text-xs font-semibold text-[#0A0A0A] transition-colors hover:bg-[#0A0A0A] hover:text-white'
            : 'flex h-9 items-center gap-1.5 border border-[#0A0A0A] bg-white px-2.5 text-xs font-medium text-[#0A0A0A] transition-colors hover:bg-[#0A0A0A] hover:text-white whitespace-nowrap shrink-0'
        }
        title="Установить LIMUR PROJECT на устройство для запуска офлайн"
      >
        <Download className="h-3.5 w-3.5" />
        <span>Установить</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={
            fullWidth
              ? 'flex min-h-[42px] w-full items-center justify-center gap-2 border border-[#0A0A0A] bg-white px-4 text-xs font-semibold text-[#0A0A0A] transition-colors hover:bg-[#0A0A0A] hover:text-white'
              : 'flex h-9 items-center gap-1.5 border border-[#0A0A0A] bg-white px-2.5 text-xs font-medium text-[#0A0A0A] transition-colors hover:bg-[#0A0A0A] hover:text-white whitespace-nowrap shrink-0'
          }
          title="Добавить LIMUR PROJECT на экран «Домой» iPhone / iPad"
        >
          <Smartphone className="h-3.5 w-3.5" />
          <span>На экран</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-ios-title"
          >
            <div className="w-full max-w-sm border border-[#0A0A0A] bg-white p-6 text-[#0A0A0A]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold tracking-[0.16em] text-[#525252]">
                    LIMUR PROJECT · PWA
                  </div>
                  <h3 id="pwa-ios-title" className="mt-1 text-base font-semibold">
                    Установка на iPhone / iPad
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="flex h-8 w-8 items-center justify-center border border-[#D4D4D4] text-[#0A0A0A] hover:border-[#0A0A0A]"
                  aria-label="Закрыть"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <ol className="mt-4 space-y-2.5 text-xs leading-relaxed text-[#262626]">
                <li>
                  <span className="font-semibold text-[#0A0A0A]">1.</span> Нажмите кнопку{' '}
                  <span className="font-semibold text-[#0A0A0A]">«Поделиться»</span> в нижней
                  панели браузера Safari.
                </li>
                <li>
                  <span className="font-semibold text-[#0A0A0A]">2.</span> Прокрутите список и
                  выберите{' '}
                  <span className="font-semibold text-[#0A0A0A]">«На экран „Домой“»</span>.
                </li>
                <li>
                  <span className="font-semibold text-[#0A0A0A]">3.</span> Подтвердите добавление —
                  приложение будет запускаться в полноэкранном режиме и работать офлайн.
                </li>
              </ol>

              <button
                type="button"
                onClick={() => {
                  setShowIOSGuide(false);
                  onActionComplete?.();
                }}
                className="mt-5 w-full bg-[#0A0A0A] py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#262626]"
              >
                Понятно
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
