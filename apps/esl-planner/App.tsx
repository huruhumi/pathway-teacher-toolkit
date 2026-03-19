import React, { useEffect, Suspense } from 'react';
import { useHashTab } from '@shared/hooks/useHashTab';
import { CurriculumLesson, CurriculumParams, ESLCurriculum } from './types';
import { mapLessonToESLInput } from './utils/curriculumMapper';
import { Sparkles, Brain, BookOpen, History } from 'lucide-react';
import { AppFooter, AppHeader, AppLayout, BodyContainer, ErrorBoundary, HeaderToggles, HeroBanner, PageLayout, RouteGuard, ToastContainer } from '@pathway/ui';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext';

// Pages — lazy-loaded for code splitting
import { CurriculumPage } from './pages/CurriculumPage';
const CreatePage = React.lazy(() => import('./pages/CreatePage').then(m => ({ default: m.CreatePage })));
const RecordsPage = React.lazy(() => import('./pages/RecordsPage').then(m => ({ default: m.RecordsPage })));

// Stores & Hooks
import { useAppStore, useSessionStore } from './stores/appStore';
import { LessonHistoryProvider, useLessonHistory } from './hooks/useLessonHistory';
import { useThemeStore } from '@pathway/platform';

const AppContent: React.FC = () => {
    const { t, lang, setLang } = useLanguage();
    const isDarkMode = useThemeStore((state) => state.isDarkMode);
    const setDarkMode = useThemeStore((state) => state.setDarkMode);

    // Hash router
    const [viewMode, setViewMode] = useHashTab<'curriculum' | 'create' | 'history'>('curriculum', ['curriculum', 'create', 'history']);

    // Global stores
    const { clearSessionState, setState, activeLessonId: sessionLessonId } = useSessionStore();
    const { setActiveLessonId, setPrefilledValues } = useAppStore();

    // Initialize data from local storage to AppStore
    const { savedLessons, savedCurricula } = useLessonHistory();

    // Clear session on fresh landing
    useEffect(() => {
        if (!window.location.hash || window.location.hash === '#curriculum') {
            clearSessionState();
        }
    }, [clearSessionState]);

    // Restore lesson after page refresh: sessionStore persists activeLessonId
    // but strips generatedContent (too large). Re-hydrate from savedLessons.
    useEffect(() => {
        if (!sessionLessonId) return;
        const { state: currentState } = useSessionStore.getState();
        if (currentState.generatedContent) return; // already loaded
        const lesson = savedLessons.find(l => l.id === sessionLessonId);
        if (lesson?.content) {
            setActiveLessonId(sessionLessonId);
            setState(prev => ({ ...prev, generatedContent: lesson.content }));
            if (viewMode !== 'create') setViewMode('create');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionLessonId, savedLessons.length]);

    // Cross-page navigation handlers
    const handleGenerateLessonKit = (lesson: CurriculumLesson, params: CurriculumParams, curriculum?: ESLCurriculum, curriculumId?: string) => {
        // Use directly-passed curriculumId first, fallback to fuzzy match
        const resolvedCurriculumId = curriculumId
            || (curriculum ? savedCurricula.find(sc => sc.textbookTitle === curriculum.textbookTitle && sc.totalLessons === curriculum.totalLessons)?.id : undefined);
        const lessonIndex = curriculum ? curriculum.lessons.indexOf(lesson) : undefined;
        const mapped = mapLessonToESLInput(lesson, params, curriculum, '', resolvedCurriculumId, lessonIndex !== undefined && lessonIndex >= 0 ? lessonIndex : undefined);
        setPrefilledValues(mapped);
        setState(prev => ({ ...prev, generatedContent: null, error: null }));
        setActiveLessonId(null);
        setViewMode('create');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const NAV_TABS = [
        { key: 'curriculum', label: t('nav.curriculum'), icon: <BookOpen className="w-4 h-4" /> },
        { key: 'create', label: t('nav.planner'), icon: <Sparkles className="w-4 h-4" /> },
        { key: 'history', label: t('nav.records'), icon: <History className="w-4 h-4" /> },
    ];

    return (
        <RouteGuard>
            <AppLayout
                currentApp="esl-planner"
                userName="Teacher"
                onFinderItemClick={(recordId) => {
                    const lesson = savedLessons.find(l => l.id === recordId);
                    if (!lesson) return;
                    setActiveLessonId(lesson.id);
                    setState({ isLoading: false, generatedContent: lesson.content, error: null });
                    setViewMode('create');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
            >
                <div className="min-h-screen h-full w-full overflow-y-auto bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-300 font-sans flex flex-col">
                    <AppHeader
                        appName="ESL Smart Planner"
                        logoIcon={<Brain className="w-5 h-5" />}
                        brand={{
                            logoBg: 'bg-gradient-to-br from-violet-600 to-purple-600',
                            logoText: 'text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-purple-600',
                            activeBg: 'bg-violet-100',
                            activeText: 'text-violet-700',
                            badgeBg: 'bg-violet-200',
                            badgeText: 'text-violet-700',
                        }}
                        tabs={NAV_TABS}
                        activeTab={viewMode}
                        onTabChange={(key) => setViewMode(key as typeof viewMode)}
                        onLogoClick={() => { setViewMode('curriculum'); clearSessionState(); setActiveLessonId(null); setPrefilledValues(null); }}
                        rightContent={<HeaderToggles lang={lang} onLangChange={setLang} isDark={isDarkMode} onDarkChange={setDarkMode} />}
                        signInLabel={lang === 'zh' ? '登录' : 'Sign In'}
                    />

                    <PageLayout>
                        <HeroBanner
                            title={lang === 'zh' ? 'AI 智能备课引擎' : 'Transform Teaching Materials in Seconds'}
                            description={lang === 'zh'
                                ? '上传教材 PDF、图片或粘贴文本，AI 自动生成结构化教案、互动课件和课堂游戏，适配任意 CEFR 等级。'
                                : 'Upload textbook pages, images, or paste text to generate comprehensive lesson plans, slides, and interactive games tailored to any CEFR level.'}
                            gradient="from-violet-600 via-purple-600 to-fuchsia-600"
                            tags={[
                                { label: lang === 'zh' ? '结构化教案' : 'Structured Plans' },
                                { label: lang === 'zh' ? '互动游戏' : 'Interactive Games' },
                                { label: lang === 'zh' ? '自然拼读' : 'Phonics Materials' },
                            ]}
                        />
                        <BodyContainer>
                            <Suspense fallback={<div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" /></div>}>
                                <div style={{ display: viewMode === 'curriculum' ? 'block' : 'none' }}>
                                    <CurriculumPage
                                        onGenerateKit={handleGenerateLessonKit}
                                        onGoToCreate={() => setViewMode('create')}
                                    />
                                </div>

                                <div style={{ display: viewMode === 'create' ? 'block' : 'none' }}>
                                    <CreatePage />
                                </div>

                                <div style={{ display: viewMode === 'history' ? 'block' : 'none' }}>
                                    <RecordsPage
                                        onGoToCurriculum={() => setViewMode('curriculum')}
                                        onGoToCreate={() => setViewMode('create')}
                                    />
                                </div>
                            </Suspense>
                        </BodyContainer>
                    </PageLayout>

                    <AppFooter appName="ESL Smart Planner" />
                </div>
            </AppLayout>
        </RouteGuard>
    );
};

const App: React.FC = () => (
    <LanguageProvider>
        <LessonHistoryProvider>
            <ErrorBoundary>
                <AppContent />
            </ErrorBoundary>
        </LessonHistoryProvider>
        <ToastContainer />
    </LanguageProvider>
);

export default App;
