import React from 'react';
import { Printer, GraduationCap } from 'lucide-react';
import { Grade } from '../../types';
import GradeBadge from '../GradeBadge';
import { ReportSectionProps } from './types';

export default function ReportHeader({ state: { editableReport, readOnly }, actions: { updateField }, t }: ReportSectionProps) {
    return (
        <div className="bg-white dark:bg-slate-900/80 dark:backdrop-blur-xl p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-white/5 print:shadow-none print:border-b-2 print:border-slate-800 print:rounded-none relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-50 to-white rounded-bl-full -mr-8 -mt-8 print:hidden opacity-50"></div>

            {readOnly && (
                <button
                    onClick={() => window.print()}
                    className="absolute top-6 right-6 text-slate-300 hover:text-slate-600 print:hidden transition-colors"
                    title="Print Report"
                >
                    <Printer className="w-5 h-5" />
                </button>
            )}

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                <div className="space-y-2">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center print:hidden shadow-sm shadow-indigo-200">
                            <GraduationCap className="w-4 h-4" />
                        </div>
                        <h2 className="text-3xl font-black text-slate-800 dark:text-slate-200 tracking-tight">
                            {t('report.title')} <span className="text-indigo-600">{t('report.titleAccent')}</span>
                        </h2>
                    </div>
                    <p className="text-slate-500 font-medium">{t('report.subtitle')}</p>

                    <div className="flex flex-wrap items-center gap-3 pt-2">
                        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 dark:border-white/5">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">CEFR</span>
                            {readOnly ? (
                                <span className="text-sm font-bold text-indigo-700">
                                    {editableReport.approximateCEFR}
                                </span>
                            ) : (
                                <input
                                    className="text-sm font-bold text-indigo-700 bg-transparent outline-none w-20"
                                    value={editableReport.approximateCEFR}
                                    onChange={(e) => updateField('approximateCEFR', e.target.value)}
                                />
                            )}
                        </div>
                        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 dark:border-white/5">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">CEQ</span>
                            {readOnly ? (
                                <span className="text-sm font-bold text-emerald-700">
                                    {editableReport.approximateCEQ}
                                </span>
                            ) : (
                                <input
                                    className="text-sm font-bold text-emerald-700 bg-transparent outline-none w-24"
                                    value={editableReport.approximateCEQ}
                                    onChange={(e) => updateField('approximateCEQ', e.target.value)}
                                />
                            )}
                        </div>
                        <div className="hidden print:block text-slate-400 text-xs ml-auto">
                            {new Date().toLocaleDateString()}
                        </div>
                    </div>
                </div>

                <div className="text-center bg-slate-50 p-4 rounded-2xl border border-slate-100 dark:border-white/5 print:bg-transparent print:border-none print:p-0">
                    <p className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-2">Overall Grade</p>
                    {!readOnly && (
                        <div className="print:hidden mb-2">
                            <select
                                value={editableReport.overallGrade}
                                onChange={(e) => updateField('overallGrade', e.target.value as Grade)}
                                className="bg-white border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1 text-slate-700 dark:text-slate-400 font-bold outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500/20"
                            >
                                {Object.values(Grade).map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                        </div>
                    )}
                    <div className={`${!readOnly ? 'hidden print:block' : ''}`}>
                        <GradeBadge grade={editableReport.overallGrade} size="lg" />
                    </div>
                </div>
            </div>
        </div>
    );
}
