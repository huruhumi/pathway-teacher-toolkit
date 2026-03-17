import React, { useState, useEffect, Suspense, useRef } from 'react';
import { useHashTab } from '@shared/hooks/useHashTab';
import { Header } from './components/Header';
const CurriculumPage = React.lazy(() => import('./pages/CurriculumPage').then(m => ({ default: m.CurriculumPage })));
const LessonKitPage = React.lazy(() => import('./pages/LessonKitPage').then(m => ({ default: m.LessonKitPage })));
const RecordsPage = React.lazy(() => import('./pages/RecordsPage').then(m => ({ default: m.RecordsPage })));
import { LessonPlanResponse, SavedLessonPlan, SavedCurriculum, Curriculum, CurriculumLesson, CurriculumParams } from './types';
import { useAuthStore } from '@pathway/platform';
import { mapLessonToInput } from './utils/curriculumMapper';
import { migrateSavedPlan, migrateSavedCurriculum } from './utils/schemaMigration';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext';
import { imageStore } from '@shared/imageStore';
import { AppFooter, AppLayout, BodyContainer, ErrorBoundary, HeroBanner, PageLayout, RouteGuard, ToastContainer } from '@pathway/ui';
import { useAppStore, useSessionStore } from './stores/appStore';
import { useProjectCRUD } from '@shared/hooks/useProjectCRUD';
import { useToast } from '@shared/stores/useToast';
import { assessNatureCurriculumQuality, assessNatureLessonPlanQuality } from '@shared/config/recordQuality';
import { upsertRecordIndexEntry } from '@shared/services/cloudSync';

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
  const { user } = useAuthStore();
  const { clearSessionState, setLessonPlan, setExternalCurriculum, curriculumResult } = useSessionStore();
  const {
    currentPlanId, setCurrentPlanId, currentKitLanguage, setCurrentKitLanguage,
    setInput, input
  } = useAppStore();
  const ragFactSheets = useSessionStore((s) => s.ragFactSheets);
  const indexSyncSignatureRef = useRef('');

  const { items: savedPlans, setItems: setSavedPlans, saveItem: savePlanDb, deleteItem: deletePlanDb, renameItem: renamePlanDb } = useProjectCRUD<SavedLessonPlan>('nature-compass-plans', 50, {
    cloudTable: 'lesson_plans',
    mapToCloud: (p: SavedLessonPlan) => ({
      id: p.id,
      name: p.name,
      description: p.description || '',
      content_data: {
        plan: p.plan,
        coverImage: p.coverImage || null,
        mode: p.mode || 'school',
        language: p.language || 'en',
      },
    }),
    mapFromCloud: (row: any) => ({
      id: row.id,
      name: row.name,
      timestamp: new Date(row.updated_at || row.created_at).getTime(),
      description: row.description || '',
      plan: row.content_data?.plan || row.content_data || row.plan_data,
      coverImage: row.content_data?.coverImage || row.cover_image || undefined,
      mode: row.content_data?.mode || row.mode || 'school',
      language: row.content_data?.language || row.language || 'en',
    } as SavedLessonPlan),
    buildIndexEntry: (record: SavedLessonPlan) => {
      const quality = assessNatureLessonPlanQuality(record.plan as any);
      return {
        appId: 'nature-compass',
        recordType: 'lesson_plan',
        title: record.name || 'Untitled Plan',
        searchableText: [
          record.name,
          record.description,
          record.plan?.basicInfo?.theme,
          record.plan?.basicInfo?.activityType,
          record.plan?.basicInfo?.targetAudience,
        ].filter(Boolean).join(' '),
        textbookLevelKey: null,
        cefr: null,
        curriculumId: null,
        unitNumber: null,
        tags: ['nature', record.mode || 'school'],
        qualityStatus: quality.status,
      };
    },
    migrate: migrateSavedPlan,
  });
  const { items: savedCurricula, saveItem: saveCurriculumDb, deleteItem: deleteCurriculumDb, renameItem: renameCurriculumDb } = useProjectCRUD<SavedCurriculum>('nature-compass-curricula', 50, {
    cloudTable: 'curricula',
    mapToCloud: (c: SavedCurriculum) => ({
      id: c.id,
      name: c.name,
      description: c.description || '',
      content_data: {
        curriculum: c.curriculum,
        params: c.params,
        language: c.language,
      },
    }),
    mapFromCloud: (row: any) => ({
      id: row.id,
      name: row.name,
      timestamp: new Date(row.updated_at || row.created_at).getTime(),
      curriculum: row.content_data?.curriculum || row.content_data || row.curriculum_data,
      params: row.content_data?.params || row.params_data,
      language: row.content_data?.language || row.language || 'en',
      description: row.description || '',
    } as SavedCurriculum),
    buildIndexEntry: (record: SavedCurriculum) => {
      const quality = assessNatureCurriculumQuality(record.curriculum as any, record.params as any);
      return {
        appId: 'nature-compass',
        recordType: 'curriculum',
        title: record.name || 'Untitled Curriculum',
        searchableText: [
          record.name,
          record.description,
          record.curriculum?.theme,
          record.curriculum?.overview,
        ].filter(Boolean).join(' '),
        textbookLevelKey: null,
        cefr: record.params?.englishLevel || null,
        curriculumId: record.id,
        unitNumber: null,
        tags: ['nature', record.language],
        qualityStatus: quality.status,
      };
    },
    migrate: migrateSavedCurriculum,
  });

  // Clear session on fresh landing
  useEffect(() => {
    if (!window.location.hash || window.location.hash === '#curriculum') {
      clearSessionState();
      setCurrentPlanId(null);
    }
  }, []);

  // Load cover images from IndexedDB
  useEffect(() => {
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

  // Best-effort index backfill for existing records so quality filters work without manual re-save.
  useEffect(() => {
    if (!user) return;

    const signature = [
      ...savedPlans.map((item) => `${item.id}:${item.timestamp}`),
      ...savedCurricula.map((item) => `${item.id}:${item.timestamp}`),
    ].join('|');
    if (signature === indexSyncSignatureRef.current) return;
    indexSyncSignatureRef.current = signature;

    let cancelled = false;
    (async () => {
      const now = new Date().toISOString();
      const planEntries = savedPlans.map((record) => {
        const quality = assessNatureLessonPlanQuality(record.plan as any);
        return {
          recordId: record.id,
          appId: 'nature-compass',
          recordType: 'lesson_plan',
          ownerId: user.id,
          title: record.name || 'Untitled Plan',
          searchableText: [
            record.name,
            record.description,
            record.plan?.basicInfo?.theme,
            record.plan?.basicInfo?.activityType,
            record.plan?.basicInfo?.targetAudience,
          ].filter(Boolean).join(' '),
          textbookLevelKey: null,
          cefr: null,
          curriculumId: null,
          unitNumber: null,
          tags: ['nature', record.mode || 'school'],
          qualityStatus: quality.status,
          updatedAt: now,
        };
      });
      const curriculumEntries = savedCurricula.map((record) => {
        const quality = assessNatureCurriculumQuality(record.curriculum as any, record.params as any);
        return {
          recordId: record.id,
          appId: 'nature-compass',
          recordType: 'curriculum',
          ownerId: user.id,
          title: record.name || 'Untitled Curriculum',
          searchableText: [
            record.name,
            record.description,
            record.curriculum?.theme,
            record.curriculum?.overview,
          ].filter(Boolean).join(' '),
          textbookLevelKey: null,
          cefr: record.params?.englishLevel || null,
          curriculumId: record.id,
          unitNumber: null,
          tags: ['nature', record.language],
          qualityStatus: quality.status,
          updatedAt: now,
        };
      });

      const entries = [...planEntries, ...curriculumEntries];
      for (const entry of entries) {
        if (cancelled) return;
        await upsertRecordIndexEntry(entry);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, savedPlans, savedCurricula]);

  // Cloud sync is now handled automatically by useProjectCRUD's cloudTable option.

  // =========== CRUD Handlers ===========

  const handleSavePlan = async (planToSave: LessonPlanResponse, coverImage?: string | null) => {
    // Find existing plan by current ID or by matching title (overwrite same-title plans)
    const existingById = currentPlanId ? savedPlans.find(p => p.id === currentPlanId) : null;
    const existingByTitle = !existingById
      ? savedPlans.find(p => p.plan.missionBriefing?.title === planToSave.missionBriefing?.title && p.plan.missionBriefing?.title)
      : null;
    const existing = existingById || existingByTitle;
    const planId = existing?.id || crypto.randomUUID();

    let coverRef: string | undefined;
    if (coverImage) {
      const imgKey = `nc-${planId}-cover`;
      await imageStore.save(imgKey, coverImage);
      coverRef = imgKey;
    }


    const newSavedPlan: SavedLessonPlan = {
      id: planId, timestamp: Date.now(),
      name: existing?.name || planToSave.basicInfo?.theme || planToSave.missionBriefing.title || `Untitled Plan ${new Date().toLocaleDateString()}`,
      description: existing?.description || generateNCKitDescription(planToSave),
      plan: planToSave, language: currentKitLanguage,
      mode: input.mode,
      ...((coverRef || existing?.coverImage) ? { coverImage: coverRef || existing?.coverImage } : {}),
    };

    const saveResult = await savePlanDb(newSavedPlan);
    if (!saveResult.ok) {
      useToast.getState().error('Plan save failed. Local draft is kept and can be retried.');
      return saveResult;
    }
    setCurrentPlanId(planId);

    // Provide instant UI update for base64 image ref before reload
    if (coverImage) {
      setSavedPlans((prev) => prev.map(p => p.id === planId ? { ...p, coverImage } : p));
    }

    // Cloud sync is automatic via useProjectCRUD
    return saveResult;
  };

  const handleLoadPlan = (saved: SavedLessonPlan) => {
    setLessonPlan(saved.plan);
    setCurrentPlanId(saved.id);
    setView('lesson');
    setTimeout(() => {
      document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleDeletePlan = async (id: string) => {
    await deletePlanDb(id);
    await imageStore.removeByPrefix(`nc-${id}-`);
    if (currentPlanId === id) setCurrentPlanId(null);
  };

  const handleRenamePlan = async (id: string, newName: string) => {
    await renamePlanDb(id, newName);
  };

  const handleSaveCurriculum = async (curriculum: Curriculum, params: CurriculumParams, language: 'en' | 'zh') => {
    const name = `${language === 'zh' ? '[中文] ' : ''}${curriculum.theme || `Curriculum ${new Date().toLocaleDateString()}`}`;
    const existing = savedCurricula.find(c => c.curriculum.theme === curriculum.theme && c.language === language);
    const id = existing ? existing.id : crypto.randomUUID();

    const savedCurriculum: SavedCurriculum = {
      id, timestamp: Date.now(), name, description: existing?.description || curriculum.overview, curriculum, params, language
    };
    const saveResult = await saveCurriculumDb(savedCurriculum);
    if (!saveResult.ok) {
      useToast.getState().error('Curriculum save failed. Local draft is kept and can be retried.');
    }
    return saveResult;
  };

  const handleDeleteCurriculum = async (id: string) => {
    await deleteCurriculumDb(id);
  };

  const handleRenameCurriculum = async (id: string, newName: string) => {
    await renameCurriculumDb(id, newName);
  };

  const handleGenerateLessonKit = (lesson: CurriculumLesson, params: CurriculumParams, language: 'en' | 'zh') => {
    const mappedInput = mapLessonToInput(lesson, params);

    // Attach RAG fact sheet if available from curriculum generation
    if (ragFactSheets && curriculumResult) {
      const curriculum = language === 'zh' ? curriculumResult.curriculumCN : curriculumResult.curriculumEN;
      const lessonIndex = curriculum?.lessons.findIndex(l => l.title === lesson.title) ?? -1;
      if (lessonIndex >= 0) {
        const fs = ragFactSheets.find(f => f.lessonIndex === lessonIndex);
        if (fs) {
          mappedInput.factSheet = fs.content;
          mappedInput.factSheetQuality = fs.quality as 'good' | 'low' | 'insufficient';
        }
      }
    }

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
        <RouteGuard>
          <AppLayout currentApp="nature-compass" userName="Teacher">
            <div className="min-h-screen h-full w-full overflow-y-auto bg-slate-50 dark:bg-slate-950 dark:text-slate-300 flex flex-col">
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
                          // Find the paired language version (same theme & params but different language)
                          const otherLang = saved.language === 'en' ? 'zh' : 'en';
                          const paired = savedCurricula.find(c =>
                            c.id !== saved.id &&
                            c.language === otherLang &&
                            c.curriculum.theme === saved.curriculum.theme &&
                            c.params.city === saved.params.city &&
                            c.params.ageGroup === saved.params.ageGroup
                          );
                          setExternalCurriculum({
                            curriculum: saved.curriculum,
                            params: saved.params,
                            language: saved.language,
                            pairedCurriculum: paired?.curriculum,
                          });
                          setView('curriculum');
                        }}
                      />
                    </BodyContainer>
                  </div>
                </Suspense>
              </PageLayout>

              <AppFooter appName="Nature Compass" />
            </div>
          </AppLayout>
        </RouteGuard>
      </ErrorBoundary>
      <ToastContainer />
    </LanguageProvider>
  );
};
