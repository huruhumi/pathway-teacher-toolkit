import React, { useState, useMemo } from 'react';
import { HandbookPageConfig, SectionMeta } from '../types';
import { HANDBOOK_SECTIONS, getDefaultPageConfig, getTotalPages } from '../constants/handbookDefaults';
import {
    Bot, Minus, Plus, Lock, Layers,
    BookImage, List, ShieldAlert, ClipboardCheck, Lightbulb,
    PenTool, MessageCircle, Award, BookMarked,
    Sparkles, RotateCcw,
    type LucideIcon,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
    BookImage, List, ShieldAlert, ClipboardCheck, Lightbulb,
    PenTool, MessageCircle, Award, BookMarked,
};

// System page types (non-phase)
const SYSTEM_TYPES = new Set(['Cover', 'Table of Contents', 'Safety', 'Prop Checklist', 'Reflection', 'Certificate', 'Back Cover']);
const FRONT_TYPES = ['Cover', 'Table of Contents', 'Safety', 'Prop Checklist'];
const BACK_TYPES = ['Reflection', 'Certificate', 'Back Cover'];
// Content page types (per-phase)
const CONTENT_TYPES = ['Background Knowledge', 'Activity/Worksheet'];

interface HandbookPageSelectorProps {
    mode: 'auto' | 'preset' | 'custom';
    preset: 'light' | 'standard' | 'full' | 'deep';
    config: HandbookPageConfig[];
    autoPageTarget?: number;
    duration?: number;
    onModeChange: (mode: 'auto' | 'preset' | 'custom') => void;
    onPresetChange: (preset: 'light' | 'standard' | 'full' | 'deep') => void;
    onConfigChange: (config: HandbookPageConfig[]) => void;
    onAutoPageTargetChange?: (target: number) => void;
    lang?: 'en' | 'zh';
}

/** Estimate page count from duration */
function estimatePages(duration: number): number {
    if (duration <= 60) return 15;
    if (duration <= 90) return 20;
    if (duration <= 120) return 25;
    return 30;
}

/** Estimate number of phases based on total content pages */
function estimatePhases(contentPages: number): number {
    // Each phase gets at least 2 content pages (1 BG + 1 Activity)
    // Typically 3-4 pages per phase for a richer experience
    if (contentPages <= 6) return 2;
    if (contentPages <= 12) return 3;
    if (contentPages <= 18) return 4;
    if (contentPages <= 24) return 5;
    return 6;
}

/** Distribute a target page count across all sections intelligently */
function smartDistribute(targetPages: number): HandbookPageConfig[] {
    const config: HandbookPageConfig[] = HANDBOOK_SECTIONS.map(meta => ({
        section: meta.type,
        count: meta.required ? 1 : meta.min,
        enabled: meta.required || meta.min > 0,
    }));

    const currentTotal = () => config.reduce((s, c) => s + (c.enabled ? c.count : 0), 0);

    // Enable all optional sections
    HANDBOOK_SECTIONS.forEach((meta, i) => {
        if (!meta.required && !config[i].enabled) {
            config[i].enabled = true;
            config[i].count = Math.max(1, meta.min);
        }
    });

    let remaining = targetPages - currentTotal();
    if (remaining <= 0) return config;

    // Weights determine priority for extra pages
    const weights: Record<string, number> = {
        'Activity/Worksheet': 10,
        'Background Knowledge': 5,
        'Reflection': 3,
        'Safety': 1,
        'Prop Checklist': 1,
        'Table of Contents': 0,
    };

    const expandable = HANDBOOK_SECTIONS
        .map((meta, i) => ({ meta, i, weight: weights[meta.type] ?? 1 }))
        .filter(({ meta, i }) => config[i].count < meta.max && (weights[meta.type] ?? 1) > 0);

    const totalWeight = expandable.reduce((s, e) => s + e.weight, 0);
    if (totalWeight > 0) {
        expandable.forEach(({ meta, i, weight }) => {
            const bonus = Math.floor((weight / totalWeight) * remaining);
            const newCount = Math.min(meta.max, config[i].count + bonus);
            config[i].count = newCount;
        });
    }

    remaining = targetPages - currentTotal();
    const sorted = [...expandable].sort((a, b) => b.weight - a.weight);
    while (remaining > 0) {
        let filled = false;
        for (const { meta, i } of sorted) {
            if (config[i].count < meta.max && remaining > 0) {
                config[i].count++;
                remaining--;
                filled = true;
            }
        }
        if (!filled) break;
    }

    return config;
}

