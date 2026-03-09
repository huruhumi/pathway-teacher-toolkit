// Content Review v2 — Step 5: Generate 4 Lesson Kits (roadmap + handbook ONLY)
import { GoogleGenAI } from '@google/genai';
import { readFileSync, writeFileSync, appendFileSync } from 'fs';

const envFile = readFileSync('d:/Vibe Coding Projects/Pathway Academy Toolkit/.env', 'utf8');
const apiKey = envFile.match(/VITE_GEMINI_API_KEY=(.+)/)?.[1]?.trim();
const ai = new GoogleGenAI({ apiKey });
const DIR = 'd:/Vibe Coding Projects/Pathway Academy Toolkit/apps/nature-compass/.content-review/20260309-0359';
const TIMING = `${DIR}/_timing.log`;
const ERRORS = `${DIR}/_errors.log`;

appendFileSync(TIMING, `\n=== Step 5: ${new Date().toISOString()} ===\n`);
appendFileSync(ERRORS, `\n=== Step 5: ${new Date().toISOString()} ===\n`);

const curriculum1012 = JSON.parse(readFileSync(`${DIR}/01-curricula/curriculum-10-12-en.json`, 'utf8'));
const curriculum68 = JSON.parse(readFileSync(`${DIR}/01-curricula/curriculum-6-8-en.json`, 'utf8'));

const pick1012 = Math.floor(Math.random() * curriculum1012.lessons.length);
const pick68 = Math.floor(Math.random() * curriculum68.lessons.length);
console.log(`Picked: lesson ${pick1012 + 1} for 10-12, lesson ${pick68 + 1} for 6-8`);

// STRIPPED schema: roadmap + handbook ONLY
const schema = {
    type: 'OBJECT',
    properties: {
        roadmap: {
            type: 'ARRAY',
            items: {
                type: 'OBJECT',
                properties: {
                    timeRange: { type: 'STRING' },
                    phase: { type: 'STRING' },
                    activity: { type: 'STRING' },
                    description: { type: 'STRING' },
                    learningObjective: { type: 'STRING' },
                    steps: { type: 'ARRAY', items: { type: 'STRING' } },
                    backgroundInfo: { type: 'ARRAY', items: { type: 'STRING' } },
                    teachingTips: { type: 'ARRAY', items: { type: 'STRING' } }
                },
                required: ['timeRange', 'phase', 'activity', 'description', 'learningObjective', 'steps', 'backgroundInfo', 'teachingTips']
            }
        },
        handbook: {
            type: 'ARRAY',
            items: {
                type: 'OBJECT',
                properties: {
                    page: { type: 'NUMBER' },
                    title: { type: 'STRING' },
                    section: { type: 'STRING' },
                    contentPrompt: { type: 'STRING' },
                    visualPrompt: { type: 'STRING' },
                    layoutDescription: { type: 'STRING' }
                },
                required: ['page', 'title', 'section', 'contentPrompt', 'visualPrompt', 'layoutDescription']
            }
        }
    },
    required: ['roadmap', 'handbook']
};

function buildPrompt(lesson, age, mode, cefr) {
    const isFamily = mode === 'family';
    const ageRules = age === '6-8'
        ? `Reading: 150-200 words/page MIN. Include "Did You Know?" box + 1 comprehension Q.
Activity: 1-2 tasks/page, short commands. BK: 3-4 fun facts with data.`
        : `Reading: 300-400 words/page MIN. 3-4 paragraphs, cause-effect. Vocab callouts + 2-3 comprehension Qs.
Activity: Multi-step, data tables, observation logs. BK: 3-4 paragraphs with data, "Think About It" Q.`;

    return `Expert STEAM Curriculum Designer. Generate ONLY roadmap + handbook for a 90-min "Nature Compass" ${isFamily ? 'family self-guided' : 'school teacher-led'} workshop.
Ages ${age}. Theme: ${lesson.title}. Location: ${lesson.location}. Focus: ${lesson.steam_focus}.
${!isFamily ? `CEFR: ${cefr}. ESL scaffolding required.` : 'Family mode: parent-friendly, warm tone, home-available equipment.'}

5E: ENGAGE->EXPLORE->EXPLAIN->ELABORATE->EVALUATE. 5-7 phases.
Each phase: description (6-8 sentences, concrete facts), steps (5-7), backgroundInfo (5-8 RICH factual points — these become handbook Reading pages), teachingTips.

Handbook: EXACTLY 15 pages.
P1-Cover, P2-ToC, P3-Safety, P4-PropChecklist, P5-12 content (interleaved BK/Activity/Reading by phase), P13-Reflection, P14-Certificate, P15-BackCover.

${ageRules}

contentPrompt = exact student-facing printed text. NO meta instructions.
visualPrompt = illustration description, WHITE background.`;
}

