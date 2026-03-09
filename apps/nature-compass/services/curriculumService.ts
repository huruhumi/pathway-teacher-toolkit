// Curriculum generation (EN + CN) and location suggestions

import { Type } from "@google/genai";
import { Curriculum } from "../types";
import { createAIClient } from '@shared/ai/client';
import { retryOperation } from './geminiService';

export const suggestLocations = async (city: string, theme?: string): Promise<string[]> => {
    const ai = createAIClient();
    const themeContext = theme
        ? `The workshop theme is "${theme}". Prioritize locations that are especially relevant to this theme (e.g., ecology/nature → parks, botanical gardens, wetlands; history → museums, historic sites; space/science → science museums, planetariums; water → rivers, lakes, aquariums). Still include a mix of general outdoor STEAM locations.`
        : '';
    return await retryOperation(async () => {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `List 10 well-known outdoor locations in ${city} that are suitable for STEAM education activities with K-12 students. ${themeContext} Include parks, lakes, botanical gardens, science museums, nature reserves, wetlands, riverside areas, etc. Only return locations that actually exist in ${city}. Use the local language name for each location.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        locations: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        }
                    },
                    required: ["locations"]
                }
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
    city: string = "Wuhan", pdfText?: string
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
    4. Each lesson must explicitly embed Technology (e.g., citizen science apps, digital sensors, GIS) and Mathematics (e.g., measuring, estimating, data charting). For ages 10-12, heavily emphasize student-led inquiry, problem-solving, and deep integration of digital technology.
    5. Each lesson must explicitly balance Art integration (aesthetics, design) within the STEAM framework.
    6. Each lesson must include a specific, explicit, and actionable ESL focus. Strictly control vocabulary difficulty according to the ${englishLevel} CEFR level, ensuring adequate language scaffolds.
    7. Each lesson must have a complete "Rainy Day" indoor alternative. This alternative MUST retain the identical learning goals and STEAM principles as the outdoor version, using indoor experiments, models, or natural specimens.
    8. Activities should be rich and detailed, specifically designed to fill the ${duration} time slot. If duration is 180 minutes or longer, explicitly include break times, team-building warm-ups, and clear segmenting to avoid cognitive overload, especially for ages 6-8.
    9. Each lesson should suggest a pre-class warm-up activity and a post-class extension activity.
    10. The tone should be professional, educational, and inspiring.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        theme: { type: Type.STRING },
                        overview: { type: Type.STRING },
                        lessons: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    title: { type: Type.STRING },
                                    description: { type: Type.STRING },
                                    steam_focus: { type: Type.STRING },
                                    esl_focus: { type: Type.STRING },
                                    location: { type: Type.STRING },
                                    outdoor_activity: { type: Type.STRING },
                                    indoor_alternative: { type: Type.STRING },
                                    english_vocabulary: {
                                        type: Type.ARRAY,
                                        items: { type: Type.STRING }
                                    }
                                },
                                required: ["title", "description", "steam_focus", "esl_focus", "location", "outdoor_activity", "indoor_alternative", "english_vocabulary"]
                            }
                        }
                    },
                    required: ["theme", "overview", "lessons"]
                }
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
    city: string = "Wuhan", pdfText?: string
): Promise<Curriculum> => {
    const ai = createAIClient();
    const truncatedPdf = pdfText ? pdfText.slice(0, 30000) : '';

    const pdfSection = truncatedPdf ? `

    === 上传的参考文档 ===
    ${truncatedPdf}
    === 文档结束 ===

    重要：你必须分析上述文档内容，并基于文档设计课程大纲。
    - 将文档的主题、章节或核心概念拆分为恰好${lessonCount}节循序渐进的STEAM户外课程。
    - 每节课应涵盖文档中的特定章节或主题。
    - 将文档内容改编为动手实践的户外STEAM活动。
    ` : '';

    return await retryOperation(async () => {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `请为${city}的学生设计一套系统化的STEAM户外课程。全部内容必须用中文回答。

    主题: ${customTheme || "综合STEAM探索"}
    年龄段: ${ageGroup}
    课时数量: ${lessonCount}
    每课时长: ${duration}
    ${preferredLocation ? `首选地点/区域: ${preferredLocation}` : ''}
    ${pdfSection}
    要求:
    1. ${truncatedPdf ? '课程必须基于上述参考文档内容设计。' : `课程必须严格围绕主题"${customTheme || "综合STEAM探索"}"展开。`}
    2. 必须包含恰好${lessonCount}节循序渐进的课。
    3. 地点必须是${city}真实存在的、知名的且交通便利的城市湿地/公园。建议视情况融入${city}当地文化、湿地特色或地方生态特征。
    4. 每节课必须显性且具体地融入科技（Technology，如智能识别工具、数字传感器、GIS）和数学（Mathematics，如尺寸估算、面积计算、数据分析）。针对10-12岁，需重度融合数字科技应用及以学生为主导的探究式问题解决环节。
    5. 每节课必须在STEAM框架下明确且平衡地融入艺术（Art，审美与设计）元素。
    6. 必须提供具体、可执行的“雨天室内替代活动”。该方案必须保留与户外活动完全相同的学习目标和STEAM核心原则（可通过室内实验、模型制作或标本观察实现）。
    7. 活动内容要丰富详细，专门设计以填满${duration}的时间安排。若时长达到180分钟及以上，必须明确划分环节、包含课前破冰和中场休息时间，以降低认知负荷（特别是针对6-8岁）。
    8. 每节课应设计课前预热活动和课后延伸探索任务。
    9. 语气应专业、教育性强、鼓舞人心。所有内容必须用纯中文书写，绝不能包含任何英语教学目标或英文要求。
    10. esl_focus字段请填写空字符串""，english_vocabulary请填写空数组[]。`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        theme: { type: Type.STRING },
                        overview: { type: Type.STRING },
                        lessons: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    title: { type: Type.STRING },
                                    description: { type: Type.STRING },
                                    steam_focus: { type: Type.STRING },
                                    esl_focus: { type: Type.STRING },
                                    location: { type: Type.STRING },
                                    outdoor_activity: { type: Type.STRING },
                                    indoor_alternative: { type: Type.STRING },
                                    english_vocabulary: {
                                        type: Type.ARRAY,
                                        items: { type: Type.STRING }
                                    }
                                },
                                required: ["title", "description", "steam_focus", "esl_focus", "location", "outdoor_activity", "indoor_alternative", "english_vocabulary"]
                            }
                        }
                    },
                    required: ["theme", "overview", "lessons"]
                }
            }
        });

        const text = response.text;
        if (!text) throw new Error("AI返回了空响应。");
        return JSON.parse(text) as Curriculum;
    });
};
