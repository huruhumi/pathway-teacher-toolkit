
import React, { useState, useRef, useCallback, useEffect, Suspense } from 'react';
import { useHashTab } from '@shared/hooks/useHashTab';
import { analyzeEssay } from './services/geminiService';
import { CorrectionReport, StudentGrade, CEFRLevel, SavedRecord, FileData } from './types';
import ReportDisplay from './components/ReportDisplay';
import { saveRecord } from './components/CorrectionRecords';
const CorrectionRecords = React.lazy(() => import('./components/CorrectionRecords'));
const EssayLibrary = React.lazy(() => import('./components/EssayLibrary'));
import { GraduationCap, History, X, School, Gauge, Target, CloudUpload, Image as ImageIcon, PenTool, Camera, Sparkles, AlertCircle, Feather, BookOpen } from 'lucide-react';
import { AppHeader } from '@shared/components/AppHeader';
import { HeroBanner } from '@shared/components/HeroBanner';
import { PageLayout } from '@shared/components/PageLayout';
import { BodyContainer } from '@shared/components/BodyContainer';
import AppFooter from '@shared/components/AppFooter';
import { HeaderToggles } from '@shared/components/HeaderToggles';
import { ErrorBoundary } from '@shared/components/ErrorBoundary';
import ToastContainer from '@shared/components/ui/ToastContainer';
import AppLayout from '@shared/components/AppLayout';
import { RouteGuard } from '@shared/components/auth/RouteGuard';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext';
import { EssayInputForm } from './components/EssayInputForm';



const AppContent: React.FC = () => {
  const { t, lang, setLang } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<CorrectionReport | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [viewMode, setViewMode] = useHashTab<'correction' | 'essays' | 'records'>('correction', ['correction', 'essays', 'records']);

  const [loadingMessage, setLoadingMessage] = useState(t('loading.1'));
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const messages = [
    t('loading.2'),
    t('loading.3'),
    t('loading.4'),
    t('loading.5'),
    t('loading.6'),
    t('loading.7'),
  ];

  const triggerLoadingMessages = useCallback(() => {
    let i = 0;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (i < messages.length) {
        setLoadingMessage(messages[i]);
        i++;
      } else {
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    }, 2000);
    return intervalRef.current;
  }, [messages]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const handleSubmit = async (data: {
    essay: string | FileData;
    grade: StudentGrade;
    cefr: CEFRLevel;
    topic: string | FileData;
  }) => {
    setError(null);
    setLoading(true);
    const interval = triggerLoadingMessages();

    try {
      const result = await analyzeEssay(data.essay, data.grade, data.cefr, data.topic);
      setReport(result);
      // Auto-save to records
      const record: SavedRecord = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        grade: data.grade,
        cefr: data.cefr,
        topicText: typeof data.topic === 'string' ? data.topic : undefined,
        essayText: typeof data.essay === 'string' ? data.essay : undefined,
        report: result,
      };
      saveRecord(record);
    } catch (err: any) {
      setError(err.message || t('input.error'));
    } finally {
      setLoading(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  };

  const reset = () => {
    setReport(null);
    setIsPreviewing(false);
    setError(null);
  };

  const handleTogglePreview = (show: boolean) => {
    setIsPreviewing(show);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <RouteGuard>
      <AppLayout currentApp="essay-lab" userName="Teacher">
        <div className="min-h-screen h-full w-full overflow-y-auto bg-slate-50 dark:bg-slate-950 font-sans selection:bg-indigo-100 dark:selection:bg-indigo-900 dark:text-slate-300 flex flex-col">
          {/* Header hidden during full-screen preview */}
          {!isPreviewing && (
            <AppHeader
              appName="Essay Lab"
              logoIcon={<GraduationCap className="w-5 h-5" />}
              brand={{
                logoBg: 'bg-indigo-600',
                activeBg: 'bg-indigo-50',
                activeText: 'text-indigo-700',
              }}
              tabs={[
                { key: 'correction', label: t('nav.home'), icon: <Feather className="w-4 h-4" /> },
                { key: 'essays', label: t('nav.about'), icon: <BookOpen className="w-4 h-4" /> },
                { key: 'records', label: t('nav.resources'), icon: <History className="w-4 h-4" /> },
              ]}
              activeTab={viewMode}
              onTabChange={(key) => { setViewMode(key as typeof viewMode); if (key === 'correction') { setReport(null); setIsPreviewing(false); } }}
              onLogoClick={() => { setViewMode('correction'); setReport(null); setIsPreviewing(false); }}
              rightContent={<HeaderToggles lang={lang} onLangChange={setLang} />}
              signInLabel={lang === 'zh' ? '登录' : 'Sign In'}
            />
          )}

          <PageLayout className={isPreviewing ? 'print:p-0' : 'flex-1'}>
            {!isPreviewing && (
              <HeroBanner
                title={lang === 'zh' ? 'AI 驱动的作文精批系统' : 'AI-Powered Essay Correction'}
                description={lang === 'zh'
                  ? '上传学生作文，获取细致的语法纠错、词汇提升、句式分析和个性化教学建议，全方位提升写作能力。'
                  : 'Upload student essays to receive detailed grammar corrections, vocabulary enhancement, sentence analysis, and personalized teaching suggestions.'}
                gradient="from-indigo-600 via-violet-600 to-purple-700"
                tags={[
                  { label: lang === 'zh' ? '智能批改' : 'Smart Grading' },
                  { label: lang === 'zh' ? '词汇提升' : 'Vocabulary Boost' },
                  { label: lang === 'zh' ? '句式分析' : 'Sentence Analysis' },
                ]}
              />
            )}
            <BodyContainer>
              <Suspense fallback={<div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>}>
                {viewMode === 'essays' ? (
                  <EssayLibrary />
                ) : viewMode === 'records' ? (
                  <CorrectionRecords />
                ) : !report && !loading ? (
                  <>
                    <EssayInputForm onSubmit={handleSubmit} disabled={loading} />

                    {error && (
                      <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-sm flex items-center gap-3 max-w-lg mx-auto mt-6">
                        <AlertCircle className="w-4 h-4" />
                        {error}
                      </div>
                    )}
                  </>
                ) : loading ? (
                  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8">
                    <div className="relative">
                      <div className="w-24 h-24 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Feather className="w-5 h-5 text-indigo-600 animate-bounce" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">{t('loading.title')}</h3>
                      <p className="text-indigo-600 font-medium animate-pulse">{loadingMessage}</p>
                    </div>
                  </div>
                ) : (
                  report && (
                    <ReportDisplay
                      report={report}
                      onReset={reset}
                      readOnly={isPreviewing}
                      onTogglePreview={handleTogglePreview}
                    />
                  )
                )}
              </Suspense>
            </BodyContainer>
          </PageLayout>

          {!isPreviewing && (
            <AppFooter appName="Essay Lab" />
          )}
        </div>
      </AppLayout>
    </RouteGuard>
  );
};

const App: React.FC = () => (
  <LanguageProvider>
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
    <ToastContainer />
  </LanguageProvider>
);

export default App;
