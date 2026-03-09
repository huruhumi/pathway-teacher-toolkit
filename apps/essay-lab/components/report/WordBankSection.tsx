import React from 'react';
import { BookMarked, MessageSquare, Loader2, Plus, X } from 'lucide-react';
import { ReportSectionProps } from './types';

export default function WordBankSection({
    state: { editableReport, readOnly, generating },
    actions: { updateArrayItem, removeArrayItem, handleAIAdd },
    t
}: ReportSectionProps) {
    return (
        <div className="grid md:grid-cols-2 gap-6 print:grid-cols-1 print:break-before-page">
            {/* Word Bank */}
            <section className="bg-white dark:bg-slate-900/80 dark:backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-white/5 print:shadow-none print:p-0 print:border-none">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center text-sm print:hidden">
                            <BookMarked className="w-4 h-4" />
                        </span>
                        <span>{t('report.wordBank')}</span>
                    </h3>
                    {!readOnly && (
                        <button
                            type="button"
                            disabled={generating === 'wordBank'}
                            onClick={() => handleAIAdd('wordBank')}
                            className="w-8 h-8 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center hover:bg-sky-500 hover:text-white transition-all disabled:opacity-50 print:hidden"
                        >
                            {generating === 'wordBank' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                        </button>
                    )}
                </div>

                <div className="space-y-4">
                    {editableReport.wordBank.map((item, idx) => (
                        <div key={idx} className={`p-4 bg-slate-50/50 rounded-2xl border border-slate-100 dark:border-white/5 group relative hover:border-sky-200 hover:shadow-sm transition-all print:bg-white print:border-slate-200 print:p-3 print:break-inside-avoid ${readOnly ? 'bg-white' : ''}`}>
                            {!readOnly && (
                                <button onClick={() => removeArrayItem('wordBank', idx)} className="absolute top-2 right-2 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all print:hidden">
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                            <div className="flex justify-between items-baseline mb-2 border-b border-slate-100 dark:border-white/5 pb-2 border-dashed">
                                {readOnly ? (
                                    <div className="font-bold text-slate-800 dark:text-slate-200">{item.word}</div>
                                ) : (
                                    <input
                                        className="font-bold text-slate-800 dark:text-slate-200 bg-transparent outline-none w-full"
                                        value={item.word}
                                        onChange={(e) => updateArrayItem('wordBank', idx, { word: e.target.value })}
                                    />
                                )}
                                {readOnly ? (
                                    <div className="text-xs font-medium text-slate-500 whitespace-nowrap ml-2">{item.meaning}</div>
                                ) : (
                                    <input
                                        className="text-xs font-medium text-slate-500 bg-transparent text-right outline-none w-1/3"
                                        value={item.meaning}
                                        onChange={(e) => updateArrayItem('wordBank', idx, { meaning: e.target.value })}
                                    />
                                )}
                            </div>
                            {readOnly ? (
                                <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed italic">{item.example}</div>
                            ) : (
                                <textarea
                                    className="w-full text-xs text-slate-600 dark:text-slate-400 leading-relaxed bg-transparent outline-none resize-none italic"
                                    rows={2}
                                    value={item.example}
                                    onChange={(e) => updateArrayItem('wordBank', idx, { example: e.target.value })}
                                />
                            )}
                        </div>
                    ))}
                </div>
            </section>

            {/* Topic Extensions */}
            <section className="bg-white dark:bg-slate-900/80 dark:backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-white/5 print:shadow-none print:p-0 print:border-none">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-sm print:hidden">
                            <MessageSquare className="w-4 h-4" />
                        </span>
                        <span>{t('report.expressions')}</span>
                    </h3>
                    {!readOnly && (
                        <button
                            type="button"
                            disabled={generating === 'topicExtensions'}
                            onClick={() => handleAIAdd('topicExtensions')}
                            className="w-8 h-8 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center hover:bg-amber-500 hover:text-white transition-all disabled:opacity-50 print:hidden"
                        >
                            {generating === 'topicExtensions' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                        </button>
                    )}
                </div>

                <div className="space-y-4">
                    {editableReport.topicExtensions.map((item, idx) => (
                        <div key={idx} className={`p-4 bg-amber-50/20 rounded-2xl border border-amber-100/50 group relative hover:border-amber-200 hover:shadow-sm transition-all print:bg-white print:border-slate-200 print:p-3 print:break-inside-avoid ${readOnly ? 'bg-amber-50/10' : ''}`}>
                            {!readOnly && (
                                <button onClick={() => removeArrayItem('topicExtensions', idx)} className="absolute top-2 right-2 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all print:hidden">
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                            <div className="mb-2">
                                {readOnly ? (
                                    <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">{item.expression}</div>
                                ) : (
                                    <input
                                        className="w-full font-bold text-slate-800 dark:text-slate-200 text-sm bg-transparent outline-none"
                                        value={item.expression}
                                        onChange={(e) => updateArrayItem('topicExtensions', idx, { expression: e.target.value })}
                                    />
                                )}
                                {readOnly ? (
                                    <div className="text-xs text-amber-700 font-medium mt-0.5">{item.meaning}</div>
                                ) : (
                                    <input
                                        className="w-full text-xs text-amber-700 font-medium bg-transparent outline-none"
                                        value={item.meaning}
                                        onChange={(e) => updateArrayItem('topicExtensions', idx, { meaning: e.target.value })}
                                    />
                                )}
                            </div>
                            <div className="bg-white/50 p-2 rounded-lg text-xs text-slate-600 dark:text-slate-400 italic border border-amber-100/30 print:border-none print:p-0 print:bg-transparent">
                                {readOnly ? (
                                    <div className="whitespace-pre-wrap">{item.usage}</div>
                                ) : (
                                    <textarea
                                        className="w-full bg-transparent outline-none resize-none"
                                        rows={1}
                                        value={item.usage}
                                        onChange={(e) => updateArrayItem('topicExtensions', idx, { usage: e.target.value })}
                                    />
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
