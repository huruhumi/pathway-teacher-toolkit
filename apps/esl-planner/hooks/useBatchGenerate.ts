import { useState, useRef } from 'react';
import type { SavedLesson, CurriculumLesson, CurriculumParams, ESLCurriculum } from '../types';
import { safeStorage } from '@shared/safeStorage';
import { mapLessonToESLInput } from '../utils/curriculumMapper';
import { generateLessonPlan } from '../services/geminiService';
import { useBatchGenerateState } from '@shared/hooks/useBatchGenerateState';

export function useBatchGenerate() {
    const {
        batchStatus, batchLessonMap, batchRunning, batchProgress,
        batchCancelRef, startBatch, incrementDone, incrementError, finishBatch
    } = useBatchGenerateState();

    const handleBatchGenerate = async (
        lessons: CurriculumLesson[],
        params: CurriculumParams,
        saveLesson: (saved: SavedLesson) => void,
        curriculum?: ESLCurriculum | null,
        curriculumId?: string
    ) => {
        startBatch(lessons.length);
        let errorCount = 0;

        for (let i = 0; i < lessons.length; i++) {
            if (batchCancelRef.current) break;

            if (batchStatus[i] === 'done') {
                incrementDone(lessons.length, errorCount, i);
                continue;
            }

            try {
                const mapped = mapLessonToESLInput(lessons[i], params, curriculum);
                const content = await generateLessonPlan(
                    mapped.text, [], mapped.level, mapped.topic,
                    mapped.slideCount, mapped.duration, mapped.studentCount, mapped.lessonTitle
                );

                const id = Date.now().toString();
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
                saveLesson(newRecord);

                incrementDone(lessons.length, errorCount, i, id);
            } catch (err: any) {
                console.error(`Batch generate lesson ${i + 1} failed: `, err);
                errorCount++;
                incrementError(lessons.length, batchProgress.done, i);
            }
        }
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

