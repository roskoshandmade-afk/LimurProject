import { createClient, SupabaseClient } from '@supabase/supabase-js';

declare const __LIMUR_SUPABASE_URL__: string | undefined;
declare const __LIMUR_SUPABASE_ANON_KEY__: string | undefined;

const FALLBACK_SUPABASE_URL = 'https://iufvrdvwrcwyfokdvpeb.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'sb_publishable_7lVcUR1YgUpediExSLBa1w_beRAcd4f';

export const SUPABASE_CONFIG_STORAGE_KEY = 'limur_supabase_config_v1';

export type SupabaseConfigSource = 'custom' | 'env' | 'default';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  source: SupabaseConfigSource;
}

function readNonEmpty(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readCustomConfigFromStorage(): { url: string; anonKey: string } | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(SUPABASE_CONFIG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { url?: unknown; anonKey?: unknown };
    const url = readNonEmpty(parsed.url);
    const anonKey = readNonEmpty(parsed.anonKey);
    if (!url || !anonKey) return null;
    return { url, anonKey };
  } catch {
    return null;
  }
}

export function getBuildSupabaseConfig(): { url: string; anonKey: string; source: 'env' | 'default' } {
  const envUrl =
    readNonEmpty(import.meta.env.VITE_SUPABASE_URL) ||
    readNonEmpty(typeof __LIMUR_SUPABASE_URL__ !== 'undefined' ? __LIMUR_SUPABASE_URL__ : '');
  const envKey =
    readNonEmpty(import.meta.env.VITE_SUPABASE_ANON_KEY) ||
    readNonEmpty(typeof __LIMUR_SUPABASE_ANON_KEY__ !== 'undefined' ? __LIMUR_SUPABASE_ANON_KEY__ : '');

  if (envUrl && envKey) {
    const isDefault =
      envUrl === FALLBACK_SUPABASE_URL && envKey === FALLBACK_SUPABASE_ANON_KEY;
    return {
      url: envUrl,
      anonKey: envKey,
      source: isDefault ? 'default' : 'env',
    };
  }

  return {
    url: envUrl || FALLBACK_SUPABASE_URL,
    anonKey: envKey || FALLBACK_SUPABASE_ANON_KEY,
    source: 'default',
  };
}

export function getActiveSupabaseConfig(): SupabaseConfig {
  const custom = readCustomConfigFromStorage();
  if (custom) {
    return {
      url: custom.url,
      anonKey: custom.anonKey,
      source: 'custom',
    };
  }
  return getBuildSupabaseConfig();
}

export function normalizeSupabaseUrl(rawUrl: string): string {
  return rawUrl.trim().replace(/\/+$/, '');
}

export function createSupabaseClientForConfig(
  url: string,
  anonKey: string
): SupabaseClient | null {
  try {
    const cleanUrl = normalizeSupabaseUrl(url);
    const cleanKey = anonKey.trim();

    if (!cleanUrl || !cleanKey) {
      console.error('[LIMUR STUDIO OS][Supabase] Missing Project URL or Anon Key.', {
        hasUrl: Boolean(cleanUrl),
        hasAnonKey: Boolean(cleanKey),
      });
      return null;
    }

    const parsed = new URL(cleanUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error(`Unsupported URL protocol: ${parsed.protocol}`);
    }

    return createClient(cleanUrl, cleanKey, {
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
    console.error(
      '[LIMUR STUDIO OS][Supabase] Failed to initialize client, falling back to localStorage:',
      err
    );
    return null;
  }
}

export let supabase: SupabaseClient | null = null;

export function reinitializeSupabaseClient(): SupabaseClient | null {
  const config = getActiveSupabaseConfig();
  supabase = createSupabaseClientForConfig(config.url, config.anonKey);
  return supabase;
}

export function getSupabaseClient(): SupabaseClient | null {
  return supabase;
}

export function saveCustomSupabaseConfig(url: string, anonKey: string): SupabaseClient | null {
  const cleanUrl = normalizeSupabaseUrl(url);
  const cleanKey = anonKey.trim();
  try {
    window.localStorage.setItem(
      SUPABASE_CONFIG_STORAGE_KEY,
      JSON.stringify({ url: cleanUrl, anonKey: cleanKey })
    );
  } catch (err) {
    console.error('[LIMUR STUDIO OS][Supabase] Failed to persist custom config in localStorage:', err);
  }
  return reinitializeSupabaseClient();
}

export function clearCustomSupabaseConfig(): SupabaseClient | null {
  try {
    window.localStorage.removeItem(SUPABASE_CONFIG_STORAGE_KEY);
  } catch {
    // Ignore storage removal errors
  }
  return reinitializeSupabaseClient();
}

// Initial safe creation at module load
reinitializeSupabaseClient();

export const SUPABASE_URL = getActiveSupabaseConfig().url;
export const SUPABASE_ANON_KEY = getActiveSupabaseConfig().anonKey;
