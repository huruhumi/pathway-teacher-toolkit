import React, { useState } from 'react';
import { Slide } from '../../types';
import { FileText, Clipboard, ImageIcon, Info, Check, Trash2, Sparkles, Loader2, AlertCircle, ExternalLink, X, RefreshCw } from 'lucide-react';
import type { ExportProgress } from '../../hooks/useSlideExport';

interface SlidesTabProps {
    editableSlides: Slide[];
    setEditableSlides: (slides: Slide[]) => void;
    notebookLMPrompt: string;
    onExportSlides?: () => void;
    exportState?: ExportProgress;
    onCancelExport?: () => void;
    onRegenerateSlides?: () => void;
    isRegenerating?: boolean;
}

export const SlidesTab: React.FC<SlidesTabProps> = React.memo(({
    editableSlides,
    setEditableSlides,
    notebookLMPrompt,
    onExportSlides,
    exportState,
    onCancelExport,
    onRegenerateSlides,
    isRegenerating,
}) => {
    const [copiedPrompt, setCopiedPrompt] = useState(false);
    const [copiedVisual, setCopiedVisual] = useState<number | null>(null);
    const [copiedContent, setCopiedContent] = useState<number | null>(null);

    const copyToClipboard = async (text: string, type: 'visual' | 'content' | 'prompt', index?: number) => {
        try {
            await navigator.clipboard.writeText(text);
            if (type === 'prompt') {
                setCopiedPrompt(true);
                setTimeout(() => setCopiedPrompt(false), 2000);
            } else if (type === 'visual' && index !== undefined) {
                setCopiedVisual(index);
                setTimeout(() => setCopiedVisual(null), 2000);
            } else if (type === 'content' && index !== undefined) {
                setCopiedContent(index);
                setTimeout(() => setCopiedContent(null), 2000);
            }
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    };

    const handleDeleteSlide = (idx: number) => {
        const ns = editableSlides.filter((_, i) => i !== idx);
        setEditableSlides(ns);
    };

    const handleSlideChange = (idx: number, field: keyof Slide, value: string) => {
        const ns = [...editableSlides];
        ns[idx] = { ...ns[idx], [field]: value };
        setEditableSlides(ns);
    };

    const handleCopyAllPrompts = () => {
        const allPrompts = editableSlides.map((slide, idx) =>
            `--- Slide ${idx + 1}: ${slide.title} ---\nVisual: ${slide.visual}\nContent: ${slide.content}\nLayout: ${slide.layoutDesign}`
        ).join('\n\n');
        copyToClipboard(allPrompts, 'prompt');
    };

    const isExporting = exportState && exportState.status !== 'idle' && exportState.status !== 'done' && exportState.status !== 'error';

    return (
        <div className="space-y-5">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <img id="pathway-logo" src={`${import.meta.env.BASE_URL}logo.png`} alt="Pathway Academy" className="w-8 h-8 object-contain" />
                    Presentation Slides Outline
                </h3>
                <div className="flex items-center gap-2 no-print">
                    {onRegenerateSlides && (
                        <button
                            onClick={onRegenerateSlides}
                            disabled={!!isRegenerating}
                            className="text-xs font-bold text-amber-600 bg-amber-50 hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2"
                            title="重新生成所有 Slides（仅生成 Slides，不影响其他内容）"
                        >
                            {isRegenerating
                                ? <Loader2 size={14} className="animate-spin" />
                                : <RefreshCw size={14} />
                            }
                            {isRegenerating ? '生成中...' : 'Regenerate'}
                        </button>
                    )}
                    {onExportSlides && (
                        <button
                            onClick={onExportSlides}
                            disabled={!!isExporting}
                            className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2"
                        >
                            {isExporting
                                ? <Loader2 size={14} className="animate-spin" />
                                : <Sparkles size={14} />
                            }
                            导出到 NotebookLM
                        </button>
                    )}
                    <button
                        onClick={handleCopyAllPrompts}
                        className="text-xs font-bold px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-2"
                    >
                        <Clipboard size={14} /> Copy All Prompts
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

            {notebookLMPrompt && (
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 mb-4 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                        <h4 className="text-sm font-bold text-indigo-800 flex items-center gap-2">
                            <Sparkles size={16} /> NotebookLM Visual Assistant
                        </h4>
                        <button
                            onClick={() => copyToClipboard(notebookLMPrompt, 'prompt')}
                            className={`text-xs font-semibold px-2.5 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${copiedPrompt
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-white dark:bg-slate-900/80 text-indigo-600 hover:bg-indigo-100 border border-indigo-200'
                                }`}
                        >
                            {copiedPrompt ? <Check size={14} /> : <Clipboard size={14} />}
                            {copiedPrompt ? 'Copied!' : 'Copy Prompt'}
                        </button>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 font-mono italic leading-relaxed whitespace-pre-wrap break-words">
                        {notebookLMPrompt}
                    </p>
                    <div className="mt-2 text-xs text-indigo-500 font-medium">
                        <Info size={12} className="inline ml-1 mb-0.5" />
                        Paste this into NotebookLM to generate a high-quality slide deck based on your lesson context.
                    </div>
                </div>
            )}

            <div className="space-y-4">
                {editableSlides.map((slide, idx) => (
                    <div key={idx} className="bg-white dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-white/10 p-4 shadow-sm group relative">
                        <button onClick={() => handleDeleteSlide(idx)} className="absolute top-3 right-3 p-1.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all no-print">
                            <Trash2 size={16} />
                        </button>

                        <div className="flex justify-between items-start mb-3 pb-3 border-b border-slate-100 dark:border-white/5">
                            <div>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Slide {idx + 1}</span>
                                <input
                                    value={slide.title}
                                    onChange={(e) => handleSlideChange(idx, 'title', e.target.value)}
                                    className="text-base font-bold text-slate-800 dark:text-slate-200 mt-1 bg-transparent border-b border-transparent focus:border-indigo-500 outline-none w-full block"
                                    placeholder="Slide title..."
                                />
                            </div>
                            <div className="max-w-xs text-right">
                                <textarea
                                    value={slide.layoutDesign}
                                    onChange={(e) => handleSlideChange(idx, 'layoutDesign', e.target.value)}
                                    className="w-full text-right text-sm text-slate-500 italic bg-transparent border-none outline-none resize-none focus:ring-0 p-0"
                                    rows={2}
                                    onInput={(e) => { e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px'; }}
                                    placeholder="Layout description..."
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 dark:border-white/5 relative group/block">
                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block flex items-center gap-1">
                                    <ImageIcon size={12} /> Visual Instruction
                                </label>
                                <textarea
                                    value={slide.visual}
                                    onChange={(e) => handleSlideChange(idx, 'visual', e.target.value)}
                                    className="w-full text-sm text-slate-700 dark:text-slate-400 font-mono leading-relaxed bg-transparent border-none outline-none resize-none focus:ring-0 p-0"
                                    rows={3}
                                    onInput={(e) => { e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px'; }}
                                    placeholder="Describe visual elements..."
                                />
                                <button
                                    onClick={() => copyToClipboard(slide.visual, 'visual', idx)}
                                    className="absolute top-2 right-2 p-1.5 bg-white dark:bg-slate-900/80 text-slate-400 hover:text-indigo-600 rounded shadow-sm opacity-0 group-hover/block:opacity-100 transition-all no-print"
                                >
                                    {copiedVisual === idx ? <Check size={14} /> : <Clipboard size={14} />}
                                </button>
                            </div>
                            <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 dark:border-white/5 relative group/block">
                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block flex items-center gap-1">
                                    <FileText size={12} /> Slide Content
                                </label>
                                <textarea
                                    value={slide.content}
                                    onChange={(e) => handleSlideChange(idx, 'content', e.target.value)}
                                    className="w-full text-sm text-slate-700 dark:text-slate-400 leading-relaxed bg-transparent border-none outline-none resize-none focus:ring-0 p-0"
                                    rows={3}
                                    onInput={(e) => { e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px'; }}
                                    placeholder="Slide content text..."
                                />
                                <button
                                    onClick={() => copyToClipboard(slide.content, 'content', idx)}
                                    className="absolute top-2 right-2 p-1.5 bg-white dark:bg-slate-900/80 text-slate-400 hover:text-indigo-600 rounded shadow-sm opacity-0 group-hover/block:opacity-100 transition-all no-print"
                                >
                                    {copiedContent === idx ? <Check size={14} /> : <Clipboard size={14} />}
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
});
