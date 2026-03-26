import React, { useEffect, useMemo, useState } from 'react';
import type { HandbookPhasePagePlan, HandbookPhasePageConfigItem, RoadmapItem } from '../types';
import { Layers, Minus, Plus } from 'lucide-react';

const FIXED_SYSTEM_PAGES = 3; // Cover + Certificate + Back Cover
const DEFAULT_PHASE_DURATION_MINUTES = 20;
const FIXED_PAGE_KEYS = ['cover', 'certificate', 'backCover'] as const;
type FixedPageKey = typeof FIXED_PAGE_KEYS[number];
const FIXED_PAGE_COUNT: Record<FixedPageKey, number> = {
    cover: 1,
    certificate: 1,
    backCover: 1,
};

function clampNonNegative(value: number): number {
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export interface PhasePageBlueprintItem {
    pageNumber: number;
    section: 'Cover' | 'Table of Contents' | 'Safety' | 'Prop Checklist' | 'Background Knowledge' | 'Activity/Worksheet' | 'Reading' | 'Phase Transition' | 'Reflection' | 'Certificate' | 'Back Cover';
    phaseIndex?: number;
}

function parseTimeRangeBounds(timeRange: string): { start: number; end: number } | null {
    const value = (timeRange || '').trim();
    if (!value) return null;

    const direct = value.match(/(\d+)\s*-\s*(\d+)\s*m?$/i);
    if (direct) {
        const start = Number(direct[1]);
        const end = Number(direct[2]);
        if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
            return { start, end };
        }
    }

    const numbers = value.match(/\d+/g);
    if (!numbers || numbers.length < 2) return null;
    const start = Number(numbers[0]);
    const end = Number(numbers[1]);
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
        return { start, end };
    }

    return null;
}

function estimatePhaseWeight(item: RoadmapItem): number {
    const bounds = parseTimeRangeBounds(item.timeRange);
    const duration = bounds ? bounds.end - bounds.start : DEFAULT_PHASE_DURATION_MINUTES;
    const stepsWeight = Math.min(item.steps?.length || 0, 8) * 2;
    const backgroundWeight = Math.min(item.backgroundInfo?.length || 0, 8) * 1.5;
    const tipsWeight = Math.min(item.teachingTips?.length || 0, 8) * 1.2;
    return Math.max(1, duration + stepsWeight + backgroundWeight + tipsWeight);
}

type PhaseField = keyof Omit<HandbookPhasePageConfigItem, 'phaseIndex'>;

export function autoAllocatePhasePagePlan(
    roadmap: RoadmapItem[],
    targetTotalPages: number,
): HandbookPhasePagePlan {
    const phaseCount = roadmap.length;
    const minimumTotal = FIXED_SYSTEM_PAGES + phaseCount;
    const effectiveTotal = Math.max(minimumTotal, clampNonNegative(targetTotalPages));
    const plan = createEmptyPhasePagePlan(roadmap);
    plan.totalPages = effectiveTotal;

    if (phaseCount > 0) {
        plan.phasePages = roadmap.map((_, phaseIndex) => ({
            phaseIndex,
            backgroundKnowledge: 0,
            activityWorksheet: 1, // ensure validation: each phase has at least one content page
            reading: 0,
            phaseTransition: 0,
        }));
    }

    let remaining = effectiveTotal - (FIXED_SYSTEM_PAGES + phaseCount);

    // Keep system pages lightweight for small targets, richer when page budget allows.
    const systemKeys: Array<keyof HandbookPhasePagePlan['systemPages']> = [
        'tableOfContents',
        'safety',
        'propChecklist',
        'reflection',
    ];
    const systemBudget =
        remaining >= 4 ? 4 :
            remaining >= 2 ? 2 :
                remaining >= 1 ? 1 : 0;
    for (let i = 0; i < systemBudget && remaining > 0; i++) {
        const key = systemKeys[i];
        plan.systemPages[key] += 1;
        remaining -= 1;
    }

    if (remaining <= 0 || phaseCount === 0) {
        return plan;
    }

    const weights = roadmap.map((item) => estimatePhaseWeight(item));
    const fieldDefs: Array<{
        field: PhaseField;
        multiplier: number;
        allow: (phaseIndex: number) => boolean;
    }> = [
            { field: 'activityWorksheet', multiplier: 1.6, allow: () => true },
            { field: 'backgroundKnowledge', multiplier: 1.2, allow: () => true },
            { field: 'reading', multiplier: 1.0, allow: () => true },
            { field: 'phaseTransition', multiplier: 0.6, allow: (phaseIndex: number) => phaseIndex < phaseCount - 1 },
        ];

    while (remaining > 0) {
        let best: { phaseIndex: number; field: PhaseField; score: number } | null = null;

        for (let phaseIndex = 0; phaseIndex < phaseCount; phaseIndex++) {
            const row = plan.phasePages[phaseIndex];
            const weight = weights[phaseIndex] || 1;
            for (const def of fieldDefs) {
                if (!def.allow(phaseIndex)) continue;
                const current = row[def.field];
                const score = (weight * def.multiplier) / (current + 1);
                if (!best || score > best.score) {
                    best = { phaseIndex, field: def.field, score };
                }
            }
        }

        if (!best) break;
        const targetRow = plan.phasePages[best.phaseIndex];
        plan.phasePages[best.phaseIndex] = {
            ...targetRow,
            [best.field]: targetRow[best.field] + 1,
        };
        remaining -= 1;
    }

    // Fallback safety: if any page budget remains (should be rare), put it into reflection.
    if (remaining > 0) {
        plan.systemPages.reflection += remaining;
    }

    return plan;
}

