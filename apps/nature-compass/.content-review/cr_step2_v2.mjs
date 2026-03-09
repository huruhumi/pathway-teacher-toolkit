// Content Review Step 2: Generate Curricula
// 4 total: 2 ages × 2 languages
import { GoogleGenAI } from '@google/genai';
import { readFileSync, writeFileSync } from 'fs';

const REVIEW_DIR = 'd:/Vibe Coding Projects/Pathway Academy Toolkit/apps/nature-compass/.content-review/20260309-1701';
const envFile = readFileSync('d:/Vibe Coding Projects/Pathway Academy Toolkit/.env', 'utf8');
const apiKey = envFile.match(/VITE_GEMINI_API_KEY=(.+)/)?.[1]?.trim();
if (!apiKey) { console.error('No API key'); process.exit(1); }

const ai = new GoogleGenAI({ apiKey });
const MODEL = 'gemini-3-flash-preview';
const THEME = '城市湿地生态探索';
const CITY = '武汉';
const LESSON_COUNT = 4;
const DURATION = '180';

const configs = [
    { age: '6-8', lang: 'en', cefr: 'A1' },
    { age: '6-8', lang: 'zh', cefr: 'A1' },
    { age: '10-12', lang: 'en', cefr: 'A2' },
    { age: '10-12', lang: 'zh', cefr: 'A2' },
];

const timingLog = [];

async function generateCurriculum(config) {
    const { age, lang, cefr } = config;
    const label = `curriculum-${age}-${lang}`;
    console.log(`\n🚀 Generating ${label}...`);
    const start = Date.now();

    const langInstruction = lang === 'en'
        ? `Generate the entire curriculum in ENGLISH. Target CEFR level: ${cefr}.`
        : `Generate the entire curriculum in CHINESE (简体中文). CEFR level only affects ESL scaffolding notes.`;

    const prompt = `You are an expert outdoor STEAM + ESL curriculum designer for Pathway Academy (武汉).

Design a ${LESSON_COUNT}-lesson curriculum for ages ${age} on the theme "${THEME}" in ${CITY}.
Duration per lesson: ${DURATION} minutes.
${langInstruction}

For EACH lesson, provide:
1. lessonTitle: Creative, engaging title
2. lessonNumber: Sequential (1-${LESSON_COUNT})
3. theme: Specific sub-theme under "${THEME}"
4. location: A REAL, accessible wetland park or nature site in ${CITY} (within 30min transit from city center)
5. season: Best season for this lesson
6. learningGoals: 3 specific goals (Language + STEAM)
7. keyVocabulary: 6-8 age-appropriate terms
8. activitySummary: 2-3 sentence overview of main activities
9. steamFocus: Which S/T/E/A/M disciplines are primary
10. safetyNotes: Key safety considerations for this location

Return as a JSON object: { lessons: [...] }`;

    try {
        const response = await ai.models.generateContent({
            model: MODEL,
            contents: prompt,
            config: { responseMimeType: 'application/json', temperature: 0.8 }
        });
        const text = response.text;
        const data = JSON.parse(text);
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        timingLog.push(`${label}: ${elapsed}s`);

        writeFileSync(`${REVIEW_DIR}/01-curricula/${label}.json`, JSON.stringify(data, null, 2));

        // Also write a markdown summary
        let md = `# Curriculum: ${age} (${lang.toUpperCase()})\n\nTheme: ${THEME}\nCity: ${CITY}\nDuration: ${DURATION}min\nLessons: ${LESSON_COUNT}\n\n`;
        for (const lesson of data.lessons || []) {
            md += `## Lesson ${lesson.lessonNumber}: ${lesson.lessonTitle}\n`;
            md += `- **Theme:** ${lesson.theme}\n`;
            md += `- **Location:** ${lesson.location}\n`;
            md += `- **STEAM Focus:** ${lesson.steamFocus || 'N/A'}\n`;
            md += `- **Goals:** ${(lesson.learningGoals || []).join('; ')}\n`;
            md += `- **Activities:** ${lesson.activitySummary}\n`;
            md += `- **Safety:** ${lesson.safetyNotes || 'N/A'}\n\n`;
        }
        writeFileSync(`${REVIEW_DIR}/01-curricula/${label}.md`, md);
        console.log(`✅ ${label} done (${elapsed}s, ${data.lessons?.length || 0} lessons)`);
        return data;
    } catch (err) {
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        timingLog.push(`${label}: FAILED (${elapsed}s) - ${err.message}`);
        console.error(`❌ ${label} failed: ${err.message}`);
        writeFileSync(`${REVIEW_DIR}/01-curricula/${label}.json`, JSON.stringify({ error: err.message }));
        return null;
    }
}

async function main() {
    console.log('=== Step 2: Generate Curricula ===');
    const results = {};
    for (const config of configs) {
        results[`${config.age}-${config.lang}`] = await generateCurriculum(config);
    }
    writeFileSync(`${REVIEW_DIR}/_timing.log`, 'Step 2: Curricula Generation\n' + timingLog.join('\n') + '\n');
    console.log('\n=== Step 2 Complete ===');
    console.log(timingLog.join('\n'));
}

main().catch(console.error);
