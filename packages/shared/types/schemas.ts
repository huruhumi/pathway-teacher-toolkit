import { z } from 'zod';
import { CEFRLevel } from './index';

// --- Shared Base Schemas ---

export const UploadedFileSchema = z.object({
    name: z.string(),
    type: z.string(),
    data: z.string(),
});

export const CEFRLevelSchema = z.nativeEnum(CEFRLevel);

// --- ESL Planner Schemas ---

export const FlashcardSchema = z.object({
    word: z.string(),
    definition: z.string(),
    visualPrompt: z.string(),
    type: z.enum(['vocabulary', 'concept'])
});

export const GameSchema = z.object({
    name: z.string(),
    type: z.string(),
    interactionType: z.string(),
    instructions: z.string(),
    materials: z.array(z.string()),
    isCompleted: z.boolean().optional(),
    linkedStage: z.string().optional()
});

export const SlideSchema = z.object({
    title: z.string(),
    content: z.string(),
    visual: z.string(),
    layoutDesign: z.string()
});

export const ReadingTaskSchema = z.object({
    text: z.string(),
    text_cn: z.string(),
    isCompleted: z.boolean()
});

export const WebResourceSchema = z.object({
    title: z.string(),
    title_cn: z.string(),
    url: z.string(),
    description: z.string(),
    description_cn: z.string()
});

export const ReadingPlanDaySchema = z.object({
    day: z.number(),
    focus: z.string(),
    focus_cn: z.string(),
    activity: z.string(),
    activity_cn: z.string(),
    tasks: z.array(ReadingTaskSchema).optional(),
    resources: z.array(WebResourceSchema).optional(),
    trivia: z.object({ en: z.string(), cn: z.string() }).optional()
});

export const ReadingCompanionContentSchema = z.object({
    days: z.array(ReadingPlanDaySchema),
    webResources: z.array(WebResourceSchema)
});

export const LessonStageSchema = z.object({
    stage: z.string(),
    stageAim: z.string(),
    timing: z.string(),
    interaction: z.string(),
    teacherActivity: z.string(),
    studentActivity: z.string(),
    teachingTips: z.array(z.string()).optional(),
    backgroundKnowledge: z.array(z.string()).optional(),
    fillerActivity: z.string().optional(),
    suggestedGameName: z.string().optional()
});

export const StructuredLessonPlanSchema = z.object({
    classInformation: z.object({
        level: z.string(),
        topic: z.string(),
        students: z.string(),
        date: z.string()
    }),
    lessonDetails: z.object({
        type: z.string(),
        aim: z.string(),
        objectives: z.array(z.string()),
        materials: z.array(z.string()),
        targetVocab: z.array(z.object({ word: z.string(), definition: z.string() })),
        grammarSentences: z.array(z.string()),
        anticipatedProblems: z.array(z.object({ problem: z.string(), solution: z.string() }))
    }),
    stages: z.array(LessonStageSchema)
});

export const WorksheetItemSchema = z.object({
    question: z.string(),
    answer: z.string(),
    options: z.array(z.string()).optional(),
    visualPrompt: z.string().optional(),
    imageUrl: z.string().optional(),
    wordCount: z.number().optional()
});

export const WorksheetSectionSchema = z.object({
    title: z.string(),
    description: z.string().optional(),
    passageTitle: z.string().optional(),
    passage: z.string().optional(),
    layout: z.enum(['standard', 'matching', 'grid', 'multiple-choice', 'essay', 'error-correction']).optional(),
    items: z.array(WorksheetItemSchema)
});

export const WorksheetSchema = z.object({
    title: z.string(),
    type: z.string(),
    instructions: z.string(),
    sections: z.array(WorksheetSectionSchema).optional(),
    items: z.array(WorksheetItemSchema).optional()
});

export const PhonicsContentSchema = z.object({
    keyPoints: z.array(z.string()),
    decodableTexts: z.array(z.string()),
    decodableTextPrompts: z.array(z.string())
});

export const SentenceCitationSchema = z.object({
    section: z.string(),
    sentence: z.string(),
    sourceIds: z.array(z.string()),
    sourceTitles: z.array(z.string()),
    sourceUrls: z.array(z.string()).optional(),
});

