import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuthStore } from '@shared/stores/useAuthStore';
import * as edu from '@shared/services/educationService';
import type { Assignment, Submission, EduClass, Student } from '@shared/types/education';
import {
    Plus, Edit3, Trash2, X, Loader2, ClipboardList,
    CheckCircle2, Clock, Send, RotateCcw, ChevronDown, ChevronUp, Users,
} from 'lucide-react';

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

    const [form, setForm] = useState({
        class_id: '', title: '', description: '', content_type: 'custom' as 'worksheet' | 'companion' | 'custom',
        due_date: '', source_app: '', source_lesson_id: '',
    });

    const load = useCallback(async () => {
        if (!teacherId) { setLoading(false); return; }
        setLoading(true);
        const [a, c, s] = await Promise.all([
            edu.fetchAssignments(teacherId),
            edu.fetchClasses(teacherId),
            edu.fetchStudents(teacherId),
        ]);
        setAssignments(a);
        setClasses(c);
        setStudents(s);

        const csMap: Record<string, string[]> = {};
        for (const cls of c) {
            const cs = await edu.fetchClassStudents(cls.id);
            csMap[cls.id] = cs.map(r => r.student_id);
        }
        setClassStudentMap(csMap);
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
        await edu.deleteAssignment(id);
        await load();
    };

    const toggleSubmissions = async (assignmentId: string) => {
        if (expandedId === assignmentId) { setExpandedId(null); return; }
        setExpandedId(assignmentId);
        if (!submissions[assignmentId]) {
            const subs = await edu.fetchSubmissions(assignmentId);
            setSubmissions(prev => ({ ...prev, [assignmentId]: subs }));
        }
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

    const studentName = (id: string) => students.find(s => s.id === id);
    const className = (id: string) => classes.find(c => c.id === id)?.name || '—';

    if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-amber-500" size={28} /></div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">{t('asg.title')}</h2>
                <button onClick={() => { setForm({ ...form, class_id: classes[0]?.id || '' }); setShowForm(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl font-semibold text-sm hover:bg-amber-600 shadow-md">
                    <Plus size={16} /> {t('asg.assign')}
                </button>
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
                            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">{t('asg.assignTitle')}</label>
                            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                                placeholder={lang === 'zh' ? '例：Unit 3 练习' : 'e.g. Unit 3 Worksheet'}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">{t('nav.classes')}</label>
                            <select value={form.class_id} onChange={e => setForm({ ...form, class_id: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm">
                                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">{t('asg.type')}</label>
                            <select value={form.content_type} onChange={e => setForm({ ...form, content_type: e.target.value as any })}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm">
                                <option value="worksheet">Worksheet</option>
                                <option value="companion">Companion</option>
                                <option value="custom">Custom</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">{t('asg.description')}</label>
                            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm resize-none" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">{t('asg.dueDate')}</label>
                            <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })}
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

            {/* List */}
            {assignments.length === 0 ? (
                <div className="text-center py-16">
                    <ClipboardList size={40} className="mx-auto text-slate-300 mb-3" />
                    <div className="text-slate-400">{t('asg.noAssignments')}</div>
                </div>
            ) : (
                <div className="space-y-3">
                    {assignments.map(a => {
                        const subs = submissions[a.id] || [];
                        const isExpanded = expandedId === a.id;
                        const completedCount = subs.filter(s => s.status === 'completed').length;
                        const isDue = a.due_date && new Date(a.due_date) < new Date();

                        return (
                            <div key={a.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-md transition-all">
                                <div className="p-4">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-bold text-slate-800 dark:text-white truncate">{a.title}</h4>
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.content_type === 'worksheet' ? 'bg-violet-100 text-violet-700' :
                                                        a.content_type === 'companion' ? 'bg-teal-100 text-teal-700' :
                                                            'bg-slate-100 text-slate-600 dark:text-slate-400'
                                                    }`}>{a.content_type}</span>
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
                                            <button onClick={() => toggleSubmissions(a.id)}
                                                className="flex items-center gap-1 px-2 py-1.5 text-xs text-slate-400 hover:text-sky-500 rounded-lg hover:bg-sky-50 transition-colors">
                                                <Users size={13} />
                                                <span>{subs.length > 0 ? `${completedCount}/${subs.length}` : '...'}</span>
                                                {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                            </button>
                                            <button onClick={() => handleEdit(a)} className="p-1.5 text-slate-400 hover:text-amber-500 rounded-lg hover:bg-amber-50"><Edit3 size={14} /></button>
                                            <button onClick={() => handleDelete(a.id)} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50"><Trash2 size={14} /></button>
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
                                                        <div key={sub.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-colors">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 text-xs font-bold">
                                                                    {(stu?.english_name?.[0] || stu?.name?.[0] || '?').toUpperCase()}
                                                                </div>
                                                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{stu?.name || sub.student_id}</span>
                                                                {stu?.english_name && <span className="text-xs text-slate-400">{stu.english_name}</span>}
                                                            </div>
                                                            <div className="flex items-center gap-2">
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
            )}
        </div>
    );
};

export default AssignmentsPage;
