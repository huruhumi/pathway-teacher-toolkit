import { create } from 'zustand';
import { supabase, isSupabaseEnabled, scrubInvalidSupabaseAuthCache } from '../services/supabaseClient';
import type { User, Session } from '@supabase/supabase-js';

interface AuthStore {
    user: User | null;
    session: Session | null;
    isInitialized: boolean;
    isAuthLoading: boolean;

    /** Get display name from user_metadata, fallback to email */
    displayName: () => string;
    signIn: (email: string, password: string) => Promise<{ error?: string }>;
    signUp: (email: string, password: string, username?: string) => Promise<{ error?: string; needsConfirmation?: boolean }>;
    signOut: () => Promise<void>;
    updateDisplayName: (name: string) => Promise<{ error?: string }>;
}

const isJsonParseAuthError = (message?: string): boolean => {
    const msg = (message || '').toLowerCase();
    return msg.includes('unexpected end of json input') || msg.includes('json');
};

/** Check URL for cross-port auth tokens (landing page SSO) */
function consumeUrlTokens(): { access_token: string; refresh_token: string } | null {
    try {
        const params = new URLSearchParams(window.location.search);
        const access = params.get('_token');
        const refresh = params.get('_refresh');
        if (access && refresh) {
            // Clean URL
            params.delete('_token');
            params.delete('_refresh');
            const clean = params.toString();
            const newUrl = window.location.pathname + (clean ? '?' + clean : '') + window.location.hash;
            window.history.replaceState(null, '', newUrl);
            return { access_token: access, refresh_token: refresh };
        }
    } catch { /* ignore */ }
    return null;
}

export const useAuthStore = create<AuthStore>((set, get) => {
    // ── Auto-initialize: restore session + listen for changes ──
    if (isSupabaseEnabled() && supabase) {
        const urlTokens = consumeUrlTokens();

        if (urlTokens) {
            // Cross-port SSO: restore session from URL tokens
            supabase.auth.setSession(urlTokens).then(({ data: { session }, error }) => {
                if (error) {
                    console.warn('[Auth] Failed to restore session from URL tokens:', error.message);
                }
                set({ user: session?.user ?? null, session: session ?? null, isInitialized: true });
            });
        } else {
            // Normal: restore persisted session
            supabase.auth.getSession().then(({ data: { session } }) => {
                set({ user: session?.user ?? null, session, isInitialized: true });
            }).catch(() => {
                set({ isInitialized: true });
            });
        }

        // Listen for auth state changes
        supabase.auth.onAuthStateChange((_event, session) => {
            set({ user: session?.user ?? null, session });
        });

        // Cross-port logout sync: verify session with server when tab becomes visible
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && supabase) {
                supabase.auth.getUser().then(({ data: { user: serverUser }, error }) => {
                    const current = useAuthStore.getState().user;
                    if (current && (error || !serverUser)) {
                        // Session was revoked server-side (e.g. signed out from another port)
                        supabase!.auth.signOut({ scope: 'local' });
                        set({ user: null, session: null });
                    }
                });
            }
        });
    } else {
        setTimeout(() => set({ isInitialized: true }), 0);
    }

    return {
        user: null,
        session: null,
        isInitialized: false,
        isAuthLoading: false,

        displayName: () => {
            const user = get().user;
            if (!user) return '';
            return user.user_metadata?.display_name || user.email?.split('@')[0] || '';
        },

        signIn: async (email: string, password: string) => {
            if (!supabase) return { error: 'Supabase not configured' };
            set({ isAuthLoading: true });
            try {
                let result = await supabase.auth.signInWithPassword({ email, password });
                if (result.error && isJsonParseAuthError(result.error.message)) {
                    // Local cached auth token may be malformed; scrub and retry once.
                    scrubInvalidSupabaseAuthCache();
                    result = await supabase.auth.signInWithPassword({ email, password });
                }
                if (result.error) return { error: result.error.message };
                set({ user: result.data.user, session: result.data.session });
                return {};
            } catch (err: any) {
                const msg = err?.message || String(err);
                if (isJsonParseAuthError(msg)) {
                    scrubInvalidSupabaseAuthCache();
                    return { error: 'Local auth cache was corrupted. It has been reset, please try signing in again.' };
                }
                return { error: msg };
            } finally {
                set({ isAuthLoading: false });
            }
        },

        signUp: async (email: string, password: string, username?: string) => {
            if (!supabase) return { error: 'Supabase not configured' };
            set({ isAuthLoading: true });
            const options: any = { email, password };
            if (username) {
                options.options = { data: { display_name: username } };
            }
            const { data, error } = await supabase.auth.signUp(options);
            set({ isAuthLoading: false });
            if (error) return { error: error.message };

            if (data.session) {
                set({ user: data.user, session: data.session });
                return {};
            }
            return { needsConfirmation: true };
        },

        signOut: async () => {
            if (!supabase) return;
            await supabase.auth.signOut();
            set({ user: null, session: null });
        },

        updateDisplayName: async (name: string) => {
            if (!supabase) return { error: 'Supabase not configured' };
            const { data, error } = await supabase.auth.updateUser({
                data: { display_name: name },
            });
            if (error) return { error: error.message };
            set({ user: data.user });
            return {};
        },
    };
});
