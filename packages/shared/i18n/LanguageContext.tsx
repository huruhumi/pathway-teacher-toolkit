import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'pathway_uiLang';
type Lang = 'en' | 'zh';

interface LanguageContextType<TKey extends string = string> {
    lang: Lang;
    setLang: (l: Lang) => void;
    t: (key: TKey) => string;
}

function getStoredLang(): Lang {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === 'zh') return 'zh';
    } catch { /* ignore */ }
    return 'en';
}

/**
 * Factory: creates a LanguageProvider + useLanguage hook bound to a specific translations dictionary.
 * Each app calls this once with its own translations, eliminating 60 lines of duplicated context code per app.
 */
export function createLanguageContext<TKey extends string>(
    translations: Record<TKey, Record<Lang, string>>
) {
    const Context = createContext<LanguageContextType<TKey>>({
        lang: 'en',
        setLang: () => { },
        t: (key) => key,
    });

    const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
        const [lang, setLangState] = useState<Lang>(getStoredLang);

        const setLang = useCallback((l: Lang) => {
            setLangState(l);
            try {
                localStorage.setItem(STORAGE_KEY, l);
            } catch { /* ignore */ }
        }, []);

        const t = useCallback(
            (key: TKey): string => (translations as any)[key]?.[lang] ?? key,
            [lang]
        );

        useEffect(() => {
            const handler = (e: StorageEvent) => {
                if (e.key === STORAGE_KEY && (e.newValue === 'en' || e.newValue === 'zh')) {
                    setLangState(e.newValue);
                }
            };
            window.addEventListener('storage', handler);
            return () => window.removeEventListener('storage', handler);
        }, []);

        return (
            <Context.Provider value={{ lang, setLang, t }}>
                {children}
            </Context.Provider>
        );
    };

    const useLanguage = () => useContext(Context);

    return { LanguageProvider, useLanguage };
}

export type { Lang };
