import React, { useState, useMemo } from 'react';
import { FileText, Clipboard, ImageIcon, Info, Check, Palette, Sparkles, ChevronDown, ChevronRight, Layers, Loader2, AlertCircle, ExternalLink, X, GraduationCap } from 'lucide-react';
import { LessonPlanResponse, HandbookPage } from '../../types';
import { useLanguage } from '../../i18n/LanguageContext';
import { HANDBOOK_STYLE_PRESETS, resolveStylePrompt } from '../../constants/handbookStyles';
import type { ExportProgress } from '../../hooks/useSlideExport';

interface TabHandbookProps {
    plan: LessonPlanResponse;
    handbookPages: HandbookPage[];
    handleHandbookPageChange: (index: number, field: 'visualPrompt' | 'contentPrompt' | 'layoutDescription', value: string) => void;
    handleCopyAllPrompts: () => void;
    copyToClipboard: (text: string, type: 'image' | 'content', index: number) => void;
    copiedImagePrompt: number | null;
    copiedContentPrompt: number | null;
    onStylePromptChange?: (prompt: string) => void;
    onExportSlides?: () => void;
    exportState?: ExportProgress;
    onCancelExport?: () => void;
    slideVersionPref?: 'detailed' | 'simple' | 'both';
    setSlideVersionPref?: (pref: 'detailed' | 'simple' | 'both') => void;
    mode?: 'school' | 'family';
}

// System page types that don't belong to any phase
const SYSTEM_SECTIONS = new Set([
    'Cover', 'Table of Contents', 'Safety', 'Prop Checklist',
    'Reflection', 'Certificate', 'Back Cover', 'Introduction'
]);

const FRONT_SECTIONS = new Set(['Cover', 'Table of Contents', 'Safety', 'Prop Checklist']);
const BACK_SECTIONS = new Set(['Reflection', 'Certificate', 'Back Cover']);
const CONTENT_SECTIONS = new Set(['Phase Transition', 'Background Knowledge', 'Activity/Worksheet']);

interface PageGroup {
    type: 'front' | 'phase' | 'back';
    label: string;
    labelZh: string;
    phaseIndex?: number;
    pages: { page: HandbookPage; originalIndex: number }[];
}

/** Group handbook pages: front system pages → phase groups → back system pages */
function groupPagesByPhase(
    pages: HandbookPage[],
    roadmap: LessonPlanResponse['roadmap']
): PageGroup[] {
    const hasPhaseBindings = pages.some(p => p.phaseIndex !== undefined && p.phaseIndex !== null);

    if (!hasPhaseBindings) {
        // Legacy mode — no phaseIndex, show flat
        return [{
            type: 'front' as const,
            label: 'All Pages',
            labelZh: '所有页面',
            pages: pages.map((page, idx) => ({ page, originalIndex: idx })),
        }];
    }

    const groups: PageGroup[] = [];

    // 1. Front system pages
    const frontPages = pages
        .map((page, idx) => ({ page, originalIndex: idx }))
        .filter(({ page }) => FRONT_SECTIONS.has(page.section));
    if (frontPages.length > 0) {
        groups.push({
            type: 'front',
            label: '📐 System Pages (Front)',
            labelZh: '📐 系统页（前）',
            pages: frontPages,
        });
    }

    // 2. Phase groups
    const phaseMap = new Map<number, { page: HandbookPage; originalIndex: number }[]>();
    pages.forEach((page, idx) => {
        if (page.phaseIndex !== undefined && page.phaseIndex !== null) {
            if (!phaseMap.has(page.phaseIndex)) {
                phaseMap.set(page.phaseIndex, []);
            }
            phaseMap.get(page.phaseIndex)!.push({ page, originalIndex: idx });
        }
    });

    // Sort by phaseIndex
    const sortedPhaseIndices = [...phaseMap.keys()].sort((a, b) => a - b);
    for (const pi of sortedPhaseIndices) {
        const phaseData = roadmap?.[pi];
        const phaseName = phaseData ? `${phaseData.phase}: ${phaseData.activity}` : `Phase ${pi + 1}`;
        const icon = getPhaseIcon(pi);
        groups.push({
            type: 'phase',
            label: `${icon} Phase ${pi + 1}: ${phaseName}`,
            labelZh: `${icon} 阶段 ${pi + 1}: ${phaseName}`,
            phaseIndex: pi,
            pages: phaseMap.get(pi)!,
        });
    }

    // 3. Back system pages
    const backPages = pages
        .map((page, idx) => ({ page, originalIndex: idx }))
        .filter(({ page }) => BACK_SECTIONS.has(page.section));
    if (backPages.length > 0) {
        groups.push({
            type: 'back',
            label: '📐 System Pages (Back)',
            labelZh: '📐 系统页（后）',
            pages: backPages,
        });
    }

    return groups;
}

