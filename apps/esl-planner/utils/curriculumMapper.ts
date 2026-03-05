import { CurriculumLesson, CurriculumParams, CEFRLevel, ESLCurriculum } from '../types';

export interface MappedESLInput {
    text: string;
    level: CEFRLevel;
    topic: string;
    slideCount: number;
    duration: string;
    studentCount: string;
    lessonTitle: string;
}

/**
 * Generate a standardized display name for a lesson.
 * Format: "{SeriesName} Unit {N} Lesson {M}: {Title} [Type]"
 * - SeriesName: from curriculum.seriesName or textbookTitle minus "Student's Book"
 * - Lesson M: uses lessonInUnit if available, else falls back to lessonNumber
 * - [Type]: only shown for non-regular lessons (review, activity, project, etc.)
 */
export function formatLessonDisplayName(
    lesson: CurriculumLesson,
    curriculum?: ESLCurriculum | null,
    textbookTitle?: string
): string {
    const series = curriculum?.seriesName
        || (curriculum?.textbookTitle || textbookTitle || '').replace(/\s*Student'?s?\s*Book/gi, '').trim();

    const unitStr = lesson.unitNumber ? `Unit ${lesson.unitNumber} ` : '';
    const lessonNum = lesson.lessonInUnit ?? lesson.lessonNumber;

    // Non-regular lessons get a type label
    const typeLabel = lesson.lessonType && lesson.lessonType !== 'regular'
        ? ` [${lesson.lessonType.charAt(0).toUpperCase() + lesson.lessonType.slice(1)}]`
        : '';

    const parts = [series, `${unitStr}Lesson ${lessonNum}:`, `${lesson.title}${typeLabel}`].filter(Boolean);
    return parts.join(' ').trim();
}

/**
 * Map a CurriculumLesson + its parent CurriculumParams
 * into the fields expected by ESL Planner's InputSection.
 */
export function mapLessonToESLInput(
    lesson: CurriculumLesson,
    params: CurriculumParams,
    curriculum?: ESLCurriculum | null,
    textbookTitle: string = ''
): MappedESLInput {
    const contextParts = [
        lesson.description,
        `\nLearning Objectives:\n${lesson.objectives.map((o, i) => `${i + 1}. ${o}`).join('\n')}`,
        `\nGrammar Focus: ${lesson.grammarFocus}`,
        `\nSuggested Activities: ${lesson.suggestedActivities.join('; ')}`,
        `\nKey Vocabulary: ${lesson.suggestedVocabulary.join(', ')}`,
        `\nTextbook Reference: ${lesson.textbookReference}`,
    ];

    const formattedTitle = formatLessonDisplayName(lesson, curriculum, textbookTitle);

    return {
        text: contextParts.join('\n'),
        level: params.level,
        topic: lesson.topic,
        slideCount: params.slideCount,
        duration: params.duration,
        studentCount: params.studentCount,
        lessonTitle: formattedTitle,
    };
}
