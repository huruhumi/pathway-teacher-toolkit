import React, { useState, useMemo } from 'react';
import { SavedRecord, StudentGrade, CEFRLevel } from '../types';
import ReportDisplay from './ReportDisplay';
import { History, Trash2, ChevronRight, ArrowLeft, School, Gauge, Calendar, Award, FileText, Filter, ShieldAlert, ShieldCheck, Archive, RotateCcw, Loader2 } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuthStore } from '@shared/stores/useAuthStore';
import { useToast } from '@shared/stores/useToast';
import { Modal } from '@shared/components/ui/Modal';
import { fetchCloudRecordsResult, upsertRecordIndexEntry } from '@shared/services/cloudSync';
import { deleteRecord, getRecords, listDeletedRecords, purgeRecord, readDeletedMeta, restoreRecord, setRecords as persistRecords } from '../services/recordsService';
import { assessEssayRecordQuality } from '@shared/config/recordQuality';

const MAX_RECORDS = 100;

const CorrectionRecords: React.FC = () => {
    const { t } = useLanguage();
    const [records, setRecords] = useState<SavedRecord[]>([]);
    const [viewingReport, setViewingReport] = useState<SavedRecord | null>(null);
    const [filterGrade, setFilterGrade] = useState<string>('all');
    const [filterCefr, setFilterCefr] = useState<string>('all');
    const [filterQuality, setFilterQuality] = useState<'all' | 'ok' | 'needs_review'>('all');
    const [isLoaded, setIsLoaded] = useState(false);
    const [showRecycleBin, setShowRecycleBin] = useState(false);
    const [deletedRecords, setDeletedRecords] = useState<SavedRecord[]>([]);
    const [isRecycleLoading, setIsRecycleLoading] = useState(false);
    const [recycleActionId, setRecycleActionId] = useState<string | null>(null);

    React.useEffect(() => {
        (async () => {
            const local = await getRecords();
            setRecords(local);
            setIsLoaded(true);
            let recordsForIndex = local;

            // Merge cloud records if logged in
            const user = useAuthStore.getState().user;
            if (user) {
                const cloudRows = await fetchCloudRecordsResult<any>('essay_records', user.id, 'updated_at', MAX_RECORDS, { includeDeleted: false });
                if (cloudRows.ok) {
                    const mergedById = new Map<string, SavedRecord>();
                    for (const localRecord of local) {
                        mergedById.set(localRecord.id, localRecord);
                    }
                    for (const row of cloudRows.items) {
                        const mapped: SavedRecord = {
                            id: row.id,
                            timestamp: new Date(row.updated_at || row.created_at).getTime(),
                            grade: row.grade,
                            cefr: row.cefr,
                            topicText: row.topic_text || undefined,
                            essayText: row.essay_text || undefined,
                            report: row.report_data,
                        };
                        const existing = mergedById.get(mapped.id);
                        if (!existing || mapped.timestamp >= existing.timestamp) {
                            mergedById.set(mapped.id, mapped);
                        }
                    }
                    const merged = Array.from(mergedById.values())
                        .sort((a, b) => b.timestamp - a.timestamp)
                        .slice(0, MAX_RECORDS);
                    setRecords(merged);
                    await persistRecords(merged);
                    recordsForIndex = merged;
                }

                for (const record of recordsForIndex.slice(0, MAX_RECORDS)) {
                    const quality = assessEssayRecordQuality(record.report as any, record.essayText);
                    await upsertRecordIndexEntry({
                        recordId: record.id,
                        appId: 'essay-lab',
                        recordType: 'essay_report',
                        ownerId: user.id,
                        title: record.topicText || 'Essay Report',
                        searchableText: [
                            record.topicText,
                            record.grade,
                            record.cefr,
                            record.report?.overallGrade,
                            record.report?.originalText?.slice(0, 300),
                        ].filter(Boolean).join(' '),
                        textbookLevelKey: null,
                        cefr: record.cefr,
                        curriculumId: null,
                        unitNumber: null,
                        tags: ['essay', 'correction', ...(quality.status === 'needs_review' ? ['needs-review'] : ['ready'])],
                        qualityStatus: quality.status,
                        updatedAt: new Date().toISOString(),
                    });
                }
            }
        })();
    }, []);

    const qualityMap = useMemo(() => {
        const map = new Map<string, ReturnType<typeof assessEssayRecordQuality>>();
        records.forEach((record) => {
            map.set(record.id, assessEssayRecordQuality(record.report as any, record.essayText));
        });
        return map;
    }, [records]);

    const filtered = useMemo(() => {
        return records.filter(r => {
            if (filterGrade !== 'all' && r.grade !== filterGrade) return false;
            if (filterCefr !== 'all' && r.cefr !== filterCefr) return false;
            if (filterQuality !== 'all') {
                const quality = qualityMap.get(r.id)?.status || 'unknown';
                if (quality !== filterQuality) return false;
            }
            return true;
        });
    }, [records, filterGrade, filterCefr, filterQuality, qualityMap]);

    const handleDelete = async (id: string) => {
        if (!confirm(t('records.deleteConfirm'))) return;
        const result = await deleteRecord(id);
        if (!result.ok) {
            useToast.getState().warning(t('records.deleteCloudFailed') || 'Deleted locally. Cloud delete can be retried.');
        }
        const updated = await getRecords();
        setRecords(updated);
    };

    const loadRecycleBin = async () => {
        setIsRecycleLoading(true);
        try {
            const deleted = await listDeletedRecords();
            setDeletedRecords(deleted);
        } catch (err: any) {
            useToast.getState().error(`Failed to load recycle bin. ${err?.message || 'Unexpected error'}`);
        } finally {
            setIsRecycleLoading(false);
        }
    };

    const openRecycleBin = async () => {
        setShowRecycleBin(true);
        await loadRecycleBin();
    };

    const handleRestore = async (record: SavedRecord) => {
        setRecycleActionId(record.id);
        try {
            const result = await restoreRecord(record.id);
            if (!result.ok) {
                useToast.getState().error(`Restore failed. ${result.message || 'Please retry.'}`);
                return;
            }
            useToast.getState().success('Record restored.');
            const updated = await getRecords();
            setRecords(updated);
            await loadRecycleBin();
        } finally {
            setRecycleActionId(null);
        }
    };

    const handlePurge = async (record: SavedRecord) => {
        const title = record.topicText || record.report?.topicText || 'Essay Report';
        const firstConfirmed = window.confirm(`Permanently delete "${title}"? This cannot be undone.`);
        if (!firstConfirmed) return;
        const secondConfirmed = window.confirm(`Please confirm again: permanently remove "${title}" now?`);
        if (!secondConfirmed) return;

        setRecycleActionId(record.id);
        try {
            const result = await purgeRecord(record.id);
            if (!result.ok) {
                useToast.getState().error(`Permanent delete failed. ${result.message || 'Please retry.'}`);
                return;
            }
            useToast.getState().success('Record permanently deleted.');
            await loadRecycleBin();
        } finally {
            setRecycleActionId(null);
        }
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
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                        <History className="w-5 h-5 text-indigo-600" />
                    </div>
                    {t('records.title')}
                    <span className="text-sm font-normal text-slate-400 ml-1">({filtered.length})</span>
                </h2>
                <button
                    type="button"
                    onClick={() => { void openRecycleBin(); }}
                    className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
                >
                    <Archive className="w-4 h-4" />
                    Recycle Bin
                </button>
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
                    <select
                        value={filterQuality}
                        onChange={e => setFilterQuality(e.target.value as 'all' | 'ok' | 'needs_review')}
                        className="text-sm border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-900/60 dark:text-slate-300 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none"
                    >
                        <option value="all">All Quality</option>
                        <option value="needs_review">Needs Review</option>
                        <option value="ok">Ready</option>
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
                                        {qualityMap.get(record.id)?.status === 'needs_review' ? (
                                            <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-md bg-amber-50 text-amber-700">
                                                <ShieldAlert className="w-3 h-3" /> Needs Review
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-md bg-emerald-50 text-emerald-700">
                                                <ShieldCheck className="w-3 h-3" /> Ready
                                            </span>
                                        )}
                                        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                                            <Calendar className="w-3 h-3" />
                                            {new Date(record.timestamp).toLocaleDateString()}
                                        </span>
                                    </div>
                                    {record.topicText && (
                                        <p className="text-sm font-medium text-slate-700 dark:text-slate-400 mb-1 truncate">
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

            <Modal isOpen={showRecycleBin} onClose={() => setShowRecycleBin(false)} maxWidth="max-w-3xl">
                <div className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Recycle Bin (30 days)</h3>
                            <p className="text-sm text-slate-500">Restore deleted records or permanently delete with double confirmation.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => { void loadRecycleBin(); }}
                            disabled={isRecycleLoading}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                            {isRecycleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                            Refresh
                        </button>
                    </div>

                    {isRecycleLoading ? (
                        <div className="py-10 flex items-center justify-center text-slate-500">
                            <Loader2 className="w-5 h-5 animate-spin mr-2" />
                            Loading...
                        </div>
                    ) : deletedRecords.length === 0 ? (
                        <div className="py-12 text-center text-slate-500">Recycle bin is empty.</div>
                    ) : (
                        <div className="space-y-2 max-h-[70vh] overflow-auto pr-1">
                            {deletedRecords.map((record) => {
                                const deletedMeta = readDeletedMeta(record);
                                const title = record.topicText || record.report?.topicText || 'Essay Report';
                                return (
                                    <div key={`deleted-${record.id}`} className="rounded-xl border border-slate-200 bg-white p-3 flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="font-medium text-slate-800 truncate">{title}</div>
                                            <div className="text-xs text-slate-500">
                                                Deleted: {new Date(deletedMeta.deletedAt).toLocaleString()}
                                                {deletedMeta.purgeAt ? ` · Purge: ${new Date(deletedMeta.purgeAt).toLocaleString()}` : ''}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                type="button"
                                                disabled={recycleActionId === record.id}
                                                onClick={() => { void handleRestore(record); }}
                                                className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                                            >
                                                Restore
                                            </button>
                                            <button
                                                type="button"
                                                disabled={recycleActionId === record.id}
                                                onClick={() => { void handlePurge(record); }}
                                                className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                                            >
                                                Delete Forever
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default CorrectionRecords;
