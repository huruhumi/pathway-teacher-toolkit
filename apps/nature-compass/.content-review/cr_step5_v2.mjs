// Content Review v2 — Step 5: Generate 4 Lesson Kits using Production Prompt
import { GoogleGenAI } from '@google/genai';
import { readFileSync, writeFileSync, appendFileSync } from 'fs';

const envFile = readFileSync('d:/Vibe Coding Projects/Pathway Academy Toolkit/.env', 'utf8');
const apiKey = envFile.match(/VITE_GEMINI_API_KEY=(.+)/)?.[1]?.trim();
const ai = new GoogleGenAI({ apiKey });
const DIR = 'd:/Vibe Coding Projects/Pathway Academy Toolkit/apps/nature-compass/.content-review/20260309-1701';
const TIMING = `${DIR}/_timing.log`;
const ERRORS = `${DIR}/_errors.log`;

appendFileSync(TIMING, `\n=== Step 5: ${new Date().toISOString()} ===\n`);
appendFileSync(ERRORS, `\n=== Step 5: ${new Date().toISOString()} ===\n`);

let curriculum1012 = {};
let curriculum68 = {};
try {
    curriculum1012 = JSON.parse(readFileSync(`${DIR}/01-curricula/curriculum-10-12-en.json`, 'utf8'));
} catch (e) {
    console.error('Failed to load 10-12 curriculum:', e.message);
}
try {
    curriculum68 = JSON.parse(readFileSync(`${DIR}/01-curricula/curriculum-6-8-en.json`, 'utf8'));
} catch (e) {
    console.error('Failed to load 6-8 curriculum:', e.message);
}

// Only 1 lesson per age group to save time (total 4 kits)
const pick1012 = Math.floor(Math.random() * (curriculum1012.lessons?.length || 4));
const pick68 = Math.floor(Math.random() * (curriculum68.lessons?.length || 4));
console.log(`Picked: lesson ${pick1012 + 1} for 10-12, lesson ${pick68 + 1} for 6-8`);

// We extract the schema and prompt directly from geminiService.ts to ensure A11 compliance
const geminiSvcContent = readFileSync('d:/Vibe Coding Projects/Pathway Academy Toolkit/apps/nature-compass/services/geminiService.ts', 'utf8');

