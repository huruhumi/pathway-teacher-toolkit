import React, { useState } from 'react';
import { X, CheckCircle2, ChevronRight, ChevronLeft, Loader2, PlayCircle } from 'lucide-react';
import type { Assignment, Submission } from '@shared/types/education';
import { Worksheet, ReadingCompanionContent } from '../../esl-planner/types'; // Assuming we can import types, wait we should copy or move them to shared, but for now we can import or define locally.

interface Props {
    assignment: Assignment & { submission?: Submission };
    onClose: () => void;
    onSubmit: (answers: any) => Promise<void>;
}

export const InteractiveAssignmentRenderer: React.FC<Props> = ({ assignment, onClose, onSubmit }) => {
    const isWorksheet = assignment.content_type === 'worksheet';
    const isCompanion = assignment.content_type === 'companion';

    const [answers, setAnswers] = useState<any>(assignment.submission?.content || {});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);

    const handleAnswerChange = (key: string, value: any) => {
        setAnswers(prev => ({ ...prev, [key]: value }));
    };

    const handleFinalSubmit = async () => {
        setIsSubmitting(true);
        try {
            await onSubmit(answers);
        } finally {
            setIsSubmitting(false);
        }
    };

    const isCompleted = assignment.submission?.status === 'completed' || assignment.submission?.status === 'submitted';

    if (isWorksheet) {
        const ws = assignment.content as Worksheet;
        const sections = ws.sections || [];
        const section = sections[currentStep];

        return (
            <div className="fixed inset-0 bg-slate-50 dark:bg-slate-950 z-[100] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 h-16 flex items-center justify-between shrink-0 shadow-sm">
                    <div className="flex items-center gap-3">
                        <button onClick={onClose} className="p-2 -ml-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                            <X size={20} />
                        </button>
                        <div>
                            <h2 className="font-bold text-slate-800 dark:text-white leading-tight">{assignment.title}</h2>
                            <div className="text-xs font-medium text-slate-500">
                                {currentStep + 1} of {sections.length} • {section?.title}
                            </div>
                        </div>
                    </div>
                    {isCompleted && (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 rounded-full text-xs font-bold uppercase tracking-wider">
                            <CheckCircle2 size={14} /> Submitted
                        </div>
                    )}
                </header>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                    <div className="max-w-3xl mx-auto space-y-8">
                        {section && (
                            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                                {section.passage && (
                                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 border-b border-indigo-100 dark:border-indigo-800/50">
                                        {section.passageTitle && <h3 className="text-lg font-bold text-indigo-900 dark:text-indigo-300 mb-3">{section.passageTitle}</h3>}
                                        <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{section.passage}</p>
                                    </div>
                                )}

                                <div className="p-6 space-y-8">
                                    <div className="mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                                        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">{section.title}</h3>
                                        {section.description && <p className="text-sm text-slate-500">{section.description}</p>}
                                    </div>

                                    {section.items?.map((item, idx) => {
                                        const answerKey = `s${currentStep}_q${idx}`;
                                        const val = answers[answerKey] || '';

                                        return (
                                            <div key={idx} className="space-y-4">
                                                <div className="flex gap-3">
                                                    <span className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold flex flex-shrink-0 items-center justify-center text-sm">{idx + 1}</span>
                                                    <div className="flex-1 pt-1">
                                                        <p className="font-semibold text-slate-800 dark:text-slate-200 mb-4 leading-relaxed">{item.question}</p>

                                                        {item.imageUrl && (
                                                            <img src={item.imageUrl} alt="Question visual" className="max-w-xs rounded-xl border border-slate-200 shadow-sm mb-4" />
                                                        )}

                                                        {section.layout === 'multiple-choice' && item.options ? (
                                                            <div className="space-y-2">
                                                                {item.options.map((opt, oIdx) => (
                                                                    <label key={oIdx} className={`flex items-start gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer ${val === opt ? 'border-sky-500 bg-sky-50 dark:bg-sky-500/10' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}`}>
                                                                        <input
                                                                            type="radio"
                                                                            name={answerKey}
                                                                            value={opt}
                                                                            checked={val === opt}
                                                                            onChange={() => !isCompleted && handleAnswerChange(answerKey, opt)}
                                                                            disabled={isCompleted}
                                                                            className="mt-1 w-4 h-4 text-sky-600"
                                                                        />
                                                                        <span className={`text-sm ${val === opt ? 'font-semibold text-sky-900 dark:text-sky-300' : 'text-slate-600 dark:text-slate-400'}`}>{opt}</span>
                                                                    </label>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <textarea
                                                                value={val}
                                                                onChange={e => handleAnswerChange(answerKey, e.target.value)}
                                                                disabled={isCompleted}
                                                                placeholder="Type your answer here..."
                                                                className="w-full min-h-[100px] p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:border-sky-500 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all text-slate-800 dark:text-slate-200 disabled:opacity-70 disabled:cursor-not-allowed"
                                                            />
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Navigation */}
                <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                    <div className="max-w-3xl mx-auto flex items-center justify-between">
                        <button
                            onClick={() => setCurrentStep(prev => prev - 1)}
                            disabled={currentStep === 0}
                            className="px-5 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-all flex items-center gap-2"
                        >
                            <ChevronLeft size={18} /> Previous
                        </button>

                        <div className="flex gap-1">
                            {sections.map((_, idx) => (
                                <div key={idx} className={`h-2 rounded-full transition-all ${idx === currentStep ? 'w-8 bg-sky-500' : 'w-2 bg-slate-200 dark:bg-slate-700'}`} />
                            ))}
                        </div>

                        {currentStep === sections.length - 1 ? (
                            <button
                                onClick={handleFinalSubmit}
                                disabled={isCompleted || isSubmitting}
                                className="px-6 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-md disabled:opacity-50 transition-all flex items-center gap-2"
                            >
                                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                                {isCompleted ? 'Submitted' : 'Turn In'}
                            </button>
                        ) : (
                            <button
                                onClick={() => setCurrentStep(prev => prev + 1)}
                                className="px-5 py-2.5 rounded-xl font-bold text-white bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 shadow-sm transition-all flex items-center gap-2"
                            >
                                Next <ChevronRight size={18} />
                            </button>
                        )}
                    </div>
                </footer>
            </div>
        );
    }

    if (isCompanion) {
        // Simplified Companion Renderer (Just mark tasks as done)
        const comp = assignment.content as ReadingCompanionContent;
        const days = comp.days || [];
        const day = days[currentStep];

        return (
            <div className="fixed inset-0 bg-slate-50 dark:bg-slate-950 z-[100] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 h-16 flex items-center justify-between shrink-0 shadow-sm">
                    <div className="flex items-center gap-3">
                        <button onClick={onClose} className="p-2 -ml-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                            <X size={20} />
                        </button>
                        <div>
                            <h2 className="font-bold text-slate-800 dark:text-white leading-tight">{assignment.title}</h2>
                            <div className="text-xs font-medium text-slate-500">Day {currentStep + 1} of {days.length} • {day?.focus}</div>
                        </div>
                    </div>
                    {isCompleted && (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold uppercase tracking-wider">
                            <CheckCircle2 size={14} /> COMPLETED
                        </div>
                    )}
                </header>

                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                    <div className="max-w-2xl mx-auto space-y-6">
                        {day && (
                            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                                <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">{day.activity}</h3>
                                    {day.activity_cn && <p className="text-sm text-slate-500">{day.activity_cn}</p>}
                                </div>
                                <div className="p-6">
                                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Task Checklist</h4>
                                    <div className="space-y-3">
                                        {day.tasks?.map((task, idx) => {
                                            const key = `d${currentStep}_t${idx}`;
                                            const isChecked = answers[key] === true;

                                            return (
                                                <label key={idx} className="flex items-start gap-4 p-4 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={e => !isCompleted && handleAnswerChange(key, e.target.checked)}
                                                        disabled={isCompleted}
                                                        className="mt-1 w-5 h-5 rounded border-slate-300 text-sky-500 focus:ring-sky-500"
                                                    />
                                                    <div>
                                                        <p className={`font-medium ${isChecked ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200'}`}>{task.text}</p>
                                                        {task.text_cn && <p className="text-xs text-slate-400 mt-1">{task.text_cn}</p>}
                                                    </div>
                                                </label>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                    <div className="max-w-2xl mx-auto flex items-center justify-between">
                        <button
                            onClick={() => setCurrentStep(prev => prev - 1)}
                            disabled={currentStep === 0}
                            className="px-5 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-all flex items-center gap-2"
                        >
                            <ChevronLeft size={18} /> Prev Day
                        </button>

                        <div className="text-sm font-bold text-slate-400">Day {currentStep + 1}</div>

                        {currentStep === days.length - 1 ? (
                            <button
                                onClick={handleFinalSubmit}
                                disabled={isCompleted || isSubmitting}
                                className="px-6 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-md disabled:opacity-50 transition-all flex items-center gap-2"
                            >
                                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                                Turn In
                            </button>
                        ) : (
                            <button
                                onClick={() => setCurrentStep(prev => prev + 1)}
                                className="px-5 py-2.5 rounded-xl font-bold text-white bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 shadow-sm transition-all flex items-center gap-2"
                            >
                                Next Day <ChevronRight size={18} />
                            </button>
                        )}
                    </div>
                </footer>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-xl">
                <h3 className="text-xl font-bold mb-4">{assignment.title}</h3>
                <p className="text-slate-500 mb-6">This assignment type ({assignment.content_type}) cannot be completed interactively. Please complete it offline and mark as done.</p>
                <div className="flex gap-3 justify-end">
                    <button onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 font-bold hover:bg-slate-200 dark:hover:bg-slate-600">Cancel</button>
                    {!isCompleted && (
                        <button onClick={handleFinalSubmit} disabled={isSubmitting} className="px-4 py-2 rounded-xl bg-sky-500 text-white font-bold hover:bg-sky-600">
                            {isSubmitting ? 'Submitting...' : 'Mark as Done'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
