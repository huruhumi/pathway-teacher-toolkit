import React, { createContext, useContext, useState, useCallback } from 'react';
import { translations, TranslationKey } from './translations';
export type { TranslationKey };

interface LanguageContextType {
    lang: 'en' | 'zh';
    setLang: (l: 'en' | 'zh') => void;
    t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType>({
    lang: 'en',
    setLang: () => { },
    t: (key) => key,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [lang, setLang] = useState<'en' | 'zh'>('en');

    const t = useCallback(
        (key: TranslationKey): string => translations[key]?.[lang] ?? key,
        [lang]
    );

    return (
        <LanguageContext.Provider value={{ lang, setLang, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => useContext(LanguageContext);
