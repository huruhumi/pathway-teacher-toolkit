import React from 'react';
import { Compass, FolderOpen, Map, FileText } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { AppHeader } from '@shared/components/AppHeader';
import { HeaderToggles } from '@shared/components/HeaderToggles';
import { useThemeStore } from '@shared/stores/useThemeStore';

interface HeaderProps {
  currentView: 'curriculum' | 'lesson' | 'saved';
  onNavigate: (view: 'curriculum' | 'lesson' | 'saved') => void;
  onLogoClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentView, onNavigate, onLogoClick }) => {
  const { t, lang, setLang } = useLanguage();
  const isDarkMode = useThemeStore((state) => state.isDarkMode);
  const setDarkMode = useThemeStore((state) => state.setDarkMode);

  const tabs = [
    { key: 'curriculum', label: t('nav.curriculum'), icon: <Map size={16} /> },
    { key: 'lesson', label: t('nav.lessonKit'), icon: <FileText size={16} /> },
    { key: 'saved', label: t('nav.saved'), icon: <FolderOpen size={16} /> },
  ];

  return (
    <AppHeader
      appName={t('app.name' as any)}
      logoIcon={<Compass size={20} />}
      brand={{
        logoBg: 'bg-gradient-to-tr from-emerald-500 to-teal-400',
        activeBg: 'bg-emerald-50',
        activeText: 'text-emerald-700',
      }}
      tabs={tabs}
      activeTab={currentView}
      onTabChange={(key) => onNavigate(key as 'curriculum' | 'lesson' | 'saved')}
      onLogoClick={onLogoClick}
      rightContent={
        <div className="flex items-center gap-2">
          <HeaderToggles lang={lang} onLangChange={setLang} isDark={isDarkMode} onDarkChange={setDarkMode} />
        </div>
      }
      signInLabel={lang === 'zh' ? '登录' : 'Sign In'}
      homeUrl={import.meta.env.DEV ? 'http://localhost:3000' : '/'}
    />
  );
};
