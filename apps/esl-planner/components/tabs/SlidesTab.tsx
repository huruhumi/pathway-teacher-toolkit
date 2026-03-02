import React, { useState } from 'react';
import { Slide } from '../../types';
import { FileText, Clipboard, ImageIcon, Info, Check, Trash2, ExternalLink, Sparkles } from 'lucide-react';

interface SlidesTabProps {
    editableSlides: Slide[];
    setEditableSlides: (slides: Slide[]) => void;
    notebookLMPrompt: string;
}

export const SlidesTab: React.FC<SlidesTabProps> = ({
    editableSlides,
    setEditableSlides,
    notebookLMPrompt,
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

    return (
        <div className="space-y-5">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <FileText size={18} className="text-indigo-600" />
                    Presentation Slides Outline
                </h3>
                <div className="flex gap-2 no-print">
                    <button
                        onClick={handleCopyAllPrompts}
                        className="text-xs font-bold px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-2"
                    >
                        <Clipboard size={14} /> Copy All Prompts
                    </button>
                </div>
            </div>

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
                                : 'bg-white text-indigo-600 hover:bg-indigo-100 border border-indigo-200'
                                }`}
                        >
                            {copiedPrompt ? <Check size={14} /> : <Clipboard size={14} />}
                            {copiedPrompt ? 'Copied!' : 'Copy Prompt'}
                        </button>
                    </div>
                    <p className="text-sm text-slate-600 font-mono italic leading-relaxed line-clamp-3">
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
                    <div key={idx} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm group relative">
                        <button onClick={() => handleDeleteSlide(idx)} className="absolute top-3 right-3 p-1.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all no-print">
                            <Trash2 size={16} />
                        </button>

                        <div className="flex justify-between items-start mb-3 pb-3 border-b border-slate-100">
                            <div>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Slide {idx + 1}</span>
                                <input
                                    value={slide.title}
                                    onChange={(e) => handleSlideChange(idx, 'title', e.target.value)}
                                    className="text-base font-bold text-slate-800 mt-1 bg-transparent border-b border-transparent focus:border-indigo-500 outline-none w-full block"
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
                            <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 relative group/block">
                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block flex items-center gap-1">
                                    <ImageIcon size={12} /> Visual Instruction
                                </label>
                                <textarea
                                    value={slide.visual}
                                    onChange={(e) => handleSlideChange(idx, 'visual', e.target.value)}
                                    className="w-full text-sm text-slate-700 font-mono leading-relaxed bg-transparent border-none outline-none resize-none focus:ring-0 p-0"
                                    rows={3}
                                    onInput={(e) => { e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px'; }}
                                    placeholder="Describe visual elements..."
                                />
                                <button
                                    onClick={() => copyToClipboard(slide.visual, 'visual', idx)}
                                    className="absolute top-2 right-2 p-1.5 bg-white text-slate-400 hover:text-indigo-600 rounded shadow-sm opacity-0 group-hover/block:opacity-100 transition-all no-print"
                                >
                                    {copiedVisual === idx ? <Check size={14} /> : <Clipboard size={14} />}
                                </button>
                            </div>
                            <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 relative group/block">
                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block flex items-center gap-1">
                                    <FileText size={12} /> Slide Content
                                </label>
                                <textarea
                                    value={slide.content}
                                    onChange={(e) => handleSlideChange(idx, 'content', e.target.value)}
                                    className="w-full text-sm text-slate-700 leading-relaxed bg-transparent border-none outline-none resize-none focus:ring-0 p-0"
                                    rows={3}
                                    onInput={(e) => { e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px'; }}
                                    placeholder="Slide content text..."
                                />
                                <button
                                    onClick={() => copyToClipboard(slide.content, 'content', idx)}
                                    className="absolute top-2 right-2 p-1.5 bg-white text-slate-400 hover:text-indigo-600 rounded shadow-sm opacity-0 group-hover/block:opacity-100 transition-all no-print"
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
};
