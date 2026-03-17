import { useRef } from 'react';
import type { SavedLesson, CurriculumLesson, CurriculumParams, ESLCurriculum } from '../types';
import { mapLessonToESLInput } from '../utils/curriculumMapper';
import { generateLessonPlan } from '../services/lessonKitService';
import { useBatchGenerateState } from '@shared/hooks/useBatchGenerateState';
import { runWithConcurrency } from '@shared/utils/concurrency';
import { generateRecordId } from '../utils/id';
import {
    buildAssessmentPackPrompt,
    findAssessmentPackById,
    findTextbookLevelEntry,
} from '@shared/config/eslAssessmentRegistry';
import { isCustomTextbookLevelKey } from '../utils/customTextbookLevels';

/** Max simultaneous lesson plan generations */
const BATCH_CONCURRENCY = 2;

export function useBatchGenerate() {
    const {
        batchStatus, batchLessonMap, batchRunning, batchProgress,
        batchCancelRef, startBatch, incrementDone, incrementError, finishBatch
    } = useBatchGenerateState();

    const handleBatchGenerate = async (
        lessons: CurriculumLesson[],
        params: CurriculumParams,
        saveLesson: (saved: SavedLesson) => void | Promise<unknown>,
        curriculum?: ESLCurriculum | null,
        curriculumId?: string,
        /** Pre-fetched NotebookLM fact sheets, keyed by lesson index (optional) */
        factSheets?: Map<number, string>,
        /** Pre-verified URLs from NotebookLM research (optional) */
        validUrls?: string[]
    ) => {
        startBatch(lessons.length);
        let errorCount = 0;

        const processLesson = async (_lesson: CurriculumLesson, i: number) => {
            if (batchCancelRef.current) return;

            if (batchStatus[i] === 'done') {
                incrementDone(lessons.length, errorCount, i);
                return;
            }

            try {
                const mapped = mapLessonToESLInput(lessons[i], params, curriculum);
                const qualityIssues: string[] = [];
                const levelEntry = mapped.textbookLevelKey
                    ? (isCustomTextbookLevelKey(mapped.textbookLevelKey)
                        ? undefined
                        : findTextbookLevelEntry(mapped.textbookLevelKey))
                    : undefined;

                if (!mapped.textbookLevelKey) {
                    qualityIssues.push('No textbook level selected in curriculum params; assessment requires manual review.');
                }
                if (mapped.textbookLevelKey && !levelEntry && !isCustomTextbookLevelKey(mapped.textbookLevelKey)) {
                    qualityIssues.push(`Unknown textbook level key "${mapped.textbookLevelKey}"; assessment requires manual review.`);
                }
                if (mapped.textbookLevelKey && isCustomTextbookLevelKey(mapped.textbookLevelKey)) {
                    qualityIssues.push('Custom textbook level selected (Other). Generated content requires teacher review.');
                }

                const assessmentPack = levelEntry
                    ? findAssessmentPackById(levelEntry.assessmentPackId)
                    : undefined;
                if (levelEntry && !assessmentPack) {
                    qualityIssues.push(`Assessment pack "${levelEntry.assessmentPackId}" is missing.`);
                }

                const sheet = factSheets?.get(i);
                const content = await generateLessonPlan(
                    mapped.text, [], mapped.level, mapped.topic,
                    mapped.slideCount, mapped.duration, mapped.studentCount, mapped.lessonTitle,
                    undefined, // signal
                    sheet, // factSheet for this lesson
                    validUrls, // shared URL whitelist
                    {
                        textbookLevelKey: mapped.textbookLevelKey,
                        assessmentPackId: levelEntry?.assessmentPackId,
                        knowledgeNotebookId: levelEntry?.notebookId || undefined,
                        groundingStatus: sheet ? 'mixed' : 'unverified',
                        qualityIssues: sheet
                            ? qualityIssues
                            : [...qualityIssues, 'Textbook assessment knowledge base not connected for this lesson.'],
                        assessmentPackPrompt: assessmentPack ? buildAssessmentPackPrompt(assessmentPack) : undefined,
                    },
                );

                const id = generateRecordId();
                const newRecord: SavedLesson = {
                    id,
                    timestamp: Date.now(),
                    lastModified: Date.now(),
                    topic: content.structuredLessonPlan.classInformation.topic || lessons[i].title,
                    level: content.structuredLessonPlan.classInformation.level,
                    content,
                    curriculumId,
                    unitNumber: lessons[i].unitNumber,
                    lessonIndex: i,
                };
                await saveLesson(newRecord);

                incrementDone(lessons.length, errorCount, i, id);
            } catch (err: any) {
                console.error(`Batch generate lesson ${i + 1} failed: `, err);
                errorCount++;
                incrementError(lessons.length, batchProgress.done, i);
            }
        };

        await runWithConcurrency(
            lessons,
            BATCH_CONCURRENCY,
            processLesson,
            () => batchCancelRef.current,
        );

        finishBatch();
    };

    const handleCancelBatch = () => { batchCancelRef.current = true; };

    return {
        batchStatus,
        batchLessonMap,
        batchRunning,
        batchProgress,
        handleBatchGenerate,
        handleCancelBatch,
    };
}
