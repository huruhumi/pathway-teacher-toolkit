import React, { useState, useEffect, useCallback } from 'react';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext';
import { useAuthStore } from '@pathway/platform';
import { AppFooter, AppHeader, AppLayout, BodyContainer, ErrorBoundary, PageLayout, RouteGuard, ToastContainer } from '@pathway/ui';
import type { Assignment, Submission, ClassSession } from '@pathway/education';
import {
    ClipboardList, CalendarDays, Languages, BookOpen,
    GraduationCap, User, Loader2, CheckCircle2, Clock,
    Send, RotateCcw,
} from 'lucide-react';
import * as edu from '@pathway/education';
import { InteractiveAssignmentRenderer } from './components/InteractiveAssignmentRenderer';
import { ReadingView } from './components/ReadingView';

type View = 'assignments' | 'schedule' | 'reading';



const WelcomeBanner: React.FC = () => {
    const { t } = useLanguage();
    return (
        <div className="bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500 rounded-2xl p-6 text-white mb-6">
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white dark:bg-slate-900/80/20 rounded-full flex items-center justify-center">
                    <User size={24} />
                </div>
                <div>
                    <div className="text-lg font-bold">{t('welcome.title')}! 👋</div>
                    <div className="text-sm text-white/80">{t('nav.assignments')}</div>
                </div>
            </div>
        </div>
    );
};

const STATUS_CONFIG: Record<string, { color: string; icon: React.FC<any>; label: string }> = {
    pending: { color: 'text-slate-400 bg-slate-100', icon: Clock, label: 'asg.pending' },
    submitted: { color: 'text-blue-500 bg-blue-50', icon: Send, label: 'asg.submitted' },
    completed: { color: 'text-emerald-500 bg-emerald-50', icon: CheckCircle2, label: 'asg.completed' },
    returned: { color: 'text-amber-500 bg-amber-50', icon: RotateCcw, label: 'asg.returned' },
};

