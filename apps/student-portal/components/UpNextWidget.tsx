import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { Flame, Clock, PlayCircle } from 'lucide-react';

interface UpNextWidgetProps {
    assignments: any[];
    onStart: (assignment: any) => void;
}

export const UpNextWidget: React.FC<UpNextWidgetProps> = ({ assignments, onStart }) => {
    const { t, lang } = useLanguage();

    // Find the most urgent pending/incomplete assignment
    const pending = assignments.filter(a => {
        const status = a.submission?.status;
        return status === 'pending' || status === 'incomplete';
    });

    if (pending.length === 0) return null;

    // Sort by due date (closest first). If no due date, put it at the end.
    const sorted = [...pending].sort((a, b) => {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });

    const urgent = sorted[0];

    const isOverdue = urgent.due_date && new Date(urgent.due_date).getTime() + 3 * 86400000 < new Date().getTime();
    const isMissed = (isOverdue && urgent.submission?.status === 'pending') || urgent.submission?.status === 'incomplete';

    return (
        <div className="mb-8">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Flame size={16} className="text-orange-500" />
                {lang === 'zh' ? '接下来 (Up Next)' : 'Up Next'}
            </h2>

            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-1 shadow-lg cursor-pointer transform hover:-translate-y-1 hover:shadow-xl transition-all duration-300" onClick={() => onStart(urgent)}>
                <div className="bg-white dark:bg-slate-900 rounded-xl p-5 relative overflow-hidden h-full">
                    {/* Background decoration */}
                    <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl"></div>

                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative z-10">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${isMissed ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                    {isMissed ? (lang === 'zh' ? '补交任务' : 'Late Make-up') : (lang === 'zh' ? '优先任务' : 'Priority')}
                                </span>
                                {urgent.due_date && (
                                    <span className="flex items-center gap-1 text-xs text-slate-500 font-medium">
                                        <Clock size={12} />
                                        {urgent.due_date}
                                    </span>
                                )}
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-1 line-clamp-1">{urgent.title}</h3>
                            <p className="text-sm text-slate-500 line-clamp-1">{urgent.description || (lang === 'zh' ? '点击开始完成本项学习任务' : 'Start your learning task now.')}</p>
                        </div>

                        <button className="flex-shrink-0 w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold shadow-md transition-colors group">
                            <PlayCircle size={20} className="group-hover:scale-110 transition-transform" />
                            {lang === 'zh' ? '立即开始' : 'Start Now'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