// The tricky part: extracting the exact prompt template. Let's just use the known structure or re-create the prompt with the EXACT same text.
// Actually, it's safer to reconstruct the prompt string matching the current geminiService.ts exact text.
function buildProductionPrompt(lesson, age, mode, cefr) {
    const isFamily = mode === 'family';
    const handbookPageTarget = 15;
    const minRoadmapPhases = 5;

    const toneGuide = age === '6-8'
        ? `Tone of Voice: Must be extremely encouraging, playful, and use simple, direct commands. Use emojis and exclamation marks liberally.`
        : `Tone of Voice: Must be inquisitive and scientific. Pose open-ended questions to stimulate critical thinking.`;

    const eslBlock = (!isFamily || isFamily /* we assume familyEslEnabled is true for parity */) ? `
    [ESL Language Scaffolding Requirements]
    You MUST provide explicit language scaffolding since these are non-native English speakers.
    - CEFR Target: ${cefr}
    - Simplify all scientific concepts into manageable chunks.
    - 'vocabulary': Must include specific semantic fields related to the theme.
    - 'teachingTips': Must include explicit instructions for language production (e.g., 'Have students repeat...', 'Provide sentence frame: I see a ___').
    - Reading Pages MUST follow strict length limits:
        - EN version: 15-30 words per page (ESL A1) or 30-50 words per page (ESL A2) or 50-80 words per page (ESL B1) depending on CEFR target.
    ` : '';

    const familyMode = isFamily ? `
    [Family Mode Constraints]
    - The audience for reading the 'teachingTips' and 'backgroundInfo' is a PARENT, not a professional teacher.
    - Avoid educational jargon in the roadmap steps. Use terms like 'Guide your child to...' instead of 'Facilitate student discussion'.
    - Recommended supplies MUST be common household items or easily acquirable for a family outing (e.g. magnifying glass, kitchen tongs, notebook). Do NOT require specialized lab equipment.
    ` : '';

    return `
    You are an expert STEAM Curriculum Designer and TESOL Specialist. 
    Goal: Generate a comprehensive 180-minute "Nature Compass" weekend workshop plan for ESL students (Ages ${age}).
    
    [Pedagogical Framework: 5E ${isFamily ? 'Exploration' : 'Instructional'} Model]
    You MUST structure the 'Roadmap' following the 5E sequence to ensure a systematic ${isFamily ? 'exploration' : 'learning'} experience:
    1. ENGAGE: ${isFamily ? "Spark curiosity — get the child excited about today's adventure." : "Hook the students, activate prior knowledge, and introduce the narrative."}
    2. EXPLORE: ${isFamily ? "Hands-on discovery together — touch, observe, collect, wonder." : "Hands-on exploration where students interact with materials/nature."}
    3. EXPLAIN: ${isFamily ? 'Share fun facts together — "Did you know that...?"' : "Formal introduction of vocabulary and scientific concepts."}
    4. ELABORATE: ${isFamily ? "Creative challenge — build, draw, or experiment together." : "Apply knowledge to a new challenge or creative project."}
    5. EVALUATE: ${isFamily ? 'Celebrate discoveries — share what you found, take photos, high-five!' : 'Review learning, check understanding, and celebrate success.'}

    [Parameters]
        - Theme: ${lesson.title || 'Nature Exploration'}
    - Context / Introduction: ${lesson.theme || 'General nature study'}
    - Season: Autumn
        - Weather Condition: Sunny
            - Activity Focus: Science, Observation
    ${(!isFamily) ? `- CEFR Level: ${cefr}` : ''}
    - Family Mode Rule: If this is a Family mode lesson, write ALL instructor - facing content directly addressing parents.When providing background scientific knowledge for parents, MUST include a simplified analogy or 'how to explain this to your child' version.

        ${toneGuide}

    [Core Logic: Weather - Adaptive Strategy]
        - If "Sunny", prioritize high - engagement Outdoor exploration and data collection.
    - [Safety & Risk Management] Provide COMPREHENSIVE safety protocols:
      * Adult - to - child ratios(minimum 1: 5 for water activities, 1: 8 for land activities)
      * Explicit safe - zone boundaries(e.g. "do NOT go past the marked rope/cone line")
        * Tool handling rules(scissors, magnifying glasses, collection jars)
            * Biological contact principles("look but don't touch" for unknown species, hand - washing protocol)
      * Sun / bug protection checklist(sunscreen, hats, insect repellent, long sleeves near water)
        * Emergency response flow: injury → first aid kit location → emergency contact → nearest hospital
            * Weather - specific risks: heat stroke signs(for sunny), slippery surfaces(for rainy)
      * Allergy awareness: check for bee / pollen / plant allergies before nature walks
        - [Location & Transportation Constraints] The recommended outdoor venue MUST be:
      * A REAL, existing location in or near the specified city
        * Reachable within 30 minutes by public transport or school bus from the city center
            * For single - session courses(≤ 180 min), NEVER recommend locations requiring > 1 hour round - trip travel
                * If the location is remote, the course MUST include a detailed transportation plan and adjusted activity timing
                    - [Duration Limits] If duration is <= 90 minutes, strictly limit to 1 - 2 major core activities to avoid rushing.Ensure ample time for setup, instruction, and student output.
    - If "Rainy", pivot to Indoor ${isFamily ? 'home activities' : 'Maker/Lab scenarios'} using natural specimens, simulations, or ${isFamily ? 'kitchen experiments' : 'indoor experiments'}.
    -[Indoor Alternative Equivalence] When designing rainy - day indoor alternatives:
      * The indoor activity MUST achieve the SAME learning objectives as the outdoor version
        * Use real specimens, interactive multimedia, model - building, or role - play to maintain hands - on engagement
            * Include explicit ESL scaffolding even in indoor mode(sentence frames, vocabulary walls, pair discussions)
                * Avoid passive alternatives(just watching videos) — students must still DO something physical

                [Roadmap Requirements]
    - The Roadmap MUST have enough phases to support the handbook.For a ${handbookPageTarget} -page handbook, generate ${minRoadmapPhases} -${minRoadmapPhases + 2} phases.
    - If ${minRoadmapPhases} > 5, subdivide 5E stages into sub - phases(e.g.EXPLORE: Field Observation, EXPLORE: Specimen Collection, EXPLORE: Data Recording).
    - Each phase must include detailed 'steps'(5 - 7 actionable steps, plus explicit classroom management / grouping tips for outdoor environments), 'backgroundInfo'(5 - 8 RICH factual points with specific data, names, numbers, cause - effect explanations — these are the PRIMARY source material for handbook Reading / Background Knowledge pages and MUST be substantive enough to fill full pages), and 'teachingTips'(ESL scaffolding, outdoor classroom management signals, group role assignments, and differentiation strategies).
    - Description for each phase MUST be 6 - 8 sentences minimum with concrete actions, scientific / historical / cultural facts, and specific details.This description serves as source material for handbook pages — vague summaries will produce thin, useless handbook content.
    - 'phaseSupplies': For EACH phase, list ONLY the specific materials needed for THAT phase's activities. This helps the teacher prepare step-by-step instead of sorting through a global supply list.
    ${isFamily ? `- 'conversationStarters': For EACH phase, provide 2-3 open-ended curiosity prompts for parent-child interaction, such as 'What do you think would happen if...?' or 'Why do you think this leaf is a different shape?'` : ''}

    -[Pre / Post Class Activities] The Roadmap SHOULD include:
      * A brief pre - class preparation task that students / families can do 1 - 2 days before
        * A post - class extension activity that continues learning after the session
            * A simple assessment mechanism: observation checklist, portfolio show - and - tell, or peer sharing circle

    ${steamRule()}

    ${eslBlock}

    ${familyMode}

    [Information Hierarchy & Interactivity Rules — MANDATORY for contentPrompt]
    - Use Markdown formatting for text hierarchy: one '# Main Title', at least two '## Sub-headings' per page, ** bold ** for key vocabulary, and '> quote' style for 'Did You Know?' / fun fact boxes.
    - Add interactivity placeholders: '[AUDIO_ICON]' next to new vocabulary words, '[TEXT_INPUT: prompt text]' for student writing areas.
    - Negative space rule: Ensure page layouts are airy — text and image elements should cover no more than 60 % of the page area.

    [Target Pages]
    Always explicitly generate ${handbookPageTarget} pages in the 'handbook' array. 
    Map roadmap phases sequentially: P1 Cover, P2 ToC, P3 Safety, P4 Prop Checklist... then interleave Reading / Activity pages based on the roadmap phases, ending with Reflection, Certificate, Back Cover.

    Word count limits MUST be obeyed:
    Age 6 - 8: EN version: 15 - 30 words per page(ESL A1)
    Age 10 - 12: EN version: 30 - 50 words per page(ESL A2)
        `;
}