export function createEmptyPhasePagePlan(roadmap: RoadmapItem[]): HandbookPhasePagePlan {
    return {
        totalPages: 0,
        systemPages: {
            tableOfContents: 0,
            safety: 0,
            propChecklist: 0,
            reflection: 0,
        },
        phasePages: roadmap.map((_, phaseIndex) => ({
            phaseIndex,
            backgroundKnowledge: 0,
            activityWorksheet: 0,
            reading: 0,
            phaseTransition: 0,
        })),
    };
}

export function normalizePhasePagePlan(
    plan: HandbookPhasePagePlan | undefined,
    roadmap: RoadmapItem[],
): HandbookPhasePagePlan {
    const base = plan ? { ...plan } : createEmptyPhasePagePlan(roadmap);
    const map = new Map<number, HandbookPhasePageConfigItem>(
        (base.phasePages || []).map((row) => [row.phaseIndex, row]),
    );

    return {
        totalPages: clampNonNegative(base.totalPages),
        systemPages: {
            tableOfContents: clampNonNegative(base.systemPages?.tableOfContents || 0),
            safety: clampNonNegative(base.systemPages?.safety || 0),
            propChecklist: clampNonNegative(base.systemPages?.propChecklist || 0),
            reflection: clampNonNegative(base.systemPages?.reflection || 0),
        },
        phasePages: roadmap.map((_, phaseIndex) => {
            const row = map.get(phaseIndex);
            return {
                phaseIndex,
                backgroundKnowledge: clampNonNegative(row?.backgroundKnowledge || 0),
                activityWorksheet: clampNonNegative(row?.activityWorksheet || 0),
                reading: clampNonNegative(row?.reading || 0),
                phaseTransition: clampNonNegative(row?.phaseTransition || 0),
            };
        }),
    };
}

export function getPhasePlanStats(plan: HandbookPhasePagePlan) {
    const systemPages =
        plan.systemPages.tableOfContents +
        plan.systemPages.safety +
        plan.systemPages.propChecklist +
        plan.systemPages.reflection;
    const phasePages = plan.phasePages.reduce(
        (sum, row) =>
            sum + row.backgroundKnowledge + row.activityWorksheet + row.reading + row.phaseTransition,
        0,
    );
    const allocated = FIXED_SYSTEM_PAGES + systemPages + phasePages;
    return {
        fixedPages: FIXED_SYSTEM_PAGES,
        systemPages,
        phasePages,
        allocated,
        remaining: plan.totalPages - allocated,
    };
}

export function buildPhasePageBlueprint(
    plan: HandbookPhasePagePlan,
): PhasePageBlueprintItem[] {
    const items: PhasePageBlueprintItem[] = [];
    let pageNumber = 1;
    const push = (section: PhasePageBlueprintItem['section'], count: number, phaseIndex?: number) => {
        const safeCount = clampNonNegative(count);
        for (let i = 0; i < safeCount; i++) {
            items.push({
                pageNumber,
                section,
                phaseIndex,
            });
            pageNumber += 1;
        }
    };

    push('Cover', 1);
    push('Table of Contents', plan.systemPages.tableOfContents);
    push('Safety', plan.systemPages.safety);
    push('Prop Checklist', plan.systemPages.propChecklist);

    const sortedPhaseRows = [...plan.phasePages].sort((a, b) => a.phaseIndex - b.phaseIndex);
    for (const row of sortedPhaseRows) {
        push('Background Knowledge', row.backgroundKnowledge, row.phaseIndex);
        push('Activity/Worksheet', row.activityWorksheet, row.phaseIndex);
        push('Reading', row.reading, row.phaseIndex);
        push('Phase Transition', row.phaseTransition, row.phaseIndex);
    }

    push('Reflection', plan.systemPages.reflection);
    push('Certificate', 1);
    push('Back Cover', 1);

    return items;
}

