import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Toaster } from 'react-hot-toast';
import { Settings, Calendar as CalendarIcon, PenTool, LayoutDashboard, Menu, X, CalendarDays, Moon, Sun } from 'lucide-react';
import Dashboard from './components/Dashboard';
import Planner from './components/Planner';
import ContentGenerator from './components/ContentGenerator';
import BrandSettings from './components/BrandSettings';
import Calendar from './components/Calendar';
import { INITIAL_BRAND_DATA } from './data/brandData';
import { SavedNote } from './types';

// Helper to safely load JSON from localStorage
const loadFromStorage = (key: string, defaultVal: any) => {
  try {
    const item = localStorage.getItem(key);
    if (!item || item === 'undefined' || item === 'null') return defaultVal;
    const parsed = JSON.parse(item);
    // Extra safety: if we expect an array but getting something else, return default
    if (Array.isArray(defaultVal) && !Array.isArray(parsed)) return defaultVal;
    return parsed;
  } catch (e) {
    console.error(`Error loading ${key} from storage:`, e);
    return defaultVal;
  }
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'planner' | 'generator' | 'settings' | 'calendar'>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => loadFromStorage('pathway_darkMode', false));

  // Persistent States
  const [brandData, setBrandData] = useState(() => loadFromStorage('pathway_brandData', INITIAL_BRAND_DATA));
  const [savedPlans, setSavedPlans] = useState<any[]>(() => loadFromStorage('pathway_savedPlans', []));
  const [savedNotes, setSavedNotes] = useState<SavedNote[]>(() => loadFromStorage('pathway_savedNotes', []));

  // Ephemeral States
  // Ephemeral States
  const [currentPlan, setCurrentPlan] = useState<any[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [editingSavedNote, setEditingSavedNote] = useState<SavedNote | undefined>(undefined);

  // Sync with LocalStorage
  useEffect(() => localStorage.setItem('pathway_brandData', JSON.stringify(brandData)), [brandData]);
  useEffect(() => localStorage.setItem('pathway_savedPlans', JSON.stringify(savedPlans)), [savedPlans]);
  useEffect(() => localStorage.setItem('pathway_savedNotes', JSON.stringify(savedNotes)), [savedNotes]);
  useEffect(() => {
    localStorage.setItem('pathway_darkMode', JSON.stringify(isDarkMode));
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

  const NavItem = ({ id, icon: Icon, label }: { id: typeof activeTab, icon: any, label: string }) => (
    <button
      onClick={() => {
        setActiveTab(id);
        setIsMobileMenuOpen(false);
      }}
      className={`flex items-center space-x-3 w-full px-4 py-3 rounded-xl transition-all duration-200 ${activeTab === id
        ? 'bg-rose-500 text-white shadow-md shadow-rose-200'
        : 'text-slate-600 hover:bg-rose-50'
        }`}
    >
      <Icon size={20} />
      <span className="font-medium">{label}</span>
    </button>
  );

  return (
    <div className={`min-h-screen font-sans flex ${isDarkMode ? 'dark bg-slate-900 text-white' : 'bg-slate-50 text-slate-900'}`}>
      <Toaster position="top-center" toastOptions={{ duration: 3000, style: { background: '#334155', color: '#fff', borderRadius: '12px' } }} />
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* Sidebar Navigation */}
      <aside className={`fixed top-0 left-0 h-screen w-64 bg-white border-r border-slate-200 z-50 transform transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}>
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-rose-500 rounded-lg flex items-center justify-center text-white font-bold text-xl">P</div>
            <span className="text-lg font-bold tracking-tight text-slate-900">Pathway Ops</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-400">
            <X size={24} />
          </button>
        </div>

        <nav className="p-4 space-y-2">
          <NavItem id="dashboard" icon={LayoutDashboard} label="运营概览" />
          <NavItem id="planner" icon={CalendarIcon} label="运营计划" />
          <NavItem id="generator" icon={PenTool} label="内容创作" />
          <NavItem id="calendar" icon={CalendarDays} label="运营日历" />
          <NavItem id="settings" icon={Settings} label="品牌设置" />
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-6 space-y-4">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <span className="text-sm font-medium">深色模式</span>
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
            <p className="text-xs text-slate-500 mb-1">当前账号</p>
            <p className="font-semibold text-sm truncate dark:text-slate-200">{brandData.name}</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 md:ml-64">
        {/* Mobile Header */}
        <div className="md:hidden p-4 bg-white border-b border-slate-200 flex items-center justify-between sticky top-0 z-30">
          <div className="font-bold text-lg">Pathway Ops</div>
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 bg-slate-100 rounded-lg">
            <Menu size={20} />
          </button>
        </div>

        <div className="p-4 md:p-8 max-w-5xl mx-auto">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {renderContent()}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
