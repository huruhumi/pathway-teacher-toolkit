// Image generation and prompt creation

import { GoogleGenAI } from "@google/genai";
import { retryOperation } from './geminiService';

export const generateImagePrompt = async (subject: string, theme: string, activityType: string, style: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
    return await retryOperation(async () => {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Create a detailed image generation prompt for "${subject}".
            Context: Educational workshop theme "${theme}", Activity type "${activityType}".
            Art Style: ${style}.
            The prompt should be descriptive, specifying lighting, composition, and mood, suitable for a text-to-image model. Return ONLY the prompt.`,
        });
        return response.text?.trim() || `A detailed illustration of ${subject} in ${style} style.`;
    });
};

export const generateImage = async (prompt: string, aspectRatio: string = "4:3"): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

    try {
        return await retryOperation(async () => {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: {
                    parts: [{ text: prompt }]
                },
                config: {
                    imageConfig: { aspectRatio: aspectRatio }
                }
            });

            for (const part of response.candidates?.[0]?.content?.parts || []) {
                if (part.inlineData) {
                    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                }
            }
            throw new Error("No image generated");
        });
    } catch (e) {
        console.error("Image generation failed", e);
        return "";
    }
};

export const generateBadgePrompt = async (theme: string, activityType: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
    return await retryOperation(async () => {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Create a prompt to generate a circular achievement badge icon for a workshop.
            Theme: ${theme}. Activity: ${activityType}.
            The badge should be simple, vector style, white background, suitable for a sticker.
            Return ONLY the prompt.`,
        });
        return response.text?.trim() || `A vector badge icon for ${theme}`;
    });
};
