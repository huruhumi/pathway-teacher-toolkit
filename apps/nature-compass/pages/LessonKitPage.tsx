import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { InputSection } from '../components/InputSection';
import { LessonPlanDisplay } from '../components/LessonPlanDisplay';
import { useLanguage } from '../i18n/LanguageContext';
import { useLessonKitGeneration } from '../hooks/useLessonKitGeneration';
import { useAppStore, useSessionStore } from '../stores/appStore';
import type { LessonPlanResponse } from '../types';

export interface LessonKitPageProps {
  onSavePlan: (plan: LessonPlanResponse, coverImage?: string | null) => void;
}

export const LessonKitPage: React.FC<LessonKitPageProps> = ({ onSavePlan }) => {
  const { lang } = useLanguage();
  const { input, setInput, setCurrentPlanId, currentKitLanguage } = useAppStore();
  const { lessonPlan, setLessonPlan } = useSessionStore();
  const { isLoading, error, handleSubmit, handleStop } = useLessonKitGeneration({
    input,
    currentKitLanguage,
    setInput,
    setCurrentPlanId,
    setLessonPlan,
  });

  return (
    <>
      {!lessonPlan ? (
        <div className="w-full max-w-3xl mx-auto">
          <InputSection input={input} setInput={setInput} onSubmit={handleSubmit} onStop={handleStop} isLoading={isLoading} />
          {error && <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-center mt-6">{error}</div>}
        </div>
      ) : (
        <div id="results-section" className="w-full pb-20 mt-4 animate-fade-in-up">
          <div className="mb-4">
            <button
              onClick={() => {
                setLessonPlan(null);
                setCurrentPlanId(null);
              }}
              className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors mb-4 text-sm md:text-base"
            >
              <ArrowLeft className="w-4 h-4" /> {lang === 'zh' ? '返回生成器' : 'Back to Generator'}
            </button>
            <LessonPlanDisplay plan={lessonPlan} onSave={onSavePlan} mode={input.mode} />
          </div>
        </div>
      )}
    </>
  );
};
