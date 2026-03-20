import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuthStore } from '@shared/stores/useAuthStore';
import * as edu from '@pathway/education';
import type { EduClass } from '@pathway/education';
import { Plus, Edit3, Trash2, X, Loader2, School } from 'lucide-react';

const ClassesPage: React.FC = () => {
    const { t } = useLanguage();
    const user = useAuthStore(s => s.user);
    const teacherId = user?.id ?? '';

    const [classes, setClasses] = useState<EduClass[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ name: '', description: '', max_students: 6 });

    const load = useCallback(async () => {
        if (!teacherId) { setLoading(false); return; }
        setLoading(true);
        const data = await edu.fetchClasses(teacherId);
        setClasses(data);
        setLoading(false);
    }, [teacherId]);

    useEffect(() => { load(); }, [load]);

    const handleSave = async () => {
        if (!form.name.trim()) return;
        if (!teacherId) {
            console.error('[ClassesPage] teacherId is empty – user not logged in?', { user });
            alert('Error: Not logged in (teacherId is empty). Please sign in first.');
            return;
        }
        setSaving(true);
        try {
            const payload: any = { teacher_id: teacherId, name: form.name, description: form.description, max_students: form.max_students };
            if (editingId) payload.id = editingId;
            console.log('[ClassesPage] saving class:', JSON.stringify(payload));
            const result = await edu.upsertClass(payload);
            console.log('[ClassesPage] upsertClass result:', result);
            if (!result) {
                alert('Save failed — check browser console (F12) for [edu] error details');
            }
            await load();
            resetForm();
        } catch (err: any) {
            console.error('[ClassesPage] handleSave error:', err);
            alert('Save error: ' + (err?.message || String(err)));
        }
        setSaving(false);
    };

    const resetForm = () => { setForm({ name: '', description: '', max_students: 6 }); setEditingId(null); setShowForm(false); };

    const handleEdit = (cls: EduClass) => {
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
                        <button onClick={resetForm} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
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
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">{t('cls.maxStudents')}</label>
                            <input type="number" value={form.max_students} onChange={e => setForm({ ...form, max_students: parseInt(e.target.value) || 6 })}
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
                    {classes.map(cls => (
                        <div key={cls.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 hover:shadow-md transition-all">
                            <div className="flex items-start justify-between mb-2">
                                <h4 className="font-bold text-slate-800 dark:text-white">{cls.name}</h4>
                                <div className="flex gap-1">
                                    <button onClick={() => handleEdit(cls)} className="p-1.5 text-slate-400 hover:text-amber-500 rounded-lg hover:bg-amber-50"><Edit3 size={14} /></button>
                                    <button onClick={() => handleDelete(cls.id)} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50"><Trash2 size={14} /></button>
                                </div>
                            </div>
                            {cls.description && <p className="text-sm text-slate-500 mb-3">{cls.description}</p>}
                            <span className="text-xs font-medium px-2 py-1 bg-amber-100 text-amber-700 rounded-full dark:bg-amber-500/20 dark:text-amber-300">
                                0 / {cls.max_students} {t('cls.students')}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ClassesPage;
