import React from 'react';
import { CurriculumPlanner } from '../components/CurriculumPlanner';
import { CurriculumResultDisplay } from '../components/CurriculumResultDisplay';
import type { Curriculum, CurriculumParams, CurriculumLesson, SavedLessonPlan } from '../types';
import { useSessionStore, useAppStore } from '../stores/appStore';
import { useBatchGenerate } from '../hooks/useBatchGenerate';
import { safeStorage } from '@shared/safeStorage';

export interface CurriculumPageProps {
    onSaveCurriculum: (curriculum: Curriculum, params: CurriculumParams, language: 'en' | 'zh') => void;
    onGenerateLessonKit: (lesson: CurriculumLesson, params: CurriculumParams, language: 'en' | 'zh') => void;
    onNavigate: (view: 'lesson' | 'saved') => void;
    savedPlans: SavedLessonPlan[];
    savePlanDb: (saved: SavedLessonPlan) => void;
}

export const CurriculumPage: React.FC<CurriculumPageProps> = ({
    onSaveCurriculum, onGenerateLessonKit, onNavigate, savedPlans, savePlanDb
}) => {
    const { curriculumResult, setCurriculumResult, externalCurriculum, setExternalCurriculum } = useSessionStore();
    const { setLessonPlan } = useSessionStore();
    const { setCurrentPlanId } = useAppStore();
    const {
        batchStatus, batchLessonMap, batchRunning, batchProgress,
        handleBatchGenerate, handleCancelBatch,
    } = useBatchGenerate();

    const handleOpenBatchPlan = (savedId: string) => {
        const found = savedPlans.find((p) => p.id === savedId);
        if (found) {
            setLessonPlan(found.plan);
            setCurrentPlanId(found.id);
            onNavigate('lesson');
            setTimeout(() => {
                document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        }
    };
    const handleCurriculumGenerated = (data: {
        curriculumEN: Curriculum | null;
        curriculumCN: Curriculum | null;
        params: CurriculumParams;
        activeLanguage: 'en' | 'zh';
    }) => {
        setCurriculumResult(data);
    };

    const handleBackToConfig = () => {
        setExternalCurriculum(null);
        setCurriculumResult(null);
        // Clear cached curriculum so CurriculumPlanner doesn't auto-restore on mount
        safeStorage.remove('nature-compass-curriculum');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleNewCurriculum = () => {
        setExternalCurriculum(null);
        setCurriculumResult(null);
        safeStorage.remove('nature-compass-curriculum');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return curriculumResult ? (
        <CurriculumResultDisplay
            curriculumEN={curriculumResult.curriculumEN}
            curriculumCN={curriculumResult.curriculumCN}
            activeLanguage={curriculumResult.activeLanguage}
            setActiveLanguage={(lang) => setCurriculumResult((prev: any) => prev ? { ...prev, activeLanguage: lang } : prev)}
            savedParams={curriculumResult.params}
            onBack={handleBackToConfig}
            onNew={handleNewCurriculum}
            onSave={onSaveCurriculum}
            onGenerateKit={onGenerateLessonKit}
            batchStatus={batchStatus}
            batchLessonMap={batchLessonMap}
            batchRunning={batchRunning}
            batchProgress={batchProgress}
            onBatchGenerate={(lessons, params, language) => handleBatchGenerate(lessons, params, language, savePlanDb)}
            onCancelBatch={handleCancelBatch}
            onOpenPlan={handleOpenBatchPlan}
        />
    ) : (
        <CurriculumPlanner
            onCurriculumGenerated={handleCurriculumGenerated}
            externalCurriculum={externalCurriculum}
        />
    );
};
