import type { RecordQualityStatus } from '../types/storage';

export interface RecordQualityAssessment {
    status: RecordQualityStatus;
    issues: string[];
}

interface NatureLessonPlanLike {
    roadmap?: unknown[];
    handbook?: unknown[];
    safetyProtocol?: unknown[];
    basicInfo?: {
        learningGoals?: unknown[];
    };
    factSheet?: string;
    structuredKnowledge?: unknown[];
}

interface NatureCurriculumLike {
    theme?: string;
    overview?: string;
    lessons?: unknown[];
}

interface NatureCurriculumParamsLike {
    englishLevel?: string;
    lessonCount?: number;
}

interface ESLLessonKitLike {
    structuredLessonPlan?: {
        lessonDetails?: {
            objectives?: unknown[];
            targetVocab?: unknown[];
        };
        stages?: unknown[];
    };
    slides?: unknown[];
    scoreReport?: {
        overallScore?: number;
    };
    qualityGate?: {
        status?: string;
    };
    groundingStatus?: string;
    generationPhase?: 'plan_only' | 'complete';
}

interface ESLCurriculumLike {
    textbookTitle?: string;
    targetLevel?: string;
    overview?: string;
    lessons?: unknown[];
}

interface ESLCurriculumParamsLike {
    lessonCount?: number;
    textbookLevelKey?: string;
}

interface EssayReportLike {
    originalText?: string;
    goldenVersion?: string;
    grades?: unknown[];
    overallGrade?: string;
    errorQuiz?: unknown[];
    teacherNote?: {
        zh?: string;
        en?: string;
    };
    grammarErrors?: unknown[];
    collocationErrors?: unknown[];
    vocabularyUpgrades?: unknown[];
    wordBank?: unknown[];
}

const nonEmptyString = (value: unknown): boolean =>
    typeof value === 'string' && value.trim().length > 0;

const nonEmptyArray = (value: unknown): boolean =>
    Array.isArray(value) && value.length > 0;

export function assessNatureLessonPlanQuality(
    plan?: NatureLessonPlanLike | null,
): RecordQualityAssessment {
    if (!plan) {
        return { status: 'needs_review', issues: ['missing_plan_payload'] };
    }

    const issues: string[] = [];
    if (!nonEmptyArray(plan.roadmap)) issues.push('missing_roadmap');
    if (!nonEmptyArray(plan.handbook)) issues.push('missing_handbook');
    if (!nonEmptyArray(plan.safetyProtocol)) issues.push('missing_safety_protocol');
    if (!nonEmptyArray(plan.basicInfo?.learningGoals)) issues.push('missing_learning_goals');

    const factSheetLength = nonEmptyString(plan.factSheet) ? plan.factSheet!.trim().length : 0;
    const structuredKnowledgeCount = Array.isArray(plan.structuredKnowledge) ? plan.structuredKnowledge.length : 0;
    if (factSheetLength < 120 && structuredKnowledgeCount === 0) {
        issues.push('ungrounded_knowledge');
    }

    return {
        status: issues.length > 0 ? 'needs_review' : 'ok',
        issues,
    };
}

export function assessNatureCurriculumQuality(
    curriculum?: NatureCurriculumLike | null,
    params?: NatureCurriculumParamsLike | null,
): RecordQualityAssessment {
    if (!curriculum) {
        return { status: 'needs_review', issues: ['missing_curriculum_payload'] };
    }

    const issues: string[] = [];
    if (!nonEmptyString(curriculum.theme)) issues.push('missing_theme');
    if (!nonEmptyString(curriculum.overview)) issues.push('missing_overview');
    if (!nonEmptyArray(curriculum.lessons)) issues.push('missing_lessons');
    if (!nonEmptyString(params?.englishLevel)) issues.push('missing_level_context');
    if (typeof params?.lessonCount === 'number' && params.lessonCount > 0) {
        const actualCount = Array.isArray(curriculum.lessons) ? curriculum.lessons.length : 0;
        if (actualCount > 0 && Math.abs(actualCount - params.lessonCount) > 2) {
            issues.push('lesson_count_deviation');
        }
    }

    return {
        status: issues.length > 0 ? 'needs_review' : 'ok',
        issues,
    };
}

