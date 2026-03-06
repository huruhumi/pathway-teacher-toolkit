const fs = require('fs');
const path = require('path');

const files = [
    { prefix: 'edu', path: 'apps/edu-hub/i18n/translations.ts' },
    { prefix: 'esl', path: 'apps/esl-planner/i18n/translations.ts' },
    { prefix: 'essay', path: 'apps/essay-lab/i18n/translations.ts' },
    { prefix: 'nature', path: 'apps/nature-compass/i18n/translations.ts' },
    { prefix: 'ops', path: 'apps/rednote-ops/src/i18n/translations.ts' },
    { prefix: 'student', path: 'apps/student-portal/i18n/translations.ts' }
];

let globalTranslations = new Map();

files.forEach(fileObj => {
    const fullPath = path.resolve(__dirname, '..', fileObj.path);
    if (!fs.existsSync(fullPath)) return;

    let content = fs.readFileSync(fullPath, 'utf-8');

    const startIndex = content.indexOf('{');
    const endIndex = content.lastIndexOf('} as const');
    if (startIndex !== -1 && endIndex !== -1) {
        let lines = content.substring(startIndex + 1, endIndex).trim().split('\n');

        lines.forEach(line => {
            let trimLine = line.trim();
            if (!trimLine || trimLine.startsWith('//')) {
                // Keep comments with a random key so they stay in order
                globalTranslations.set(Math.random().toString(), line);
                return;
            }

            // Extract the key: 'nav.dashboard': { en: ... }
            const match = trimLine.match(/^'([^']+)'/);
            if (match) {
                const keyName = match[1];
                if (globalTranslations.has(keyName)) {
                    // It's a duplicate, we could rename it based on prefix if it's 'footer'
                    if (keyName === 'footer') {
                        let newKey = `'footer.${fileObj.prefix}'`;
                        globalTranslations.set(newKey, line.replace(`'${keyName}'`, newKey));
                        console.log(`Renamed duplicate key ${keyName} to ${newKey}`);
                    }
                    // For others like common.save, we can just let the first one win by skipping
                    else {
                        console.log(`Skipped duplicate key ${keyName}`);
                    }
                } else {
                    globalTranslations.set(keyName, line);
                }
            } else {
                // Might be multiline or something else
                globalTranslations.set(Math.random().toString(), line);
            }
        });
    }
});

let output = `export const translations = {\n`;
for (let [key, value] of globalTranslations) {
    output += value + '\n';
}
output += `} as const;\n\nexport type TranslationKey = keyof typeof translations;\n`;

const outDir = path.resolve(__dirname, '../packages/shared/i18n');
fs.writeFileSync(path.join(outDir, 'translations.ts'), output);
console.log('Successfully created deduplicated @shared/i18n/translations.ts!');
