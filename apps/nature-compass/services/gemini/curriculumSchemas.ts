import { Type, type Schema } from "@google/genai";

export const locationSuggestionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    locations: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: ["locations"],
};

const lessonSchema: Schema = {
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
      items: { type: Type.STRING },
    },
  },
  required: ["title", "description", "steam_focus", "esl_focus", "location", "outdoor_activity", "indoor_alternative", "english_vocabulary"],
};

export const curriculumResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    theme: { type: Type.STRING },
    overview: { type: Type.STRING },
    lessons: {
      type: Type.ARRAY,
      items: lessonSchema,
    },
  },
  required: ["theme", "overview", "lessons"],
};

export const curriculumSchema: Schema = {
  ...curriculumResponseSchema,
  required: ["theme", "overview", "lessons"] as string[],
};

export const roadmapItemSchema: Schema = {
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
    teachingTips: { type: Type.ARRAY, items: { type: Type.STRING } },
    activityInstructions: { type: Type.STRING },
  },
  required: ["timeRange", "phase", "activity", "activityType", "location", "description", "learningObjective", "steps", "backgroundInfo", "teachingTips", "activityInstructions"] as string[],
};

export const downstreamSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    handbook: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          pageNumber: { type: Type.NUMBER },
          title: { type: Type.STRING },
          section: { type: Type.STRING },
          layoutDescription: { type: Type.STRING },
          visualPrompt: { type: Type.STRING },
          contentPrompt: { type: Type.STRING, description: "Text content for the page. MUST incorporate 'activityInstructions' and 'backgroundInfo' from the corresponding roadmap phase." },
          teacherContentPrompt: { type: Type.STRING, description: "Teacher-facing content: teaching objective, opening script, guided discussion questions based directly on 'teachingTips'." },
          phaseIndex: { type: Type.NUMBER, description: "0-based index of the Roadmap Phase this page belongs to. MANDATORY." },
        },
        required: ["pageNumber", "title", "section", "layoutDescription", "visualPrompt", "contentPrompt", "teacherContentPrompt", "phaseIndex"] as string[],
      },
    },
    supplies: {
      type: Type.OBJECT,
      properties: {
        permanent: { type: Type.ARRAY, items: { type: Type.STRING } },
        consumables: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ["permanent", "consumables"] as string[],
    },
    imagePrompts: { type: Type.ARRAY, items: { type: Type.STRING } },
    notebookLMPrompt: { type: Type.STRING },
    handbookStylePrompt: { type: Type.STRING },
  },
  required: ["handbook", "supplies", "imagePrompts", "notebookLMPrompt", "handbookStylePrompt"] as string[],
};
