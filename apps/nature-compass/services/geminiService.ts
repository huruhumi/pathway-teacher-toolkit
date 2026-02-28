import { GoogleGenAI, Type, Schema, Part } from "@google/genai";
import { LessonInput, LessonPlanResponse, VocabularyItem, VisualReferenceItem, RoadmapItem, UploadedFile } from "../types";

// --- Retry Logic Helpers ---
const MAX_RETRIES = 5;
const BASE_DELAY = 3000;

async function retryOperation<T>(operation: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  let lastError: any;

  for (let i = 0; i < MAX_RETRIES; i++) {
    if (signal?.aborted) {
      throw new Error("Operation aborted");
    }

    try {
      return await operation();
    } catch (error: any) {
      if (signal?.aborted) {
        throw new Error("Operation aborted");
      }
      lastError = error;

      const errorMessage = error?.message || JSON.stringify(error);
      const errorCode = error?.status || error?.code;

      const nestedErrorCode = error?.error?.code || error?.error?.status;
      const nestedErrorMessage = error?.error?.message;

      const isOverloaded =
        errorMessage.includes('503') ||
        errorMessage.includes('overloaded') ||
        errorCode === 503 ||
        nestedErrorCode === 503 ||
        (nestedErrorMessage && nestedErrorMessage.includes('overloaded'));

      const isRateLimited =
        errorMessage.includes('429') ||
        errorCode === 429 ||
        nestedErrorCode === 429;

      const isAuthError =
        errorMessage.includes('401') ||
        errorMessage.includes('403') ||
        errorMessage.includes('API key') ||
        errorCode === 401 ||
        errorCode === 403;

      if ((isOverloaded || isRateLimited) && i < MAX_RETRIES - 1) {
        const delay = BASE_DELAY * Math.pow(2, i);
        console.warn(`Gemini API busy (503/429). Retrying in ${delay}ms... (Attempt ${i + 1}/${MAX_RETRIES})`);

        // Wait with abort support
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            removeListeners();
            resolve();
          }, delay);

          const onAbort = () => {
            clearTimeout(timeout);
            removeListeners();
            reject(new Error("Operation aborted"));
          };

          const removeListeners = () => {
            signal?.removeEventListener('abort', onAbort);
          };

          signal?.addEventListener('abort', onAbort);
        });

        continue;
      }

      // If we reach here, it's a non-retryable error or we ran out of retries
      if (isAuthError) {
        throw new Error("Invalid API Key or authentication failed. Please check your .env file.");
      }
      if (isRateLimited) {
        throw new Error("Rate limit exceeded. Please wait a moment and try again.");
      }
      if (isOverloaded) {
        throw new Error("Gemini API is currently overloaded. Please try again in a few seconds.");
      }

      throw new Error(nestedErrorMessage || errorMessage || "An unexpected error occurred during AI generation.");
    }
  }
  throw lastError;
}

const THEME_PERSPECTIVES = [
  "Microscopic View (Zoom in on tiny details)",
  "Time Travel (Ancient past or distant future)",
  "Detective Mystery (Solving a nature riddle)",
  "Survival Mode (Living off the land)",
  "Alien Explorer (First time seeing Earth)",
  "Superhero Academy (Nature's superpowers)",
  "Chef's Kitchen (Edible science)",
  "Art Heist (Stealing colors/textures)",
  "Underground Kingdom (Roots and bugs)",
  "Sky Pirates (Wind and weather)"
];

const lessonPlanSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    missionBriefing: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: "A catchy title for the workshop." },
        narrative: { type: Type.STRING, description: "A 2-sentence hook narrative." },
      },
      required: ["title", "narrative"],
    },
    basicInfo: {
      type: Type.OBJECT,
      description: "Overview of the workshop details.",
      properties: {
        theme: { type: Type.STRING },
        activityType: { type: Type.STRING, description: "e.g. 'Outdoor STEAM / Biology' or 'Indoor Maker / Physics'" },
        targetAudience: { type: Type.STRING, description: "e.g. 'ESL Students Ages 6-8'" },
        learningGoals: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "3 specific learning objectives (Language & STEAM)."
        },
      },
      required: ["theme", "activityType", "targetAudience", "learningGoals"],
    },
    vocabulary: {
      type: Type.OBJECT,
      properties: {
        keywords: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              word: { type: Type.STRING },
              definition: { type: Type.STRING },
            },
            required: ["word", "definition"],
          },
        },
        phrases: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Essential classroom phrases.",
        },
      },
      required: ["keywords", "phrases"],
    },
    roadmap: {
      type: Type.ARRAY,
      description: "The schedule of activities.",
      items: {
        type: Type.OBJECT,
        properties: {
          timeRange: { type: Type.STRING, description: "e.g., 00-30m" },
          phase: { type: Type.STRING, description: "Phase name like 'Ice-breaking' or 'Core Challenge'" },
          activity: { type: Type.STRING, description: "Name of the specific activity" },
          activityType: { type: Type.STRING, description: "Type of activity e.g. 'Science', 'Art', 'Movement'." },
          location: { type: Type.STRING, description: "Specific setting for this step, e.g. 'Classroom Rug', 'Outdoor Garden', 'Science Lab'." },
          description: { type: Type.STRING, description: "A high-level summary including specific theme and context." },
          learningObjective: { type: Type.STRING, description: "Specific learning goal for this time block." },
          steps: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "3-5 detailed, actionable instructional steps for the teacher."
          },
          backgroundInfo: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "2-3 points of essential background knowledge (facts/concepts) for the teacher."
          },
          teachingTips: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "2-3 specific teaching methodology tips (e.g. TPR, checking questions, safety reminders, differentiation)."
          },
        },
        required: ["timeRange", "phase", "activity", "activityType", "location", "description", "learningObjective", "steps", "backgroundInfo", "teachingTips"],
      },
    },
    supplies: {
      type: Type.OBJECT,
      properties: {
        permanent: { type: Type.ARRAY, items: { type: Type.STRING } },
        consumables: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ["permanent", "consumables"],
    },
    safetyProtocol: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "A list of 3-5 specific safety measures or risk mitigations."
    },
    visualReferences: {
      type: Type.ARRAY,
      description: "A list of 3-5 visual aids needed for the lesson (e.g. finished craft example, process diagram).",
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING, description: "Short title of the visual aid." },
          description: { type: Type.STRING, description: "Detailed visual description for an artist or AI generator." },
          type: { type: Type.STRING, description: "Type of visual: 'Photo', 'Diagram', 'Illustration'." },
        },
        required: ["label", "description", "type"],
      },
    },
    handbookStylePrompt: {
      type: Type.STRING,
      description: "A comprehensive, universal style prompt for Notebook LM (or Midjourney) that defines the global aesthetic, color palette, and illustration style so all handbook pages look unified."
    },
    handbook: {
      type: Type.ARRAY,
      description: "A detailed design plan for a student handbook.",
      items: {
        type: Type.OBJECT,
        properties: {
          pageNumber: { type: Type.NUMBER },
          title: { type: Type.STRING },
          section: { type: Type.STRING, enum: ['Introduction', 'Safety', 'Background Knowledge', 'Reading', 'Instructions', 'Activity/Worksheet', 'Certificate'] },
          layoutDescription: { type: Type.STRING, description: "How the page should look (e.g. 'Split screen with large hero image')." },
          visualPrompt: { type: Type.STRING, description: "Prompt for generating the visual assets for this page." },
          contentPrompt: { type: Type.STRING, description: "Prompt to generate the text content for this page." },
        },
        required: ["pageNumber", "title", "section", "layoutDescription", "visualPrompt", "contentPrompt"]
      }
    },
    notebookLMPrompt: { type: Type.STRING, description: "A summary prompt for NotebookLM." },
    imagePrompts: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "3-5 descriptions for generating AI images/flashcards."
    },
  },
  required: ["missionBriefing", "basicInfo", "vocabulary", "roadmap", "supplies", "safetyProtocol", "visualReferences", "handbookStylePrompt", "handbook", "notebookLMPrompt", "imagePrompts"],
};

