/**
 * Gemini AI Service — uses REST API directly via fetch()
 * to avoid @google/genai SDK browser header encoding bugs.
 */

// Re-export Type enum for schema definitions used by callers
export { Type } from "@google/genai";

const API_KEY = process.env.GEMINI_API_KEY || "";
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

  console.log(`Calling Gemini REST API: ${model}`);

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

export const generateImage = async (prompt: string, aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" = "3:4") => {
  const model = "gemini-2.5-flash-image";
  const url = `${BASE_URL}/${model}:generateContent?key=${API_KEY}`;

  const body = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      imageConfig: {
        aspectRatio: aspectRatio,
      },
    },
  };

  console.log(`Calling Gemini Image API: ${model}`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Image API error:", errorBody);
      throw new Error(`Image API returned ${response.status}: ${errorBody.substring(0, 300)}`);
    }

    const data = await response.json();

    // Find the image part in the response
    for (const part of data?.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const base64 = part.inlineData.data;
        const mimeType = part.inlineData.mimeType || "image/png";
        return `data:${mimeType};base64,${base64}`;
      }
    }
    console.warn("No image data found in response:", JSON.stringify(data).substring(0, 500));
    return null;
  } catch (error: any) {
    console.error("Error generating image:", error);
    throw new Error(`Image generation failed: ${error.message || "Unknown error"}`);
  }
};

// Keep getAIClient export for backward compatibility (not used anymore)
export const getAIClient = () => {
  throw new Error("SDK client is no longer used. All calls go through REST API.");
};
