
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { GeneratedContent, CEFRLevel, Game, Worksheet, ReadingPlanDay, ReadingTask, Flashcard, PhonicsContent, WebResource, LessonStage } from '../types';

// Helper function to retry API calls with exponential backoff
async function retryApiCall<T>(apiCall: () => Promise<T>, retries = 5, delay = 3000): Promise<T> {
  try {
    return await apiCall();
  } catch (error: any) {
    const status = error.status || error?.error?.code;
    const message = error.message || '';

    // Retry on rate limits or transient server errors
    // 429 is RESOURCE_EXHAUSTED (quota reached)
    const isRateLimit = status === 429 || message.toLowerCase().includes('429') || message.toLowerCase().includes('quota') || message.toLowerCase().includes('resource_exhausted');
    const isServerError = status === 503 || status === 500 || message.toLowerCase().includes('no image generated');

    if ((isRateLimit || isServerError) && retries > 0) {
      // If it's a rate limit, use a longer initial delay to respect the window
      const waitTime = isRateLimit ? delay * 2 : delay;
      console.warn(`API limit or error encountered (${status}). Retrying in ${waitTime}ms... (Retries left: ${retries})`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return retryApiCall(apiCall, retries - 1, delay * 1.5);
    }
    throw error;
  }
}

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    structuredLessonPlan: {
      type: Type.OBJECT,
      properties: {
        classInformation: {
          type: Type.OBJECT,
          properties: {
            level: { type: Type.STRING },
            topic: { type: Type.STRING },
            students: { type: Type.STRING },
            date: { type: Type.STRING },
          },
          required: ["level", "topic", "students", "date"]
        },
        lessonDetails: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING },
            aim: { type: Type.STRING },
            objectives: { type: Type.ARRAY, items: { type: Type.STRING } },
            materials: { type: Type.ARRAY, items: { type: Type.STRING } },
            targetVocab: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  word: { type: Type.STRING },
                  definition: { type: Type.STRING, description: "A simple, level-appropriate English explanation" }
                },
                required: ["word", "definition"]
              }
            },
            grammarSentences: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Key grammar rules and target sentences. DO NOT use markdown bold headers like '**Target Sentence:**'. Just provide the plain text."
            },
            anticipatedProblems: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  problem: { type: Type.STRING },
                  solution: { type: Type.STRING }
                }
              }
            }
          },
          required: ["type", "aim", "objectives", "materials", "targetVocab", "grammarSentences", "anticipatedProblems"]
        },
        stages: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              stage: { type: Type.STRING },
              stageAim: { type: Type.STRING },
              timing: { type: Type.STRING },
              interaction: { type: Type.STRING },
              teacherActivity: { type: Type.STRING, description: "Detailed numbered list of 5+ teacher actions" },
              studentActivity: { type: Type.STRING, description: "Detailed numbered list of 5+ student responses" }
            },
            required: ["stage", "stageAim", "timing", "interaction", "teacherActivity", "studentActivity"]
          }
        }
      },
      required: ["classInformation", "lessonDetails", "stages"]
    },
    lessonPlanMarkdown: {
      type: Type.STRING,
      description: "A summary of the lesson plan in Markdown format."
    },
    slides: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          content: { type: Type.STRING, description: "Slide text content, expanding on the topic from an ESL expert perspective. Do not blindly copy uploaded materials." },
          visual: { type: Type.STRING, description: "Visual description (what the slide should show, such as images, diagrams, or illustrations), referencing uploaded context but creatively adapted." },
          layoutDesign: { type: Type.STRING, description: "Layout design instructions (how the content and visual should be arranged on the slide for maximum ESL learning impact)." }
        },
        required: ["title", "content", "visual", "layoutDesign"]
      }
    },
    flashcards: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING, description: "The target vocabulary word or phrase" },
          definition: { type: Type.STRING, description: "Simple definition or sentence example" },
          visualPrompt: { type: Type.STRING, description: "A simple visual description of the word for AI image generation (e.g. 'A red apple')" },
          type: { type: Type.STRING, enum: ["vocabulary", "concept"] }
        },
        required: ["word", "definition", "visualPrompt", "type"]
      }
    },
    games: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          type: { type: Type.STRING, description: "Game Category e.g., Warm-up, Review" },
          interactionType: {
            type: Type.STRING,
            enum: ["Physical Movement", "Group Collaboration", "Digital Tool", "Individual Focus"],
            description: "Type of student interaction required."
          },
          instructions: { type: Type.STRING, description: "Detailed numbered instructions. Every step MUST start with a number and a new line." },
          materials: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["name", "type", "interactionType", "instructions", "materials"]
      }
    },
    phonics: {
      type: Type.OBJECT,
      properties: {
        keyPoints: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3-5 phonics patterns, sounds, or rules found in the uploaded teaching materials or target vocabulary." },
        decodableTexts: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A few level-appropriate short rhyming stories or texts. Constraints: EXACTLY 5-8 lines long. EXACTLY 5-8 words per line. IMPORTANT: The story MUST be highly logical and make sense. Include phonics extension words (wrap in <span style='color: #10b981; font-weight: bold;'>word</span>), sight words (wrap in <span style='color: #eab308; font-weight: bold;'>word</span>), and target lesson words (wrap in <span style='color: #8b5cf6; font-weight: bold;'>word</span>). Do NOT use more than 5 words that are outside of the target lesson vocabulary or standard sight words. Each text MUST start with a Catchy TITLE in ALL CAPS on the first line. The story should be written in a rhythmic, rhyming style (e.g., AABB or ABAB). EVERY SINGLE SENTENCE MUST start on its own new line (use <br/> for line breaks instead of \n since it is HTML)." },
        decodableTextPrompts: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Simple visual prompts for AI image generation describing the scene in each decodable text." }
      },
      required: ["keyPoints", "decodableTexts", "decodableTextPrompts"]
    },
    readingCompanion: {
      type: Type.OBJECT,
      properties: {
        days: {
          type: Type.ARRAY,
          description: "MUST contain EXACTLY 7 items, covering Day 1 to Day 7 in chronological order.",
          items: {
            type: Type.OBJECT,
            properties: {
              day: { type: Type.NUMBER },
              focus: { type: Type.STRING },
              focus_cn: { type: Type.STRING, description: "Chinese translation of focus" },
              activity: { type: Type.STRING },
              activity_cn: { type: Type.STRING, description: "Chinese translation of activity" },
              tasks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    text: { type: Type.STRING, description: "Task description in English" },
                    text_cn: { type: Type.STRING, description: "Task description in Chinese" },
                    isCompleted: { type: Type.BOOLEAN, description: "Always false initially" }
                  },
                  required: ["text", "text_cn"]
                }
              },
              resources: {
                type: Type.ARRAY,
                description: "MUST contain at least 1 relevant web resource (YouTube video, article, interactive tool) related to the day's focus. Always provide real, working URLs.",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    title_cn: { type: Type.STRING },
                    url: { type: Type.STRING },
                    description: { type: Type.STRING },
                    description_cn: { type: Type.STRING }
                  },
                  required: ["title", "title_cn", "url", "description", "description_cn"]
                }
              },
              trivia: {
                type: Type.OBJECT,
                properties: {
                  en: { type: Type.STRING, description: "A short, engaging trivia fact in English related to the day's focus." },
                  cn: { type: Type.STRING, description: "Chinese translation of the trivia fact." }
                },
                required: ["en", "cn"]
              }
            },
            required: ["day", "focus", "focus_cn", "activity", "activity_cn", "tasks", "trivia", "resources"]
          }
        },
        webResources: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              title_cn: { type: Type.STRING, description: "Chinese translation of title" },
              url: { type: Type.STRING },
              description: { type: Type.STRING },
              description_cn: { type: Type.STRING, description: "Chinese translation of description" }
            },
            required: ["title", "title_cn", "url", "description", "description_cn"]
          },
          description: "Suggested external web resources (videos, articles) related to the topic."
        }
      },
      required: ["days", "webResources"]
    },
    notebookLMPrompt: {
      type: Type.STRING,
      description: "A specialized prompt for NotebookLM to generate the slides. Must instruct NotebookLM to use the newly provided 'Visual' and 'Layout Design' for each slide. CRITICAL: Provide a 'Global Style & Formatting Guidelines' section at the top of this prompt to ensure consistent colors, fonts, and illustration styles across all slides."
    },
    summary: {
      type: Type.OBJECT,
      properties: {
        objectives: { type: Type.STRING },
        targetVocab: { type: Type.ARRAY, items: { type: Type.STRING } },
        grammarPoints: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ["objectives", "targetVocab", "grammarPoints"]
    }
  },
  required: ["structuredLessonPlan", "lessonPlanMarkdown", "slides", "flashcards", "games", "readingCompanion", "notebookLMPrompt", "summary", "phonics"]
};

