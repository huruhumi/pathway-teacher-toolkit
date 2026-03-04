import React from 'react';
import { Stethoscope, PenLine, ArrowRight, Sparkles, Loader2, Plus, X } from 'lucide-react';
import { ReportSectionProps } from './types';

export default function DetailedAnalysis({
    state: { editableReport, readOnly, generating, orderedMatches },
    actions: { updateField, removeArrayItem, handleAIAdd },
    t,
    lang
}: ReportSectionProps) {
    return (
        <section className="bg-white dark:bg-slate-900/80 dark:backdrop-blur-xl p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-white/5 print:shadow-none print:p-0 print:break-inside-avoid">
            <h3 className="text-xl font-bold text-slate-800 mb-8 flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-sm print:hidden">
                    <Stethoscope className="w-4 h-4" />
                </span>
                <span className="print:text-lg">{t('report.detailedAnalysis')}</span>
            </h3>

            <div className="space-y-8">
                {/* Mechanics */}
                <div className="bg-slate-50/50 rounded-2xl p-6 border-l-4 border-blue-400 print:bg-white print:border-l-2 print:border-slate-300 print:p-0 print:pl-4">
                    <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                        <PenLine className="w-3.5 h-3.5 text-blue-400 print:hidden" />
                        {t('report.mechanics')}
                    </h4>
                    {readOnly ? (
                        <div className="text-sm leading-relaxed text-slate-600 whitespace-pre-wrap">{editableReport.mechanicsAnalysis}</div>
                    ) : (
                        <textarea
                            value={editableReport.mechanicsAnalysis}
                            onChange={(e) => updateField('mechanicsAnalysis', e.target.value)}
                            className="w-full bg-white p-3 rounded-lg border border-slate-200 text-sm leading-relaxed text-slate-600 focus:ring-1 focus:ring-blue-400 outline-none print:bg-white print:border-none print:p-0 print:h-auto"
                        />
                    )}
                </div>

                {/* Collocation Check */}
                {editableReport.collocationErrors && editableReport.collocationErrors.length > 0 && (
                    <div className="space-y-4">
                        <h4 className="font-bold text-slate-800 flex items-center gap-2 border-l-4 border-purple-400 pl-4 py-1 print:border-slate-300 print:border-l-2">
                            {t('report.collocation')}
                        </h4>
                        <div className="grid md:grid-cols-2 gap-4">
                            {editableReport.collocationErrors.map((item, idx) => (
                                <div key={idx} className="bg-purple-50 p-4 rounded-xl border border-purple-100 relative">
                                    <div className="flex items-center gap-2 text-xs font-bold text-purple-800 mb-2">
                                        <span className="line-through text-rose-500 opacity-60 decoration-2">{item.original}</span>
                                        <ArrowRight className="w-3 h-3 text-purple-400" />
                                        <span className="text-emerald-600">{item.suggestion}</span>
                                    </div>
                                    <p className="text-xs text-purple-900/70 leading-relaxed">{item.explanation}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Grammar Summary */}
                <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100">
                    <div className="flex items-center justify-between">
                        <h4 className="font-bold text-amber-800 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-amber-500" />
                            {t('report.grammarSummary')}
                        </h4>
                        <div className="text-xs text-amber-600">
                            {lang === 'zh'
                                ? <>共发现 <strong>{orderedMatches.length}</strong> 处可优化点，详见上方原文侧边栏。</>
                                : <>Found <strong>{orderedMatches.length}</strong> optimizable point(s). See original text sidebar above.</>}
                        </div>
                    </div>
                </div>

                {/* Idioms Section */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <h4 className="font-bold text-slate-700 flex items-center gap-2 text-sm uppercase tracking-wider border-l-4 border-amber-400 pl-4 py-1">
                            Idioms & Phrasal Verbs
                        </h4>
                        {!readOnly && (
                            <button
                                type="button"
                                disabled={generating === 'idiomSuggestions'}
                                onClick={() => handleAIAdd('idiomSuggestions')}
                                className="w-6 h-6 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center hover:bg-amber-500 hover:text-white transition-all disabled:opacity-50 print:hidden"
                            >
                                {generating === 'idiomSuggestions' ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Plus className="w-2.5 h-2.5" />}
                            </button>
                        )}
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                        {editableReport.idiomSuggestions && editableReport.idiomSuggestions.length > 0 ? (
                            editableReport.idiomSuggestions.map((item, idx) => (
                                <div key={idx} className="relative group bg-amber-50/40 p-4 rounded-xl border border-amber-100/50 hover:border-amber-200 transition-colors">
                                    {!readOnly && (
                                        <button onClick={() => removeArrayItem('idiomSuggestions', idx)} className="absolute top-2 right-2 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all print:hidden">
                                            <X className="w-3 h-3" />
                                        </button>
                                    )}
                                    <div className="mb-1 font-bold text-amber-700 text-sm">{item.expression}</div>
                                    <div className="text-xs text-slate-500 mb-2">{item.meaning}</div>
                                    <div className="text-xs text-slate-600 italic border-l-2 border-amber-200 pl-2">"{item.usage || item.originalContext}"</div>
                                </div>
                            ))
                        ) : (
                            <div className="col-span-2 text-xs text-slate-400 italic text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                No idioms detected.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
