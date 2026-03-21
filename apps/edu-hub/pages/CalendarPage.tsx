import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuthStore } from '@shared/stores/useAuthStore';
import * as edu from '@pathway/education';
import type { EduClass, ClassSession, Student, Attendance, MakeupRequest } from '@pathway/education';
import {
    Plus, ChevronLeft, ChevronRight, X, Loader2, Clock,
    CalendarDays, CheckCircle2, XCircle, AlertCircle, Users, PhoneOff, AlertTriangle,
    Leaf, Layers, CalendarRange,
} from 'lucide-react';

// ── Date helpers ──
const DAY_MS = 86_400_000;
const fmt = (d: Date) => d.toISOString().split('T')[0];
const weekStart = (d: Date) => { const w = new Date(d); w.setDate(w.getDate() - w.getDay()); return w; };
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS);

const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_ZH = ['日', '一', '二', '三', '四', '五', '六'];

const STATUS_ICON: Record<string, React.FC<any>> = {
    present: CheckCircle2,
    absent: XCircle,
    late: AlertCircle,
    leave: PhoneOff,
};
const STATUS_COLOR: Record<string, string> = {
    present: 'text-emerald-500',
    absent: 'text-red-500',
    late: 'text-amber-500',
    leave: 'text-sky-500',
};