export function assessESLLessonKitQuality(
    lesson?: ESLLessonKitLike | null,
): RecordQualityAssessment {
    if (!lesson) {
        return { status: 'needs_review', issues: ['missing_lesson_payload'] };
    }

    const issues: string[] = [];
    if (!nonEmptyArray(lesson.structuredLessonPlan?.lessonDetails?.objectives)) {
        issues.push('missing_objectives');
    }
    if (!nonEmptyArray(lesson.structuredLessonPlan?.lessonDetails?.targetVocab)) {
        issues.push('missing_target_vocab');
    }
    if (!nonEmptyArray(lesson.structuredLessonPlan?.stages)) {
        issues.push('missing_stages');
    }
    // Fix N: Skip slides/scoreReport checks for plan_only records
    if (lesson.generationPhase !== 'plan_only') {
        if (!nonEmptyArray(lesson.slides)) {
            issues.push('missing_slides');
        }
        if (
            typeof lesson.scoreReport?.overallScore !== 'number'
            || lesson.scoreReport.overallScore < 75
        ) {
            issues.push('low_or_missing_score_report');
        }
    }

    return {
        status: issues.length > 0 ? 'needs_review' : 'ok',
        issues,
    };
}

export function assessESLCurriculumQuality(
    curriculum?: ESLCurriculumLike | null,
    params?: ESLCurriculumParamsLike | null,
): RecordQualityAssessment {
    if (!curriculum) {
        return { status: 'needs_review', issues: ['missing_curriculum_payload'] };
    }

    const issues: string[] = [];
    if (!nonEmptyString(curriculum.textbookTitle)) issues.push('missing_textbook_title');
    if (!nonEmptyString(curriculum.targetLevel)) issues.push('missing_target_level');
    if (!nonEmptyString(curriculum.overview)) issues.push('missing_overview');
    if (!nonEmptyArray(curriculum.lessons)) issues.push('missing_lessons');
    if (!nonEmptyString(params?.textbookLevelKey)) issues.push('missing_textbook_level_key');

    if (typeof params?.lessonCount === 'number' && params.lessonCount > 0) {
        const actualCount = Array.isArray(curriculum.lessons) ? curriculum.lessons.length : 0;
        if (actualCount > 0 && Math.abs(actualCount - params.lessonCount) > 2) {
            issues.push('lesson_count_deviation');
        }
    }

    return {
        status: issues.length > 0 ? 'needs_review' : 'ok',
        issues,
    };
}

export function assessEssayRecordQuality(
    report?: EssayReportLike | null,
    sourceText?: string | null,
): RecordQualityAssessment {
    if (!report) {
        return { status: 'needs_review', issues: ['missing_report_payload'] };
    }

    const issues: string[] = [];
    const resolvedSource = nonEmptyString(report.originalText)
        ? report.originalText!.trim()
        : (nonEmptyString(sourceText) ? sourceText!.trim() : '');

    if (resolvedSource.length < 40) issues.push('source_text_too_short');
    if (!nonEmptyString(report.goldenVersion) || report.goldenVersion!.trim().length < 60) {
        issues.push('golden_version_too_short');
    }
    if (!nonEmptyString(report.overallGrade)) issues.push('missing_overall_grade');
    if (!Array.isArray(report.grades) || report.grades.length < 3) issues.push('insufficient_dimension_grades');
    if (!Array.isArray(report.errorQuiz) || report.errorQuiz.length < 1) issues.push('missing_error_quiz');
    if (!nonEmptyString(report.teacherNote?.zh) || !nonEmptyString(report.teacherNote?.en)) {
        issues.push('missing_teacher_note');
    }

    const feedbackSignals =
        (Array.isArray(report.grammarErrors) ? report.grammarErrors.length : 0)
        + (Array.isArray(report.collocationErrors) ? report.collocationErrors.length : 0)
        + (Array.isArray(report.vocabularyUpgrades) ? report.vocabularyUpgrades.length : 0)
        + (Array.isArray(report.wordBank) ? report.wordBank.length : 0);
    if (feedbackSignals === 0) {
        issues.push('sparse_feedback_signals');
    }

    return {
        status: issues.length > 0 ? 'needs_review' : 'ok',
        issues,
    };
}
