// Curriculum generation (EN + CN) and location suggestions

import { GoogleGenAI, Type } from "@google/genai";
import { Curriculum } from "../types";
import { retryOperation } from './geminiService';

export const suggestLocations = async (city: string): Promise<string[]> => {
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
    return await retryOperation(async () => {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `List 8-10 well-known outdoor locations in ${city} that are suitable for STEAM education activities with K-12 students. Include parks, lakes, botanical gardens, science museums, nature reserves, wetlands, riverside areas, etc. Only return locations that actually exist in ${city}. Use the local language name for each location.`,
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
    city: string = "武汉"
): Promise<Curriculum> => {
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
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
    
    Requirements:
    1. The curriculum should be strictly centered around the theme: "${customTheme || "General STEAM Exploration"}".
    2. It should have exactly ${lessonCount} progressive lessons.
    3. Locations must be specific, well-known, and accessible outdoor spots in ${city}. ${preferredLocation ? `Try to focus on or include activities near ${preferredLocation}.` : ''}
    4. Each lesson must include a STEAM focus (Science, Technology, Engineering, Arts, Math).
    5. Each lesson must include a specific, explicit, and actionable ESL focus.
    6. Each lesson must have a specific "Rainy Day" indoor alternative activity.
    7. Activities should be rich and detailed, specifically designed to fill the ${duration} time slot.
    8. English vocabulary and concepts should be integrated based on the provided level.
    9. The tone should be professional, educational, and inspiring.`,
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
    city: string = "武汉"
): Promise<Curriculum> => {
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
    return await retryOperation(async () => {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `请为${city}的学生设计一套系统化的STEAM户外课程。全部内容必须用中文回答。

    主题: ${customTheme || "综合STEAM探索"}
    年龄段: ${ageGroup}
    课时数量: ${lessonCount}
    每课时长: ${duration}
    ${preferredLocation ? `首选地点/区域: ${preferredLocation}` : ''}
    
    要求:
    1. 课程必须严格围绕主题"${customTheme || "综合STEAM探索"}"展开。
    2. 必须包含恰好${lessonCount}节循序渐进的课。
    3. 地点必须是${city}具体的、知名的、方便到达的户外地点。${preferredLocation ? `尽量围绕${preferredLocation}设计活动。` : ''}
    4. 每节课必须包含STEAM要素（科学、技术、工程、艺术、数学）。
    5. 每节课必须有具体的、可执行的"雨天室内替代活动"。
    6. 活动内容要丰富详细，专门设计以填满${duration}的时间安排。
    7. 语气应专业、教育性强、鼓舞人心。
    8. 所有内容必须用中文书写。
    9. esl_focus字段请填写空字符串""，english_vocabulary请填写空数组[]。`,
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
