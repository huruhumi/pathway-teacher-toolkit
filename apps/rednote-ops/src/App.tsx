import React, { useState, useEffect, Suspense } from 'react';
import { useHashTab } from '@shared/hooks/useHashTab';
import { useThemeStore } from '@pathway/platform';
import { motion } from 'motion/react';

import { Settings, Calendar as CalendarIcon, PenTool, LayoutDashboard, CalendarDays, Moon, Sun, Library } from 'lucide-react';
import Dashboard from './components/Dashboard';
const Planner = React.lazy(() => import('./components/Planner'));
const ContentGenerator = React.lazy(() => import('./components/ContentGenerator'));
const BrandSettings = React.lazy(() => import('./components/BrandSettings'));
const Calendar = React.lazy(() => import('./components/Calendar'));
import { INITIAL_BRAND_DATA } from './data/brandData';
import { SavedNote } from './types';
import { safeStorage } from '@shared/safeStorage';
import localforage from 'localforage';
import { AppFooter, AppHeader, AppLayout, BodyContainer, ErrorBoundary, HeaderToggles, HeroBanner, PageLayout, RouteGuard, ToastContainer } from '@pathway/ui';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext';



function AppContent() {
  const { t, lang, setLang } = useLanguage();
  const [activeTab, setActiveTab] = useHashTab<'dashboard' | 'planner' | 'generator' | 'settings' | 'calendar'>('dashboard', ['dashboard', 'planner', 'generator', 'settings', 'calendar']);

  const isDarkMode = useThemeStore((state) => state.isDarkMode);
  const setDarkMode = useThemeStore((state) => state.setDarkMode);

  // Persistent States
  const [brandData, setBrandData] = useState(() => safeStorage.get('pathway_brandData', INITIAL_BRAND_DATA));
  const [savedPlans, setSavedPlans] = useState<any[]>([]);
  const [savedNotes, setSavedNotes] = useState<SavedNote[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Initialize from LocalForage
  useEffect(() => {
    const loadData = async () => {
      try {
        const plans = await localforage.getItem<any[]>('pathway_savedPlans');
        if (plans) setSavedPlans(plans);
        const notes = await localforage.getItem<SavedNote[]>('pathway_savedNotes');
        if (notes) setSavedNotes(notes);
      } catch (e: unknown) {
        console.error("Failed to load data from storage", e);
      } finally {
        setIsLoaded(true);
      }
    };
    loadData();
  }, []);

  // Ephemeral States
  const [currentPlan, setCurrentPlan] = useState<any[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [editingSavedNote, setEditingSavedNote] = useState<SavedNote | undefined>(undefined);

  // Sync with LocalStorage/IndexedDB (debounced)
  useEffect(() => { safeStorage.set('pathway_brandData', brandData); }, [brandData]);
  useEffect(() => { if (isLoaded) localforage.setItem('pathway_savedPlans', savedPlans); }, [savedPlans, isLoaded]);
  useEffect(() => { if (isLoaded) localforage.setItem('pathway_savedNotes', savedNotes); }, [savedNotes, isLoaded]);

  const handleSaveNote = (note: SavedNote) => {
    setSavedNotes(prev => {
      const exists = prev.some(n => n.id === note.id);
      if (exists) {
        return prev.map(n => n.id === note.id ? note : n);
      }
      return [...prev, note];
    });
    setEditingSavedNote(undefined);
    setActiveTab('calendar');
  };

  const handleUpdateNote = (updatedNote: SavedNote) => {
    setSavedNotes(prev => prev.map(note => note.id === updatedNote.id ? updatedNote : note));
  };

  const handleDeleteNote = (id: string) => {
    setSavedNotes(prev => prev.filter(note => note.id !== id));
  };

  const handleSavePlan = (plan: any) => {
    setSavedPlans(prev => [...prev, { ...plan, id: Date.now().toString() }]);
  };

  const handleDeletePlan = (id: string) => {
    setSavedPlans(prev => prev.filter(plan => plan.id !== id));
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard brandData={brandData} onNavigate={setActiveTab} savedNotes={savedNotes} savedPlans={savedPlans} />;
      case 'planner':
        return (
          <Planner
            brandData={brandData}
            onPlanGenerated={setCurrentPlan}
            onNavigate={setActiveTab}
            onSelectTopic={setSelectedTopic}
            onSavePlan={handleSavePlan}
            onDeletePlan={handleDeletePlan}
            savedPlans={savedPlans}
          />
        );
      case 'generator':
        return (
          <ContentGenerator
            brandData={brandData}
            currentPlan={currentPlan}
            initialTopic={selectedTopic}
            initialNote={editingSavedNote}
            onNavigate={setActiveTab}
            onUpdatePlan={setCurrentPlan}
            onSaveNote={handleSaveNote}
            savedNotes={savedNotes}
          />
        );
      case 'calendar':
        return <Calendar
          savedNotes={savedNotes}
          onUpdateNote={handleUpdateNote}
          onDeleteNote={handleDeleteNote}
          onEditNoteContent={(note) => {
            setEditingSavedNote(note);
            setActiveTab('generator');
          }}
        />;
      case 'settings':
        return <BrandSettings brandData={brandData} onUpdate={setBrandData} />;
      default:
        return <Dashboard brandData={brandData} onNavigate={setActiveTab} savedNotes={savedNotes} savedPlans={savedPlans} />;
    }
  };

  const NAV_TABS = [
    { key: 'dashboard', label: t('nav.dashboard'), icon: <LayoutDashboard size={16} /> },
    { key: 'planner', label: t('nav.planner'), icon: <CalendarIcon size={16} /> },
    { key: 'generator', label: t('nav.generator'), icon: <PenTool size={16} /> },
    { key: 'calendar', label: t('nav.calendar'), icon: <CalendarDays size={16} /> },
    { key: 'settings', label: t('nav.settings'), icon: <Settings size={16} /> },
  ];

  const headerToggles = (
    <HeaderToggles
      lang={lang}
      onLangChange={setLang}
      isDark={isDarkMode}
      onDarkChange={setDarkMode}
    />
  );

  return (
    <RouteGuard>
      <AppLayout currentApp="rednote-ops" userName="Admin">
        <div className={`min-h-screen h-full w-full overflow-y-auto font-sans flex flex-col ${isDarkMode ? 'dark bg-slate-950 text-slate-300' : 'bg-slate-50 text-slate-900 dark:text-slate-200'}`}>

          <AppHeader
            appName="Rednote Ops"
            logoIcon={<Library className="w-5 h-5" />}
            brand={{
              logoBg: 'bg-rose-500',
              activeBg: 'bg-rose-50',
              activeText: 'text-rose-600',
            }}
            tabs={NAV_TABS}
            activeTab={activeTab}
            onTabChange={(key) => setActiveTab(key as typeof activeTab)}
            onLogoClick={() => {
              setActiveTab('dashboard');
              setCurrentPlan([]);
              setSelectedTopic('');
              setEditingSavedNote(undefined);
            }}
            rightContent={headerToggles}
            signInLabel={lang === 'zh' ? '登录' : 'Sign In'}
          />

          <PageLayout>
            <HeroBanner
              title={lang === 'zh' ? '小红书智能运营助手' : 'Rednote Content Operations'}
              description={lang === 'zh'
                ? '一站式管理品牌设定、内容日历和AI文案生成，高效打造专业小红书运营工作流。'
                : 'Manage brand settings, content calendar, and AI copywriting in one place to streamline your Rednote operations workflow.'}
              gradient="from-rose-600 via-pink-600 to-fuchsia-600"
              tags={[
                { label: lang === 'zh' ? '品牌管理' : 'Brand Management' },
                { label: lang === 'zh' ? '内容日历' : 'Content Calendar' },
                { label: lang === 'zh' ? 'AI 文案' : 'AI Copywriting' },
              ]}
            />
            <BodyContainer>
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Suspense fallback={<div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>}>
                  {renderContent()}
                </Suspense>
              </motion.div>
            </BodyContainer>
          </PageLayout>
          <AppFooter appName="Academy Ops" />
        </div>
      </AppLayout>
    </RouteGuard>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
      <ToastContainer />
    </LanguageProvider>
  );
}
