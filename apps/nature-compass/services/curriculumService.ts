// Curriculum generation (EN + CN) and location suggestions

import { Curriculum } from "../types";
import { createAIClient, retryAICall as retryOperation } from '@pathway/ai';
import { locationSuggestionSchema, curriculumResponseSchema } from './gemini/curriculumSchemas';

export const suggestLocations = async (city: string, theme?: string): Promise<string[]> => {
    const ai = createAIClient();
    const themeContext = theme
        ? `The workshop theme is "${theme}". Prioritize locations relevant to this theme (e.g., nature parks, botanical gardens, wetlands, museums, science centers, rivers, lakes), while still keeping variety.`
        : '';

    return await retryOperation(async () => {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `List 10 real outdoor or field-study locations in ${city} suitable for K-12 STEAM activities. ${themeContext} Include parks, lakes, botanical gardens, science museums, nature reserves, wetlands, and riverside areas. Return only places that truly exist in ${city}, using local-language place names.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: locationSuggestionSchema,
            },
        });

        const text = response.text;
        if (!text) throw new Error("AI returned an empty response.");
        const parsed = JSON.parse(text);
        return parsed.locations || [];
    });
};

export const generateCurriculum = async (
    ageGroup: string,
    englishLevel: string,
    lessonCount: number,
    duration: string,
    preferredLocation: string,
    customTheme: string,
    city: string = "Wuhan",
    pdfText?: string,
    mode?: 'school' | 'family',
    familyEslEnabled?: boolean,
    customDescription?: string,
): Promise<Curriculum> => {
    const ai = createAIClient();
    const truncatedPdf = pdfText ? pdfText.slice(0, 30000) : '';

    const pdfSection = truncatedPdf
        ? `

=== UPLOADED REFERENCE DOCUMENT ===
${truncatedPdf}
=== END OF DOCUMENT ===

IMPORTANT:
- Use the uploaded document as the primary source for curriculum scope.
- Split document topics into exactly ${lessonCount} progressive lessons.
- Convert document concepts into hands-on outdoor STEAM learning experiences.
`
        : '';

    const modeRules = mode === 'family'
        ? `
6. [FAMILY MODE] Design for 1-3 children with 1-2 parents (not a classroom).
- No teacher-centric logistics, no large-group management language.
- Emphasize parent-child co-exploration, conversation prompts, and shared discovery.
- Activities should feel like guided adventures.
${familyEslEnabled
                ? `- [ENGLISH EXPLORATION] Include only light, incidental English: 3-5 very basic words/phrases per lesson, with Chinese translation and ready-to-read parent lines. Keep this as a bonus, not formal ESL teaching.`
                : `- [PURE EXPLORATION] Do not add formal English learning tasks; keep esl_focus empty and english_vocabulary as [].`}
`
        : `
6. [SCHOOL MODE] Each lesson must include a specific, actionable ESL focus aligned to CEFR ${englishLevel}, with practical language scaffolds in activities.
`;

    return await retryOperation(async () => {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Design a systematic STEAM outdoor curriculum for students in ${city}.
Theme: ${customTheme || "General STEAM Exploration"}
${customDescription ? `Additional Context / Requirements: ${customDescription}` : ''}
Age Group: ${ageGroup}
English Level: ${englishLevel}
Number of Lessons: ${lessonCount}
Duration per Lesson: ${duration}
${preferredLocation ? `Preferred Location/Area: ${preferredLocation}` : ''}
${pdfSection}

Requirements:
1. ${truncatedPdf ? 'Curriculum MUST be grounded in the uploaded reference document.' : `Curriculum should stay centered on the theme "${customTheme || "General STEAM Exploration"}".`}
2. Exactly ${lessonCount} progressive lessons.
3. Locations must be real, reachable, and appropriate in/near ${city}; include local ecological/cultural context when useful.
4. Every lesson must explicitly include Technology and Mathematics in the activity design.
5. Every lesson must include Art integration (aesthetics/design expression) within STEAM.
${modeRules}
7. Every lesson must have a rainy-day indoor alternative with equivalent learning goals and STEAM depth.
8. Activities must be detailed enough to fill ${duration} minutes; if duration >= 180, include break and pacing segmentation.
9. Each lesson should include a pre-class warm-up and post-class extension task.
10. [EASY MATERIALS ONLY] Use low-cost, easy-to-find daily materials. No specialized expensive equipment.
11. [LANGUAGE] All output must be in English.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: curriculumResponseSchema,
            },
        });

        const text = response.text;
        if (!text) throw new Error("The AI returned an empty response.");
        return JSON.parse(text) as Curriculum;
    });
};

// Chinese-first curriculum generation (still mode-aware)
export const generateCurriculumCN = async (
    ageGroup: string,
    lessonCount: number,
    duration: string,
    preferredLocation: string,
    customTheme: string,
    city: string = "Wuhan",
    pdfText?: string,
    mode?: 'school' | 'family',
    familyEslEnabled?: boolean,
    customDescription?: string,
): Promise<Curriculum> => {
    const ai = createAIClient();
    const truncatedPdf = pdfText ? pdfText.slice(0, 30000) : '';

    const pdfSection = truncatedPdf
        ? `

=== UPLOADED REFERENCE DOCUMENT ===
${truncatedPdf}
=== END OF DOCUMENT ===

IMPORTANT:
- Build the curriculum from the uploaded document.
- Split source topics into exactly ${lessonCount} progressive lessons.
- Transform source concepts into practical outdoor STEAM tasks.
`
        : '';

    const modeRules = mode === 'family'
        ? `
6. [家庭模式] 适配 1-3 名孩子 + 1-2 名家长的小规模活动，不写课堂管理语言。
7. 强化亲子共学、共同探索与对话提示。
${familyEslEnabled
                ? `8. [英语探索] 每课仅保留 3-5 个超基础词汇，配中文释义，作为轻量彩蛋，不做正式英语教学。`
                : `8. [纯探索] 不做英语教学；esl_focus 置空，english_vocabulary 置空数组。`}
`
        : `
6. [学校模式] 面向班级教学，结构清晰、可执行，强调课堂可落地性。
7. 允许包含学科语言支持，但重点仍是 STEAM 实践。`;

    const systemInstruction = `You are a curriculum designer for Nature Compass.
Output language must be Simplified Chinese.
Return JSON matching the schema exactly.`;

    const contents = `请生成自然指南针课程大纲（简体中文）：
主题: ${customTheme || "综合 STEAM 探索"}
${customDescription ? `补充说明: ${customDescription}` : ''}
年龄段: ${ageGroup}
课时数量: ${lessonCount}
每课时长: ${duration}
城市: ${city}
${preferredLocation ? `优先地点: ${preferredLocation}` : ''}
${pdfSection}

要求：
1. ${truncatedPdf ? '课程必须优先依据上传文档。' : '课程需围绕指定主题展开。'}
2. 必须恰好 ${lessonCount} 节课，循序渐进。
3. 每课需给出真实、可达、安全的地点建议。
4. 每课必须显式融合 Technology + Mathematics + Art。
5. 每课必须提供雨天室内等效替代方案，保持学习目标一致。
${modeRules}
9. 活动步骤要具体，能覆盖 ${duration} 分钟的节奏安排。
10. 仅使用低成本、易获得材料。`;

    return await retryOperation(async () => {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: curriculumResponseSchema,
            },
        });

        const text = response.text;
        if (!text) throw new Error("AI returned an empty response.");
        return JSON.parse(text) as Curriculum;
    });
};

// ===== Regenerate APIs moved to sub-module =====
export {
    regenerateCurriculumWithFeedback,
    regenerateSinglePhase,
    regenerateDownstreamFromRoadmap,
} from './gemini/curriculumRegenerate';