export const ESLGeneratedContentSchema = z.object({
    lessonPlanMarkdown: z.string(),
    structuredLessonPlan: StructuredLessonPlanSchema,
    slides: z.array(SlideSchema),
    flashcards: z.array(FlashcardSchema),
    games: z.array(GameSchema),
    readingCompanion: ReadingCompanionContentSchema,
    notebookLMPrompt: z.string(),
    summary: z.object({
        objectives: z.string(),
        targetVocab: z.array(z.string()),
        grammarPoints: z.array(z.string())
    }),
    worksheets: z.array(WorksheetSchema).optional(),
    grammarInfographicUrl: z.string().optional(),
    blackboardImageUrl: z.string().optional(),
    phonics: PhonicsContentSchema.optional(),
    flashcardImages: z.record(z.string(), z.string()).optional(),
    decodableTextImages: z.record(z.string(), z.string()).optional(),
    textbookLevelKey: z.string().optional(),
    assessmentPackId: z.string().optional(),
    knowledgeNotebookId: z.string().optional(),
    groundingSources: z.array(z.object({
        id: z.string().optional(),
        title: z.string().optional(),
        url: z.string().optional(),
        status: z.string().optional(),
        type: z.string().optional(),
    })).optional(),
    groundingCoverage: z.array(z.object({
        section: z.string(),
        evidenceType: z.enum(['strict_fact_sheet', 'assisted', 'synthesized']),
        note: z.string(),
    })).optional(),
    sentenceCitations: z.array(SentenceCitationSchema).optional(),
    groundingStatus: z.enum(['verified', 'mixed', 'unverified']).optional(),
    qualityGate: z.object({
        pass: z.boolean(),
        status: z.enum(['ok', 'needs_review']),
        issues: z.array(z.string())
    }).optional(),
    scoreReport: z.object({
        overallScore: z.number(),
        dimensionScores: z.array(z.object({
            key: z.enum([
                'accuracy',
                'teachability',
                'objective_alignment',
                'assessment_measurability',
                'age_appropriateness',
            ]),
            label: z.string(),
            score: z.number(),
            maxScore: z.number(),
            issues: z.array(z.string()),
            actionableFixes: z.array(z.string()),
        })),
        risks: z.array(z.string()),
        actionableFixes: z.array(z.string()),
        reviewerStatus: z.enum(['ready_to_teach', 'needs_teacher_review']),
        generatedAt: z.string(),
        calibration: z.object({
            textbookLevelKey: z.string(),
            sampleCount: z.number(),
            appliedDelta: z.number(),
            confidence: z.enum(['low', 'medium', 'high']),
        }).optional(),
    }).optional(),
});

/**
 * Reduced Zod schema for Phase 1 (plan_only) validation.
 * Only the lesson plan + summary are required.
 */
export const ESLPlanOnlySchema = z.object({
    structuredLessonPlan: StructuredLessonPlanSchema,
    lessonPlanMarkdown: z.string(),
    summary: z.object({
        objectives: z.string(),
        targetVocab: z.array(z.string()),
        grammarPoints: z.array(z.string())
    }),
});

// --- Nature Compass Schemas ---

export const VocabularyItemSchema = z.object({
    word: z.string(),
    definition: z.string()
});

export const RoadmapItemSchema = z.object({
    timeRange: z.string(),
    phase: z.string(),
    activity: z.string(),
    activityType: z.string(),
    location: z.string(),
    description: z.string(),
    learningObjective: z.string(),
    steps: z.array(z.string()),
    backgroundInfo: z.array(z.string()),
    teachingTips: z.array(z.string()),
    activityInstructions: z.string().optional()
});

export const SupplyListSchema = z.object({
    permanent: z.array(z.string()),
    consumables: z.array(z.string())
});

export const VisualReferenceItemSchema = z.object({
    label: z.string(),
    description: z.string(),
    type: z.string()
});

export const HandbookPageSchema = z.object({
    pageNumber: z.number(),
    title: z.string(),
    section: z.string(),
    layoutDescription: z.string(),
    visualPrompt: z.string(),
    contentPrompt: z.string(),
    teacherContentPrompt: z.string().optional(),
    phaseIndex: z.number().optional()
});

export const NatureLessonPlanResponseSchema = z.object({
    missionBriefing: z.object({
        title: z.string(),
        narrative: z.string()
    }),
    basicInfo: z.object({
        theme: z.string(),
        activityType: z.string(),
        targetAudience: z.string(),
        location: z.string().optional().default(''),
        learningGoals: z.array(z.string())
    }),
    vocabulary: z.object({
        keywords: z.array(VocabularyItemSchema),
        phrases: z.array(z.string())
    }),
    roadmap: z.array(RoadmapItemSchema),
    supplies: SupplyListSchema,
    safetyProtocol: z.array(z.string()),
    visualReferences: z.array(VisualReferenceItemSchema),
    handbookStylePrompt: z.string(),
    handbookStructurePlan: z.string().optional(),
    handbook: z.array(HandbookPageSchema),
    notebookLMPrompt: z.string(),
    imagePrompts: z.array(z.string()),
    translatedPlan: z.any().optional(),
    generationPhase: z.enum(['roadmap_only', 'complete']).optional(),
    _inputSnapshot: z.any().optional(),
});

/**
 * Relaxed Zod schema for Phase 1 (roadmap_only) validation.
 * Downstream fields (handbook, supplies, imagePrompts, etc.) are optional
 * since Gemini only generates roadmap-related content in Phase 1.
 */
export const NatureRoadmapOnlySchema = z.object({
    missionBriefing: z.object({
        title: z.string(),
        narrative: z.string()
    }),
    basicInfo: z.object({
        theme: z.string(),
        activityType: z.string(),
        targetAudience: z.string(),
        location: z.string().optional().default(''),
        learningGoals: z.array(z.string())
    }),
    vocabulary: z.object({
        keywords: z.array(VocabularyItemSchema),
        phrases: z.array(z.string())
    }),
    roadmap: z.array(RoadmapItemSchema),
    safetyProtocol: z.array(z.string()),
    visualReferences: z.array(VisualReferenceItemSchema),
    handbookStructurePlan: z.string().optional(),
    // Downstream fields — optional in Phase 1
    translatedPlan: z.any().optional(),
    generationPhase: z.enum(['roadmap_only', 'complete']).optional(),
    _inputSnapshot: z.any().optional(),
});