export const generateLessonPlan = async (input: LessonInput, signal?: AbortSignal): Promise<LessonPlanResponse> => {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
  const handbookPageCount = input.handbookPages || 15;

  const systemInstruction = `
    You are an expert STEAM Curriculum Designer and TESOL Specialist. 
    Goal: Generate a comprehensive ${input.duration}-minute "Nature Compass" weekend workshop plan for ESL students (Ages ${input.studentAge}).
    
    [Pedagogical Framework: 5E Instructional Model]
    You MUST structure the 'Roadmap' following the 5E sequence to ensure a systematic learning experience:
    1. ENGAGE: Hook the students, activate prior knowledge, and introduce the narrative.
    2. EXPLORE: Hands-on exploration where students interact with materials/nature.
    3. EXPLAIN: Formal introduction of vocabulary and scientific concepts.
    4. ELABORATE: Apply knowledge to a new challenge or creative project.
    5. EVALUATE: Review learning, check understanding, and celebrate success.

    [Parameters]
    - Theme: ${input.theme || "Derived from uploaded materials"}
    - Context/Introduction: ${input.topicIntroduction}
    - Season: ${input.season}
    - Weather Condition: ${input.weather}
    - Activity Focus: ${input.activityFocus.join(', ')}
    - CEFR Level: ${input.cefrLevel || 'A1 (Beginner)'}

    [Core Logic: Weather-Adaptive Strategy]
    - If "Sunny", prioritize high-engagement Outdoor exploration and data collection.
    - If "Rainy", pivot to Indoor Maker/Lab scenarios using natural specimens, simulations, or indoor experiments.

    [Roadmap Requirements]
    - Generate exactly 5-6 logical phases following the 5E model. 
    - Each phase must include detailed 'steps', 'backgroundInfo' (scientific/factual accuracy), and 'teachingTips' (ESL scaffolding like TPR, visual aids, or sentence frames).

    [Handbook Design Rules (CRITICAL)]
    You must design a ${handbookPageCount}-page student handbook that is directly synchronized with the Roadmap and deeply integrated with the lesson content.
    1. GLOBAL STYLE: Generate a 'handbookStylePrompt' that defines a global, universal aesthetic (e.g., "Whimsical watercolor, earth tones, friendly rounded fonts") so that if fed into NotebookLM/Midjourney, all >15 pages look like they belong to the same book.
    2. PROGRESSION: Cover -> Safety/Tools -> 5E Journey (Engage/Explore/Explain/Elaborate) -> Data Log/Observations -> Reflection -> Certificate.
    3. STRICT SYNCHRONIZATION: Every single Roadmap phase MUST have at least one corresponding 'Activity/Worksheet' or 'Reading' page in the Handbook. The handbook is the student's physical guide through the roadmap.
    4. BACKGROUND KNOWLEDGE INTEGRATION: You MUST extract the facts from the Roadmap's 'backgroundInfo' and translate them into student-facing 'Reading' passages or diagrams in the handbook. Do NOT leave facts only for the teacher. 
    5. RICH, EXACT CONTENT: The 'contentPrompt' must not be a vague summary. It MUST contain the EXACT text that goes on the page. Write the actual reading paragraphs, specific inquiry questions, exact fill-in-the-blank sentences, or observation instructions.
    6. AGE & LANGUAGE (CEFR) ADAPTATION (Target: Age ${input.studentAge}, CEFR ${input.cefrLevel}):
       - For Preschool/Early Primary (Ages 3-8) or Beginner (A1-A2): Use single target words, very simple 3-word commands, large visual labels, tracing exercises, matching games, and drawing activities.
       - For Upper Primary/Middle (Ages 9-14) or Intermediate+ (B1+): Write detailed multi-paragraph reading passages, complex graphic organizers, critical thinking questions, hypothesis formulation, and detailed data logging.
    7. PROMPT DETAIL: 
       - 'visualPrompt': Describe the exact illustration needed (specify style, e.g., "Line art for coloring", "Realistic scientific cross-section diagram", subject matter, and composition).
       - 'contentPrompt': The exact text content, questions, and worksheet structure to be printed on the page.
    8. CERTIFICATE PAGE: The final page (page ${handbookPageCount}) MUST be a beautifully designed "Certificate of Achievement". The layoutDescription and visualPrompt MUST explicitly include a beautiful 3x3cm circular placeholder area designated for the student to attach their physical badge sticker.

    Structure Requirement:
    - Mission Briefing: Engaging title & narrative.
    - Vocabulary: 8-10 key terms with simple definitions.
    - Handbook: Exactly ${handbookPageCount} pages of meticulously structured instructional design.
  `;

  // Handle uploaded files for context
  let contents: any = [{ text: "Please generate the lesson plan based on these requirements." }];

  if (input.uploadedFiles && input.uploadedFiles.length > 0) {
    const parts: Part[] = [];
    input.uploadedFiles.forEach(file => {
      if (file.type.startsWith('image/')) {
        parts.push({
          inlineData: {
            mimeType: file.type,
            data: file.data
          }
        });
      } else {
        // For text/pdf we use inlineData
        parts.push({
          inlineData: {
            mimeType: file.type,
            data: file.data
          }
        });
      }
    });
    parts.push({ text: "Reference materials attached above. Use them to shape the theme and activities." });
    contents = [{ parts }];
  }

  return await retryOperation(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', // Complex task
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: lessonPlanSchema,
        temperature: 0.5,
      },
      contents: contents
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    return JSON.parse(text) as LessonPlanResponse;
  }, signal);
};