// Utility to strip markdown bold prefixes
const cleanMarkdownPrefix = (s: string) => s.replace(/^\*\*.*?\*\*[:\s]*/, '').trim();

export const generateLessonPlan = async (
  textInput: string,
  images: File[],
  level: CEFRLevel,
  topic: string,
  slideCount: number,
  duration: string,
  studentCount: string,
  lessonTitle: string
): Promise<GeneratedContent> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const parts: any[] = [{
    text: `Generate a complete lesson kit for Level: ${level}, Topic: ${lessonTitle}${topic ? ` (${topic})` : ''}, Duration: ${duration} mins, Students: ${studentCount}. ${textInput ? `Context: ${textInput}` : ''}. 
  CRITICAL: The official title of this lesson is "${lessonTitle}". Use this exactly for the "structuredLessonPlan.classInformation.topic" and any main headers.
  CRITICAL: You MUST generate EXACTLY ${slideCount} slides in the "slides" array. Do not generate more or less.
  CRITICAL: For the slides, act as an expert ESL curriculum designer. The slides should follow the pedagogical flow of the lesson plan smoothly. Use the uploaded context/text for reference but DO NOT completely copy it; expand creatively.
  CRITICAL: You MUST generate exactly 7 review days in the "readingCompanion.days" array. Do not skip any days. Number them 1 through 7.
  CRITICAL: Each review day MUST include at least 1 web resource in its "resources" array. Provide real, working URLs to YouTube videos, educational articles, or interactive tools that are directly relevant to that day's focus topic. Do NOT leave resources empty.
  CRITICAL: If ${slideCount} > 15, you MUST explicitly include a "Global Style & Formatting Guidelines" section at the very beginning of the "notebookLMPrompt". This section must define a strict, unified visual style (specific color palette hex codes, typography/fonts, and 2D/3D illustration style) to ensure absolute visual consistency when the user generates these slides in multiple batches in NotebookLM.
  IMPORTANT: In grammar sentences, do not include any bold headers like **Target Sentence:**. Just provide the plain text.` }];

  for (const img of images) {
    const base64 = await fileToBase64(img);
    parts.push({
      inlineData: {
        mimeType: img.type,
        data: base64.split(',')[1],
      },
    });
  }

  const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: { parts },
    config: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA as any,
    }
  }));

  const content = JSON.parse(response.text || "{}");

  // Clean grammar sentences from initial full generation
  if (content.structuredLessonPlan?.lessonDetails?.grammarSentences) {
    content.structuredLessonPlan.lessonDetails.grammarSentences =
      content.structuredLessonPlan.lessonDetails.grammarSentences.map((s: string) => cleanMarkdownPrefix(s));
  }

  // Initialize worksheets as empty array
  if (!content.worksheets) {
    content.worksheets = [];
  }

  return content;
};

