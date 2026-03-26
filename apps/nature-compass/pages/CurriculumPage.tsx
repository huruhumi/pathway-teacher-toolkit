import React, { useRef } from 'react';
import { CurriculumPlanner } from '../components/CurriculumPlanner';
import { CurriculumResultDisplay } from '../components/CurriculumResultDisplay';
import type { Curriculum, CurriculumParams, CurriculumLesson, SavedLessonPlan, FactSheetResult } from '../types';
import { useSessionStore, useAppStore } from '../stores/appStore';
import { useBatchGenerate } from '../hooks/useBatchGenerate';
import { safeStorage } from '@shared/safeStorage';

export interface CurriculumPageProps {
    onSaveCurriculum: (curriculum: Curriculum, params: CurriculumParams, language: 'en' | 'zh') => void | Promise<unknown>;
    onGenerateLessonKit: (lesson: CurriculumLesson, params: CurriculumParams, language: 'en' | 'zh', weather: 'Sunny' | 'Rainy') => void;
    onNavigate: (view: 'lesson' | 'saved') => void;
    savedPlans: SavedLessonPlan[];
    savePlanDb: (saved: SavedLessonPlan) => void | Promise<unknown>;
}

export const CurriculumPage: React.FC<CurriculumPageProps> = ({
    onSaveCurriculum, onGenerateLessonKit, onNavigate, savedPlans, savePlanDb,
}) => {
    const {
        curriculumResult,
        setCurriculumResult,
        externalCurriculum,
        setExternalCurriculum,
        setSharedFactSheet,
    } = useSessionStore();
    const { setLessonPlan } = useSessionStore();
    const { setCurrentPlanId } = useAppStore();
    const {
        batchStatus,
        batchLessonMap,
        batchRunning,
        batchProgress,
        handleBatchGenerate,
        handleCancelBatch,
    } = useBatchGenerate();

    const sharedFactSheetRef = useRef<FactSheetResult | undefined>();

    const handleOpenBatchPlan = (savedId: string) => {
        const found = savedPlans.find((p) => p.id === savedId);
        if (!found) return;
        setLessonPlan(found.plan);
        setCurrentPlanId(found.id);
        onNavigate('lesson');
        setTimeout(() => {
            document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    const handleCurriculumGenerated = (data: {
        curriculumEN: Curriculum | null;
        curriculumCN: Curriculum | null;
        params: CurriculumParams;
        activeLanguage: 'en' | 'zh';
        sharedFactSheet?: FactSheetResult;
    }) => {
        sharedFactSheetRef.current = data.sharedFactSheet;
        setSharedFactSheet(data.sharedFactSheet || null);
        setCurriculumResult({
            curriculumEN: data.curriculumEN,
            curriculumCN: data.curriculumCN,
            params: data.params,
            activeLanguage: data.activeLanguage,
        });
    };

    const handleBackToConfig = () => {
        setExternalCurriculum(null);
        setCurriculumResult(null);
        setSharedFactSheet(null);
        safeStorage.remove('nature-compass-curriculum');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleNewCurriculum = () => {
        setExternalCurriculum(null);
        setCurriculumResult(null);
        setSharedFactSheet(null);
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
            onBatchGenerate={(lessons, params, language, weatherByLessonIndex) =>
                handleBatchGenerate(lessons, params, language, savePlanDb, sharedFactSheetRef.current, weatherByLessonIndex)
            }
            onCancelBatch={handleCancelBatch}
            onOpenPlan={handleOpenBatchPlan}
            onCurriculumUpdate={(updated, language) => {
                setCurriculumResult((prev: any) => {
                    if (!prev) return prev;
                    return language === 'en'
                        ? { ...prev, curriculumEN: updated }
                        : { ...prev, curriculumCN: updated };
                });
            }}
        />
    ) : (
        <CurriculumPlanner
            onCurriculumGenerated={handleCurriculumGenerated}
            externalCurriculum={externalCurriculum}
        />
    );
};
