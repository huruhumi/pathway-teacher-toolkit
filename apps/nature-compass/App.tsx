import React, { useState, useEffect, Suspense } from 'react';
import { useHashTab } from '@shared/hooks/useHashTab';
import { Header } from './components/Header';
const CurriculumPage = React.lazy(() => import('./pages/CurriculumPage').then(m => ({ default: m.CurriculumPage })));
const LessonKitPage = React.lazy(() => import('./pages/LessonKitPage').then(m => ({ default: m.LessonKitPage })));
const RecordsPage = React.lazy(() => import('./pages/RecordsPage').then(m => ({ default: m.RecordsPage })));
import { LessonPlanResponse, SavedLessonPlan, SavedCurriculum, Curriculum, CurriculumLesson, CurriculumParams } from './types';
import { useAuthStore } from '@shared/stores/useAuthStore';
import { mapLessonToInput } from './utils/curriculumMapper';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext';
import { imageStore } from '@shared/imageStore';
import { HeroBanner } from '@shared/components/HeroBanner';
import { PageLayout } from '@shared/components/PageLayout';
import { BodyContainer } from '@shared/components/BodyContainer';
import AppFooter from '@shared/components/AppFooter';
import { useAppStore, useSessionStore } from './stores/appStore';
import { useProjectCRUD } from '@shared/hooks/useProjectCRUD';
import { ErrorBoundary } from '@shared/components/ErrorBoundary';
import ToastContainer from '@shared/components/ui/ToastContainer';

