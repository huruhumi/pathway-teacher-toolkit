import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Toaster } from 'react-hot-toast';
import { Settings, Calendar as CalendarIcon, PenTool, LayoutDashboard, CalendarDays, Moon, Sun } from 'lucide-react';
import Dashboard from './components/Dashboard';
import Planner from './components/Planner';
import ContentGenerator from './components/ContentGenerator';
import BrandSettings from './components/BrandSettings';
import Calendar from './components/Calendar';
import { INITIAL_BRAND_DATA } from './data/brandData';
import { SavedNote } from './types';
import { safeStorage } from '@shared/safeStorage';
import { AppHeader } from '@shared/components/AppHeader';
import { HeaderToggles } from '@shared/components/HeaderToggles';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext';



function AppContent() {
  const { t, lang, setLang } = useLanguage();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'planner' | 'generator' | 'settings' | 'calendar'>('dashboard');

  const [isDarkMode, setIsDarkMode] = useState(() => safeStorage.get('pathway_darkMode', false));

  // Persistent States
  const [brandData, setBrandData] = useState(() => safeStorage.get('pathway_brandData', INITIAL_BRAND_DATA));
  const [savedPlans, setSavedPlans] = useState<any[]>(() => safeStorage.get('pathway_savedPlans', []));
  const [savedNotes, setSavedNotes] = useState<SavedNote[]>(() => safeStorage.get('pathway_savedNotes', []));

  // Ephemeral States
  // Ephemeral States
  const [currentPlan, setCurrentPlan] = useState<any[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [editingSavedNote, setEditingSavedNote] = useState<SavedNote | undefined>(undefined);

  // Sync with LocalStorage (debounced)
  useEffect(() => { safeStorage.set('pathway_brandData', brandData); }, [brandData]);
  useEffect(() => { safeStorage.set('pathway_savedPlans', savedPlans); }, [savedPlans]);
  useEffect(() => { safeStorage.set('pathway_savedNotes', savedNotes); }, [savedNotes]);
  useEffect(() => {
    safeStorage.set('pathway_darkMode', isDarkMode);
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

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
      onDarkChange={setIsDarkMode}
    />
  );

  return (
    <div className={`min-h-screen font-sans ${isDarkMode ? 'dark bg-slate-900 text-white' : 'bg-slate-50 text-slate-900'}`}>
      <Toaster position="top-center" toastOptions={{ duration: 3000, style: { background: '#334155', color: '#fff', borderRadius: '12px' } }} />

      <AppHeader
        appName="Pathway Ops"
        logoIcon={<span className="font-bold text-lg">P</span>}
        brand={{
          logoBg: 'bg-rose-500',
          activeBg: 'bg-rose-50',
          activeText: 'text-rose-600',
        }}
        tabs={NAV_TABS}
        activeTab={activeTab}
        onTabChange={(key) => setActiveTab(key as typeof activeTab)}
        onLogoClick={() => setActiveTab('dashboard')}
        rightContent={headerToggles}
      />

      <main className="p-4 md:p-8 max-w-6xl mx-auto">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {renderContent()}
        </motion.div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}
