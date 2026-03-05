import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuthStore } from '@shared/stores/useAuthStore';
import * as edu from '@shared/services/educationService';
import { Users, School, ClipboardList, BookOpen, Loader2, CalendarDays } from 'lucide-react';

const DashboardPage: React.FC<{ onNav?: (tab: string) => void }> = ({ onNav }) => {
    const { t } = useLanguage();
    const user = useAuthStore(s => s.user);
    const teacherId = user?.id ?? '';
    const [loading, setLoading] = useState(true);
    const [counts, setCounts] = useState({ students: 0, classes: 0, assignments: 0, books: 0, sessions: 0 });

    const load = useCallback(async () => {
        if (!teacherId) { setLoading(false); return; }
        const [stu, cls, assign, loans, sessions] = await Promise.all([
            edu.fetchStudents(teacherId),
            edu.fetchClasses(teacherId),
            edu.fetchAssignments(teacherId),
            edu.fetchBookLoans(teacherId),
            edu.fetchSessions(teacherId),
        ]);
        setCounts({ students: stu.length, classes: cls.length, assignments: assign.length, books: loans.filter(l => !l.returned_at).length, sessions: sessions.length });
        setLoading(false);
    }, [teacherId]);

    useEffect(() => { load(); }, [load]);

    if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-amber-500" size={28} /></div>;

    const cards = [
        { key: 'students', icon: Users, color: 'amber', val: counts.students, tab: 'students' },
        { key: 'classes', icon: School, color: 'teal', val: counts.classes, tab: 'classes' },
        { key: 'sessions', icon: CalendarDays, color: 'violet', val: counts.sessions, tab: 'calendar' },
        { key: 'assignments', icon: ClipboardList, color: 'indigo', val: counts.assignments, tab: 'students' },
        { key: 'books', icon: BookOpen, color: 'rose', val: counts.books, tab: 'students' },
    ];

    const colorMap: Record<string, string> = {
        amber: 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400',
        teal: 'bg-teal-100 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400',
        violet: 'bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400',
        indigo: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400',
        rose: 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400',
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {cards.map(c => (
                    <button key={c.key} onClick={() => onNav?.(c.tab)}
                        className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 hover:shadow-md transition-all text-left">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${colorMap[c.color]}`}>
                                <c.icon size={18} />
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-slate-800 dark:text-white">{c.val}</div>
                                <div className="text-xs text-slate-400 font-medium">{t(`dash.${c.key}` as any)}</div>
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                <h3 className="font-bold text-slate-800 dark:text-white mb-3">{t('dash.recentActivity')}</h3>
                <div className="text-center py-6 text-sm text-slate-400">
                    {counts.students === 0 && counts.classes === 0
                        ? t('dash.getStarted')
                        : t('dash.noActivity')
                    }
                </div>
            </div>
        </div>
    );
};

export default DashboardPage;
