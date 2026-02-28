import React, { useState } from 'react';
import { FileText, Clipboard, ImageIcon, Info, Check } from 'lucide-react';
import { LessonPlanResponse, HandbookPage } from '../../types';
import { RichTextEditor } from '../RichTextEditor';

interface TabHandbookProps {
    plan: LessonPlanResponse;
    handbookPages: HandbookPage[];
    handleHandbookPageChange: (index: number, field: 'visualPrompt' | 'contentPrompt' | 'layoutDescription', value: string) => void;
    handleCopyAllPrompts: () => void;
    copyToClipboard: (text: string, type: 'image' | 'content', index: number) => void;
    copiedImagePrompt: number | null;
    copiedContentPrompt: number | null;
}

export const TabHandbook: React.FC<TabHandbookProps> = ({
    plan,
    handbookPages,
    handleHandbookPageChange,
    handleCopyAllPrompts,
    copyToClipboard,
    copiedImagePrompt,
    copiedContentPrompt
}) => {
    const [copiedStylePrompt, setCopiedStylePrompt] = useState(false);

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <FileText size={20} className="text-emerald-600" />
                    Student Handbook Plan
                </h3>
                <button
                    onClick={handleCopyAllPrompts}
                    className="text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2"
                >
                    <Clipboard size={16} /> Copy All Prompts
                </button>
            </div>

            {plan.handbookStylePrompt && (
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-5 mb-6 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                        <h4 className="text-sm font-bold text-indigo-800 flex items-center gap-2">
                            <ImageIcon size={16} /> Global Style Prompt
                        </h4>
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(plan.handbookStylePrompt!);
                                setCopiedStylePrompt(true);
                                setTimeout(() => setCopiedStylePrompt(false), 2000);
                            }}
                            className={`text-xs font-semibold px-2.5 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${copiedStylePrompt
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-white text-indigo-600 hover:bg-indigo-100 border border-indigo-200'
                                }`}
                        >
                            {copiedStylePrompt ? <Check size={14} /> : <Clipboard size={14} />}
                            {copiedStylePrompt ? 'Copied!' : 'Copy Style'}
                        </button>
                    </div>
                    <p className="text-sm text-slate-600 font-mono italic leading-relaxed">
                        {plan.handbookStylePrompt}
                    </p>
                    <div className="mt-2 text-xs text-indigo-500 font-medium">
                        <Info size={12} className="inline ml-1 mb-0.5" />
                        Paste this into NotebookLM as a global instruction to ensure all generated handbook pages share the same aesthetic.
                    </div>
                </div>
            )}

            <div className="space-y-4">
                {handbookPages.map((page, idx) => (
                    <div key={idx} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                        <div className="flex justify-between items-start mb-4 pb-4 border-b border-slate-100">
                            <div>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Page {page.pageNumber}</span>
                                <h4 className="text-lg font-bold text-slate-800 mt-1">{page.title}</h4>
                                <span className="inline-block mt-2 px-2 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded">{page.section}</span>
                            </div>
                            <div className="max-w-xs text-right">
                                <textarea
                                    value={page.layoutDescription}
                                    onChange={(e) => handleHandbookPageChange(idx, 'layoutDescription', e.target.value)}
                                    className="w-full text-right text-sm text-slate-500 italic bg-transparent border-none outline-none resize-none focus:ring-0 p-0"
                                    rows={2}
                                    onInput={(e) => { e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px'; }}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 relative group">
                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block flex items-center gap-1">
                                    <ImageIcon size={12} /> Visual Prompt
                                </label>
                                <textarea
                                    value={page.visualPrompt}
                                    onChange={(e) => handleHandbookPageChange(idx, 'visualPrompt', e.target.value)}
                                    className="w-full text-sm text-slate-700 font-mono leading-relaxed bg-transparent border-none outline-none resize-none focus:ring-0 p-0"
                                    rows={3}
                                    onInput={(e) => { e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px'; }}
                                />
                                <button
                                    onClick={() => copyToClipboard(page.visualPrompt, 'image', idx)}
                                    className="absolute top-2 right-2 p-1.5 bg-white text-slate-400 hover:text-emerald-600 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    {copiedImagePrompt === idx ? <Check size={14} /> : <Clipboard size={14} />}
                                </button>
                            </div>
                            <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 relative group">
                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block flex items-center gap-1">
                                    <FileText size={12} /> Content Prompt
                                </label>
                                <RichTextEditor
                                    value={page.contentPrompt}
                                    onChange={(html) => handleHandbookPageChange(idx, 'contentPrompt', html)}
                                    placeholder="Enter content prompt..."
                                    className="text-sm text-slate-700 leading-relaxed bg-transparent p-0"
                                    rows={3}
                                />
                                <button
                                    onClick={() => copyToClipboard(page.contentPrompt, 'content', idx)}
                                    className="absolute top-2 right-2 p-1.5 bg-white text-slate-400 hover:text-emerald-600 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    {copiedContentPrompt === idx ? <Check size={14} /> : <Clipboard size={14} />}
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