// --- Streaming Version ---
// Attempts to use generateContentStream for progressive rendering.
// Calls onPartialResult as new JSON keys become available.
export const generateLessonPlanStreaming = async (
  input: LessonInput,
  onPartialResult: (partial: Partial<LessonPlanResponse>, completedKeys: string[]) => void,
  signal?: AbortSignal,
): Promise<LessonPlanResponse> => {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
  const handbookPageCount = input.handbookPages || 15;

  const systemInstruction = `
    You are an expert STEAM Curriculum Designer and TESOL Specialist. 
    Goal: Generate a comprehensive ${input.duration}-minute "Nature Compass" weekend workshop plan for ESL students (Ages ${input.studentAge}).
    
    [Pedagogical Framework: 5E Instructional Model]
    You MUST structure the 'Roadmap' following the 5E sequence to ensure a systematic learning experience:
    1. ENGAGE: Hook the students, activate prior knowledge, and introduce the narrative.
    2. EXPLORE: Hands-on exploration where students interact with materials/nature.
    3. EXPLAIN: Formal introduction of vocabulary and scientific concepts.
    4. ELABORATE: Apply knowledge to a new challenge or creative project.
    5. EVALUATE: Review learning, check understanding, and celebrate success.

    [Parameters]
    - Theme: ${input.theme || "Derived from uploaded materials"}
    - Context/Introduction: ${input.topicIntroduction}
    - Season: ${input.season}
    - Weather Condition: ${input.weather}
    - Activity Focus: ${input.activityFocus.join(', ')}
    - CEFR Level: ${input.cefrLevel || 'A1 (Beginner)'}

    [Core Logic: Weather-Adaptive Strategy]
    - If "Sunny", prioritize high-engagement Outdoor exploration and data collection.
    - If "Rainy", pivot to Indoor Maker/Lab scenarios using natural specimens, simulations, or indoor experiments.

    [Roadmap Requirements]
    - Generate exactly 5-6 logical phases following the 5E model. 
    - Each phase must include detailed 'steps', 'backgroundInfo' (scientific/factual accuracy), and 'teachingTips' (ESL scaffolding like TPR, visual aids, or sentence frames).

    [Handbook Design Rules (CRITICAL)]
    You must design a ${handbookPageCount}-page student handbook that is directly synchronized with the Roadmap and deeply integrated with the lesson content.
    1. GLOBAL STYLE: Generate a 'handbookStylePrompt' that defines a global, universal aesthetic (e.g., "Whimsical watercolor, earth tones, friendly rounded fonts") so that if fed into NotebookLM/Midjourney, all >15 pages look like they belong to the same book.
    2. PROGRESSION: Cover -> Safety/Tools -> 5E Journey (Engage/Explore/Explain/Elaborate) -> Data Log/Observations -> Reflection -> Certificate.
    3. STRICT SYNCHRONIZATION: Every single Roadmap phase MUST have at least one corresponding 'Activity/Worksheet' or 'Reading' page in the Handbook. The handbook is the student's physical guide through the roadmap.
    4. BACKGROUND KNOWLEDGE INTEGRATION: You MUST extract the facts from the Roadmap's 'backgroundInfo' and translate them into student-facing 'Reading' passages or diagrams in the handbook. Do NOT leave facts only for the teacher. 
    5. RICH, EXACT CONTENT: The 'contentPrompt' must not be a vague summary. It MUST contain the EXACT text that goes on the page. Write the actual reading paragraphs, specific inquiry questions, exact fill-in-the-blank sentences, or observation instructions.
    6. AGE & LANGUAGE (CEFR) ADAPTATION (Target: Age ${input.studentAge}, CEFR ${input.cefrLevel}):
       - For Preschool/Early Primary (Ages 3-8) or Beginner (A1-A2): Use single target words, very simple 3-word commands, large visual labels, tracing exercises, matching games, and drawing activities.
       - For Upper Primary/Middle (Ages 9-14) or Intermediate+ (B1+): Write detailed multi-paragraph reading passages, complex graphic organizers, critical thinking questions, hypothesis formulation, and detailed data logging.
       - 'visualPrompt': Describe the exact illustration needed (specify style, e.g., "Line art for coloring", "Realistic scientific cross-section diagram", subject matter, and composition).
       - 'contentPrompt': The exact text content, questions, and worksheet structure to be printed on the page.
    8. CERTIFICATE PAGE: The final page (page ${handbookPageCount}) MUST be a beautifully designed "Certificate of Achievement". The layoutDescription and visualPrompt MUST explicitly include a beautiful 3x3cm circular placeholder area designated for the student to attach their physical badge sticker.

    Structure Requirement:
    - Mission Briefing: Engaging title & narrative.
    - Vocabulary: 8-10 key terms with simple definitions.
    - Handbook: Exactly ${handbookPageCount} pages of meticulously structured instructional design.
  `;

  // Handle uploaded files for context
  let contents: any = [{ text: "Please generate the lesson plan based on these requirements." }];

  if (input.uploadedFiles && input.uploadedFiles.length > 0) {
    const parts: Part[] = [];
    input.uploadedFiles.forEach(file => {
      parts.push({
        inlineData: {
          mimeType: file.type,
          data: file.data
        }
      });
    });
    parts.push({ text: "Reference materials attached above. Use them to shape the theme and activities." });
    contents = [{ parts }];
  }

  let accumulatedText = '';
  let lastKnownKeys: string[] = [];

  const tryPartialParse = (text: string) => {
    try {
      const parsed = JSON.parse(text);
      const keys = Object.keys(parsed);
      if (keys.length > lastKnownKeys.length) {
        lastKnownKeys = keys;
        onPartialResult(parsed, keys);
      }
    } catch {
      // Try to extract partial JSON by closing open braces/brackets
      let attempt = text;
      const openBraces = (attempt.match(/{/g) || []).length;
      const closeBraces = (attempt.match(/}/g) || []).length;
      const openBrackets = (attempt.match(/\[/g) || []).length;
      const closeBrackets = (attempt.match(/\]/g) || []).length;

      // Close any trailing comma
      attempt = attempt.replace(/,\s*$/, '');

      // Close open brackets then braces
      for (let i = 0; i < openBrackets - closeBrackets; i++) attempt += ']';
      for (let i = 0; i < openBraces - closeBraces; i++) attempt += '}';

      try {
        const parsed = JSON.parse(attempt);
        const keys = Object.keys(parsed);
        if (keys.length > lastKnownKeys.length) {
          lastKnownKeys = keys;
          onPartialResult(parsed, keys);
        }
      } catch {
        // Still can't parse — skip this chunk
      }
    }
  };

  return await retryOperation(async () => {
    const response = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: lessonPlanSchema,
        temperature: 0.5,
      },
      contents: contents,
    });

    for await (const chunk of response) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

      const chunkText = chunk.text;
      if (chunkText) {
        accumulatedText += chunkText;
        tryPartialParse(accumulatedText);
      }
    }

    // Final parse
    if (!accumulatedText) throw new Error("No response from Gemini stream");
    return JSON.parse(accumulatedText) as LessonPlanResponse;
  }, signal);
};

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

