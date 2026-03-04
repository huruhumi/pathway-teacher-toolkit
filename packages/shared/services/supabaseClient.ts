import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// In dev mode, route through Vite's proxy to bypass browser network restrictions
const effectiveUrl = import.meta.env.DEV && supabaseUrl
    ? `${window.location.origin}/supabase-proxy`
    : supabaseUrl;

export const supabase = supabaseUrl && supabaseAnonKey
    ? createClient(effectiveUrl, supabaseAnonKey)
    : null;

// Check if Supabase is configured
export const isSupabaseEnabled = () => !!supabase;
