import { create } from 'zustand';
import { supabase, isSupabaseEnabled } from '../services/supabaseClient';
import type { User, Session } from '@supabase/supabase-js';

interface AuthStore {
    user: User | null;
    session: Session | null;
    isInitialized: boolean;
    isAuthLoading: boolean;

    initialize: () => Promise<void>;
    signIn: (email: string, password: string) => Promise<{ error?: string }>;
    signUp: (email: string, password: string) => Promise<{ error?: string }>;
    signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
    user: null,
    session: null,
    isInitialized: false,
    isAuthLoading: false,

    initialize: async () => {
        if (!isSupabaseEnabled() || !supabase) {
            set({ isInitialized: true });
            return;
        }
        try {
            const { data: { session } } = await supabase.auth.getSession();
            set({ user: session?.user ?? null, session, isInitialized: true });

            // Listen for auth changes
            supabase.auth.onAuthStateChange((_event, session) => {
                set({ user: session?.user ?? null, session });
            });
        } catch {
            set({ isInitialized: true });
        }
    },

    signIn: async (email: string, password: string) => {
        if (!supabase) return { error: 'Supabase not configured' };
        set({ isAuthLoading: true });
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        set({ isAuthLoading: false });
        if (error) return { error: error.message };
        set({ user: data.user, session: data.session });
        return {};
    },

    signUp: async (email: string, password: string) => {
        if (!supabase) return { error: 'Supabase not configured' };
        set({ isAuthLoading: true });
        const { data, error } = await supabase.auth.signUp({ email, password });
        set({ isAuthLoading: false });
        if (error) return { error: error.message };
        set({ user: data.user, session: data.session });
        return {};
    },

    signOut: async () => {
        if (!supabase) return;
        await supabase.auth.signOut();
        set({ user: null, session: null });
    },
}));
