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
  const {
    isLoading,
    error,
    factSheetDecision,
    handleSubmit,
    handleStop,
    handleContinueWithoutFactSheet,
    handleUseFallbackFactSheet,
  } = useLessonKitGeneration({
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
          {factSheetDecision && (
            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="text-amber-900 font-semibold mb-2">
                {lang === 'zh' ? '知识底稿生成失败' : 'Fact sheet generation failed'}
              </div>
              <div className="text-sm text-amber-800 mb-4">
                {factSheetDecision.reason}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleContinueWithoutFactSheet}
                  className="px-4 py-2 rounded-lg bg-slate-700 text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
                >
                  {lang === 'zh' ? '继续（无知识底稿）' : 'Continue without fact sheet'}
                </button>
                <button
                  onClick={() => void handleUseFallbackFactSheet()}
                  disabled={factSheetDecision.isFallbackLoading}
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:bg-emerald-300 transition-colors"
                >
                  {factSheetDecision.isFallbackLoading
                    ? (lang === 'zh' ? '正在生成 fallback...' : 'Generating fallback...')
                    : (lang === 'zh' ? '使用 fallback 知识底稿' : 'Use fallback fact sheet')}
                </button>
              </div>
            </div>
          )}
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
