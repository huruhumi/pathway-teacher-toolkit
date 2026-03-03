import React, { useState, useRef, useEffect } from 'react';
import { InputSection } from '../components/InputSection';
import { LessonPlanDisplay } from '../components/LessonPlanDisplay';
import { ArrowLeft } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { generateLessonPlanStreaming, translateLessonPlan, generateLessonPlanStreamingCN } from '../services/geminiService';
import type { LessonInput, LessonPlanResponse } from '../types';

import { useAppStore, useSessionStore } from '../stores/appStore';

export interface LessonKitPageProps {
    onSavePlan: (plan: LessonPlanResponse, coverImage?: string | null) => void;
}

const LOADING_STEPS = [
    "Consulting the Curriculum Oracle...",
    "Designing the teaching roadmap...",
    "Drafting the student handbook...",
    "Curating specialized vocabulary...",
    "Translating materials to Chinese...",
    "Applying final polish..."
];

export const LessonKitPage: React.FC<LessonKitPageProps> = ({
    onSavePlan,
}) => {
    const { lang } = useLanguage();
    const { input, setInput, currentPlanId, setCurrentPlanId, currentKitLanguage } = useAppStore();
    const { lessonPlan, setLessonPlan } = useSessionStore();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loadingStep, setLoadingStep] = useState(0);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Progression of loading steps
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (isLoading) {
            interval = setInterval(() => {
                setLoadingStep(prev => (prev < LOADING_STEPS.length - 1 ? prev + 1 : prev));
            }, 3500);
        }
        return () => clearInterval(interval);
    }, [isLoading]);

    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setIsLoading(false);
            setError("Generation stopped by user.");
        }
    };

    const handleSubmit = async () => {
        setIsLoading(true);
        setLoadingStep(0);
        setError(null);
        setLessonPlan(null);
        setCurrentPlanId(null);

        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            const streamFn = currentKitLanguage === 'zh' ? generateLessonPlanStreamingCN : generateLessonPlanStreaming;
            const result = await streamFn(
                input,
                (partial, keys) => {
                    if (keys.includes('missionBriefing')) setLoadingStep(1);
                    if (keys.includes('roadmap')) setLoadingStep(2);
                    if (keys.includes('handbook')) setLoadingStep(3);
                    if (keys.includes('vocabulary')) setLoadingStep(4);
                },
                controller.signal
            );

            if (currentKitLanguage === 'en') {
                setLoadingStep(5);
                try {
                    const translatedResult = await translateLessonPlan(result, 'Simplified Chinese', controller.signal);
                    result.translatedPlan = translatedResult;
                } catch (transErr) {
                    console.error("Upfront translation failed, falling back to English only:", transErr);
                }
            } else {
                setLoadingStep(5);
            }

            setLessonPlan(result);

            setTimeout(() => {
                const resultsElement = document.getElementById('results-section');
                if (resultsElement) {
                    resultsElement.scrollIntoView({ behavior: 'smooth' });
                }
            }, 100);

        } catch (err: any) {
            if (err.name === 'AbortError' || (err.message && err.message.includes('aborted'))) {
                // Generation aborted
                setError("Generation stopped.");
            } else {
                const errorMessage = err.message || "Failed to generate lesson plan. Please try again.";
                setError(errorMessage);
                alert(`Error: ${errorMessage}`);
                console.error(err);
            }
        } finally {
            if (abortControllerRef.current === controller) {
                setIsLoading(false);
                setLoadingStep(0);
                abortControllerRef.current = null;
            }
        }
    };

    return (
        <>
            {!lessonPlan ? (
                <div className="w-full max-w-3xl mx-auto">
                    <InputSection
                        input={input}
                        setInput={setInput}
                        onSubmit={handleSubmit}
                        onStop={handleStop}
                        isLoading={isLoading}
                    />
                    {error && (
                        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-center mt-6">
                            {error}
                        </div>
                    )}
                </div>
            ) : (
                <div id="results-section" className="w-full pb-20 mt-4 animate-fade-in-up">
                    <div className="mb-4">
                        <button
                            onClick={() => { setLessonPlan(null); setCurrentPlanId(null); }}
                            className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors mb-4 text-sm md:text-base"
                        >
                            <ArrowLeft className="w-4 h-4" /> {lang === 'zh' ? '返回生成器' : 'Back to Generator'}
                        </button>
                        <LessonPlanDisplay
                            plan={lessonPlan}
                            onSave={onSavePlan}
                        />
                    </div>
                </div>
            )}
        </>
    );
};