function formatKit(data, lesson, age, mode) {
    let md = `# ${lesson.title}\n**${mode}** | Age ${age} | ${lesson.location}\n\n`;
    md += `## Roadmap (${data.roadmap.length} phases)\n\n`;
    data.roadmap.forEach(r => {
        md += `### ${r.phase} (${r.timeRange})\n**Activity**: ${r.activity}\n\n${r.description}\n\n`;
        md += `**Steps**:\n${r.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n`;
        md += `**Background Info**:\n${r.backgroundInfo.map(b => `- ${b}`).join('\n')}\n\n`;
        md += `**Teaching Tips**: ${r.teachingTips.join(' | ')}\n\n`;
    });
    md += `## Handbook (${data.handbook.length} pages)\n\n`;
    data.handbook.forEach(h => {
        const wc = h.contentPrompt.split(/\s+/).length;
        md += `### P${h.page}: ${h.title} [${h.section}] (${wc} words)\n${h.contentPrompt}\n\n*Visual*: ${h.visualPrompt}\n*Layout*: ${h.layoutDescription}\n\n---\n\n`;
    });
    return md;
}

async function gen(idx, lesson, age, mode, cefr) {
    const fname = `lesson-${idx}-${mode}-${age}`;
    console.log(`  ${fname}...`);
    const t0 = Date.now();

    try {
        const resp = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            config: { systemInstruction: buildPrompt(lesson, age, mode, cefr), responseMimeType: 'application/json', responseSchema: schema, temperature: 0.5 },
            contents: 'Generate the roadmap and handbook now.'
        });
        const sec = ((Date.now() - t0) / 1000).toFixed(1);
        const data = JSON.parse(resp.text);
        writeFileSync(`${DIR}/04-lesson-kits/${fname}.json`, JSON.stringify(data, null, 2));
        writeFileSync(`${DIR}/04-lesson-kits/${fname}.md`, formatKit(data, lesson, age, mode));
        appendFileSync(TIMING, `${fname}: ${sec}s | ${data.roadmap?.length} phases | ${data.handbook?.length} pages\n`);
        console.log(`  ✅ ${fname}: ${sec}s, ${data.roadmap?.length} phases, ${data.handbook?.length} pages`);
        return data;
    } catch (e) {
        const sec = ((Date.now() - t0) / 1000).toFixed(1);
        appendFileSync(ERRORS, `${fname}: ${e.message} (${sec}s)\n`);
        console.error(`  ❌ ${fname}: ${e.message}`);
        return null;
    }
}

async function main() {
    console.log('=== Step 5: Generate 4 Lesson Kits (roadmap+handbook only) ===\n');
    await gen(pick1012 + 1, curriculum1012.lessons[pick1012], '10-12', 'school', 'A2');
    await new Promise(r => setTimeout(r, 2000));
    await gen(pick1012 + 1, curriculum1012.lessons[pick1012], '10-12', 'family', 'A2');
    await new Promise(r => setTimeout(r, 2000));
    await gen(pick68 + 1, curriculum68.lessons[pick68], '6-8', 'school', 'A1');
    await new Promise(r => setTimeout(r, 2000));
    await gen(pick68 + 1, curriculum68.lessons[pick68], '6-8', 'family', 'A1');
    console.log('\n✅ Step 5 complete!');
}

main().catch(e => { appendFileSync(ERRORS, `FATAL: ${e.message}\n`); console.error('FATAL:', e.message); process.exit(1); });
