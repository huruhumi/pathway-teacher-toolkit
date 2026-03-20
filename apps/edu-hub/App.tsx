import React from 'react';
import { useHashTab } from '@shared/hooks/useHashTab';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext';
import { AppFooter, AppHeader, AppLayout, BodyContainer, ErrorBoundary, HeaderToggles, HeroBanner, PageLayout, RouteGuard, ToastContainer } from '@pathway/ui';
import {
    LayoutDashboard, School, CalendarDays, GraduationCap,
    ClipboardList, Library, BookOpen,
} from 'lucide-react';

// Lazy-loaded pages
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
const ClassesPage = React.lazy(() => import('./pages/ClassesPage'));
const CalendarPage = React.lazy(() => import('./pages/CalendarPage'));
const AssignmentsPage = React.lazy(() => import('./pages/AssignmentsPage'));
const BooksPage = React.lazy(() => import('./pages/BooksPage'));
const ReadingLogsPage = React.lazy(() => import('./pages/ReadingLogsPage'));
const ParentFormPage = React.lazy(() => import('./pages/ParentFormPage'));

type View = 'dashboard' | 'classes' | 'calendar' | 'assignments' | 'books' | 'reading';

// Check if this is a parent form request
const isParentForm = () => {
    const hash = window.location.hash;
    return hash.startsWith('#parent-form') || new URLSearchParams(window.location.search).has('code');
};

const AppContent: React.FC = () => {
    const { t, lang, setLang } = useLanguage();
    const [view, setView] = useHashTab<View>('dashboard', ['dashboard', 'classes', 'calendar', 'assignments', 'books', 'reading']);

    // If parent form route, render standalone
    if (isParentForm()) {
        return (
            <React.Suspense fallback={<div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" /></div>}>
                <ParentFormPage />
            </React.Suspense>
        );
    }

    const NAV_TABS = [
        { key: 'dashboard', label: t('nav.dashboard'), icon: <LayoutDashboard className="w-4 h-4" /> },
        { key: 'classes', label: t('nav.classes'), icon: <School className="w-4 h-4" /> },
        { key: 'assignments', label: t('nav.assignments'), icon: <ClipboardList className="w-4 h-4" /> },
        { key: 'books', label: t('nav.books'), icon: <Library className="w-4 h-4" /> },
        { key: 'reading', label: t('nav.reading') || (lang === 'zh' ? '阅读日志' : 'Reading'), icon: <BookOpen className="w-4 h-4" /> },
        { key: 'calendar', label: t('nav.calendar'), icon: <CalendarDays className="w-4 h-4" /> },
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
                            { label: t('nav.classes') as string },
                            { label: t('nav.assignments') as string },
                            { label: t('nav.reading') as string },
                        ]}
                    />
                    <React.Suspense fallback={<div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" /></div>}>
                        <BodyContainer>
                            {view === 'dashboard' && <DashboardPage onNav={setView} />}
                            {view === 'classes' && <RouteGuard><ClassesPage /></RouteGuard>}
                            {view === 'assignments' && <RouteGuard><AssignmentsPage /></RouteGuard>}
                            {view === 'books' && <RouteGuard><BooksPage /></RouteGuard>}
                            {view === 'reading' && <RouteGuard><ReadingLogsPage /></RouteGuard>}
                            {view === 'calendar' && <RouteGuard><CalendarPage /></RouteGuard>}
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