export function validatePhasePagePlan(
    plan: HandbookPhasePagePlan,
    roadmapLength: number,
): { valid: boolean; reason?: string } {
    if (!plan.totalPages || plan.totalPages <= 0) {
        return { valid: false, reason: 'Please set total handbook pages (> 0).' };
    }
    if (plan.phasePages.length !== roadmapLength) {
        return { valid: false, reason: 'Phase page configuration does not match roadmap phase count.' };
    }
    const stats = getPhasePlanStats(plan);
    if (stats.allocated !== plan.totalPages) {
        return {
            valid: false,
            reason: `Allocated ${stats.allocated} pages, target is ${plan.totalPages}.`,
        };
    }
    for (const row of plan.phasePages) {
        if (row.activityWorksheet + row.reading < 1) {
            return {
                valid: false,
                reason: `Phase ${row.phaseIndex + 1} must have at least 1 Activity/Worksheet or Reading page.`,
            };
        }
    }
    return { valid: true };
}

type PlannerProps = {
    roadmap: RoadmapItem[];
    value: HandbookPhasePagePlan;
    onChange: (plan: HandbookPhasePagePlan) => void;
    lang: 'en' | 'zh';
};

export const PhaseHandbookPlanner: React.FC<PlannerProps> = ({ roadmap, value, onChange, lang }) => {
    const stats = getPhasePlanStats(value);
    const pageBlueprint = useMemo(() => buildPhasePageBlueprint(value), [value]);
    const [draftTotalPages, setDraftTotalPages] = useState<number>(value.totalPages);
    const minTotalPages = useMemo(() => FIXED_SYSTEM_PAGES + roadmap.length, [roadmap.length]);
    const fixedPageLabels: Record<FixedPageKey, string> = {
        cover: 'Cover / 封面',
        certificate: 'Certificate / 证书',
        backCover: 'Back Cover / 封底',
    };

    useEffect(() => {
        setDraftTotalPages(value.totalPages);
    }, [value.totalPages]);

    const updateSystem = (key: keyof HandbookPhasePagePlan['systemPages'], delta: number) => {
        onChange({
            ...value,
            systemPages: {
                ...value.systemPages,
                [key]: clampNonNegative(value.systemPages[key] + delta),
            },
        });
    };

    const updatePhaseField = (
        phaseIndex: number,
        key: keyof Omit<HandbookPhasePageConfigItem, 'phaseIndex'>,
        delta: number,
    ) => {
        onChange({
            ...value,
            phasePages: value.phasePages.map((row) =>
                row.phaseIndex === phaseIndex ? { ...row, [key]: clampNonNegative(row[key] + delta) } : row,
            ),
        });
    };

    const handleConfirmAutoAllocate = () => {
        const requested = Math.max(minTotalPages, clampNonNegative(draftTotalPages));
        const allocatedPlan = autoAllocatePhasePagePlan(roadmap, requested);
        onChange(allocatedPlan);
        setDraftTotalPages(allocatedPlan.totalPages);
    };

    return (
        <div className="bg-white dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-white/10 p-4 space-y-3">
            <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-bold">
                <Layers size={16} className="text-emerald-600" />
                Phase2 Handbook Phase Allocation
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-slate-200 dark:border-white/10 p-3">
                    <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">
                        Target Total Pages
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            min={minTotalPages}
                            value={draftTotalPages}
                            onChange={(e) => setDraftTotalPages(clampNonNegative(Number(e.target.value) || 0))}
                            className="w-28 px-2 py-1 rounded border border-slate-200 dark:border-white/10 bg-transparent font-semibold"
                        />
                        <button
                            onClick={handleConfirmAutoAllocate}
                            className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors"
                        >
                            Confirm
                        </button>
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                        Smart allocation runs after confirm. Minimum pages = {minTotalPages} (fixed 3 + {roadmap.length} phases).
                    </div>
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-white/10 p-3">
                    <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">
                        Current Allocation
                    </div>
                    <div className="text-sm text-slate-700 dark:text-slate-300">
                        Allocated {stats.allocated} pages
                    </div>
                    <div className={`text-xs mt-1 ${stats.remaining === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                        Delta {stats.remaining} pages
                    </div>
                </div>
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-white/10 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">
                    Fixed System Pages
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {FIXED_PAGE_KEYS.map((key) => (
                        <div
                            key={key}
                            className="flex items-center justify-between rounded border border-slate-100 dark:border-white/5 px-2 py-1.5 bg-slate-50/70 dark:bg-slate-800/40"
                        >
                            <span className="text-sm">{fixedPageLabels[key]}</span>
                            <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                                x{FIXED_PAGE_COUNT[key]}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-white/10 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">
                    Adjustable System Pages
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {[
                        ['tableOfContents', 'Table of Contents'],
                        ['safety', 'Safety'],
                        ['propChecklist', 'Prop Checklist'],
                        ['reflection', 'Reflection'],
                    ].map(([key, label]) => (
                        <div
                            key={key}
                            className="flex items-center justify-between rounded border border-slate-100 dark:border-white/5 px-2 py-1.5"
                        >
                            <span className="text-sm">{label}</span>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => updateSystem(key as keyof HandbookPhasePagePlan['systemPages'], -1)}
                                    className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center"
                                >
                                    <Minus size={12} />
                                </button>
                                <span className="w-6 text-center text-sm font-semibold">
                                    {value.systemPages[key as keyof HandbookPhasePagePlan['systemPages']]}
                                </span>
                                <button
                                    onClick={() => updateSystem(key as keyof HandbookPhasePagePlan['systemPages'], 1)}
                                    className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center"
                                >
                                    <Plus size={12} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-white/10 p-3 space-y-2">
                <div className="text-xs uppercase tracking-wide text-slate-400">
                    Per-phase Detailed Allocation
                </div>
                {value.phasePages.map((row) => {
                    const phase = roadmap[row.phaseIndex];
                    const activityName = (phase?.activity || '').trim();
                    const phasePrefix = lang === 'zh' ? '阶段' : 'Phase';
                    const phaseHeader = activityName || (lang === 'zh' ? '未命名活动' : 'Untitled Activity');
                    return (
                        <div key={row.phaseIndex} className="rounded border border-slate-100 dark:border-white/5 p-2">
                            <div className="text-sm font-semibold mb-2 text-slate-700 dark:text-slate-200">
                                {phasePrefix} {row.phaseIndex + 1}: {phaseHeader}
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {[
                                    ['backgroundKnowledge', 'Background'],
                                    ['activityWorksheet', 'Activity'],
                                    ['reading', 'Reading'],
                                    ['phaseTransition', 'Transition'],
                                ].map(([key, label]) => (
                                    <div
                                        key={key}
                                        className="flex items-center justify-between rounded border border-slate-100 dark:border-white/5 px-2 py-1.5"
                                    >
                                        <span className="text-xs">{label}</span>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() =>
                                                    updatePhaseField(
                                                        row.phaseIndex,
                                                        key as keyof Omit<HandbookPhasePageConfigItem, 'phaseIndex'>,
                                                        -1,
                                                    )
                                                }
                                                className="w-5 h-5 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center"
                                            >
                                                <Minus size={10} />
                                            </button>
                                            <span className="w-5 text-center text-xs font-semibold">
                                                {row[key as keyof Omit<HandbookPhasePageConfigItem, 'phaseIndex'>]}
                                            </span>
                                            <button
                                                onClick={() =>
                                                    updatePhaseField(
                                                        row.phaseIndex,
                                                        key as keyof Omit<HandbookPhasePageConfigItem, 'phaseIndex'>,
                                                        1,
                                                    )
                                                }
                                                className="w-5 h-5 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center"
                                            >
                                                <Plus size={10} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-white/10 p-3 space-y-2">
                <div className="text-xs uppercase tracking-wide text-slate-400">
                    Page-by-page Sequence (Continuous PageNumber)
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                    {pageBlueprint.map((row) => {
                        const phase = row.phaseIndex !== undefined ? roadmap[row.phaseIndex] : null;
                        const activityName = (phase?.activity || '').trim();
                        const phaseLabel = row.phaseIndex !== undefined
                            ? `${lang === 'zh' ? '阶段' : 'Phase'} ${row.phaseIndex + 1}${activityName ? ` · ${activityName}` : ''}`
                            : (lang === 'zh' ? '系统页' : 'System');
                        return (
                            <div
                                key={`${row.pageNumber}-${row.section}-${row.phaseIndex ?? 'system'}`}
                                className="flex items-center justify-between rounded border border-slate-100 dark:border-white/5 px-2 py-1.5 text-xs"
                            >
                                <span className="font-semibold text-slate-700 dark:text-slate-200">#{row.pageNumber}</span>
                                <span className="text-slate-600 dark:text-slate-300">{row.section}</span>
                                <span className="text-slate-400 truncate ml-2">{phaseLabel}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
