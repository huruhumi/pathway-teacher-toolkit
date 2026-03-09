import React, { useState, useRef } from 'react';

export type BatchItemStatus = 'idle' | 'generating' | 'done' | 'error';

export interface BatchProgress {
    done: number;
    total: number;
    errors: number;
}

export interface UseBatchGenerateStateReturn {
    batchStatus: Record<number, BatchItemStatus>;
    batchLessonMap: Record<number, string>;
    batchRunning: boolean;
    batchProgress: BatchProgress;
    batchCancelRef: React.MutableRefObject<boolean>;

    startBatch: (total: number) => void;
    setItemStatus: (index: number, status: BatchItemStatus, id?: string) => void;
    incrementDone: (total: number, errors: number, index: number, id?: string) => void;
    incrementError: (total: number, done: number, index: number) => void;
    finishBatch: () => void;
    resetBatch: () => void;
}

export function useBatchGenerateState(): UseBatchGenerateStateReturn {
    const [batchStatus, setBatchStatus] = useState<Record<number, BatchItemStatus>>({});
    const [batchLessonMap, setBatchLessonMap] = useState<Record<number, string>>({});
    const [batchRunning, setBatchRunning] = useState(false);
    const [batchProgress, setBatchProgress] = useState<BatchProgress>({ done: 0, total: 0, errors: 0 });
    const batchCancelRef = useRef(false);

    const startBatch = (total: number) => {
        batchCancelRef.current = false;
        setBatchRunning(true);
        setBatchProgress({ done: 0, total, errors: 0 });
    };

    const setItemStatus = (index: number, status: BatchItemStatus, id?: string) => {
        setBatchStatus(prev => ({ ...prev, [index]: status }));
        if (id) {
            setBatchLessonMap(prev => ({ ...prev, [index]: id }));
        }
    };

    const incrementDone = (total: number, errors: number, index: number, id?: string) => {
        setBatchStatus(prev => ({ ...prev, [index]: 'done' }));
        if (id) {
            setBatchLessonMap(prev => ({ ...prev, [index]: id }));
        }
        setBatchProgress(prev => ({ ...prev, done: prev.done + 1, total, errors }));
    };

    const incrementError = (total: number, done: number, index: number) => {
        setBatchStatus(prev => ({ ...prev, [index]: 'error' }));
        setBatchProgress(prev => ({ ...prev, errors: prev.errors + 1, total, done }));
    };

    const finishBatch = () => {
        setBatchRunning(false);
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
        batchCancelRef,
        startBatch,
        setItemStatus,
        incrementDone,
        incrementError,
        finishBatch,
        resetBatch
    };
}
