// Single-item generators (flashcards, grammar, objectives, materials, stages, phonics, etc.)

import { Type, GenerateContentResponse } from "@google/genai";
import { CEFRLevel, Flashcard, LessonStage } from '../types';
import { createAIClient } from '@pathway/ai';
import { retryApiCall, responseSchemaFragments, cleanMarkdownPrefix } from './gemini/shared';

export const generateSingleFlashcard = async (level: CEFRLevel, topic: string, existingWords: string[]): Promise<Flashcard> => {
    const ai = createAIClient();
    const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Level: ${level}\nTopic: ${topic}\nExisting words to avoid: ${existingWords.join(", ")}`,
        config: {
            systemInstruction: "Generate a new target vocabulary flashcard based on the provided Level and Topic. You must return valid JSON. Do not include any existing words provided.",
            responseMimeType: "application/json",
            responseSchema: responseSchemaFragments.flashcard
        }
    }));
    return JSON.parse(response.text || "{}");
};

export const generateSingleGrammarPoint = async (level: CEFRLevel, topic: string, existingPoints: string[]): Promise<string> => {
    const ai = createAIClient();
    const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Level: ${level}\nTopic: ${topic}\nExisting points to avoid: ${existingPoints.join(". ")}`,
        config: {
            systemInstruction: "Generate exactly ONE new grammar rule or target sentence. DO NOT use markdown bold headers. Return ONLY the plain text string. Do not provide any introductory text."
        }
    }));
    return cleanMarkdownPrefix(response.text || "");
};

export const generateSingleObjective = async (level: CEFRLevel, topic: string, existing: string[]): Promise<string> => {
    const ai = createAIClient();
    const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Level: ${level}\nTopic: ${topic}\nExisting objectives: ${existing.join(". ")}`,
        config: {
            systemInstruction: "Generate exactly ONE specific learning objective. It MUST strictly follow the format: 'Students will be able to [action] [content]'. Return ONLY the objective text string."
        }
    }));
    return response.text?.trim() || "";
};

export const generateSingleMaterial = async (level: CEFRLevel, topic: string, existing: string[]): Promise<string> => {
    const ai = createAIClient();
    const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Level: ${level}\nTopic: ${topic}\nExisting materials: ${existing.join(", ")}`,
        config: {
            systemInstruction: "Suggest exactly ONE teaching material or piece of equipment. Return ONLY the material name string."
        }
    }));
    return response.text?.trim() || "";
};

export const generateSingleAnticipatedProblem = async (level: CEFRLevel, topic: string, existing: any[]): Promise<{ problem: string, solution: string }> => {
    const ai = createAIClient();
    const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Level: ${level}\nTopic: ${topic}\nExisting problems: ${JSON.stringify(existing)}`,
        config: {
            systemInstruction: "Identify exactly ONE anticipated learning problem and its practical solution. Return valid JSON.",
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    problem: { type: Type.STRING },
                    solution: { type: Type.STRING }
                },
                required: ["problem", "solution"]
            }
        }
    }));
    return JSON.parse(response.text || "{}");
};

export const generateSingleVocabItem = async (level: CEFRLevel, topic: string, existing: any[]): Promise<{ word: string, definition: string }> => {
    const ai = createAIClient();
    const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Level: ${level}\nTopic: ${topic}\nExisting vocabulary: ${JSON.stringify(existing)}`,
        config: {
            systemInstruction: "Generate exactly ONE new target vocabulary word and its simple English definition. Return valid JSON.",
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    word: { type: Type.STRING },
                    definition: { type: Type.STRING }
                },
                required: ["word", "definition"]
            }
        }
    }));
    return JSON.parse(response.text || "{}");
};

