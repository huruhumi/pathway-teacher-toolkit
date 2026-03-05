import { create } from 'zustand';
import { supabase, isSupabaseEnabled } from '../services/supabaseClient';
import type { User, Session } from '@supabase/supabase-js';

interface AuthStore {
    user: User | null;
    session: Session | null;
    isInitialized: boolean;
    isAuthLoading: boolean;

    signIn: (email: string, password: string) => Promise<{ error?: string }>;
    signUp: (email: string, password: string) => Promise<{ error?: string; needsConfirmation?: boolean }>;
    signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => {
    // ── Auto-initialize: restore session + listen for changes ──
    if (isSupabaseEnabled() && supabase) {
        // Restore persisted session on load
        supabase.auth.getSession().then(({ data: { session } }) => {
            set({ user: session?.user ?? null, session, isInitialized: true });
        }).catch(() => {
            set({ isInitialized: true });
        });

        // Listen for auth state changes (token refresh, sign-out from another tab, etc.)
        supabase.auth.onAuthStateChange((_event, session) => {
            set({ user: session?.user ?? null, session });
        });
    } else {
        // No Supabase — mark as initialized immediately
        setTimeout(() => set({ isInitialized: true }), 0);
    }

    return {
        user: null,
        session: null,
        isInitialized: false,
        isAuthLoading: false,

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

            // If session is returned, user is auto-confirmed (no email verification needed)
            if (data.session) {
                set({ user: data.user, session: data.session });
                return {};
            }
            // No session = email confirmation required
            return { needsConfirmation: true };
        },

        signOut: async () => {
            if (!supabase) return;
            await supabase.auth.signOut();
            set({ user: null, session: null });
        },
    };
});

