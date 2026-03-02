import React, { useState } from 'react';
import { Slide } from '../../types';
import { Sparkles, Check, Copy, Trash2, ExternalLink } from 'lucide-react';

interface AutoResizeTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    minRows?: number;
}
const AutoResizeTextarea: React.FC<AutoResizeTextareaProps> = ({ minRows = 1, className, ...props }) => {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    React.useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [props.value]);

    return (
        <textarea
            ref={textareaRef}
            rows={minRows}
            className={`resize-none overflow-hidden ${className || ''}`}
            {...props}
        />
    );
};

interface SlidesTabProps {
    editableSlides: Slide[];
    setEditableSlides: (slides: Slide[]) => void;
    notebookLMPrompt: string;
    openViewer: (tabId: string, subTabId?: string) => void;
}

export const SlidesTab: React.FC<SlidesTabProps> = ({
    editableSlides,
    setEditableSlides,
    notebookLMPrompt,
    openViewer,
}) => {
    const [copiedPrompt, setCopiedPrompt] = useState(false);

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedPrompt(true);
            setTimeout(() => setCopiedPrompt(false), 2000);
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

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-slate-800">Presentation Slides Outline</h3>
                <div className="flex gap-2 no-print">
                    <button
                        onClick={() => openViewer('slides')}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm text-sm font-semibold"
                    >
                        <ExternalLink className="w-4 h-4" />
                        Open in Viewer
                    </button>
                </div>
            </div>

            <div className="bg-indigo-600 p-8 rounded-2xl text-white shadow-lg flex flex-col md:flex-row justify-between items-center gap-6 mb-8 no-print">
                <div className="max-w-xl text-center md:text-left">
                    <h2 className="text-2xl font-bold mb-2 flex items-center gap-2 justify-center md:justify-start">
                        <Sparkles className="w-6 h-6" />
                        NotebookLM Visual Assistant
                    </h2>
                    <p className="text-indigo-100 text-sm">Copy this specialized prompt and paste it into NotebookLM to generate a high-quality slide deck based on your lesson context.</p>
                </div>
                <button
                    onClick={() => copyToClipboard(notebookLMPrompt)}
                    className="flex items-center gap-2 bg-white text-indigo-600 px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-indigo-50 transition-all active:scale-95 flex-shrink-0"
                >
                    {copiedPrompt ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                    {copiedPrompt ? 'Copied Prompt!' : 'Copy Slide Prompt'}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {editableSlides.map((slide, idx) => (
                    <div key={idx} className="bg-white dark:bg-slate-900/80 dark:backdrop-blur-xl border border-slate-200 dark:border-white/5 rounded-2xl p-6 shadow-sm flex flex-col h-full hover:border-indigo-300 transition-colors">
                        <div className="flex justify-between items-start mb-4">
                            <span className="bg-indigo-100 text-indigo-700 text-[10px] font-black px-2 py-1 rounded uppercase tracking-wider">Slide {idx + 1}</span>
                            <button onClick={() => handleDeleteSlide(idx)} className="p-1 text-slate-300 hover:text-red-500 transition-colors no-print"><Trash2 className="w-4 h-4" /></button>
                        </div>
                        <input
                            value={slide.title}
                            onChange={(e) => handleSlideChange(idx, 'title', e.target.value)}
                            className="font-bold text-slate-800 dark:text-slate-200 mb-3 bg-transparent border-none outline-none w-full focus:bg-indigo-50/30 dark:focus:bg-indigo-900/20 rounded px-1 py-0.5"
                            placeholder="Slide title..."
                        />
                        <AutoResizeTextarea
                            value={slide.content}
                            onChange={(e) => handleSlideChange(idx, 'content', e.target.value)}
                            className="flex-1 text-sm text-slate-600 dark:text-slate-400 mb-4 leading-relaxed bg-transparent border-none outline-none w-full focus:bg-slate-50 dark:focus:bg-slate-800/50 rounded px-1 py-0.5"
                            placeholder="Slide content..."
                            minRows={2}
                        />
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 mb-2">
                            <span className="font-bold text-[9px] uppercase block mb-1 tracking-widest text-slate-400">Visual</span>
                            <AutoResizeTextarea
                                value={slide.visual}
                                onChange={(e) => handleSlideChange(idx, 'visual', e.target.value)}
                                className="text-[11px] italic text-slate-500 bg-transparent border-none outline-none w-full focus:bg-white rounded px-1 py-0.5"
                                placeholder="Visual description..."
                                minRows={1}
                            />
                        </div>
                        <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 mt-auto">
                            <span className="font-bold text-[9px] uppercase block mb-1 tracking-widest text-indigo-400">Layout Design</span>
                            <AutoResizeTextarea
                                value={slide.layoutDesign}
                                onChange={(e) => handleSlideChange(idx, 'layoutDesign', e.target.value)}
                                className="text-[11px] italic text-indigo-700 bg-transparent border-none outline-none w-full focus:bg-indigo-100/30 rounded px-1 py-0.5"
                                placeholder="Layout design instructions..."
                                minRows={1}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