/** Generate ONLY a definition for a given word at the specified CEFR level */
export const generateVocabDefinition = async (word: string, level: CEFRLevel): Promise<string> => {
    const ai = createAIClient();
    const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Word: ${word}\nLevel: ${level}`,
        config: {
            systemInstruction: `Generate a simple, ${level}-level appropriate English definition for the given word. The definition should be concise (one sentence), using vocabulary that a ${level} ESL student can understand. Return ONLY the definition text string, no quotes.`
        }
    }));
    return response.text?.trim() || "";
};

export const generateSingleStage = async (level: CEFRLevel, topic: string, existingStages: any[], customPrompt?: string): Promise<LessonStage> => {
    const ai = createAIClient();
    const baseUserContent = customPrompt
        ? `Level: ${level}\nTopic: ${topic}\nPrevious stages: ${JSON.stringify(existingStages)}\nUser requirement: ${customPrompt}`
        : `Level: ${level}\nTopic: ${topic}\nPrevious stages: ${JSON.stringify(existingStages)}`;

    const stageContainsCjk = (stage: LessonStage): boolean => {
        const values = [
            stage.stage,
            stage.stageAim,
            stage.timing,
            stage.interaction,
            stage.teacherActivity,
            stage.studentActivity,
            ...(stage.teachingTips || []),
            ...(stage.backgroundKnowledge || []),
            stage.fillerActivity || '',
        ];
        return values.some((text) => /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(String(text || '')));
    };

    const runGenerate = async (forceEnglishRetry: boolean): Promise<LessonStage> => {
        const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: forceEnglishRetry
                ? `${baseUserContent}\n\nLANGUAGE OVERRIDE (MUST FOLLOW): Return all fields in natural ENGLISH ONLY. Do not output Chinese or any other non-English language.`
                : baseUserContent,
            config: {
                systemInstruction: "Generate exactly ONE cohesive teaching stage. It must complement the previous stages logically. If the user provides a specific requirement, follow it closely to design the stage accordingly. IMPORTANT: The 'interaction' field must be a COMMA-SEPARATED list of interaction modes, one per numbered step in teacherActivity/studentActivity. Use exactly these codes: T-S, S-T, S-S, S-S (pairs), S-S (groups), T-Ss. LANGUAGE REQUIREMENT: Output all fields in English only, even if the user requirement contains other languages. Return valid JSON.",
                responseMimeType: "application/json",
                responseSchema: responseSchemaFragments.lessonStage
            }
        }));
        return JSON.parse(response.text || "{}");
    };

    const first = await runGenerate(false);
    if (!stageContainsCjk(first)) return first;
    return runGenerate(true);
};

export const generateSinglePhonicsPoint = async (level: CEFRLevel, topic: string, existingPoints: string[], vocab: string[]): Promise<string> => {
    const ai = createAIClient();
    const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Identify one specific phonics pattern or sound for Level: ${level}, Topic: ${topic} using vocabulary like ${vocab.join(", ")}. 
    You MUST use the format: "Category name: Word1, Word2, Word3". 
    Example: "Initial sound S: Sun, Sit, Sad". 
    Return ONLY the string. Do NOT provide any introductory text. Avoid repeating: ${existingPoints.join(", ")}`,
    }));
    return response.text?.trim() || "";
};

export const generateSingleDecodableText = async (level: CEFRLevel, topic: string, points: string[], vocab: string[]): Promise<{ text: string, visualPrompt: string }> => {
    const ai = createAIClient();
    const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Create a highly logical, engaging decodable rhyming story for Level: ${level}.
Focus heavily on the target sounds: ${points.join(", ")}.
Include the target vocabulary: ${vocab.join(", ")}.
CRITICAL LENGTH LIMITS: The story MUST be EXACTLY 5 to 8 lines long. Each line MUST have EXACTLY 5 to 8 words.
CRITICAL VOCABULARY & COLOR LIMITS: 
1. The story must make logical sense.
2. Target words must be wrapped in <span style='color: #8b5cf6; font-weight: bold;'>word</span> (Purple).
3. Sight words must be wrapped in <span style='color: #eab308; font-weight: bold;'>word</span> (Yellow).
4. Phonics extension words (words following the target sound rules but not in target vocab) must be wrapped in <span style='color: #10b981; font-weight: bold;'>word</span> (Green).
5. You may NOT use more than 5 words that fall completely outside of these categories.
CRITICAL RHYMING: The story MUST be written with a fun, rhythmic, rhyming structure (e.g., AABB or ABAB rhyme scheme).
Format: Start with a catchy ALL CAPS TITLE on the first line. Then write the story below it, using <br/> for line breaks so EVERY SINGLE SENTENCE starts on a new line. Return HTML inside the JSON string.
Also provide a simple visual prompt describing the scene for an AI image generator. Return JSON.`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    text: { type: Type.STRING },
                    visualPrompt: { type: Type.STRING }
                },
                required: ["text", "visualPrompt"]
            }
        }
    }));
    return JSON.parse(response.text || "{}");
};

export const generateSingleTeachingTip = async (level: CEFRLevel, topic: string, stageName: string, existingTips: string[]): Promise<string> => {
    const ai = createAIClient();
    const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Level: ${level}\nTopic: ${topic}\nStage: ${stageName}\nExisting tips: ${existingTips.join(". ")}`,
        config: {
            systemInstruction: "Generate exactly ONE practical ESL teaching methodology tip. Focus on scaffolding techniques, TPR, visual aids, sentence frames, or error correction strategies. Return ONLY the tip text string."
        }
    }));
    return response.text?.trim() || "";
};

export const generateSingleBackgroundKnowledge = async (level: CEFRLevel, topic: string, stageName: string, existingInfo: string[]): Promise<string> => {
    const ai = createAIClient();
    const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Level: ${level}\nTopic: ${topic}\nStage: ${stageName}\nExisting info: ${existingInfo.join(". ")}`,
        config: {
            systemInstruction: "Generate exactly ONE background knowledge point for the teacher. Include cultural context, linguistic notes, common misconceptions, or subject matter facts. Return ONLY the knowledge point text string."
        }
    }));
    return response.text?.trim() || "";
};

export const generateFillerActivity = async (level: CEFRLevel, topic: string, stageName: string): Promise<string> => {
    const ai = createAIClient();
    const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Level: ${level}\nTopic: ${topic}\nStage: ${stageName}`,
        config: {
            systemInstruction: "Generate a SHORT NAME (2-5 words) for a quick 2-3 minute filler/extension activity suitable for this ESL stage. It should be simple, require no extra equipment, and serve as a backup if students finish early or need extra practice. Return ONLY the activity name (e.g. 'Vocabulary Hot Seat', 'Quick Draw Relay', 'Word Chain Challenge'). Do NOT return instructions or descriptions."
        }
    }));
    return response.text?.trim() || "";
};
