// Single-item generators (flashcards, grammar, objectives, materials, stages, phonics, etc.)

import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { CEFRLevel, Flashcard, LessonStage } from '../types';
import { retryApiCall, RESPONSE_SCHEMA, cleanMarkdownPrefix } from './geminiService';

export const generateSingleFlashcard = async (level: CEFRLevel, topic: string, existingWords: string[]): Promise<Flashcard> => {
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
    const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Generate a new target vocabulary flashcard for Level: ${level}, Topic: ${topic}. Avoid: ${existingWords.join(", ")}. Return JSON.`,
        config: {
            responseMimeType: "application/json",
            responseSchema: (RESPONSE_SCHEMA.properties.flashcards as any).items
        }
    }));
    return JSON.parse(response.text || "{}");
};

export const generateSingleGrammarPoint = async (level: CEFRLevel, topic: string, existingPoints: string[]): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
    const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Generate one new grammar rule or target sentence for Level: ${level}, Topic: ${topic}. Avoid repeating: ${existingPoints.join(". ")}. DO NOT use markdown bold headers. Return ONLY the plain text string of the rule/sentence.`,
    }));
    return cleanMarkdownPrefix(response.text || "");
};

export const generateSingleObjective = async (level: CEFRLevel, topic: string, existing: string[]): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
    const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Generate one specific learning objective for Level: ${level}, Topic: ${topic}. It MUST follow the format: "Students will be able to [action] [content]". Existing ones: ${existing.join(". ")}. Return ONLY the objective text string.`,
    }));
    return response.text?.trim() || "";
};

export const generateSingleMaterial = async (level: CEFRLevel, topic: string, existing: string[]): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
    const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Suggest one teaching material or piece of equipment for Level: ${level}, Topic: ${topic}. Existing: ${existing.join(", ")}. Return ONLY the material name string.`,
    }));
    return response.text?.trim() || "";
};

export const generateSingleAnticipatedProblem = async (level: CEFRLevel, topic: string, existing: any[]): Promise<{ problem: string, solution: string }> => {
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
    const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Identify one anticipated learning problem and its practical solution for Level: ${level}, Topic: ${topic}. Existing: ${JSON.stringify(existing)}. Return JSON.`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    problem: { type: Type.STRING },
                    solution: { type: Type.STRING }
                },
                required: ["problem", "solution"]
            } as any
        }
    }));
    return JSON.parse(response.text || "{}");
};

export const generateSingleVocabItem = async (level: CEFRLevel, topic: string, existing: any[]): Promise<{ word: string, definition: string }> => {
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
    const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Generate one new target vocabulary word and its simple English definition for Level: ${level}, Topic: ${topic}. Existing: ${JSON.stringify(existing)}. Return JSON.`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    word: { type: Type.STRING },
                    definition: { type: Type.STRING }
                },
                required: ["word", "definition"]
            } as any
        }
    }));
    return JSON.parse(response.text || "{}");
};

export const generateSingleStage = async (level: CEFRLevel, topic: string, existingStages: any[]): Promise<LessonStage> => {
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
    const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Generate one cohesive teaching stage (e.g., Warm-up, Presentation, Practice, or Production) for Level: ${level}, Topic: ${topic}. It must complement the previous stages. Previous stages: ${JSON.stringify(existingStages)}. Return JSON.`,
        config: {
            responseMimeType: "application/json",
            responseSchema: (RESPONSE_SCHEMA.properties.structuredLessonPlan.properties.stages as any).items
        }
    }));
    return JSON.parse(response.text || "{}");
};

export const generateSinglePhonicsPoint = async (level: CEFRLevel, topic: string, existingPoints: string[], vocab: string[]): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
    const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Identify one specific phonics pattern or sound for Level: ${level}, Topic: ${topic} using vocabulary like ${vocab.join(", ")}. 
    You MUST use the format: "Category name: Word1, Word2, Word3". 
    Example: "Initial sound S: Sun, Sit, Sad". 
    Return ONLY the string. Do NOT provide any introductory text. Avoid repeating: ${existingPoints.join(", ")}`,
    }));
    return response.text?.trim() || "";
};

export const generateSingleDecodableText = async (level: CEFRLevel, topic: string, points: string[], vocab: string[]): Promise<{ text: string, visualPrompt: string }> => {
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
    const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
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
            } as any
        }
    }));
    return JSON.parse(response.text || "{}");
};
