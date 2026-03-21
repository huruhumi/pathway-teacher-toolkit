import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuthStore } from '@shared/stores/useAuthStore';
import * as edu from '@pathway/education';
import type { Assignment, Submission, EduClass, Student } from '@pathway/education';
import {
    Plus, Edit3, Trash2, X, Loader2, ClipboardList,
    CheckCircle2, Clock, Send, RotateCcw, ChevronDown, ChevronUp, Users, MessageSquare,
    LayoutList, Grid
} from 'lucide-react';
import { TeacherSubmissionViewer } from '../components/TeacherSubmissionViewer';

const STATUS_CONFIG: Record<string, { color: string; icon: React.FC<any>; bg: string }> = {
    pending: { color: 'text-slate-400', icon: Clock, bg: 'bg-slate-100' },
    submitted: { color: 'text-blue-500', icon: Send, bg: 'bg-blue-50' },
    completed: { color: 'text-emerald-500', icon: CheckCircle2, bg: 'bg-emerald-50' },
    returned: { color: 'text-amber-500', icon: RotateCcw, bg: 'bg-amber-50' },
};

const AssignmentsPage: React.FC = () => {
    const { t, lang } = useLanguage();
    const user = useAuthStore(s => s.user);
    const teacherId = user?.id ?? '';

    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [classes, setClasses] = useState<EduClass[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [classStudentMap, setClassStudentMap] = useState<Record<string, string[]>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [submissions, setSubmissions] = useState<Record<string, Submission[]>>({});
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isDeletingBulk, setIsDeletingBulk] = useState(false);

    const [form, setForm] = useState({
        class_id: '', title: '', description: '', content_type: 'custom' as 'worksheet' | 'companion' | 'custom',
        due_date: '', source_app: '', source_lesson_id: '',
    });
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const [viewingSub, setViewingSub] = useState<{ a: Assignment, subs: Submission[], initialSubId: string } | null>(null);

    const load = useCallback(async () => {
        if (!teacherId) { setLoading(false); return; }
        setLoading(true);
        const [a, c, s, allSubs] = await Promise.all([
            edu.fetchAssignments(teacherId),
            edu.fetchClasses(teacherId),
            edu.fetchStudents(teacherId),
            edu.fetchTeacherSubmissions(teacherId)
        ]);
        setAssignments(a);
        setClasses(c);
        setStudents(s);

        const csMap: Record<string, string[]> = {};
        const classStudentResults = await Promise.all(c.map(cls => edu.fetchClassStudents(cls.id)));
        c.forEach((cls, i) => { csMap[cls.id] = classStudentResults[i].map(r => r.student_id); });
        setClassStudentMap(csMap);

        // Group all submissions by assignment_id
        const subsMap: Record<string, Submission[]> = {};
        allSubs.forEach(sub => {
            if (!subsMap[sub.assignment_id]) subsMap[sub.assignment_id] = [];
            subsMap[sub.assignment_id].push(sub);
        });
        setSubmissions(subsMap);

        setLoading(false);
    }, [teacherId]);

    useEffect(() => { load(); }, [load]);

    const handleSave = async () => {
        if (!form.title.trim() || !form.class_id || !teacherId) return;
        setSaving(true);
        const payload: any = {
            teacher_id: teacherId, class_id: form.class_id, title: form.title,
            description: form.description || null, content_type: form.content_type,
            due_date: form.due_date || null,
            source_app: form.source_app || null, source_lesson_id: form.source_lesson_id || null,
        };
        if (editingId) payload.id = editingId;
        const result = await edu.upsertAssignment(payload);

        // Auto-create submissions for class students on new assignment
        if (result && !editingId) {
            const studentIds = classStudentMap[form.class_id] || [];
            if (studentIds.length > 0) {
                await edu.createSubmissionsForClass(result.id, studentIds);
            }
        }

        await load();
        resetForm();
        setSaving(false);
    };

    const resetForm = () => {
        setForm({ class_id: classes[0]?.id || '', title: '', description: '', content_type: 'custom', due_date: '', source_app: '', source_lesson_id: '' });
        setEditingId(null);
        setShowForm(false);
    };

    const handleEdit = (a: Assignment) => {
        setForm({
            class_id: a.class_id, title: a.title, description: a.description || '',
            content_type: a.content_type as any, due_date: a.due_date || '',
            source_app: a.source_app || '', source_lesson_id: a.source_lesson_id || '',
        });
        setEditingId(a.id);
        setShowForm(true);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm(lang === 'zh' ? '确定要删除此作业吗？相关提交记录也会被删除。' : 'Are you sure you want to delete this assignment?')) return;
        await edu.deleteAssignment(id);
        setSubmissions(prev => {
            const next = { ...prev };
            delete next[id];
            return next;
        });
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
        if (expandedId === id) setExpandedId(null);
        await load();
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        if (!window.confirm(lang === 'zh' ? `确定要删除选中的 ${selectedIds.size} 项作业吗？` : `Delete ${selectedIds.size} selected assignments?`)) return;

        setIsDeletingBulk(true);
        for (const id of Array.from(selectedIds)) {
            await edu.deleteAssignment(id as string);
        }
        setSubmissions({});
        setExpandedId(null);
        setSelectedIds(new Set());
        await load();
        setIsDeletingBulk(false);
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === assignments.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(assignments.map(a => a.id)));
        }
    };

    const toggleSubmissions = async (assignmentId: string) => {
        if (expandedId === assignmentId) { setExpandedId(null); return; }
        setExpandedId(assignmentId);
        // Submissions are now pre-loaded
    };

    const updateSubmissionStatus = async (sub: Submission, newStatus: string) => {
        const updated: Partial<Submission> = {
            id: sub.id, assignment_id: sub.assignment_id, student_id: sub.student_id, status: newStatus as any,
        };
        if (newStatus === 'completed') updated.completed_at = new Date().toISOString();
        await edu.upsertSubmission(updated);
        const subs = await edu.fetchSubmissions(sub.assignment_id);
        setSubmissions(prev => ({ ...prev, [sub.assignment_id]: subs }));
    };

    const saveFeedback = async (sub: Submission, field: 'teacher_notes' | 'score', value: string | number | null) => {
        await edu.upsertSubmission({ id: sub.id, [field]: value } as any);
        const subs = await edu.fetchSubmissions(sub.assignment_id);
        setSubmissions(prev => ({ ...prev, [sub.assignment_id]: subs }));
    };

    const handleMarkIncomplete = async (assignmentId: string) => {
        if (!confirm(lang === 'zh' ? '确定将所有未交作业标记为未完成（0分）吗？' : 'Mark all pending submissions as incomplete (0 pts)?')) return;
        await edu.markExpiredIncomplete(assignmentId);
        const subs = await edu.fetchSubmissions(assignmentId);
        setSubmissions(prev => ({ ...prev, [assignmentId]: subs }));
    };

    const studentName = (id: string) => students.find(s => s.id === id);
    const className = (id: string) => classes.find(c => c.id === id)?.name || '—';

    if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-amber-500" size={28} /></div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">{t('asg.title')}</h2>
                <div className="flex items-center gap-2">
                    {selectedIds.size > 0 && (
                        <button onClick={handleBulkDelete} disabled={isDeletingBulk}
                            className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl font-semibold text-sm hover:bg-red-100 transition-colors">
                            {isDeletingBulk ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                            {lang === 'zh' ? `删除 (${selectedIds.size})` : `Delete (${selectedIds.size})`}
                        </button>
                    )}
                    <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700">
                        <button onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-lg flex items-center justify-center transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 shadow-sm text-sky-600 dark:text-sky-400' : 'text-slate-500 hover:text-slate-700'}`}
                            title="List View">
                            <LayoutList size={18} />
                        </button>
                        <button onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-lg flex items-center justify-center transition-colors ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 shadow-sm text-sky-600 dark:text-sky-400' : 'text-slate-500 hover:text-slate-700'}`}
                            title="Grade Matrix">
                            <Grid size={18} />
                        </button>
                    </div>

                    <button onClick={() => { setForm({ ...form, class_id: classes[0]?.id || '' }); setShowForm(true); }}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl font-semibold text-sm hover:bg-amber-600 shadow-md">
                        <Plus size={16} /> {t('asg.assign')}
                    </button>
                </div>
            </div>

            {/* Form */}
            {showForm && (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-amber-200 dark:border-amber-500/30 p-6 shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-slate-800 dark:text-white">{editingId ? t('common.edit') : t('asg.assign')}</h3>
                        <button onClick={resetForm} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1" htmlFor="assign_title">{t('asg.assignTitle')}</label>
                            <input id="assign_title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                                placeholder={lang === 'zh' ? '例：Unit 3 练习' : 'e.g. Unit 3 Worksheet'}
                                title={t('asg.assignTitle')}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1" htmlFor="assign_class">{t('nav.classes')}</label>
                            <select id="assign_class" value={form.class_id} onChange={e => setForm({ ...form, class_id: e.target.value })}
                                title={t('nav.classes')}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm">
                                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1" htmlFor="content_type_select">{t('asg.type')}</label>
                            <select id="content_type_select" value={form.content_type} onChange={e => setForm({ ...form, content_type: e.target.value as any })}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm">
                                <option value="worksheet">Worksheet</option>
                                <option value="companion">Companion</option>
                                <option value="assignment_sheet">Assignment Sheet</option>
                                <option value="essay">Essay Lab</option>
                                <option value="custom">Custom</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1" htmlFor="assign_desc">{t('asg.description')}</label>
                            <textarea id="assign_desc" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2}
                                title={t('asg.description')}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm resize-none" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1" htmlFor="assign_due">{t('asg.dueDate')}</label>
                            <input id="assign_due" type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })}
                                title={t('asg.dueDate')}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                        <button onClick={resetForm} className="px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 rounded-lg">{t('common.cancel')}</button>
                        <button onClick={handleSave} disabled={saving}
                            className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 flex items-center gap-2">
                            {saving && <Loader2 size={14} className="animate-spin" />}
                            {t('common.save')}
                        </button>
                    </div>
                </div>
            )}

            {/* Display Area */}
            {assignments.length === 0 ? (
                <div className="text-center py-16">
                    <ClipboardList size={40} className="mx-auto text-slate-300 mb-3" />
                    <div className="text-slate-400">{t('asg.noAssignments')}</div>
                </div>
            ) : viewMode === 'grid' ? (
                <div className="overflow-x-auto bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm max-h-[600px] overflow-y-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-20">
                            <tr>
                                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 sticky left-0 bg-slate-50 dark:bg-slate-900 z-30 border-r border-slate-200 dark:border-slate-700">
                                    {t('nav.students')}
                                </th>
                                {assignments.map(a => (
                                    <th key={a.id} className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 truncate max-w-[120px]" title={a.title}>
                                        <div className="truncate">{a.title}</div>
                                        <div className="text-[10px] font-normal text-slate-400 mt-0.5">{new Date(a.created_at).toLocaleDateString()}</div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {students.map(stu => (
                                <tr key={stu.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                    <td className="px-4 py-3 sticky left-0 bg-white dark:bg-slate-800 z-10 border-r border-slate-100 dark:border-slate-800 font-medium text-slate-700 dark:text-slate-300">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-amber-700 dark:text-amber-500 text-[10px] font-bold">
                                                {(stu.english_name?.[0] || stu.name[0] || '?').toUpperCase()}
                                            </div>
                                            {stu.name}
                                        </div>
                                    </td>
                                    {assignments.map(a => {
                                        const sub = submissions[a.id]?.find(s => s.student_id === stu.id);
                                        const isAssigned = classStudentMap[a.class_id]?.includes(stu.id);

                                        if (!isAssigned) {
                                            return <td key={a.id} className="px-4 py-3 text-center bg-slate-50/50 dark:bg-slate-900/30"></td>;
                                        }

                                        if (!sub) {
                                            return <td key={a.id} className="px-4 py-3 text-center text-slate-300 dark:text-slate-600">-</td>;
                                        }

                                        const cfg = STATUS_CONFIG[sub.status] || STATUS_CONFIG.pending;
                                        const StatusIcon = cfg.icon;

                                        return (
                                            <td key={a.id} className="px-4 py-3 text-center">
                                                <div
                                                    className="inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                                                    onClick={() => setViewingSub({ a, subs: submissions[a.id] || [], initialSubId: sub.id })}
                                                    title={`${t(`asg.${sub.status}`)}${sub.score ? ` • Score: ${['', 'F', 'D', 'C', 'B', 'A'][sub.score]}` : ''}`}
                                                >
                                                    <StatusIcon size={16} className={cfg.color} />
                                                    {sub.score && (
                                                        <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-amber-500 text-[8px] text-white font-bold ring-2 ring-white dark:ring-slate-800">
                                                            {['', 'F', 'D', 'C', 'B', 'A'][sub.score]}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="flex items-center px-4 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                        <label className="flex items-center cursor-pointer gap-3 text-sm font-medium text-slate-600 dark:text-slate-400">
                            <input type="checkbox"
                                checked={assignments.length > 0 && selectedIds.size === assignments.length}
                                onChange={toggleSelectAll}
                                className="w-4 h-4 text-amber-500 rounded border-slate-300 focus:ring-amber-500"
                            />
                            {lang === 'zh' ? '全选' : 'Select All'}
                        </label>
                    </div>
                    {assignments.map(a => {
                        const subs = submissions[a.id] || [];
                        const isExpanded = expandedId === a.id;
                        const completedCount = subs.filter(s => s.status === 'completed').length;
                        const isDue = a.due_date && new Date(a.due_date) < new Date();

                        return (
                            <div key={a.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-md transition-all">
                                <div className="p-4">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start gap-3 flex-1 min-w-0">
                                            <input type="checkbox" title="Select Assignment"
                                                checked={selectedIds.has(a.id)}
                                                onChange={() => toggleSelect(a.id)}
                                                className="mt-1 w-4 h-4 text-amber-500 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h4 className="font-bold text-slate-800 dark:text-white truncate" title={a.title}>{a.title}</h4>
                                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${a.content_type === 'worksheet' ? 'bg-violet-100 text-violet-700' :
                                                        a.content_type === 'companion' ? 'bg-teal-100 text-teal-700' :
                                                            a.content_type === 'assignment_sheet' ? 'bg-amber-100 text-amber-700' :
                                                                a.content_type === 'essay' ? 'bg-pink-100 text-pink-700' :
                                                                    'bg-slate-100 text-slate-600 dark:text-slate-400'
                                                        }`}>
                                                        {a.content_type === 'assignment_sheet' ? 'Assgn. Sheet' : a.content_type}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-slate-400">
                                                    <span>{className(a.class_id)}</span>
                                                    {a.due_date && (
                                                        <span className={isDue ? 'text-red-500 font-medium' : ''}>
                                                            {isDue ? '⚠ ' : ''}{t('asg.dueDate')}: {a.due_date}
                                                        </span>
                                                    )}
                                                    <span>{new Date(a.created_at).toLocaleDateString()}</span>
                                                </div>
                                                {a.description && <p className="text-sm text-slate-500 mt-1 line-clamp-2">{a.description}</p>}
                                            </div>

                                            <div className="flex items-center gap-1 flex-shrink-0 ml-3">
                                                <button onClick={() => toggleSubmissions(a.id)} title="View Submissions"
                                                    className="flex items-center gap-1 px-2 py-1.5 text-xs text-slate-400 hover:text-sky-500 rounded-lg hover:bg-sky-50 transition-colors">
                                                    <Users size={13} />
                                                    <span>{subs.length > 0 ? `${completedCount}/${subs.length}` : '...'}</span>
                                                    {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                                </button>
                                                {isDue && subs.some(s => s.status === 'pending') && (
                                                    <button onClick={() => handleMarkIncomplete(a.id)} title={lang === 'zh' ? '将未交标记为0分' : 'Mark pending as 0 pts'} className="p-1.5 text-slate-400 hover:text-amber-500 rounded-lg hover:bg-amber-50">
                                                        <Clock size={14} />
                                                    </button>
                                                )}
                                                <button onClick={() => handleDelete(a.id)} title="Delete Assignment" className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50"><Trash2 size={14} /></button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Submissions Panel */}
                                {isExpanded && (
                                    <div className="border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-3">
                                        {subs.length === 0 ? (
                                            <div className="text-center text-xs text-slate-400 py-3">{t('asg.noSubmissions')}</div>
                                        ) : (
                                            <div className="space-y-1.5">
                                                {subs.map(sub => {
                                                    const stu = studentName(sub.student_id);
                                                    const cfg = STATUS_CONFIG[sub.status] || STATUS_CONFIG.pending;
                                                    const StatusIcon = cfg.icon;
                                                    return (
                                                        <div key={sub.id} className="rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-600 relative overflow-hidden group">
                                                            <div className="flex items-center justify-between py-2 px-3 cursor-pointer" onClick={() => setViewingSub({ a, subs, initialSubId: sub.id })}>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 text-xs font-bold">
                                                                        {(stu?.english_name?.[0] || stu?.name?.[0] || '?').toUpperCase()}
                                                                    </div>
                                                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-amber-600 transition-colors">{stu?.name || sub.student_id}</span>
                                                                    {stu?.english_name && <span className="text-xs text-slate-400">{stu.english_name}</span>}
                                                                </div>
                                                                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                                                    {/* Score selector */}
                                                                    {(sub.status === 'submitted' || sub.status === 'completed' || sub.status === 'returned') && (
                                                                        <select
                                                                            value={sub.score ?? ''}
                                                                            onChange={e => saveFeedback(sub, 'score', e.target.value ? Number(e.target.value) : null)}
                                                                            title={t('asg.score')}
                                                                            className="text-xs px-1.5 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                                                                        >
                                                                            <option value="">{t('asg.score')}</option>
                                                                            <option value="5">A</option>
                                                                            <option value="4">B</option>
                                                                            <option value="3">C</option>
                                                                            <option value="2">D</option>
                                                                            <option value="1">F</option>
                                                                        </select>
                                                                    )}
                                                                    <span className={`flex items-center gap-1 text-xs font-medium ${cfg.color}`}>
                                                                        <StatusIcon size={13} />
                                                                        {t(`asg.${sub.status}`)}
                                                                    </span>
                                                                    {sub.status === 'submitted' && (
                                                                        <button onClick={() => updateSubmissionStatus(sub, 'completed')}
                                                                            className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded-md hover:bg-emerald-200 font-medium">
                                                                            {t('asg.markComplete')}
                                                                        </button>
                                                                    )}
                                                                    {sub.status === 'completed' && (
                                                                        <button onClick={() => updateSubmissionStatus(sub, 'returned')}
                                                                            className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-md hover:bg-amber-200 font-medium">
                                                                            {t('asg.returned')}
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {/* Feedback row */}
                                                            {(sub.status === 'submitted' || sub.status === 'completed' || sub.status === 'returned') && (
                                                                <div className="px-3 pb-2 flex items-start gap-2" onClick={e => e.stopPropagation()}>
                                                                    <MessageSquare size={13} className="text-slate-300 mt-1.5 shrink-0" />
                                                                    <textarea
                                                                        defaultValue={sub.teacher_notes || ''}
                                                                        onBlur={e => {
                                                                            const val = e.target.value.trim();
                                                                            if (val !== (sub.teacher_notes || '')) saveFeedback(sub, 'teacher_notes', val || null);
                                                                        }}
                                                                        placeholder={t('asg.feedbackPlaceholder')}
                                                                        rows={1}
                                                                        className="flex-1 text-xs px-2 py-1.5 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 resize-none focus:ring-1 focus:ring-amber-400 focus:border-amber-400"
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )
            }

            {/* Submission Viewer Modal */}
            {viewingSub && (
                <TeacherSubmissionViewer
                    assignment={viewingSub.a}
                    submissions={viewingSub.subs}
                    initialSubmissionId={viewingSub.initialSubId}
                    onClose={() => setViewingSub(null)}
                    onSubmissionUpdated={async (updatedSub) => {
                        const newSubs = await edu.fetchSubmissions(updatedSub.assignment_id);
                        setSubmissions(prev => ({ ...prev, [updatedSub.assignment_id]: newSubs }));
                        setViewingSub(prev => prev ? { ...prev, subs: newSubs, initialSubId: updatedSub.id } : null);
                    }}
                />
            )}
        </div>
    );
};

export default AssignmentsPage;
