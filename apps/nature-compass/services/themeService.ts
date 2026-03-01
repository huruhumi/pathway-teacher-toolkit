// Theme generation for nature compass workshops

import { GoogleGenAI, Type, Part } from "@google/genai";
import { UploadedFile } from "../types";
import { retryOperation, THEME_PERSPECTIVES } from './geminiService';

export const generateRandomTheme = async (season: string, weather: string, focus: string[], age: string, uploadedFiles: UploadedFile[] = []): Promise<{ theme: string; introduction: string }> => {
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
    return await retryOperation(async () => {
        const randomSeed = Math.floor(Math.random() * 10000);
        const perspective = THEME_PERSPECTIVES[Math.floor(Math.random() * THEME_PERSPECTIVES.length)];

        let promptText = `
            Role: Creative Curriculum Designer.
            Task: Generate a UNIQUE, catchy, and educational workshop theme for kids aged ${age}.
            
            Constraints:
            - Season: ${season}
            - Weather: ${weather}
            - Focus Areas: ${focus.join(', ')}
            - Random Perspective to Adopt: "${perspective}" (Strictly apply this perspective!)
            - Random Seed: ${randomSeed}
            
            Instruction:
            1. If reference materials are provided, analyze them deeply. Find a specific, overlooked detail (e.g., a background object, a footnote fact) and combine it with the "${perspective}" perspective.
            2. If no materials are provided, use the perspective to brainstorm a wild, non-cliché theme.
            3. Avoid generic titles like "Summer Science" or "Solar Power". Be specific and adventurous.
            4. IMPORTANT: Keep the theme title SHORT (approx 5 words).
            5. Provide a brief introduction (1-2 sentences) explaining the theme concept.
            
            Output JSON format: { "theme": "...", "introduction": "..." }
        `;

        let contents: any = [{ text: promptText }];

        if (uploadedFiles && uploadedFiles.length > 0) {
            const parts: Part[] = [];
            uploadedFiles.forEach(file => {
                parts.push({
                    inlineData: {
                        mimeType: file.type,
                        data: file.data
                    }
                });
            });
            parts.push({ text: promptText });
            contents = [{ parts }];
        }

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: contents,
            config: {
                temperature: 1.0,
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        theme: { type: Type.STRING },
                        introduction: { type: Type.STRING }
                    },
                    required: ['theme', 'introduction']
                }
            }
        });

        const json = JSON.parse(response.text!);
        return {
            theme: json.theme || `The ${perspective} Adventure`,
            introduction: json.introduction || "An exciting journey into nature."
        };
    });
};
