import React, { useState, useEffect, useCallback } from 'react';

// Inline SVG icons to avoid lucide-react dependency in shared package
const Globe = ({ size = 16 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" />
    </svg>
);
const Moon = ({ size = 16 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
);
const Sun = ({ size = 16 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />
    </svg>
);

const LANG_KEY = 'pathway_uiLang';
const DARK_KEY = 'pathway_darkMode';

function getStoredLang(): 'en' | 'zh' {
    try {
        const v = localStorage.getItem(LANG_KEY);
        if (v === 'zh') return 'zh';
    } catch { }
    return 'en';
}

function getStoredDark(): boolean {
    try {
        const v = localStorage.getItem(DARK_KEY);
        return v === 'true';
    } catch { }
    return false;
}

interface HeaderTogglesProps {
    /** External lang state — if your app already has LanguageContext, pass its values here */
    lang?: 'en' | 'zh';
    onLangChange?: (lang: 'en' | 'zh') => void;
    /** External dark mode state — if your app already manages dark mode, pass its values here */
    isDark?: boolean;
    onDarkChange?: (dark: boolean) => void;
    /** Hide dark mode toggle (e.g. if the app doesn't support it yet) */
    hideDarkMode?: boolean;
}

/**
 * Shared header toggles for language (EN/ZH) and dark mode.
 * Can be used standalone (manages own state) or controlled (via props).
 */
export const HeaderToggles: React.FC<HeaderTogglesProps> = ({
    lang: externalLang,
    onLangChange,
    isDark: externalDark,
    onDarkChange,
    hideDarkMode = false,
}) => {
    // Language — controlled or self-managed
    const [internalLang, setInternalLang] = useState<'en' | 'zh'>(getStoredLang);
    const lang = externalLang ?? internalLang;

    const toggleLang = useCallback(() => {
        const next = lang === 'en' ? 'zh' : 'en';
        try { localStorage.setItem(LANG_KEY, next); } catch { }
        if (onLangChange) {
            onLangChange(next);
        } else {
            setInternalLang(next);
            // If no external handler, reload to pick up change
            window.location.reload();
        }
    }, [lang, onLangChange]);

    // Dark mode — controlled or self-managed
    const [internalDark, setInternalDark] = useState(getStoredDark);
    const isDark = externalDark ?? internalDark;

    const toggleDark = useCallback(() => {
        const next = !isDark;
        try { localStorage.setItem(DARK_KEY, String(next)); } catch { }
        if (onDarkChange) {
            onDarkChange(next);
        } else {
            setInternalDark(next);
            document.documentElement.classList.toggle('dark', next);
        }
    }, [isDark, onDarkChange]);

    // Sync cross-tab
    useEffect(() => {
        const handler = (e: StorageEvent) => {
            if (e.key === LANG_KEY && (e.newValue === 'en' || e.newValue === 'zh')) {
                if (onLangChange) onLangChange(e.newValue);
                else setInternalLang(e.newValue);
            }
            if (e.key === DARK_KEY) {
                const v = e.newValue === 'true';
                if (onDarkChange) onDarkChange(v);
                else {
                    setInternalDark(v);
                    document.documentElement.classList.toggle('dark', v);
                }
            }
        };
        window.addEventListener('storage', handler);
        return () => window.removeEventListener('storage', handler);
    }, [onLangChange, onDarkChange]);

    return (
        <div className="flex items-center gap-1.5">
            {/* Language toggle */}
            <button
                onClick={toggleLang}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold tracking-wide
                    bg-slate-100 text-slate-600 hover:bg-slate-200
                    dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700
                    border border-slate-200 dark:border-slate-700
                    transition-colors"
                title={lang === 'en' ? 'Switch to Chinese' : '切换到英文'}
            >
                <Globe size={14} />
                <span>{lang === 'en' ? '中文' : 'EN'}</span>
            </button>

            {/* Dark mode toggle */}
            {!hideDarkMode && (
                <button
                    onClick={toggleDark}
                    className="p-2 rounded-lg
                        bg-slate-100 text-slate-600 hover:bg-slate-200
                        dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700
                        border border-slate-200 dark:border-slate-700
                        transition-colors"
                    title={isDark ? 'Light Mode' : 'Dark Mode'}
                >
                    {isDark ? <Sun size={16} /> : <Moon size={16} />}
                </button>
            )}
        </div>
    );
};