const TYPE_BADGE: Record<string, { color: string }> = {
    worksheet: { color: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300' },
    companion: { color: 'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300' },
    custom: { color: 'bg-slate-100 text-slate-600 dark:text-slate-400 dark:bg-slate-700 dark:text-slate-400' },
};

const AssignmentsView: React.FC = () => {
    const { t, lang } = useLanguage();
    const user = useAuthStore(s => s.user);
    const authUserId = user?.id ?? '';
    const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
    const [assignments, setAssignments] = useState<(Assignment & { submission?: Submission })[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedAssignment, setSelectedAssignment] = useState<(Assignment & { submission?: Submission }) | null>(null);

    const load = useCallback(async () => {
        if (!authUserId) { setLoading(false); return; }
        setLoading(true);
        try {
            // Resolve auth user ID -> DB student record ID
            const profile = await edu.fetchStudentProfile(authUserId);
            if (profile) {
                const data = await edu.fetchStudentAssignments(profile.id);
                setAssignments(data);
            }
        } catch (err) {
            console.error('[AssignmentsView] load error:', err);
        } finally {
            setLoading(false);
        }
    }, [authUserId]);

    useEffect(() => { load(); }, [load]);

    const handleSubmit = async (assignmentId: string, answers?: any) => {
        const assignment = assignments.find(a => a.id === assignmentId);
        if (!assignment || !assignment.submission) return;
        await edu.upsertSubmission({
            id: assignment.submission.id,
            assignment_id: assignment.id,
            student_id: assignment.submission.student_id,
            status: 'submitted',
            content: answers || {},
            submitted_at: new Date().toISOString(),
        });
        setSelectedAssignment(null);
        await load();
    };

    const filtered = assignments.filter(a => {
        if (filter === 'all') return true;
        if (filter === 'pending') return !a.submission || a.submission.status === 'pending';
        if (filter === 'completed') return a.submission?.status === 'completed' || a.submission?.status === 'returned';
        return true;
    });

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-sky-500" size={28} /></div>;

    return (
        <div className="space-y-4">
            {/* Filter Pills */}
            <div className="flex gap-2">
                {(['all', 'pending', 'completed'] as const).map(f => (
                    <button key={f} onClick={() => setFilter(f)}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${filter === f
                            ? 'bg-sky-500 text-white shadow-md'
                            : 'bg-white dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 hover:border-sky-300'}`}>
                        {t(`asg.${f}`)}
                    </button>
                ))}
            </div>

            {/* Assignment Cards */}
            {filtered.length === 0 ? (
                <div className="text-center py-16">
                    <div className="text-4xl mb-3">📚</div>
                    <div className="text-slate-400">{filter === 'completed' ? t('asg.allDone') : t('asg.noAssignments')}</div>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(a => {
                        const sub = a.submission;
                        const status = sub?.status || 'pending';
                        const cfg = STATUS_CONFIG[status];
                        const StatusIcon = cfg.icon;
                        const typeBadge = TYPE_BADGE[a.content_type] || TYPE_BADGE.custom;
                        const isDue = a.due_date && new Date(a.due_date) < new Date() && status === 'pending';

                        return (
                            <div key={a.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 hover:shadow-md transition-all">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="font-bold text-slate-800 dark:text-white truncate">{a.title}</h4>
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeBadge.color}`}>
                                                {t(`asg.${a.content_type}`)}
                                            </span>
                                        </div>
                                        {a.description && <p className="text-sm text-slate-500 mb-2 line-clamp-2">{a.description}</p>}
                                        <div className="flex items-center gap-3 text-xs text-slate-400">
                                            {a.due_date && (
                                                <span className={isDue ? 'text-red-500 font-medium' : ''}>
                                                    {isDue ? '⚠ ' : ''}{t('asg.dueDate')}: {a.due_date}
                                                </span>
                                            )}
                                            <span>{new Date(a.created_at).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US')}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                                        <span className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${cfg.color}`}>
                                            <StatusIcon size={13} />
                                            {t(cfg.label)}
                                        </span>
                                        <button onClick={() => setSelectedAssignment(a)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold shadow-md transition-colors ${status === 'pending' ? 'bg-sky-500 hover:bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'}`}>
                                            {status === 'pending' ? t('asg.submit') : (lang === 'en' ? 'Review' : '查看')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {selectedAssignment && (
                <InteractiveAssignmentRenderer
                    assignment={selectedAssignment}
                    onClose={() => setSelectedAssignment(null)}
                    onSubmit={(answers) => handleSubmit(selectedAssignment.id, answers)}
                />
            )}
        </div>
    );
};

const ScheduleView: React.FC = () => {
    const { t, lang } = useLanguage();
    const user = useAuthStore(s => s.user);
    const [sessions, setSessions] = useState<ClassSession[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Students don't have sessions directly — would need a join through class_students
        // For now, show empty state
        setLoading(false);
    }, []);

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-sky-500" size={28} /></div>;

    return (
        <div className="text-center py-16">
            <div className="text-4xl mb-3">📅</div>
            <div className="text-slate-400">{t('sch.noClasses')}</div>
        </div>
    );
};

const AppContent: React.FC = () => {
    const [view, setView] = useState<View>('assignments');
    const { t, lang, setLang } = useLanguage();
    const user = useAuthStore(s => s.user);

    return (
        <ErrorBoundary>
            <AppLayout currentApp="student-portal" userName="Student">
                <div className="min-h-screen h-full w-full overflow-y-auto bg-slate-50 dark:bg-slate-950 dark:text-slate-300 flex flex-col">
                    <AppHeader
                        appName={lang === 'zh' ? '学生端通' : 'Student Portal'}
                        logoIcon={<GraduationCap className="w-5 h-5 text-white" />}
                        brand={{
                            logoBg: 'bg-gradient-to-br from-sky-400 to-blue-600',
                            activeBg: 'bg-sky-100 dark:bg-sky-500/20',
                            activeText: 'text-sky-700 dark:text-sky-300',
                        }}
                        tabs={[
                            { key: 'assignments', label: t('nav.assignments') as string, icon: <ClipboardList size={16} /> },
                            { key: 'schedule', label: t('nav.schedule') as string, icon: <CalendarDays size={16} /> },
                            { key: 'reading', label: (t('nav.reading') as string) || (lang === 'en' ? 'Reading' : '阅读'), icon: <BookOpen size={16} /> },
                        ]}
                        activeTab={view}
                        onTabChange={(key) => setView(key as View)}
                        rightContent={
                            <button onClick={() => setLang(lang === 'en' ? 'zh' : 'en')} className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                <Languages size={15} />
                                <span>{lang === 'en' ? '中文' : 'EN'}</span>
                            </button>
                        }
                        hideSignIn
                    />

                    <RouteGuard>
                        <main className="w-full mx-auto px-4 sm:px-6 py-6 space-y-6 flex-1" style={{ maxWidth: '1152px' }}>
                            <BodyContainer className="w-full">
                                <WelcomeBanner />
                                {view === 'assignments' && <AssignmentsView />}
                                {view === 'schedule' && <ScheduleView />}
                                {view === 'reading' && <ReadingView />}
                            </BodyContainer>
                        </main>
                    </RouteGuard>

                    <AppFooter appName="Student Portal" />
                </div>
            </AppLayout>
            <ToastContainer />
        </ErrorBoundary>
    );
};

export const App: React.FC = () => {
    return (
        <LanguageProvider>
            <AppContent />
        </LanguageProvider>
    );
};
