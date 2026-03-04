import React from 'react';
import { TrendingUp, Loader2, Plus, X, ArrowDown } from 'lucide-react';
import { ReportSectionProps } from './types';

export default function EnhancementSection({
    state: { editableReport, readOnly, generating },
    actions: { updateArrayItem, removeArrayItem, handleAIAdd, renderWithHighlights },
    t
}: ReportSectionProps) {
    if (!editableReport.languageEnhancement || editableReport.languageEnhancement.length === 0) {
        return null;
    }

    return (
        <section className="bg-white dark:bg-slate-900/80 dark:backdrop-blur-xl p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-white/5 print:shadow-none print:p-0 print:break-inside-avoid">
            <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center text-sm print:hidden">
                        <TrendingUp className="w-4 h-4" />
                    </span>
                    <span className="print:text-lg">{t('report.enhancement')}</span>
                </h3>
                {!readOnly && (
                    <button
                        type="button"
                        disabled={generating === 'languageEnhancement'}
                        onClick={() => handleAIAdd('languageEnhancement')}
                        className="w-8 h-8 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center hover:bg-violet-500 hover:text-white transition-all disabled:opacity-50 print:hidden"
                    >
                        {generating === 'languageEnhancement' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                    </button>
                )}
            </div>

            <div className="space-y-8">
                {editableReport.languageEnhancement.map((item, idx) => (
                    <div key={idx} className="relative group">
                        {!readOnly && (
                            <button onClick={() => removeArrayItem('languageEnhancement', idx)} className="absolute -top-3 -right-3 w-6 h-6 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center hover:bg-rose-500 hover:text-white opacity-0 group-hover:opacity-100 transition-all z-10 print:hidden shadow-sm">
                                <X className="w-3 h-3" />
                            </button>
                        )}

                        {/* Level 1 */}
                        <div className="mb-2 relative pl-8">
                            <span className="absolute left-0 top-1 text-[10px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">L1</span>
                            {readOnly ? (
                                <div className="text-slate-500 text-sm font-medium">{item.original}</div>
                            ) : (
                                <input
                                    className="w-full text-slate-500 text-sm font-medium bg-slate-50/50 rounded px-2 py-1 outline-none border border-transparent hover:border-slate-200"
                                    value={item.original}
                                    onChange={(e) => updateArrayItem('languageEnhancement', idx, { original: e.target.value })}
                                />
                            )}
                        </div>

                        {/* Arrow */}
                        <div className="pl-9 mb-2 text-slate-200 text-xs">
                            <ArrowDown className="w-3 h-3" />
                        </div>

                        {/* Level 2 */}
                        <div className="mb-2 relative pl-8">
                            <span className="absolute left-0 top-1 text-[10px] font-black text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">L2</span>
                            {readOnly ? (
                                <div className="text-slate-700 text-sm font-medium">{renderWithHighlights(item.level2, 'text-indigo-600')}</div>
                            ) : (
                                <input
                                    className="w-full text-slate-700 text-sm font-medium bg-slate-50/50 rounded px-2 py-1 outline-none border border-transparent hover:border-indigo-200"
                                    value={item.level2}
                                    onChange={(e) => updateArrayItem('languageEnhancement', idx, { level2: e.target.value })}
                                />
                            )}
                        </div>

                        {/* Arrow */}
                        <div className="pl-9 mb-2 text-indigo-100 text-xs">
                            <ArrowDown className="w-3 h-3" />
                        </div>

                        {/* Level 3 */}
                        <div className="relative pl-8 bg-gradient-to-r from-violet-50 to-white p-3 rounded-xl border border-violet-100">
                            <span className="absolute left-3 top-4 text-[10px] font-black text-white bg-violet-500 px-1.5 py-0.5 rounded shadow-sm shadow-violet-200">L3</span>
                            {readOnly ? (
                                <div className="text-slate-800 text-base font-bold pl-2">{renderWithHighlights(item.level3, 'text-violet-700')}</div>
                            ) : (
                                <input
                                    className="w-full text-slate-800 text-base font-bold bg-white/50 rounded px-2 py-1 outline-none border border-transparent hover:border-violet-200 pl-2"
                                    value={item.level3}
                                    onChange={(e) => updateArrayItem('languageEnhancement', idx, { level3: e.target.value })}
                                />
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
