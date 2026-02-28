import { CurriculumLesson, CurriculumParams, CEFRLevel } from '../types';

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
 * Map a CurriculumLesson + its parent CurriculumParams
 * into the fields expected by ESL Planner's InputSection.
 */
export function mapLessonToESLInput(
    lesson: CurriculumLesson,
    params: CurriculumParams
): MappedESLInput {
    const contextParts = [
        lesson.description,
        `\nLearning Objectives:\n${lesson.objectives.map((o, i) => `${i + 1}. ${o}`).join('\n')}`,
        `\nGrammar Focus: ${lesson.grammarFocus}`,
        `\nSuggested Activities: ${lesson.suggestedActivities.join('; ')}`,
        `\nKey Vocabulary: ${lesson.suggestedVocabulary.join(', ')}`,
        `\nTextbook Reference: ${lesson.textbookReference}`,
    ];

    return {
        text: contextParts.join('\n'),
        level: params.level,
        topic: lesson.topic,
        slideCount: params.slideCount,
        duration: params.duration,
        studentCount: params.studentCount,
        lessonTitle: lesson.title,
    };
}