export const generateLessonImage = async (prompt: string, aspectRatio: string = "1:1"): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: prompt }] },
    config: {
      imageConfig: { aspectRatio: aspectRatio as any }
    }
  }));

  if (response.candidates && response.candidates.length > 0) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
  }
  throw new Error("No image generated");
};

export const generateWorksheet = async (level: CEFRLevel, topic: string, configs: any[]): Promise<Worksheet> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  let instructionsText = `Generate a worksheet for Level: ${level}, Topic: ${topic} based on these configs: ${JSON.stringify(configs)}. `;

  if (configs.some(c => c.type === 'Cloze Test')) {
    instructionsText += `CRITICAL for "Cloze Test" type: You MUST generate a reading passage in the 'passage' field with numbered blanks like (1), (2), (3), etc. The corresponding items in that section MUST have 'question' text like "Blank (1)", "Blank (2)", etc., and MUST use 'multiple-choice' layout with exactly 4 options each. Set the 'layout' field of the Cloze Test section to 'multiple-choice'. `;
  }

  if (configs.some(c => c.type === 'Error Correction')) {
    instructionsText += `CRITICAL for "Error Correction" type: You MUST generate a short reading passage in the 'passage' field that contains a specific number of errors (equal to the 'count' provided). Each section item should identify the wrong word/phrase in 'question' and the correct version in 'answer'. Set the 'layout' field of the Error Correction section to 'error-correction'. `;
  }

  if (configs.some(c => c.type === 'Picture Description')) {
    instructionsText += `CRITICAL for "Picture Description" type: This is a writing task. Set the 'layout' to 'essay'. Provide a descriptive writing prompt in 'question' and suggest a target word count (e.g. 50 or 100) in the 'wordCount' field of the item. `;
  }

  const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: instructionsText,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          type: { type: Type.STRING },
          instructions: { type: Type.STRING },
          sections: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                passageTitle: { type: Type.STRING },
                passage: { type: Type.STRING },
                layout: { type: Type.STRING, enum: ["standard", "matching", "multiple-choice", "essay", "error-correction"] },
                items: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      question: { type: Type.STRING },
                      answer: { type: Type.STRING },
                      options: { type: Type.ARRAY, items: { type: Type.STRING } },
                      visualPrompt: { type: Type.STRING },
                      wordCount: { type: Type.NUMBER, description: "Suggested word count for writing tasks" }
                    },
                    required: ["question", "answer"]
                  }
                }
              },
              required: ["title", "items"]
            }
          }
        },
        required: ["title", "instructions", "sections"]
      } as any
    }
  }));

  return JSON.parse(response.text || "{}");
};

