import { Type } from "@google/genai";
import { retryAICall } from '@pathway/ai';

export const retryApiCall = <T>(
  apiCall: () => Promise<T>,
  retries = 5,
  delay = 3000,
  signal?: AbortSignal
): Promise<T> => retryAICall(apiCall, signal);

const FLASHCARD_ITEM_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    word: { type: Type.STRING, description: "The target vocabulary word or phrase" },
    definition: { type: Type.STRING, description: "Simple definition or sentence example" },
    visualPrompt: { type: Type.STRING, description: "A simple visual description of the word for AI image generation (e.g. 'A red apple')" },
    type: { type: Type.STRING, enum: ["vocabulary", "concept"] }
  },
  required: ["word", "definition", "visualPrompt", "type"]
} as const;

const STAGE_ITEM_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    stage: { type: Type.STRING },
    stageAim: { type: Type.STRING },
    timing: { type: Type.STRING },
    interaction: { type: Type.STRING, description: "Comma-separated interaction modes, one per numbered step in teacherActivity/studentActivity. Use standard ESL codes: T-S (teacher to students), S-S (student to student), S-S (pairs), S-S (groups), T-Ss, S-T, etc. Must have the same count as the numbered steps." },
    teacherActivity: { type: Type.STRING, description: "Detailed numbered list of 5+ teacher actions" },
    studentActivity: { type: Type.STRING, description: "Detailed numbered list of 5+ student responses" },
    teachingTips: { type: Type.ARRAY, items: { type: Type.STRING }, description: "2-3 practical ESL teaching methodology tips for this specific stage (e.g., scaffolding techniques, TPR suggestions, visual aids, sentence frames, error correction strategies)." },
    backgroundKnowledge: { type: Type.ARRAY, items: { type: Type.STRING }, description: "2-3 relevant background knowledge points for the teacher about this stage's content (cultural context, linguistic notes, common misconceptions, subject matter facts)." },
    fillerActivity: { type: Type.STRING, description: "A quick 2-3 minute optional filler/extension activity for this stage in case students finish early or need extra practice. Keep it simple and equipment-free." },
    suggestedGameName: { type: Type.STRING, description: "Name of a game/activity that would work well at this stage. This will be used to generate a matching activity card." }
  },
  required: ["stage", "stageAim", "timing", "interaction", "teacherActivity", "studentActivity", "teachingTips", "backgroundKnowledge", "fillerActivity", "suggestedGameName"]
} as const;

const READING_COMPANION_DAY_SCHEMA = {
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
} as const;

export const responseSchemaFragments = {
  flashcard: FLASHCARD_ITEM_SCHEMA,
  lessonStage: STAGE_ITEM_SCHEMA,
  readingCompanionDay: READING_COMPANION_DAY_SCHEMA,
} as const;

export const cleanMarkdownPrefix = (s: string) => s.replace(/^\*\*.*?\*\*[:\s]*/, '').trim();
