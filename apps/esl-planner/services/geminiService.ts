
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { GeneratedContent, CEFRLevel } from '../types';

import { retryWithBackoff } from '@shared/retryWithBackoff';

// Exported for sub-modules (worksheetService, itemGenerators, curriculumService)
export const retryApiCall = <T>(apiCall: () => Promise<T>, retries = 5, delay = 3000): Promise<T> =>
  retryWithBackoff(apiCall, { maxRetries: retries, baseDelay: delay });

export const RESPONSE_SCHEMA = {
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

// Utility to strip markdown bold prefixes (exported for sub-modules)
export const cleanMarkdownPrefix = (s: string) => s.replace(/^\*\*.*?\*\*[:\s]*/, '').trim();

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
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

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
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
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

// Utility to convert File to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

// --- Barrel re-exports from sub-modules ---
// Consumers can keep importing from 'geminiService' unchanged.
export { generateWorksheet, generateSingleGame, generateReadingTask, generateWebResource, generateNewCompanionDay, generateTrivia, generateReadingPassage } from './worksheetService';
export { generateSingleFlashcard, generateSingleGrammarPoint, generateSingleObjective, generateSingleMaterial, generateSingleAnticipatedProblem, generateSingleVocabItem, generateSingleStage, generateSinglePhonicsPoint, generateSingleDecodableText } from './itemGenerators';
export { generateESLCurriculum, translateLessonKit } from './curriculumService';
