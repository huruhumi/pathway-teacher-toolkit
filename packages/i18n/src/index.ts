import { createLanguageContext, type Lang } from '../../shared/i18n/LanguageContext';

type TranslationMap<TKey extends string = string> = Record<TKey, Record<Lang, string>>;

export function createAppLanguageContext<TMap extends TranslationMap<string>>(
    translations: TMap,
    defaultLang: Lang = 'en',
) {
    type TKey = Extract<keyof TMap, string>;
    return createLanguageContext<TKey>(
        translations as unknown as Record<TKey, Record<Lang, string>>,
        defaultLang,
    );
}

export { createLanguageContext };
export type { Lang };
export { commonTranslations } from '../../shared/i18n/commonTranslations';
