import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuthStore } from '@shared/stores/useAuthStore';
import * as edu from '@pathway/education';
import type { ReadingLog } from '@pathway/education';
import { BookOpen, Clock, Layers, Plus, CheckCircle2, Loader2, Send } from 'lucide-react';

export const ReadingView: React.FC = () => {
    const { t, lang } = useLanguage();
    const user = useAuthStore(s => s.user);
    const studentId = user?.id;
    // We need the teacher_id to save the log. We can get it from the student's profile.
    const [teacherId, setTeacherId] = useState<string | null>(null);

    const [logs, setLogs] = useState<ReadingLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    // The actual students table ID (not auth user ID)
    const [dbStudentId, setDbStudentId] = useState<string | null>(null);

    // Form state
    const [bookTitle, setBookTitle] = useState('');
    const [duration, setDuration] = useState('');
    const [pages, setPages] = useState('');
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const load = useCallback(async () => {
        if (!studentId) { setLoading(false); return; }
        setLoading(true);
        try {
            // Step 1: Resolve auth user ID -> student record
            const profile = await edu.fetchStudentProfile(studentId);
            if (profile) {
                setTeacherId(profile.teacher_id);
                setDbStudentId(profile.id);
                // Step 2: Fetch reading logs by student's DB id
                const data = await edu.fetchReadingLogsByStudent(profile.id);
                setLogs(data);
            }
        } catch (err) {
            console.error('[ReadingView] load error:', err);
        } finally {
            setLoading(false);
        }
    }, [studentId]);

    useEffect(() => { load(); }, [load]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!dbStudentId || !teacherId) return;

        setSubmitting(true);
        try {
            await edu.upsertReadingLog({
                student_id: dbStudentId,
                teacher_id: teacherId,
                book_title: bookTitle,
                duration_minutes: parseInt(duration),
                pages_read: parseInt(pages),
                notes: notes,
                status: 'pending'
            });
            setIsAdding(false);
            setBookTitle('');
            setDuration('');
            setPages('');
            setNotes('');
            await load();
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-sky-500" size={28} /></div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <BookOpen className="text-sky-500" />
                        {lang === 'en' ? 'Reading Logs' : '阅读打卡'}
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        {lang === 'en' ? 'Track your daily reading progress.' : '记录每天的阅读进度。'}
                    </p>
                </div>
                {!isAdding && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl shadow-sm transition-colors font-bold text-sm"
                    >
                        <Plus size={16} />
                        {lang === 'en' ? 'New Log' : '添加记录'}
                    </button>
                )}
            </div>

            {isAdding && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm animate-in slide-in-from-top-4">
                    <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-white">
                        {lang === 'en' ? 'Log Reading Session' : '填写阅读记录'}
                    </h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">
                                {lang === 'en' ? 'Book Title' : '书名'} *
                            </label>
                            <input
                                required
                                value={bookTitle}
                                onChange={e => setBookTitle(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:border-sky-500 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all text-sm text-slate-800 dark:text-slate-200"
                                placeholder={lang === 'en' ? "e.g., Charlotte's Web" : "例如：《夏洛的网》"}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">
                                    {lang === 'en' ? 'Duration (mins)' : '阅读时长（分钟）'} *
                                </label>
                                <input
                                    required
                                    type="number"
                                    min="1"
                                    value={duration}
                                    onChange={e => setDuration(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:border-sky-500 focus:bg-white outline-none transition-all text-sm text-slate-800 dark:text-slate-200"
                                    placeholder="20"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">
                                    {lang === 'en' ? 'Pages Read' : '阅读页数'} *
                                </label>
                                <input
                                    required
                                    type="number"
                                    min="1"
                                    value={pages}
                                    onChange={e => setPages(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:border-sky-500 focus:bg-white outline-none transition-all text-sm text-slate-800 dark:text-slate-200"
                                    placeholder="15"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">
                                {lang === 'en' ? 'Notes / Summary' : '笔记或感想 (选填)'}
                            </label>
                            <textarea
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:border-sky-500 focus:bg-white outline-none transition-all text-sm min-h-[80px] text-slate-800 dark:text-slate-200"
                                placeholder={lang === 'en' ? "What did you learn today?" : "今天读到了什么有趣的内容？"}
                            />
                        </div>
                        <div className="pt-2 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setIsAdding(false)}
                                className="px-4 py-2 rounded-xl text-slate-500 font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-sm"
                            >
                                {lang === 'en' ? 'Cancel' : '取消'}
                            </button>
                            <button
                                type="submit"
                                disabled={submitting || !dbStudentId || !teacherId}
                                className="flex items-center gap-2 px-6 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl shadow-sm transition-colors font-bold text-sm disabled:opacity-50"
                            >
                                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                {lang === 'en' ? 'Submit' : '提交'}
                            </button>
                        </div>
                        {!teacherId && <p className="text-xs text-red-500 mt-2 text-right">Error: Missing teacher assignment link.</p>}
                    </form>
                </div>
            )}

            <div className="space-y-4">
                {logs.length === 0 && !isAdding ? (
                    <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                        <div className="text-4xl mb-3 text-slate-300">📖</div>
                        <div className="text-slate-400 font-medium">{lang === 'en' ? "You haven't logged any reading yet." : "还没有阅读记录。"}</div>
                    </div>
                ) : (
                    logs.map(log => (
                        <div key={log.id} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row gap-4 sm:items-center">
                            <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-slate-800 dark:text-white truncate text-lg mb-1">{log.book_title}</h4>
                                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                                    <span className="flex items-center gap-1.5"><Clock size={14} className="text-sky-500" /> {log.duration_minutes} {lang === 'en' ? 'mins' : '分钟'}</span>
                                    <span className="flex items-center gap-1.5"><Layers size={14} className="text-violet-500" /> {log.pages_read} {lang === 'en' ? 'pages' : '页'}</span>
                                    <span className="text-xs">{new Date(log.created_at).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US')}</span>
                                </div>
                                {log.notes && (
                                    <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 p-3 rounded-xl italic">
                                        &ldquo;{log.notes}&rdquo;
                                    </p>
                                )}
                            </div>
                            <div className="shrink-0 flex items-center justify-end sm:flex-col gap-2">
                                {log.status === 'reviewed' ? (
                                    <span className="flex items-center gap-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                                        <CheckCircle2 size={14} /> {lang === 'en' ? 'Reviewed' : '老师已阅'}
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1 bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                                        <Clock size={14} /> {lang === 'en' ? 'Pending' : '等待批阅'}
                                    </span>
                                )}
                            </div>
                        </div>))
                )}
            </div>
        </div>
    );
};
