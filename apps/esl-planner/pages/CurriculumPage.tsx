import React from 'react';
import { CurriculumPlanner } from '../components/CurriculumPlanner';
import type { CurriculumLesson, CurriculumParams, ESLCurriculum } from '../types';
import { useSessionStore, useAppStore } from '../stores/appStore';
import { useLessonHistory } from '../hooks/useLessonHistory';
import { useBatchGenerate } from '../hooks/useBatchGenerate';

export interface CurriculumPageProps {
    onGenerateKit: (lesson: CurriculumLesson, params: CurriculumParams, curriculum?: ESLCurriculum, curriculumId?: string) => void;
    onGoToCreate: () => void;
}

export const CurriculumPage: React.FC<CurriculumPageProps> = ({
    onGenerateKit, onGoToCreate
}) => {
    const { loadedCurriculum, setState } = useSessionStore();
    const { setActiveLessonId } = useAppStore();
    const history = useLessonHistory();
    const onSaveCurriculum = history.handleSaveCurriculum;
    const { savedLessons, saveLessonDb } = history;

    const { batchStatus, batchLessonMap, batchRunning, batchProgress, handleBatchGenerate, handleCancelBatch } = useBatchGenerate();

    const handleOpenKit = (savedLessonId: string) => {
        const record = savedLessons.find(l => l.id === savedLessonId);
        if (record) {
            setActiveLessonId(record.id);
            setState({ isLoading: false, generatedContent: record.content, error: null });
            onGoToCreate();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    return (
        <CurriculumPlanner
            onGenerateKit={onGenerateKit}
            onSaveCurriculum={onSaveCurriculum}
            loadedCurriculum={loadedCurriculum}
            savedLessons={savedLessons}
            savedCurricula={history.savedCurricula}
            batchStatus={batchStatus}
            batchLessonMap={batchLessonMap}
            batchRunning={batchRunning}
            batchProgress={batchProgress}
            onBatchGenerate={(lessons, params, curriculum) => {
                const sc = curriculum ? history.savedCurricula.find(c => c.textbookTitle === curriculum.textbookTitle && c.totalLessons === curriculum.totalLessons) : undefined;
                handleBatchGenerate(lessons, params, saveLessonDb, curriculum, sc?.id);
            }}
            onCancelBatch={handleCancelBatch}
            onOpenKit={handleOpenKit}
        />
    );
};
