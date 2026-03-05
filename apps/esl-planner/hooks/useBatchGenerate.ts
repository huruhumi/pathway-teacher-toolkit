import { useState, useRef, useEffect } from 'react';
import type { SavedLesson, CurriculumLesson, CurriculumParams, ESLCurriculum } from '../types';
import { safeStorage } from '@shared/safeStorage';
import { mapLessonToESLInput } from '../utils/curriculumMapper';
import { generateLessonPlan } from '../services/geminiService';

export interface BatchState {
    status: Record<number, 'idle' | 'generating' | 'done' | 'error'>;
    lessonMap: Record<number, string>;
    running: boolean;
    progress: { done: number; total: number; errors: number };
}

export function useBatchGenerate() {
    const [batchState, setBatchState] = useState<BatchState>({
        status: {},
        lessonMap: {},
        running: false,
        progress: { done: 0, total: 0, errors: 0 }
    });
    const batchCancelRef = useRef(false);

    const handleBatchGenerate = async (
        lessons: CurriculumLesson[],
        params: CurriculumParams,
        saveLesson: (saved: SavedLesson) => void,
        curriculum?: ESLCurriculum | null
    ) => {
        batchCancelRef.current = false;
        setBatchState(prev => ({
            ...prev,
            running: true,
            progress: { done: 0, total: lessons.length, errors: 0 }
        }));
        let doneCount = 0;
        let errorCount = 0;

        for (let i = 0; i < lessons.length; i++) {
            if (batchCancelRef.current) break;

            // Skip already generated
            if (batchState.status[i] === 'done') {
                doneCount++;
                setBatchState(prev => ({
                    ...prev,
                    progress: { ...prev.progress, done: doneCount }
                }));
                continue;
            }

            setBatchState(prev => ({
                ...prev,
                status: { ...prev.status, [i]: 'generating' }
            }));
            try {
                const mapped = mapLessonToESLInput(lessons[i], params, curriculum);
                const content = await generateLessonPlan(
                    mapped.text, [], mapped.level, mapped.topic,
                    mapped.slideCount, mapped.duration, mapped.studentCount, mapped.lessonTitle
                );

                // Auto-save to Records
                const id = Date.now().toString();
                const newRecord: SavedLesson = {
                    id,
                    timestamp: Date.now(),
                    lastModified: Date.now(),
                    topic: content.structuredLessonPlan.classInformation.topic || lessons[i].title,
                    level: content.structuredLessonPlan.classInformation.level,
                    content,
                };
                saveLesson(newRecord);

                doneCount++;
                setBatchState(prev => ({
                    ...prev,
                    status: { ...prev.status, [i]: 'done' },
                    lessonMap: { ...prev.lessonMap, [i]: id },
                    progress: { done: doneCount, total: lessons.length, errors: errorCount }
                }));
            } catch (err: any) {
                console.error(`Batch generate lesson ${i + 1} failed: `, err);
                errorCount++;
                setBatchState(prev => ({
                    ...prev,
                    status: { ...prev.status, [i]: 'error' },
                    progress: { done: doneCount, total: lessons.length, errors: errorCount }
                }));
            }
        }
        setBatchState(prev => ({ ...prev, running: false }));
    };

    const handleCancelBatch = () => { batchCancelRef.current = true; };

    return {
        batchStatus: batchState.status,
        batchLessonMap: batchState.lessonMap,
        batchRunning: batchState.running,
        batchProgress: batchState.progress,
        handleBatchGenerate,
        handleCancelBatch,
    };
}
