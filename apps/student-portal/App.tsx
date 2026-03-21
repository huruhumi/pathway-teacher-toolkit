import React, { useState, useEffect, useCallback } from 'react';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext';
import { useAuthStore } from '@pathway/platform';
import { AppFooter, AppHeader, AppLayout, BodyContainer, ErrorBoundary, PageLayout, RouteGuard, ToastContainer } from '@pathway/ui';
import type { Assignment, Submission, ClassSession } from '@pathway/education';
import {
    ClipboardList, CalendarDays, Languages, BookOpen,
    GraduationCap, User, Loader2, CheckCircle2, Clock,
    Send, RotateCcw, ChevronRight,
} from 'lucide-react';
import * as edu from '@pathway/education';
import { InteractiveAssignmentRenderer } from './components/InteractiveAssignmentRenderer';
import { ReadingView } from './components/ReadingView';
import { CoinAnimation } from './components/CoinAnimation';
import { UpNextWidget } from './components/UpNextWidget';
import { EmptyState } from './components/EmptyState';
import { RewardCenter } from './components/RewardCenter';
import { StudentLoginPage, ProfileStep } from './components/StudentLoginPage';

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
    assignment_sheet: { color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300' },
    essay: { color: 'bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300' },
};

const AssignmentsView: React.FC = () => {
    const { t, lang } = useLanguage();
    const user = useAuthStore(s => s.user);
    const authUserId = user?.id ?? '';
    const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
    const [assignments, setAssignments] = useState<(Assignment & { submission?: Submission })[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedAssignment, setSelectedAssignment] = useState<(Assignment & { submission?: Submission }) | null>(null);
    const [showCoins, setShowCoins] = useState(false);

    const load = useCallback(async () => {
        if (!authUserId) { setLoading(false); return; }
        setLoading(true);
        try {
            // Resolve auth user ID -> DB student record ID
            const profile = await edu.fetchStudentProfile(authUserId);
            if (profile) {
                const data = await edu.fetchStudentAssignmentsViaRPC(profile.id);
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
        try {
            // Check if it's a make-up submission (late or previously marked incomplete)
            const isLate = assignment.due_date && new Date(assignment.due_date).getTime() + 3 * 86400000 < new Date().getTime();
            const isMakeUp = assignment.submission.status === 'incomplete';
            const pointsToAward = (isLate || isMakeUp) ? 8 : 10;

            await edu.upsertSubmission({
                id: assignment.submission.id,
                assignment_id: assignment.id,
                student_id: assignment.submission.student_id,
                status: 'submitted',
                content: answers || {},
                submitted_at: new Date().toISOString(),
            });

            // Give baseline or make-up points for finishing + trigger animation
            await edu.awardPoints(assignment.submission.id, pointsToAward);

            // Reload profile data to get updated points
            const profile = await edu.fetchStudentProfile(authUserId);
            if (profile) {
                // Not ideal, but we get the updated points balance this way
                // since App.tsx loads point tracking logic below
            }
            setShowCoins(true);
        } catch (e) {
            console.error('Error submitting:', e);
        }

        setSelectedAssignment(null);
        await load(); // re-fetches assignments
    };

    const filtered = assignments.filter(a => {
        const status = a.submission?.status || 'pending';
        // Check if overdue (passed due date by 3 days grace period)
        const isOverdue = a.due_date && new Date(a.due_date).getTime() + 3 * 86400000 < new Date().getTime();
        const isActive = (status === 'pending' || status === 'returned') && !isOverdue;

        if (filter === 'all') return true;
        if (filter === 'pending') return isActive;
        if (filter === 'completed') return status === 'completed' || status === 'submitted' || status === 'incomplete' || (!isActive && status === 'pending');
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

            {/* Up Next Action Center */}
            {(filter === 'all' || filter === 'pending') && (
                <UpNextWidget assignments={assignments} onStart={setSelectedAssignment} />
            )}

            {/* Assignment Cards */}
            {filtered.length === 0 ? (
                <EmptyState type={filter === 'completed' ? 'all-clear' : 'no-assignments'} />
            ) : (
                <div className="space-y-3">
                    {filtered.map(a => {
                        const sub = a.submission;
                        const status = sub?.status || 'pending';
                        const cfg = STATUS_CONFIG[status];
                        const StatusIcon = cfg.icon;
                        const typeBadge = TYPE_BADGE[a.content_type] || TYPE_BADGE.custom;
                        const isDue = a.due_date && new Date(a.due_date) < new Date() && status === 'pending';
                        const isOverdue = a.due_date && new Date(a.due_date).getTime() + 3 * 86400000 < new Date().getTime();

                        // Overdue pending assignments or teacher-marked incomplete assignments appear as Missed/Make-up
                        const isMissed = (isOverdue && status === 'pending') || status === 'incomplete';
                        const isLocked = false; // Never fully lock, always allow make-up
                        const cardStyles = isMissed
                            ? "bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-200 dark:border-amber-800 p-4 hover:shadow-md transition-all cursor-pointer hover:border-amber-400"
                            : "bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 hover:shadow-md transition-all cursor-pointer hover:border-sky-300";

                        // Companion progress
                        let completionText = '';
                        if (a.content_type === 'companion' && a.submission?.content) {
                            const daysContent = a.submission.content || {};
                            const completedDays = Object.values(daysContent).filter((d: any) => d?.completed).length;
                            completionText = `${completedDays}/7 ${lang === 'zh' ? '天已完成' : 'Days done'}`;
                        }

                        return (
                            <div
                                key={a.id}
                                className={cardStyles}
                                onClick={() => !isLocked && setSelectedAssignment(a)}
                                role={isLocked ? undefined : "button"}
                                tabIndex={isLocked ? -1 : 0}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="font-bold text-slate-800 dark:text-white truncate">
                                                {isLocked && <span className="mr-1">🔒</span>}
                                                {a.title}
                                            </h4>
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeBadge.color}`}>
                                                {t(`asg.${a.content_type}`)}
                                            </span>
                                        </div>
                                        {a.description && <p className="text-sm text-slate-500 mb-2 line-clamp-2">{a.description}</p>}
                                        <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                                            {a.due_date && (
                                                <span className={isDue && !isLocked ? 'text-red-500 font-medium' : ''}>
                                                    {isLocked ? '❌ ' : (isDue ? '⚠ ' : '')}{t('asg.dueDate')}: {a.due_date}
                                                </span>
                                            )}
                                            <span>{new Date(a.created_at).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US')}</span>
                                            {completionText && (
                                                <span className="text-sky-600 dark:text-sky-400 font-medium bg-sky-50 dark:bg-sky-500/10 px-1.5 py-0.5 rounded">
                                                    {completionText}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                                        <span className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${isMissed ? 'text-amber-600 bg-amber-100 dark:bg-amber-900/40' : cfg.color}`}>
                                            <StatusIcon size={13} />
                                            {isMissed ? (lang === 'en' ? 'Late Make-up' : '可补交 (80%分)') : t(cfg.label)}
                                        </span>
                                        {!isLocked && (
                                            <button onClick={(e) => { e.stopPropagation(); setSelectedAssignment(a); }}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold shadow-md transition-colors ${(status === 'pending' || isMissed) ? 'bg-sky-500 hover:bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'}`}>
                                                {(status === 'pending' && !isMissed) ? (t('asg.go') || (lang === 'zh' ? '去完成' : 'Go')) : (isMissed ? (lang === 'zh' ? '去补交' : 'Make Up') : (lang === 'en' ? 'Review' : '查看'))}
                                            </button>
                                        )}
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

            {/* Gamification Coins overlay */}
            {showCoins && <CoinAnimation onComplete={async () => {
                setShowCoins(false);
                // Hard refresh app to update point balances from Profile
                await load();
            }} />}
        </div>
    );
};

const ScheduleView: React.FC = () => {
    const { t, lang } = useLanguage();
    const user = useAuthStore(s => s.user);
    const authUserId = user?.id ?? '';
    const [sessions, setSessions] = useState<any[]>([]);
    const [assignments, setAssignments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
    const [selectedStep, setSelectedStep] = useState<number>(0);

    const fetchData = async () => {
        if (!authUserId) { setLoading(false); return; }
        setLoading(true);
        try {
            const profile = await edu.fetchStudentProfile(authUserId);
            if (profile) {
                const [sessData, asgsData] = await Promise.all([
                    edu.fetchStudentSessions(profile.id),
                    edu.fetchStudentAssignments(profile.id)
                ]);
                setSessions(sessData);
                setAssignments(asgsData);
            }
        } catch (err) {
            console.error('[ScheduleView] load error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [authUserId]);

    const handleSubmit = async (assignmentId: string, answers: any) => {
        try {
            const a = assignments.find(x => x.id === assignmentId);
            if (!a) return;
            const profile = await edu.fetchStudentProfile(authUserId);
            const subId = a.submission?.id;

            await edu.upsertSubmission({
                ...(subId ? { id: subId } : {}),
                assignment_id: assignmentId,
                student_id: profile?.id || '',
                status: 'submitted',
                content: answers,
                submitted_at: new Date().toISOString()
            });
            await fetchData();
            setSelectedAssignment(null);
        } catch (err) {
            console.error('Submit error:', err);
            alert(lang === 'en' ? 'Failed to submit' : '提交失败，请重试');
        }
    };

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-sky-500" size={28} /></div>;

    if (sessions.length === 0 && assignments.length === 0) {
        return (
            <div className="text-center py-16">
                <div className="text-4xl mb-3">📅</div>
                <div className="text-slate-400">{t('sch.noClasses')}</div>
            </div>
        );
    }

    // Group sessions & tasks by date
    const grouped: Record<string, any[]> = {};

    sessions.forEach(s => {
        const key = s.date;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push({ _type: 'session', ...s });
    });

    assignments.forEach(a => {
        if (a.content_type === 'companion') {
            const comp = a.content_data as any;
            const days = comp.days || [];
            if (!days.length) return;

            const startDate = new Date(a.created_at);
            days.forEach((day: any, i: number) => {
                const actualDate = new Date(startDate.getTime() + i * 86400000);
                const yy = actualDate.getFullYear();
                const mm = String(actualDate.getMonth() + 1).padStart(2, '0');
                const dd = String(actualDate.getDate()).padStart(2, '0');
                const key = `${yy}-${mm}-${dd}`;

                if (!grouped[key]) grouped[key] = [];
                grouped[key].push({
                    _type: 'companion_task',
                    id: `${a.id}_day${i}`,
                    assignment: a,
                    dayIndex: i,
                    dayData: day,
                    start_time: '00:00' // sort companion tasks to the top of the day
                });
            });
        }
    });

    // Sort dates
    const sortedDates = Object.keys(grouped).sort();

    const formatDate = (d: string) => {
        const date = new Date(d + 'T00:00:00');
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
        if (date.getTime() === today.getTime()) return lang === 'zh' ? '今天' : 'Today';
        if (date.getTime() === tomorrow.getTime()) return lang === 'zh' ? '明天' : 'Tomorrow';
        return date.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    };

    return (
        <div className="space-y-6">
            {sortedDates.map((date) => {
                const items = grouped[date].sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));

                return (
                    <div key={date}>
                        <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">{formatDate(date)}</h3>
                        <div className="space-y-2">
                            {items.map((item: any) => {
                                if (item._type === 'session') {
                                    return (
                                        <div key={item.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
                                            <div className="w-12 h-12 rounded-xl bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center text-sky-600 dark:text-sky-400 font-bold text-sm shrink-0">
                                                {item.start_time ? item.start_time.slice(0, 5) : '—'}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-semibold text-slate-800 dark:text-white truncate">{item.class?.name || '—'}</div>
                                                <div className="text-xs text-slate-400 mt-0.5">
                                                    {item.start_time && item.end_time ? `${item.start_time.slice(0, 5)} – ${item.end_time.slice(0, 5)}` : ''}
                                                    {item.topic && <span className="ml-2">• {item.topic}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                } else if (item._type === 'companion_task') {
                                    const a = item.assignment;
                                    const status = a.submission?.status || 'pending';
                                    const isOverdue = a.due_date && new Date(a.due_date).getTime() + 3 * 86400000 < new Date().getTime();
                                    const isMissed = (isOverdue && status === 'pending') || status === 'incomplete';

                                    const isSubCompleted = a.submission?.status === 'completed' || a.submission?.status === 'submitted';
                                    const dayCompleted = a.submission?.content?.[`d${item.dayIndex}_t0`] === true; // Simplify day completed check
                                    const isDone = isSubCompleted || dayCompleted;

                                    return (
                                        <div
                                            key={item.id}
                                            className={`rounded-xl border p-4 flex items-center gap-4 transition-all cursor-pointer ${isDone ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 hover:border-emerald-300 dark:border-emerald-800/30' : (isMissed ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-indigo-300 hover:shadow-md')}`}
                                            onClick={() => {
                                                setSelectedStep(item.dayIndex);
                                                setSelectedAssignment(a);
                                            }}
                                        >
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${isDone ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : (isMissed ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400' : 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400')}`}>
                                                {isDone ? <CheckCircle2 size={20} /> : <BookOpen size={20} />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <div className={`font-bold truncate ${isDone ? 'text-emerald-800 dark:text-emerald-200' : (isMissed ? 'text-amber-800 dark:text-amber-400' : 'text-slate-800 dark:text-white')}`}>
                                                        {a.title} - Day {item.dayIndex + 1}
                                                    </div>
                                                    <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${isDone ? 'bg-emerald-200 text-emerald-800 dark:bg-emerald-700 dark:text-emerald-200' : (isMissed ? 'bg-amber-200 text-amber-800 dark:bg-amber-900 dark:text-amber-400' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300')}`}>
                                                        {isMissed ? 'Late Make-up' : (isDone ? 'Done' : 'Task')}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                                                    {item.dayData?.focus || 'Reading Companion'}
                                                </div>
                                            </div>
                                            <div className="shrink-0 text-slate-300 dark:text-slate-600">
                                                <ChevronRight size={20} />
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            })}
                        </div>
                    </div>
                );
            })}

            {selectedAssignment && (
                <InteractiveAssignmentRenderer
                    assignment={selectedAssignment}
                    initialStep={selectedStep}
                    onClose={() => { setSelectedAssignment(null); setSelectedStep(0); }}
                    onSubmit={(answers) => handleSubmit(selectedAssignment.id, answers)}
                />
            )}
        </div>
    );
};

const AppContent: React.FC = () => {
    const [view, setView] = useState<View>('assignments');
    const { t, lang, setLang } = useLanguage();
    const user = useAuthStore(s => s.user);
    const isStandalone = import.meta.env.BASE_URL === '/';
    const [pointsBalance, setPointsBalance] = useState<number | undefined>();
    const [studentId, setStudentId] = useState<string>('');
    const [isRewardCenterOpen, setIsRewardCenterOpen] = useState(false);
    // After activation: show profile setup overlay
    const [profileSetupStudentId, setProfileSetupStudentId] = useState<string | null>(
        () => sessionStorage.getItem('pathway_needs_profile')
    );

    // Fetch student profile and real token balance
    useEffect(() => {
        if (!user?.id) return;
        edu.fetchStudentProfile(user.id).then(async (p) => {
            if (p) {
                setStudentId(p.id);
                const bal = await edu.getTokenBalance(p.id);
                setPointsBalance(bal);
            }
        });
    }, [user?.id]);

    const Wrapper = isStandalone
        ? ({ children }: { children: React.ReactNode }) => <>{children}</>
        : ({ children }: { children: React.ReactNode }) => <AppLayout currentApp="student-portal" userName="Student">{children}</AppLayout>;

    // When profile setup overlay is needed
    if (profileSetupStudentId) {
        const dismissProfile = () => {
            sessionStorage.removeItem('pathway_needs_profile');
            setProfileSetupStudentId(null);
        };
        return (
            <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
                <div className="w-full max-w-md bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/60 dark:border-white/10 p-6">
                    <p className="text-xs font-bold tracking-widest text-sky-500 uppercase mb-4 text-center">Pathway Academy · 学生平台</p>
                    <ProfileStep
                        studentId={profileSetupStudentId}
                        studentName=""
                        onDone={dismissProfile}
                    />
                </div>
            </div>
        );
    }

    return (
        <ErrorBoundary>
            <Wrapper>
                <div className="min-h-screen h-full w-full overflow-y-auto bg-slate-50 dark:bg-slate-950 dark:text-slate-300 flex flex-col">
                    <AppHeader
                        appName={<span className="flex flex-col leading-tight"><span className="text-xs font-bold tracking-wide">Pathway Academy</span><span className="text-[10px] font-medium opacity-70 uppercase tracking-widest">Student</span></span>}
                        logoIcon={<img src={`${import.meta.env.BASE_URL}assets/logo.png`} alt="Pathway Academy" className="w-7 h-7 object-contain" />}
                        brand={{
                            logoBg: 'bg-white',
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
                        pointsBalance={pointsBalance}
                        onPointsClick={() => setIsRewardCenterOpen(true)}
                    />

                    <RouteGuard>
                        <main className="w-full mx-auto px-4 sm:px-6 py-6 space-y-6 flex-1 max-w-6xl">
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

                {isRewardCenterOpen && studentId && (
                    <RewardCenter pointsBalance={pointsBalance || 0} studentId={studentId} onClose={() => setIsRewardCenterOpen(false)} onBalanceChange={setPointsBalance} />
                )}
            </Wrapper>
            <ToastContainer />
        </ErrorBoundary>
    );
};

/** Guards standalone student portal — shows login page if unauthenticated */
const AuthGate: React.FC = () => {
    const isStandalone = import.meta.env.BASE_URL === '/';
    const { isInitialized, user } = useAuthStore();
    if (isStandalone && isInitialized && !user) return <StudentLoginPage />;
    return <AppContent />;
};

export const App: React.FC = () => (
    <LanguageProvider>
        <AuthGate />
    </LanguageProvider>
);
