import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'pathway_uiLang';
type Lang = 'en' | 'zh';

interface LanguageContextType {
    lang: Lang;
    setLang: (l: Lang) => void;
}

function getStoredLang(): Lang {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === 'zh') return 'zh';
    } catch { /* ignore */ }
    return 'en';
}

const LanguageContext = createContext<LanguageContextType>({
    lang: 'en',
    setLang: () => { },
});

export const SharedLanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [lang, setLangState] = useState<Lang>(getStoredLang);

    const setLang = useCallback((l: Lang) => {
        setLangState(l);
        try {
            localStorage.setItem(STORAGE_KEY, l);
        } catch { /* ignore */ }
    }, []);

    // Sync if another tab/window changes the value
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
        <LanguageContext.Provider value={{ lang, setLang }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useSharedLanguage = () => useContext(LanguageContext);
export type { Lang };
