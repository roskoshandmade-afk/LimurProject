import React, { useEffect, useState } from 'react';
import { Check, Eye, EyeOff, RefreshCw, RotateCcw, Wifi, WifiOff, X } from 'lucide-react';
import {
  clearCustomSupabaseConfig,
  getActiveSupabaseConfig,
  saveCustomSupabaseConfig,
} from '../supabaseClient';
import {
  RealtimeStatus,
  SupabaseSyncError,
  SyncStatus,
  testSupabaseConnection,
} from '../utils/supabaseSync';

interface SupabaseSettingsModalProps {
  open: boolean;
  syncStatus: SyncStatus;
  realtimeStatus: RealtimeStatus;
  lastSyncError: SupabaseSyncError | null;
  onClose: () => void;
  onConfigApplied: () => void;
  onNotify: (msg: string, type?: 'default' | 'error') => void;
}

export const SupabaseSettingsModal: React.FC<SupabaseSettingsModalProps> = ({
  open,
  syncStatus,
  realtimeStatus,
  lastSyncError,
  onClose,
  onConfigApplied,
  onNotify,
}) => {
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [configSource, setConfigSource] = useState<'custom' | 'env' | 'default'>('default');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
    detail?: string;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    const cfg = getActiveSupabaseConfig();
    setUrl(cfg.url);
    setAnonKey(cfg.anonKey);
    setConfigSource(cfg.source);
    setTestResult(null);
    setShowKey(false);
  }, [open]);

  if (!open) return null;

  const handleTestAndConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = url.trim();
    const cleanKey = anonKey.trim();

    if (!cleanUrl || !cleanKey) {
      setTestResult({
        ok: false,
        message: 'Заполните оба поля: Project URL и Anon Key.',
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    const res = await testSupabaseConnection(cleanUrl, cleanKey);
    setTesting(false);

    if (res.ok) {
      saveCustomSupabaseConfig(cleanUrl, cleanKey);
      setConfigSource('custom');
      setTestResult({
        ok: true,
        message: `Соединение установлено (${res.latencyMs} мс)`,
        detail: res.rowExists
          ? 'Таблица studio_state доступна, данные синхронизируются.'
          : 'Таблица studio_state доступна, выполняется первичная запись состояния.',
      });
      onConfigApplied();
      onNotify(`Supabase подключён (${res.latencyMs} мс)`);
    } else {
      const codeTag = res.error?.code
        ? `[${res.error.code}]`
        : res.error?.status
        ? `[HTTP ${res.error.status}]`
        : '[ОШИБКА]';
      setTestResult({
        ok: false,
        message: `${codeTag} ${res.error?.humanHint || 'Не удалось подключиться'}`,
        detail: res.error?.message,
      });
    }
  };

  const handleResetToBuildDefaults = () => {
    clearCustomSupabaseConfig();
    const cfg = getActiveSupabaseConfig();
    setUrl(cfg.url);
    setAnonKey(cfg.anonKey);
    setConfigSource(cfg.source);
    setTestResult(null);
    onConfigApplied();
    onNotify('Восстановлены настройки подключения из сборки');
  };

  const statusLabel =
    syncStatus === 'online'
      ? 'Онлайн'
      : syncStatus === 'syncing'
      ? 'Синхронизация...'
      : syncStatus === 'connecting'
      ? 'Подключение...'
      : 'Офлайн (локальный режим)';

  const realtimeLabel =
    realtimeStatus === 'subscribed'
      ? 'Realtime активен'
      : realtimeStatus === 'connecting'
      ? 'Realtime подключается...'
      : realtimeStatus === 'error'
      ? 'Realtime недоступен (REST-синхронизация)'
      : 'Realtime не запущен';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="supabase-settings-title"
    >
      <div className="w-full max-w-lg border border-[#0A0A0A] bg-white p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[#0A0A0A] pb-4">
          <div>
            <h2
              id="supabase-settings-title"
              className="text-base font-semibold tracking-tight text-[#0A0A0A]"
            >
              Настройки подключения Supabase
            </h2>
            <p className="mt-1 text-xs text-[#525252]">
              Синхронизация состояния студии через таблицу <code className="font-mono text-[#0A0A0A]">public.studio_state</code>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center text-[#525252] transition-colors hover:bg-[#F4F4F4] hover:text-[#0A0A0A]"
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Live Diagnostic Status Strip */}
        <div className="mt-4 border border-[#D4D4D4] bg-[#F4F4F4] p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 font-semibold text-[#0A0A0A]">
              {syncStatus === 'online' || syncStatus === 'syncing' ? (
                <Wifi className="h-3.5 w-3.5 text-[#15803D]" />
              ) : (
                <WifiOff className="h-3.5 w-3.5 text-[#DC2626]" />
              )}
              <span>{statusLabel}</span>
            </div>
            <span className="font-mono text-[11px] text-[#525252]">
              {configSource === 'custom'
                ? 'Источник: браузер'
                : configSource === 'env'
                ? 'Источник: GitHub Secrets'
                : 'Источник: конфиг сборки'}
            </span>
          </div>

          <div className="mt-1.5 flex items-center justify-between text-[11px] text-[#525252]">
            <span>Канал обновлений: {realtimeLabel}</span>
          </div>

          {syncStatus === 'offline' && lastSyncError && (
            <div className="mt-3 border-t border-[#D4D4D4] pt-2.5 text-xs">
              <div className="font-semibold text-[#DC2626]">
                Причина:{' '}
                {lastSyncError.code
                  ? `[${lastSyncError.code}] `
                  : lastSyncError.status
                  ? `[HTTP ${lastSyncError.status}] `
                  : ''}
                {lastSyncError.humanHint}
              </div>
              <div className="mt-1 break-words font-mono text-[11px] text-[#525252]">
                {lastSyncError.message}
              </div>
            </div>
          )}
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleTestAndConnect} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="supabase-url-input"
              className="mb-1.5 block text-xs font-medium text-[#0A0A0A]"
            >
              Project URL
            </label>
            <input
              id="supabase-url-input"
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://xxxxxxxxxxxx.supabase.co"
              className="h-10 w-full border border-[#0A0A0A] bg-white px-3 font-mono text-xs text-[#0A0A0A] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="supabase-key-input"
              className="mb-1.5 block text-xs font-medium text-[#0A0A0A]"
            >
              Anon / Publishable Key
            </label>
            <div className="flex border border-[#0A0A0A] bg-white">
              <input
                id="supabase-key-input"
                type={showKey ? 'text' : 'password'}
                required
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                placeholder="sb_publishable_... или eyJhbGciOi..."
                className="h-10 flex-1 bg-transparent px-3 font-mono text-xs text-[#0A0A0A] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="flex h-10 w-10 items-center justify-center border-l border-[#D4D4D4] text-[#525252] hover:bg-[#F4F4F4] hover:text-[#0A0A0A]"
                title={showKey ? 'Скрыть ключ' : 'Показать ключ'}
                aria-label={showKey ? 'Скрыть ключ' : 'Показать ключ'}
              >
                {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-[#525252]">
              Используйте только публичный ключ (<code className="font-mono">anon / publishable</code>). Ключ сохраняется локально в вашем браузере.
            </p>
          </div>

          {testResult && (
            <div
              className={`border p-3 text-xs ${
                testResult.ok
                  ? 'border-[#15803D] bg-[#F0FDF4] text-[#15803D]'
                  : 'border-[#DC2626] bg-[#FEF2F2] text-[#DC2626]'
              }`}
            >
              <div className="flex items-start gap-2 font-semibold">
                {testResult.ok ? (
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                ) : (
                  <WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                )}
                <span>{testResult.message}</span>
              </div>
              {testResult.detail && (
                <div className="mt-1 break-words font-mono text-[11px] opacity-90">
                  {testResult.detail}
                </div>
              )}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#D4D4D4] pt-4">
            {configSource === 'custom' ? (
              <button
                type="button"
                onClick={handleResetToBuildDefaults}
                className="flex min-h-[38px] items-center gap-1.5 border border-[#D4D4D4] bg-white px-3 text-xs font-medium text-[#525252] hover:border-[#0A0A0A] hover:text-[#0A0A0A]"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Сбросить к сборке
              </button>
            ) : (
              <span className="text-[11px] text-[#525252]">
                Подробный лог ошибок — в Console (F12)
              </span>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[38px] border border-[#0A0A0A] bg-white px-4 text-xs font-medium text-[#0A0A0A] hover:bg-[#F4F4F4]"
              >
                Закрыть
              </button>
              <button
                type="submit"
                disabled={testing}
                className="flex min-h-[38px] items-center gap-1.5 bg-[#0A0A0A] px-4 text-xs font-semibold text-white hover:bg-[#262626] disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${testing ? 'animate-spin' : ''}`} />
                {testing ? 'Проверка...' : 'Проверить и подключить'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
