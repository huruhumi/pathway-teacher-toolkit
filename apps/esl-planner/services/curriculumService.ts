// Curriculum generation and lesson kit translation

import { Type, GenerateContentResponse } from "@google/genai";
import { ESLCurriculum, CurriculumParams } from '../types';
import { createAIClient } from '@shared/ai/client';
import { retryApiCall } from './geminiService';

const CURRICULUM_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        textbookTitle: { type: Type.STRING, description: "Title of the textbook or a generated title based on the content" },
        seriesName: { type: Type.STRING, description: "Short series/brand name without 'Student\\'s Book' or 'Teacher\\'s Guide' suffix, e.g. 'Trailblazer Starter'" },
        overview: { type: Type.STRING, description: "A brief overview of the curriculum and what students will learn" },
        totalLessons: { type: Type.NUMBER },
        targetLevel: { type: Type.STRING },
        lessons: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    lessonNumber: { type: Type.NUMBER, description: "Global sequential lesson number (1-based)" },
                    unitNumber: { type: Type.NUMBER, description: "The unit or chapter number this lesson belongs to. Infer from textbook content if possible." },
                    lessonInUnit: { type: Type.NUMBER, description: "The lesson number WITHIN its unit (1-based). E.g. the 2nd lesson in Unit 3 = 2." },
                    lessonType: { type: Type.STRING, description: "Type of lesson: 'regular' for normal content lessons, 'review' for revision/recap, 'activity' for activity-focused, 'project' for project lessons, 'assessment' for tests/quizzes, 'phonics' for phonics-focused lessons. Default to 'regular'." },
                    title: { type: Type.STRING, description: "A concise, specific title for this lesson." },
                    topic: { type: Type.STRING, description: "The specific topic or theme of this lesson" },
                    description: { type: Type.STRING, description: "2-3 sentence description of what this lesson covers" },
                    objectives: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3-5 specific learning objectives" },
                    suggestedVocabulary: { type: Type.ARRAY, items: { type: Type.STRING }, description: "8-12 key vocabulary words from the textbook content" },
                    grammarFocus: { type: Type.STRING, description: "The main grammar point or structure for this lesson" },
                    suggestedActivities: { type: Type.ARRAY, items: { type: Type.STRING }, description: "2-4 suggested classroom activities" },
                    textbookReference: { type: Type.STRING, description: "Which section/pages/chapters of the textbook this lesson covers (e.g. \"Unit 1, Pages 12-13\")" }
                },
                required: ["lessonNumber", "unitNumber", "lessonInUnit", "lessonType", "title", "topic", "description", "objectives", "suggestedVocabulary", "grammarFocus", "suggestedActivities", "textbookReference"]
            }
        }
    },
    required: ["textbookTitle", "seriesName", "overview", "totalLessons", "targetLevel", "lessons"]
};

export const generateESLCurriculum = async (
    textbookText: string,
    params: CurriculumParams,
    signal?: AbortSignal
): Promise<ESLCurriculum> => {
    const ai = createAIClient();

    let prompt = `You are an expert ESL curriculum designer. I am providing the extracted text content from a textbook or teaching material. Your task is to analyze this content and split it into EXACTLY ${params.lessonCount} well-structured ESL lessons.

Target Level: ${params.level}
Lesson Duration: ${params.duration} minutes each
Student Count: ${params.studentCount}
Total Lessons Required: ${params.lessonCount}

CRITICAL INSTRUCTIONS:
1. You MUST generate EXACTLY ${params.lessonCount} lessons. No more, no less.
2. Each lesson should cover a logical, progressive portion of the textbook content.
3. Lessons should build upon each other in difficulty and topic progression.
4. Extract REAL vocabulary, grammar points, and topics FROM the provided textbook content — do NOT invent content that isn't in the material.
5. The textbookReference field should indicate which part of the content each lesson draws from (e.g. "Unit 1, Pages 12-13").
6. Objectives should follow the format: "Students will be able to [action] [content]".
7. Suggested activities should be practical, level-appropriate, and varied (mix of individual, pair, and group work).
8. CRITICAL: Try to infer the "unitNumber" from the textbook chapters. The "title" of each lesson should be specific (e.g. "How Do You Feel?"). Avoid prefixing textbook name or unit in the title field, keep the title clean.
9. Determine "lessonInUnit" — which lesson number this is WITHIN its unit (starting from 1). For example, if Unit 1 has 4 lessons, they should be lessonInUnit: 1, 2, 3, 4. When Unit 2 starts, lessonInUnit resets to 1.
10. Determine "lessonType": use 'regular' for normal content lessons. Use 'review' for revision/recap lessons, 'activity' for activity-focused lessons, 'project' for project lessons, 'assessment' for tests/quizzes, 'phonics' for phonics-focused lessons.
11. Generate a "seriesName" that is the textbook brand/series name without "Student's Book", "Teacher's Guide", or similar suffixes. For example: "Trailblazer Starter Student's Book" → seriesName: "Trailblazer Starter".`;

    if (params.customInstructions) {
        prompt += `\n\nAdditional Instructions from Teacher:\n${params.customInstructions}`;
    }

    prompt += `\n\n--- TEXTBOOK CONTENT ---\n${textbookText}`;

    const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: CURRICULUM_SCHEMA as any,
        }
    }), 5, 3000, signal);

    return JSON.parse(response.text || "{}");
};

export const translateLessonKit = async (content: any, targetLanguage: string = "Chinese"): Promise<any> => {
    const ai = createAIClient();
    const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `You are an expert educational translator. I am providing a JSON object representing an English ESL lesson kit. 
Translate ALL nested string values (including lesson plans, slide outlines, games, reading passages, worksheets, phonics texts, etc.) into natural, professional ${targetLanguage}.
CRITICAL INSTRUCTIONS:
1. DO NOT translate any JSON keys or property names. Keep them exactly as they are.
2. DO NOT translate or alter any HTML tags (like <span style='...'>, <br/>, etc.). Only translate the text content inside them.
3. DO NOT change the structure of the JSON arrays or objects.
4. If a string contains a URL or a specific grammatical pattern that shouldn't be translated, adapt it reasonably or leave it in English if appropriate.
5. Return ONLY the translated JSON object.

JSON to translate:
${JSON.stringify(content)}`,
        config: {
            responseMimeType: "application/json",
        }
    }));
    return JSON.parse(response.text || "{}");
};
