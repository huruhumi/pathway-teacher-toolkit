const fs = require('fs');
const path = require('path');

const files = [
    'apps/edu-hub/i18n/translations.ts',
    'apps/esl-planner/i18n/translations.ts',
    'apps/essay-lab/i18n/translations.ts',
    'apps/nature-compass/i18n/translations.ts',
    'apps/rednote-ops/src/i18n/translations.ts',
    'apps/student-portal/i18n/translations.ts'
];

let globalTranslations = {};

files.forEach(file => {
    const fullPath = path.resolve(__dirname, '..', file);
    if (!fs.existsSync(fullPath)) return;

    let content = fs.readFileSync(fullPath, 'utf-8');

    // Extract the inner object
    const startIndex = content.indexOf('{');
    const endIndex = content.lastIndexOf('} as const');
    if (startIndex !== -1 && endIndex !== -1) {
        let lines = content.substring(startIndex + 1, endIndex).trim().split('\n');
        lines.forEach(line => {
            // Keep comments and valid keys
            globalTranslations[file + Math.random()] = line; // just store the lines in order
        });
    }
});

let output = `export const translations = {\n`;
for (let key in globalTranslations) {
    output += globalTranslations[key] + '\n';
}
output += `} as const;\n\nexport type TranslationKey = keyof typeof translations;\n`;

const outDir = path.resolve(__dirname, '../packages/shared/i18n');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(path.join(outDir, 'translations.ts'), output);
console.log('Successfully created @shared/i18n/translations.ts!');
