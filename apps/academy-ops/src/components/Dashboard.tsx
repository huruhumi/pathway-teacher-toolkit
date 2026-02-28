import { motion } from 'motion/react';
import { BrandData } from '../data/brandData';
import { Sparkles, Calendar, ArrowRight, Target, FileText, LayoutList } from 'lucide-react';
import { SavedNote } from '../types';

interface DashboardProps {
  brandData: BrandData;
  onNavigate: (tab: 'dashboard' | 'planner' | 'generator' | 'settings') => void;
  savedNotes: SavedNote[];
  savedPlans: any[];
}

export default function Dashboard({ brandData, onNavigate, savedNotes, savedPlans }: DashboardProps) {
  const todayStr = new Date().toISOString().split('T')[0];
  const upcomingNotesCount = savedNotes.filter(n => n.date >= todayStr).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">欢迎回来, 运营专家</h1>
          <p className="text-slate-500 mt-1">今天我们要为 {brandData.name} 创造什么价值？</p>
        </div>
        <button
          onClick={() => onNavigate('generator')}
          className="bg-rose-500 hover:bg-rose-600 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-lg shadow-rose-200"
        >
          <Sparkles size={18} />
          <span>立即创作</span>
        </button>
      </div>

      {/* Stats / Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-500 flex-shrink-0">
            <FileText size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">已生成图文</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-2xl font-bold text-slate-900">{savedNotes.length}</h3>
              <span className="text-xs text-slate-400">篇</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center text-rose-500 flex-shrink-0">
            <Calendar size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">待发布排期</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-2xl font-bold text-slate-900">{upcomingNotesCount}</h3>
              <span className="text-xs text-slate-400">篇 (今天及以后)</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-500 flex-shrink-0">
            <LayoutList size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">归档运营方案</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-2xl font-bold text-slate-900">{savedPlans.length}</h3>
              <span className="text-xs text-slate-400">份</span>
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
            <h3 className="text-2xl font-bold mb-2">制定运营计划</h3>
            <p className="text-indigo-100 mb-6 max-w-xs">
              基于账号现状，智能生成未来几周的内容排期与策略。
            </p>
            <div className="flex items-center gap-2 font-medium group-hover:gap-3 transition-all">
              <span>开始规划</span>
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
            <h3 className="text-2xl font-bold text-slate-900 mb-2">生成爆款图文</h3>
            <p className="text-slate-500 mb-6 max-w-xs">
              输入主题，一键生成小红书风格的标题、正文和配图建议。
            </p>
            <div className="flex items-center gap-2 font-medium text-rose-500 group-hover:gap-3 transition-all">
              <span>去创作</span>
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
