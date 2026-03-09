// Content Review — Step 2: Generate Curricula
// Usage: node /tmp/cr_step2.mjs

import { GoogleGenAI } from '@google/genai';
import { readFileSync, writeFileSync } from 'fs';

// Load API key from .env
const envFile = readFileSync('d:/Vibe Coding Projects/Pathway Academy Toolkit/.env', 'utf8');
const apiKey = envFile.match(/VITE_GEMINI_API_KEY=(.+)/)?.[1]?.trim();
if (!apiKey) { console.error('No API key found'); process.exit(1); }

const ai = new GoogleGenAI({ apiKey });
const REVIEW_DIR = 'd:/Vibe Coding Projects/Pathway Academy Toolkit/apps/nature-compass/.content-review/20260309-0359';

const THEME = '城市湿地生态探索';
const CITY = '武汉';
const LESSON_COUNT = 4;
const DURATION = '90 minutes';

const AGE_GROUPS = [
    { age: '6-8', cefr: 'A1 (Beginner)' },
    { age: '10-12', cefr: 'A2 (Elementary)' },
];

const schema = {
    type: 'OBJECT',
    properties: {
        theme: { type: 'STRING' },
        overview: { type: 'STRING' },
        lessons: {
            type: 'ARRAY',
            items: {
                type: 'OBJECT',
                properties: {
                    title: { type: 'STRING' },
                    description: { type: 'STRING' },
                    steam_focus: { type: 'STRING' },
                    esl_focus: { type: 'STRING' },
                    location: { type: 'STRING' },
                    outdoor_activity: { type: 'STRING' },
                    indoor_alternative: { type: 'STRING' },
                    english_vocabulary: { type: 'ARRAY', items: { type: 'STRING' } }
                },
                required: ['title', 'description', 'steam_focus', 'esl_focus', 'location', 'outdoor_activity', 'indoor_alternative', 'english_vocabulary']
            }
        }
    },
    required: ['theme', 'overview', 'lessons']
};

function formatCurriculum(data, ageGroup, lang) {
    let md = `# Curriculum: ${data.theme} — Age ${ageGroup} (${lang.toUpperCase()})\n\n`;
    md += `## Overview\n${data.overview}\n\n`;
    data.lessons.forEach((l, i) => {
        md += `## Lesson ${i + 1}: ${l.title}\n`;
        md += `- **Description**: ${l.description}\n`;
        md += `- **STEAM Focus**: ${l.steam_focus}\n`;
        if (lang === 'en') md += `- **ESL Focus**: ${l.esl_focus}\n`;
        md += `- **Location**: ${l.location}\n`;
        md += `- **Outdoor Activity**: ${l.outdoor_activity}\n`;
        md += `- **Indoor Alternative**: ${l.indoor_alternative}\n`;
        if (lang === 'en' && l.english_vocabulary?.length) {
            md += `- **Vocabulary**: ${l.english_vocabulary.join(', ')}\n`;
        }
        md += '\n';
    });
    return md;
}

async function generateCurriculum(ageGroup, lang) {
    const isEN = lang === 'en';
    const prompt = isEN
        ? `Design a systematic STEAM outdoor curriculum for students in ${CITY}.
Theme: ${THEME}
Age Group: ${ageGroup}
English Level: ${AGE_GROUPS.find(a => a.age === ageGroup).cefr}
Number of Lessons: ${LESSON_COUNT}
Duration per Lesson: ${DURATION}

Requirements:
1. The curriculum should be strictly centered around the theme: "${THEME}".
2. It should have exactly ${LESSON_COUNT} progressive lessons.
3. Locations must be specific, well-known, and accessible outdoor spots in ${CITY}.
4. Each lesson must include a specific interdisciplinary focus (Biology & Ecology, Physics & Forces, Chemistry & Matter, Engineering & Design, Earth & Space, Math & Logic, Visual Arts, Theater & Drama, Music & Sound, Social Science, Economy & Trade, History & Culture — use multiple per lesson).
5. Each lesson must include a specific, explicit, and actionable ESL focus.
6. Each lesson must have a specific "Rainy Day" indoor alternative activity.
7. Activities should be rich and detailed, specifically designed to fill the ${DURATION} time slot.
8. English vocabulary should match the ${AGE_GROUPS.find(a => a.age === ageGroup).cefr} level.
9. The tone should be professional, educational, and inspiring.`
        : `请为${CITY}的学生设计一套系统化的STEAM户外课程。全部内容必须用中文回答。

主题: ${THEME}
年龄段: ${ageGroup}
课时数量: ${LESSON_COUNT}
每课时长: ${DURATION}

要求:
1. 课程必须严格围绕主题"${THEME}"展开。
2. 必须包含恰好${LESSON_COUNT}节循序渐进的课。
3. 地点必须是${CITY}具体的、知名的、方便到达的户外地点。
4. 每节课必须包含具体的跨学科焦点元素（生物与生态、物理与力学、化学与物质、工程与设计、地球与空间、数学与逻辑、视觉艺术、戏剧与表演、音乐与声音、社会科学、经济与贸易、历史与文化等）。
5. 每节课必须有具体的、可执行的"雨天室内替代活动"。
6. 活动内容要丰富详细，专门设计以填满${DURATION}的时间安排。
7. 语气应专业、教育性强、鼓舞人心。
8. 所有内容必须用中文书写。
9. esl_focus字段请填写空字符串""，english_vocabulary请填写空数组[]。`;

    console.log(`  Generating ${lang.toUpperCase()} curriculum for age ${ageGroup}...`);
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: schema,
            temperature: 0.5,
        }
    });

    const text = response.text;
    if (!text) throw new Error('Empty response');
    const data = JSON.parse(text);

    // Save JSON
    writeFileSync(`${REVIEW_DIR}/01-curricula/curriculum-${ageGroup}-${lang}.json`, JSON.stringify(data, null, 2));
    // Save MD
    const md = formatCurriculum(data, ageGroup, lang);
    writeFileSync(`${REVIEW_DIR}/01-curricula/curriculum-${ageGroup}-${lang}.md`, md);

    console.log(`  ✅ ${lang.toUpperCase()} age ${ageGroup}: ${data.lessons.length} lessons generated`);
    return data;
}

async function main() {
    console.log('=== Step 2: Generate Curricula ===');
    console.log(`Theme: ${THEME}, City: ${CITY}\n`);

    for (const { age } of AGE_GROUPS) {
        await generateCurriculum(age, 'en');
        await new Promise(r => setTimeout(r, 2000));
        await generateCurriculum(age, 'zh');
        await new Promise(r => setTimeout(r, 2000));
    }

    console.log('\n✅ All 4 curricula generated!');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