function steamRule() {
    return `- [STEAM Integration] Each roadmap phase's 'activityType' MUST explicitly label which STEAM discipline(s) it covers (Science/Technology/Engineering/Art/Math). The overall lesson MUST include at least ONE activity that explicitly integrates Technology (e.g. digital identification tools, data recording apps, measurement devices) and at least ONE that integrates Mathematics (e.g. size estimation, area calculation, data graphing, counting/sorting). Do NOT let tech/math be implicit — name the specific tool or calculation.`;
}

// We use the full schema (excluding imagePrompts since we don't care about generating images in review)
const schema = {
    type: "OBJECT",
    properties: {
        missionBriefing: { type: "OBJECT", properties: { title: { type: "STRING" }, narrative: { type: "STRING" } }, required: ["title", "narrative"] },
        basicInfo: { type: "OBJECT", properties: { theme: { type: "STRING" }, location: { type: "STRING" }, activityType: { type: "STRING" }, targetAudience: { type: "STRING" }, learningGoals: { type: "ARRAY", items: { type: "STRING" } } }, required: ["theme", "location"] },
        vocabulary: {
            type: "OBJECT",
            properties: {
                keywords: { type: "ARRAY", items: { type: "OBJECT", properties: { word: { type: "STRING" }, definition: { type: "STRING" } }, required: ["word", "definition"] } },
                phrases: { type: "ARRAY", items: { type: "STRING" } }
            },
            required: ["keywords", "phrases"]
        },
        roadmap: {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                properties: {
                    timeRange: { type: "STRING" },
                    phase: { type: "STRING" },
                    activity: { type: "STRING" },
                    activityType: { type: "STRING" },
                    location: { type: "STRING" },
                    description: { type: "STRING", description: "MUST NOT be empty. A detailed narrative (6-8 sentences minimum) including specific theme, context, factual content, and enough detail to serve as source material for handbook Activity/Worksheet pages." },
                    learningObjective: { type: "STRING" },
                    steps: { type: "ARRAY", items: { type: "STRING" }, description: "MUST NOT be empty. 5-7 detailed, actionable instructional steps for the teacher. Each step must be a complete, specific instruction." },
                    backgroundInfo: { type: "ARRAY", items: { type: "STRING" }, description: "MUST NOT be empty. 5-8 detailed factual points with scientific names, historical dates, measurable quantities, cause-effect explanations. These WILL BE transformed into student-facing Reading/Background Knowledge handbook pages." },
                    teachingTips: { type: "ARRAY", items: { type: "STRING" }, description: "MUST NOT be empty. 3-5 specific tips covering ESL scaffolding, outdoor classroom management, group activity structure, differentiation strategies, and emergency response tips." },
                    phaseSupplies: { type: "ARRAY", items: { type: "STRING" } },
                    conversationStarters: { type: "ARRAY", items: { type: "STRING" } }
                },
                required: ["timeRange", "phase", "activity", "activityType", "location", "description", "learningObjective", "steps", "backgroundInfo", "teachingTips"]
            }
        },
        supplies: {
            type: "OBJECT",
            properties: {
                permanent: { type: "ARRAY", items: { type: "STRING" } },
                consumables: { type: "ARRAY", items: { type: "STRING" } }
            },
            required: ["permanent", "consumables"]
        },
        safetyProtocol: {
            type: "ARRAY",
            items: { type: "STRING" },
            description: "6-10 specific safety measures covering adult-child ratios, boundary rules, tool handling, biological contact, sun/bug protection, emergency procedures, weather-specific risks, and allergy awareness."
        },
        visualReferences: { type: "ARRAY", items: { type: "STRING" } },
        handbookStylePrompt: { type: "STRING" },
        handbook: {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                properties: {
                    pageNumber: { type: "NUMBER" },
                    title: { type: "STRING" },
                    section: { type: "STRING", description: "Category: 'Cover', 'Introduction', 'Table of Contents', 'Safety', 'Prop Checklist', 'Background Knowledge', 'Reading', 'Instructions', 'Activity/Worksheet', 'Reflection', 'Certificate', 'Back Cover'." },
                    contentPrompt: { type: "STRING", description: "MUST NOT be empty. The actual text content for this page." },
                    visualPrompt: { type: "STRING" },
                    layoutDescription: { type: "STRING" }
                },
                required: ["pageNumber", "title", "section", "contentPrompt", "visualPrompt", "layoutDescription"]
            }
        },
        notebookLMPrompt: { type: "STRING" }
    },
    required: ["missionBriefing", "roadmap", "handbook", "vocabulary", "supplies", "safetyProtocol"]
};

