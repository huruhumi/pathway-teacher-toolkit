// Content Review v2 — Step 6: Review Lesson Kits
import { GoogleGenAI } from '@google/genai';
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'fs';

const envFile = readFileSync('d:/Vibe Coding Projects/Pathway Academy Toolkit/.env', 'utf8');
const apiKey = envFile.match(/VITE_GEMINI_API_KEY=(.+)/)?.[1]?.trim();
const ai = new GoogleGenAI({ apiKey });
const DIR = 'd:/Vibe Coding Projects/Pathway Academy Toolkit/apps/nature-compass/.content-review/20260309-0359';

const KITS = [
    { file: 'lesson-1-school-10-12', age: '10-12', mode: 'school' },
    { file: 'lesson-1-family-10-12', age: '10-12', mode: 'family' },
    { file: 'lesson-4-school-6-8', age: '6-8', mode: 'school' },
    { file: 'lesson-4-family-6-8', age: '6-8', mode: 'family' }
];

async function reviewKit(cfg) {
    const mdPath = `${DIR}/04-lesson-kits/${cfg.file}.md`;
    if (!existsSync(mdPath)) {
        console.log(`  Skipping ${cfg.file} (generation failed earlier)`);
        return null;
    }

    const content = readFileSync(mdPath, 'utf8');
    console.log(`  Reviewing ${cfg.file}...`);

    const prompt = `You are reviewing a Nature Compass lesson kit (STEAM outdoor workshop).
Mode: ${cfg.mode}, Age: ${cfg.age}.

=== LESSON KIT ===
${content}
=== END ===

Review from these perspectives. Output MUST be in Chinese.

## 1. ESL Teacher (School mode) 或 Content Auditor (Family mode)
If school mode: Vocabulary difficulty vs CEFR ${cfg.age === '6-8' ? 'A1' : 'A2'}? Scaffolding quality?
If family mode: Is the language easy enough for parents to read aloud?
Score: [1-10] and explain.

## 2. Activity Planner / 研学设计师
5E model compliance? Time allocation realism? Cross-curricular depth?
Score: [1-10] and explain.

## 3. Parent (Family mode) 或 Co-Teacher (School mode)
If family mode: Clear instructions? Realistic equipment for weekend outing? Fun for both?
If school mode: Are the "Teaching Tips" practical in an outdoor setting?
Score: [1-10] and explain.

## 4. Student / Child (Age ${cfg.age})
Would I understand the reading pages? Are activities engaging? Too much text?
Score: [1-10] and explain.

## 5. UI Designer / Handbook Layout
Does visualPrompt give enough detail (composition, subjects, style) for Midjourney/DALL-E?
Does layoutDescription specify spatial arrangement clearly? Are pages text-heavy?
Score: [1-10] and explain.

## Summary: Top 3 Critical Issues
What are the 3 most impactful problems?`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro', // use pro model for better review reasoning
            contents: prompt,
            config: { temperature: 0.3 }
        });
        const review = response.text;
        writeFileSync(`${DIR}/05-kit-review/review-${cfg.file}.md`, review);
        console.log(`  ✅ Review saved for ${cfg.file}`);
        return { file: cfg.file, review };
    } catch (e) {
        console.error(`  ❌ Review failed for ${cfg.file}:`, e.message);
        return null;
    }
}

function runAutomatedChecks() {
    console.log('\n  Running automated validation checks...');
    let report = `# Automated Validation Checks\n\n`;
    report += `| Kit | Target Pages (15) | Reading Section Used? | Word Count Targets Met? | Overall Result |\n`;
    report += `|-----|-------------------|-----------------------|-------------------------|----------------|\n`;

    for (const cfg of KITS) {
        const jsonPath = `${DIR}/04-lesson-kits/${cfg.file}.json`;
        if (!existsSync(jsonPath)) {
            report += `| ${cfg.file} | ❌ FAILED TO GEN | - | - | ❌ FAIL |\n`;
            continue;
        }

        const data = JSON.parse(readFileSync(jsonPath, 'utf8'));
        const pages = data.handbook?.length || 0;
        const pageCheck = pages === 15 ? '✅ 15/15' : `❌ ${pages}/15`;

        let readingCheck = '❌ No Reading pages';
        let wordCountCheck = '-';
        let targetWC = cfg.age === '6-8' ? 150 : 300;
        let readingPages = data.handbook?.filter(h => h.section.toLowerCase().includes('reading')) || [];

        if (readingPages.length > 0) {
            readingCheck = `✅ ${readingPages.length} pages`;
            let wcSucceed = 0;
            let wcFails = [];
            readingPages.forEach(p => {
                // Handle BOTH English words and Chinese characters (basic heuristic)
                const text = p.contentPrompt || '';
                const enWords = (text.match(/[a-zA-Z]+/g) || []).length;
                const zhChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
                const count = Math.max(enWords, zhChars);

                if (count >= targetWC) {
                    wcSucceed++;
                } else {
                    wcFails.push(`P${p.page} (${count}/${targetWC})`);
                }
            });
            wordCountCheck = wcFails.length === 0 ? `✅ All >${targetWC}` : `❌ Fails: ${wcFails.join(', ')}`;
        }

        const isPass = pages === 15 && readingPages.length > 0 && wordCountCheck.startsWith('✅') ? '✅ PASS' : '⚠️ WARN';
        report += `| ${cfg.file} | ${pageCheck} | ${readingCheck} | ${wordCountCheck} | ${isPass} |\n`;
    }

    writeFileSync(`${DIR}/05-kit-review/validation-checks.md`, report);
    console.log('  ✅ Automated validation complete');
    return report;
}

async function main() {
    console.log('=== Step 6: Review Kits & Validate ===\n');

    const reviews = [];
    for (const cfg of KITS) {
        const res = await reviewKit(cfg);
        if (res) reviews.push(res);
        await new Promise(r => setTimeout(r, 4000)); // Sleep between calls
    }

    const checks = runAutomatedChecks();

    console.log('\n=== Step 7: Kit Optimization Plan ===\n');
    const planPrompt = `Based on these expert reviews of 3 generated lesson kits (1 failed),
synthesize a UNIFIED optimization plan for the lesson kit generation prompt.

=== AUTOMATED CHECKS ===
${checks}

=== EXPERT REVIEWS ===
${reviews.map(r => `--- Review of ${r.file} ---\n${r.review}`).join('\n\n')}

Output in this structure (IN CHINESE):
1. Handbook Content & Length Issues (address the automated checks)
2. Common pedagogical/design issues
3. Parent/Teacher usability contrast issues
4. Prompt improvement recommendations (specific wording changes for the AI prompt)
5. Priority ranking (P0 = must fix, P1 = should fix)`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: planPrompt,
        config: { temperature: 0.3 }
    });

    writeFileSync(`${DIR}/06-kit-fixes/optimization-plan.md`, response.text);
    console.log('  ✅ Kit optimization plan saved');

    console.log('\n✅ Steps 6-7 complete!');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