/** Generate a short description for a saved NC lesson kit */
function generateNCKitDescription(plan: LessonPlanResponse): string {
  const parts: string[] = [];
  const bi = plan.basicInfo;
  if (bi?.activityType) parts.push(`This ${bi.activityType} lesson`);
  else parts.push('This lesson');
  if (bi?.theme) parts.push(`explores "${bi.theme}"`);
  if (bi?.targetAudience) parts.push(`for ${bi.targetAudience}`);
  const counts: string[] = [];
  if (plan.roadmap?.length) counts.push(`${plan.roadmap.length} activities`);
  if (plan.vocabulary?.keywords?.length) counts.push(`${plan.vocabulary.keywords.length} vocabulary items`);
  if (plan.visualReferences?.length) counts.push(`${plan.visualReferences.length} visual references`);
  if (counts.length) parts.push(`with ${counts.join(', ')}`);
  return parts.join(' ') + '.';
}

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
  // Navigation
  const [view, setView] = useHashTab<'curriculum' | 'lesson' | 'saved'>('curriculum', ['curriculum', 'lesson', 'saved']);

  // Global Stores
  const { user, initialize: initAuth } = useAuthStore();
  const { clearSessionState, setLessonPlan, setExternalCurriculum } = useSessionStore();
  const {
    currentPlanId, setCurrentPlanId, currentKitLanguage, setCurrentKitLanguage,
    setInput
  } = useAppStore();

  const { items: savedPlans, setItems: setSavedPlans, saveItem: savePlanDb, deleteItem: deletePlanDb, renameItem: renamePlanDb } = useProjectCRUD<SavedLessonPlan>('nature-compass-plans', 50, {
    cloudTable: 'lesson_plans',
    mapToCloud: (p: SavedLessonPlan) => ({ id: p.id, name: p.name, plan_data: p.plan, cover_image: p.coverImage || null }),
    mapFromCloud: (row: any) => ({ id: row.id, name: row.name, timestamp: new Date(row.updated_at || row.created_at).getTime(), plan: row.plan_data, coverImage: row.cover_image || undefined } as SavedLessonPlan),
  });
  const { items: savedCurricula, saveItem: saveCurriculumDb, deleteItem: deleteCurriculumDb, renameItem: renameCurriculumDb } = useProjectCRUD<SavedCurriculum>('nature-compass-curricula', 50, {
    cloudTable: 'curricula',
    mapToCloud: (c: SavedCurriculum) => ({ id: c.id, name: c.name, curriculum_data: c.curriculum, params_data: c.params, language: c.language }),
    mapFromCloud: (row: any) => ({ id: row.id, name: row.name, timestamp: new Date(row.updated_at || row.created_at).getTime(), curriculum: row.curriculum_data, params: row.params_data, language: row.language, description: row.description || '' } as SavedCurriculum),
  });

  // Clear session on fresh landing
  useEffect(() => {
    if (!window.location.hash || window.location.hash === '#curriculum') {
      clearSessionState();
      setCurrentPlanId(null);
    }
  }, []);

  // Load from LocalStorage + init auth
  useEffect(() => {
    initAuth();
    savedPlans.forEach(p => {
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
  }, []);

  // Cloud sync is now handled automatically by useProjectCRUD's cloudTable option.

  // =========== CRUD Handlers ===========

  const handleSavePlan = async (planToSave: LessonPlanResponse, coverImage?: string | null) => {
    const planId = currentPlanId || crypto.randomUUID();
    let coverRef: string | undefined;
    if (coverImage) {
      const imgKey = `nc-${planId}-cover`;
      await imageStore.save(imgKey, coverImage);
      coverRef = imgKey;
    }

    const existing = savedPlans.find(p => p.id === planId);

    const newSavedPlan: SavedLessonPlan = {
      id: planId, timestamp: Date.now(),
      name: existing?.name || planToSave.missionBriefing.title || `Untitled Plan ${new Date().toLocaleDateString()}`,
      description: existing?.description || generateNCKitDescription(planToSave),
      plan: planToSave, language: currentKitLanguage,
      ...((coverRef || existing?.coverImage) ? { coverImage: coverRef || existing?.coverImage } : {}),
    };

    savePlanDb(newSavedPlan);
    setCurrentPlanId(planId);

    // Provide instant UI update for base64 image ref before reload
    if (coverImage) {
      setSavedPlans((prev) => prev.map(p => p.id === planId ? { ...p, coverImage } : p));
    }

    // Cloud sync is automatic via useProjectCRUD
  };

  const handleLoadPlan = (saved: SavedLessonPlan) => {
    setLessonPlan(saved.plan);
    setCurrentPlanId(saved.id);
    setView('lesson');
    setTimeout(() => {
      document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleDeletePlan = (id: string) => {
    deletePlanDb(id);
    imageStore.removeByPrefix(`nc-${id}-`);
    if (currentPlanId === id) setCurrentPlanId(null);
  };

  const handleRenamePlan = (id: string, newName: string) => {
    renamePlanDb(id, newName);
  };

  const handleSaveCurriculum = (curriculum: Curriculum, params: CurriculumParams, language: 'en' | 'zh') => {
    const name = `${language === 'zh' ? '[中文] ' : ''}${curriculum.theme || `Curriculum ${new Date().toLocaleDateString()}`}`;
    const existing = savedCurricula.find(c => c.curriculum.theme === curriculum.theme && c.language === language);
    const id = existing ? existing.id : crypto.randomUUID();

    const savedCurriculum: SavedCurriculum = {
      id, timestamp: Date.now(), name, description: existing?.description || curriculum.overview, curriculum, params, language
    };
    saveCurriculumDb(savedCurriculum);
  };

  const handleDeleteCurriculum = (id: string) => {
    deleteCurriculumDb(id);
  };

  const handleRenameCurriculum = (id: string, newName: string) => {
    renameCurriculumDb(id, newName);
  };

  const handleGenerateLessonKit = (lesson: CurriculumLesson, params: CurriculumParams, language: 'en' | 'zh') => {
    const mappedInput = mapLessonToInput(lesson, params);
    setInput(mappedInput);
    setLessonPlan(null);
    setCurrentPlanId(null);
    setCurrentKitLanguage(language);
    setView('lesson');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <LanguageProvider>
      <ErrorBoundary>
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 dark:text-slate-300 flex flex-col">
          <Header
            currentView={view}
            onNavigate={(v) => {
              setView(v);
              if (v === 'curriculum') {
                clearSessionState();
                setCurrentPlanId(null);
              }
            }}
            onLogoClick={() => {
              setView('curriculum');
              clearSessionState();
              setCurrentPlanId(null);
            }}
          />

          <PageLayout className="flex-1">
            <NatureHeroBanner />
            <Suspense fallback={<div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" /></div>}>

              <div style={{ display: view === 'curriculum' ? 'block' : 'none' }}>
                <BodyContainer>
                  <CurriculumPage
                    onSaveCurriculum={handleSaveCurriculum}
                    onGenerateLessonKit={handleGenerateLessonKit}
                    onNavigate={setView}
                    savedPlans={savedPlans}
                    savePlanDb={savePlanDb}
                  />
                </BodyContainer>
              </div>

              <div style={{ display: view === 'lesson' ? 'block' : 'none' }}>
                <BodyContainer className="flex flex-col gap-8">
                  <LessonKitPage
                    onSavePlan={handleSavePlan}
                  />
                </BodyContainer>
              </div>

              <div style={{ display: view === 'saved' ? 'block' : 'none' }}>
                <BodyContainer>
                  <RecordsPage
                    savedPlans={savedPlans}
                    savedCurricula={savedCurricula}
                    onLoadPlan={handleLoadPlan}
                    onDeletePlan={handleDeletePlan}
                    onRenamePlan={handleRenamePlan}
                    onDeleteCurriculum={handleDeleteCurriculum}
                    onRenameCurriculum={handleRenameCurriculum}
                    onLoadCurriculum={(saved) => {
                      setExternalCurriculum({ curriculum: saved.curriculum, params: saved.params, language: saved.language });
                      setView('curriculum');
                    }}
                  />
                </BodyContainer>
              </div>
            </Suspense>
          </PageLayout>

          <AppFooter appName="Nature Compass" />
        </div>
      </ErrorBoundary>
      <ToastContainer />
    </LanguageProvider>
  );
};