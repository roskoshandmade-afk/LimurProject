import { PostgrestError, RealtimeChannel } from '@supabase/supabase-js';
import {
  createSupabaseClientForConfig,
  getActiveSupabaseConfig,
  getSupabaseClient,
  supabase,
} from '../supabaseClient';
import { AppData } from '../types';

export type SyncStatus = 'connecting' | 'online' | 'syncing' | 'offline';
export type RealtimeStatus = 'idle' | 'connecting' | 'subscribed' | 'error';

export interface SupabaseSyncError {
  code?: string;
  status?: number;
  message: string;
  details?: string;
  hint?: string;
  humanHint: string;
}

export { supabase };

const TABLE_NAME = 'studio_state';
const ROW_ID = 'main';

export function formatSupabaseError(
  err: PostgrestError | Error | unknown,
  httpStatus?: number
): SupabaseSyncError {
  const pgErr = err as Partial<PostgrestError> & { status?: number; statusCode?: number };
  const code = typeof pgErr?.code === 'string' ? pgErr.code : undefined;
  const status =
    typeof httpStatus === 'number'
      ? httpStatus
      : typeof pgErr?.status === 'number'
      ? pgErr.status
      : typeof pgErr?.statusCode === 'number'
      ? pgErr.statusCode
      : undefined;
  const message =
    typeof pgErr?.message === 'string' && pgErr.message
      ? pgErr.message
      : err instanceof Error
      ? err.message
      : 'Неизвестная ошибка сети или Supabase';
  const details = typeof pgErr?.details === 'string' ? pgErr.details : undefined;
  const hint = typeof pgErr?.hint === 'string' ? pgErr.hint : undefined;

  const lower = `${code || ''} ${message} ${details || ''}`.toLowerCase();

  let humanHint = 'Проверьте Project URL, Anon Key и политики доступа в Supabase.';

  if (
    code === '42P01' ||
    code === 'PGRST205' ||
    lower.includes('could not find the table') ||
    lower.includes('relation') && lower.includes('does not exist')
  ) {
    humanHint =
      'Таблица public.studio_state не найдена в базе. Выполните SQL-скрипт в Supabase SQL Editor.';
  } else if (
    code === '42501' ||
    status === 401 ||
    status === 403 ||
    lower.includes('row-level security') ||
    lower.includes('permission denied')
  ) {
    humanHint =
      'Запрос заблокирован политиками RLS или правами доступа (401/403). Выполните блок GRANT и CREATE POLICY в SQL Editor.';
  } else if (
    lower.includes('invalid api key') ||
    lower.includes('apikey') ||
    lower.includes('jwt')
  ) {
    humanHint =
      'Неверный Anon / Publishable Key. Скопируйте актуальный ключ из Supabase → Project Settings → API.';
  } else if (
    lower.includes('failed to fetch') ||
    lower.includes('network') ||
    lower.includes('offline') ||
    lower.includes('timeout') ||
    lower.includes('load failed') ||
    lower.includes('cors')
  ) {
    humanHint =
      'Нет ответа от сервера Supabase (офлайн или таймаут). Все правки надёжно сохранены локально и отправятся при восстановлении связи.';
  }

  return {
    code,
    status,
    message,
    details,
    hint,
    humanHint,
  };
}

/**
 * Returns true if the error is likely transient (unstable network, timeout, offline, 5xx)
 * and safe for automatic retry after 3 seconds. Returns false for permanent config/RLS errors.
 */
export function isTransientSyncError(error?: SupabaseSyncError): boolean {
  if (!error) return true;
  if (error.status === 401 || error.status === 403 || error.status === 404) {
    return false;
  }
  if (error.code === '42P01' || error.code === 'PGRST205' || error.code === '42501') {
    return false;
  }
  const lower = `${error.code || ''} ${error.message || ''}`.toLowerCase();
  if (
    lower.includes('invalid api key') ||
    lower.includes('jwt') ||
    lower.includes('row-level security') ||
    lower.includes('permission denied') ||
    lower.includes('does not exist')
  ) {
    return false;
  }
  return true;
}

