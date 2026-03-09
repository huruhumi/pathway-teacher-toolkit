import React from 'react';
import { Pencil, Check, X } from 'lucide-react';
import { ReportSectionProps } from './types';

export default function QuizSection({
    state: { editableReport, quizState },
    actions: { handleQuizAnswer },
    t
}: ReportSectionProps) {
    if (!editableReport.errorQuiz || editableReport.errorQuiz.length === 0) {
        return null;
    }

    return (
        <section className="bg-white dark:bg-slate-900/80 dark:backdrop-blur-xl p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-white/5 print:shadow-none print:p-0 print:break-inside-avoid">
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-6 flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center text-sm print:hidden">
                    <Pencil className="w-4 h-4" />
                </span>
                <span className="print:text-lg">{t('report.practice')}</span>
            </h3>
            <div className="space-y-6">
                {editableReport.errorQuiz.map((item, idx) => (
                    <div key={idx} className="bg-teal-50/30 p-5 rounded-2xl border border-teal-100/50">
                        <div className="flex items-start gap-3 mb-4">
                            <span className="bg-teal-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0">
                                {idx + 1}
                            </span>
                            <p className="font-medium text-slate-800 dark:text-slate-200">{item.question}</p>
                        </div>
                        <div className="space-y-2 ml-9">
                            {item.options.map((option, optIdx) => {
                                const isSelected = quizState[idx] === option;
                                const isCorrect = option === item.correctAnswer;
                                const showResult = !!quizState[idx];

                                let btnClass = "w-full text-left p-3 rounded-xl border transition-all text-sm ";
                                if (showResult) {
                                    if (isCorrect) btnClass += "bg-emerald-100 border-emerald-300 text-emerald-800 font-bold";
                                    else if (isSelected && !isCorrect) btnClass += "bg-rose-100 border-rose-300 text-rose-800";
                                    else btnClass += "bg-white border-slate-200 dark:border-white/10 text-slate-500 opacity-60";
                                } else {
                                    btnClass += "bg-white border-slate-200 dark:border-white/10 hover:border-teal-300 hover:bg-teal-50 text-slate-700 dark:text-slate-400";
                                }

                                return (
                                    <button
                                        key={optIdx}
                                        onClick={() => !showResult && handleQuizAnswer(idx, option)}
                                        className={btnClass}
                                        disabled={showResult}
                                    >
                                        <span className="mr-2 font-bold opacity-50">{String.fromCharCode(65 + optIdx)}.</span>
                                        {option}
                                        {showResult && isCorrect && <Check className="w-4 h-4 float-right mt-1 text-emerald-600" />}
                                        {showResult && isSelected && !isCorrect && <X className="w-4 h-4 float-right mt-1 text-rose-600" />}
                                    </button>
                                )
                            })}
                        </div>
                        {quizState[idx] && (
                            <div className="ml-9 mt-4 text-xs text-slate-600 dark:text-slate-400 bg-white p-3 rounded-lg border border-teal-100 animate-in fade-in slide-in-from-top-2">
                                <span className="font-bold text-teal-700">{t('report.explanation')}</span> {item.explanation}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </section>
    );
}
