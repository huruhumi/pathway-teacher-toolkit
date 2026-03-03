import { GoogleGenAI } from "@google/genai";

// Ensure we only have one instance per app run if key doesn't change
let aiClientInstance: GoogleGenAI | null = null;
let currentApiKey: string | null = null;

/**
 * Creates or retrieves a GoogleGenAI client instance.
 * Reads from VITE_GEMINI_API_KEY environment variable.
 */
export function createAIClient(): GoogleGenAI {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
        throw new Error("VITE_GEMINI_API_KEY is not defined in the environment variables.");
    }

    if (!aiClientInstance || currentApiKey !== apiKey) {
        aiClientInstance = new GoogleGenAI({ apiKey });
        currentApiKey = apiKey;
    }

    return aiClientInstance;
}