function logSupabaseError(operation: string, formatted: SupabaseSyncError, rawError: unknown) {
  const cfg = getActiveSupabaseConfig();
  console.error(`[LIMUR PROJECT][Supabase][${operation}] Request failed`, {
    url: cfg.url,
    configSource: cfg.source,
    code: formatted.code || 'NONE',
    status: formatted.status ?? 'N/A',
    message: formatted.message,
    details: formatted.details || null,
    hint: formatted.hint || null,
    diagnosis: formatted.humanHint,
    rawError,
  });
}

function normalizePayload(raw: unknown): AppData | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Partial<AppData>;

  // Treat empty object {} or missing core arrays as uninitialized payload
  if (!Array.isArray(candidate.projects) || !Array.isArray(candidate.team)) {
    return null;
  }

  return {
    version: typeof candidate.version === 'number' ? candidate.version : 1,
    settings: candidate.settings || {
      defaultFotLimitPercent: 45,
      studioName: 'LIMUR PROJECT',
    },
    team: candidate.team,
    projects: candidate.projects,
    worklogs: Array.isArray(candidate.worklogs) ? candidate.worklogs : [],
    expenses: Array.isArray(candidate.expenses) ? candidate.expenses : [],
    commercialProposals: Array.isArray(candidate.commercialProposals)
      ? candidate.commercialProposals
      : [],
  };
}

const REQUEST_TIMEOUT_MS = 12000;

function withTimeout<T>(promise: PromiseLike<T>, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error('Превышено время ожидания ответа от Supabase (timeout)'));
    }, timeoutMs);

    Promise.resolve(promise)
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        window.clearTimeout(timer);
        reject(err);
      });
  });
}

export async function fetchStudioState(): Promise<{
  ok: boolean;
  data: AppData | null;
  error?: SupabaseSyncError;
}> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const formatted = formatSupabaseError(new Error('Network offline (navigator.onLine === false)'));
    return { ok: false, data: null, error: formatted };
  }

  const client = getSupabaseClient();
  if (!client) {
    const formatted = formatSupabaseError(
      new Error('Supabase client is not initialized (invalid or missing URL / Anon Key)')
    );
    logSupabaseError('fetchStudioState', formatted, null);
    return { ok: false, data: null, error: formatted };
  }

  try {
    const { data, error, status } = await withTimeout(
      client
        .from(TABLE_NAME)
        .select('id, payload')
        .eq('id', ROW_ID)
        .maybeSingle()
    );

    if (error) {
      const formatted = formatSupabaseError(error, status);
      logSupabaseError('fetchStudioState', formatted, error);
      return { ok: false, data: null, error: formatted };
    }

    if (!data || !data.payload) {
      return { ok: true, data: null };
    }

    return { ok: true, data: normalizePayload(data.payload) };
  } catch (err) {
    const formatted = formatSupabaseError(err);
    logSupabaseError('fetchStudioState', formatted, err);
    return {
      ok: false,
      data: null,
      error: formatted,
    };
  }
}

export async function saveStudioStateRemote(data: AppData): Promise<{
  ok: boolean;
  error?: SupabaseSyncError;
}> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const formatted = formatSupabaseError(new Error('Network offline (navigator.onLine === false)'));
    return { ok: false, error: formatted };
  }

  const client = getSupabaseClient();
  if (!client) {
    const formatted = formatSupabaseError(
      new Error('Supabase client is not initialized (invalid or missing URL / Anon Key)')
    );
    logSupabaseError('saveStudioStateRemote', formatted, null);
    return { ok: false, error: formatted };
  }

  try {
    const { error, status } = await withTimeout(
      client
        .from(TABLE_NAME)
        .upsert(
          {
            id: ROW_ID,
            payload: data,
          },
          { onConflict: 'id' }
        )
    );

    if (error) {
      const formatted = formatSupabaseError(error, status);
      logSupabaseError('saveStudioStateRemote', formatted, error);
      return { ok: false, error: formatted };
    }
    return { ok: true };
  } catch (err) {
    const formatted = formatSupabaseError(err);
    logSupabaseError('saveStudioStateRemote', formatted, err);
    return {
      ok: false,
      error: formatted,
    };
  }
}

