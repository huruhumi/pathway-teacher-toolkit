import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuthStore } from '@shared/stores/useAuthStore';
import * as edu from '@shared/services/educationService';
import { BookOpen, Search, CheckCircle2, Clock, Loader2, Layers, AlertCircle } from 'lucide-react';
import type { ReadingLog } from '@shared/types/education';

const ReadingLogsPage: React.FC = () => {
    const { t, lang } = useLanguage();
    const teacherId = useAuthStore(s => s.user?.id);
    const [logs, setLogs] = useState<any[]>([]); // Using any to quickly handle the join with student
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState<'all' | 'pending' | 'reviewed'>('all');

    const loadLogs = useCallback(async () => {
        if (!teacherId) { setLoading(false); return; }
        setLoading(true);
        const data = await edu.fetchReadingLogsByTeacher(teacherId);
        setLogs(data);
        setLoading(false);
    }, [teacherId]);

    useEffect(() => { loadLogs(); }, [loadLogs]);

    const handleMarkReviewed = async (log: any) => {
        await edu.upsertReadingLog({
            id: log.id,
            status: 'reviewed'
        });
        await loadLogs();
    };

    const filteredLogs = logs.filter(log => {
        const matchesSearch = log.book_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.student?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (log.student?.english_name && log.student.english_name.toLowerCase().includes(searchTerm.toLowerCase()));

        if (!matchesSearch) return false;

        if (filter === 'all') return true;
        return log.status === filter;
    });

    if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-amber-500" size={32} /></div>;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <BookOpen className="text-amber-500" />
                        {lang === 'zh' ? '阅读打卡记录' : 'Reading Logs'}
                    </h2>
                    <p className="text-slate-500 mt-1 text-sm">
                        {lang === 'zh' ? '查看和批阅学生的每日阅读记录' : 'Review and track student daily reading logs.'}
                    </p>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col sm:flex-row gap-4 items-center justify-between shadow-sm">
                <div className="relative w-full sm:max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder={lang === 'zh' ? '搜索学生或书名...' : 'Search student or book...'}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all text-sm"
                    />
                </div>
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full sm:w-auto overflow-x-auto hide-scrollbar">
                    {(['all', 'pending', 'reviewed'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${filter === f
                                ? 'bg-white dark:bg-slate-700 text-amber-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
                                }`}
                        >
                            {f === 'all' && (lang === 'zh' ? '全部' : 'All')}
                            {f === 'pending' && (lang === 'zh' ? '待批阅' : 'Pending')}
                            {f === 'reviewed' && (lang === 'zh' ? '已阅' : 'Reviewed')}
                        </button>
                    ))}
                </div>
            </div>

            {filteredLogs.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-3xl p-12 text-center text-slate-500">
                    <BookOpen size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                    <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300 mb-2">
                        {lang === 'zh' ? '没有找到阅读记录' : 'No reading logs found'}
                    </h3>
                    <p className="text-sm max-w-sm mx-auto">
                        {lang === 'zh' ? '学生提交的阅读记录将出现在这里。' : 'Reading logs submitted by students will appear here.'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredLogs.map(log => {
                        const studentName = lang === 'zh' ? (log.student?.name || '未知学生') : (log.student?.english_name || log.student?.name || 'Unknown Student');

                        return (
                            <div key={log.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/40 dark:to-orange-900/40 font-bold text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 uppercase">
                                            {studentName.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-800 dark:text-white truncate max-w-[120px] sm:max-w-[150px]">{studentName}</div>
                                            <div className="text-xs text-slate-500 whitespace-nowrap">
                                                {new Date(log.created_at).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    </div>
                                    {log.status === 'reviewed' ? (
                                        <span className="flex items-center gap-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0 overflow-hidden text-ellipsis whitespace-nowrap max-w-[80px]">
                                            <CheckCircle2 size={12} className="shrink-0" /> {lang === 'zh' ? '已阅' : 'Reviewed'}
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1 bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0 overflow-hidden text-ellipsis whitespace-nowrap max-w-[80px]">
                                            <Clock size={12} className="shrink-0" /> {lang === 'zh' ? '待阅' : 'Pending'}
                                        </span>
                                    )}
                                </div>

                                <div className="flex-1">
                                    <h4 className="font-bold text-lg text-slate-800 dark:text-slate-200 mb-2 truncate" title={log.book_title}>
                                        {log.book_title}
                                    </h4>

                                    <div className="flex flex-wrap gap-3 mb-4">
                                        <div className="flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                                            <Clock size={16} className="text-amber-500" />
                                            {log.duration_minutes} {lang === 'zh' ? '分钟' : 'mins'}
                                        </div>
                                        <div className="flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                                            <Layers size={16} className="text-violet-500" />
                                            {log.pages_read} {lang === 'zh' ? '页' : 'pages'}
                                        </div>
                                    </div>

                                    {log.notes && (
                                        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 p-3 rounded-xl mb-4 text-sm text-slate-700 dark:text-slate-300 max-h-32 overflow-y-auto custom-scrollbar italic leading-relaxed">
                                            "{log.notes}"
                                        </div>
                                    )}
                                </div>

                                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                                    {log.status === 'pending' ? (
                                        <button
                                            onClick={() => handleMarkReviewed(log)}
                                            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
                                        >
                                            <CheckCircle2 size={16} />
                                            {lang === 'zh' ? '标记已阅' : 'Mark Reviewed'}
                                        </button>
                                    ) : (
                                        <div className="text-sm font-medium text-slate-400 flex items-center gap-2">
                                            <CheckCircle2 size={16} className="text-emerald-500" />
                                            {lang === 'zh' ? '已阅毕' : 'Review Complete'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ReadingLogsPage;
