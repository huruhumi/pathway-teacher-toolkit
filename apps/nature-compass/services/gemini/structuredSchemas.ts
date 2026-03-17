import { Type, type Schema } from '@google/genai';

export const topicExtractionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    topics: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    suggestedTheme: { type: Type.STRING },
    suggestedIntro: { type: Type.STRING },
  },
  required: ['topics', 'suggestedTheme', 'suggestedIntro'],
};

export const structuredPlanSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    missionBriefing: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        narrative: { type: Type.STRING },
      },
      required: ['title', 'narrative'],
    },
    basicInfo: {
      type: Type.OBJECT,
      properties: {
        theme: { type: Type.STRING },
        activityType: { type: Type.STRING },
        targetAudience: { type: Type.STRING },
        location: { type: Type.STRING },
        learningGoals: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ['theme', 'activityType', 'targetAudience', 'location', 'learningGoals'],
    },
    roadmap: {
      type: Type.ARRAY,
      items: {
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
        required: ['timeRange', 'phase', 'activity', 'activityType', 'location', 'description', 'learningObjective', 'steps', 'backgroundInfo', 'teachingTips', 'activityInstructions'],
      },
    },
    vocabulary: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING },
          definition: { type: Type.STRING },
        },
        required: ['word', 'definition'],
      },
    },
    safetyProtocol: { type: Type.ARRAY, items: { type: Type.STRING } },
    supplies: {
      type: Type.OBJECT,
      properties: {
        permanent: { type: Type.ARRAY, items: { type: Type.STRING } },
        consumables: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ['permanent', 'consumables'],
    },
    imagePrompts: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['missionBriefing', 'basicInfo', 'roadmap', 'vocabulary', 'safetyProtocol', 'supplies', 'imagePrompts'],
};

export const handbookPageSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    handbookStylePrompt: { type: Type.STRING },
    notebookLMPrompt: { type: Type.STRING },
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
          contentPrompt: { type: Type.STRING },
          teacherContentPrompt: { type: Type.STRING },
          phaseIndex: { type: Type.NUMBER },
        },
        required: ['pageNumber', 'title', 'section', 'layoutDescription', 'visualPrompt', 'contentPrompt'],
      },
    },
  },
  required: ['handbookStylePrompt', 'notebookLMPrompt', 'handbook'],
};