export const generateSingleGame = async (level: CEFRLevel, topic: string, skill: string, type: string, context: string): Promise<Game> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Generate a single educational game for Level: ${level}, Topic: ${topic}, Skill: ${skill}, Type: ${type}. Context: ${context}. Return the result in the specified JSON format.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          type: { type: Type.STRING },
          interactionType: { type: Type.STRING },
          instructions: { type: Type.STRING },
          materials: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["name", "type", "interactionType", "instructions", "materials"]
      } as any
    }
  }));
  return JSON.parse(response.text || "{}");
};

export const generateReadingTask = async (level: CEFRLevel, topic: string, focus: string): Promise<ReadingTask> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Generate a post-class reading or review task for Level: ${level}, Topic: ${topic}, Focus: ${focus}. Provide both English and Chinese. Return JSON.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING },
          text_cn: { type: Type.STRING },
          isCompleted: { type: Type.BOOLEAN }
        },
        required: ["text", "text_cn"]
      } as any
    }
  }));
  const data = JSON.parse(response.text || "{}");
  return { ...data, isCompleted: false };
};

export const generateWebResource = async (topic: string, focus: string): Promise<WebResource> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Suggest a high-quality educational web resource (YouTube, National Geographic, etc.) for Topic: ${topic}, Focus: ${focus}. Return JSON.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          title_cn: { type: Type.STRING },
          url: { type: Type.STRING },
          description: { type: Type.STRING },
          description_cn: { type: Type.STRING }
        },
        required: ["title", "title_cn", "url", "description", "description_cn"]
      } as any
    }
  }));
  return JSON.parse(response.text || "{}");
};

