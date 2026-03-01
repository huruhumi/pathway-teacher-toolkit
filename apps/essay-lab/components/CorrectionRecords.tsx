import React, { useState, useMemo } from 'react';
import { SavedRecord, StudentGrade, CEFRLevel } from '../types';
import ReportDisplay from './ReportDisplay';
import { History, Trash2, ChevronRight, ArrowLeft, School, Gauge, Calendar, Award, FileText, Filter } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

const STORAGE_KEY = 'essay_lab_records';

export function getRecords(): SavedRecord[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

export function saveRecord(record: SavedRecord) {
    const records = getRecords();
    records.unshift(record);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function deleteRecord(id: string) {
    const records = getRecords().filter(r => r.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

const CorrectionRecords: React.FC = () => {
    const { t } = useLanguage();
    const [records, setRecords] = useState<SavedRecord[]>(getRecords);
    const [viewingReport, setViewingReport] = useState<SavedRecord | null>(null);
    const [filterGrade, setFilterGrade] = useState<string>('all');
    const [filterCefr, setFilterCefr] = useState<string>('all');

    const filtered = useMemo(() => {
        return records.filter(r => {
            if (filterGrade !== 'all' && r.grade !== filterGrade) return false;
            if (filterCefr !== 'all' && r.cefr !== filterCefr) return false;
            return true;
        });
    }, [records, filterGrade, filterCefr]);

    const handleDelete = (id: string) => {
        if (!confirm(t('records.deleteConfirm'))) return;
        deleteRecord(id);
        setRecords(getRecords());
    };

    if (viewingReport) {
        return (
            <div className="max-w-5xl mx-auto px-4 py-6">
                <button
                    onClick={() => setViewingReport(null)}
                    className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-medium mb-4 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    {t('records.back')}
                </button>
                <ReportDisplay report={viewingReport.report} onReset={() => setViewingReport(null)} readOnly />
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                        <History className="w-5 h-5 text-indigo-600" />
                    </div>
                    {t('records.title')}
                    <span className="text-sm font-normal text-slate-400 ml-1">({filtered.length})</span>
                </h2>
            </div>

            {/* Filters */}
            {records.length > 0 && (
                <div className="flex flex-wrap gap-3 items-center">
                    <Filter className="w-4 h-4 text-slate-400" />
                    <select
                        value={filterGrade}
                        onChange={e => setFilterGrade(e.target.value)}
                        className="text-sm border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-900/60 dark:text-slate-300 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none"
                    >
                        <option value="all">{t('records.filterAll')}</option>
                        {Object.values(StudentGrade).map(g => (
                            <option key={g} value={g}>{g}</option>
                        ))}
                    </select>
                    <select
                        value={filterCefr}
                        onChange={e => setFilterCefr(e.target.value)}
                        className="text-sm border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-900/60 dark:text-slate-300 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none"
                    >
                        <option value="all">{t('records.filterAll')}</option>
                        {Object.values(CEFRLevel).map(c => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* Record List */}
            {filtered.length === 0 ? (
                <div className="text-center py-20 space-y-4">
                    <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto">
                        <FileText className="w-8 h-8 text-slate-300" />
                    </div>
                    <p className="text-slate-400 max-w-sm mx-auto">{t('records.empty')}</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {filtered.map(record => (
                        <div
                            key={record.id}
                            className="bg-white dark:bg-slate-900/80 dark:backdrop-blur-xl rounded-xl border border-slate-200 dark:border-white/5 p-5 hover:shadow-md hover:border-indigo-200 dark:hover:border-white/10 transition-all group"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2 mb-2">
                                        <span className="inline-flex items-center gap-1 text-xs font-medium bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md">
                                            <School className="w-3 h-3" /> {record.grade}
                                        </span>
                                        <span className="inline-flex items-center gap-1 text-xs font-medium bg-purple-50 text-purple-700 px-2 py-1 rounded-md">
                                            <Gauge className="w-3 h-3" /> {record.cefr}
                                        </span>
                                        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-md ${record.report.overallGrade.startsWith('A') ? 'bg-emerald-50 text-emerald-700' :
                                            record.report.overallGrade.startsWith('B') ? 'bg-blue-50 text-blue-700' :
                                                'bg-amber-50 text-amber-700'
                                            }`}>
                                            <Award className="w-3 h-3" /> {record.report.overallGrade}
                                        </span>
                                        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                                            <Calendar className="w-3 h-3" />
                                            {new Date(record.timestamp).toLocaleDateString()}
                                        </span>
                                    </div>
                                    {record.topicText && (
                                        <p className="text-sm font-medium text-slate-700 mb-1 truncate">
                                            {record.topicText}
                                        </p>
                                    )}
                                    <p className="text-sm text-slate-500 line-clamp-2">
                                        {record.report.originalText?.substring(0, 120)}...
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        onClick={() => setViewingReport(record)}
                                        className="flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-lg transition-colors"
                                    >
                                        {t('records.viewReport')}
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(record.id)}
                                        className="text-slate-300 hover:text-rose-500 p-2 rounded-lg hover:bg-rose-50 transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CorrectionRecords;
