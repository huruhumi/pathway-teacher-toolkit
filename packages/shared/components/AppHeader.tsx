import React, { useState } from 'react';
import { Cloud, LogOut, User, Home } from 'lucide-react';
import { useAuthStore } from '../stores/useAuthStore';
import { isSupabaseEnabled } from '../services/supabaseClient';
import { AuthModal } from './auth/AuthModal';

export interface NavTab {
    key: string;
    label: string;
    icon: React.ReactNode;
    badge?: number;
}

export interface AppHeaderProps {
    /** App name displayed in the logo */
    appName: string;
    /** Optional subtitle below the app name */
    subtitle?: string;
    /** Logo icon (Lucide component rendered, e.g. <Brain />) */
    logoIcon: React.ReactNode;
    /** Brand color classes */
    brand: {
        logoBg: string;
        logoText?: string;
        activeBg: string;
        activeText: string;
        badgeBg?: string;
        badgeText?: string;
    };
    /** Navigation tabs */
    tabs: NavTab[];
    /** Currently active tab key */
    activeTab: string;
    /** Callback when tab is clicked */
    onTabChange: (key: string) => void;
    /** Optional callback when logo is clicked */
    onLogoClick?: () => void;
    /** Optional right-side content (e.g. dark mode toggle) */
    rightContent?: React.ReactNode;
    /** Label for the sign-in button (for i18n) */
    signInLabel?: string;
    /** URL for the Home button (back to landing page). If set, shows a Home icon. */
    homeUrl?: string;
    /** If true, hide the Sign In button (only show status when logged in) */
    hideSignIn?: boolean;
    /** Optional points balance to display next to the user profile */
    pointsBalance?: number;
    /** Optional callback when points balance is clicked */
    onPointsClick?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = React.memo(({
    appName,
    subtitle,
    logoIcon,
    brand,
    tabs,
    activeTab,
    onTabChange,
    onLogoClick,
    rightContent,
    signInLabel,
    homeUrl,
    hideSignIn,
    pointsBalance,
    onPointsClick,
}) => {
    const { user, signOut, session } = useAuthStore();
    const displayName = useAuthStore(s => s.displayName)();
    const cloudEnabled = isSupabaseEnabled();
    const [showAuthModal, setShowAuthModal] = useState(false);

    /** Build homeUrl with auth tokens appended for cross-port SSO */
    const getHomeHref = () => {
        if (!homeUrl) return '/';
        if (session?.access_token && session?.refresh_token) {
            const sep = homeUrl.includes('?') ? '&' : '?';
            return `${homeUrl}${sep}_token=${session.access_token}&_refresh=${session.refresh_token}`;
        }
        return homeUrl;
    };

    return (
        <header className="bg-white dark:bg-slate-950/80 dark:backdrop-blur-xl border-b border-slate-200 dark:border-white/5 sticky top-0 z-50 shadow-sm dark:shadow-none print:hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                {/* Left: Home + Logo */}
                <div className="flex items-center gap-2">
                    {homeUrl && (
                        <a
                            href={getHomeHref()}
                            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                            title="Home"
                        >
                            <Home size={18} />
                        </a>
                    )}
                    <div
                        className="flex items-center gap-2.5 cursor-pointer flex-shrink-0"
                        onClick={onLogoClick}
                    >
                        <div className={`w-8 h-8 ${brand.logoBg} rounded-xl flex items-center justify-center text-white shadow-sm flex-shrink-0`}>
                            {logoIcon}
                        </div>
                        <div className="flex flex-col justify-center">
                            <h1 className={`text-lg font-bold tracking-tight ${brand.logoText || 'text-slate-800 dark:text-slate-100'} truncate`}>
                                {appName}
                            </h1>
                            {subtitle && (
                                <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase hidden sm:block">
                                    {subtitle}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Center: Pill Tabs (desktop) */}
                <nav className="hidden md:flex items-center bg-slate-100 dark:bg-white/5 dark:ring-1 dark:ring-white/10 rounded-xl p-1 gap-0.5">
                    {tabs.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => onTabChange(tab.key)}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap
                ${activeTab === tab.key
                                    ? `bg-white dark:bg-white/10 ${brand.activeText} shadow-sm dark:shadow-none`
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                }`}
                        >
                            {tab.icon}
                            <span>{tab.label}</span>
                            {tab.badge != null && tab.badge > 0 && (
                                <span className={`ml-1 text-[10px] ${brand.badgeBg || 'bg-slate-200'} ${brand.badgeText || 'text-slate-600'} rounded-full px-1.5 py-0.5 font-bold`}>
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    ))}
                </nav>

                {/* Right: mobile tabs + optional content + auth */}
                <div className="flex items-center gap-2">
                    {/* Mobile nav (icons only) */}
                    <div className="flex md:hidden items-center gap-1">
                        {tabs.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => onTabChange(tab.key)}
                                className={`p-2 rounded-lg transition-all ${activeTab === tab.key
                                    ? `${brand.activeBg} ${brand.activeText}`
                                    : 'text-slate-400 hover:text-slate-600'
                                    }`}
                                title={tab.label}
                            >
                                {tab.icon}
                            </button>
                        ))}
                    </div>

                    {rightContent && (
                        <>
                            <div className="h-4 w-px bg-slate-200 dark:bg-slate-600 mx-1 hidden sm:block" />
                            {rightContent}
                        </>
                    )}

                    {cloudEnabled && (
                        <>
                            <div className="h-4 w-px bg-slate-200 dark:bg-slate-600 mx-1 hidden sm:block" />
                            {user ? (
                                <div className="flex items-center gap-2">
                                    {pointsBalance !== undefined && (
                                        <div
                                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-600 dark:text-amber-400 font-bold text-sm shadow-sm transition-all hover:scale-105 ${onPointsClick ? 'cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-500/20' : 'cursor-default'}`}
                                            title="Your Points Balance"
                                            onClick={onPointsClick}
                                        >
                                            <span>🪙</span>
                                            <span>{pointsBalance}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-pathway-navy)] dark:text-sky-300 bg-[var(--color-pathway-sky)]/15 dark:bg-sky-500/10 px-2.5 py-1.5 rounded-xl border border-[var(--color-pathway-sky)]/30 dark:border-sky-500/20">
                                        <Cloud size={14} />
                                        <span className="hidden sm:inline max-w-[120px] truncate">{displayName}</span>
                                    </div>
                                    <button
                                        onClick={signOut}
                                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors"
                                        title="Sign Out"
                                    >
                                        <LogOut size={16} />
                                    </button>
                                </div>
                            ) : !hideSignIn ? (
                                <button
                                    onClick={() => setShowAuthModal(true)}
                                    className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-[var(--color-pathway-navy)] dark:hover:text-sky-300 px-3 py-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/10 transition-all border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5"
                                >
                                    <User size={16} />
                                    <span className="hidden sm:inline">{signInLabel || 'Sign In'}</span>
                                </button>
                            ) : null}
                            {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
                        </>
                    )}
                </div>
            </div>
        </header>
    );
});
