import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuthStore } from '@shared/stores/useAuthStore';
import { useToast } from '@shared/stores/useToast';
import * as edu from '@pathway/education';
import type { Student } from '@pathway/education';
import { Plus, Search, Edit3, Trash2, X, Loader2, Users, RotateCcw } from 'lucide-react';

const AVATAR_COLORS = ['bg-amber-500', 'bg-teal-500', 'bg-violet-500', 'bg-rose-500', 'bg-sky-500', 'bg-emerald-500', 'bg-indigo-500', 'bg-orange-500'];

/* ── Student List (inline sub-view) ─────────────────────────── */
const StudentListView: React.FC = () => {
    const { t, lang } = useLanguage();
    const user = useAuthStore(s => s.user);
    const teacherId = user?.id ?? '';
    const toast = useToast();

    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState('');
    const [form, setForm] = useState({ name: '', english_name: '', contact_info: '', notes: '' });

    const load = useCallback(async () => {
        if (!teacherId) { setLoading(false); return; }
        setLoading(true);
        const data = await edu.fetchStudents(teacherId);
        setStudents(data);
        setLoading(false);
    }, [teacherId]);

    useEffect(() => { load(); }, [load]);

    const handleSave = async (e?: React.FormEvent) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        if (!form.name.trim()) { toast.error('Name is required'); return; }
        if (!teacherId) { toast.error('Authentication error. Please refresh.'); return; }

        setSaving(true);
        try {
            const payload: any = { teacher_id: teacherId, name: form.name.trim(), english_name: form.english_name.trim(), contact_info: form.contact_info.trim(), notes: form.notes.trim() };
            if (editingId) payload.id = editingId;
            const res = await edu.upsertStudent(payload);
            if (!res) throw new Error('Failed to save student');
            toast.success(editingId ? 'Updated successfully' : 'Added successfully');
            await load();
            resetForm();
        } catch (err: any) {
            toast.error(err.message || 'Failed to save student');
        } finally {
            setSaving(false);
        }
    };

    const resetForm = () => { setForm({ name: '', english_name: '', contact_info: '', notes: '' }); setEditingId(null); setShowForm(false); };

    const handleEdit = (stu: Student) => {
        setForm({ name: stu.name, english_name: stu.english_name || '', contact_info: stu.contact_info || '', notes: stu.notes || '' });
        setEditingId(stu.id);
        setShowForm(true);
    };

    const handleDelete = async (id: string) => {
        await edu.deleteStudent(id);
        await load();
    };

    const handleRegenerateCode = async (id: string) => {
        if (!teacherId || !confirm(lang === 'zh' ? '确定要重新生成邀请码？' : 'Regenerate invite code?')) return;
        setLoading(true);
        const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        await edu.upsertStudent({ id, teacher_id: teacherId, invite_code: newCode } as any);
        await load();
    };

    const filtered = students.filter(s =>
        s.name.includes(search) || (s.english_name || '').toLowerCase().includes(search.toLowerCase())
    );

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-amber-500" size={24} /></div>;

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="relative flex-1 sm:flex-initial">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder={t('stu.search')}
                        className="w-full sm:w-56 pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" />
                </div>
                <button onClick={() => setShowForm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl font-semibold text-sm hover:bg-amber-600 transition-colors shadow-md whitespace-nowrap">
                    <Plus size={16} /> {t('stu.addStudent')}
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleSave} className="bg-white dark:bg-slate-800 rounded-xl border border-amber-200 dark:border-amber-500/30 p-6 shadow-lg relative z-10">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-slate-800 dark:text-white">{editingId ? t('common.edit') : t('stu.addStudent')}</h3>
                        <button type="button" onClick={resetForm} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">{t('stu.name')}</label>
                            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                                placeholder="张三"
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">{t('stu.englishName')}</label>
                            <input value={form.english_name} onChange={e => setForm({ ...form, english_name: e.target.value })}
                                placeholder="Emma"
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">{t('stu.contact')}</label>
                            <input value={form.contact_info} onChange={e => setForm({ ...form, contact_info: e.target.value })}
                                placeholder="WeChat / Phone"
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">{t('stu.notes')}</label>
                            <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                        <button type="button" onClick={resetForm} className="px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 rounded-lg">{t('common.cancel')}</button>
                        <button type="submit" disabled={saving}
                            className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-sm">
                            {saving && <Loader2 size={14} className="animate-spin" />}
                            {t('common.save')}
                        </button>
                    </div>
                </form>
            )}

            {filtered.length === 0 ? (
                <div className="text-center py-16">
                    <Users size={40} className="mx-auto text-slate-300 mb-3" />
                    <div className="text-slate-400">{search ? `No results for "${search}"` : t('stu.noStudents')}</div>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map((stu, i) => (
                        <div key={stu.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 hover:shadow-md transition-all">
                            {/* Top row: avatar + name + actions */}
                            <div className="flex items-center gap-3 mb-2">
                                <div className={`w-10 h-10 rounded-full ${AVATAR_COLORS[i % AVATAR_COLORS.length]} flex items-center justify-center text-white font-bold text-base flex-shrink-0`}>
                                    {(stu.english_name?.[0] || stu.name[0]).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-sm text-slate-800 dark:text-white truncate">{stu.name}</div>
                                    {stu.english_name && <div className="text-xs text-slate-400 truncate">{stu.english_name}</div>}
                                </div>
                                <div className="flex gap-0.5 flex-shrink-0">
                                    <button onClick={() => handleEdit(stu)} className="p-1.5 text-slate-400 hover:text-amber-500 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-500/10"><Edit3 size={14} /></button>
                                    <button onClick={() => handleDelete(stu.id)} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10"><Trash2 size={14} /></button>
                                </div>
                            </div>

                            {/* Status row: invite code or linked badge */}
                            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/50">
                                {stu.auth_user_id ? (
                                    <span className="inline-flex items-center text-[11px] font-semibold px-2 py-1 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                                        ✓ {lang === 'zh' ? '已绑定学生账号' : 'Student account linked'}
                                    </span>
                                ) : (
                                    <div className="flex items-center gap-1.5">
                                        <div
                                            className="cursor-pointer inline-flex items-center gap-1 text-[11px] font-mono font-semibold px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600 hover:bg-sky-50 dark:hover:bg-sky-500/10 hover:border-sky-300 hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
                                            onClick={() => { navigator.clipboard.writeText(stu.invite_code || ''); }}
                                            title={lang === 'zh' ? '点击复制邀请码' : 'Click to copy invite code'}
                                        >
                                            🔑 {stu.invite_code || '------'}
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleRegenerateCode(stu.id); }}
                                            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md text-slate-400 hover:text-sky-500 transition-colors"
                                            title={lang === 'zh' ? '重新生成邀请码' : 'Regenerate Code'}
                                        >
                                            <RotateCcw size={12} />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Contact info */}
                            {stu.contact_info && (
                                <div className="text-xs text-slate-400 mt-2 truncate">📱 {stu.contact_info}</div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

/* ── Main Students Page with Sub-Tabs ─────────────────────────── */
const StudentsPage: React.FC = () => {
    const { t } = useLanguage();

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">{t('stu.title')}</h2>
            <StudentListView />
        </div>
    );
};

export default StudentsPage;
