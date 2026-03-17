import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    CheckCircle2, AlertTriangle, AlertCircle, Info,
    Sparkles, Loader2, Eye, X, ShieldCheck, Wand2,
    ClipboardCheck, ChevronDown, ChevronUp, Check, RotateCcw,
} from 'lucide-react';
import type { GeneratedContent } from '../types';
import { runStaticReview, reviewSummary } from '../utils/lessonReviewEngine';
import type { ReviewItem, ReviewSeverity } from '../utils/lessonReviewEngine';
import { runAIReview, applyReviewFix } from '../services/lessonReviewAI';
import type { ApplyFixResult } from '../services/lessonReviewAI';

interface ReviewPanelProps {
    content: GeneratedContent;
    level: string;
    onHighlightStage?: (stageIndex: number) => void;
    onApprove?: () => void;
    onContentUpdate?: (updated: GeneratedContent) => void;
}

const SEVERITY_CONFIG: Record<ReviewSeverity, { icon: React.ElementType; color: string; bg: string; ring: string }> = {
    pass: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', ring: 'ring-emerald-200' },
    info: { icon: Info, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', ring: 'ring-blue-200' },
    warning: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20', ring: 'ring-amber-200' },
    error: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20', ring: 'ring-red-200' },
};

/**
 * Review Panel — "margin annotation" layout.
 *
 * This component renders in TWO parts:
 *   1. An inline toggle bar at the TOP of the lesson plan (always visible)
 *   2. A fixed side panel that sits in the RIGHT MARGIN of the page,
 *      outside the content max-width, so the lesson plan is never
 *      covered or shrunk.
 *
 * The panel uses position:fixed and calculates its `left` from the
 * BodyContainer's right edge.
 */
export const ReviewPanel: React.FC<ReviewPanelProps> = ({ content, level, onHighlightStage, onApprove, onContentUpdate }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());
    const [applied, setApplied] = useState<Set<string>>(new Set());
    const [applying, setApplying] = useState<string | null>(null);
    const [aiItems, setAiItems] = useState<ReviewItem[]>([]);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const [aiDone, setAiDone] = useState(false);
    const [panelLeft, setPanelLeft] = useState<number | null>(null);
    const anchorRef = useRef<HTMLDivElement>(null);
    const [pendingDiff, setPendingDiff] = useState<{ itemId: string; result: ApplyFixResult } | null>(null);

    const staticItems = useMemo(() => runStaticReview(content, level), [content, level]);
    const allItems = useMemo(() => [...staticItems, ...aiItems], [staticItems, aiItems]);
    const visibleItems = useMemo(() => allItems.filter(item => !dismissed.has(item.id) && !applied.has(item.id)), [allItems, dismissed, applied]);
    const summary = useMemo(() => reviewSummary(visibleItems), [visibleItems]);

    // Measure where the content card's right edge is → panel starts there
    useEffect(() => {
        const measure = () => {
            const bodyContainer = anchorRef.current?.closest('.review-panel-boundary') as HTMLElement | null;
            if (bodyContainer) {
                const rect = bodyContainer.getBoundingClientRect();
                const right = rect.right;
                // If there's not enough space on the right (< 340px), fallback to overlay mode
                const spaceOnRight = window.innerWidth - right;
                if (spaceOnRight >= 340) {
                    setPanelLeft(right + 8); // 8px gap
                } else {
                    setPanelLeft(null); // will use fallback overlay
                }
            }
        };
        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, [isOpen]);

    const handleDismiss = useCallback((id: string) => {
        setDismissed(prev => new Set(prev).add(id));
    }, []);

    const handleApply = useCallback(async (item: ReviewItem) => {
        if (!onContentUpdate) return;
        setApplying(item.id);
        try {
            const result = await applyReviewFix(item, content);
            // Show diff preview instead of applying directly
            setPendingDiff({ itemId: item.id, result });
        } catch (err: any) {
            console.error('[ReviewPanel] Apply fix failed:', err);
            alert(`修复失败: ${err.message || '未知错误'}`);
        } finally {
            setApplying(null);
        }
    }, [content, onContentUpdate]);

    const handleDiffConfirm = useCallback(() => {
        if (!pendingDiff || !onContentUpdate) return;
        onContentUpdate(pendingDiff.result.updatedContent);
        setApplied(prev => new Set(prev).add(pendingDiff.itemId));
        setPendingDiff(null);
    }, [pendingDiff, onContentUpdate]);

    const handleDiffReject = useCallback(() => {
        setPendingDiff(null);
    }, []);

    const handleAIReview = useCallback(async () => {
        setAiLoading(true);
        setAiError(null);
        try {
            const items = await runAIReview(content);
            setAiItems(items);
            setAiDone(true);
        } catch (err: any) {
            setAiError(err.message || 'AI 审查失败');
        } finally {
            setAiLoading(false);
        }
    }, [content]);

    const handleHighlight = useCallback((stageIndex: number) => {
        const el = document.querySelector(`[data-stage-index="${stageIndex}"]`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('ring-2', 'ring-blue-400', 'ring-offset-2');
            setTimeout(() => el.classList.remove('ring-2', 'ring-blue-400', 'ring-offset-2'), 3000);
        }
        onHighlightStage?.(stageIndex);
    }, [onHighlightStage]);

    useEffect(() => {
        setAiItems([]);
        setAiDone(false);
        setAiError(null);
        setDismissed(new Set());
        setApplied(new Set());
    }, [content]);

    const issueCount = summary.warning + summary.error + summary.info;
    const isApproved = content.qualityGate?.status === 'ok';

    // Determine if we use margin mode or overlay fallback
    const useMarginMode = panelLeft !== null;

    const panelStyle: React.CSSProperties = useMarginMode
        ? { position: 'fixed', left: panelLeft!, top: 56, bottom: 0, width: 340 }          // 56 = header height approx
        : { position: 'fixed', right: 0, top: 0, bottom: 0, width: 380 };                  // fallback: old overlay

    return (
        <>
            {/* ─── Inline toggle bar ─── */}
            <div ref={anchorRef} className="print:hidden flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 px-4 py-2 mb-4">
                <div className="flex items-center gap-3">
                    <ClipboardCheck size={16} className="text-violet-600" />
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">课程审查</span>
                    {/* Badges */}
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
                    {isApproved && <ShieldCheck size={14} className="text-emerald-500" />}
                </div>
                <div className="flex items-center gap-2">
                    {!aiDone && !aiLoading && (
                        <button
                            onClick={handleAIReview}
                            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold bg-violet-600 text-white hover:bg-violet-700 shadow-sm transition-all cursor-pointer"
                            title="AI 深度审查"
                        >
                            <Sparkles size={12} /> AI 深度审查
                        </button>
                    )}
                    {aiLoading && (
                        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-500">
                            <Loader2 size={12} className="animate-spin" /> 审查中...
                        </span>
                    )}
                    {aiDone && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-violet-400">
                            <Sparkles size={10} /> AI 已审查
                        </span>
                    )}
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-semibold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition-all cursor-pointer"
                    >
                        {isOpen ? <><ChevronUp size={12} /> 收起</> : <><ChevronDown size={12} /> 展开 ({issueCount})</>}
                    </button>
                </div>
            </div>

            {aiError && (
                <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs text-red-600 mb-4 print:hidden">
                    {aiError}
                </div>
            )}

            {/* ─── Side panel (in right margin or overlay fallback) ─── */}
            {isOpen && (
                <>
                    {/* Backdrop only for overlay fallback mode */}
                    {!useMarginMode && (
                        <div className="fixed inset-0 bg-black/10 z-40 print:hidden" onClick={() => setIsOpen(false)} />
                    )}
                    <div
                        style={panelStyle}
                        className={`z-50 flex flex-col print:hidden ${useMarginMode
                            ? 'bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-l border-slate-200 dark:border-slate-700 rounded-tl-xl shadow-lg'
                            : 'bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 shadow-2xl'
                            }`}
                    >
                        {/* Panel header */}
                        <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 shrink-0">
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                📋 审查详情 · {visibleItems.length} 条
                            </span>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="flex items-center justify-center w-6 h-6 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                title="关闭"
                            >
                                <X size={14} className="text-slate-400" />
                            </button>
                        </div>

                        {/* Items list */}
                        <div className="flex-1 overflow-y-auto">
                            {visibleItems.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                                    <CheckCircle2 size={32} className="text-emerald-300 mb-2" />
                                    <p className="text-xs font-medium">所有审查项均已通过</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                    {visibleItems.map(item => {
                                        const config = SEVERITY_CONFIG[item.severity];
                                        const Icon = config.icon;
                                        const isAI = item.id.startsWith('ai-');
                                        const isApplyingThis = applying === item.id;
                                        const canApply = !!onContentUpdate && (!!item.field || typeof item.stageIndex === 'number');
                                        const isDiffPending = pendingDiff?.itemId === item.id;
                                        return (
                                            <div key={item.id} className="px-3 py-2.5 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                                <div className="flex items-start gap-1.5">
                                                    <Icon size={14} className={`${config.color} mt-0.5 shrink-0`} />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate">{item.section}</span>
                                                            {isAI && (
                                                                <span className="text-[8px] bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400 rounded px-1 py-px font-semibold shrink-0">AI</span>
                                                            )}
                                                        </div>
                                                        <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">{item.issue}</p>
                                                        <p className="text-[10px] text-slate-500 mt-1 leading-relaxed bg-slate-50 dark:bg-slate-800/50 rounded px-1.5 py-1">
                                                            💡 {item.suggestion}
                                                        </p>
                                                        {/* Diff Preview Card — inline below the item */}
                                                        {isDiffPending && pendingDiff && (
                                                            <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50/80 dark:bg-blue-900/20 dark:border-blue-800 p-2.5 animate-fade-in-up">
                                                                <div className="text-[10px] font-bold text-blue-700 dark:text-blue-300 mb-1.5">↔️ 修改对比预览 · {pendingDiff.result.fixTarget}</div>
                                                                <div className="grid grid-cols-1 gap-1.5">
                                                                    <div className="rounded bg-red-50/80 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 p-1.5">
                                                                        <div className="text-[9px] font-bold text-red-500 mb-0.5">− 修改前</div>
                                                                        <pre className="text-[10px] text-red-700 dark:text-red-300 whitespace-pre-wrap break-words max-h-24 overflow-y-auto leading-relaxed">{pendingDiff.result.originalText}</pre>
                                                                    </div>
                                                                    <div className="rounded bg-emerald-50/80 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50 p-1.5">
                                                                        <div className="text-[9px] font-bold text-emerald-500 mb-0.5">+ 修改后</div>
                                                                        <pre className="text-[10px] text-emerald-700 dark:text-emerald-300 whitespace-pre-wrap break-words max-h-24 overflow-y-auto leading-relaxed">{pendingDiff.result.appliedText}</pre>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-1.5 mt-2">
                                                                    <button
                                                                        onClick={handleDiffConfirm}
                                                                        className="flex items-center gap-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 text-[10px] font-semibold transition-colors cursor-pointer"
                                                                        title="确认应用修改"
                                                                    >
                                                                        <Check size={10} /> 确认应用
                                                                    </button>
                                                                    <button
                                                                        onClick={handleDiffReject}
                                                                        className="flex items-center gap-1 rounded border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 px-2 py-1 text-[10px] font-semibold transition-colors cursor-pointer"
                                                                        title="撤回修改"
                                                                    >
                                                                        <RotateCcw size={10} /> 撤回
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {/* Action buttons */}
                                                        {!isDiffPending && (
                                                            <div className="flex items-center gap-1.5 mt-1.5">
                                                                {canApply && (
                                                                    <button
                                                                        onClick={() => handleApply(item)}
                                                                        disabled={isApplyingThis}
                                                                        className="flex items-center gap-1 rounded bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-600 px-1.5 py-0.5 text-[10px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
                                                                        title="AI 自动修复此项"
                                                                    >
                                                                        {isApplyingThis ? <Loader2 size={10} className="animate-spin" /> : <Wand2 size={10} />}
                                                                        {isApplyingThis ? '修复中...' : 'Apply'}
                                                                    </button>
                                                                )}
                                                                {typeof item.stageIndex === 'number' && (
                                                                    <button
                                                                        onClick={() => handleHighlight(item.stageIndex!)}
                                                                        className="flex items-center gap-1 rounded bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-700 text-slate-500 px-1.5 py-0.5 text-[10px] font-semibold transition-colors cursor-pointer"
                                                                        title="定位到该阶段"
                                                                    >
                                                                        <Eye size={10} /> 定位
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => handleDismiss(item.id)}
                                                                    className="flex items-center gap-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 px-1.5 py-0.5 text-[10px] transition-colors cursor-pointer"
                                                                    title="忽略此项"
                                                                >
                                                                    <X size={10} /> 忽略
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Approve button — inline after items */}
                            <div className="px-3 py-3">
                                {isApproved ? (
                                    <div className="flex items-center justify-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 py-2 text-xs font-semibold text-emerald-700">
                                        <ShieldCheck size={14} />
                                        审查已通过
                                    </div>
                                ) : (
                                    <button
                                        onClick={onApprove}
                                        disabled={!onApprove}
                                        className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white py-2 text-xs font-semibold transition-colors shadow-sm cursor-pointer"
                                    >
                                        <ShieldCheck size={14} />
                                        审查通过 · 标记为 Ready
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </>
    );
};