interface SectionRowProps {
    meta: SectionMeta;
    item: HandbookPageConfig;
    idx: number;
    total: number;
    maxTotal: number;
    isZh: boolean;
    onToggle: (idx: number) => void;
    onCount: (idx: number, delta: number) => void;
}

// Section row component
const SectionRow: React.FC<SectionRowProps> = ({
    meta,
    item,
    idx,
    total,
    maxTotal,
    isZh,
    onToggle,
    onCount,
}) => {
    const isLocked = meta.required;
    const IconComp = ICON_MAP[meta.icon];
    return (
        <div
            className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-all ${item.enabled
                ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 opacity-50'
                }`}
        >
            {isLocked ? (
                <Lock size={14} className="text-slate-400 shrink-0" />
            ) : (
                <input
                    type="checkbox"
                    checked={item.enabled}
                    onChange={() => onToggle(idx)}
                    className="w-4 h-4 rounded border-2 border-slate-300 dark:border-slate-600 bg-transparent checked:bg-emerald-500 checked:border-emerald-500 cursor-pointer accent-slate-500"
                    aria-label={isZh ? `切换 ${meta.label}` : `Toggle ${meta.labelEn}`}
                />
            )}
            {IconComp
                ? <IconComp size={16} className="shrink-0 text-slate-500" />
                : <span className="text-base shrink-0">{meta.icon}</span>
            }
            <span className="text-sm font-medium flex-1 truncate">
                {isZh ? meta.label : meta.labelEn}
            </span>
            {item.enabled && meta.max > 1 && (
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => onCount(idx, -1)}
                        disabled={item.count <= meta.min || (meta.required && item.count <= 1)}
                        className="w-6 h-6 flex items-center justify-center rounded bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200 disabled:opacity-30"
                        title={isZh ? `减少 ${meta.label}` : `Decrease ${meta.labelEn}`}
                    >
                        <Minus size={12} />
                    </button>
                    <span className="w-6 text-center text-sm font-bold tabular-nums">{item.count}</span>
                    <button
                        onClick={() => onCount(idx, 1)}
                        disabled={total >= maxTotal}
                        className="w-6 h-6 flex items-center justify-center rounded bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200 disabled:opacity-30"
                        title={isZh ? `增加 ${meta.label}` : `Increase ${meta.labelEn}`}
                    >
                        <Plus size={12} />
                    </button>
                </div>
            )}
            {item.enabled && meta.max === 1 && (
                <span className="text-xs text-slate-400 tabular-nums">×1</span>
            )}
        </div>
    );
}

export const HandbookPageSelector: React.FC<HandbookPageSelectorProps> = ({
    mode, preset, config, autoPageTarget, duration = 90,
    onModeChange, onPresetChange, onConfigChange, onAutoPageTargetChange, lang = 'en',
}) => {
    const isZh = lang === 'zh';
    const [localAutoTarget, setLocalAutoTarget] = useState(autoPageTarget || estimatePages(duration));
    const [confirmed, setConfirmed] = useState(false);

    const total = getTotalPages(config);

    // Find config indices for content sections
    const bgIdx = HANDBOOK_SECTIONS.findIndex(m => m.type === 'Background Knowledge');
    const actIdx = HANDBOOK_SECTIONS.findIndex(m => m.type === 'Activity/Worksheet');

    // Compute system page count
    const systemTotal = useMemo(() => {
        return config.reduce((s, c) => {
            if (!c.enabled || !SYSTEM_TYPES.has(c.section)) return s;
            return s + c.count;
        }, 0);
    }, [config]);

    const bgTotal = config[bgIdx]?.count || 0;
    const actTotal = config[actIdx]?.count || 0;
    const contentTotal = bgTotal + actTotal;

    // Phase count and per-phase derivation
    const [phaseCount, setPhaseCount] = useState(() => estimatePhases(bgTotal + actTotal));

    const bgPerPhase = phaseCount > 0 ? Math.max(1, Math.round(bgTotal / phaseCount)) : 1;
    const actPerPhase = phaseCount > 0 ? Math.max(1, Math.round(actTotal / phaseCount)) : 2;

    // When user changes per-phase values, update the config totals
    const updatePerPhase = (newBgPerPhase: number, newActPerPhase: number, newPhaseCount: number) => {
        const next = [...config];
        const newBgTotal = newPhaseCount * newBgPerPhase;
        const newActTotal = newPhaseCount * newActPerPhase;
        if (bgIdx >= 0) {
            const bgMeta = HANDBOOK_SECTIONS[bgIdx];
            next[bgIdx] = { ...next[bgIdx], count: Math.min(bgMeta.max, newBgTotal), enabled: newBgTotal > 0 };
        }
        if (actIdx >= 0) {
            const actMeta = HANDBOOK_SECTIONS[actIdx];
            next[actIdx] = { ...next[actIdx], count: Math.min(actMeta.max, newActTotal), enabled: true };
        }
        onConfigChange(next);
    };

    const handleToggle = (idx: number) => {
        const meta = HANDBOOK_SECTIONS[idx];
        if (meta.required) return;
        const next = [...config];
        next[idx] = { ...next[idx], enabled: !next[idx].enabled, count: next[idx].enabled ? 0 : meta.default };
        onConfigChange(next);
    };

    const handleCount = (idx: number, delta: number) => {
        const meta = HANDBOOK_SECTIONS[idx];
        const next = [...config];
        const floor = meta.required ? 1 : meta.min;
        if (delta > 0) {
            if (total >= localAutoTarget) return;
            next[idx] = { ...next[idx], count: next[idx].count + 1, enabled: true };
        } else {
            const newCount = Math.max(floor, next[idx].count - 1);
            next[idx] = { ...next[idx], count: newCount, enabled: newCount > 0 };
        }
        onConfigChange(next);
    };

    const handleConfirmPageCount = () => {
        const distributed = smartDistribute(localAutoTarget);
        onConfigChange(distributed);
        onAutoPageTargetChange?.(localAutoTarget);
        // Derive initial phase count from distributed content
        const dBg = distributed.find(c => c.section === 'Background Knowledge')?.count || 0;
        const dAct = distributed.find(c => c.section === 'Activity/Worksheet')?.count || 0;
        setPhaseCount(estimatePhases(dBg + dAct));
        setConfirmed(true);
    };

    const handleReset = () => {
        setConfirmed(false);
    };

    // Separate section metadata into groups
    const frontSections = HANDBOOK_SECTIONS.map((meta, idx) => ({ meta, idx }))
        .filter(({ meta }) => FRONT_TYPES.includes(meta.type));
    const backSections = HANDBOOK_SECTIONS.map((meta, idx) => ({ meta, idx }))
        .filter(({ meta }) => BACK_TYPES.includes(meta.type));

    return (
        <div className="space-y-3">
            <label className="input-label">{isZh ? '手册页面配置' : 'Handbook Page Config'}</label>

            {/* Step 1: page count input (before confirming) */}
            {!confirmed && (
                <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 text-sm text-emerald-800 dark:text-emerald-300 space-y-3">
                    <div className="flex items-start gap-3">
                        <Bot size={20} className="shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold">{isZh ? 'AI 智能规划' : 'AI Auto Planning'}</p>
                            <p className="mt-1 text-emerald-700 dark:text-emerald-400">
                                {isZh
                                    ? '输入目标页数，点击确定后 AI 会自动规划各板块页数分配，你可以进一步调整。'
                                    : 'Enter target pages and confirm. AI will distribute pages across sections, then you can adjust.'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 border border-emerald-200 dark:border-emerald-700">
                        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                            {isZh ? '目标页数' : 'Target Pages'}
                        </span>
                        <input
                            type="number"
                            min={5}
                            value={localAutoTarget}
                            onChange={e => {
                                const v = Math.max(5, Number(e.target.value) || 5);
                                setLocalAutoTarget(v);
                            }}
                            className="w-16 text-center font-bold text-lg bg-transparent border border-emerald-300 dark:border-emerald-700 rounded-md px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 tabular-nums text-emerald-700 dark:text-emerald-300"
                            title={isZh ? '目标页数' : 'Target page count'}
                        />
                        <span className="text-xs text-emerald-600/60 dark:text-emerald-500/60">{isZh ? '页' : 'pages'}</span>
                        <button
                            onClick={handleConfirmPageCount}
                            className="ml-auto px-4 py-1.5 rounded-md bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 transition-colors"
                        >
                            {isZh ? '确定' : 'Confirm'}
                        </button>
                    </div>
                </div>
            )}

            {/* Step 2: Phase-structured section distribution */}
            {confirmed && (
                <div className="space-y-3">
                    {/* Header with reset */}
                    <div className="flex items-center justify-between">
                        <p className="text-xs text-slate-500">
                            {isZh
                                ? `已为 ${localAutoTarget} 页智能分配，可自行调整`
                                : `Distributed for ${localAutoTarget} pages — adjust as needed`}
                        </p>
                        <button
                            onClick={handleReset}
                            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                            title={isZh ? '重新设置页数' : 'Reset page count'}
                        >
                            <RotateCcw size={12} />
                            {isZh ? '重设' : 'Reset'}
                        </button>
                    </div>

                    {/* ── Front System Pages ── */}
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2 px-1 pb-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                {isZh ? '📐 系统页（前）' : '📐 Front Pages'}
                            </span>
                            <div className="flex-1 border-t border-slate-200 dark:border-slate-700" />
                        </div>
                        {frontSections.map(({ meta, idx }) => (
                            <SectionRow
                                key={meta.type}
                                meta={meta}
                                item={config[idx] || { section: meta.type, count: 0, enabled: false }}
                                idx={idx}
                                total={total}
                                maxTotal={localAutoTarget}
                                isZh={isZh}
                                onToggle={handleToggle}
                                onCount={handleCount}
                            />
                        ))}
                    </div>

                    {/* ── Per-Phase Content ── */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 px-1 pb-1">
                            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
                                {isZh ? '📦 每阶段内容页' : '📦 Per-Phase Content'}
                            </span>
                            <div className="flex-1 border-t border-emerald-200 dark:border-emerald-800" />
                        </div>

                        {/* Phase count control */}
                        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30">
                            <Layers size={16} className="shrink-0 text-emerald-600" />
                            <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 flex-1">
                                {isZh ? '阶段数量' : 'Number of Phases'}
                            </span>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => {
                                        const n = Math.max(2, phaseCount - 1);
                                        setPhaseCount(n);
                                        updatePerPhase(bgPerPhase, actPerPhase, n);
                                    }}
                                    disabled={phaseCount <= 2}
                                    className="w-6 h-6 flex items-center justify-center rounded bg-emerald-100 dark:bg-emerald-900 text-emerald-700 hover:bg-emerald-200 disabled:opacity-30"
                                    title={isZh ? '减少阶段' : 'Fewer phases'}
                                >
                                    <Minus size={12} />
                                </button>
                                <span className="w-8 text-center text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                                    {phaseCount}
                                </span>
                                <button
                                    onClick={() => {
                                        const n = Math.min(8, phaseCount + 1);
                                        setPhaseCount(n);
                                        updatePerPhase(bgPerPhase, actPerPhase, n);
                                    }}
                                    disabled={phaseCount >= 8}
                                    className="w-6 h-6 flex items-center justify-center rounded bg-emerald-100 dark:bg-emerald-900 text-emerald-700 hover:bg-emerald-200 disabled:opacity-30"
                                    title={isZh ? '增加阶段' : 'More phases'}
                                >
                                    <Plus size={12} />
                                </button>
                            </div>
                        </div>

                        {/* Per-phase label */}
                        <div className="px-1 pt-1">
                            <span className="text-[10px] font-bold text-emerald-500/70 uppercase tracking-wider">
                                {isZh ? '每个阶段' : 'Per Phase'}
                            </span>
                        </div>

                        {/* BG Knowledge per phase */}
                        <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                            <Lightbulb size={16} className="shrink-0 text-amber-500" />
                            <span className="text-sm font-medium flex-1">
                                {isZh ? '背景知识' : 'Background Knowledge'}
                            </span>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => {
                                        const n = Math.max(0, bgPerPhase - 1);
                                        updatePerPhase(n, actPerPhase, phaseCount);
                                    }}
                                    disabled={bgPerPhase <= 0}
                                    className="w-6 h-6 flex items-center justify-center rounded bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200 disabled:opacity-30"
                                    title={isZh ? '减少' : 'Decrease'}
                                >
                                    <Minus size={12} />
                                </button>
                                <span className="w-6 text-center text-sm font-bold tabular-nums">{bgPerPhase}</span>
                                <button
                                    onClick={() => {
                                        const n = bgPerPhase + 1;
                                        updatePerPhase(n, actPerPhase, phaseCount);
                                    }}
                                    disabled={total >= localAutoTarget}
                                    className="w-6 h-6 flex items-center justify-center rounded bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200 disabled:opacity-30"
                                    title={isZh ? '增加' : 'Increase'}
                                >
                                    <Plus size={12} />
                                </button>
                            </div>
                            <span className="text-xs text-slate-400 font-medium tabular-nums w-12 text-right">
                                ={bgTotal} {isZh ? '页' : 'pg'}
                            </span>
                        </div>

                        {/* Activity per phase */}
                        <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                            <PenTool size={16} className="shrink-0 text-emerald-500" />
                            <span className="text-sm font-medium flex-1">
                                {isZh ? '活动/工作表' : 'Activity Page'}
                            </span>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => {
                                        const n = Math.max(1, actPerPhase - 1);
                                        updatePerPhase(bgPerPhase, n, phaseCount);
                                    }}
                                    disabled={actPerPhase <= 1}
                                    className="w-6 h-6 flex items-center justify-center rounded bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200 disabled:opacity-30"
                                    title={isZh ? '减少' : 'Decrease'}
                                >
                                    <Minus size={12} />
                                </button>
                                <span className="w-6 text-center text-sm font-bold tabular-nums">{actPerPhase}</span>
                                <button
                                    onClick={() => {
                                        const n = actPerPhase + 1;
                                        updatePerPhase(bgPerPhase, n, phaseCount);
                                    }}
                                    disabled={total >= localAutoTarget}
                                    className="w-6 h-6 flex items-center justify-center rounded bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200 disabled:opacity-30"
                                    title={isZh ? '增加' : 'Increase'}
                                >
                                    <Plus size={12} />
                                </button>
                            </div>
                            <span className="text-xs text-slate-400 font-medium tabular-nums w-12 text-right">
                                ={actTotal} {isZh ? '页' : 'pg'}
                            </span>
                        </div>

                        {/* Content summary */}
                        <div className="flex items-center justify-between px-3 py-2 bg-emerald-50/70 dark:bg-emerald-950/20 rounded-lg text-xs border border-emerald-100 dark:border-emerald-900">
                            <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                                {phaseCount} {isZh ? '阶段' : 'phases'} × {bgPerPhase + actPerPhase} {isZh ? '页/阶段' : 'pg/phase'}
                            </span>
                            <span className="text-emerald-600 font-bold tabular-nums">
                                = {contentTotal} {isZh ? '内容页' : 'content pg'}
                            </span>
                        </div>
                    </div>

                    {/* ── Back System Pages ── */}
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2 px-1 pb-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                {isZh ? '📐 系统页（后）' : '📐 Back Pages'}
                            </span>
                            <div className="flex-1 border-t border-slate-200 dark:border-slate-700" />
                        </div>
                        {backSections.map(({ meta, idx }) => (
                            <SectionRow
                                key={meta.type}
                                meta={meta}
                                item={config[idx] || { section: meta.type, count: 0, enabled: false }}
                                idx={idx}
                                total={total}
                                maxTotal={localAutoTarget}
                                isZh={isZh}
                                onToggle={handleToggle}
                                onCount={handleCount}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Total footer */}
            {confirmed && (
                <div className="flex justify-between items-center px-1 pt-1 text-sm">
                    <span className="text-slate-500">{isZh ? '总页数' : 'Total Pages'}</span>
                    <span className={`font-bold text-lg tabular-nums ${total === localAutoTarget ? 'text-emerald-600' :
                        total < localAutoTarget ? 'text-amber-500' : 'text-red-500'
                        }`}>
                        {total}
                        {total !== localAutoTarget && (
                            <span className="text-xs font-normal text-slate-400 ml-1">/ {localAutoTarget}</span>
                        )}
                    </span>
                </div>
            )}
        </div>
    );
};
