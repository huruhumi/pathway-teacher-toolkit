// Image generation and prompt creation

import { Type } from "@google/genai";
import { UploadedFile } from "../types";
import { createAIClient } from '@shared/ai/client';
import { retryOperation } from './geminiService';

export const generateImagePrompt = async (subject: string, theme: string, activityType: string, style: string): Promise<string> => {
    const ai = createAIClient();
    return await retryOperation(async () => {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Create a detailed image generation prompt for "${subject}".
    Context: Educational workshop theme "${theme}", Activity type "${activityType}".
            Art Style: ${style}.
            The prompt should be descriptive, specifying lighting, composition, and mood, suitable for a text - to - image model.Return ONLY the prompt.`,
        });
        return response.text?.trim() || `A detailed illustration of ${subject} in ${style} style.`;
    });
};

export const generateImage = async (prompt: string, aspectRatio: string = "4:3"): Promise<string> => {
    const ai = createAIClient();

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
                    const mimeType = part.inlineData.mimeType;
                    const b64Data = part.inlineData.data;
                    const byteCharacters = atob(b64Data);
                    const byteArrays = [];

                    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
                        const slice = byteCharacters.slice(offset, offset + 512);
                        const byteNumbers = new Array(slice.length);
                        for (let i = 0; i < slice.length; i++) {
                            byteNumbers[i] = slice.charCodeAt(i);
                        }
                        const byteArray = new Uint8Array(byteNumbers);
                        byteArrays.push(byteArray);
                    }

                    const blob = new Blob(byteArrays, { type: mimeType });
                    return URL.createObjectURL(blob);
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
    const ai = createAIClient();
    return await retryOperation(async () => {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Create a prompt to generate a circular achievement badge icon for a workshop.
    Theme: ${theme}.Activity: ${activityType}.
            The badge should be simple, vector style, white background, suitable for a sticker.
            Return ONLY the prompt.`,
        });
        return response.text?.trim() || `A vector badge icon for ${theme}`;
    });
};
