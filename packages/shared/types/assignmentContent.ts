/**
 * Assignment Content Types — shared between esl-planner and student-portal
 * These types represent the JSONB content stored in assignments.content_data
 */

// ── Worksheet types ──

export interface WorksheetItem {
    question: string;
    answer: string;
    options?: string[];
    visualPrompt?: string;
    imageUrl?: string;
    wordCount?: number;
}

export interface WorksheetSection {
    title: string;
    description?: string;
    passageTitle?: string;
    passage?: string;
    layout?: 'standard' | 'matching' | 'grid' | 'multiple-choice' | 'essay' | 'error-correction' | 'tracing';
    items: WorksheetItem[];
}

export interface Worksheet {
    title: string;
    type: string;
    instructions: string;
    sections?: WorksheetSection[];
    items?: WorksheetItem[];
}

// ── Reading Companion types ──

export interface ReadingTask {
    text: string;
    text_cn: string;
    isCompleted?: boolean;
}

export interface WebResource {
    title: string;
    title_cn: string;
    url: string;
    description: string;
    description_cn: string;
}

export interface ReadingPlanDay {
    day: number;
    focus: string;
    focus_cn: string;
    activity: string;
    activity_cn: string;
    tasks?: ReadingTask[];
    resources?: WebResource[];
    trivia?: { en: string; cn: string };
}

export interface ReadingCompanionContent {
    days: ReadingPlanDay[];
    webResources: WebResource[];
}

export interface AssignmentSheetContent {
    studentName: string;
    lessonSummary: string;
    keyPoints: string[];
    assignments: { title: string; description: string; isFixed?: boolean }[];
    feedback: {
        ratings: { dimension: string; dimension_en: string; score: number }[];
        overallComment: string;
    };
}
