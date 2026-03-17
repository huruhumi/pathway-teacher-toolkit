import { createAppLanguageContext } from '@pathway/i18n';
import { translations, TranslationKey } from './translations';
export type { TranslationKey };

// Default to Chinese for student/parent readability
const { LanguageProvider, useLanguage } = createAppLanguageContext(translations, 'zh');
export { LanguageProvider, useLanguage };
