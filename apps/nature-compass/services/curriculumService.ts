// Curriculum generation (EN + CN) and location suggestions

import { Curriculum } from "../types";
import { createAIClient, retryAICall as retryOperation } from '@pathway/ai';
import { locationSuggestionSchema, curriculumResponseSchema } from './gemini/curriculumSchemas';

export const suggestLocations = async (city: string, theme?: string): Promise<string[]> => {
    const ai = createAIClient();
    const themeContext = theme
        ? `The workshop theme is "${theme}". Prioritize locations that are especially relevant to this theme (e.g., ecology/nature 閳?parks, botanical gardens, wetlands; history 閳?museums, historic sites; space/science 閳?science museums, planetariums; water 閳?rivers, lakes, aquariums). Still include a mix of general outdoor STEAM locations.`
        : '';
    return await retryOperation(async () => {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `List 10 well-known outdoor locations in ${city} that are suitable for STEAM education activities with K-12 students. ${themeContext} Include parks, lakes, botanical gardens, science museums, nature reserves, wetlands, riverside areas, etc. Only return locations that actually exist in ${city}. Use the local language name for each location.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: locationSuggestionSchema
            }
        });

        const text = response.text;
        if (!text) throw new Error("AI returned an empty response.");
        const parsed = JSON.parse(text);
        return parsed.locations || [];
    });
};

export const generateCurriculum = async (
    ageGroup: string, englishLevel: string, lessonCount: number,
    duration: string, preferredLocation: string, customTheme: string,
    city: string = "Wuhan", pdfText?: string, mode?: 'school' | 'family', familyEslEnabled?: boolean, customDescription?: string
): Promise<Curriculum> => {
    const ai = createAIClient();
    const truncatedPdf = pdfText ? pdfText.slice(0, 30000) : '';

    const pdfSection = truncatedPdf ? `

    === UPLOADED REFERENCE DOCUMENT ===
    ${truncatedPdf}
    === END OF DOCUMENT ===

    IMPORTANT: You MUST analyze the uploaded document above and design the curriculum based on its content.
    - Split the document's topics, chapters, or key concepts into exactly ${lessonCount} progressive outdoor STEAM lessons.
    - Each lesson should cover a specific section or theme from the document.
    - Adapt the document's content into hands-on outdoor and STEAM activities.
    ` : '';

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
    1. ${truncatedPdf ? 'The curriculum MUST be based on the uploaded reference document above.' : `The curriculum should be strictly centered around the theme: "${customTheme || "General STEAM Exploration"}".`}
    2. It should have exactly ${lessonCount} progressive lessons.
    3. Locations must be real, well-known urban wetlands/parks in ${city}. Suggest incorporating local ${city} culture, wetland facts, or ecological characteristics where relevant.
    4. Each lesson must explicitly embed Technology (e.g., mobile phone identification apps, free measurement apps, online map tools) and Mathematics (e.g., measuring, estimating, data charting). For ages 10-12, heavily emphasize student-led inquiry, problem-solving, and deep integration of freely available digital tools.
    5. Each lesson must explicitly balance Art integration (aesthetics, design) within the STEAM framework.
    ${mode === 'family' && !familyEslEnabled
                    ? '6. This is a pure exploration curriculum 閳?do NOT include any ESL focus, English vocabulary, or language teaching objectives. Set esl_focus to "" and english_vocabulary to [].'
                    : `6. Each lesson must include ${mode === 'family' && familyEslEnabled ? 'light, incidental English exposure moments 閳?just a few simple English words per activity phase as fun discoveries, NOT formal ESL teaching. Keep esl_focus brief and english_vocabulary to 3-5 very basic words per lesson.' : `a specific, explicit, and actionable ESL focus. Strictly control vocabulary difficulty according to the ${englishLevel} CEFR level, ensuring adequate language scaffolds.`}`}
    7. Each lesson must have a complete "Rainy Day" indoor alternative. This alternative MUST retain the identical learning goals and STEAM principles as the outdoor version, using indoor experiments, models, or natural specimens.
    8. Activities should be rich and detailed, specifically designed to fill the ${duration} time slot. If duration is 180 minutes or longer, explicitly include break times, team-building warm-ups, and clear segmenting to avoid cognitive overload, especially for ages 6-8.
    9. Each lesson should suggest a pre-class warm-up activity and a post-class extension activity.
    10. The tone should be professional, educational, and inspiring.
    11. [EASY MATERIALS ONLY] All supplies and materials must be everyday items easily found at home, a convenience store, or the natural environment (magnifying glass, notebook, colored pencils, ziplock bags, string, recycled bottles, phone apps, etc.). Absolutely NO 3D printers, professional sensors, drones, expensive lab kits, or specialty online-order materials.
    12. [LANGUAGE] ALL output content 閳?theme, overview, lesson titles, descriptions, activities, vocabulary 閳?MUST be written entirely in English. Even if the theme or city name is in Chinese, translate it and write everything in English.
    ${mode === 'family' ? `13. [FAMILY MODE] This curriculum is for parent-child family activities (1-3 children + 1-2 parents, NOT a school class).
    - All activities must work for a small family group without a teacher. No team roles, group management, or classroom logistics.
    - Emphasize parent-child bonding, shared discovery, conversation starters, and co-learning moments.
    - Replace teacher instructions with simple, friendly parent guidance ("Ask your child...", "Together, try...").
    - Materials must be minimal and easily carried in a backpack.
    - Activities should feel like adventures, not lessons. Tone: warm, inviting, accessible to non-educator parents.
    - Student count is 1-3 children; do NOT design for large groups.
    ${familyEslEnabled ? `- [ENGLISH EXPLORATION MODE 閳?KEEP IT SIMPLE] IMPORTANT: Chinese parents may have limited English proficiency.
    - Each phase teaches only 2-3 basic English words/phrases (1-4 words max) with Chinese translation
    - Provide ready-to-read sentences parents can say directly (e.g., "Let's say: 'red flower' (缁俱垼澹婇惃鍕С)")
    - English is a FUN BONUS during exploration (max 10% of activity time), NOT the teaching focus
    - NO formal ESL techniques (no TPR, no drills, no grammar)
    - ESL focus and vocabulary fields MUST be filled but keep content simple and practical` : `- [PURE EXPLORATION MODE] Do NOT include any ESL or English teaching. Set esl_focus to "" and english_vocabulary to [].`}` : ''}`,
            config: {
                responseMimeType: "application/json",
                responseSchema: curriculumResponseSchema
            }
        });

        const text = response.text;
        if (!text) throw new Error("The AI returned an empty response.");
        return JSON.parse(text) as Curriculum;
    });
};

