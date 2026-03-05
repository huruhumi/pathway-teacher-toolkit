import React from 'react';
import { useHashTab } from '@shared/hooks/useHashTab';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext';
import { AppHeader } from '@shared/components/AppHeader';
import { HeroBanner } from '@shared/components/HeroBanner';
import { PageLayout } from '@shared/components/PageLayout';
import { BodyContainer } from '@shared/components/BodyContainer';
import { HeaderToggles } from '@shared/components/HeaderToggles';
import AppFooter from '@shared/components/AppFooter';
import { ErrorBoundary } from '@shared/components/ErrorBoundary';
import ToastContainer from '@shared/components/ui/ToastContainer';
import {
    LayoutDashboard, Users, School, CalendarDays, GraduationCap,
} from 'lucide-react';

// Lazy-loaded pages
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
const StudentsPage = React.lazy(() => import('./pages/StudentsPage'));
const ClassesPage = React.lazy(() => import('./pages/ClassesPage'));
const CalendarPage = React.lazy(() => import('./pages/CalendarPage'));

type View = 'dashboard' | 'classes' | 'students' | 'calendar';

const AppContent: React.FC = () => {
    const { t, lang, setLang } = useLanguage();
    const [view, setView] = useHashTab<View>('dashboard', ['dashboard', 'classes', 'students', 'calendar']);

    const NAV_TABS = [
        { key: 'dashboard', label: t('nav.dashboard'), icon: <LayoutDashboard className="w-4 h-4" /> },
        { key: 'classes', label: t('nav.classes'), icon: <School className="w-4 h-4" /> },
        { key: 'students', label: t('nav.students'), icon: <Users className="w-4 h-4" /> },
        { key: 'calendar', label: t('nav.calendar'), icon: <CalendarDays className="w-4 h-4" /> },
    ];

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 dark:text-slate-300 flex flex-col">
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
                homeUrl={import.meta.env.DEV ? 'http://localhost:3000' : '/'}
            />

            <PageLayout className="flex-1">
                <HeroBanner
                    title={t('hero.title')}
                    description={t('hero.desc')}
                    gradient="from-amber-500 via-orange-500 to-red-500"
                    tags={[
                        { label: t('nav.classes') as string },
                        { label: t('nav.students') as string },
                        { label: t('nav.assignments') as string },
                        { label: t('nav.reading') as string },
                    ]}
                />
                <React.Suspense fallback={<div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" /></div>}>
                    <BodyContainer>
                        {view === 'dashboard' && <DashboardPage onNav={setView} />}
                        {view === 'classes' && <ClassesPage />}
                        {view === 'students' && <StudentsPage />}
                        {view === 'calendar' && <CalendarPage />}
                    </BodyContainer>
                </React.Suspense>
            </PageLayout>
            <AppFooter appName="Edu Hub" />
        </div>
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