export const generateNewCompanionDay = async (level: CEFRLevel, topic: string, dayNum: number): Promise<ReadingPlanDay> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Generate Day ${dayNum} of a 7-day review plan for Level: ${level}, Topic: ${topic}. Return JSON.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: (RESPONSE_SCHEMA.properties.readingCompanion.properties.days as any).items
    }
  }));
  return JSON.parse(response.text || "{}");
};

export const generateSingleFlashcard = async (level: CEFRLevel, topic: string, existingWords: string[]): Promise<Flashcard> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Generate a new target vocabulary flashcard for Level: ${level}, Topic: ${topic}. Avoid: ${existingWords.join(", ")}. Return JSON.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: (RESPONSE_SCHEMA.properties.flashcards as any).items
    }
  }));
  return JSON.parse(response.text || "{}");
};

export const generateSingleGrammarPoint = async (level: CEFRLevel, topic: string, existingPoints: string[]): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Generate one new grammar rule or target sentence for Level: ${level}, Topic: ${topic}. Avoid repeating: ${existingPoints.join(". ")}. DO NOT use markdown bold headers. Return ONLY the plain text string of the rule/sentence.`,
  }));
  return cleanMarkdownPrefix(response.text || "");
};

export const generateSingleObjective = async (level: CEFRLevel, topic: string, existing: string[]): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Generate one specific learning objective for Level: ${level}, Topic: ${topic}. It MUST follow the format: "Students will be able to [action] [content]". Existing ones: ${existing.join(". ")}. Return ONLY the objective text string.`,
  }));
  return response.text?.trim() || "";
};

export const generateSingleMaterial = async (level: CEFRLevel, topic: string, existing: string[]): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Suggest one teaching material or piece of equipment for Level: ${level}, Topic: ${topic}. Existing: ${existing.join(", ")}. Return ONLY the material name string.`,
  }));
  return response.text?.trim() || "";
};

export const generateSingleAnticipatedProblem = async (level: CEFRLevel, topic: string, existing: any[]): Promise<{ problem: string, solution: string }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Identify one anticipated learning problem and its practical solution for Level: ${level}, Topic: ${topic}. Existing: ${JSON.stringify(existing)}. Return JSON.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          problem: { type: Type.STRING },
          solution: { type: Type.STRING }
        },
        required: ["problem", "solution"]
      } as any
    }
  }));
  return JSON.parse(response.text || "{}");
};

export const generateSingleVocabItem = async (level: CEFRLevel, topic: string, existing: any[]): Promise<{ word: string, definition: string }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Generate one new target vocabulary word and its simple English definition for Level: ${level}, Topic: ${topic}. Existing: ${JSON.stringify(existing)}. Return JSON.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING },
          definition: { type: Type.STRING }
        },
        required: ["word", "definition"]
      } as any
    }
  }));
  return JSON.parse(response.text || "{}");
};

export const generateSingleStage = async (level: CEFRLevel, topic: string, existingStages: any[]): Promise<LessonStage> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Generate one cohesive teaching stage (e.g., Warm-up, Presentation, Practice, or Production) for Level: ${level}, Topic: ${topic}. It must complement the previous stages. Previous stages: ${JSON.stringify(existingStages)}. Return JSON.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: (RESPONSE_SCHEMA.properties.structuredLessonPlan.properties.stages as any).items
    }
  }));
  return JSON.parse(response.text || "{}");
};

export const generateSinglePhonicsPoint = async (level: CEFRLevel, topic: string, existingPoints: string[], vocab: string[]): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Identify one specific phonics pattern or sound for Level: ${level}, Topic: ${topic} using vocabulary like ${vocab.join(", ")}. 
    You MUST use the format: "Category name: Word1, Word2, Word3". 
    Example: "Initial sound S: Sun, Sit, Sad". 
    Return ONLY the string. Do NOT provide any introductory text. Avoid repeating: ${existingPoints.join(", ")}`,
  }));
  return response.text?.trim() || "";
};

