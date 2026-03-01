import { useState, useRef, MutableRefObject } from 'react';
import { CurriculumLesson, CurriculumParams, SavedLessonPlan, LessonPlanResponse } from '../types';
import { mapLessonToInput } from '../utils/curriculumMapper';
import { generateLessonPlanStreaming, generateLessonPlanStreamingCN, translateLessonPlan } from '../services/geminiService';
import { safeStorage } from '@shared/safeStorage';

export type BatchItemStatus = 'idle' | 'generating' | 'done' | 'error';

export function useBatchGenerate(
    savedPlansRef: MutableRefObject<SavedLessonPlan[]>,
    setSavedPlans: (plans: SavedLessonPlan[]) => void,
) {
    const [batchStatus, setBatchStatus] = useState<Record<number, BatchItemStatus>>({});
    const [batchLessonMap, setBatchLessonMap] = useState<Record<number, string>>({});
    const [batchRunning, setBatchRunning] = useState(false);
    const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0, errors: 0 });
    const batchCancelRef = useRef(false);
    const batchAbortRef = useRef<AbortController | null>(null);

    const handleBatchGenerate = async (
        lessons: CurriculumLesson[],
        params: CurriculumParams,
        language: 'en' | 'zh',
    ) => {
        batchCancelRef.current = false;
        setBatchRunning(true);
        setBatchProgress({ done: 0, total: lessons.length, errors: 0 });
        let doneCount = 0;
        let errorCount = 0;

        for (let i = 0; i < lessons.length; i++) {
            if (batchCancelRef.current) break;

            // Skip already completed
            if (batchStatus[i] === 'done') {
                doneCount++;
                setBatchProgress(p => ({ ...p, done: doneCount }));
                continue;
            }

            setBatchStatus(prev => ({ ...prev, [i]: 'generating' }));

            try {
                const mappedInput = mapLessonToInput(lessons[i], params);
                const controller = new AbortController();
                batchAbortRef.current = controller;

                // Generate lesson plan
                const streamFn = language === 'zh'
                    ? generateLessonPlanStreamingCN
                    : generateLessonPlanStreaming;

                const result: LessonPlanResponse = await streamFn(
                    mappedInput,
                    () => { /* no progressive UI needed for batch */ },
                    controller.signal,
                );

                // Auto-translate for EN kits
                if (language === 'en') {
                    try {
                        const translated = await translateLessonPlan(result, 'Simplified Chinese', controller.signal);
                        result.translatedPlan = translated;
                    } catch {
                        console.warn(`Batch: translation failed for lesson ${i + 1}, skipping.`);
                    }
                }

                // Auto-save to Records
                const newId = crypto.randomUUID();
                const newSavedPlan: SavedLessonPlan = {
                    id: newId,
                    timestamp: Date.now(),
                    name: result.missionBriefing?.title || lessons[i].title || `Lesson ${i + 1}`,
                    plan: result,
                    language,
                };
                const updatedPlans = [newSavedPlan, ...savedPlansRef.current];
                savedPlansRef.current = updatedPlans;
                setSavedPlans(updatedPlans);
                safeStorage.set('nature-compass-plans', updatedPlans);

                setBatchStatus(prev => ({ ...prev, [i]: 'done' }));
                setBatchLessonMap(prev => ({ ...prev, [i]: newId }));
                doneCount++;
            } catch (err: any) {
                if (batchCancelRef.current) break;
                console.error(`Batch generate lesson ${i + 1} failed:`, err);
                setBatchStatus(prev => ({ ...prev, [i]: 'error' }));
                errorCount++;
            }

            setBatchProgress({ done: doneCount, total: lessons.length, errors: errorCount });
        }

        batchAbortRef.current = null;
        setBatchRunning(false);
    };

    const handleCancelBatch = () => {
        batchCancelRef.current = true;
        // Abort the currently running API call
        if (batchAbortRef.current) {
            batchAbortRef.current.abort();
            batchAbortRef.current = null;
        }
    };

    const resetBatch = () => {
        setBatchStatus({});
        setBatchLessonMap({});
        setBatchProgress({ done: 0, total: 0, errors: 0 });
        setBatchRunning(false);
        batchCancelRef.current = false;
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
