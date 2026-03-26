// Curriculum generation and lesson kit translation

import { Type, GenerateContentResponse } from "@google/genai";
import { ESLCurriculum, CurriculumParams } from '../types';
import { createAIClient } from '@pathway/ai';
import { retryApiCall } from './gemini/shared';
import { mapSentenceCitations } from './gemini/citationMapper';

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

interface CurriculumGroundingOptions {
    textbookLevelLabel?: string;
    notebookId?: string;
    groundingFactSheet?: string;
    groundingUrls?: string[];
    groundingSources?: Array<{ id?: string; title?: string; url?: string; status?: string; type?: string }>;
}

const TRAILBLAZER_LEVEL_PREFIX = 'trailblazer-';

function parseDurationMinutes(duration: string): number {
    const parsed = Number.parseInt(duration, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 60;
}

function isTrailblazerCurriculum(
    params: CurriculumParams,
    grounding: CurriculumGroundingOptions,
    draft?: ESLCurriculum,
): boolean {
    const levelKey = (params.textbookLevelKey || '').trim().toLowerCase();
    if (levelKey.startsWith(TRAILBLAZER_LEVEL_PREFIX)) return true;

    const haystack = [
        grounding.textbookLevelLabel,
        grounding.groundingFactSheet,
        draft?.seriesName,
        draft?.textbookTitle,
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

    return /trailblazer/.test(haystack);
}

function applyTrailblazerUnitTemplate(
    curriculum: ESLCurriculum,
    params: CurriculumParams,
): ESLCurriculum {
    const durationMinutes = parseDurationMinutes(params.duration);
    const maxVocab = durationMinutes <= 45 ? 6 : durationMinutes <= 60 ? 8 : durationMinutes <= 90 ? 10 : 12;
    const maxObjectives = durationMinutes <= 45 ? 3 : durationMinutes <= 75 ? 4 : 5;

    const lessons = (curriculum.lessons || []).map((lesson, index) => {
        const unitNumber = Math.floor(index / 5) + 1;
        const lessonInUnit = (index % 5) + 1;
        const isReview = lessonInUnit === 5;
        const trail = lessonInUnit <= 2 ? 'Trail 1' : lessonInUnit <= 4 ? 'Trail 2' : 'Review';
        const trailPart = lessonInUnit <= 2 ? lessonInUnit : lessonInUnit <= 4 ? lessonInUnit - 2 : 0;
        const cleanTitle = String(lesson.title || '').trim();
        const reference = String(lesson.textbookReference || '').trim();
        const titleNeedsTrail = !/trail\s*1|trail\s*2|review/i.test(cleanTitle);
        const titleBase = cleanTitle || (isReview ? `Unit ${unitNumber} Review` : `${trail} Focus`);
        const normalizedTitle = isReview
            ? (/review/i.test(titleBase) ? titleBase : `Unit ${unitNumber} Review: ${titleBase}`)
            : (titleNeedsTrail
                ? `${trail} Part ${trailPart}: ${titleBase}`
                : titleBase);
        const normalizedReference = isReview
            ? (reference ? `${reference} | Unit ${unitNumber} Review` : `Unit ${unitNumber} Review`)
            : (reference
                ? `${reference} | ${trail} Part ${trailPart}`
                : `Unit ${unitNumber} ${trail} Part ${trailPart}`);

        const baseObjectives = Array.isArray(lesson.objectives) ? lesson.objectives.filter(Boolean) : [];
        const normalizedObjectives = baseObjectives.slice(0, maxObjectives);
        if (isReview && !normalizedObjectives.some((item) => /review|consolidate|recycle|assess/i.test(item))) {
            normalizedObjectives.unshift(`Students will be able to review and consolidate Unit ${unitNumber} language targets.`);
        }

        return {
            ...lesson,
            lessonNumber: index + 1,
            unitNumber,
            lessonInUnit,
            lessonType: isReview ? 'review' : (lesson.lessonType || 'regular'),
            title: normalizedTitle,
            textbookReference: normalizedReference,
            objectives: normalizedObjectives.slice(0, maxObjectives),
            suggestedVocabulary: Array.isArray(lesson.suggestedVocabulary)
                ? lesson.suggestedVocabulary.filter(Boolean).slice(0, maxVocab)
                : [],
            description: isReview
                ? (String(lesson.description || '').trim() || `Unit ${unitNumber} spiral review for both trails.`)
                : lesson.description,
        };
    });

    return {
        ...curriculum,
        totalLessons: lessons.length,
        lessons,
    };
}

export const generateESLCurriculum = async (
    textbookText: string,
    params: CurriculumParams,
    signal?: AbortSignal,
    grounding: CurriculumGroundingOptions = {},
): Promise<ESLCurriculum> => {
    const ai = createAIClient();

    let prompt = `You are an expert ESL curriculum designer. I am providing the extracted text content from a textbook or teaching material. Your task is to analyze this content and split it into EXACTLY ${params.lessonCount} well-structured ESL lessons.

Target Level: ${params.level}
Lesson Duration: ${params.duration} minutes each
Student Count: ${params.studentCount}
${params.ageGroup ? `Target Age Group: ${params.ageGroup} (adapt cognitive complexity, activity type, and language load accordingly)` : ''}
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

    const trailblazerMode = isTrailblazerCurriculum(params, grounding);

    if (grounding.groundingFactSheet) {
        prompt += `\n\n--- NOTEBOOKLM GROUNDING CONTEXT (PRIORITY) ---\n${grounding.groundingFactSheet}`;
        prompt += `\nUse this grounding context as a strict curriculum guardrail for scope/sequence, unit coherence, vocabulary progression, and assessment alignment.`;
        prompt += `\nCRITICAL: Keep unit names/order aligned to this grounding context. Prefer grounded vocabulary/grammar evidence over generic ESL defaults.`;
    }

    if (trailblazerMode) {
        prompt += `\n\n--- TRAILBLAZER SPLIT RULE (MANDATORY) ---
Apply the Trailblazer model exactly:
1. Each unit has 5 lessons total.
2. Lesson 1-2 = Trail 1 (Part 1 and Part 2).
3. Lesson 3-4 = Trail 2 (Part 1 and Part 2).
4. Lesson 5 = Unit review/consolidation lesson for both trails.
5. Do NOT merge Trail 1 and Trail 2 in a single non-review lesson.
6. Use NotebookLM "lesson planner" source pattern as the primary reference for trail sequencing when grounding context is available.
7. Adapt the depth and load to runtime settings:
   - Respect Total Lessons Required: ${params.lessonCount}.
   - Respect Lesson Duration: ${params.duration} minutes.
   - If final unit is partial due to lesson count limits, keep the same order (Trail 1 -> Trail 2 -> Review) and stop at the required lesson count.
8. Keep vocabulary/grammar/phonics/reading split aligned to the corresponding trail, and reserve lesson 5 for spiral review + formative check.`;
    }
    if (grounding.textbookLevelLabel) {
        prompt += `\nSelected textbook level standard: ${grounding.textbookLevelLabel}`;
    }
    if (grounding.notebookId) {
        prompt += `\nKnowledge notebook ID: ${grounding.notebookId}`;
    }
    if (grounding.groundingUrls?.length) {
        prompt += `\nGrounding source URLs: ${grounding.groundingUrls.join(', ')}`;
    }

    prompt += `\n\n--- TEXTBOOK CONTENT ---\n${textbookText}`;

    const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: CURRICULUM_SCHEMA,
        }
    }), 5, 3000, signal);
    let curriculum = JSON.parse(response.text || "{}") as ESLCurriculum;

    if (trailblazerMode) {
        curriculum = applyTrailblazerUnitTemplate(curriculum, params);
    }

    if (grounding.groundingSources && grounding.groundingSources.length > 0) {
        try {
            const targets: Array<{ section: string; text: string }> = [];
            if (curriculum.overview) {
                targets.push({ section: 'curriculum.overview', text: curriculum.overview });
            }
            (curriculum.lessons || []).forEach((lesson, lessonIndex) => {
                if (lesson.description) {
                    targets.push({
                        section: `lessons.${lessonIndex}.description`,
                        text: lesson.description,
                    });
                }
                (lesson.objectives || []).forEach((objective, objectiveIndex) => {
                    targets.push({
                        section: `lessons.${lessonIndex}.objectives.${objectiveIndex}`,
                        text: objective,
                    });
                });
                if (lesson.grammarFocus) {
                    targets.push({
                        section: `lessons.${lessonIndex}.grammarFocus`,
                        text: lesson.grammarFocus,
                    });
                }
                (lesson.suggestedActivities || []).forEach((activity, activityIndex) => {
                    targets.push({
                        section: `lessons.${lessonIndex}.suggestedActivities.${activityIndex}`,
                        text: activity,
                    });
                });
            });

            curriculum.sentenceCitations = await mapSentenceCitations({
                targets,
                sources: grounding.groundingSources,
                factSheet: grounding.groundingFactSheet,
                signal,
            });
        } catch (citationError) {
            console.warn('Curriculum citation mapping skipped:', citationError);
        }
    }

    return curriculum;
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