function getPhaseIcon(index: number): string {
    const icons = ['🔬', '🌿', '🎨', '📊', '🧪', '🔭', '🦋', '🌍'];
    return icons[index % icons.length];
}

// Section badge colors
function getSectionColor(section: string): string {
    switch (section) {
        case 'Background Knowledge': return 'bg-amber-100 text-amber-700';
        case 'Activity/Worksheet': return 'bg-emerald-100 text-emerald-700';
        case 'Phase Transition': return 'bg-gradient-to-r from-pink-100 to-rose-100 text-rose-700';
        case 'Cover':
        case 'Back Cover': return 'bg-indigo-100 text-indigo-700';
        case 'Safety': return 'bg-red-100 text-red-700';
        case 'Prop Checklist': return 'bg-blue-100 text-blue-700';
        case 'Reflection': return 'bg-purple-100 text-purple-700';
        case 'Certificate': return 'bg-yellow-100 text-yellow-700';
        default: return 'bg-slate-100 text-slate-600';
    }
}

// Translate section names to Chinese
function getSectionLabelZh(section: string): string {
    switch (section) {
        case 'Cover': return '封面';
        case 'Introduction': return '引言';
        case 'Table of Contents': return '目录';
        case 'Safety': return '安全守则';
        case 'Prop Checklist': return '道具清单';
        case 'Phase Transition': return '阶段转场页';
        case 'Background Knowledge': return '背景知识';
        case 'Reading': return '阅读材料';
        case 'Instructions': return '操作说明';
        case 'Activity/Worksheet': return '活动/工作表';
        case 'Reflection': return '反思页';
        case 'Certificate': return '证书';
        case 'Back Cover': return '封底';
        default: return section;
    }
}

