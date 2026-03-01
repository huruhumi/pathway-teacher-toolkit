import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { InputSection } from './components/InputSection';
import { LessonPlanDisplay } from './components/LessonPlanDisplay';
import { SavedProjectsPage } from './components/SavedProjectsPage';
import { CurriculumPlanner } from './components/CurriculumPlanner';
import { CurriculumResultDisplay } from './components/CurriculumResultDisplay';
import { LessonInput, LessonPlanResponse, SavedLessonPlan, SavedCurriculum, Curriculum, CurriculumLesson, CurriculumParams } from './types';
import { generateLessonPlanStreaming, translateLessonPlan, generateLessonPlanStreamingCN } from './services/geminiService';
import { fetchCloudPlans, upsertCloudPlan, deleteCloudPlan, renameCloudPlan } from './services/cloudDataService';
import { useAuthStore } from './stores/useAuthStore';
import { AuthModal } from './components/AuthModal';
import { mapLessonToInput } from './utils/curriculumMapper';
import { LanguageProvider } from './i18n/LanguageContext';
import { safeStorage } from '@shared/safeStorage';
import { imageStore } from '@shared/imageStore';
import { HeroBanner } from '@shared/components/HeroBanner';
import { PageLayout } from '@shared/components/PageLayout';
import { BodyContainer } from '@shared/components/BodyContainer';
import { Compass } from 'lucide-react';
import { useBatchGenerate } from './hooks/useBatchGenerate';
import { useLanguage } from './i18n/LanguageContext';

const NatureHeroBanner = () => {
  const { lang } = useLanguage();
  return (
    <HeroBanner
      title={lang === 'zh' ? 'STEAM 自然教育课程设计' : 'STEAM Nature Education Designer'}
      description={lang === 'zh'
        ? '输入主题即可生成完整的 STEAM 自然教育方案，包含教学路线图、学生手册、词汇卡和物料清单，一键部署户外课堂。'
        : 'Enter a theme to generate complete STEAM nature education plans with teaching roadmaps, student handbooks, flashcards, and supply lists.'}
      gradient="from-emerald-600 via-teal-600 to-cyan-600"
      tags={[
        { label: lang === 'zh' ? '教学路线图' : 'Roadmap' },
        { label: lang === 'zh' ? '学生手册' : 'Handbook' },
        { label: lang === 'zh' ? '词汇闪卡' : 'Flashcards' },
      ]}
    />
  );
};

