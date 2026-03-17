import { Schema, Type } from "@google/genai";

export const lessonPlanSchema: Schema = {
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
        theme: { type: Type.STRING, description: "The specific workshop theme/topic as provided in the parameters. Must match the user-specified theme, NOT the app name." },
        activityType: { type: Type.STRING, description: "e.g. 'Outdoor STEAM / Biology' or 'Indoor Maker / Physics'" },
        targetAudience: { type: Type.STRING, description: "e.g. 'ESL Students Ages 6-8'" },
        location: { type: Type.STRING, description: "The primary venue/location for this workshop, e.g. 'Wuhan Wetland Park', 'School Garden', 'Classroom'. If derived from curriculum, use the curriculum-specified location." },
        learningGoals: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "3 specific learning objectives (Language & STEAM)."
        },
      },
      required: ["theme", "activityType", "targetAudience", "location", "learningGoals"],
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
          location: { type: Type.STRING, description: "Specific setting for this step, e.g. 'Classroom Rug', 'Outdoor Garden', 'Science Lab'. MUST NOT be empty." },
          description: { type: Type.STRING, description: "MUST NOT be empty. A detailed narrative (6-8 sentences minimum) including specific theme, context, factual content, and enough detail to serve as source material for handbook Activity/Worksheet pages. Do NOT write a vague summary 鈥?include concrete actions, locations, and subject matter." },
          learningObjective: { type: Type.STRING, description: "Specific learning goal for this time block. MUST NOT be empty." },
          steps: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "MUST NOT be empty or contain placeholder text. 5-7 detailed, actionable instructional steps for the teacher. Each step must be a complete, specific instruction."
          },
          backgroundInfo: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "MUST NOT be empty. These are PRIMARY source material for handbook Background Knowledge pages (which now also include reading material). 5-8 detailed factual points with specific data, names, numbers, and explanations. Include scientific names, historical dates, measurable quantities, cause-effect explanations. Also include 1-2 inquiry-based questions and relevant vocabulary callouts."
          },
          teachingTips: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "MUST NOT be empty. 3-5 specific tips covering: (1) ESL/bilingual scaffolding (TPR, visual aids, sentence frames), (2) outdoor classroom management (attention signals like clapping patterns, boundary markers, buddy system, countdown timers), (3) group activity structure (clear role assignments like recorder/observer/collector, rotation protocols), (4) differentiation strategies, (5) emergency response tips."
          },
          activityInstructions: {
            type: Type.STRING,
            description: "Student-facing activity instructions for this phase. Must include: (1) Activity goal in 1 sentence, (2) Materials needed, (3) Step-by-step instructions (numbered, 4-8 steps, each with specific actions), (4) Time allocation per step. This text will be used directly in handbook Activity pages."
          },
        },
        required: ["timeRange", "phase", "activity", "activityType", "location", "description", "learningObjective", "steps", "backgroundInfo", "teachingTips", "activityInstructions"],
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
      description: "A comprehensive list of 6-10 specific safety measures covering: adult-child ratios, boundary rules, tool handling, biological contact, sun/bug protection, emergency procedures, weather-specific risks, and allergy awareness."
    },
    visualReferences: {
      type: Type.ARRAY,
      description: "A list of 3-5 visual aids needed for the lesson (e.g. finished craft example, process diagram).",
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING, description: "Short title of the visual aid." },
          description: { type: Type.STRING, description: "Detailed visual description for an artist or AI generator." },
          type: { type: Type.STRING, description: "Type of visual aid, such as Photo, Diagram, or Illustration." },
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
          section: { type: Type.STRING, description: "Page category or section name for this handbook page." },
          layoutDescription: { type: Type.STRING, description: "How the page should look (e.g. 'Split screen with large hero image')." },
          visualPrompt: { type: Type.STRING, description: "Prompt for generating the visual assets for this page." },
          contentPrompt: { type: Type.STRING, description: "Prompt to generate the text content for this page." },
          teacherContentPrompt: { type: Type.STRING, description: "Teacher-facing content for this page: teaching objective, opening script (2-3 sentences), 3-5 guided discussion questions, differentiation tips, time control, extended knowledge. Only required for Background Knowledge and Activity/Worksheet pages." },
          phaseIndex: { type: Type.NUMBER, description: "Index into the roadmap array (0-based) that this page belongs to. REQUIRED for Background Knowledge and Activity/Worksheet pages. Omit for system pages (Cover, ToC, Safety, Prop Checklist, Reflection, Certificate, Back Cover)." },
        },
        required: ["pageNumber", "title", "section", "layoutDescription", "visualPrompt", "contentPrompt"]
      }
    },
    notebookLMPrompt: { type: Type.STRING, description: "A summary prompt for NotebookLM." },
    handbookStructurePlan: { type: Type.STRING, description: "Auto mode only: a short text plan listing the chosen section breakdown before generating the handbook array. Required when handbook mode is auto." },
    imagePrompts: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "3-5 descriptions for generating AI images/flashcards."
    },
  },
  required: ["missionBriefing", "basicInfo", "vocabulary", "roadmap", "supplies", "safetyProtocol", "visualReferences", "handbookStylePrompt", "handbookStructurePlan", "handbook", "notebookLMPrompt", "imagePrompts"],
};
