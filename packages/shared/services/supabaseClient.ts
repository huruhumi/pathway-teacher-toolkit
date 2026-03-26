import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const isBrowser = typeof window !== 'undefined' && typeof localStorage !== 'undefined';

function isSupabaseAuthTokenKey(key: string): boolean {
    return key.startsWith('sb-') && key.endsWith('-auth-token');
}

function safeParseJson(value: string): boolean {
    try {
        JSON.parse(value);
        return true;
    } catch {
        return false;
    }
}

/** Remove malformed persisted Supabase auth cache that can crash login with JSON parse errors. */
export function scrubInvalidSupabaseAuthCache(): void {
    if (!isBrowser) return;
    try {
        const keys = Object.keys(localStorage);
        for (const key of keys) {
            if (!isSupabaseAuthTokenKey(key)) continue;
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            if (!safeParseJson(raw)) {
                localStorage.removeItem(key);
            }
        }
    } catch {
        // Ignore storage access failures (private mode / quota / policy)
    }
}

const safeAuthStorage = {
    getItem: (key: string): string | null => {
        if (!isBrowser) return null;
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        if (isSupabaseAuthTokenKey(key) && !safeParseJson(raw)) {
            localStorage.removeItem(key);
            return null;
        }
        return raw;
    },
    setItem: (key: string, value: string): void => {
        if (!isBrowser) return;
        localStorage.setItem(key, value);
    },
    removeItem: (key: string): void => {
        if (!isBrowser) return;
        localStorage.removeItem(key);
    },
};

scrubInvalidSupabaseAuthCache();

// In dev mode, route through Vite's proxy to bypass browser network restrictions
const effectiveUrl = import.meta.env.DEV && supabaseUrl
    ? `${window.location.origin}/supabase-proxy`
    : supabaseUrl;

export const supabase = supabaseUrl && supabaseAnonKey
    ? createClient(effectiveUrl, supabaseAnonKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storage: safeAuthStorage as any,
        },
    })
    : null;

// Check if Supabase is configured
export const isSupabaseEnabled = () => !!supabase;
