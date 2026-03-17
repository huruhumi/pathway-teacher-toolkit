import React, { useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, ClipboardCheck, ChevronDown, ChevronUp } from 'lucide-react';
import type { ESLCurriculum } from '../types';
import { runCurriculumReview, curriculumReviewSummary } from '../utils/curriculumReviewEngine';
import type { CurriculumReviewItem, CurriculumReviewSeverity } from '../utils/curriculumReviewEngine';

const SEVERITY_CONFIG: Record<CurriculumReviewSeverity, { icon: React.ElementType; color: string; bg: string }> = {
    pass: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    info: { icon: Info, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    warning: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
    error: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
};

interface CurriculumReviewPanelProps {
    curriculum: ESLCurriculum;
    onScrollToLesson?: (lessonIndex: number) => void;
}

export const CurriculumReviewPanel: React.FC<CurriculumReviewPanelProps> = ({ curriculum, onScrollToLesson }) => {
    const [isOpen, setIsOpen] = useState(false);
    const items = useMemo(() => runCurriculumReview(curriculum), [curriculum]);
    const summary = useMemo(() => curriculumReviewSummary(items), [items]);
    const issueCount = summary.warning + summary.error + summary.info;

    return (
        <div className="print:hidden">
            {/* Toggle bar */}
            <div className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 px-4 py-2">
                <div className="flex items-center gap-3">
                    <ClipboardCheck size={16} className="text-violet-600" />
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">大纲审查</span>
                    {summary.error > 0 && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 dark:bg-red-900/20 rounded-full px-2 py-0.5">
                            <AlertCircle size={10} /> {summary.error}
                        </span>
                    )}
                    {summary.warning > 0 && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-full px-2 py-0.5">
                            <AlertTriangle size={10} /> {summary.warning}
                        </span>
                    )}
                    {summary.info > 0 && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 rounded-full px-2 py-0.5">
                            <Info size={10} /> {summary.info}
                        </span>
                    )}
                    {issueCount === 0 && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                            <CheckCircle2 size={10} /> 全部通过
                        </span>
                    )}
                </div>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-semibold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition-all cursor-pointer"
                >
                    {isOpen ? <><ChevronUp size={12} /> 收起</> : <><ChevronDown size={12} /> 展开 ({issueCount})</>}
                </button>
            </div>

            {/* Items */}
            {isOpen && (
                <div className="mt-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 divide-y divide-slate-50 dark:divide-slate-800/50 overflow-hidden">
                    {items.filter((i) => i.severity !== 'pass').length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                            <CheckCircle2 size={28} className="text-emerald-300 mb-2" />
                            <p className="text-xs font-medium">所有维度均已通过审查</p>
                        </div>
                    ) : (
                        items.filter((i) => i.severity !== 'pass').map((item) => {
                            const config = SEVERITY_CONFIG[item.severity];
                            const Icon = config.icon;
                            return (
                                <div key={item.id} className="px-4 py-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                    <div className="flex items-start gap-2">
                                        <Icon size={14} className={`${config.color} mt-0.5 shrink-0`} />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">{item.dimension}</span>
                                            </div>
                                            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">{item.issue}</p>
                                            {item.suggestion && (
                                                <p className="text-[10px] text-slate-500 mt-1 leading-relaxed bg-slate-50 dark:bg-slate-800/50 rounded px-1.5 py-1">
                                                    💡 {item.suggestion}
                                                </p>
                                            )}
                                            {item.affectedLessons && item.affectedLessons.length > 0 && onScrollToLesson && (
                                                <div className="flex flex-wrap gap-1 mt-1.5">
                                                    {item.affectedLessons.map((li) => (
                                                        <button
                                                            key={li}
                                                            onClick={() => onScrollToLesson(li)}
                                                            className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 hover:bg-violet-100 transition-colors cursor-pointer"
                                                            title={`定位到课 ${li + 1}`}
                                                        >
                                                            课 {li + 1}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}

                    {/* Pass items summary */}
                    {summary.pass > 0 && (
                        <div className="px-4 py-2 bg-emerald-50/50 dark:bg-emerald-900/10 text-[10px] text-emerald-600 font-medium">
                            ✅ {summary.pass} 个维度通过审查
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