export const generateSingleStep = async (context: any, currentSteps: string[]): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
  return await retryOperation(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Context: A teaching activity "${context.activity}" (${context.description}).
            Current steps: ${JSON.stringify(currentSteps)}.
            Task: Write the NEXT single logical instructional step for the teacher. Keep it actionable and concise. Return only the step text.`,
    });
    return response.text?.trim() || "Guide students through the next part of the activity.";
  });
};

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
        model: 'gemini-2.5-flash-image', // Specific for image generation
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

export const generateVocabularyItem = async (theme: string, existingWords: string[]): Promise<VocabularyItem> => {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
  return await retryOperation(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Theme: ${theme}. Existing words: ${existingWords.join(', ')}.
            Generate ONE new relevant vocabulary word and a simple definition for a child.
            Return JSON: { "word": "...", "definition": "..." }`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            word: { type: Type.STRING },
            definition: { type: Type.STRING }
          },
          required: ['word', 'definition']
        }
      }
    });
    return JSON.parse(response.text!) as VocabularyItem;
  });
};

export const generateVisualReferenceItem = async (theme: string, activityType: string, existingLabels: string[]): Promise<VisualReferenceItem> => {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
  return await retryOperation(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Theme: ${theme}. Activity: ${activityType}. Existing visuals: ${existingLabels.join(', ')}.
            Suggest ONE new visual reference aid (diagram, photo, etc) that would help the teacher.
            Return JSON: { "label": "...", "description": "...", "type": "..." }`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            label: { type: Type.STRING },
            description: { type: Type.STRING },
            type: { type: Type.STRING }
          },
          required: ['label', 'description', 'type']
        }
      }
    });
    return JSON.parse(response.text!) as VisualReferenceItem;
  });
};

export const generateRoadmapItem = async (theme: string, activityType: string, currentRoadmap: RoadmapItem[]): Promise<RoadmapItem> => {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
  // Define schema for single roadmap item to ensure type safety
  const roadmapItemSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      timeRange: { type: Type.STRING },
      phase: { type: Type.STRING },
      activity: { type: Type.STRING },
      activityType: { type: Type.STRING },
      location: { type: Type.STRING },
      description: { type: Type.STRING },
      learningObjective: { type: Type.STRING },
      steps: { type: Type.ARRAY, items: { type: Type.STRING } },
      backgroundInfo: { type: Type.ARRAY, items: { type: Type.STRING } },
      teachingTips: { type: Type.ARRAY, items: { type: Type.STRING } }
    },
    required: ["timeRange", "phase", "activity", "activityType", "location", "description", "learningObjective", "steps", "backgroundInfo", "teachingTips"]
  };

  return await retryOperation(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Theme: ${theme}. Activity Type: ${activityType}.
            Current phases: ${currentRoadmap.map(r => r.phase).join(', ')}.
            Generate the NEXT logical phase/activity for this workshop.
            Return JSON.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: roadmapItemSchema
      }
    });
    return JSON.parse(response.text!) as RoadmapItem;
  });
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

export const generateSingleBackgroundInfo = async (theme: string, activity: string, currentInfo: string[]): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
  return await retryOperation(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Theme: ${theme}. Activity: ${activity}.
            Current background info: ${currentInfo.join(' | ')}.
            Provide ONE new interesting fact or concept explanation for the teacher. Keep it brief. Return only text.`,
    });
    return response.text?.trim() || "Interesting fact about the topic.";
  });
};

