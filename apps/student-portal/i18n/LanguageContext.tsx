import { createLanguageContext } from '@shared/i18n/LanguageContext';
import { translations, TranslationKey } from './translations';
export type { TranslationKey };

// Default to Chinese for student/parent readability
const { LanguageProvider, useLanguage } = createLanguageContext<TranslationKey>(translations, 'zh');
export { LanguageProvider, useLanguage };
