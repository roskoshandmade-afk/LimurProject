import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import { AppData } from '../types';

export type SyncStatus = 'connecting' | 'online' | 'syncing' | 'offline';

const DEFAULT_SUPABASE_URL = 'https://iufvrdvwrcwyfokdvpeb.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_7lVcUR1YgUpediExSLBa1w_beRAcd4f';

const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) || DEFAULT_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || DEFAULT_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

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
  const channel: RealtimeChannel = supabase
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
        const nextRow = payload.new as { id?: string; payload?: unknown } | undefined;
        if (!nextRow || !nextRow.payload) return;
        const normalized = normalizePayload(nextRow.payload);
        if (normalized) {
          onRemoteData(normalized);
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

  return () => {
    void supabase.removeChannel(channel);
  };
}
