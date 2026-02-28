import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey || apiKey === "undefined" || apiKey === "") {
  console.warn("GEMINI_API_KEY is not defined. AI features will be disabled until a key is provided.");
}

const ai = new GoogleGenAI({ apiKey: apiKey || "dummy-key" });

export interface Lesson {
  title: string;
  description: string;
  steam_focus: string;
  esl_focus: string;
  location: string;
  outdoor_activity: string;
  indoor_alternative: string;
  english_vocabulary: string[];
}

export interface Curriculum {
  theme: string;
  overview: string;
  lessons: Lesson[];
}

export async function suggestLocations(city: string): Promise<string[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === "undefined") {
    throw new Error("Gemini API key is not configured. Please ensure GEMINI_API_KEY is set in your environment.");
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `List 8-10 well-known outdoor locations in ${city} that are suitable for STEAM education activities with K-12 students. Include parks, lakes, botanical gardens, science museums, nature reserves, wetlands, riverside areas, etc. Only return locations that actually exist in ${city}. Use the local language name for each location.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            locations: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["locations"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("AI returned an empty response.");
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    return parsed.locations || [];
  } catch (error: any) {
    console.error("suggestLocations error:", error);
    throw new Error("Failed to get location suggestions. Please try again.");
  }
}

export async function generateCurriculum(ageGroup: string, englishLevel: string, lessonCount: number, duration: string, preferredLocation: string, customTheme: string, city: string = "武汉"): Promise<Curriculum> {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === "undefined") {
    throw new Error("Gemini API key is not configured. Please ensure GEMINI_API_KEY is set in your environment.");
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Design a systematic STEAM outdoor curriculum for students in ${city}.
    Theme: ${customTheme || "General STEAM Exploration"}
    Age Group: ${ageGroup}
    English Level: ${englishLevel}
    Number of Lessons: ${lessonCount}
    Duration per Lesson: ${duration}
    ${preferredLocation ? `Preferred Location/Area: ${preferredLocation}` : ''}
    
    Requirements:
    1. The curriculum should be strictly centered around the theme: "${customTheme || "General STEAM Exploration"}".
    2. It should have exactly ${lessonCount} progressive lessons.
    3. Locations must be specific, well-known, and accessible outdoor spots in ${city}. ${preferredLocation ? `Try to focus on or include activities near ${preferredLocation}.` : ''}
    4. Each lesson must include a STEAM focus (Science, Technology, Engineering, Arts, Math).
    5. Each lesson must include a specific, explicit, and actionable ESL (English as a Second Language) focus. Provide concrete examples of language points (e.g., 'Present Continuous for describing ongoing nature processes'), functional language (e.g., 'Asking for directions in a park'), or specific conversational tasks relevant to the theme and the ${englishLevel} level.
    6. Each lesson must have a specific "Rainy Day" indoor alternative activity.
    7. Activities should be rich and detailed, specifically designed to fill the ${duration} time slot.
    8. English vocabulary and concepts should be integrated based on the provided level.
    9. The tone should be professional, educational, and inspiring.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            theme: { type: Type.STRING },
            overview: { type: Type.STRING },
            lessons: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  steam_focus: { type: Type.STRING },
                  esl_focus: { type: Type.STRING },
                  location: { type: Type.STRING },
                  outdoor_activity: { type: Type.STRING },
                  indoor_alternative: { type: Type.STRING },
                  english_vocabulary: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  }
                },
                required: ["title", "description", "steam_focus", "esl_focus", "location", "outdoor_activity", "indoor_alternative", "english_vocabulary"]
              }
            }
          },
          required: ["theme", "overview", "lessons"]
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("The AI returned an empty response. Please try again.");
    }

    // Attempt to extract JSON if it's wrapped in markdown
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const cleanJson = jsonMatch ? jsonMatch[0] : text;

    try {
      return JSON.parse(cleanJson);
    } catch (parseError) {
      console.error("JSON Parse Error. Raw text:", text);
      throw new Error("Failed to parse the curriculum data. The AI response was not in the expected format.");
    }
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    if (error.message?.includes("403") || error.message?.includes("API_KEY_INVALID")) {
      throw new Error("Invalid API Key. Please check your Gemini API configuration.");
    }
    if (error.message?.includes("500") || error.message?.includes("overloaded")) {
      throw new Error("The AI service is currently busy. Please wait a moment and try again.");
    }
    throw error;
  }
}
