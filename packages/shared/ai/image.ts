import { GenerateContentResponse } from "@google/genai";
import { createAIClient } from './client';
import { retryAICall } from './retry';

/**
 * Generate an AI image using Gemini's image model.
 * Returns a data URI (data:image/png;base64,...).
 */
export async function generateAIImage(
    prompt: string,
    aspectRatio: string = "1:1"
): Promise<string> {
    const ai = createAIClient();

    const response: GenerateContentResponse = await retryAICall(() =>
        ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: prompt }] },
            config: {
                imageConfig: { aspectRatio: aspectRatio as any }
            }
        })
    );

    if (response.candidates && response.candidates.length > 0) {
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                const mimeType = part.inlineData.mimeType || 'image/png';
                return `data:${mimeType};base64,${part.inlineData.data}`;
            }
        }
    }
    throw new Error("No image generated");
}

/**
 * Convert a File to base64 data URI string.
 */
export function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
    });
}
