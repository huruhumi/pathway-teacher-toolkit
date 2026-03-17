import { createAppLanguageContext } from '@pathway/i18n';
import { translations, TranslationKey } from './translations';
export type { TranslationKey };

const { LanguageProvider, useLanguage } = createAppLanguageContext(translations);
export { LanguageProvider, useLanguage };
