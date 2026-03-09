import React, { useEffect } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { isSupabaseEnabled } from '../../services/supabaseClient';
import { Loader2 } from 'lucide-react';

interface RouteGuardProps {
    children: React.ReactNode;
    requireAuth?: boolean;
    /** The URL to redirect to if auth is required but user is not logged in */
    redirectTo?: string;
}

export const RouteGuard: React.FC<RouteGuardProps> = ({
    children,
    requireAuth = true,
    redirectTo = import.meta.env.VITE_PORTAL_URL || '/'
}) => {
    const { isInitialized, user } = useAuthStore();

    // If Supabase is not configured, skip auth entirely — render children immediately
    const authEnabled = isSupabaseEnabled();
    // In dev mode, never enforce auth redirects — avoids infinite redirect loops
    // when session is expired or Supabase is unreachable from localhost
    const shouldEnforceAuth = requireAuth && authEnabled && !import.meta.env.DEV;

    useEffect(() => {
        if (isInitialized && shouldEnforceAuth && !user) {
            // Prevent infinite redirect loop if we are already on the portal URL
            try {
                const target = new URL(redirectTo, window.location.origin);
                const isPortal = window.location.origin === target.origin
                    && window.location.pathname === target.pathname;

                if (!isPortal) {
                    window.location.href = redirectTo;
                }
            } catch {
                // If URL parsing fails, just redirect
                window.location.href = redirectTo;
            }
        }
    }, [isInitialized, user, shouldEnforceAuth, redirectTo]);

    // If auth is not enabled, render children immediately
    if (!authEnabled) {
        return <>{children}</>;
    }

    // Show nothing (or a global loader) while auth state is initializing
    if (!isInitialized) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
                <Loader2 size={32} className="animate-spin text-indigo-500" />
            </div>
        );
    }

    // If requireAuth is true and there is no user, return null to avoid flashing secure content before redirect happens.
    if (shouldEnforceAuth && !user) {
        return null;
    }

    // Otherwise render children
    return <>{children}</>;
};