export async function testSupabaseConnection(
  url: string,
  anonKey: string
): Promise<{
  ok: boolean;
  latencyMs: number;
  rowExists?: boolean;
  error?: SupabaseSyncError;
}> {
  const startedAt = performance.now();
  const testClient = createSupabaseClientForConfig(url, anonKey);
  if (!testClient) {
    const formatted = formatSupabaseError(
      new Error('Некорректный формат Project URL (ожидается https://....supabase.co) или пустой Anon Key')
    );
    return {
      ok: false,
      latencyMs: Math.round(performance.now() - startedAt),
      error: formatted,
    };
  }

  try {
    const { data, error, status } = await testClient
      .from(TABLE_NAME)
      .select('id')
      .eq('id', ROW_ID)
      .maybeSingle();

    const latencyMs = Math.round(performance.now() - startedAt);

    if (error) {
      const formatted = formatSupabaseError(error, status);
      console.error('[LIMUR PROJECT][Supabase][testConnection] Failed:', {
        url,
        code: formatted.code || 'NONE',
        status: formatted.status ?? 'N/A',
        message: formatted.message,
        details: formatted.details || null,
        hint: formatted.hint || null,
        rawError: error,
      });
      return { ok: false, latencyMs, error: formatted };
    }

    return {
      ok: true,
      latencyMs,
      rowExists: Boolean(data),
    };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - startedAt);
    const formatted = formatSupabaseError(err);
    console.error('[LIMUR PROJECT][Supabase][testConnection] Network exception:', {
      url,
      message: formatted.message,
      rawError: err,
    });
    return { ok: false, latencyMs, error: formatted };
  }
}

export function subscribeStudioState(
  onRemoteData: (data: AppData) => void,
  onRealtimeStatus?: (status: RealtimeStatus, err?: unknown) => void
): () => void {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    onRealtimeStatus?.('idle');
    return () => {};
  }

  const client = getSupabaseClient();
  if (!client) {
    onRealtimeStatus?.('error');
    return () => {};
  }

  let channel: RealtimeChannel | null = null;
  let cleanedUp = false;
  onRealtimeStatus?.('connecting');

  const cleanupChannel = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    try {
      if (channel) {
        const ch = channel;
        channel = null;
        void client.removeChannel(ch);
      }
    } catch {
      // Safe cleanup ignore
    }
  };

  try {
    channel = client
      .channel(`studio-state-sync-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: TABLE_NAME,
          filter: `id=eq.${ROW_ID}`,
        },
        (payload) => {
          if (cleanedUp) return;
          try {
            const nextRow = payload.new as { id?: string; payload?: unknown } | undefined;
            if (!nextRow || !nextRow.payload) return;
            const normalized = normalizePayload(nextRow.payload);
            if (normalized) {
              onRemoteData(normalized);
            }
          } catch (err) {
            console.warn('[LIMUR PROJECT][Supabase][Realtime] Malformed payload ignored:', err);
          }
        }
      )
      .subscribe((status, err) => {
        if (cleanedUp) return;
        if (status === 'SUBSCRIBED') {
          onRealtimeStatus?.('subscribed');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          // Graceful fallback to REST synchronization without noisy console errors
          console.warn(
            '[LIMUR PROJECT][Supabase][Realtime] Channel unavailable — falling back to REST sync:',
            status
          );
          onRealtimeStatus?.('error', err);
          cleanupChannel();
        } else if (status === 'CLOSED') {
          onRealtimeStatus?.('idle');
        }
      });
  } catch (err) {
    console.warn('[LIMUR PROJECT][Supabase][Realtime] Unavailable — falling back to REST sync:', err);
    onRealtimeStatus?.('error', err);
    return () => {};
  }

  return cleanupChannel;
}
