/**
 * Gemini AI Service — uses REST API directly via fetch()
 * to avoid @google/genai SDK browser header encoding bugs.
 */

// Re-export Type enum for schema definitions used by callers
export { Type } from "@google/genai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

export const generateContent = async (prompt: string, systemInstruction?: string, config: any = {}) => {
  const model = "gemini-2.5-flash";
  const url = `${BASE_URL}/${model}:generateContent?key=${API_KEY}`;

  // Build contents — embed system instruction as conversation context
  const contents: any[] = [];
  if (systemInstruction) {
    contents.push({ role: 'user', parts: [{ text: `[System Instruction]: ${systemInstruction}` }] });
    contents.push({ role: 'model', parts: [{ text: 'Understood. I will follow these instructions.' }] });
  }
  contents.push({ role: 'user', parts: [{ text: prompt }] });

  const body: any = {
    contents,
    generationConfig: {
      maxOutputTokens: 4096,
      ...config,
    },
  };



  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Gemini API error response:", errorBody);
      throw new Error(`API returned ${response.status}: ${errorBody.substring(0, 200)}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      console.error("AI returned empty text. Full response:", JSON.stringify(data, null, 2));
      throw new Error("AI returned empty response");
    }

    return text;
  } catch (error: any) {
    console.error("Error generating content:", error);
    throw new Error(`AI generation failed: ${error.message || "Unknown error"}`);
  }
};

import { generateAIImage } from '@shared/ai/image';

export const generateImage = (prompt: string, aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" = "3:4") =>
  generateAIImage(prompt, aspectRatio);

