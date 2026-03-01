import { motion } from 'motion/react';
import { BrandData } from '../data/brandData';
import { Sparkles, Calendar, ArrowRight, Target, FileText, LayoutList } from 'lucide-react';
import { SavedNote } from '../types';
import { useLanguage } from '../i18n/LanguageContext';

interface DashboardProps {
  brandData: BrandData;
  onNavigate: (tab: 'dashboard' | 'planner' | 'generator' | 'settings') => void;
  savedNotes: SavedNote[];
  savedPlans: any[];
}

export default function Dashboard({ brandData, onNavigate, savedNotes, savedPlans }: DashboardProps) {
  const { t, lang } = useLanguage();
  const todayStr = new Date().toISOString().split('T')[0];
  const upcomingNotesCount = savedNotes.filter(n => n.date >= todayStr).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{t('dash.welcome')}</h1>
          <p className="text-slate-500 mt-1">{lang === 'zh' ? `今天我们要为 ${brandData.name} 创造什么价值？` : `What value will we create for ${brandData.name} today?`}</p>
        </div>
        <button
          onClick={() => onNavigate('generator')}
          className="btn btn-primary shadow-lg shadow-rose-200"
        >
          <Sparkles size={18} />
          <span>{t('dash.createNow')}</span>
        </button>
      </div>

      {/* Stats / Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-500 flex-shrink-0">
            <FileText size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">{t('dash.postsGenerated')}</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-2xl font-bold text-slate-900">{savedNotes.length}</h3>
              <span className="text-xs text-slate-400">{t('dash.unit.posts')}</span>
            </div>
          </div>
        </div>

        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center text-rose-500 flex-shrink-0">
            <Calendar size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">{t('dash.scheduledPosts')}</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-2xl font-bold text-slate-900">{upcomingNotesCount}</h3>
              <span className="text-xs text-slate-400">{t('dash.unit.upcoming')}</span>
            </div>
          </div>
        </div>

        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-500 flex-shrink-0">
            <LayoutList size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">{t('dash.archivedPlans')}</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-2xl font-bold text-slate-900">{savedPlans.length}</h3>
              <span className="text-xs text-slate-400">{t('dash.unit.plans')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div
          onClick={() => onNavigate('planner')}
          className="group cursor-pointer bg-gradient-to-br from-indigo-500 to-violet-600 p-8 rounded-3xl text-white relative overflow-hidden"
        >
          <div className="relative z-10">
            <h3 className="text-2xl font-bold mb-2">{t('dash.makePlan')}</h3>
            <p className="text-indigo-100 mb-6 max-w-xs">
              {t('dash.makePlanDesc')}
            </p>
            <div className="flex items-center gap-2 font-medium group-hover:gap-3 transition-all">
              <span>{t('dash.startPlanning')}</span>
              <ArrowRight size={18} />
            </div>
          </div>
          <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-1/4 translate-y-1/4">
            <Calendar size={200} />
          </div>
        </div>

        <div
          onClick={() => onNavigate('generator')}
          className="group cursor-pointer bg-white border border-slate-200 p-8 rounded-3xl relative overflow-hidden hover:border-rose-200 transition-colors"
        >
          <div className="relative z-10">
            <h3 className="text-2xl font-bold text-slate-900 mb-2">{t('dash.generatePost')}</h3>
            <p className="text-slate-500 mb-6 max-w-xs">
              {t('dash.generatePostDesc')}
            </p>
            <div className="flex items-center gap-2 font-medium text-rose-500 group-hover:gap-3 transition-all">
              <span>{t('dash.goCreate')}</span>
              <ArrowRight size={18} />
            </div>
          </div>
          <div className="absolute right-0 bottom-0 opacity-5 transform translate-x-1/4 translate-y-1/4 text-rose-500">
            <Sparkles size={200} />
          </div>
        </div>
      </div>
    </div>
  );
}
