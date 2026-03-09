// Content Review v2 — Step 6: Review Lesson Kits + A12/A13 Checks
import { GoogleGenAI } from '@google/genai';
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'fs';

const envFile = readFileSync('d:/Vibe Coding Projects/Pathway Academy Toolkit/.env', 'utf8');
const apiKey = envFile.match(/VITE_GEMINI_API_KEY=(.+)/)?.[1]?.trim();
const ai = new GoogleGenAI({ apiKey });
const DIR = 'd:/Vibe Coding Projects/Pathway Academy Toolkit/apps/nature-compass/.content-review/20260309-1701';

const KITS = [
    { file: 'lesson-1-school-10-12', age: '10-12', mode: 'school' },
    { file: 'lesson-1-family-10-12', age: '10-12', mode: 'family' },
    { file: 'lesson-1-school-6-8', age: '6-8', mode: 'school' }, // NOTE: mapped to lesson-1 here too because of Math.random
    { file: 'lesson-1-family-6-8', age: '6-8', mode: 'family' }  // The file names might vary if random is changed, so we'll read the directory instead.
];

// Re-read KITS by scanning directory
import fs from 'fs';
const kitsInDir = fs.readdirSync(`${DIR}/04-lesson-kits`).filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
const activeKits = kitsInDir.map(file => {
    const parts = file.split('-'); // e.g. lesson-1-school-10-12
    const mode = parts[2];
    const age = parts[3] + '-' + parts[4];
    return { file, age, mode };
});

async function aiDifficultyCheck(readingPages, age) {
    if (!readingPages || readingPages.length === 0) return "N/A";

    // Combine all reading page text
    const text = readingPages.map(p => p.contentPrompt).join('\n\n');
    const cefr = age === '6-8' ? 'A1' : 'A2';

    const prompt = `Evaluate the reading difficulty of the following text for ESL learners at CEFR level ${cefr} (Ages ${age}).
    
TEXT:
${text}
===
Rate the difficulty on a scale of 1 to 5 (1=Too Easy, 3=Perfect, 5=Too Hard) and provide a ONE SENTENCE explanation.
Format: { "score": 3, "explanation": "sentence" }`;

    try {
        const resp = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: 'application/json', temperature: 0.1 }
        });
        const data = JSON.parse(resp.text);
        return `Score: ${data.score}/5 (${data.explanation})`;
    } catch (err) {
        return "Failed AI Check";
    }
}

async function runAutomatedChecks() {
    console.log('\n  Running automated validation checks (incl. A12/A13)...');
    let md = `# Automated Validation Checks\n\n`;
    md += `| Kit | Pages | Word Count | A12 AI Difficulty | A13 Cross-Ref | Result |\n`;
    md += `|-----|-------|------------|--------------------|---------------|\n`;

    for (const cfg of activeKits) {
        const jsonPath = `${DIR}/04-lesson-kits/${cfg.file}.json`;
        if (!existsSync(jsonPath)) continue;

        const data = JSON.parse(readFileSync(jsonPath, 'utf8'));
        const pages = data.handbook?.length || 0;
        const pageCheck = pages === 15 ? '✅ 15/15' : `❌ ${pages}/15`;

        let wordCountCheck = '-';
        let targetWC = cfg.age === '6-8' ? 15 : 30; // Changed target WC match what we instructed
        let readingPages = data.handbook?.filter(h => h.section.toLowerCase().includes('reading')) || [];

        if (readingPages.length > 0) {
            let wcFails = [];
            readingPages.forEach(p => {
                const text = p.contentPrompt || '';
                const enWords = (text.match(/[a-zA-Z]+/g) || []).length;
                if (enWords < targetWC) wcFails.push(`P${p.page}(${enWords})`);
            });
            wordCountCheck = wcFails.length === 0 ? `✅ All >${targetWC}` : `❌ Fails: ${wcFails.join(', ')}`;
        }

        // A12 AI Check
        const aiDiff = await aiDifficultyCheck(readingPages, cfg.age);

        // A13 Cross-ref checks
        const crossRefFails = [];

        // 1. Vocabulary in Reading Pages?
        const readingText = readingPages.map(p => p.contentPrompt).join(' ').toLowerCase();
        const vocabs = data.vocabulary?.keywords?.map(k => k.word) || [];
        let missingVocab = 0;
        vocabs.forEach(v => {
            if (!readingText.includes(v.toLowerCase())) missingVocab++;
        });
        if (missingVocab > 0) crossRefFails.push(`${missingVocab} vocabs missing in reading`);

        // 2. phaseSupplies in global supplies?
        const globalSupplies = [
            ...(data.supplies?.permanent || []),
            ...(data.supplies?.consumables || [])
        ].join(' ').toLowerCase();

        let missingSupplies = 0;
        (data.roadmap || []).forEach(phase => {
            (phase.phaseSupplies || []).forEach(item => {
                if (!globalSupplies.includes(item.toLowerCase())) missingSupplies++;
            });
        });
        if (missingSupplies > 0) crossRefFails.push(`${missingSupplies} phase items missing in global`);

        const crossRefResult = crossRefFails.length > 0 ? `❌ ${crossRefFails.join(', ')}` : '✅ All Pass';

        const isPass = pages === 15 && wordCountCheck.startsWith('✅') && crossRefFails.length === 0 ? '✅ PASS' : '⚠️ WARN';
        md += `| ${cfg.file} | ${pageCheck} | ${wordCountCheck} | ${aiDiff} | ${crossRefResult} | ${isPass} |\n`;
    }

    writeFileSync(`${DIR}/05-kit-review/validation-checks.md`, md);
    console.log('  ✅ Automated validation complete (A12 & A13)');
    return md;
}

async function reviewKit(cfg) {
    const mdPath = `${DIR}/04-lesson-kits/${cfg.file}.md`;
    if (!existsSync(mdPath)) return null;

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

## Summary: Top 3 Critical Issues
What are the 3 most impactful problems?`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
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

async function main() {
    console.log('=== Step 6: Review Kits & Validate ===\n');

    const reviews = [];
    for (const cfg of activeKits) {
        const res = await reviewKit(cfg);
        if (res) reviews.push(res);
        await new Promise(r => setTimeout(r, 4000));
    }

    const checks = await runAutomatedChecks();

    console.log('\n=== Step 7: Kit Optimization Plan ===\n');
    const planPrompt = `Based on these expert reviews of lesson kits, synthesize a UNIFIED optimization plan.

=== AUTOMATED CHECKS ===
${checks}

=== EXPERT REVIEWS ===
${reviews.map(r => `--- Review of ${r.file} ---\n${r.review}`).join('\n\n')}

Output in this structure (IN CHINESE):
1. Handbook Content & Length Issues 
2. Common pedagogical/design issues
3. Parent/Teacher usability contrast issues
4. Prompt improvement recommendations
5. Priority ranking (P0 = must fix, P1 = should fix)`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: planPrompt,
        config: { temperature: 0.3 }
    });

    writeFileSync(`${DIR}/06-kit-fixes/optimization-plan.md`, response.text);
    console.log('  ✅ Kit optimization plan saved\n✅ Steps 6-7 complete!');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
