import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuthStore } from '@shared/stores/useAuthStore';
import * as edu from '@pathway/education';
import type { EduClassWithCount, Student } from '@pathway/education';
import { Plus, Edit3, Trash2, X, Loader2, School, Users, ChevronDown, ChevronUp, UserMinus, UserPlus, Check } from 'lucide-react';

const StudentsPage = React.lazy(() => import('./StudentsPage'));
type SubTab = 'classes' | 'students';

const AVATAR_COLORS = ['bg-amber-500', 'bg-teal-500', 'bg-violet-500', 'bg-rose-500', 'bg-sky-500', 'bg-emerald-500'];

/* ── Class Detail Panel (expanded) ─────────────────── */
const ClassDetailPanel: React.FC<{ classId: string; allStudents: Student[]; onUpdate: () => void }> = ({ classId, allStudents, onUpdate }) => {
    const { lang } = useLanguage();
    const [members, setMembers] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [selected, setSelected] = useState<string[]>([]);

    const loadMembers = useCallback(async () => {
        setLoading(true);
        const data = await edu.fetchClassStudentsWithDetails(classId);
        setMembers(data);
        setLoading(false);
    }, [classId]);

    useEffect(() => { loadMembers(); }, [loadMembers]);

    const handleRemove = async (studentId: string) => {
        const remaining = members.filter(m => m.id !== studentId).map(m => m.id);
        await edu.setClassStudents(classId, remaining);
        await loadMembers();
        onUpdate();
    };

    const handleAdd = async () => {
        if (selected.length === 0) return;
        const current = members.map(m => m.id);
        await edu.setClassStudents(classId, [...current, ...selected]);
        setSelected([]);
        setShowAdd(false);
        await loadMembers();
        onUpdate();
    };

    const availableStudents = allStudents.filter(s => !members.some(m => m.id === s.id));

    if (loading) return <div className="py-4 flex justify-center"><Loader2 size={18} className="animate-spin text-amber-500" /></div>;

    return (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/50 space-y-3">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {lang === 'zh' ? '班级成员' : 'Class Members'}
            </div>
            {members.length === 0 ? (
                <div className="text-sm text-slate-400 py-2">{lang === 'zh' ? '暂无学生' : 'No students yet'}</div>
            ) : (
                <div className="space-y-1.5">
                    {members.map((stu, i) => (
                        <div key={stu.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 group">
                            <div className={`w-7 h-7 rounded-full ${AVATAR_COLORS[i % AVATAR_COLORS.length]} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                                {(stu.english_name?.[0] || stu.name[0]).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{stu.name}</span>
                                {stu.english_name && <span className="text-xs text-slate-400 ml-1.5">({stu.english_name})</span>}
                            </div>
                            <button onClick={() => handleRemove(stu.id)}
                                title={lang === 'zh' ? '移出班级' : 'Remove'}
                                className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                <UserMinus size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {!showAdd ? (
                <button onClick={() => setShowAdd(true)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 hover:text-amber-700 py-1">
                    <UserPlus size={14} /> {lang === 'zh' ? '添加学生' : 'Add Student'}
                </button>
            ) : (
                <div className="bg-slate-50 dark:bg-slate-700/30 rounded-lg p-3 space-y-2">
                    {availableStudents.length === 0 ? (
                        <div className="text-xs text-slate-400">{lang === 'zh' ? '所有学生已在班内' : 'All students enrolled'}</div>
                    ) : (
                        <div className="max-h-40 overflow-y-auto space-y-1">
                            {availableStudents.map(stu => (
                                <label key={stu.id} className="flex items-center gap-2 py-1 px-1.5 rounded hover:bg-white dark:hover:bg-slate-700 cursor-pointer text-sm">
                                    <input type="checkbox" checked={selected.includes(stu.id)}
                                        onChange={() => setSelected(s => s.includes(stu.id) ? s.filter(x => x !== stu.id) : [...s, stu.id])}
                                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500" />
                                    <span className="text-slate-700 dark:text-slate-200">{stu.name}</span>
                                    {stu.english_name && <span className="text-xs text-slate-400">({stu.english_name})</span>}
                                </label>
                            ))}
                        </div>
                    )}
                    <div className="flex gap-2 pt-1">
                        <button onClick={() => { setShowAdd(false); setSelected([]); }}
                            className="text-xs text-slate-400 hover:text-slate-600">{lang === 'zh' ? '取消' : 'Cancel'}</button>
                        {selected.length > 0 && (
                            <button onClick={handleAdd}
                                className="flex items-center gap-1 text-xs font-semibold text-amber-600 hover:text-amber-700">
                                <Check size={12} /> {lang === 'zh' ? `添加 ${selected.length} 名` : `Add ${selected.length}`}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

/* ── Classes List Sub-View ─────────────────────────── */
const ClassesListView: React.FC = () => {
    const { t, lang } = useLanguage();
    const user = useAuthStore(s => s.user);
    const teacherId = user?.id ?? '';

    const [classes, setClasses] = useState<EduClassWithCount[]>([]);
    const [allStudents, setAllStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ name: '', description: '', max_students: 6 });

    const load = useCallback(async () => {
        if (!teacherId) { setLoading(false); return; }
        setLoading(true);
        const [clsData, stuData] = await Promise.all([
            edu.fetchClassesWithCount(teacherId),
            edu.fetchStudents(teacherId),
        ]);
        setClasses(clsData);
        setAllStudents(stuData);
        setLoading(false);
    }, [teacherId]);

    useEffect(() => { load(); }, [load]);

    const handleSave = async () => {
        if (!form.name.trim() || !teacherId) return;
        setSaving(true);
        try {
            const payload: any = { teacher_id: teacherId, name: form.name, description: form.description, max_students: form.max_students };
            if (editingId) payload.id = editingId;
            const result = await edu.upsertClass(payload);
            if (!result) alert('Save failed — check console (F12)');
            await load();
            resetForm();
        } catch (err: any) {
            alert('Save error: ' + (err?.message || String(err)));
        }
        setSaving(false);
    };

    const resetForm = () => { setForm({ name: '', description: '', max_students: 6 }); setEditingId(null); setShowForm(false); };

    const handleEdit = (cls: EduClassWithCount) => {
        setForm({ name: cls.name, description: cls.description || '', max_students: cls.max_students });
        setEditingId(cls.id);
        setShowForm(true);
    };

    const handleDelete = async (id: string) => {
        await edu.deleteClass(id);
        await load();
    };

    if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-amber-500" size={28} /></div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">{t('cls.title')}</h2>
                <button onClick={() => setShowForm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl font-semibold text-sm hover:bg-amber-600 transition-colors shadow-md">
                    <Plus size={16} /> {t('cls.addClass')}
                </button>
            </div>

            {showForm && (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-amber-200 dark:border-amber-500/30 p-6 shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-slate-800 dark:text-white">{editingId ? t('cls.edit') : t('cls.addClass')}</h3>
                        <button onClick={resetForm} title="Close" className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">{t('cls.className')}</label>
                            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                                placeholder="e.g. Pre-K Mon/Wed"
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">{t('cls.description')}</label>
                            <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                                placeholder={lang === 'zh' ? '班级描述' : 'Class description'}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">{t('cls.maxStudents')}</label>
                            <input type="number" value={form.max_students} onChange={e => setForm({ ...form, max_students: parseInt(e.target.value) || 6 })}
                                placeholder="6"
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                        <button onClick={resetForm} className="px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 rounded-lg">{t('cls.cancel')}</button>
                        <button onClick={handleSave} disabled={saving}
                            className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 flex items-center gap-2">
                            {saving && <Loader2 size={14} className="animate-spin" />}
                            {t('cls.save')}
                        </button>
                    </div>
                </div>
            )}

            {classes.length === 0 ? (
                <div className="text-center py-16">
                    <School size={40} className="mx-auto text-slate-300 mb-3" />
                    <div className="text-slate-400">{t('cls.noClasses')}</div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {classes.map(cls => {
                        const isExpanded = expandedId === cls.id;
                        const pct = cls.max_students > 0 ? Math.min(100, (cls.student_count / cls.max_students) * 100) : 0;
                        return (
                            <div key={cls.id} className={`bg-white dark:bg-slate-800 rounded-xl border p-5 transition-all ${isExpanded ? 'border-amber-300 dark:border-amber-500/50 shadow-lg' : 'border-slate-200 dark:border-slate-700 hover:shadow-md'
                                }`}>
                                <div className="flex items-start justify-between mb-2">
                                    <h4 className="font-bold text-slate-800 dark:text-white">{cls.name}</h4>
                                    <div className="flex gap-1">
                                        <button onClick={() => handleEdit(cls)} title="Edit" className="p-1.5 text-slate-400 hover:text-amber-500 rounded-lg hover:bg-amber-50"><Edit3 size={14} /></button>
                                        <button onClick={() => handleDelete(cls.id)} title="Delete" className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50"><Trash2 size={14} /></button>
                                    </div>
                                </div>
                                {cls.description && <p className="text-sm text-slate-500 mb-3">{cls.description}</p>}
                                {/* Progress bar */}
                                <div className="mb-2">
                                    <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                                        {cls.student_count} / {cls.max_students} {t('cls.students')}
                                    </span>
                                    <button onClick={() => setExpandedId(isExpanded ? null : cls.id)}
                                        title={isExpanded ? 'Collapse' : 'Expand'}
                                        className="p-1 text-slate-400 hover:text-amber-500 rounded transition-colors">
                                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </button>
                                </div>
                                {isExpanded && (
                                    <ClassDetailPanel classId={cls.id} allStudents={allStudents} onUpdate={load} />
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

/* ── Main Classes Page with Sub-Tabs ─────────────────────────── */
const ClassesPage: React.FC = () => {
    const { lang } = useLanguage();
    const [subTab, setSubTab] = useState<SubTab>('classes');

    return (
        <div className="space-y-4">
            <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
                <button
                    onClick={() => setSubTab('classes')}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${subTab === 'classes' ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}>
                    <School size={15} /> {lang === 'zh' ? '班级管理' : 'Classes'}
                </button>
                <button
                    onClick={() => setSubTab('students')}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${subTab === 'students' ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}>
                    <Users size={15} /> {lang === 'zh' ? '学生管理' : 'Students'}
                </button>
            </div>
            <React.Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="animate-spin text-amber-500" size={24} /></div>}>
                {subTab === 'classes' && <ClassesListView />}
                {subTab === 'students' && <StudentsPage />}
            </React.Suspense>
        </div>
    );
};

export default ClassesPage;
