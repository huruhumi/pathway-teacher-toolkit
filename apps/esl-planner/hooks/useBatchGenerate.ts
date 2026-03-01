import { useState, useRef, useEffect, MutableRefObject } from 'react';
import { SavedLesson, CurriculumLesson, CurriculumParams } from '../types';
import { safeStorage } from '@shared/safeStorage';
import { mapLessonToESLInput } from '../utils/curriculumMapper';
import { generateLessonPlan } from '../services/geminiService';

export function useBatchGenerate(
    savedLessonsRef: MutableRefObject<SavedLesson[]>,
    setSavedLessons: (lessons: SavedLesson[]) => void,
) {
    const [batchStatus, setBatchStatus] = useState<Record<number, 'idle' | 'generating' | 'done' | 'error'>>({});
    const [batchLessonMap, setBatchLessonMap] = useState<Record<number, string>>({});
    const [batchRunning, setBatchRunning] = useState(false);
    const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0, errors: 0 });
    const batchCancelRef = useRef(false);

    const handleBatchGenerate = async (lessons: CurriculumLesson[], params: CurriculumParams) => {
        batchCancelRef.current = false;
        setBatchRunning(true);
        setBatchProgress({ done: 0, total: lessons.length, errors: 0 });
        let doneCount = 0;
        let errorCount = 0;

        for (let i = 0; i < lessons.length; i++) {
            if (batchCancelRef.current) break;

            // Skip already generated
            if (batchStatus[i] === 'done') {
                doneCount++;
                setBatchProgress(p => ({ ...p, done: doneCount }));
                continue;
            }

            setBatchStatus(prev => ({ ...prev, [i]: 'generating' }));
            try {
                const mapped = mapLessonToESLInput(lessons[i], params);
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
                const updatedLessons = [newRecord, ...savedLessonsRef.current];
                setSavedLessons(updatedLessons);
                safeStorage.set('esl_smart_planner_history', updatedLessons);

                setBatchStatus(prev => ({ ...prev, [i]: 'done' }));
                setBatchLessonMap(prev => ({ ...prev, [i]: id }));
                doneCount++;
            } catch (err: any) {
                console.error(`Batch generate lesson ${i + 1} failed:`, err);
                setBatchStatus(prev => ({ ...prev, [i]: 'error' }));
                errorCount++;
            }
            setBatchProgress({ done: doneCount, total: lessons.length, errors: errorCount });
        }
        setBatchRunning(false);
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
