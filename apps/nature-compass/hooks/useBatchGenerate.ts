import { useRef } from 'react';
import { CurriculumLesson, CurriculumParams, SavedLessonPlan, LessonPlanResponse } from '../types';
import { mapLessonToInput } from '../utils/curriculumMapper';
import { generateLessonPlanStreaming, generateLessonPlanStreamingCN, translateLessonPlan } from '../services/geminiService';
import { useBatchGenerateState } from '@shared/hooks/useBatchGenerateState';

export function useBatchGenerate() {
    const {
        batchStatus, batchLessonMap, batchRunning, batchProgress,
        batchCancelRef, startBatch, setItemStatus, incrementDone, incrementError, finishBatch, resetBatch
    } = useBatchGenerateState();

    const batchAbortRef = useRef<AbortController | null>(null);

    const handleBatchGenerate = async (
        lessons: CurriculumLesson[],
        params: CurriculumParams,
        language: 'en' | 'zh',
        savePlan: (saved: SavedLessonPlan) => void
    ) => {
        startBatch(lessons.length);
        let errorCount = 0;

        for (let i = 0; i < lessons.length; i++) {
            if (batchCancelRef.current) break;

            if (batchStatus[i] === 'done') {
                incrementDone(lessons.length, errorCount, i);
                continue;
            }

            setItemStatus(i, 'generating');

            try {
                const mappedInput = mapLessonToInput(lessons[i], params);
                const controller = new AbortController();
                batchAbortRef.current = controller;

                const streamFn = language === 'zh'
                    ? generateLessonPlanStreamingCN
                    : generateLessonPlanStreaming;

                const result: LessonPlanResponse = await streamFn(
                    mappedInput,
                    () => { /* no progressive UI needed for batch */ },
                    controller.signal,
                );

                if (language === 'en') {
                    try {
                        const translated = await translateLessonPlan(result, 'Simplified Chinese', controller.signal);
                        result.translatedPlan = translated;
                    } catch {
                        console.warn(`Batch: translation failed for lesson ${i + 1}, skipping.`);
                    }
                }

                const newId = crypto.randomUUID();
                const newSavedPlan: SavedLessonPlan = {
                    id: newId,
                    timestamp: Date.now(),
                    name: result.missionBriefing?.title || lessons[i].title || `Lesson ${i + 1}`,
                    plan: result,
                    language,
                };
                savePlan(newSavedPlan);

                incrementDone(lessons.length, errorCount, i, newId);
            } catch (err: any) {
                if (batchCancelRef.current) break;
                console.error(`Batch generate lesson ${i + 1} failed:`, err);
                errorCount++;
                incrementError(lessons.length, batchProgress.done, i);
            }
        }

        batchAbortRef.current = null;
        finishBatch();
    };

    const handleCancelBatch = () => {
        batchCancelRef.current = true;
        if (batchAbortRef.current) {
            batchAbortRef.current.abort();
            batchAbortRef.current = null;
        }
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
