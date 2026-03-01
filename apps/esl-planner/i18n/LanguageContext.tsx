import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { translations, TranslationKey } from './translations';
export type { TranslationKey };

const STORAGE_KEY = 'pathway_uiLang';

interface LanguageContextType {
    lang: 'en' | 'zh';
    setLang: (l: 'en' | 'zh') => void;
    t: (key: TranslationKey) => string;
}

function getStoredLang(): 'en' | 'zh' {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === 'zh') return 'zh';
    } catch { /* ignore */ }
    return 'en';
}

const LanguageContext = createContext<LanguageContextType>({
    lang: 'en',
    setLang: () => { },
    t: (key) => key,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [lang, setLangState] = useState<'en' | 'zh'>(getStoredLang);

    const setLang = useCallback((l: 'en' | 'zh') => {
        setLangState(l);
        try {
            localStorage.setItem(STORAGE_KEY, l);
        } catch { /* ignore */ }
    }, []);

    const t = useCallback(
        (key: TranslationKey): string => translations[key]?.[lang] ?? key,
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
        <LanguageContext.Provider value={{ lang, setLang, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => useContext(LanguageContext);
