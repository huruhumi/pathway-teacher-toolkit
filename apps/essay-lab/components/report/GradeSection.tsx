import React from 'react';
import { BarChart3, PieChart, Lightbulb } from 'lucide-react';
import { Grade } from '../../types';
import GradeBadge from '../GradeBadge';
import { ReportSectionProps } from './types';

export default function GradeSection({ state: { editableReport, readOnly }, actions: { updateArrayItem }, t }: ReportSectionProps) {
    return (
        <div className="grid lg:grid-cols-3 gap-6">
            <section className="lg:col-span-2 bg-white dark:bg-slate-900/80 dark:backdrop-blur-xl p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-white/5 overflow-hidden print:shadow-none print:p-0 print:break-inside-avoid">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-6 flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm print:hidden">
                        <BarChart3 className="w-4 h-4" />
                    </span>
                    <span className="print:text-lg">{t('report.gradeReport')}</span>
                </h3>

                <div className="overflow-hidden rounded-xl border border-slate-100 dark:border-white/5 print:border-slate-200">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 print:bg-slate-100">
                            <tr>
                                <th className="py-4 px-6 font-bold text-slate-700 dark:text-slate-400 text-sm tracking-wide">{t('report.dimension')}</th>
                                <th className="py-4 px-6 font-bold text-slate-700 dark:text-slate-400 text-sm tracking-wide w-24 text-center">{t('report.grade')}</th>
                                <th className="py-4 px-6 font-bold text-slate-700 dark:text-slate-400 text-sm tracking-wide">{t('report.comment')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {editableReport.grades.map((item, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/80 transition-colors print:hover:bg-transparent">
                                    <td className="py-3 px-6 align-top">
                                        {readOnly ? (
                                            <div className="py-2 font-bold text-slate-800 dark:text-slate-200 text-sm">{item.dimension}</div>
                                        ) : (
                                            <input
                                                className="w-full bg-transparent py-2 rounded focus:bg-white focus:ring-1 focus:ring-indigo-100 outline-none font-bold text-slate-800 dark:text-slate-200 text-sm"
                                                value={item.dimension}
                                                onChange={(e) => updateArrayItem('grades', idx, { dimension: e.target.value })}
                                            />
                                        )}
                                    </td>
                                    <td className="py-3 px-6 align-top text-center">
                                        {!readOnly && (
                                            <div className="print:hidden">
                                                <select
                                                    value={item.grade}
                                                    onChange={(e) => updateArrayItem('grades', idx, { grade: e.target.value as Grade })}
                                                    className="w-full bg-transparent py-2 rounded focus:bg-white focus:ring-1 focus:ring-indigo-100 outline-none font-bold text-indigo-700 text-center"
                                                >
                                                    {Object.values(Grade).map(g => <option key={g} value={g}>{g}</option>)}
                                                </select>
                                            </div>
                                        )}
                                        <div className={`${!readOnly ? 'hidden print:block' : ''} flex justify-center pt-1`}>
                                            <GradeBadge grade={item.grade} size="sm" />
                                        </div>
                                    </td>
                                    <td className="py-3 px-6 align-top">
                                        {readOnly ? (
                                            <div className="py-2 text-slate-600 dark:text-slate-400 text-xs leading-relaxed whitespace-pre-wrap">{item.comment}</div>
                                        ) : (
                                            <textarea
                                                className="w-full bg-transparent py-2 rounded focus:bg-white focus:ring-1 focus:ring-indigo-100 outline-none resize-none text-xs text-slate-600 dark:text-slate-400 leading-relaxed"
                                                rows={2}
                                                value={item.comment}
                                                onChange={(e) => updateArrayItem('grades', idx, { comment: e.target.value })}
                                            />
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Sentence Variety Stats */}
            <section className="bg-white dark:bg-slate-900/80 dark:backdrop-blur-xl p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-white/5 print:shadow-none print:p-0 print:break-inside-avoid">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-6 flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-indigo-500 print:hidden" />
                    {t('report.sentenceVariety')}
                </h3>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                            <span>{t('report.simple')}</span>
                            <span>{editableReport.sentenceVariety?.simple || 0}%</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${editableReport.sentenceVariety?.simple || 0}%` }}></div>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                            <span>{t('report.compound')}</span>
                            <span>{editableReport.sentenceVariety?.compound || 0}%</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-sky-400 rounded-full" style={{ width: `${editableReport.sentenceVariety?.compound || 0}%` }}></div>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                            <span>{t('report.complex')}</span>
                            <span>{editableReport.sentenceVariety?.complex || 0}%</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${editableReport.sentenceVariety?.complex || 0}%` }}></div>
                        </div>
                    </div>

                    <div className="mt-4 p-3 bg-indigo-50 rounded-xl text-xs text-indigo-800 leading-relaxed">
                        <Lightbulb className="w-3.5 h-3.5 mr-1 text-indigo-500 inline-block" />
                        {editableReport.sentenceVariety?.advice || t('report.defaultAdvice')}
                    </div>
                </div>
            </section>
        </div>
    );
}
