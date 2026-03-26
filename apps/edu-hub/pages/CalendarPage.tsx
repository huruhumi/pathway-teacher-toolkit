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
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS);
const getMonthGrid = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const start = new Date(firstDay);
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
};

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
    const [bulkForm, setBulkForm] = useState({ class_id: '', day_of_week: '1', first_date: fmt(new Date()), start_time: '18:00', end_time: '19:30', session_count: 20 });

    // Bulk Deduct
    const [showBulkDeduct, setShowBulkDeduct] = useState(false);
    const [selectedDeductStudents, setSelectedDeductStudents] = useState<Record<string, boolean>>({});
    const [isDeducting, setIsDeducting] = useState(false);

    // Attendance panel
    const [activeSession, setActiveSession] = useState<ClassSession | null>(null);
    const [attendance, setAttendance] = useState<Attendance[]>([]);
    const [attendanceLoading, setAttendanceLoading] = useState(false);
    const [makeupRequests, setMakeupRequests] = useState<MakeupRequest[]>([]);

    const monthDays = useMemo(() => getMonthGrid(currentDate), [currentDate]);

    // ── Load data ──
    const load = useCallback(async () => {
        if (!teacherId) { setLoading(false); return; }
        setLoading(true);
        const dateFrom = fmt(monthDays[0]);
        const dateTo = fmt(monthDays[41]);
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
        const mr = await edu.fetchMakeupRequests(teacherId);
        setMakeupRequests(mr);
        setLoading(false);
    }, [teacherId, monthDays]);

    useEffect(() => { load(); }, [load]);

    // ── Session CRUD ──
    const handleSaveSession = async () => {
        if (activeTab === 'single') {
            if (!form.class_id || !form.date || !teacherId) return;
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
        } else if (activeTab === 'bulk') {
            if (!bulkForm.class_id || !bulkForm.first_date || !teacherId) return;
            setSaving(true);
            const dates = bulkPreviewDates;
            if (dates.length === 0) {
                alert('No valid dates determined for bulk add.');
                setSaving(false);
                return;
            }
            const payloadArray = dates.map(d => ({
                teacher_id: teacherId, class_id: bulkForm.class_id, date: d,
                start_time: bulkForm.start_time || null, end_time: bulkForm.end_time || null
            }));
            // Use bulk insert from Supabase mapping
            await edu.upsertSessions(payloadArray);
        }
        await load();
        resetForm();
        setSaving(false);
    };

    const resetForm = () => {
        setForm({ class_id: classes[0]?.id || '', date: fmt(new Date()), start_time: '09:00', end_time: '10:00', topic: '', notes: '' });
        setBulkForm({ class_id: classes[0]?.id || '', day_of_week: '1', first_date: fmt(new Date()), start_time: '18:30', end_time: '19:30', session_count: 20 });
        setEditingSession(null);
        setActiveTab('single');
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
        if (next === 'leave' && activeSession) {
            const existing = makeupRequests.find(m => m.student_id === studentId && m.original_session_id === sessionId);
            if (!existing) {
                const mr = await edu.createMakeupRequest({ student_id: studentId, teacher_id: teacherId, original_session_id: sessionId });
                if (mr) setMakeupRequests(prev => [mr, ...prev]);
            }
        }
        const ATTENDANCE_POINTS: Record<string, number> = { present: 20, late: 10, leave: 0, absent: 0 };
        const pts = ATTENDANCE_POINTS[next] ?? 0;
        if (pts > 0) {
            edu.upsertTokenEvent({ student_id: studentId, source_type: 'attendance', source_id: `att_${sessionId}`, delta: pts });
        }
    };

    // ── Bulk Deduct (Phase 5) ──
    const openBulkDeduct = () => {
        // Preselect students who are 'present' or 'late'
        const preselected: Record<string, boolean> = {};
        sessionStudents(activeSession!).forEach(stu => {
            const att = attendance.find(a => a.student_id === stu.id);
            const status = att?.status || 'present'; // Default to present if unrecorded
            if (status === 'present' || status === 'late') {
                preselected[stu.id] = true;
            } else {
                preselected[stu.id] = false;
            }
        });
        setSelectedDeductStudents(preselected);
        setShowBulkDeduct(true);
    };

    const confirmBulkDeduct = async () => {
        if (!activeSession) return;
        setIsDeducting(true);
        try {
            const selectedIds = Object.entries(selectedDeductStudents).filter(([_, checked]) => checked).map(([id]) => id);
            for (const sid of selectedIds) {
                // Find student's active package and deduct
                const pkgs = await edu.fetchStudentPackages(sid);
                const activePkg = pkgs.find(p => p.status === 'active' && p.used_classes < p.total_classes);
                if (activePkg) {
                    await edu.manualClassDeduction({
                        student_id: sid,
                        package_id: activePkg.id,
                        session_id: activeSession.id,
                        deduction_amount: 1,
                        deduction_type: 'manual_adjustment',
                        notes: `Bulk deduction for session: ${activeSession.topic || activeSession.date}`
                    });
                }
            }
            alert(zh ? `成功录入 ${selectedIds.length} 名学生的按次划消` : `Successfully deducted classes for ${selectedIds.length} students`);
            setShowBulkDeduct(false);
        } catch (e) {
            console.error(e);
        } finally {
            setIsDeducting(false);
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
    const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    const goToday = () => setCurrentDate(new Date());

    const className = (classId: string) => classes.find(c => c.id === classId)?.name || '—';
    const studentName = (id: string) => students.find(s => s.id === id);
    const sessionStudents = (session: ClassSession) => (classStudentMap[session.class_id] || []).map(sid => studentName(sid)).filter(Boolean) as Student[];
    const weekdayNames = lang === 'zh' ? WEEKDAYS_ZH : WEEKDAYS_EN;
    const zh = lang === 'zh';

    if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-amber-500" size={28} /></div>;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">{t('cal.title')}</h2>
                <div className="flex items-center gap-4">
                    <div className="text-center font-bold text-slate-700 dark:text-slate-300">
                        {currentDate.toLocaleDateString(zh ? 'zh-CN' : 'en-US', { month: 'long', year: 'numeric' })}
                    </div>
                    <div className="flex items-center gap-1 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-0.5">
                        <button onClick={prevMonth} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md"><ChevronLeft size={16} /></button>
                        <button onClick={goToday} className="px-3 py-1 text-sm font-medium text-amber-600 hover:bg-amber-50 rounded-md">{t('cal.today')}</button>
                        <button onClick={nextMonth} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md"><ChevronRight size={16} /></button>
                    </div>
                    <button onClick={() => { setForm({ ...form, class_id: classes[0]?.id || '', date: fmt(new Date()) }); setBulkForm(p => ({ ...p, class_id: classes[0]?.id || '' })); setShowForm(true); }}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl font-semibold text-sm hover:bg-amber-600 shadow-md">
                        <Plus size={16} /> {t('cal.addSession')}
                    </button>
                </div>
            </div>

            {/* Session form */}
            {showForm && (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-amber-200 dark:border-amber-500/30 p-6 shadow-lg mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-slate-800 dark:text-white">{editingSession ? t('common.edit') : t('cal.addSession')}</h3>
                        <div className="flex gap-4 items-center">
                            {!editingSession && (
                                <div className="flex p-0.5 bg-slate-100 dark:bg-slate-700 rounded-lg">
                                    <button onClick={() => setActiveTab('single')} className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${activeTab === 'single' ? 'bg-white dark:bg-slate-800 text-amber-600 shadow-sm' : 'text-slate-500'}`}>单次 (Single)</button>
                                    <button onClick={() => setActiveTab('bulk')} className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${activeTab === 'bulk' ? 'bg-white dark:bg-slate-800 text-amber-600 shadow-sm' : 'text-slate-500'}`}>批量 (Bulk)</button>
                                </div>
                            )}
                            <button onClick={resetForm} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                        </div>
                    </div>
                    {activeTab === 'single' ? (
                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
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
                            <div className="lg:col-span-1 col-span-2">
                                <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">{t('cal.topic')}</label>
                                <input value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })}
                                    placeholder="Unit 3 — Animals"
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" />
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">{t('nav.classes')}</label>
                                    <select value={bulkForm.class_id} onChange={e => setBulkForm({ ...bulkForm, class_id: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm">
                                        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">{zh ? '第一节课日期' : 'First Class Date'}</label>
                                    <input type="date" value={bulkForm.first_date} onChange={e => setBulkForm({ ...bulkForm, first_date: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">{zh ? '星期几' : 'Day of Week'}</label>
                                    <select value={bulkForm.day_of_week} onChange={e => setBulkForm({ ...bulkForm, day_of_week: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm">
                                        <option value="0">{zh ? '星期日' : 'Sunday'}</option>
                                        <option value="1">{zh ? '星期一' : 'Monday'}</option>
                                        <option value="2">{zh ? '星期二' : 'Tuesday'}</option>
                                        <option value="3">{zh ? '星期三' : 'Wednesday'}</option>
                                        <option value="4">{zh ? '星期四' : 'Thursday'}</option>
                                        <option value="5">{zh ? '星期五' : 'Friday'}</option>
                                        <option value="6">{zh ? '星期六' : 'Saturday'}</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">{zh ? '总排节数' : '# of Sessions'}</label>
                                    <input type="number" value={bulkForm.session_count} onChange={e => setBulkForm({ ...bulkForm, session_count: Number(e.target.value) })}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">{t('cal.start')}</label>
                                    <input type="time" value={bulkForm.start_time} onChange={e => setBulkForm({ ...bulkForm, start_time: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">{t('cal.end')}</label>
                                    <input type="time" value={bulkForm.end_time} onChange={e => setBulkForm({ ...bulkForm, end_time: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" />
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-100 dark:border-slate-700">
                        {activeTab === 'bulk' ? (
                            <div className="text-xs text-slate-400">
                                {bulkPreviewDates.length > 0 && `${zh ? '将生成' : 'Will generate'} ${bulkPreviewDates.length} ${zh ? '节排课，从' : 'sessions, from'} ${bulkPreviewDates[0]}`}
                            </div>
                        ) : <div />}
                        <div className="flex gap-2 text-right">
                            <button onClick={resetForm} className="px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 rounded-lg">{t('common.cancel')}</button>
                            <button onClick={handleSaveSession} disabled={saving}
                                className="px-5 py-2 bg-amber-500 text-white rounded-lg text-sm font-bold hover:bg-amber-600 disabled:opacity-50 flex items-center gap-2 shadow-md">
                                {saving && <Loader2 size={14} className="animate-spin" />}
                                {activeTab === 'bulk' ? (zh ? `批量添加 (${bulkPreviewDates.length})` : `Bulk Add (${bulkPreviewDates.length})`) : t('common.save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Month Grid */}
            <div className="grid grid-cols-7 gap-1 md:gap-2">
                {/* Day of week headers */}
                {weekdayNames.map(wd => (
                    <div key={wd} className="text-center text-xs font-bold text-slate-400 py-1">{wd}</div>
                ))}

                {monthDays.map((day, i) => {
                    const dayStr = fmt(day);
                    const isToday = dayStr === fmt(new Date());
                    const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                    const daySessions = sessions.filter(s => s.date === dayStr);

                    return (
                        <div key={dayStr} className={`min-h-[100px] md:min-h-[120px] rounded-lg md:rounded-xl border p-1 md:p-2 transition-all ${isToday
                            ? 'bg-amber-50 border-amber-300 dark:bg-amber-500/10 dark:border-amber-500/30 shadow-sm'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'} ${!isCurrentMonth ? 'opacity-50' : ''}`}>
                            {/* Day header */}
                            <div className="flex justify-between items-center mb-1 md:mb-2">
                                <div className={`text-xs md:text-sm font-bold ${isToday ? 'text-amber-600 bg-amber-100 dark:bg-amber-500/20 px-1.5 rounded-full' : 'text-slate-700 dark:text-slate-300'}`}>
                                    {day.getDate()}
                                    {day.getDate() === 1 && ` ${day.toLocaleDateString(zh ? 'zh-CN' : 'en-US', { month: 'short' })}`}
                                </div>
                                <button onClick={() => { setForm({ ...form, class_id: classes[0]?.id || '', date: dayStr }); setShowForm(true); }}
                                    className="text-slate-300 hover:text-amber-500 p-0.5 rounded-md hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors">
                                    <Plus size={14} />
                                </button>
                            </div>
                            {/* Sessions */}
                            <div className="space-y-1">
                                {daySessions.map(s => (
                                    <button key={s.id} onClick={() => openAttendance(s)}
                                        className={`w-full text-left px-1.5 py-1 rounded-md text-[10px] md:text-xs transition-all ${activeSession?.id === s.id
                                            ? 'bg-amber-500 text-white shadow-md'
                                            : 'bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 hover:bg-amber-100 dark:hover:bg-amber-500/20'}`}>
                                        <div className="font-bold truncate">{className(s.class_id)}</div>
                                        {s.start_time && <div className="opacity-80 flex items-center gap-0.5 mt-[1px] font-medium"><Clock size={9} />{s.start_time.slice(0, 5)}</div>}
                                    </button>
                                ))}
                            </div>
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
                        <div className="flex items-center justify-between mt-4 md:mt-0 gap-2">
                            <button onClick={openBulkDeduct} className="flex-1 md:flex-none text-xs text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 px-3 py-1.5 rounded-lg text-center transition-colors">
                                {zh ? '批量销课 (Bulk Deduct)' : 'Bulk Deduct'}
                            </button>
                            <div className="flex gap-2 shrink-0">
                                <button onClick={() => handleEditSession(activeSession)} className="text-xs text-amber-600 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-lg font-semibold">{t('common.edit')}</button>
                                <button onClick={() => handleDeleteSession(activeSession.id)} className="text-xs text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-lg font-semibold">{t('common.delete')}</button>
                                <button onClick={() => setActiveSession(null)} className="text-slate-400 hover:text-slate-600 p-1"><X size={18} /></button>
                            </div>
                        </div>
                    </div>

                    {attendanceLoading ? (
                        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-amber-500" size={24} /></div>
                    ) : (
                        <div className="space-y-2 grid grid-cols-1 md:grid-cols-2 gap-2 mt-4">
                            {sessionStudents(activeSession).length === 0 ? (
                                <div className="col-span-full text-center py-8 text-slate-400 text-sm">{t('cal.noStudents')}</div>
                            ) : (
                                sessionStudents(activeSession).map(stu => {
                                    const att = attendance.find(a => a.student_id === stu.id);
                                    const status = att?.status || 'present';
                                    const StatusIcon = STATUS_ICON[status];
                                    return (
                                        <button key={stu.id} onClick={() => toggleAttendance(activeSession.id, stu.id)}
                                            className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-700/50 hover:border-amber-200 dark:hover:border-amber-500/50 hover:shadow-sm bg-slate-50 dark:bg-slate-700/30 transition-all text-left">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center text-amber-700 dark:text-amber-300 font-bold">
                                                    {(stu.english_name?.[0] || stu.name[0]).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-800 dark:text-white">{stu.name}</div>
                                                    {stu.english_name && <div className="text-xs text-slate-400">{stu.english_name}</div>}
                                                </div>
                                            </div>
                                            <div className={`flex flex-col items-center ${STATUS_COLOR[status]}`}>
                                                <StatusIcon size={20} />
                                                <span className="text-[10px] font-bold uppercase mt-1 tracking-wider">{t(`cal.${status}`)}</span>
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Bulk Deduct Modal */}
            {showBulkDeduct && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <h3 className="font-bold flex items-center gap-2"><CheckCircle2 className="text-emerald-500" size={18} /> {zh ? '确认批量手动销课' : 'Confirm Bulk Deduct'}</h3>
                            <button onClick={() => setShowBulkDeduct(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                        </div>
                        <div className="overflow-y-auto p-4 space-y-2 flex-1">
                            <p className="text-xs text-slate-500 mb-4">{zh ? '只列出了该班级包含的学生。默认已勾选在此次签到中标记为【出勤】或【迟到】的学生。' : 'Only lists students in this class. Evaluated present or late students are pre-checked.'}</p>
                            {sessionStudents(activeSession!).map(stu => (
                                <label key={stu.id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                    <input type="checkbox" className="w-4 h-4 text-emerald-600 rounded"
                                        checked={!!selectedDeductStudents[stu.id]}
                                        onChange={(e) => setSelectedDeductStudents(p => ({ ...p, [stu.id]: e.target.checked }))} />
                                    <div className="text-sm font-semibold">{stu.name} {stu.english_name && <span className="text-slate-400 font-normal">({stu.english_name})</span>}</div>
                                </label>
                            ))}
                        </div>
                        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
                            <div className="text-xs font-semibold text-slate-500">{zh ? `已选 ${Object.values(selectedDeductStudents).filter(Boolean).length} 人` : `${Object.values(selectedDeductStudents).filter(Boolean).length} selected`}</div>
                            <div className="flex gap-2">
                                <button onClick={() => setShowBulkDeduct(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg">{t('common.cancel')}</button>
                                <button onClick={confirmBulkDeduct} disabled={isDeducting || Object.values(selectedDeductStudents).filter(Boolean).length === 0}
                                    className="px-5 py-2 bg-emerald-500 text-white rounded-lg text-sm font-bold hover:bg-emerald-600 shadow-md disabled:opacity-50 flex items-center gap-2">
                                    {isDeducting && <Loader2 size={14} className="animate-spin" />}
                                    {zh ? '确认划消' : 'Confirm'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CalendarPage;
