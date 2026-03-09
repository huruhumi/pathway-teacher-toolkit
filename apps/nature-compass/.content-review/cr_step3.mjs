// Content Review — Step 3+4: Review curricula + generate optimization plan
import { GoogleGenAI } from '@google/genai';
import { readFileSync, writeFileSync } from 'fs';

const envFile = readFileSync('d:/Vibe Coding Projects/Pathway Academy Toolkit/.env', 'utf8');
const apiKey = envFile.match(/VITE_GEMINI_API_KEY=(.+)/)?.[1]?.trim();
const ai = new GoogleGenAI({ apiKey });
const DIR = 'd:/Vibe Coding Projects/Pathway Academy Toolkit/apps/nature-compass/.content-review/20260309-0359';

const CONFIGS = [
    { file: 'curriculum-6-8-en.md', age: '6-8', lang: 'EN', cefr: 'A1' },
    { file: 'curriculum-6-8-zh.md', age: '6-8', lang: 'ZH', cefr: 'N/A' },
    { file: 'curriculum-10-12-en.md', age: '10-12', lang: 'EN', cefr: 'A2' },
    { file: 'curriculum-10-12-zh.md', age: '10-12', lang: 'ZH', cefr: 'N/A' },
];

async function reviewCurriculum(cfg) {
    const content = readFileSync(`${DIR}/01-curricula/${cfg.file}`, 'utf8');
    const prompt = `You are reviewing a STEAM outdoor curriculum for students aged ${cfg.age} in 武汉.
Review from these TWO expert perspectives and provide specific, actionable feedback.
${cfg.lang === 'ZH' ? 'Please write your review in Chinese since the curriculum is in Chinese.' : ''}

=== CURRICULUM TO REVIEW ===
${content}
=== END ===

## Perspective 1: ESL Teacher (CEFR ${cfg.cefr})
${cfg.lang === 'ZH' ? '(This is a Chinese-only curriculum, so evaluate the STEAM terminology usage and age-appropriateness of Chinese vocabulary instead of ESL.)' : `Evaluate:
- Is the English vocabulary appropriate for CEFR ${cfg.cefr}?
- Are the ESL focus activities realistic and effective?
- Would students at this level understand the activity instructions?
- Are there missed opportunities for language integration?`}
Score: [1-10] and explain.

## Perspective 2: Activity Planner / 研学设计师
Evaluate:
- Are the locations real and accessible in 武汉? Are they suitable for age ${cfg.age}?
- Is the activity design age-appropriate in terms of cognitive load and physical demands?
- Do the 4 lessons form a coherent progressive sequence?
- Are the indoor alternatives genuinely equivalent in learning value?
- Is 90 minutes realistic for the described activities?
Score: [1-10] and explain.

## Top 5 Specific Improvements
List exactly 5 concrete, actionable improvements ranked by impact.`;

    console.log(`  Reviewing ${cfg.file}...`);
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { temperature: 0.3 }
    });

    const review = response.text;
    writeFileSync(`${DIR}/02-curriculum-review/review-${cfg.age}-${cfg.lang.toLowerCase()}.md`, review);
    console.log(`  ✅ Review saved for ${cfg.file}`);
    return review;
}

async function generateOptimizationPlan(allReviews) {
    const prompt = `Based on the following expert reviews of 4 curricula across 2 age groups (6-8 and 10-12),
synthesize a UNIFIED optimization plan for the curriculum generation prompt.

${allReviews}

Output in this structure:
1. **Common issues** across all age groups (patterns you see in multiple reviews)
2. **Age-specific issues** (problems unique to one age group)
3. **Prompt improvement recommendations** (specific wording changes for the AI prompt that generates these curricula)
4. **Priority ranking** (P0 = must fix, P1 = should fix, P2 = nice to have)

Write in Chinese for the final report.`;

    console.log('  Generating optimization plan...');
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { temperature: 0.3 }
    });

    writeFileSync(`${DIR}/03-curriculum-fixes/optimization-plan.md`, response.text);
    console.log('  ✅ Optimization plan saved');
}

async function main() {
    console.log('=== Step 3: Review Curricula ===\n');
    let allReviews = '';
    for (const cfg of CONFIGS) {
        const review = await reviewCurriculum(cfg);
        allReviews += `\n\n--- Review of ${cfg.file} ---\n${review}`;
        await new Promise(r => setTimeout(r, 2000));
    }

    console.log('\n=== Step 4: Optimization Plan ===\n');
    await generateOptimizationPlan(allReviews);

    console.log('\n✅ Steps 3-4 complete!');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
