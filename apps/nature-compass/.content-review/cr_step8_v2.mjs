// Content Review v2 — Step 8: Final Report
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';

const DIR = 'd:/Vibe Coding Projects/Pathway Academy Toolkit/apps/nature-compass/.content-review/20260309-1701';

function extractScore(text, perspectivePrefix) {
    const lines = text.split('\n');
    let inSection = false;
    for (const line of lines) {
        if (line.includes(`## ${perspectivePrefix}`)) inSection = true;
        else if (line.startsWith('## ')) inSection = false;

        if (inSection && line.match(/Score:\s*(\d+)/i)) {
            return parseInt(line.match(/Score:\s*(\d+)/i)[1]);
        }
    }
    return '-';
}

let report = `# Nature Compass Content Review Report (V2)\nGenerated: ${new Date().toISOString()}\n\n`;

report += `## Automated Validation Checks\n`;
if (existsSync(`${DIR}/05-kit-review/validation-checks.md`)) {
    report += readFileSync(`${DIR}/05-kit-review/validation-checks.md`, 'utf8').replace('# Automated Validation Checks\n\n', '');
} else {
    report += 'No validation checks found.\n';
}

report += `\n## AI Expert Review Scores\n`;
report += `| Kit | Language/Auditor | Planner | Usability | Avg |\n`;
report += `|-----|------------------|---------|-----------|-----|\n`;

// Curricula scores
try {
    const cFiles = readdirSync(`${DIR}/02-curriculum-review`).filter(f => f.endsWith('.md'));
    for (const f of cFiles) {
        const content = readFileSync(`${DIR}/02-curriculum-review/${f}`, 'utf8');
        const esl = extractScore(content, 'Perspective 1');
        const planner = extractScore(content, 'Perspective 2');
        const avg = ((esl + planner) / 2).toFixed(1);
        report += `| ${f.replace('.md', '')} | ${esl} | ${planner} | - | **${avg}** |\n`;
    }
} catch (e) {
    console.log('No curriculum reviews found.');
}

// Kit scores
try {
    const kFiles = readdirSync(`${DIR}/05-kit-review`).filter(f => f.startsWith('review-') && f.endsWith('.md'));
    for (const f of kFiles) {
        const content = readFileSync(`${DIR}/05-kit-review/${f}`, 'utf8');
        const esl = extractScore(content, '1.');
        const planner = extractScore(content, '2.');
        const usability = extractScore(content, '3.');

        let validScores = [esl, planner, usability].filter(s => typeof s === 'number');
        const avg = validScores.length ? (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(1) : '-';

        report += `| ${f.replace('review-', '').replace('.md', '')} | ${esl} | ${planner} | ${usability} | **${avg}** |\n`;
    }
} catch (e) {
    console.log('No kit reviews found.');
}

report += `\n## Curriculum Optimization Plan\n\n`;
if (existsSync(`${DIR}/03-curriculum-fixes/optimization-plan.md`)) {
    report += readFileSync(`${DIR}/03-curriculum-fixes/optimization-plan.md`, 'utf8');
}

report += `\n\n## Lesson Kit Optimization Plan\n\n`;
if (existsSync(`${DIR}/06-kit-fixes/optimization-plan.md`)) {
    report += readFileSync(`${DIR}/06-kit-fixes/optimization-plan.md`, 'utf8');
}

report += `\n\n## Error Log & Debugging\n\`\`\`\n`;
if (existsSync(`${DIR}/_errors.log`)) {
    report += readFileSync(`${DIR}/_errors.log`, 'utf8');
} else {
    report += 'No errors recorded.\n';
}
report += `\`\`\`\n`;

writeFileSync(`${DIR}/07-final-report/content-review-report.md`, report);
console.log('✅ Final report generated at 07-final-report/content-review-report.md');
