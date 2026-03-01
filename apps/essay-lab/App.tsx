
import React, { useState, useRef, useCallback } from 'react';
import { analyzeEssay } from './services/geminiService';
import { CorrectionReport, StudentGrade, CEFRLevel, SavedRecord } from './types';
import ReportDisplay from './components/ReportDisplay';
import CorrectionRecords, { saveRecord } from './components/CorrectionRecords';
import EssayLibrary from './components/EssayLibrary';
import { GraduationCap, History, X, School, Gauge, Target, CloudUpload, Image as ImageIcon, PenTool, Camera, Sparkles, AlertCircle, Feather, BookOpen } from 'lucide-react';
import { AppHeader } from '@shared/components/AppHeader';
import { HeroBanner } from '@shared/components/HeroBanner';
import { PageLayout } from '@shared/components/PageLayout';
import { BodyContainer } from '@shared/components/BodyContainer';
import { HeaderToggles } from '@shared/components/HeaderToggles';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext';

interface FileData {
  base64: string;
  mimeType: string;
  name: string;
}

const AppContent: React.FC = () => {
  const { t, lang, setLang } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<CorrectionReport | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [viewMode, setViewMode] = useState<'correction' | 'essays' | 'records'>('correction');

  // Essay Inputs
  const [essayText, setEssayText] = useState('');
  const [essayImage, setEssayImage] = useState<FileData | null>(null);

  // Topic Inputs
  const [topicText, setTopicText] = useState('');
  const [topicImage, setTopicImage] = useState<FileData | null>(null);

  // Settings
  const [selectedGrade, setSelectedGrade] = useState<StudentGrade>(StudentGrade.G7);
  const [selectedCEFR, setSelectedCEFR] = useState<CEFRLevel>(CEFRLevel.B1);

  const [loadingMessage, setLoadingMessage] = useState(t('loading.1'));

  const essayFileRef = useRef<HTMLInputElement>(null);
  const topicFileRef = useRef<HTMLInputElement>(null);

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
    const interval = setInterval(() => {
      if (i < messages.length) {
        setLoadingMessage(messages[i]);
        i++;
      } else {
        clearInterval(interval);
      }
    }, 2000);
    return interval;
  }, [messages]);

  const readFile = (file: File): Promise<FileData> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve({
          base64: (reader.result as string).split(',')[1],
          mimeType: file.type,
          name: file.name
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleEssayFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setEssayImage(await readFile(file));
  };

  const handleTopicFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setTopicImage(await readFile(file));
  };

  const handleSubmit = async () => {
    const essay = essayImage ? { base64: essayImage.base64, mimeType: essayImage.mimeType } : essayText;
    const topic = topicImage ? { base64: topicImage.base64, mimeType: topicImage.mimeType } : topicText;

    if (!essay) {
      setError(t('input.noContent'));
      return;
    }

    setError(null);
    setLoading(true);
    const interval = triggerLoadingMessages();

    try {
      const result = await analyzeEssay(essay, selectedGrade, selectedCEFR, topic);
      setReport(result);
      // Auto-save to records
      const record: SavedRecord = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        grade: selectedGrade,
        cefr: selectedCEFR,
        topicText: topicText || undefined,
        essayText: essayText || undefined,
        report: result,
      };
      saveRecord(record);
    } catch (err: any) {
      setError(err.message || t('input.error'));
    } finally {
      setLoading(false);
      clearInterval(interval);
    }
  };

  const reset = () => {
    setReport(null);
    setIsPreviewing(false);
    setError(null);
    setEssayText('');
    setEssayImage(null);
    setTopicText('');
    setTopicImage(null);
  };

  const handleTogglePreview = (show: boolean) => {
    setIsPreviewing(show);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans selection:bg-indigo-100 dark:selection:bg-indigo-900 dark:text-slate-300">
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
        />
      )}

      <PageLayout className={isPreviewing ? 'print:p-0' : ''}>
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
          {viewMode === 'essays' ? (
            <EssayLibrary />
          ) : viewMode === 'records' ? (
            <CorrectionRecords />
          ) : !report && !loading ? (
            <>
              <div className="space-y-8">
                {/* Title */}
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-500" />
                  {t('input.submit')}
                </h2>

                {/* Grade & CEFR Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      <School className="w-4 h-4 text-indigo-500" />
                      {t('input.grade')}
                    </label>
                    <select
                      value={selectedGrade}
                      onChange={(e) => setSelectedGrade(e.target.value as StudentGrade)}
                      className="input-field appearance-none cursor-pointer py-3"
                    >
                      {Object.values(StudentGrade).map(grade => (
                        <option key={grade} value={grade}>{grade}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      <Gauge className="w-4 h-4 text-indigo-500" />
                      {t('input.cefr')}
                    </label>
                    <select
                      value={selectedCEFR}
                      onChange={(e) => setSelectedCEFR(e.target.value as CEFRLevel)}
                      className="input-field appearance-none cursor-pointer py-3"
                    >
                      {Object.values(CEFRLevel).map(level => (
                        <option key={level} value={level}>{level}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Prompt & Essay Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Essay Prompt */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <Target className="w-4 h-4 text-indigo-500" />
                        {t('input.prompt')}
                      </label>
                      <button
                        onClick={() => topicFileRef.current?.click()}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                      >
                        <CloudUpload className="w-4 h-4" />
                        {topicImage ? t('input.changeImage') : t('input.uploadImage')}
                      </button>
                    </div>

                    {topicImage && (
                      <div className="bg-indigo-50 p-2 rounded-xl border border-indigo-100 flex items-center justify-between">
                        <div className="flex items-center gap-2 truncate">
                          <ImageIcon className="w-4 h-4 text-indigo-400" />
                          <span className="text-xs font-medium text-indigo-700 truncate">{topicImage.name}</span>
                        </div>
                        <button onClick={() => setTopicImage(null)} className="text-indigo-400 hover:text-rose-500">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    <textarea
                      value={topicText}
                      onChange={(e) => setTopicText(e.target.value)}
                      placeholder={t('input.promptPlaceholder')}
                      className="input-field h-48 text-sm resize-none"
                    />
                    <input type="file" ref={topicFileRef} onChange={handleTopicFileChange} className="hidden" accept="image/*" />
                  </div>

                  {/* Student Essay */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <PenTool className="w-4 h-4 text-indigo-500" />
                        {t('input.essay')}
                      </label>
                      <button
                        onClick={() => essayFileRef.current?.click()}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                      >
                        <Camera className="w-4 h-4" />
                        {essayImage ? t('input.changePhoto') : t('input.takePhoto')}
                      </button>
                    </div>

                    {essayImage && (
                      <div className="bg-indigo-50 p-2 rounded-xl border border-indigo-100 flex items-center justify-between">
                        <div className="flex items-center gap-2 truncate">
                          <ImageIcon className="w-4 h-4 text-indigo-400" />
                          <span className="text-xs font-medium text-indigo-700 truncate">{essayImage.name}</span>
                        </div>
                        <button onClick={() => setEssayImage(null)} className="text-indigo-400 hover:text-rose-500">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    <textarea
                      value={essayText}
                      onChange={(e) => setEssayText(e.target.value)}
                      placeholder={t('input.essayPlaceholder')}
                      className="input-field h-48 text-sm resize-none font-sans"
                    />
                    <input type="file" ref={essayFileRef} onChange={handleEssayFileChange} className="hidden" accept="image/*" />
                  </div>
                </div>

                {/* Submit Button */}
                <div className="pt-2">
                  <button
                    onClick={handleSubmit}
                    className="w-full rounded-xl py-4 font-bold text-lg flex items-center justify-center gap-3 transition-all shadow-md bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Sparkles className="w-5 h-5" />
                    {t('input.submit')}
                  </button>
                </div>
              </div>

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
                <h3 className="text-xl font-bold text-slate-800">{t('loading.title')}</h3>
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
        </BodyContainer>
      </PageLayout>

      {!isPreviewing && (
        <footer className="py-12 border-t border-slate-200 dark:border-white/5 mt-12 print:hidden backdrop-blur-sm dark:bg-slate-950/50">
          <div className="max-w-5xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6 text-slate-400 text-sm">
            <div className="flex items-center gap-2 grayscale opacity-50">
              <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center text-white">
                <GraduationCap className="w-4 h-4" />
              </div>
              <span className="font-bold">Essay Lab</span>
            </div>
            <p>{t('footer')}</p>
          </div>
        </footer>
      )}
    </div>
  );
};

const App: React.FC = () => (
  <LanguageProvider>
    <AppContent />
  </LanguageProvider>
);

export default App;
