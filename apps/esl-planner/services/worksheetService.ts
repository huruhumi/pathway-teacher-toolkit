// Worksheet generation, games, reading tasks, web resources, trivia, reading passages

import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { CEFRLevel, Game, Worksheet, ReadingPlanDay, ReadingTask, WebResource } from '../types';
import { retryApiCall, RESPONSE_SCHEMA } from './geminiService';

export const generateWorksheet = async (level: CEFRLevel, topic: string, configs: any[]): Promise<Worksheet> => {
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

    let instructionsText = `Generate a worksheet for Level: ${level}, Topic: ${topic} based on these configs: ${JSON.stringify(configs)}. `;

    if (configs.some(c => c.type === 'Cloze Test')) {
        instructionsText += `CRITICAL for "Cloze Test" type: You MUST generate a reading passage in the 'passage' field with numbered blanks like (1), (2), (3), etc. The corresponding items in that section MUST have 'question' text like "Blank (1)", "Blank (2)", etc., and MUST use 'multiple-choice' layout with exactly 4 options each. Set the 'layout' field of the Cloze Test section to 'multiple-choice'. `;
    }

    if (configs.some(c => c.type === 'Error Correction')) {
        instructionsText += `CRITICAL for "Error Correction" type: You MUST generate a short reading passage in the 'passage' field that contains a specific number of errors (equal to the 'count' provided). Each section item should identify the wrong word/phrase in 'question' and the correct version in 'answer'. Set the 'layout' field of the Error Correction section to 'error-correction'. `;
    }

    if (configs.some(c => c.type === 'Picture Description')) {
        instructionsText += `CRITICAL for "Picture Description" type: This is a writing task. Set the 'layout' to 'essay'. Provide a descriptive writing prompt in 'question' and suggest a target word count (e.g. 50 or 100) in the 'wordCount' field of the item. `;
    }

    const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: instructionsText,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    type: { type: Type.STRING },
                    instructions: { type: Type.STRING },
                    sections: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                title: { type: Type.STRING },
                                description: { type: Type.STRING },
                                passageTitle: { type: Type.STRING },
                                passage: { type: Type.STRING },
                                layout: { type: Type.STRING, enum: ["standard", "matching", "multiple-choice", "essay", "error-correction"] },
                                items: {
                                    type: Type.ARRAY,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            question: { type: Type.STRING },
                                            answer: { type: Type.STRING },
                                            options: { type: Type.ARRAY, items: { type: Type.STRING } },
                                            visualPrompt: { type: Type.STRING },
                                            wordCount: { type: Type.NUMBER, description: "Suggested word count for writing tasks" }
                                        },
                                        required: ["question", "answer"]
                                    }
                                }
                            },
                            required: ["title", "items"]
                        }
                    }
                },
                required: ["title", "instructions", "sections"]
            } as any
        }
    }));

    return JSON.parse(response.text || "{}");
};

export const generateSingleGame = async (level: CEFRLevel, topic: string, skill: string, type: string, context: string): Promise<Game> => {
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
    const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Generate a single educational game for Level: ${level}, Topic: ${topic}, Skill: ${skill}, Type: ${type}. Context: ${context}. Return the result in the specified JSON format.`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    type: { type: Type.STRING },
                    interactionType: { type: Type.STRING },
                    instructions: { type: Type.STRING },
                    materials: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["name", "type", "interactionType", "instructions", "materials"]
            } as any
        }
    }));
    return JSON.parse(response.text || "{}");
};

export const generateReadingTask = async (level: CEFRLevel, topic: string, focus: string): Promise<ReadingTask> => {
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
    const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Generate a post-class reading or review task for Level: ${level}, Topic: ${topic}, Focus: ${focus}. Provide both English and Chinese. Return JSON.`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    text: { type: Type.STRING },
                    text_cn: { type: Type.STRING },
                    isCompleted: { type: Type.BOOLEAN }
                },
                required: ["text", "text_cn"]
            } as any
        }
    }));
    const data = JSON.parse(response.text || "{}");
    return { ...data, isCompleted: false };
};

export const generateWebResource = async (topic: string, focus: string): Promise<WebResource> => {
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
    const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Suggest a high-quality educational web resource (YouTube, National Geographic, etc.) for Topic: ${topic}, Focus: ${focus}. Return JSON.`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    title_cn: { type: Type.STRING },
                    url: { type: Type.STRING },
                    description: { type: Type.STRING },
                    description_cn: { type: Type.STRING }
                },
                required: ["title", "title_cn", "url", "description", "description_cn"]
            } as any
        }
    }));
    return JSON.parse(response.text || "{}");
};

export const generateNewCompanionDay = async (level: CEFRLevel, topic: string, dayNum: number): Promise<ReadingPlanDay> => {
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
    const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Generate Day ${dayNum} of a 7-day review plan for Level: ${level}, Topic: ${topic}. Return JSON.`,
        config: {
            responseMimeType: "application/json",
            responseSchema: (RESPONSE_SCHEMA.properties.readingCompanion.properties.days as any).items
        }
    }));
    return JSON.parse(response.text || "{}");
};

export const generateTrivia = async (topic: string, focus: string): Promise<{ en: string; cn: string }> => {
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
    const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Generate a trivia fact about ${topic} focusing on ${focus}. Return JSON.`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    en: { type: Type.STRING },
                    cn: { type: Type.STRING }
                },
                required: ["en", "cn"]
            } as any
        }
    }));
    return JSON.parse(response.text || "{}");
};

export const generateReadingPassage = async (level: string, topic: string, vocab: string[]): Promise<{ title: string, text: string }> => {
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
    const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Generate a short reading passage (about 100-150 words) appropriate for ESL Level: ${level}, Topic: ${topic}. Try to incorporate some of this target vocabulary if relevant: ${vocab.join(", ")}. Return the result as a JSON object with 'title' and 'text' fields.`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    text: { type: Type.STRING }
                },
                required: ["title", "text"]
            } as any
        }
    }));
    return JSON.parse(response.text || "{}");
};
