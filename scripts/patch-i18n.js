const fs = require('fs');

const files = [
    'apps/edu-hub/i18n/translations.ts',
    'apps/esl-planner/i18n/translations.ts',
    'apps/essay-lab/i18n/translations.ts',
    'apps/nature-compass/i18n/translations.ts',
    'apps/rednote-ops/src/i18n/translations.ts',
    'apps/student-portal/i18n/translations.ts'
];

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace("export const translations = {", "import { commonTranslations } from '@shared/i18n/commonTranslations';\n\nexport const translations = {\n    ...commonTranslations,");
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Patched ${file} with correct UTF-8 encoding`);
});