export const generateSingleTeachingTip = async (theme: string, activity: string, currentTips: string[]): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
  return await retryOperation(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Theme: ${theme}. Activity: ${activity}.
            Current teaching tips: ${currentTips.join(' | ')}.
            Provide ONE new specific teaching tip (methodology, safety, or engagement). Keep it actionable and brief. Return only text.`,
    });
    return response.text?.trim() || "Guide students effectively.";
  });
};

export const translateLessonPlan = async (plan: LessonPlanResponse, targetLanguage: string, signal?: AbortSignal): Promise<LessonPlanResponse> => {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

  const systemInstruction = `
    You are an expert translator specializing in educational materials.
    Translate the provided JSON content into ${targetLanguage}.
    
    CRITICAL RULES:
    1. Translate all student-facing and teacher-facing descriptive text (titles, descriptions, facts, tips, roadmap activities, handbook content prompts, etc.).
    2. Maintain the EXACT SAME JSON structure, keys, and array lengths as the input.
    3. EXCEPTION: Do not translate the English 'keywords' in the vocabulary section. Only translate their 'definition'.
    4. EXCEPTION: Do not translate 'imagePrompts', 'visualPrompt', or 'handbookStylePrompt' if they are instructions for an AI image generator. Keep them in English for better image generation results.
    
    Return pure JSON matching the input structure.
  `;

  return await retryOperation(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: lessonPlanSchema,
        temperature: 0.1, // Low temp for accurate translation without hallucination
      },
      contents: [{ text: JSON.stringify(plan) }]
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini during translation");
    return JSON.parse(text) as LessonPlanResponse;
  }, signal);
};