export const App: React.FC = () => {
  const [input, setInput] = useState<LessonInput>({
    theme: '',
    topicIntroduction: '',
    activityFocus: [],
    weather: 'Sunny',
    season: 'Spring',
    studentAge: '6-8 years (Early Primary)',
    studentCount: 12,
    duration: 180,
    cefrLevel: 'A1 (Beginner)',
    handbookPages: 15,
    uploadedFiles: [],
  });

  const [lessonPlan, setLessonPlan] = useState<LessonPlanResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Abort Controller for stopping generation
  const abortControllerRef = useRef<AbortController | null>(null);

  // Save/Load State
  const [savedPlans, setSavedPlans] = useState<SavedLessonPlan[]>([]);
  const savedPlansRef = useRef<SavedLessonPlan[]>(savedPlans);
  useEffect(() => { savedPlansRef.current = savedPlans; }, [savedPlans]);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [view, setView] = useState<'curriculum' | 'lesson' | 'saved'>('curriculum');
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Saved Curricula State
  const [savedCurricula, setSavedCurricula] = useState<SavedCurriculum[]>([]);
  const [externalCurriculum, setExternalCurriculum] = useState<{ curriculum: Curriculum; params: CurriculumParams; language?: 'en' | 'zh' } | null>(null);

  // Track current language for lesson kit generation
  const [currentKitLanguage, setCurrentKitLanguage] = useState<'en' | 'zh'>('en');

  // Curriculum result state — for separate result page
  const [curriculumResult, setCurriculumResult] = useState<{
    curriculumEN: Curriculum | null;
    curriculumCN: Curriculum | null;
    params: CurriculumParams;
    activeLanguage: 'en' | 'zh';
  } | null>(null);

  // Batch Generate
  const {
    batchStatus, batchLessonMap, batchRunning, batchProgress,
    handleBatchGenerate, handleCancelBatch, resetBatch,
  } = useBatchGenerate(savedPlansRef, setSavedPlans);

  // Auth
  const { user, initialize: initAuth } = useAuthStore();

  // Stepped Loading State
  const [loadingStep, setLoadingStep] = useState(0);
  const LOADING_STEPS = [
    "Consulting the Curriculum Oracle...",
    "Designing the teaching roadmap...",
    "Drafting the student handbook...",
    "Curating specialized vocabulary...",
    "Translating materials to Chinese...",
    "Applying final polish..."
  ];

  // Load from LocalStorage on mount + init auth
  useEffect(() => {
    initAuth();
    const plans: SavedLessonPlan[] = safeStorage.get('nature-compass-plans', []);
    setSavedPlans(plans);
    plans.forEach(p => {
      if (p.coverImage && !p.coverImage.startsWith('data:')) {
        imageStore.get(p.coverImage).then(img => {
          if (img) {
            setSavedPlans(prev => prev.map(pp =>
              pp.id === p.id ? { ...pp, coverImage: img } : pp
            ));
          }
        });
      }
    });
    setSavedCurricula(safeStorage.get('nature-compass-curricula', []));
  }, []);

  // When user logs in, merge cloud plans
  useEffect(() => {
    if (user) {
      fetchCloudPlans(user.id).then(cloudPlans => {
        if (cloudPlans.length > 0) {
          setSavedPlans(prev => {
            const localIds = new Set(prev.map(p => p.id));
            const merged = [...prev];
            for (const cp of cloudPlans) {
              if (!localIds.has(cp.id)) {
                merged.push(cp);
              }
            }
            safeStorage.set('nature-compass-plans', merged);
            return merged;
          });
        }
      });
    }
  }, [user]);

  const handleSavePlan = async (planToSave: LessonPlanResponse, coverImage?: string | null) => {
    const planId = currentPlanId || crypto.randomUUID();

    let coverRef: string | undefined;
    if (coverImage) {
      const imgKey = `nc-${planId}-cover`;
      await imageStore.save(imgKey, coverImage);
      coverRef = imgKey;
    }

    let updatedPlans;
    if (currentPlanId) {
      updatedPlans = savedPlans.map(p =>
        p.id === currentPlanId
          ? {
            ...p,
            timestamp: Date.now(),
            plan: planToSave,
            name: planToSave.missionBriefing.title || p.name,
            ...(coverRef ? { coverImage: coverRef } : {})
          }
          : p
      );
    } else {
      const newSavedPlan: SavedLessonPlan = {
        id: planId,
        timestamp: Date.now(),
        name: planToSave.missionBriefing.title || `Untitled Plan ${new Date().toLocaleDateString()}`,
        plan: planToSave,
        language: currentKitLanguage,
        ...(coverRef ? { coverImage: coverRef } : {})
      };
      updatedPlans = [newSavedPlan, ...savedPlans];
      setCurrentPlanId(planId);
    }

    setSavedPlans(updatedPlans.map(p =>
      p.id === planId && coverImage ? { ...p, coverImage } : p
    ));
    safeStorage.setWithLimit('nature-compass-plans', updatedPlans, 50);

    if (user) {
      const savedPlan = currentPlanId
        ? updatedPlans.find(p => p.id === currentPlanId)
        : updatedPlans[0];
      if (savedPlan) upsertCloudPlan(user.id, savedPlan);
    }
  };

  const handleLoadPlan = (saved: SavedLessonPlan) => {
    setLessonPlan(saved.plan);
    setCurrentPlanId(saved.id);
    setView('lesson');

    setTimeout(() => {
      const resultsElement = document.getElementById('results-section');
      if (resultsElement) {
        resultsElement.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  const handleDeletePlan = (id: string) => {
    const updatedPlans = savedPlans.filter(p => p.id !== id);
    setSavedPlans(updatedPlans);
    safeStorage.set('nature-compass-plans', updatedPlans);
    imageStore.removeByPrefix(`nc-${id}-`);
    if (user) deleteCloudPlan(user.id, id);
    if (currentPlanId === id) {
      setCurrentPlanId(null);
    }
  };

  const handleRenamePlan = (id: string, newName: string) => {
    const updatedPlans = savedPlans.map(p =>
      p.id === id ? { ...p, name: newName } : p
    );
    setSavedPlans(updatedPlans);
    safeStorage.set('nature-compass-plans', updatedPlans);
    if (user) renameCloudPlan(id, newName);
  };

  // --- Curriculum CRUD ---
  const handleSaveCurriculum = (curriculum: Curriculum, params: CurriculumParams, language: 'en' | 'zh') => {
    const name = `${language === 'zh' ? '[中文] ' : ''}${curriculum.theme || `Curriculum ${new Date().toLocaleDateString()}`}`;
    const existingIdx = savedCurricula.findIndex(
      c => c.curriculum.theme === curriculum.theme && c.language === language
    );

    let updated: SavedCurriculum[];
    if (existingIdx !== -1) {
      updated = savedCurricula.map((c, i) =>
        i === existingIdx ? { ...c, curriculum, params, name, timestamp: Date.now() } : c
      );
    } else {
      const newSaved: SavedCurriculum = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        name,
        curriculum,
        params,
        language,
      };
      updated = [newSaved, ...savedCurricula];
    }

    setSavedCurricula(updated);
    safeStorage.set('nature-compass-curricula', updated);
  };

  const handleDeleteCurriculum = (id: string) => {
    const updated = savedCurricula.filter(c => c.id !== id);
    setSavedCurricula(updated);
    safeStorage.set('nature-compass-curricula', updated);
  };

  const handleRenameCurriculum = (id: string, newName: string) => {
    const updated = savedCurricula.map(c =>
      c.id === id ? { ...c, name: newName } : c
    );
    setSavedCurricula(updated);
    safeStorage.set('nature-compass-curricula', updated);
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
      setError("Generation stopped by user.");
    }
  };

  // Handler: when user clicks "生成课件" on a curriculum lesson card
  const handleGenerateLessonKit = (lesson: CurriculumLesson, params: CurriculumParams, language: 'en' | 'zh') => {
    const mappedInput = mapLessonToInput(lesson, params);
    setInput(mappedInput);
    setLessonPlan(null);
    setCurrentPlanId(null);
    setCurrentKitLanguage(language);
    setView('lesson');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handler: open a batch-generated plan by its saved ID
  const handleOpenBatchPlan = (savedId: string) => {
    const found = savedPlansRef.current.find(p => p.id === savedId);
    if (found) {
      handleLoadPlan(found);
    }
  };

  // Handler: curriculum generated → show result page
  const handleCurriculumGenerated = (data: {
    curriculumEN: Curriculum | null;
    curriculumCN: Curriculum | null;
    params: CurriculumParams;
    activeLanguage: 'en' | 'zh';
  }) => {
    setCurriculumResult(data);
  };

  // Handler: back from result → show config
  const handleBackToConfig = () => {
    setCurriculumResult(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handler: new curriculum from result page → clear everything
  const handleNewCurriculum = () => {
    setCurriculumResult(null);
    safeStorage.remove('nature-compass-curriculum');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
        console.log('Generation aborted');
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

  return (
    <LanguageProvider>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 dark:text-slate-300 flex flex-col">
        <Header
          currentView={view}
          onNavigate={setView}
          onShowAuth={() => setShowAuthModal(true)}
        />

        {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}

        <PageLayout className="flex-1">
          <NatureHeroBanner />

          {/* Curriculum view — config or result */}
          <div style={{ display: view === 'curriculum' ? 'block' : 'none' }}>
            <BodyContainer>
              {curriculumResult ? (
                <CurriculumResultDisplay
                  curriculumEN={curriculumResult.curriculumEN}
                  curriculumCN={curriculumResult.curriculumCN}
                  activeLanguage={curriculumResult.activeLanguage}
                  setActiveLanguage={(lang) => setCurriculumResult(prev => prev ? { ...prev, activeLanguage: lang } : prev)}
                  savedParams={curriculumResult.params}
                  onBack={handleBackToConfig}
                  onNew={handleNewCurriculum}
                  onSave={handleSaveCurriculum}
                  onGenerateKit={handleGenerateLessonKit}
                  batchStatus={batchStatus}
                  batchLessonMap={batchLessonMap}
                  batchRunning={batchRunning}
                  batchProgress={batchProgress}
                  onBatchGenerate={handleBatchGenerate}
                  onCancelBatch={handleCancelBatch}
                  onOpenPlan={handleOpenBatchPlan}
                />
              ) : (
                <CurriculumPlanner
                  onCurriculumGenerated={handleCurriculumGenerated}
                  externalCurriculum={externalCurriculum}
                />
              )}
            </BodyContainer>
          </div>

          {/* Lesson Kit view — always mounted, hidden when not active */}
          <div style={{ display: view === 'lesson' ? 'block' : 'none' }}>
            <BodyContainer className="flex flex-col gap-8">
              {/* Input Form */}
              <div className="w-full max-w-3xl mx-auto">
                <InputSection
                  input={input}
                  setInput={setInput}
                  onSubmit={handleSubmit}
                  onStop={handleStop}
                  isLoading={isLoading}
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-center">
                  {error}
                </div>
              )}

              {/* Results Area */}
              <div id="results-section" className="w-full pb-20">
                {lessonPlan && (
                  <LessonPlanDisplay
                    plan={lessonPlan}
                    onSave={handleSavePlan}
                  />
                )}

                {isLoading && !lessonPlan && (
                  <div className="w-full relative mt-8">
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center -mt-20">
                      <div className="bg-white/90 backdrop-blur-sm p-8 rounded-2xl shadow-xl flex flex-col items-center border border-slate-100 animate-pulse-glow">
                        <Compass className="animate-spin text-emerald-500 mb-6" size={56} />
                        <h3 className="text-xl font-bold text-slate-800 mb-2">Generating Lesson Kit</h3>
                        <p className="text-emerald-600 font-medium h-6 transition-all duration-300">
                          {LOADING_STEPS[loadingStep]}
                        </p>
                        <div className="flex gap-1.5 mt-6">
                          {LOADING_STEPS.map((_, i) => (
                            <div
                              key={i}
                              className={`h-2 rounded-full transition-all duration-500 ${i === loadingStep ? 'w-6 bg-emerald-500' : 'w-2 bg-slate-200'}`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="hidden md:block w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-6 opacity-40 select-none pointer-events-none">
                      <div className="flex gap-2 border-b border-slate-100 pb-4 mb-6">
                        <div className="h-10 w-28 bg-slate-200 rounded-lg animate-pulse" />
                        <div className="h-10 w-24 bg-slate-100 rounded-lg animate-pulse" />
                        <div className="h-10 w-24 bg-slate-100 rounded-lg animate-pulse" />
                      </div>
                      <div className="h-8 w-1/3 bg-slate-200 rounded animate-pulse mb-8" />
                      <div className="space-y-6">
                        <div className="h-40 w-full bg-slate-100 rounded-xl animate-pulse" />
                        <div className="h-32 w-full bg-slate-100 rounded-xl animate-pulse" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </BodyContainer>
          </div>

          {/* Saved view — always mounted, hidden when not active */}
          <div style={{ display: view === 'saved' ? 'block' : 'none' }}>
            <BodyContainer>
              <SavedProjectsPage
                savedPlans={savedPlans}
                savedCurricula={savedCurricula}
                onLoad={handleLoadPlan}
                onDelete={handleDeletePlan}
                onRename={handleRenamePlan}
                onDeleteCurriculum={handleDeleteCurriculum}
                onRenameCurriculum={handleRenameCurriculum}
                onLoadCurriculum={(saved) => {
                  setExternalCurriculum({ curriculum: saved.curriculum, params: saved.params, language: saved.language });
                  setView('curriculum');
                }}
              />
            </BodyContainer>
          </div>
        </PageLayout>

        <footer className="bg-white dark:bg-slate-950/50 border-t border-slate-200 dark:border-white/5 py-8 text-center text-slate-400 text-sm">
          <p>&copy; {new Date().getFullYear()} Nature Compass. Powered by Google Gemini.</p>
        </footer>
      </div>
    </LanguageProvider>
  );
};