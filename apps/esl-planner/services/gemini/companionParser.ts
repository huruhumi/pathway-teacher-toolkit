import { Type, GenerateContentResponse } from "@google/genai";
import { ReadingCompanionContent } from '../../types';
import { createAIClient } from '@pathway/ai';
import { retryApiCall, responseSchemaFragments } from './shared';

export const extractCompanionFromPDF = async (base64Pdf: string): Promise<ReadingCompanionContent> => {
    const ai = createAIClient();

    const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
            {
                inlineData: {
                    data: base64Pdf,
                    mimeType: 'application/pdf'
                }
            },
            `Extract the 7-day learning companion content from this PDF. 
The PDF contains vocabulary, sentence patterns, daily tasks, trivia, and web resources.
You MUST extract ALL days exactly as they appear in the PDF. Keep the exact text and translation.
Output the result exactly matching the required JSON schema.`
        ],
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    days: {
                        type: Type.ARRAY,
                        items: responseSchemaFragments.readingCompanionDay
                    },
                    webResources: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                title: { type: Type.STRING },
                                title_cn: { type: Type.STRING },
                                url: { type: Type.STRING },
                                description: { type: Type.STRING },
                                description_cn: { type: Type.STRING },
                            },
                        }
                    }
                },
                required: ["days", "webResources"]
            }
        }
    }));

    return JSON.parse(response.text || '{"days": [], "webResources": []}');
};