export const TabHandbook: React.FC<TabHandbookProps> = ({
    plan,
    handbookPages,
    handleHandbookPageChange,
    handleCopyAllPrompts,
    copyToClipboard,
    copiedImagePrompt,
    copiedContentPrompt,
    onStylePromptChange,
    onExportSlides,
    exportState,
    onCancelExport,
    slideVersionPref = 'both',
    setSlideVersionPref,
    mode = 'school',
}) => {
    const { t, lang } = useLanguage();
    const [copiedStylePrompt, setCopiedStylePrompt] = useState(false);
    const [stylePrompt, setStylePrompt] = useState(plan.handbookStylePrompt || '');
    const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set());

    // Detect which preset matches the current prompt (if any)
    const [selectedStyleId, setSelectedStyleId] = useState<string>(() => {
        const theme = plan.basicInfo?.theme || '';
        const current = plan.handbookStylePrompt || '';
        const match = HANDBOOK_STYLE_PRESETS.find(
            p => p.id !== 'custom' && resolveStylePrompt(p, theme) === current
        );
        return match?.id || 'custom';
    });

    const theme = plan.basicInfo?.theme || 'Workshop';

    const handleStyleChange = (styleId: string) => {
        setSelectedStyleId(styleId);
        const preset = HANDBOOK_STYLE_PRESETS.find(p => p.id === styleId);
        if (preset && preset.id !== 'custom') {
            const resolved = resolveStylePrompt(preset, theme);
            setStylePrompt(resolved);
            onStylePromptChange?.(resolved);
        }
    };

    const selectedPreset = useMemo(
        () => HANDBOOK_STYLE_PRESETS.find(p => p.id === selectedStyleId) || HANDBOOK_STYLE_PRESETS[0],
        [selectedStyleId]
    );

    const pageGroups = useMemo(
        () => groupPagesByPhase(handbookPages, plan.roadmap),
        [handbookPages, plan.roadmap]
    );

    const toggleGroup = (groupIdx: number) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev);
            if (next.has(groupIdx)) next.delete(groupIdx);
            else next.add(groupIdx);
            return next;
        });
    };

    return (
        <div className="space-y-5 animate-fade-in">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <FileText size={18} className="text-emerald-600" />
                    {t('hb.title')}
                </h3>
                <div className="flex items-center gap-2">
                    {onExportSlides && (
                        <div className="flex items-center gap-2">
                            {setSlideVersionPref && (
                                <select
                                    value={slideVersionPref}
                                    onChange={e => setSlideVersionPref(e.target.value as 'detailed' | 'simple' | 'both')}
                                    className="text-xs bg-white border border-indigo-200 text-indigo-700 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-indigo-300 outline-none"
                                    title={lang === 'zh' ? '选择导出版本' : 'Select export version'}
                                    disabled={exportState && exportState.status !== 'idle' && exportState.status !== 'done' && exportState.status !== 'error'}
                                >
                                    <option value="detailed">{mode === 'family' ? '👨‍👩‍👧 家长版' : '🧑‍🏫 教师版'}</option>
                                    <option value="simple">{mode === 'family' ? '🧒 儿童版' : '📚 学生版'}</option>
                                    <option value="both">{lang === 'zh' ? '📋 两者都要' : '📋 Both'}</option>
                                </select>
                            )}
                            <button
                                onClick={onExportSlides}
                                disabled={exportState && exportState.status !== 'idle' && exportState.status !== 'done' && exportState.status !== 'error'}
                                className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2"
                            >
                                {exportState && exportState.status !== 'idle' && exportState.status !== 'done' && exportState.status !== 'error'
                                    ? <Loader2 size={14} className="animate-spin" />
                                    : <Sparkles size={14} />
                                }
                                {lang === 'zh' ? '导出到 NotebookLM' : 'Export to NotebookLM'}
                            </button>
                        </div>
                    )}
                    <button
                        onClick={handleCopyAllPrompts}
                        className="text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2"
                    >
                        <Clipboard size={14} /> {t('hb.copyAllPrompts')}
                    </button>
                </div>
            </div>

            {/* Inline Export Progress */}
            {exportState && exportState.status !== 'idle' && (
                <div className={`mb-4 rounded-xl border overflow-hidden animate-fade-in ${exportState.status === 'error' ? 'border-red-200 bg-red-50' : exportState.status === 'done' ? 'border-emerald-200 bg-emerald-50' : 'border-indigo-200 bg-indigo-50/50'
                    }`}>
                    <div className="px-4 py-3">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 text-sm font-medium">
                                {exportState.status === 'error' ? (
                                    <><AlertCircle size={16} className="text-red-500" /><span className="text-red-700">导出失败</span></>
                                ) : exportState.status === 'done' ? (
                                    <><Check size={16} className="text-emerald-600" /><span className="text-emerald-700">导出完成</span></>
                                ) : (
                                    <><Loader2 size={16} className="text-indigo-600 animate-spin" /><span className="text-indigo-700">{exportState.message || '处理中...'}</span></>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {exportState.status === 'done' && exportState.notebookUrl && (
                                    <a href={exportState.notebookUrl} target="_blank" rel="noopener noreferrer"
                                        className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                                        <ExternalLink size={12} /> 打开 NotebookLM
                                    </a>
                                )}
                                {(exportState.status === 'done' || exportState.status === 'error') && onCancelExport && (
                                    <button onClick={onCancelExport} className="p-0.5 rounded hover:bg-black/10 transition-colors">
                                        <X size={14} className="text-slate-500" />
                                    </button>
                                )}
                                {exportState.status !== 'done' && exportState.status !== 'error' && onCancelExport && (
                                    <button onClick={onCancelExport} className="text-xs text-slate-500 hover:text-red-600">
                                        取消
                                    </button>
                                )}
                            </div>
                        </div>
                        {/* Progress bar */}
                        {exportState.status !== 'error' && (
                            <div className="w-full bg-white/60 rounded-full h-1.5 overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${exportState.status === 'done' ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                                    style={{ width: `${Math.round((exportState.progress || 0) * 100)}%` }}
                                />
                            </div>
                        )}
                        {/* Error detail */}
                        {exportState.status === 'error' && exportState.error && (
                            <p className="text-xs text-red-600 mt-1 line-clamp-2">{exportState.error}</p>
                        )}
                    </div>
                </div>
            )}

            {/* Style Selector + Global Style Prompt */}
            <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 mb-4 shadow-sm">
                {/* Style Dropdown Row */}
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <h4 className="text-sm font-bold text-indigo-800 flex items-center gap-2">
                        <Palette size={16} />
                        {lang === 'zh' ? '🎨 视觉风格' : '🎨 Visual Style'}
                    </h4>
                    <div className="flex items-center gap-2">
                        <select
                            value={selectedStyleId}
                            onChange={(e) => handleStyleChange(e.target.value)}
                            aria-label={lang === 'zh' ? '视觉风格' : 'Visual Style'}
                            className="text-sm font-semibold bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-700 rounded-lg px-3 py-1.5 text-indigo-800 dark:text-indigo-300 focus:ring-2 focus:ring-indigo-300 outline-none cursor-pointer min-w-[160px]"
                        >
                            {HANDBOOK_STYLE_PRESETS.map((preset) => (
                                <option key={preset.id} value={preset.id}>
                                    {lang === 'zh' ? preset.labelZh : preset.label}
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(stylePrompt);
                                setCopiedStylePrompt(true);
                                setTimeout(() => setCopiedStylePrompt(false), 2000);
                            }}
                            className={`text-xs font-semibold px-2.5 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${copiedStylePrompt
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-white dark:bg-slate-900/80 text-emerald-600 hover:bg-emerald-100 border border-emerald-200'
                                }`}
                        >
                            {copiedStylePrompt ? <Check size={14} /> : <Clipboard size={14} />}
                            {copiedStylePrompt ? (lang === 'zh' ? '已复制' : 'Copied') : (lang === 'zh' ? '复制' : 'Copy')}
                        </button>
                    </div>
                </div>

                {/* Style Description Badge */}
                {selectedStyleId !== 'custom' && (
                    <div className="mb-3 px-3 py-1.5 bg-indigo-100/60 rounded-lg inline-block">
                        <span className="text-xs text-indigo-600 font-medium">
                            {lang === 'zh' ? selectedPreset.descriptionZh : selectedPreset.description}
                        </span>
                    </div>
                )}

                {/* Editable Style Prompt */}
                <textarea
                    value={stylePrompt}
                    onChange={(e) => {
                        setSelectedStyleId('custom');
                        setStylePrompt(e.target.value);
                        onStylePromptChange?.(e.target.value);
                    }}
                    title={lang === 'zh' ? '全局视觉风格提示词' : 'Global visual style prompt'}
                    className="w-full text-sm text-slate-600 dark:text-slate-400 font-mono italic leading-relaxed bg-white/60 dark:bg-slate-800/40 rounded-lg p-3 border border-indigo-100 dark:border-indigo-800 outline-none resize-none focus:ring-2 focus:ring-indigo-200"
                    rows={5}
                    onInput={(e) => {
                        e.currentTarget.style.height = 'auto';
                        e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
                    }}
                />

                <div className="mt-2 text-xs text-emerald-500 font-medium">
                    <Info size={12} className="inline ml-1 mb-0.5" />
                    {lang === 'zh'
                        ? ' 选择预设风格或直接编辑提示词。此风格将应用于导出的 Slide Deck。'
                        : ' Choose a preset or edit the prompt directly. This style applies to exported Slide Decks.'}
                </div>
            </div>

            {/* Phase-Grouped Handbook Pages */}
            <div className="space-y-4">
                {pageGroups.map((group, groupIdx) => {
                    const isCollapsed = collapsedGroups.has(groupIdx);
                    const isPhase = group.type === 'phase';
                    const phaseData = isPhase && group.phaseIndex !== undefined
                        ? plan.roadmap?.[group.phaseIndex]
                        : null;

                    return (
                        <div key={groupIdx} className={`rounded-xl border ${isPhase
                            ? 'border-emerald-200 dark:border-emerald-800'
                            : 'border-slate-200 dark:border-slate-700'
                            } overflow-hidden`}
                        >
                            {/* Group Header */}
                            <button
                                onClick={() => toggleGroup(groupIdx)}
                                className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${isPhase
                                    ? 'bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 hover:from-emerald-100 hover:to-teal-100'
                                    : 'bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100'
                                    }`}
                                title={lang === 'zh' ? '展开/折叠' : 'Toggle section'}
                            >
                                <div className="flex items-center gap-3">
                                    {isCollapsed
                                        ? <ChevronRight size={16} className="text-slate-400" />
                                        : <ChevronDown size={16} className="text-slate-400" />
                                    }
                                    <span className={`text-sm font-bold ${isPhase ? 'text-emerald-800 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-300'}`}>
                                        {lang === 'zh' ? group.labelZh : group.label}
                                    </span>
                                    <span className="text-xs text-slate-400 font-medium">
                                        ({group.pages.length} {lang === 'zh' ? '页' : group.pages.length === 1 ? 'page' : 'pages'})
                                    </span>
                                </div>
                                {isPhase && phaseData && (
                                    <span className="text-xs text-emerald-500 font-medium hidden sm:block max-w-[300px] truncate">
                                        {phaseData.timeRange}
                                    </span>
                                )}
                            </button>

                            {/* Phase Activity Instructions Preview */}
                            {isPhase && phaseData?.activityInstructions && !isCollapsed && (
                                <div className="px-4 py-2 bg-amber-50/50 dark:bg-amber-900/10 border-b border-amber-100 dark:border-amber-800/30">
                                    <div className="flex items-start gap-2">
                                        <Layers size={14} className="text-amber-500 mt-0.5 shrink-0" />
                                        <div>
                                            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block mb-1">
                                                {lang === 'zh' ? '活动操作说明' : 'Activity Instructions'}
                                            </span>
                                            <p className="text-xs text-amber-700/80 dark:text-amber-400/80 leading-relaxed line-clamp-3">
                                                {phaseData.activityInstructions}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Pages */}
                            {!isCollapsed && (
                                <div className="p-3 space-y-3">
                                    {group.pages.map(({ page, originalIndex }) => (
                                        <div key={originalIndex} className="bg-white dark:bg-slate-900/80 dark:backdrop-blur-xl rounded-xl border border-slate-200 dark:border-white/5 p-4 shadow-sm group relative">
                                            <div className="flex justify-between items-start mb-3 pb-3 border-b border-slate-100 dark:border-white/5">
                                                <div>
                                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('hb.page')} {page.pageNumber}</span>
                                                    <h4 className="text-base font-bold text-slate-800 dark:text-slate-200 mt-1">{page.title}</h4>
                                                    <span className={`inline-block mt-2 px-2 py-1 text-xs font-semibold rounded ${getSectionColor(page.section)}`}>
                                                        {lang === 'zh' ? getSectionLabelZh(page.section) : page.section}
                                                    </span>
                                                </div>
                                                <div className="max-w-xs text-right">
                                                    <textarea
                                                        value={page.layoutDescription}
                                                        onChange={(e) => handleHandbookPageChange(originalIndex, 'layoutDescription', e.target.value)}
                                                        title={lang === 'zh' ? '布局描述' : 'Layout description'}
                                                        className="w-full text-right text-sm text-slate-500 italic bg-transparent border-none outline-none resize-none focus:ring-0 p-0"
                                                        rows={2}
                                                        onInput={(e) => { e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px'; }}
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 dark:border-white/5 relative group/block">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block flex items-center gap-1">
                                                        <ImageIcon size={12} /> {t('hb.visualPrompt')}
                                                    </label>
                                                    <textarea
                                                        value={page.visualPrompt}
                                                        onChange={(e) => handleHandbookPageChange(originalIndex, 'visualPrompt', e.target.value)}
                                                        className="w-full text-sm text-slate-700 dark:text-slate-400 font-mono leading-relaxed bg-transparent border-none outline-none resize-none focus:ring-0 p-0"
                                                        rows={3}
                                                        onInput={(e) => { e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px'; }}
                                                    />
                                                    <button
                                                        onClick={() => copyToClipboard(page.visualPrompt, 'image', originalIndex)}
                                                        className="absolute top-2 right-2 p-1.5 bg-white dark:bg-slate-900/80 text-slate-400 hover:text-emerald-600 rounded shadow-sm opacity-0 group-hover/block:opacity-100 transition-all"
                                                        title={lang === 'zh' ? '复制' : 'Copy'}
                                                    >
                                                        {copiedImagePrompt === originalIndex ? <Check size={14} /> : <Clipboard size={14} />}
                                                    </button>
                                                </div>
                                                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 dark:border-white/5 relative group/block">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block flex items-center gap-1">
                                                        <FileText size={12} /> {t('hb.contentPrompt')}
                                                    </label>
                                                    <textarea
                                                        value={page.contentPrompt}
                                                        onChange={(e) => handleHandbookPageChange(originalIndex, 'contentPrompt', e.target.value)}
                                                        placeholder={t('hb.contentPromptPlaceholder')}
                                                        className="w-full text-sm text-slate-700 dark:text-slate-400 font-mono leading-relaxed bg-transparent border-none outline-none resize-none focus:ring-0 p-0"
                                                        rows={3}
                                                        onInput={(e) => { e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px'; }}
                                                    />
                                                    <button
                                                        onClick={() => copyToClipboard(page.contentPrompt, 'content', originalIndex)}
                                                        className="absolute top-2 right-2 p-1.5 bg-white dark:bg-slate-900/80 text-slate-400 hover:text-emerald-600 rounded shadow-sm opacity-0 group-hover/block:opacity-100 transition-all"
                                                        title={lang === 'zh' ? '复制' : 'Copy'}
                                                    >
                                                        {copiedContentPrompt === originalIndex ? <Check size={14} /> : <Clipboard size={14} />}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Teacher Content — only for BK & Activity pages */}
                                            {page.teacherContentPrompt && (
                                                <div className="mt-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 border border-purple-100 dark:border-purple-800/30 relative group/block">
                                                    <label className="text-[10px] font-bold text-purple-500 uppercase mb-2 block flex items-center gap-1">
                                                        <GraduationCap size={12} /> {lang === 'zh' ? (mode === 'family' ? '家长版内容' : '教师版内容') : (mode === 'family' ? 'Parent Guide' : 'Teacher Guide')}
                                                    </label>
                                                    <pre className="text-sm text-purple-800 dark:text-purple-300 font-mono leading-relaxed whitespace-pre-wrap">
                                                        {page.teacherContentPrompt}
                                                    </pre>
                                                    <button
                                                        onClick={() => copyToClipboard(page.teacherContentPrompt!, 'content', originalIndex + 1000)}
                                                        className="absolute top-2 right-2 p-1.5 bg-white dark:bg-slate-900/80 text-slate-400 hover:text-purple-600 rounded shadow-sm opacity-0 group-hover/block:opacity-100 transition-all"
                                                        title={lang === 'zh' ? (mode === 'family' ? '复制家长版' : '复制教师版') : (mode === 'family' ? 'Copy parent guide' : 'Copy teacher guide')}
                                                    >
                                                        {copiedContentPrompt === originalIndex + 1000 ? <Check size={14} /> : <Clipboard size={14} />}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div >
    );
};
