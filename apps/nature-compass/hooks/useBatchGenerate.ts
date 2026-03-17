import { useRef } from 'react';
import { CurriculumLesson, CurriculumParams, SavedLessonPlan, LessonPlanResponse } from '../types';
import { mapLessonToInput } from '../utils/curriculumMapper';
import { generateLessonPlanStreaming, generateLessonPlanStreamingCN } from '../services/lessonKitService';
import { translateLessonPlan } from '../services/contentGenerators';
import { useBatchGenerateState } from '@shared/hooks/useBatchGenerateState';
import { runWithConcurrency } from '@shared/utils/concurrency';

/** Max simultaneous lesson kit generations */
const BATCH_CONCURRENCY = 2;

export function useBatchGenerate() {
    const {
        batchStatus, batchLessonMap, batchRunning, batchProgress,
        batchCancelRef, startBatch, setItemStatus, incrementDone, incrementError, finishBatch, resetBatch
    } = useBatchGenerateState();

    // Track all active AbortControllers so cancel can abort them all
    const abortControllersRef = useRef<Map<number, AbortController>>(new Map());

    const handleBatchGenerate = async (
        lessons: CurriculumLesson[],
        params: CurriculumParams,
        language: 'en' | 'zh',
        savePlan: (saved: SavedLessonPlan) => void | Promise<unknown>,
        /** Pre-fetched NotebookLM fact sheets, keyed by lesson index (optional) */
        factSheets?: Map<number, { content: string; quality: 'good' | 'low' | 'insufficient' }>
    ) => {
        startBatch(lessons.length);
        let errorCount = 0;

        // Collect background translation promises so we can await them before finishing
        const pendingTranslations: Promise<void>[] = [];

        const processLesson = async (_lesson: CurriculumLesson, i: number) => {
            if (batchCancelRef.current) return;

            if (batchStatus[i] === 'done') {
                incrementDone(lessons.length, errorCount, i);
                return;
            }

            setItemStatus(i, 'generating');

            try {
                const mappedInput = mapLessonToInput(lessons[i], params);

                // Inject pre-fetched fact sheet if available
                const fs = factSheets?.get(i);
                if (fs) {
                    mappedInput.factSheet = fs.content;
                    mappedInput.factSheetQuality = fs.quality;
                }

                const controller = new AbortController();
                abortControllersRef.current.set(i, controller);

                const isPureChineseRoute = language === 'zh' || (params.mode === 'family' && !params.familyEslEnabled);
                const streamFn = isPureChineseRoute
                    ? generateLessonPlanStreamingCN
                    : generateLessonPlanStreaming;

                const result: LessonPlanResponse = await streamFn(
                    mappedInput,
                    () => { /* no progressive UI needed for batch */ },
                    controller.signal,
                );

                const newId = crypto.randomUUID();
                const newSavedPlan: SavedLessonPlan = {
                    id: newId,
                    timestamp: Date.now(),
                    name: result.missionBriefing?.title || lessons[i].title || `Lesson ${i + 1}`,
                    plan: result,
                    language,
                };

                if (!isPureChineseRoute) {
                    // Fire off translation in background — don't block this slot
                    const translationPromise = translateLessonPlan(result, 'Simplified Chinese', controller.signal)
                        .then(translated => {
                            result.translatedPlan = translated;
                        })
                        .catch(() => {
                            console.warn(`Batch: translation failed for lesson ${i + 1}, skipping.`);
                        })
                        .finally(() => {
                            // Save with whatever translation state we have (translated or not)
                            void savePlan(newSavedPlan);
                        });
                    pendingTranslations.push(translationPromise);
                } else {
                    await savePlan(newSavedPlan);
                }

                abortControllersRef.current.delete(i);
                incrementDone(lessons.length, errorCount, i, newId);
            } catch (err: any) {
                abortControllersRef.current.delete(i);
                if (batchCancelRef.current) return;
                console.error(`Batch generate lesson ${i + 1} failed:`, err);
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

        // Wait for any in-flight translations to finish before declaring batch complete
        await Promise.allSettled(pendingTranslations);

        abortControllersRef.current.clear();
        finishBatch();
    };

    const handleCancelBatch = () => {
        batchCancelRef.current = true;
        // Abort all active generation/translation requests
        abortControllersRef.current.forEach(c => c.abort());
        abortControllersRef.current.clear();
    };

    return {
        batchStatus,
        batchLessonMap,
        batchRunning,
        batchProgress,
        handleBatchGenerate,
        handleCancelBatch,
        resetBatch,
    };
}
