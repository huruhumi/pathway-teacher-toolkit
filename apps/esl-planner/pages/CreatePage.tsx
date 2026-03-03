import React, { useState, useRef } from 'react';
import { InputSection } from '../components/InputSection';
import { OutputDisplay } from '../components/OutputDisplay';
import { ErrorModal } from '../components/ErrorModal';
import { ArrowLeft } from 'lucide-react';
import { generateLessonPlan } from '../services/geminiService';
import { useLanguage } from '../i18n/LanguageContext';
import type { CEFRLevel, AppState, GeneratedContent } from '../types';
import type { MappedESLInput } from '../utils/curriculumMapper';

import { useAppStore, useSessionStore } from '../stores/appStore';
import { useLessonHistory } from '../hooks/useLessonHistory';

export interface CreatePageProps {
}

export const CreatePage: React.FC<CreatePageProps> = () => {
    const { state, setState } = useSessionStore();
    const { activeLessonId, setActiveLessonId, prefilledValues, setPrefilledValues } = useAppStore();
    const history = useLessonHistory();
    const onSaveLesson = history.handleSaveLesson;

    const { t } = useLanguage();
    // Create an abort controller ref that survives re-renders
    const abortControllerRef = useRef<AbortController | null>(null);

    const handleStopGeneration = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setState(prev => ({ ...prev, isLoading: false, error: "Generation cancelled by user." }));
    };

    const handleGenerate = async (
        text: string, files: File[], level: CEFRLevel, topic: string,
        slideCount: number, duration: string, studentCount: string, lessonTitle: string
    ) => {
        setState(prev => ({ ...prev, isLoading: true, error: null, generatedContent: null }));
        setActiveLessonId(null);
        abortControllerRef.current = new AbortController();
        try {
            const lessonContent = await generateLessonPlan(
                text, files, level, topic, slideCount, duration, studentCount, lessonTitle, abortControllerRef.current.signal
            );
            setState({ isLoading: false, generatedContent: lessonContent, error: null });
        } catch (error: any) {
            if (error.name === 'AbortError' || error.message === 'Operation aborted') return;
            console.error(error);
            let errorMessage = "Failed to generate lesson plan.";
            if (error.message) {
                if (error.message.includes('API key')) errorMessage = "Invalid API Key.";
                else if (error.message.includes('fetch') || error.message.includes('network')) errorMessage = "Network Error.";
                else if (error.message.includes('SAFE') || error.message.includes('Safety')) errorMessage = "Generation blocked by Safety Filters.";
                else errorMessage = error.message;
            }
            setState({ isLoading: false, generatedContent: null, error: errorMessage });
        } finally {
            abortControllerRef.current = null;
        }
    };

    return (
        <>
            {!state.generatedContent && (
                <InputSection
                    onGenerate={handleGenerate}
                    isLoading={state.isLoading}
                    initialValues={prefilledValues}
                    onStop={handleStopGeneration}
                />
            )}
            {state.error && <ErrorModal message={state.error} onClose={() => setState(prev => ({ ...prev, error: null }))} />}
            {state.generatedContent && (
                <div className="animate-fade-in-up">
                    <div className="mb-4">
                        <button
                            onClick={() => { setState(prev => ({ ...prev, generatedContent: null })); setActiveLessonId(null); setPrefilledValues(null); }}
                            className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors mb-4 text-sm md:text-base"
                        >
                            <ArrowLeft className="w-4 h-4" /> {t('plan.backToGenerator')}
                        </button>
                        <OutputDisplay key={activeLessonId || 'new'} content={state.generatedContent} onSave={(c) => onSaveLesson(c)} />
                    </div>
                </div>
            )}
        </>
    );
};
