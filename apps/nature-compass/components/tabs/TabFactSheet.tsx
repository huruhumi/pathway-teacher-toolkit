import React, { useState } from 'react';
import { BookOpenCheck, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

interface TabFactSheetProps {
    factSheet: string;
}

export const TabFactSheet: React.FC<TabFactSheetProps> = ({ factSheet }) => {
    const { lang } = useLanguage();
    const [copied, setCopied] = useState(false);
    const [expanded, setExpanded] = useState(true);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(factSheet);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Split fact sheet into paragraphs for better readability
    const paragraphs = factSheet.split(/\n{2,}/).filter(p => p.trim());

    return (
        <div className="space-y-5 animate-fade-in">
            <div className="bg-white dark:bg-slate-900/80 dark:backdrop-blur-xl rounded-xl border border-slate-200 dark:border-white/5 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <BookOpenCheck size={18} className="text-violet-600" />
                        {lang === 'zh' ? '📚 知识底稿 (RAG 背景知识)' : '📚 Fact Sheet (RAG Knowledge Base)'}
                    </h3>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleCopy}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${copied
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                                }`}
                        >
                            {copied ? <Check size={14} /> : <Copy size={14} />}
                            {copied ? (lang === 'zh' ? '已复制' : 'Copied') : (lang === 'zh' ? '复制全部' : 'Copy All')}
                        </button>
                        <button
                            onClick={() => setExpanded(!expanded)}
                            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                        >
                            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                    </div>
                </div>

                <p className="text-xs text-slate-400 mb-3">
                    {lang === 'zh'
                        ? '以下是 AI 研究生成的背景知识底稿，用于确保课件内容的准确性和深度。此底稿已随课件保存，导出时会自动上传至 NotebookLM。'
                        : 'This AI-researched fact sheet was used to ground the lesson content for accuracy and depth. It is saved with the plan and will be uploaded to NotebookLM during export.'}
                </p>

                {expanded && (
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 max-h-[600px] overflow-y-auto">
                        <div className="prose prose-sm prose-slate dark:prose-invert max-w-none">
                            {paragraphs.map((p, i) => {
                                // Check if paragraph looks like a heading (starts with # or is all caps or is short)
                                const trimmed = p.trim();
                                if (trimmed.startsWith('#')) {
                                    const level = trimmed.match(/^#+/)?.[0].length || 1;
                                    const text = trimmed.replace(/^#+\s*/, '');
                                    if (level <= 2) {
                                        return <h4 key={i} className="text-sm font-bold text-violet-700 dark:text-violet-400 mt-4 mb-2 first:mt-0">{text}</h4>;
                                    }
                                    return <h5 key={i} className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-3 mb-1">{text}</h5>;
                                }
                                // Render as paragraph with preserved line breaks
                                return (
                                    <p key={i} className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-3 whitespace-pre-wrap">
                                        {trimmed}
                                    </p>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
