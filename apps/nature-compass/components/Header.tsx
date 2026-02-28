import React from 'react';
import { Compass, FolderOpen, Cloud, LogOut, User, Map, FileText } from 'lucide-react';
import { useAuthStore } from '../stores/useAuthStore';
import { isSupabaseEnabled } from '../services/supabaseClient';
import { useLanguage } from '../i18n/LanguageContext';

interface HeaderProps {
  currentView: 'curriculum' | 'lesson' | 'saved';
  onNavigate: (view: 'curriculum' | 'lesson' | 'saved') => void;
  onShowAuth?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentView, onNavigate, onShowAuth }) => {
  const { user, signOut } = useAuthStore();
  const cloudEnabled = isSupabaseEnabled();
  const { t } = useLanguage();

  const tabs: { key: 'curriculum' | 'lesson' | 'saved'; label: string; icon: React.ReactNode }[] = [
    { key: 'curriculum', label: t('nav.curriculum'), icon: <Map size={16} /> },
    { key: 'lesson', label: t('nav.lessonKit'), icon: <FileText size={16} /> },
    { key: 'saved', label: t('nav.saved'), icon: <FolderOpen size={16} /> },
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div
          className="flex items-center gap-2.5 cursor-pointer"
          onClick={() => onNavigate('curriculum')}
        >
          <div className="w-8 h-8 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-xl flex items-center justify-center text-white shadow-sm">
            <Compass size={20} />
          </div>
          <span className="font-bold text-slate-800 text-lg tracking-tight">
            Nature Compass
          </span>
        </div>

        {/* Tab Navigation */}
        <nav className="hidden md:flex items-center bg-slate-100 rounded-xl p-1 gap-0.5">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => onNavigate(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${currentView === tab.key
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {/* Mobile nav tabs */}
          <div className="flex md:hidden items-center gap-1">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => onNavigate(tab.key)}
                className={`p-2 rounded-lg transition-all ${currentView === tab.key
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-slate-400 hover:text-slate-600'
                  }`}
                title={tab.label}
              >
                {tab.icon}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block"></div>

          {/* Auth Section */}
          {cloudEnabled && (
            user ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-200">
                  <Cloud size={14} />
                  <span className="hidden sm:inline max-w-[120px] truncate">{user.email}</span>
                </div>
                <button
                  onClick={signOut}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                  title="Sign Out"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <button
                onClick={onShowAuth}
                className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-emerald-600 px-3 py-1.5 rounded-xl hover:bg-slate-50 transition-all border border-slate-200"
              >
                <User size={16} />
                <span className="hidden sm:inline">Sign In</span>
              </button>
            )
          )}
        </div>
      </div>
    </header>
  );
};
