import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';
import { AppData } from '../types';

export type SyncStatus = 'connecting' | 'online' | 'syncing' | 'offline';

export { supabase };

const TABLE_NAME = 'studio_state';
const ROW_ID = 'main';

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
      defaultFotLimitPercent: 40,
      studioName: 'LIMUR STUDIO OS',
    },
    team: candidate.team,
    projects: candidate.projects,
    worklogs: Array.isArray(candidate.worklogs) ? candidate.worklogs : [],
    expenses: Array.isArray(candidate.expenses) ? candidate.expenses : [],
  };
}

export async function fetchStudioState(): Promise<{
  ok: boolean;
  data: AppData | null;
  error?: string;
}> {
  if (!supabase) {
    return { ok: false, data: null, error: 'Supabase client unavailable' };
  }

  try {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('id, payload')
      .eq('id', ROW_ID)
      .maybeSingle();

    if (error) {
      return { ok: false, data: null, error: error.message };
    }

    if (!data || !data.payload) {
      return { ok: true, data: null };
    }

    return { ok: true, data: normalizePayload(data.payload) };
  } catch (err) {
    return {
      ok: false,
      data: null,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}

export async function saveStudioStateRemote(data: AppData): Promise<{
  ok: boolean;
  error?: string;
}> {
  if (!supabase) {
    return { ok: false, error: 'Supabase client unavailable' };
  }

  try {
    const { error } = await supabase
      .from(TABLE_NAME)
      .upsert(
        {
          id: ROW_ID,
          payload: data,
        },
        { onConflict: 'id' }
      );

    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}

export function subscribeStudioState(
  onRemoteData: (data: AppData) => void,
  onChannelStatus?: (connected: boolean) => void
): () => void {
  if (!supabase) {
    onChannelStatus?.(false);
    return () => {};
  }

  let channel: RealtimeChannel | null = null;

  try {
    channel = supabase
      .channel('supabase_realtime:studio_state:main')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: TABLE_NAME,
          filter: `id=eq.${ROW_ID}`,
        },
        (payload) => {
          try {
            const nextRow = payload.new as { id?: string; payload?: unknown } | undefined;
            if (!nextRow || !nextRow.payload) return;
            const normalized = normalizePayload(nextRow.payload);
            if (normalized) {
              onRemoteData(normalized);
            }
          } catch (err) {
            console.warn('[LIMUR STUDIO OS] Ignored malformed realtime payload:', err);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          onChannelStatus?.(true);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          onChannelStatus?.(false);
        }
      });
  } catch (err) {
    console.warn('[LIMUR STUDIO OS] Realtime subscription unavailable, continuing locally:', err);
    onChannelStatus?.(false);
    return () => {};
  }

  return () => {
    try {
      if (supabase && channel) {
        void supabase.removeChannel(channel);
      }
    } catch {
      // Safe cleanup ignore
    }
  };
}
