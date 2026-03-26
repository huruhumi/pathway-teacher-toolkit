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
                theme: {
                    type: Type.STRING,
                    description: "The specific workshop theme/topic as provided in parameters. Must match user theme, not app name.",
                },
                activityType: { type: Type.STRING, description: "e.g. 'Outdoor STEAM / Biology' or 'Indoor Maker / Physics'" },
                targetAudience: { type: Type.STRING, description: "e.g. 'ESL Students Ages 6-8'" },
                location: {
                    type: Type.STRING,
                    description: "Primary venue/location, e.g. 'Wuhan Wetland Park', 'School Garden', 'Classroom'. Use curriculum location when provided.",
                },
                learningGoals: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "3 specific learning objectives (Language and STEAM).",
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
                    location: {
                        type: Type.STRING,
                        description: "Specific setting for this step, e.g. 'Classroom Rug', 'Outdoor Garden', 'Science Lab'. MUST NOT be empty.",
                    },
                    description: {
                        type: Type.STRING,
                        description: "MUST NOT be empty. A detailed narrative (6-8 sentences minimum) with concrete actions, locations, and subject matter.",
                    },
                    learningObjective: { type: Type.STRING, description: "Specific learning goal for this time block. MUST NOT be empty." },
                    steps: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: "MUST NOT be empty or placeholder. 5-7 detailed and actionable instructional steps.",
                    },
                    backgroundInfo: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description:
                            "MUST NOT be empty. Primary source material for handbook Background Knowledge pages. Include 5-8 factual points with specific data/names/numbers plus inquiry prompts.",
                    },
                    teachingTips: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description:
                            "MUST NOT be empty. 3-5 practical tips covering scaffolding, classroom management, group roles, differentiation, and emergency handling.",
                    },
                    activityInstructions: {
                        type: Type.STRING,
                        description:
                            "Student-facing instructions: (1) goal, (2) materials, (3) numbered steps (4-8), (4) timing hints. Used directly in handbook Activity pages.",
                    },
                },
                required: [
                    "timeRange",
                    "phase",
                    "activity",
                    "activityType",
                    "location",
                    "description",
                    "learningObjective",
                    "steps",
                    "backgroundInfo",
                    "teachingTips",
                    "activityInstructions",
                ],
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
            description:
                "A comprehensive list of 6-10 specific safety measures covering ratio, boundaries, tool handling, biological contact, weather risk, and allergy awareness.",
        },
        visualReferences: {
            type: Type.ARRAY,
            description: "A list of 3-5 visual aids needed for the lesson.",
            items: {
                type: Type.OBJECT,
                properties: {
                    label: { type: Type.STRING, description: "Short title of the visual aid." },
                    description: { type: Type.STRING, description: "Detailed visual description for artist or image generator." },
                    type: { type: Type.STRING, description: "Type of visual aid, such as Photo, Diagram, or Illustration." },
                },
                required: ["label", "description", "type"],
            },
        },
        handbookStylePrompt: {
            type: Type.STRING,
            description: "A global style prompt that keeps handbook visual language consistent.",
        },
        handbook: {
            type: Type.ARRAY,
            description: "A detailed design plan for a student handbook.",
            items: {
                type: Type.OBJECT,
                properties: {
                    pageNumber: { type: Type.NUMBER },
                    title: { type: Type.STRING },
                    section: { type: Type.STRING, description: "Page category or section name." },
                    layoutDescription: { type: Type.STRING, description: "How the page should look." },
                    visualPrompt: { type: Type.STRING, description: "Prompt for visual assets." },
                    contentPrompt: { type: Type.STRING, description: "Prompt for page text content." },
                    teacherContentPrompt: {
                        type: Type.STRING,
                        description:
                            "Teacher-facing content: objective, short opening script, guided questions, differentiation, pacing, and extension.",
                    },
                    phaseIndex: {
                        type: Type.NUMBER,
                        description:
                            "0-based roadmap index this page belongs to. Required for roadmap-bound pages, omitted for system pages.",
                    },
                },
                required: ["pageNumber", "title", "section", "layoutDescription", "visualPrompt", "contentPrompt"],
            },
        },
        notebookLMPrompt: { type: Type.STRING, description: "A summary prompt for NotebookLM." },
        handbookStructurePlan: {
            type: Type.STRING,
            description: "Auto mode only: section breakdown plan before handbook array generation.",
        },
        imagePrompts: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "3-5 descriptions for generating AI images/flashcards.",
        },
    },
    required: [
        "missionBriefing",
        "basicInfo",
        "vocabulary",
        "roadmap",
        "supplies",
        "safetyProtocol",
        "visualReferences",
        "handbookStylePrompt",
        "handbookStructurePlan",
        "handbook",
        "notebookLMPrompt",
        "imagePrompts",
    ],
};

/**
 * Phase 1 schema: only roadmap-centric fields.
 * Downstream fields (handbook, supplies, imagePrompts, etc.) are not required here
 * so generation focuses on roadmap quality first.
 */
export const roadmapOnlySchema: Schema = {
    type: Type.OBJECT,
    properties: {
        missionBriefing: lessonPlanSchema.properties!.missionBriefing,
        basicInfo: lessonPlanSchema.properties!.basicInfo,
        vocabulary: lessonPlanSchema.properties!.vocabulary,
        roadmap: lessonPlanSchema.properties!.roadmap,
        safetyProtocol: lessonPlanSchema.properties!.safetyProtocol,
        visualReferences: lessonPlanSchema.properties!.visualReferences,
        handbookStructurePlan: lessonPlanSchema.properties!.handbookStructurePlan,
    },
    required: [
        "missionBriefing",
        "basicInfo",
        "vocabulary",
        "roadmap",
        "safetyProtocol",
        "visualReferences",
        "handbookStructurePlan",
    ],
};
