import { useRef } from 'react';
import {
    CurriculumLesson,
    CurriculumParams,
    SavedLessonPlan,
    LessonPlanResponse,
    FactSheetResult,
} from '../types';
import { mapLessonToInput } from '../utils/curriculumMapper';
import {
    generateLessonPlanStreaming,
    generateLessonPlanStreamingCN,
    buildInputSnapshot,
} from '../services/lessonKitService';
import { translateLessonPlan } from '../services/contentGenerators';
import { generateDownstreamContent } from '../services/gemini/supportingContent';
import { generateCurriculumGroundingFactSheet } from '../services/groundingService';
import { useBatchGenerateState } from '@shared/hooks/useBatchGenerateState';
import { runWithConcurrency } from '@shared/utils/concurrency';
import { useToast } from '@shared/stores/useToast';

/** Max simultaneous lesson kit generations */
const BATCH_CONCURRENCY = 2;

export function useBatchGenerate() {
    const {
        batchStatus,
        batchLessonMap,
        batchRunning,
        batchProgress,
        batchCancelRef,
        startBatch,
        setItemStatus,
        incrementDone,
        incrementError,
        finishBatch,
        resetBatch,
    } = useBatchGenerateState();

    // Track all active AbortControllers so cancel can abort them all
    const abortControllersRef = useRef<Map<number, AbortController>>(new Map());

    const handleBatchGenerate = async (
        lessons: CurriculumLesson[],
        params: CurriculumParams,
        language: 'en' | 'zh',
        savePlan: (saved: SavedLessonPlan) => void | Promise<unknown>,
        /** Shared Google-grounded fact sheet for the whole curriculum (optional). */
        sharedFactSheet?: FactSheetResult,
        weatherByLessonIndex: Record<number, 'Sunny' | 'Rainy'> = {},
    ) => {
        startBatch(lessons.length);
        let errorCount = 0;
        let ensuredSharedFactSheet = sharedFactSheet;

        // Collect background translation promises so we can await them before finishing
        const pendingTranslations: Promise<void>[] = [];

        try {
            if (!ensuredSharedFactSheet) {
                const lessonTitles = lessons.map((lesson) => lesson.title).filter(Boolean);
                ensuredSharedFactSheet = await generateCurriculumGroundingFactSheet(params, lessonTitles);
            }
        } catch (err: any) {
            console.warn('Batch generate: shared fact sheet failed, continue without shared grounding.', err);
            ensuredSharedFactSheet = undefined;
            useToast.getState().warning(
                'Shared fact sheet failed; degraded to per-lesson generation (freshness risk may increase).',
            );
        }

        const processLesson = async (_lesson: CurriculumLesson, i: number) => {
            if (batchCancelRef.current) return;

            if (batchStatus[i] === 'done') {
                incrementDone(lessons.length, errorCount, i);
                return;
            }

            setItemStatus(i, 'generating');

            try {
                const mappedInput = mapLessonToInput(lessons[i], params, weatherByLessonIndex[i]);

                if (ensuredSharedFactSheet) {
                    mappedInput.factSheet = ensuredSharedFactSheet.content;
                    mappedInput.factSheetQuality = ensuredSharedFactSheet.quality;
                    mappedInput.factSheetSources = ensuredSharedFactSheet.sources;
                    mappedInput.factSheetMeta = ensuredSharedFactSheet.freshnessMeta;
                }

                const controller = new AbortController();
                abortControllersRef.current.set(i, controller);

                const isPureChineseRoute = language === 'zh' || (params.mode === 'family' && !params.familyEslEnabled);
                const streamFn = isPureChineseRoute ? generateLessonPlanStreamingCN : generateLessonPlanStreaming;

                const result: LessonPlanResponse = await streamFn(
                    mappedInput,
                    () => {
                        // no progressive UI needed for batch
                    },
                    controller.signal,
                );

                // Phase 2: auto-chain downstream generation
                result._inputSnapshot = buildInputSnapshot(mappedInput);
                const genLang = isPureChineseRoute ? 'zh' : 'en';
                try {
                    const downstream = await generateDownstreamContent(
                        result,
                        result._inputSnapshot,
                        genLang as 'en' | 'zh',
                        controller.signal,
                    );
                    Object.assign(result, downstream);
                    result.generationPhase = 'complete';
                } catch (phase2Err: any) {
                    if (phase2Err.name === 'AbortError') throw phase2Err;
                    console.warn(`Batch: Phase 2 (handbook) failed for lesson ${i + 1}, saving roadmap-only:`, phase2Err);
                }

                const newId = crypto.randomUUID();
                const newSavedPlan: SavedLessonPlan = {
                    id: newId,
                    timestamp: Date.now(),
                    name: result.missionBriefing?.title || lessons[i].title || `Lesson ${i + 1}`,
                    plan: result,
                    language,
                };

                if (!isPureChineseRoute) {
                    // Fire translation in background to keep batch slot moving
                    const translationPromise = translateLessonPlan(result, 'Simplified Chinese', controller.signal)
                        .then((translated) => {
                            result.translatedPlan = translated;
                        })
                        .catch(() => {
                            console.warn(`Batch: translation failed for lesson ${i + 1}, skipping.`);
                        })
                        .finally(() => {
                            // Save with whatever translation state we have
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

        await runWithConcurrency(lessons, BATCH_CONCURRENCY, processLesson, () => batchCancelRef.current);

        // Wait for any in-flight translations to finish before declaring batch complete
        await Promise.allSettled(pendingTranslations);

        abortControllersRef.current.clear();
        finishBatch();
    };

    const handleCancelBatch = () => {
        batchCancelRef.current = true;
        // Abort all active generation/translation requests
        abortControllersRef.current.forEach((c) => c.abort());
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
