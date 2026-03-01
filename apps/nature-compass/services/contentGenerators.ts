// Single-item content generators and translation

import { GoogleGenAI, Type, Schema } from "@google/genai";
import { LessonPlanResponse, VocabularyItem, VisualReferenceItem, RoadmapItem } from "../types";
import { retryOperation, lessonPlanSchema } from './geminiService';

export const generateSingleStep = async (context: any, currentSteps: string[]): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
    return await retryOperation(async () => {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Context: A teaching activity "${context.activity}" (${context.description}).
            Current steps: ${JSON.stringify(currentSteps)}.
            Task: Write the NEXT single logical instructional step for the teacher. Keep it actionable and concise. Return only the step text.`,
        });
        return response.text?.trim() || "Guide students through the next part of the activity.";
    });
};

export const generateVocabularyItem = async (theme: string, existingWords: string[]): Promise<VocabularyItem> => {
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
    return await retryOperation(async () => {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Theme: ${theme}. Existing words: ${existingWords.join(', ')}.
            Generate ONE new relevant vocabulary word and a simple definition for a child.
            Return JSON: { "word": "...", "definition": "..." }`,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        word: { type: Type.STRING },
                        definition: { type: Type.STRING }
                    },
                    required: ['word', 'definition']
                }
            }
        });
        return JSON.parse(response.text!) as VocabularyItem;
    });
};

export const generateVisualReferenceItem = async (theme: string, activityType: string, existingLabels: string[]): Promise<VisualReferenceItem> => {
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
    return await retryOperation(async () => {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Theme: ${theme}. Activity: ${activityType}. Existing visuals: ${existingLabels.join(', ')}.
            Suggest ONE new visual reference aid (diagram, photo, etc) that would help the teacher.
            Return JSON: { "label": "...", "description": "...", "type": "..." }`,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        label: { type: Type.STRING },
                        description: { type: Type.STRING },
                        type: { type: Type.STRING }
                    },
                    required: ['label', 'description', 'type']
                }
            }
        });
        return JSON.parse(response.text!) as VisualReferenceItem;
    });
};

export const generateRoadmapItem = async (theme: string, activityType: string, currentRoadmap: RoadmapItem[]): Promise<RoadmapItem> => {
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
    const roadmapItemSchema: Schema = {
        type: Type.OBJECT,
        properties: {
            timeRange: { type: Type.STRING },
            phase: { type: Type.STRING },
            activity: { type: Type.STRING },
            activityType: { type: Type.STRING },
            location: { type: Type.STRING },
            description: { type: Type.STRING },
            learningObjective: { type: Type.STRING },
            steps: { type: Type.ARRAY, items: { type: Type.STRING } },
            backgroundInfo: { type: Type.ARRAY, items: { type: Type.STRING } },
            teachingTips: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["timeRange", "phase", "activity", "activityType", "location", "description", "learningObjective", "steps", "backgroundInfo", "teachingTips"]
    };

    return await retryOperation(async () => {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Theme: ${theme}. Activity Type: ${activityType}.
            Current phases: ${currentRoadmap.map(r => r.phase).join(', ')}.
            Generate the NEXT logical phase/activity for this workshop.
            Return JSON.`,
            config: {
                responseMimeType: 'application/json',
                responseSchema: roadmapItemSchema
            }
        });
        return JSON.parse(response.text!) as RoadmapItem;
    });
};

export const generateSingleBackgroundInfo = async (theme: string, activity: string, currentInfo: string[]): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
    return await retryOperation(async () => {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Theme: ${theme}. Activity: ${activity}.
            Current background info: ${currentInfo.join(' | ')}.
            Provide ONE new interesting fact or concept explanation for the teacher. Keep it brief. Return only text.`,
        });
        return response.text?.trim() || "Interesting fact about the topic.";
    });
};

export const generateSingleTeachingTip = async (theme: string, activity: string, currentTips: string[]): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
    return await retryOperation(async () => {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Theme: ${theme}. Activity: ${activity}.
            Current teaching tips: ${currentTips.join(' | ')}.
            Provide ONE new specific teaching tip (methodology, safety, or engagement). Keep it actionable and brief. Return only text.`,
        });
        return response.text?.trim() || "Guide students effectively.";
    });
};

export const translateLessonPlan = async (plan: LessonPlanResponse, targetLanguage: string, signal?: AbortSignal): Promise<LessonPlanResponse> => {
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

    const systemInstruction = `
    You are an expert translator specializing in educational materials.
    Translate the provided JSON content into ${targetLanguage}.
    
    CRITICAL RULES:
    1. Translate all student-facing and teacher-facing descriptive text (titles, descriptions, facts, tips, roadmap activities, handbook content prompts, etc.).
    2. Maintain the EXACT SAME JSON structure, keys, and array lengths as the input.
    3. EXCEPTION: Do not translate the English 'keywords' in the vocabulary section. Only translate their 'definition'.
    4. EXCEPTION: Do not translate 'imagePrompts', 'visualPrompt', or 'handbookStylePrompt' if they are instructions for an AI image generator. Keep them in English for better image generation results.
    
    Return pure JSON matching the input structure.
  `;

    return await retryOperation(async () => {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            config: {
                systemInstruction,
                responseMimeType: 'application/json',
                responseSchema: lessonPlanSchema,
                temperature: 0.1,
            },
            contents: [{ text: JSON.stringify(plan) }]
        });

        const text = response.text;
        if (!text) throw new Error("No response from Gemini during translation");
        return JSON.parse(text) as LessonPlanResponse;
    }, signal);
};
