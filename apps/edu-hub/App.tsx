import React, { useMemo } from 'react';
import { useHashTab } from '@shared/hooks/useHashTab';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext';
import { AppFooter, AppHeader, AppLayout, BodyContainer, ErrorBoundary, HeaderToggles, HeroBanner, PageLayout, RouteGuard, ToastContainer } from '@pathway/ui';
import {
    LayoutDashboard, GraduationCap, Library, Gift,
} from 'lucide-react';

// Lazy-loaded pages
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
const TeachingPage = React.lazy(() => import('./pages/TeachingPage'));
const LibraryPage = React.lazy(() => import('./pages/LibraryPage'));
const RewardsManagementPage = React.lazy(() => import('./pages/RewardsManagementPage'));
const ParentFormPage = React.lazy(() => import('./pages/ParentFormPage'));

type View = 'dashboard' | 'teaching' | 'library' | 'rewards';


const AppContent: React.FC = () => {
    const { t, lang, setLang } = useLanguage();
    const [view, setView] = useHashTab<View>('dashboard', ['dashboard', 'teaching', 'library', 'rewards']);

    // Computed once on mount — parent form routes bypass the full app shell
    const isParentForm = useMemo(() =>
        window.location.hash.startsWith('#parent-form') ||
        new URLSearchParams(window.location.search).has('invite_code')
        , []);

    // If parent form route, render standalone
    if (isParentForm) {
        return (
            <React.Suspense fallback={<div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" /></div>}>
                <ParentFormPage />
            </React.Suspense>
        );
    }

    const NAV_TABS = [
        { key: 'dashboard', label: t('nav.dashboard'), icon: <LayoutDashboard className="w-4 h-4" /> },
        { key: 'teaching', label: lang === 'zh' ? '教学' : 'Teaching', icon: <GraduationCap className="w-4 h-4" /> },
        { key: 'library', label: lang === 'zh' ? '图书馆' : 'Library', icon: <Library className="w-4 h-4" /> },
        { key: 'rewards', label: lang === 'zh' ? '积分' : 'Rewards', icon: <Gift className="w-4 h-4" /> },
    ];

    return (
        <AppLayout currentApp="edu-hub" userName="Admin">
            <div className="min-h-screen h-full bg-slate-50 dark:bg-slate-950 dark:text-slate-300 flex flex-col w-full overflow-y-auto">
                <AppHeader
                    appName="Edu Hub"
                    subtitle={lang === 'zh' ? '教育管理' : 'Education Management'}
                    logoIcon={<GraduationCap className="w-5 h-5" />}
                    brand={{
                        logoBg: 'bg-gradient-to-br from-amber-500 to-orange-600',
                        logoText: 'text-transparent bg-clip-text bg-gradient-to-r from-amber-600 to-orange-600',
                        activeBg: 'bg-amber-100',
                        activeText: 'text-amber-700',
                        badgeBg: 'bg-amber-200',
                        badgeText: 'text-amber-700',
                    }}
                    tabs={NAV_TABS}
                    activeTab={view}
                    onTabChange={(key) => setView(key as View)}
                    onLogoClick={() => setView('dashboard')}
                    rightContent={<HeaderToggles lang={lang} onLangChange={setLang} />}
                    signInLabel={lang === 'zh' ? '登录' : 'Sign In'}
                />

                <PageLayout className="flex-1">
                    <HeroBanner
                        title={t('hero.title')}
                        description={t('hero.desc')}
                        gradient="from-amber-500 via-orange-500 to-red-500"
                        tags={[
                            { label: lang === 'zh' ? '班级' : 'Classes' },
                            { label: lang === 'zh' ? '作业' : 'Assignments' },
                            { label: lang === 'zh' ? '阅读' : 'Reading' },
                        ]}
                    />
                    <React.Suspense fallback={<div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" /></div>}>
                        <BodyContainer>
                            {view === 'dashboard' && <DashboardPage onNav={setView} />}
                            {view === 'teaching' && <RouteGuard><TeachingPage /></RouteGuard>}
                            {view === 'library' && <RouteGuard><LibraryPage /></RouteGuard>}
                            {view === 'rewards' && <RouteGuard><RewardsManagementPage /></RouteGuard>}
                        </BodyContainer>
                    </React.Suspense>
                </PageLayout>
                <AppFooter appName="Edu Hub" />
            </div>
        </AppLayout>
    );
};

export const App: React.FC = () => (
    <LanguageProvider>
        <ErrorBoundary>
            <AppContent />
        </ErrorBoundary>
        <ToastContainer />
    </LanguageProvider>
);
