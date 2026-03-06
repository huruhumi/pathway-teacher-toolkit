const fs = require('fs');
const path = require('path');

const entryFiles = [
    path.join(__dirname, '../apps/esl-planner/index.tsx'),
    path.join(__dirname, '../apps/essay-lab/index.tsx'),
    path.join(__dirname, '../apps/nature-compass/index.tsx'),
    path.join(__dirname, '../apps/edu-hub/index.tsx'),
    path.join(__dirname, '../apps/student-portal/index.tsx'),
    path.join(__dirname, '../apps/rednote-ops/src/main.tsx'),
];

const importLine = "import { installGlobalErrorHandlers } from '@shared/services/logger';";
const callLine = "installGlobalErrorHandlers();";

entryFiles.forEach(filePath => {
    if (!fs.existsSync(filePath)) {
        console.log(`SKIP (not found): ${filePath}`);
        return;
    }
    let content = fs.readFileSync(filePath, 'utf8');

    // Don't duplicate
    if (content.includes('installGlobalErrorHandlers')) {
        console.log(`SKIP (already has): ${path.basename(filePath)}`);
        return;
    }

    // Add import after last import line
    const lines = content.split('\n');
    let lastImportIndex = 0;
    lines.forEach((line, i) => {
        if (line.trim().startsWith('import ')) lastImportIndex = i;
    });

    lines.splice(lastImportIndex + 1, 0, importLine, '', callLine);

    fs.writeFileSync(filePath, lines.join('\n'));
    console.log(`Updated: ${path.basename(filePath)}`);
});
