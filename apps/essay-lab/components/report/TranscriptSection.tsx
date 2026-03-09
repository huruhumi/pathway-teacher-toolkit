import React from 'react';
import { FileText, Eye, EyeOff, RotateCcw, Sparkles, Quote, Check, ArrowDown, Info, Tag, CheckCircle2 } from 'lucide-react';
import { ReportSectionProps } from './types';

export default function TranscriptSection({
    state: { editableReport, showGolden, showHighlights, orderedMatches },
    actions: { setShowGolden, setShowHighlights, renderParagraphs },
    t
}: ReportSectionProps) {
    return (
        <section className="bg-white dark:bg-slate-900/80 dark:backdrop-blur-xl p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-white/5 print:shadow-none print:p-0 print:break-inside-avoid">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm print:hidden">
                        <FileText className="w-4 h-4" />
                    </span>
                    <span className="print:text-lg">
                        {showGolden ? t('report.goldenVersion') : t('report.originalText')}
                    </span>
                </h3>
                <div className="flex items-center gap-2 print:hidden">
                    {!showGolden && (
                        <button
                            onClick={() => setShowHighlights(!showHighlights)}
                            className={`text-xs font-bold px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${showHighlights ? 'bg-rose-100 text-rose-600' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                        >
                            {showHighlights ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                            {showHighlights ? t('report.highlightsOn') : t('report.highlightsOff')}
                        </button>
                    )}
                    <button
                        onClick={() => setShowGolden(!showGolden)}
                        className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-lg transition-colors flex items-center gap-2"
                    >
                        {showGolden ? <RotateCcw className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                        {showGolden ? t('report.viewOriginal') : t('report.viewGolden')}
                    </button>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-0 border border-slate-100 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm">
                {/* Left: Text Area */}
                <div className="lg:col-span-2 relative bg-white border-r border-slate-100 dark:border-white/5 p-8">
                    <Quote className="absolute top-4 left-4 w-10 h-10 text-slate-50 -z-0 print:hidden" />

                    <div
                        className={`relative z-10 w-full min-h-[16rem] font-serif text-lg leading-[3rem] tracking-wide transition-all duration-300 ${!showGolden ? 'bg-white' : 'bg-slate-50/50'}`}
                        style={!showGolden ? {
                            backgroundImage: 'linear-gradient(transparent calc(100% - 1px), #e2e8f0 calc(100% - 1px))',
                            backgroundSize: '100% 3rem',
                            backgroundAttachment: 'local',
                            paddingTop: '0.1rem'
                        } : {}}
                    >
                        {showGolden ? (
                            renderParagraphs(editableReport.goldenVersion, false, false)
                        ) : (
                            renderParagraphs(editableReport.originalText, showHighlights, true)
                        )}
                    </div>

                    <div className="hidden print:block mt-8 pt-6 border-t border-dashed border-slate-200 dark:border-white/10">
                        <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-2 text-sm uppercase tracking-wider text-center">Golden Version (Rewrite)</h4>
                        <div className="font-serif text-base text-slate-700 dark:text-slate-400 leading-relaxed text-justify">
                            {renderParagraphs(editableReport.goldenVersion, false)}
                        </div>
                    </div>
                </div>

                {/* Right: Sidebar Corrections List */}
                <div className="bg-slate-50/50 flex flex-col h-full min-h-[400px] lg:max-h-[600px]">
                    {/* Correction List */}
                    {showGolden ? (
                        <div className="p-8 flex flex-col items-center justify-center h-full text-center text-slate-400">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                <Check className="w-6 h-6 text-emerald-400" />
                            </div>
                            <p className="font-bold text-slate-600 dark:text-slate-400">Golden Version</p>
                            <p className="text-xs mt-2">Perfect native expression.</p>
                        </div>
                    ) : (
                        <div className="overflow-y-auto p-4 space-y-4 custom-scrollbar h-full">
                            {orderedMatches.length > 0 ? (
                                orderedMatches.map((match) => (
                                    <div key={match.id} className="bg-white rounded-xl border border-slate-200 dark:border-white/10 p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                                        {/* Number Badge */}
                                        <div className="flex items-center gap-3 mb-3 border-b border-slate-50 pb-2">
                                            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shadow-sm flex-shrink-0 border-2 border-indigo-100">
                                                {match.id}
                                            </span>
                                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-wider">Correction</span>
                                        </div>

                                        {/* Original */}
                                        <div className="mb-3">
                                            <div className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-1">ORIGINAL</div>
                                            <div className="bg-rose-50 border border-rose-100 text-rose-800 px-3 py-2 rounded-lg text-sm font-medium line-through decoration-rose-300/50 font-serif">
                                                {match.error.original}
                                            </div>
                                        </div>

                                        {/* Arrow */}
                                        <div className="flex justify-center -my-2 relative z-10">
                                            <ArrowDown className="w-3 h-3 text-slate-200 bg-white rounded-full p-0.5 border border-slate-50" />
                                        </div>

                                        {/* Better */}
                                        <div className="mb-4">
                                            <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1">BETTER</div>
                                            <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 px-3 py-2 rounded-lg text-lg font-bold shadow-sm font-sans">
                                                {match.error.refined}
                                            </div>
                                        </div>

                                        {/* Reason */}
                                        <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 dark:text-slate-400 leading-relaxed border border-slate-100 dark:border-white/5 mb-2">
                                            <div className="flex items-center gap-1.5 mb-1 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                                                <Info className="w-3 h-3" /> Reason
                                            </div>
                                            {match.error.explanation}
                                        </div>

                                        {/* Type Tag */}
                                        {match.error.type && (
                                            <div className="flex justify-end">
                                                <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide">
                                                    <Tag className="w-2.5 h-2.5 text-slate-400" />
                                                    {match.error.type}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-3 py-10">
                                    <CheckCircle2 className="w-10 h-10 text-emerald-200" />
                                    <p className="text-sm font-medium">No errors found!</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