// ===== Chinese-only STEAM Curriculum (no ESL) =====
export const generateCurriculumCN = async (
    ageGroup: string, lessonCount: number,
    duration: string, preferredLocation: string, customTheme: string,
    city: string = "Wuhan", pdfText?: string, mode?: 'school' | 'family', familyEslEnabled?: boolean, customDescription?: string
): Promise<Curriculum> => {
    const ai = createAIClient();
    const truncatedPdf = pdfText ? pdfText.slice(0, 30000) : '';

    const pdfSection = truncatedPdf ? `

    === 上传参考文档 ===
    ${truncatedPdf}
    === 文档结束 ===

    重要：请基于上述文档内容拆分并设计课程。
    - 将文档主题拆分为恰好 ${lessonCount} 节循序渐进课程。
    - 每节课对应文档中的具体章节/主题。
    - 转化为可执行的户外 STEAM 实践活动。
    ` : '';

    return await retryOperation(async () => {
        const systemInstruction = `你是一名中文 STEAM 课程设计专家，请为 ${city} 设计课程。
要求：
1. ${truncatedPdf ? '课程必须基于上传文档。' : '课程必须围绕指定主题。'}
2. 必须包含恰好 ${lessonCount} 节课，每节 ${duration}。
3. 地点应为 ${city} 真实可达的城市公园/湿地/科普场馆。
4. 每节课必须显式体现 Technology 与 Mathematics，同时保留 Art 融合。
5. 必须提供雨天室内替代方案，且学习目标与户外一致。
6. 输出使用简体中文。
7. 若为家庭模式，活动需适配 1-3 个孩子 + 家长的小规模场景，语言更亲切易执行。
8. ${mode === 'family' && familyEslEnabled
                ? '可加入少量超基础英语词汇（每课 3-5 个），仅作探索彩蛋。'
                : '不包含英语教学；esl_focus 置空，english_vocabulary 置空数组。'}
9. 可用材料限制：仅使用家庭/便利店/自然环境中易获得的低成本材料。`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `请生成课程大纲：
主题: ${customTheme || "综合 STEAM 探索"}
${customDescription ? `补充说明: ${customDescription}` : ''}
年龄段: ${ageGroup}
课时数量: ${lessonCount}
每课时长: ${duration}
${preferredLocation ? `优先地点: ${preferredLocation}` : ''}
${pdfSection}`,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: curriculumResponseSchema
            }
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