const CalendarPage: React.FC = () => {
    const { t, lang } = useLanguage();
    const user = useAuthStore(s => s.user);
    const teacherId = user?.id ?? '';

    // ── State ──
    const [currentDate, setCurrentDate] = useState(new Date());
    const [sessions, setSessions] = useState<ClassSession[]>([]);
    const [classes, setClasses] = useState<EduClass[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [classStudentMap, setClassStudentMap] = useState<Record<string, string[]>>({});
    const [loading, setLoading] = useState(true);

    const [showForm, setShowForm] = useState(false);
    const [editingSession, setEditingSession] = useState<ClassSession | null>(null);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ class_id: '', date: fmt(new Date()), start_time: '09:00', end_time: '10:00', topic: '', notes: '' });

    type TabType = 'single' | 'bulk' | 'nature-compass';
    const [activeTab, setActiveTab] = useState<TabType>('single');
    const [bulkForm, setBulkForm] = useState({ class_id: '', day_of_week: '1', first_date: fmt(new Date()), start_time: '18:00', end_time: '19:30', textbook: '', session_count: 10 });
    const [ncForm, setNcForm] = useState({ class_id: '', date: fmt(new Date()), start_time: '10:00', end_time: '12:00', theme: '', age_group: '7-9' });

    // Attendance panel
    const [activeSession, setActiveSession] = useState<ClassSession | null>(null);
    const [attendance, setAttendance] = useState<Attendance[]>([]);
    const [attendanceLoading, setAttendanceLoading] = useState(false);
    const [makeupRequests, setMakeupRequests] = useState<MakeupRequest[]>([]);

    const ws = useMemo(() => weekStart(currentDate), [currentDate]);
    const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(ws, i)), [ws]);

    // ── Load data ──
    const load = useCallback(async () => {
        if (!teacherId) { setLoading(false); return; }
        setLoading(true);
        const dateFrom = fmt(weekDays[0]);
        const dateTo = fmt(weekDays[6]);
        const [s, c, stu] = await Promise.all([
            edu.fetchSessions(teacherId, dateFrom, dateTo),
            edu.fetchClasses(teacherId),
            edu.fetchStudents(teacherId),
        ]);
        setSessions(s);
        setClasses(c);
        setStudents(stu);

        // Load class → student mappings
        const csMap: Record<string, string[]> = {};
        for (const cls of c) {
            const cs = await edu.fetchClassStudents(cls.id);
            csMap[cls.id] = cs.map(r => r.student_id);
        }
        setClassStudentMap(csMap);
        // Phase 5: load makeup requests
        const mr = await edu.fetchMakeupRequests(teacherId);
        setMakeupRequests(mr);
        setLoading(false);
    }, [teacherId, weekDays]);

    useEffect(() => { load(); }, [load]);

    // ── Session CRUD ──
    const handleSaveSession = async () => {
        if (!form.class_id || !form.date || !teacherId) return;
        // Phase 5: Conflict check
        const cw = checkConflicts(form.date, form.start_time, form.end_time, editingSession?.id);
        if (cw.length > 0 && !window.confirm(`⚠️ 检测到排课冲突:\n${cw.join('\n')}\n\n是否强制保存？`)) return;
        setSaving(true);
        const payload: any = {
            teacher_id: teacherId, class_id: form.class_id, date: form.date,
            start_time: form.start_time || null, end_time: form.end_time || null,
            topic: form.topic || null, notes: form.notes || null,
        };
        if (editingSession) payload.id = editingSession.id;
        await edu.upsertSession(payload);
        await load();
        resetForm();
        setSaving(false);
    };

    const resetForm = () => {
        setForm({ class_id: classes[0]?.id || '', date: fmt(new Date()), start_time: '09:00', end_time: '10:00', topic: '', notes: '' });
        setEditingSession(null);
        setShowForm(false);
    };

    const handleEditSession = (s: ClassSession) => {
        setForm({ class_id: s.class_id, date: s.date, start_time: s.start_time || '09:00', end_time: s.end_time || '10:00', topic: s.topic || '', notes: s.notes || '' });
        setEditingSession(s);
        setShowForm(true);
    };

    const handleDeleteSession = async (id: string) => {
        await edu.deleteSession(id);
        if (activeSession?.id === id) setActiveSession(null);
        await load();
    };

    // ── Attendance ──
    const openAttendance = async (session: ClassSession) => {
        setActiveSession(session);
        setAttendanceLoading(true);
        const att = await edu.fetchAttendance(session.id);
        setAttendance(att);
        setAttendanceLoading(false);
    };

    const toggleAttendance = async (sessionId: string, studentId: string) => {
        const existing = attendance.find(a => a.student_id === studentId);
        const cycle: Array<'present' | 'absent' | 'late' | 'leave'> = ['present', 'absent', 'late', 'leave'];
        const next = cycle[(cycle.indexOf(existing?.status || 'present') + 1) % cycle.length];
        const updated = attendance.filter(a => a.student_id !== studentId);
        const record: Attendance = { session_id: sessionId, student_id: studentId, status: next };
        updated.push(record);
        setAttendance(updated);
        await edu.upsertAttendance([record]);
        // Phase 5: auto-create makeup request when marking leave
        if (next === 'leave' && activeSession) {
            const existing = makeupRequests.find(m => m.student_id === studentId && m.original_session_id === sessionId);
            if (!existing) {
                const mr = await edu.createMakeupRequest({ student_id: studentId, teacher_id: teacherId, original_session_id: sessionId });
                if (mr) setMakeupRequests(prev => [mr, ...prev]);
            }
        }
        // Phase 6: auto-trigger attendance tokens (idempotent)
        const ATTENDANCE_POINTS: Record<string, number> = { present: 20, late: 10, leave: 0, absent: 0 };
        const pts = ATTENDANCE_POINTS[next] ?? 0;
        if (pts > 0) {
            edu.upsertTokenEvent({ student_id: studentId, source_type: 'attendance', source_id: `att_${sessionId}`, delta: pts });
        }
    };

    // ── Conflict Detection (Phase 5) ──
    const [conflicts, setConflicts] = useState<string[]>([]);

    /** Check if a time slot overlaps with existing sessions for the same teacher */
    const checkConflicts = (targetDate: string, startTime: string, endTime: string, excludeId?: string): string[] => {
        if (!startTime || !endTime) return [];
        const warnings: string[] = [];
        sessions
            .filter(s => s.date === targetDate && s.id !== excludeId && s.start_time && s.end_time)
            .forEach(s => {
                if (startTime < s.end_time! && s.start_time! < endTime) {
                    warnings.push(`教师时间冲突: ${className(s.class_id)} 在 ${s.start_time!.slice(0, 5)}-${s.end_time!.slice(0, 5)}`);
                }
            });
        return warnings;
    };

    /** Bulk preview: compute all dates for bulk form */
    const bulkPreviewDates = useMemo(() => {
        if (activeTab !== 'bulk' || !bulkForm.first_date || bulkForm.session_count < 1) return [];
        const dates: string[] = [];
        let cur = new Date(bulkForm.first_date);
        const dow = parseInt(bulkForm.day_of_week, 10);
        while (cur.getDay() !== dow) cur = addDays(cur, 1);
        for (let i = 0; i < bulkForm.session_count; i++) {
            dates.push(fmt(new Date(cur)));
            cur = addDays(cur, 7);
        }
        return dates;
    }, [activeTab, bulkForm.first_date, bulkForm.day_of_week, bulkForm.session_count]);


    // ── Navigation ──
    const prevWeek = () => setCurrentDate(addDays(currentDate, -7));
    const nextWeek = () => setCurrentDate(addDays(currentDate, 7));
    const goToday = () => setCurrentDate(new Date());

    const className = (classId: string) => classes.find(c => c.id === classId)?.name || '—';
    const studentName = (id: string) => students.find(s => s.id === id);
    const sessionStudents = (session: ClassSession) => (classStudentMap[session.class_id] || []).map(sid => studentName(sid)).filter(Boolean) as Student[];
    const weekdayNames = lang === 'zh' ? WEEKDAYS_ZH : WEEKDAYS_EN;

    if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-amber-500" size={28} /></div>;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">{t('cal.title')}</h2>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-0.5">
                        <button onClick={prevWeek} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md"><ChevronLeft size={16} /></button>
                        <button onClick={goToday} className="px-3 py-1 text-sm font-medium text-amber-600 hover:bg-amber-50 rounded-md">{t('cal.today')}</button>
                        <button onClick={nextWeek} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md"><ChevronRight size={16} /></button>
                    </div>
                    <button onClick={() => { setForm({ ...form, class_id: classes[0]?.id || '', date: fmt(new Date()) }); setShowForm(true); }}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl font-semibold text-sm hover:bg-amber-600 shadow-md">
                        <Plus size={16} /> {t('cal.addSession')}
                    </button>
                </div>
            </div>

            {/* Week label */}
            <div className="text-center text-sm font-medium text-slate-500">
                {weekDays[0].toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'long', day: 'numeric' })}
                {' — '}
                {weekDays[6].toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>

            {/* Session form */}
            {showForm && (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-amber-200 dark:border-amber-500/30 p-6 shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-slate-800 dark:text-white">{editingSession ? t('common.edit') : t('cal.addSession')}</h3>
                        <button onClick={resetForm} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">{t('nav.classes')}</label>
                            <select value={form.class_id} onChange={e => setForm({ ...form, class_id: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm">
                                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">{t('cal.date')}</label>
                            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">{t('cal.start')}</label>
                            <input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">{t('cal.end')}</label>
                            <input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" />
                        </div>
                    </div>
                    <div className="mt-4">
                        <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">{t('cal.topic')}</label>
                        <input value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })}
                            placeholder="Unit 3 — Animals"
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" />
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                        <button onClick={resetForm} className="px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 rounded-lg">{t('common.cancel')}</button>
                        <button onClick={handleSaveSession} disabled={saving}
                            className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 flex items-center gap-2">
                            {saving && <Loader2 size={14} className="animate-spin" />}
                            {t('common.save')}
                        </button>
                    </div>
                </div>
            )}

            {/* Week Grid */}
            <div className="grid grid-cols-7 gap-2">
                {weekDays.map((day, i) => {
                    const dayStr = fmt(day);
                    const isToday = dayStr === fmt(new Date());
                    const daySessions = sessions.filter(s => s.date === dayStr);

                    return (
                        <div key={dayStr} className={`min-h-[140px] rounded-xl border p-2 transition-all ${isToday
                            ? 'bg-amber-50 border-amber-300 dark:bg-amber-500/10 dark:border-amber-500/30'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                            {/* Day header */}
                            <div className="text-center mb-2">
                                <div className="text-xs text-slate-400">{weekdayNames[i]}</div>
                                <div className={`text-sm font-bold ${isToday ? 'text-amber-600' : 'text-slate-700 dark:text-slate-300'}`}>
                                    {day.getDate()}
                                </div>
                            </div>
                            {/* Sessions */}
                            {daySessions.map(s => (
                                <button key={s.id} onClick={() => openAttendance(s)}
                                    className={`w-full text-left mb-1 px-2 py-1.5 rounded-lg text-xs transition-all ${activeSession?.id === s.id
                                        ? 'bg-amber-500 text-white shadow-md'
                                        : 'bg-slate-100 dark:bg-slate-700 hover:bg-amber-100 dark:hover:bg-amber-500/20'}`}>
                                    <div className="font-semibold truncate">{className(s.class_id)}</div>
                                    {s.start_time && <div className="text-[10px] opacity-80 flex items-center gap-0.5"><Clock size={9} />{s.start_time.slice(0, 5)}</div>}
                                    {s.topic && <div className="truncate opacity-70 mt-0.5">{s.topic}</div>}
                                </button>
                            ))}
                            {/* Quick add */}
                            <button onClick={() => { setForm({ ...form, class_id: classes[0]?.id || '', date: dayStr }); setShowForm(true); }}
                                className="w-full mt-1 text-center text-xs text-slate-300 hover:text-amber-500 py-1 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors">
                                <Plus size={12} className="inline" />
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Attendance Panel */}
            {activeSession && (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <Users size={18} className="text-amber-500" />
                                {t('cal.attendance')} — {className(activeSession.class_id)}
                            </h3>
                            <div className="text-xs text-slate-400 mt-0.5">
                                {activeSession.date} {activeSession.start_time && `· ${activeSession.start_time.slice(0, 5)}`}
                                {activeSession.topic && ` · ${activeSession.topic}`}
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => handleEditSession(activeSession)} className="text-xs text-slate-400 hover:text-amber-500 px-2 py-1 rounded hover:bg-amber-50">{t('common.edit')}</button>
                            <button onClick={() => handleDeleteSession(activeSession.id)} className="text-xs text-slate-400 hover:text-red-500 px-2 py-1 rounded hover:bg-red-50">{t('common.delete')}</button>
                            <button onClick={() => setActiveSession(null)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
                        </div>
                    </div>

                    {attendanceLoading ? (
                        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-amber-500" size={24} /></div>
                    ) : (
                        <div className="space-y-2">
                            {sessionStudents(activeSession).length === 0 ? (
                                <div className="text-center py-8 text-slate-400 text-sm">{t('cal.noStudents')}</div>
                            ) : (
                                sessionStudents(activeSession).map(stu => {
                                    const att = attendance.find(a => a.student_id === stu.id);
                                    const status = att?.status || 'present';
                                    const StatusIcon = STATUS_ICON[status];
                                    return (
                                        <button key={stu.id} onClick={() => toggleAttendance(activeSession.id, stu.id)}
                                            className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center text-amber-700 dark:text-amber-300 font-bold text-sm">
                                                    {(stu.english_name?.[0] || stu.name[0]).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="font-medium text-sm text-slate-800 dark:text-white">{stu.name}</div>
                                                    {stu.english_name && <div className="text-xs text-slate-400">{stu.english_name}</div>}
                                                </div>
                                            </div>
                                            <div className={`flex items-center gap-1.5 ${STATUS_COLOR[status]}`}>
                                                <StatusIcon size={18} />
                                                <span className="text-sm font-medium capitalize">{t(`cal.${status}`)}</span>
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default CalendarPage;
