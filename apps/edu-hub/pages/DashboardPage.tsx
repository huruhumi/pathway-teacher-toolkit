import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuthStore } from '@shared/stores/useAuthStore';
import * as edu from '@pathway/education';
import { Users, School, ClipboardList, BookOpen, Loader2, CalendarDays, TrendingUp, AlertTriangle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DailyStats {
    date: string;
    assigned: number;
    submitted: number;
    rate: number;
}

interface RiskStudent {
    student: edu.Student;
    missingCount: number;
}

const DashboardPage: React.FC<{ onNav?: (tab: string) => void }> = ({ onNav }) => {
    const { t, lang } = useLanguage();
    const user = useAuthStore(s => s.user);
    const teacherId = user?.id ?? '';

    const [loading, setLoading] = useState(true);
    const [counts, setCounts] = useState({ students: 0, classes: 0, assignments: 0, books: 0, sessions: 0 });

    const [assignments, setAssignments] = useState<edu.Assignment[]>([]);
    const [submissions, setSubmissions] = useState<edu.Submission[]>([]);
    const [students, setStudents] = useState<edu.Student[]>([]);

    const load = useCallback(async () => {
        if (!teacherId) { setLoading(false); return; }
        const [stu, cls, assign, loans, sessions, subs] = await Promise.all([
            edu.fetchStudents(teacherId),
            edu.fetchClasses(teacherId),
            edu.fetchAssignments(teacherId),
            edu.fetchBookLoans(teacherId),
            edu.fetchSessions(teacherId),
            edu.fetchTeacherSubmissions(teacherId)
        ]);

        setStudents(stu);
        setAssignments(assign);
        setSubmissions(subs);
        setCounts({
            students: stu.length,
            classes: cls.length,
            assignments: assign.length,
            books: loans.filter(l => !l.returned_at).length,
            sessions: sessions.length
        });
        setLoading(false);
    }, [teacherId]);

    useEffect(() => { load(); }, [load]);

    // Calculate last 7 days turn-in rate
    const chartData = useMemo(() => {
        if (!assignments.length) return [];

        const data: DailyStats[] = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];

            // Find assignments DUE on this day
            const dueToday = assignments.filter(a => a.due_date?.startsWith(dateStr));
            let assignedCount = 0;
            let submittedCount = 0;

            dueToday.forEach(a => {
                // If assignment has no specific student, assume it was assigned to all active students? 
                // Or just count the actual submissions table entries for this assignment.
                const asgSubs = submissions.filter(s => s.assignment_id === a.id);
                // A better approximation of "assigned" is how many pending/submitted records exist
                assignedCount += Math.max(asgSubs.length, 1);
                submittedCount += asgSubs.filter(s => s.status === 'submitted' || s.status === 'completed' || s.status === 'returned').length;
            });

            // Smooth out 0/0 days
            const rate = assignedCount > 0 ? Math.round((submittedCount / assignedCount) * 100) : 0;

            data.push({
                date: d.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' }),
                assigned: assignedCount,
                submitted: submittedCount,
                rate
            });
        }
        return data;
    }, [assignments, submissions, lang]);

    // Calculate high-risk students (most missing/overdue assignments)
    const riskStudents = useMemo(() => {
        const missingCounts: Record<string, number> = {};
        submissions.forEach(s => {
            if (s.status === 'incomplete') {
                missingCounts[s.student_id] = (missingCounts[s.student_id] || 0) + 1;
            } else if (s.status === 'pending') {
                const asg = assignments.find(a => a.id === s.assignment_id);
                if (asg && asg.due_date && new Date(asg.due_date) < new Date()) {
                    missingCounts[s.student_id] = (missingCounts[s.student_id] || 0) + 1;
                }
            }
        });

        const risks: RiskStudent[] = Object.entries(missingCounts)
            .map(([studentId, count]) => ({
                student: students.find(s => s.id === studentId) as edu.Student,
                missingCount: count
            }))
            .filter(r => r.student && r.missingCount > 0)
            .sort((a, b) => b.missingCount - a.missingCount)
            .slice(0, 5); // Top 5

        return risks;
    }, [submissions, assignments, students]);

    if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-amber-500" size={28} /></div>;

    const cards = [
        { key: 'students', icon: Users, color: 'amber', val: counts.students, tab: 'students' },
        { key: 'classes', icon: School, color: 'teal', val: counts.classes, tab: 'classes' },
        { key: 'sessions', icon: CalendarDays, color: 'violet', val: counts.sessions, tab: 'calendar' },
        { key: 'assignments', icon: ClipboardList, color: 'indigo', val: counts.assignments, tab: 'assignments' },
        { key: 'books', icon: BookOpen, color: 'rose', val: counts.books, tab: 'books' },
    ];

    const colorMap: Record<string, string> = {
        amber: 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400',
        teal: 'bg-teal-100 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400',
        violet: 'bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400',
        indigo: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400',
        rose: 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400',
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {cards.map(c => (
                    <button key={c.key} onClick={() => onNav?.(c.tab)}
                        className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 hover:shadow-lg transition-all text-left group">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 ${colorMap[c.color]}`}>
                                <c.icon size={18} />
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-slate-800 dark:text-white">{c.val}</div>
                                <div className="text-xs text-slate-400 font-medium">{t(`dash.${c.key}`)}</div>
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            {/* Main Dashboard Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Chart Widget */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-white text-lg flex items-center gap-2">
                                <TrendingUp size={20} className="text-indigo-500" />
                                {lang === 'zh' ? '近 7 日作业上交率' : 'Turn-in Rate (Last 7 Days)'}
                            </h3>
                            <p className="text-sm text-slate-400">
                                {lang === 'zh' ? '追踪近期发布的作业完成情况' : 'Tracking completion for recent assignments'}
                            </p>
                        </div>
                    </div>

                    <div className="h-64 w-full">
                        {chartData.length > 0 && chartData.some(d => d.assigned > 0) ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} domain={[0, 100]} tickFormatter={(val) => `${val}%`} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                                        labelStyle={{ color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}
                                    />
                                    <Area type="monotone" dataKey="rate" name={lang === 'zh' ? '提交率' : 'Submit Rate'} stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorRate)" activeDot={{ r: 6, strokeWidth: 0, fill: '#4f46e5' }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                <ClipboardList size={40} className="mb-3 opacity-20" />
                                <p>{lang === 'zh' ? '近期没有作业数据' : 'No data for recent assignments'}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* High Risk Widget */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm flex flex-col">
                    <div className="flex items-center gap-2 mb-6">
                        <AlertTriangle size={20} className="text-rose-500" />
                        <h3 className="font-bold text-slate-800 dark:text-white text-lg">
                            {lang === 'zh' ? '预警跟进名单' : 'Follow-up Required'}
                        </h3>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                        {riskStudents.length > 0 ? (
                            riskStudents.map(({ student, missingCount }) => (
                                <div key={student.id} className="flex items-center justify-between p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-rose-200 dark:bg-rose-900/50 flex items-center justify-center text-rose-700 dark:text-rose-300 font-bold text-xs">
                                            {student.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{student.name}</div>
                                            <div className="text-xs text-rose-500 font-medium">
                                                {lang === 'zh' ? `欠交 ${missingCount} 项作业` : `${missingCount} missing assignments`}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => onNav?.('students')}
                                        className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-lg transition-colors"
                                    >
                                        <span className="text-xs font-bold uppercase">{lang === 'zh' ? '查看' : 'View'}</span>
                                    </button>
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-emerald-500 py-10">
                                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-3">
                                    <span className="text-2xl">🎉</span>
                                </div>
                                <p className="font-semibold">{lang === 'zh' ? '目前没有欠交作业的同学！' : 'All clear! No pending follow-ups.'}</p>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default DashboardPage;
