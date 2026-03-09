import React, { useState } from 'react';
import { HandbookPageConfig } from '../types';
import { HANDBOOK_SECTIONS, getDefaultPageConfig, getTotalPages } from '../constants/handbookDefaults';
import {
    Bot, Minus, Plus, Lock,
    BookImage, List, ShieldAlert, ClipboardCheck, Lightbulb,
    PenTool, BookOpen, MessageCircle, Award, BookMarked,
    Sparkles, RotateCcw,
    type LucideIcon,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
    BookImage, List, ShieldAlert, ClipboardCheck, Lightbulb,
    PenTool, BookOpen, MessageCircle, Award, BookMarked,
};

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

/** Distribute a target page count across all sections intelligently */
function smartDistribute(targetPages: number): HandbookPageConfig[] {
    // Start every section at its minimum
    const config: HandbookPageConfig[] = HANDBOOK_SECTIONS.map(meta => ({
        section: meta.type,
        count: meta.required ? 1 : meta.min,
        enabled: meta.required || meta.min > 0,
    }));

    const currentTotal = () => config.reduce((s, c) => s + (c.enabled ? c.count : 0), 0);

    // Enable all optional sections (set to min=0 means enabled but 0 pages → set to 1 so they participate)
    HANDBOOK_SECTIONS.forEach((meta, i) => {
        if (!meta.required && !config[i].enabled) {
            config[i].enabled = true;
            config[i].count = Math.max(1, meta.min); // at least 1 page
        }
    });

    let remaining = targetPages - currentTotal();
    if (remaining <= 0) return config;

    // Weights determine priority for extra pages
    const weights: Record<string, number> = {
        'Activity/Worksheet': 10,
        'Background Knowledge': 5,
        'Reading': 5,
        'Reflection': 3,
        'Safety': 1,
        'Prop Checklist': 1,
        'Table of Contents': 0, // don't expand beyond 1
    };

    // Pass 1: proportional distribution
    // Include ALL sections that have room to grow (including required ones like Activity/Worksheet)
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

    // Pass 2: greedy fill remaining one-at-a-time, highest weight first
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
        if (!filled) break; // all sections maxed out
    }

    return config;
}

export const HandbookPageSelector: React.FC<HandbookPageSelectorProps> = ({
    mode, preset, config, autoPageTarget, duration = 90,
    onModeChange, onPresetChange, onConfigChange, onAutoPageTargetChange, lang = 'en',
}) => {
    const isZh = lang === 'zh';
    const [localAutoTarget, setLocalAutoTarget] = useState(autoPageTarget || estimatePages(duration));
    const [confirmed, setConfirmed] = useState(false);

    const total = getTotalPages(config);

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
            // Allow increase as long as total hasn't reached target
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
        setConfirmed(true);
    };

    const handleReset = () => {
        setConfirmed(false);
    };

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
                    {/* Page target input */}
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

            {/* Step 2: section distribution (editable) */}
            {confirmed && (
                <div className="space-y-2">
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

                    {/* Section list */}
                    <div className="space-y-1.5">
                        {HANDBOOK_SECTIONS.map((meta, idx) => {
                            const item = config[idx] || { section: meta.type, count: 0, enabled: false };
                            const isLocked = meta.required;
                            return (
                                <div
                                    key={meta.type}
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
                                            onChange={() => handleToggle(idx)}
                                            className="w-4 h-4 rounded border-2 border-slate-300 dark:border-slate-600 bg-transparent checked:bg-emerald-500 checked:border-emerald-500 cursor-pointer accent-slate-500"
                                            aria-label={isZh ? `切换 ${meta.label}` : `Toggle ${meta.labelEn}`}
                                        />
                                    )}

                                    {(() => {
                                        const IconComp = ICON_MAP[meta.icon];
                                        return IconComp
                                            ? <IconComp size={16} className="shrink-0 text-slate-500" />
                                            : <span className="text-base shrink-0">{meta.icon}</span>;
                                    })()}
                                    <span className="text-sm font-medium flex-1 truncate">
                                        {isZh ? meta.label : meta.labelEn}
                                    </span>

                                    {item.enabled && meta.max > 1 && (
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => handleCount(idx, -1)}
                                                disabled={item.count <= meta.min || (meta.required && item.count <= 1)}
                                                className="w-6 h-6 flex items-center justify-center rounded bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200 disabled:opacity-30"
                                                title={isZh ? `减少 ${meta.label}` : `Decrease ${meta.labelEn}`}
                                            >
                                                <Minus size={12} />
                                            </button>
                                            <span className="w-6 text-center text-sm font-bold tabular-nums">{item.count}</span>
                                            <button
                                                onClick={() => handleCount(idx, 1)}
                                                disabled={total >= localAutoTarget}
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
                        })}
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
