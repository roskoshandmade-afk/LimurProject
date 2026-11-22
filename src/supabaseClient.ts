import { createClient, SupabaseClient } from '@supabase/supabase-js';

const FALLBACK_SUPABASE_URL = 'https://iufvrdvwrcwyfokdvpeb.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'sb_publishable_7lVcUR1YgUpediExSLBa1w_beRAcd4f';

function readEnv(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  return fallback;
}

export const SUPABASE_URL = readEnv(
  import.meta.env.VITE_SUPABASE_URL,
  FALLBACK_SUPABASE_URL
);

export const SUPABASE_ANON_KEY = readEnv(
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  FALLBACK_SUPABASE_ANON_KEY
);

function createSafeSupabaseClient(): SupabaseClient | null {
  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return null;
    }
    // Verify URL syntax before initializing client
    new URL(SUPABASE_URL);

    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  } catch (err) {
    console.warn('[LIMUR STUDIO OS] Supabase unavailable, falling back to localStorage:', err);
    return null;
  }
}

export const supabase: SupabaseClient | null = createSafeSupabaseClient();