export const generateSingleDecodableText = async (level: CEFRLevel, topic: string, points: string[], vocab: string[]): Promise<{ text: string, visualPrompt: string }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Create a highly logical, engaging decodable rhyming story for Level: ${level}.
Focus heavily on the target sounds: ${points.join(", ")}.
Include the target vocabulary: ${vocab.join(", ")}.
CRITICAL LENGTH LIMITS: The story MUST be EXACTLY 5 to 8 lines long. Each line MUST have EXACTLY 5 to 8 words.
CRITICAL VOCABULARY & COLOR LIMITS: 
1. The story must make logical sense.
2. Target words must be wrapped in <span style='color: #8b5cf6; font-weight: bold;'>word</span> (Purple).
3. Sight words must be wrapped in <span style='color: #eab308; font-weight: bold;'>word</span> (Yellow).
4. Phonics extension words (words following the target sound rules but not in target vocab) must be wrapped in <span style='color: #10b981; font-weight: bold;'>word</span> (Green).
5. You may NOT use more than 5 words that fall completely outside of these categories.
CRITICAL RHYMING: The story MUST be written with a fun, rhythmic, rhyming structure (e.g., AABB or ABAB rhyme scheme).
Format: Start with a catchy ALL CAPS TITLE on the first line. Then write the story below it, using <br/> for line breaks so EVERY SINGLE SENTENCE starts on a new line. Return HTML inside the JSON string.
Also provide a simple visual prompt describing the scene for an AI image generator. Return JSON.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING },
          visualPrompt: { type: Type.STRING }
        },
        required: ["text", "visualPrompt"]
      } as any
    }
  }));
  return JSON.parse(response.text || "{}");
};

export const generateTrivia = async (topic: string, focus: string): Promise<{ en: string; cn: string }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Generate a trivia fact about ${topic} focusing on ${focus}. Return JSON.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          en: { type: Type.STRING },
          cn: { type: Type.STRING }
        },
        required: ["en", "cn"]
      } as any
    }
  }));
  return JSON.parse(response.text || "{}");
};

export const generateReadingPassage = async (level: string, topic: string, vocab: string[]): Promise<{ title: string, text: string }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Generate a short reading passage (about 100-150 words) appropriate for ESL Level: ${level}, Topic: ${topic}. Try to incorporate some of this target vocabulary if relevant: ${vocab.join(", ")}. Return the result as a JSON object with 'title' and 'text' fields.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          text: { type: Type.STRING }
        },
        required: ["title", "text"]
      } as any
    }
  }));
  return JSON.parse(response.text || "{}");
};

export const translateLessonKit = async (content: any, targetLanguage: string = "Chinese"): Promise<any> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `You are an expert educational translator. I am providing a JSON object representing an English ESL lesson kit. 
Translate ALL nested string values (including lesson plans, slide outlines, games, reading passages, worksheets, phonics texts, etc.) into natural, professional ${targetLanguage}.
CRITICAL INSTRUCTIONS:
1. DO NOT translate any JSON keys or property names. Keep them exactly as they are.
2. DO NOT translate or alter any HTML tags (like <span style='...'>, <br/>, etc.). Only translate the text content inside them.
3. DO NOT change the structure of the JSON arrays or objects.
4. If a string contains a URL or a specific grammatical pattern that shouldn't be translated, adapt it reasonably or leave it in English if appropriate.
5. Return ONLY the translated JSON object.

JSON to translate:
${JSON.stringify(content)}`,
    config: {
      responseMimeType: "application/json",
    }
  }));
  return JSON.parse(response.text || "{}");
};

// Utility to convert File to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};
