import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuthStore } from '@shared/stores/useAuthStore';
import * as edu from '@shared/services/educationService';
import type { BookLoan, Student } from '@shared/types/education';
import {
    Plus, Trash2, X, Loader2, BookOpen, Search, Undo2, AlertTriangle,
} from 'lucide-react';

const BooksPage: React.FC = () => {
    const { t, lang } = useLanguage();
    const user = useAuthStore(s => s.user);
    const teacherId = user?.id ?? '';

    const [loans, setLoans] = useState<BookLoan[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [filter, setFilter] = useState<'all' | 'active' | 'returned' | 'overdue'>('all');
    const [search, setSearch] = useState('');

    const [form, setForm] = useState({
        student_id: '', book_title: '', borrowed_at: new Date().toISOString().slice(0, 10),
        due_date: '', notes: '',
    });

    const load = useCallback(async () => {
        if (!teacherId) { setLoading(false); return; }
        setLoading(true);
        const [l, s] = await Promise.all([
            edu.fetchBookLoans(teacherId),
            edu.fetchStudents(teacherId),
        ]);
        setLoans(l);
        setStudents(s);
        setLoading(false);
    }, [teacherId]);

    useEffect(() => { load(); }, [load]);

    const handleSave = async () => {
        if (!form.book_title.trim() || !form.student_id || !teacherId) return;
        setSaving(true);
        await edu.upsertBookLoan({
            teacher_id: teacherId, student_id: form.student_id,
            book_title: form.book_title, borrowed_at: form.borrowed_at,
            due_date: form.due_date || null, notes: form.notes || null,
        } as any);
        await load();
        resetForm();
        setSaving(false);
    };

    const resetForm = () => {
        setForm({
            student_id: students[0]?.id || '', book_title: '',
            borrowed_at: new Date().toISOString().slice(0, 10), due_date: '', notes: '',
        });
        setShowForm(false);
    };

    const handleReturn = async (loanId: string) => {
        await edu.returnBook(loanId);
        await load();
    };

    const handleDelete = async (loanId: string) => {
        await edu.deleteBookLoan(loanId);
        await load();
    };

    const studentName = (id: string) => {
        const s = students.find(s => s.id === id);
        return s ? (s.name || s.english_name || '—') : '—';
    };

    const isOverdue = (loan: BookLoan) =>
        !loan.returned_at && loan.due_date && new Date(loan.due_date) < new Date();

    const filtered = loans.filter(l => {
        if (filter === 'active' && l.returned_at) return false;
        if (filter === 'returned' && !l.returned_at) return false;
        if (filter === 'overdue' && !isOverdue(l)) return false;
        if (search) {
            const q = search.toLowerCase();
            const sName = studentName(l.student_id).toLowerCase();
            return l.book_title.toLowerCase().includes(q) || sName.includes(q);
        }
        return true;
    });

    const overdueCount = loans.filter(isOverdue).length;

    if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-amber-500" size={28} /></div>;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">{t('bk.title')}</h2>
                    {overdueCount > 0 && (
                        <span className="flex items-center gap-1 text-xs font-bold px-2 py-1 bg-red-100 text-red-600 rounded-full">
                            <AlertTriangle size={12} /> {overdueCount} {t('bk.overdue')}
                        </span>
                    )}
                </div>
                <button onClick={() => { setForm({ ...form, student_id: students[0]?.id || '' }); setShowForm(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl font-semibold text-sm hover:bg-amber-600 shadow-md">
                    <Plus size={16} /> {t('bk.lendBook')}
                </button>
            </div>

            {/* Filters + Search */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex gap-2">
                    {(['all', 'active', 'overdue', 'returned'] as const).map(f => (
                        <button key={f} onClick={() => setFilter(f)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${filter === f
                                ? (f === 'overdue' ? 'bg-red-500 text-white' : 'bg-amber-500 text-white shadow-md')
                                : 'bg-white dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 hover:border-amber-300'}`}>
                            {t(`bk.${f}` as any)}
                        </button>
                    ))}
                </div>
                <div className="flex-1 min-w-[200px] relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder={t('bk.search') as string}
                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" />
                </div>
            </div>

            {/* Lend Form */}
            {showForm && (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-amber-200 dark:border-amber-500/30 p-6 shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-slate-800 dark:text-white">{t('bk.lendBook')}</h3>
                        <button onClick={resetForm} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">{t('bk.bookTitle')}</label>
                            <input value={form.book_title} onChange={e => setForm({ ...form, book_title: e.target.value })}
                                placeholder={lang === 'zh' ? '例：Charlotte\'s Web' : 'e.g. Charlotte\'s Web'}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">{t('bk.student')}</label>
                            <select value={form.student_id} onChange={e => setForm({ ...form, student_id: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm">
                                {students.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}{s.english_name ? ` (${s.english_name})` : ''}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">{t('bk.borrowedAt')}</label>
                            <input type="date" value={form.borrowed_at} onChange={e => setForm({ ...form, borrowed_at: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">{t('bk.dueDate')}</label>
                            <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">{t('bk.notes')}</label>
                            <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
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

            {/* Loan List */}
            {filtered.length === 0 ? (
                <div className="text-center py-16">
                    <BookOpen size={40} className="mx-auto text-slate-300 mb-3" />
                    <div className="text-slate-400">{t('bk.noLoans')}</div>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map(loan => {
                        const overdue = isOverdue(loan);
                        return (
                            <div key={loan.id}
                                className={`bg-white dark:bg-slate-800 rounded-xl border p-4 flex items-center justify-between hover:shadow-md transition-all ${overdue ? 'border-red-300 dark:border-red-500/40 bg-red-50/50 dark:bg-red-500/5' :
                                        loan.returned_at ? 'border-slate-200 dark:border-slate-700 opacity-60' :
                                            'border-slate-200 dark:border-slate-700'
                                    }`}>
                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${overdue ? 'bg-red-100 text-red-600' :
                                            loan.returned_at ? 'bg-slate-100 text-slate-400' :
                                                'bg-amber-100 text-amber-600'
                                        }`}>
                                        <BookOpen size={18} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-800 dark:text-white truncate">{loan.book_title}</span>
                                            {overdue && (
                                                <span className="flex items-center gap-1 text-xs font-bold px-1.5 py-0.5 bg-red-100 text-red-600 rounded">
                                                    <AlertTriangle size={10} /> {t('bk.overdue')}
                                                </span>
                                            )}
                                            {loan.returned_at && (
                                                <span className="text-xs font-medium px-1.5 py-0.5 bg-emerald-100 text-emerald-600 rounded">
                                                    ✓ {t('bk.returned')}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                                            <span>{studentName(loan.student_id)}</span>
                                            <span>{t('bk.borrowedAt')}: {loan.borrowed_at}</span>
                                            {loan.due_date && <span>{t('bk.dueDate')}: {loan.due_date}</span>}
                                            {loan.notes && <span className="italic">{loan.notes}</span>}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1 flex-shrink-0 ml-3">
                                    {!loan.returned_at && (
                                        <button onClick={() => handleReturn(loan.id)}
                                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors">
                                            <Undo2 size={12} /> {t('bk.returnBook')}
                                        </button>
                                    )}
                                    <button onClick={() => handleDelete(loan.id)}
                                        className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50"><Trash2 size={14} /></button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default BooksPage;