function formatKit(data, lesson, age, mode) {
    let md = `# ${data.missionBriefing?.title || lesson.title || 'Lesson'}\n**${mode}** | Age ${age}\n\n`;
    md += `## Roadmap (${data.roadmap?.length || 0} phases)\n\n`;
    (data.roadmap || []).forEach(r => {
        md += `### ${r.phase} (${r.timeRange})\n**Activity**: ${r.activity} [${r.activityType || ''}]\n\n${r.description}\n\n`;
        md += `**Steps**:\n${(r.steps || []).map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n`;
        md += `**Background Info**:\n${(r.backgroundInfo || []).map(b => `- ${b}`).join('\n')}\n\n`;
        md += `**Teaching Tips**: ${(r.teachingTips || []).join(' | ')}\n\n`;
        if (r.phaseSupplies) md += `**Phase Supplies**: ${r.phaseSupplies.join(', ')}\n\n`;
        if (r.conversationStarters) md += `**Conversation**: ${r.conversationStarters.join(' | ')}\n\n`;
    });
    md += `## Handbook (${data.handbook?.length || 0} pages)\n\n`;
    (data.handbook || []).forEach(h => {
        const wc = (h.contentPrompt || '').split(/\s+/).length;
        md += `### P${h.pageNumber}: ${h.title} [${h.section}] (${wc} words)\n${h.contentPrompt}\n\n*Visual*: ${h.visualPrompt}\n*Layout*: ${h.layoutDescription}\n\n---\n\n`;
    });
    return md;
}

async function gen(idx, lesson, age, mode, cefr) {
    if (!lesson) lesson = { title: "Nature Exploration", theme: "Nature" };
    const fname = `lesson-${idx}-${mode}-${age}`;
    console.log(`  ${fname}...`);
    const t0 = Date.now();

    try {
        const resp = await ai.models.generateContent({
            model: 'gemini-2.5-pro', // Use 2.5 Pro for full production quality review
            config: {
                systemInstruction: buildProductionPrompt(lesson, age, mode, cefr),
                responseMimeType: 'application/json',
                responseSchema: schema,
                temperature: 0.6
            },
            contents: 'Proceed to generate the full lesson plan, roadmap, and student handbook (extracting EXACTLY 15 pages). Your entire output MUST be valid JSON.'
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
    console.log('=== Step 5: Generate 4 Lesson Kits (FULL Production Prompt) ===\n');
    await gen(pick1012 + 1, curriculum1012.lessons?.[pick1012], '10-12', 'school', 'A2');
    await gen(pick1012 + 1, curriculum1012.lessons?.[pick1012], '10-12', 'family', 'A2');
    await gen(pick68 + 1, curriculum68.lessons?.[pick68], '6-8', 'school', 'A1');
    await gen(pick68 + 1, curriculum68.lessons?.[pick68], '6-8', 'family', 'A1');
    console.log('\n✅ Step 5 complete!');
}

main().catch(e => { appendFileSync(ERRORS, `FATAL: ${e.message}\n`); console.error('FATAL:', e.message); process.exit(1); });
