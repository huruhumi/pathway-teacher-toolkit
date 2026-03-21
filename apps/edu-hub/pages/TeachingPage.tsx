import React, { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { School, CalendarDays, ClipboardList } from 'lucide-react';

const ClassesPage = React.lazy(() => import('./ClassesPage'));
const CalendarPage = React.lazy(() => import('./CalendarPage'));
const AssignmentsPage = React.lazy(() => import('./AssignmentsPage'));

type SubTab = 'calendar' | 'classes' | 'assignments';

const TeachingPage: React.FC = () => {
    const { lang } = useLanguage();
    const zh = lang === 'zh';
    const [sub, setSub] = useState<SubTab>('calendar');

    const tabs: { key: SubTab; label: string; icon: React.ReactNode }[] = [
        { key: 'calendar', label: zh ? '排课 & 点名' : 'Calendar', icon: <CalendarDays size={15} /> },
        { key: 'assignments', label: zh ? '作业管理' : 'Assignments', icon: <ClipboardList size={15} /> },
        { key: 'classes', label: zh ? '班级管理' : 'Classes', icon: <School size={15} /> },
    ];

    return (
        <div>
            {/* Sub-tab bar */}
            <div className="flex gap-1 mb-5 bg-slate-100 dark:bg-slate-800/60 rounded-xl p-1 w-fit">
                {tabs.map(t => (
                    <button
                        key={t.key}
                        onClick={() => setSub(t.key)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${sub === t.key
                                ? 'bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-300 shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                            }`}
                    >
                        {t.icon}{t.label}
                    </button>
                ))}
            </div>

            <React.Suspense fallback={<div className="flex justify-center py-12"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-600" /></div>}>
                {sub === 'calendar' && <CalendarPage />}
                {sub === 'assignments' && <AssignmentsPage />}
                {sub === 'classes' && <ClassesPage />}
            </React.Suspense>
        </div>
    );
};

export default TeachingPage;
