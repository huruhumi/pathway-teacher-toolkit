import React from 'react';
import { Compass, FolderOpen, Cloud, LogOut, User, Map, FileText } from 'lucide-react';
import { useAuthStore } from '../stores/useAuthStore';
import { isSupabaseEnabled } from '../services/supabaseClient';
import { useLanguage } from '../i18n/LanguageContext';
import { AppHeader } from '@shared/components/AppHeader';

interface HeaderProps {
  currentView: 'curriculum' | 'lesson' | 'saved';
  onNavigate: (view: 'curriculum' | 'lesson' | 'saved') => void;
  onShowAuth?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentView, onNavigate, onShowAuth }) => {
  const { user, signOut } = useAuthStore();
  const cloudEnabled = isSupabaseEnabled();
  const { t } = useLanguage();

  const tabs = [
    { key: 'curriculum', label: t('nav.curriculum'), icon: <Map size={16} /> },
    { key: 'lesson', label: t('nav.lessonKit'), icon: <FileText size={16} /> },
    { key: 'saved', label: t('nav.saved'), icon: <FolderOpen size={16} /> },
  ];

  const authContent = cloudEnabled ? (
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
  ) : undefined;

  return (
    <AppHeader
      appName="Nature Compass"
      logoIcon={<Compass size={20} />}
      brand={{
        logoBg: 'bg-gradient-to-tr from-emerald-500 to-teal-400',
        activeBg: 'bg-emerald-50',
        activeText: 'text-emerald-700',
      }}
      tabs={tabs}
      activeTab={currentView}
      onTabChange={(key) => onNavigate(key as 'curriculum' | 'lesson' | 'saved')}
      onLogoClick={() => onNavigate('curriculum')}
      rightContent={authContent}
    />
  );
};
