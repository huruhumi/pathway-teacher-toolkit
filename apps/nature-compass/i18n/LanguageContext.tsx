import { createLanguageContext } from '@shared/i18n/LanguageContext';
import { translations, TranslationKey } from './translations';
export type { TranslationKey };

const { LanguageProvider, useLanguage } = createLanguageContext<TranslationKey>(translations);
export { LanguageProvider, useLanguage };
