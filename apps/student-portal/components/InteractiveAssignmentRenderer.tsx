import React, { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { X, CheckCircle2, ChevronRight, ChevronLeft, Loader2, PlayCircle, MessageSquare, Star, BookOpen, ClipboardList, Send } from 'lucide-react';
import type { Assignment, Submission } from '@pathway/education';
import type { Worksheet, ReadingCompanionContent } from '@shared/types/assignmentContent';
import { Button } from '@shared/components/ui/Button';
import { Textarea } from '@shared/components/ui/Textarea';
import { useAutoSave } from '../hooks/useAutoSave';

interface Props {
    assignment: Assignment & { submission?: Submission };
    onClose: () => void;
    onSubmit: (answers: any) => Promise<void>;
}

export const InteractiveAssignmentRenderer: React.FC<Props> = ({ assignment, onClose, onSubmit }) => {
    const { t } = useLanguage();
    const isWorksheet = assignment.content_type === 'worksheet';
    const isCompanion = assignment.content_type === 'companion';
    const isAssignmentSheet = assignment.content_type === 'assignment_sheet';
    const isEssay = assignment.content_type === 'essay';

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
    const isReturned = assignment.submission?.status === 'returned' || assignment.submission?.status === 'completed';
    const scoreLabel = (s?: number) => s ? ['', 'F', 'D', 'C', 'B', 'A'][s] || '' : '';
    const { isSaving, lastSaved } = useAutoSave(assignment.submission?.id, answers, !isCompleted);

    const FeedbackCard = () => {
        if (!isReturned) return null;
        const notes = assignment.submission?.teacher_notes;
        const score = assignment.submission?.score;
        if (!notes && !score) return null;
        return (
            <div className="max-w-3xl mx-auto mt-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                    <MessageSquare size={16} className="text-amber-600" />
                    <h4 className="font-bold text-amber-800 dark:text-amber-300 text-sm">{t('render.teacherFeedback')}</h4>
                    {score && (
                        <span className="ml-auto flex items-center gap-1 px-2.5 py-0.5 bg-amber-200 dark:bg-amber-700 text-amber-900 dark:text-amber-100 rounded-full text-xs font-bold">
                            <Star size={12} fill="currentColor" /> {scoreLabel(score)}
                        </span>
                    )}
                </div>
                {notes && <p className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed whitespace-pre-wrap">{notes}</p>}
                {!notes && <p className="text-xs text-amber-500 italic">{t('render.noFeedback')}</p>}
            </div>
        );
    };

    if (isWorksheet) {
        const ws = assignment.content_data as Worksheet;
        const sections = ws.sections || [];
        const section = sections[currentStep];

        return (
            <div className="fixed inset-0 bg-slate-50 dark:bg-slate-950 z-[100] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 h-16 flex items-center justify-between shrink-0 shadow-sm">
                    <div className="flex items-center gap-3">
                        <button onClick={onClose} title={t('render.cancel')} className="p-2 -ml-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                            <X size={20} />
                        </button>
                        <div>
                            <h2 className="font-bold text-slate-800 dark:text-white leading-tight">{assignment.title}</h2>
                            <div className="text-xs font-medium text-slate-500">
                                {currentStep + 1} {t('render.sectionOf')} {sections.length} • {section?.title}
                            </div>
                        </div>
                    </div>
                    {isCompleted && (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 rounded-full text-xs font-bold uppercase tracking-wider">
                            <CheckCircle2 size={14} /> {t('render.submitted')}
                        </div>
                    )}
                    {!isCompleted && (isSaving ? (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-300 rounded-full text-xs font-medium">
                            <Loader2 size={12} className="animate-spin" /> {t('render.saving')}
                        </div>
                    ) : lastSaved ? (
                        <div className="px-3 py-1 text-slate-400 text-xs">{t('render.saved')}</div>
                    ) : null)}
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
                                                            <img src={item.imageUrl} alt="Question visual" className="max-w-xs rounded-xl border border-slate-200 dark:border-white/10 shadow-sm mb-4" />
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
                                                            <Textarea
                                                                value={val}
                                                                onChange={e => handleAnswerChange(answerKey, e.target.value)}
                                                                disabled={isCompleted}
                                                                placeholder={t('render.answerPlaceholder')}
                                                                className="min-h-[100px] py-3 text-base dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:border-sky-500 bg-slate-50 w-full"
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

                    <FeedbackCard />
                </div>

                {/* Footer Navigation */}
                <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                    <div className="max-w-3xl mx-auto flex items-center justify-between">
                        <Button
                            variant="ghost"
                            onClick={() => setCurrentStep(prev => prev - 1)}
                            disabled={currentStep === 0}
                            leftIcon={<ChevronLeft size={18} />}
                            className="dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                            {t('render.previous')}
                        </Button>

                        <div className="flex gap-1">
                            {sections.map((_, idx) => (
                                <div key={idx} className={`h-2 rounded-full transition-all ${idx === currentStep ? 'w-8 bg-sky-500' : 'w-2 bg-slate-200 dark:bg-slate-700'}`} />
                            ))}
                        </div>

                        {currentStep === sections.length - 1 ? (
                            <Button
                                theme="emerald"
                                onClick={handleFinalSubmit}
                                disabled={isCompleted || isSubmitting}
                                leftIcon={isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                                className="shadow-md font-bold"
                            >
                                {isCompleted ? t('render.submitted') : t('render.turnIn')}
                            </Button>
                        ) : (
                            <Button
                                variant="primary"
                                onClick={() => setCurrentStep(prev => prev + 1)}
                                rightIcon={<ChevronRight size={18} />}
                                className="dark:bg-slate-700 dark:hover:bg-slate-600 font-bold"
                            >
                                {t('render.next')}
                            </Button>
                        )}
                    </div>
                </footer>
            </div>
        );
    }

    if (isCompanion) {
        // Simplified Companion Renderer (Just mark tasks as done)
        const comp = assignment?.content_data as ReadingCompanionContent | undefined;
        const days = comp?.days || [];
        const day = days[currentStep];

        // Smart date
        const startDate = new Date(assignment.created_at);
        const actualDate = new Date(startDate.getTime() + currentStep * 86400000);
        const dateString = actualDate.toLocaleDateString('zh-CN', { weekday: 'short', month: 'short', day: 'numeric' });

        return (
            <div className="fixed inset-0 bg-slate-50 dark:bg-slate-950 z-[100] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 h-16 flex items-center justify-between shrink-0 shadow-sm">
                    <div className="flex items-center gap-3">
                        <button onClick={onClose} title={t('render.cancel')} className="p-2 -ml-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                            <X size={20} />
                        </button>
                        <div>
                            <h2 className="font-bold text-slate-800 dark:text-white leading-tight">{assignment.title}</h2>
                            <div className="text-xs font-medium text-slate-500">
                                {dateString} • {t('render.day')} {currentStep + 1}{t('render.dayUnit')} {t('render.sectionOf')} {days.length} • {day?.focus}
                            </div>
                        </div>
                    </div>
                    {isCompleted && (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold uppercase tracking-wider">
                            <CheckCircle2 size={14} /> {t('render.completed')}
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
                                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">{t('render.taskChecklist')}</h4>
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

                                {/* Resources */}
                                {day.resources && day.resources.length > 0 && (
                                    <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                                        <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <PlayCircle className="w-4 h-4" /> 今日资源
                                        </h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {day.resources.map((res: any, idx: number) => (
                                                <a href={res.url || '#'} target="_blank" rel="noreferrer" key={idx} className="flex flex-col p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-300 hover:shadow-md transition-all group">
                                                    <span className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 mb-1 line-clamp-2">{res.title}</span>
                                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{res.type}</span>
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Trivia */}
                                {day.trivia && (
                                    <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-amber-50/50 dark:bg-amber-900/20">
                                        <h4 className="text-sm font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <Star className="w-4 h-4" /> 每日趣味冷知识
                                        </h4>
                                        <div className="p-5 rounded-xl bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-700/50 shadow-sm relative overflow-hidden">
                                            <div className="absolute top-0 left-0 w-1 h-full bg-amber-400"></div>
                                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">{day.trivia.en}</p>
                                            <p className="text-sm text-slate-600 dark:text-slate-400">{day.trivia.cn}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <FeedbackCard />
                </div>

                <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                    <div className="max-w-2xl mx-auto flex items-center justify-between">
                        <Button
                            variant="ghost"
                            onClick={() => setCurrentStep(prev => prev - 1)}
                            disabled={currentStep === 0}
                            leftIcon={<ChevronLeft size={18} />}
                            className="dark:text-slate-300 dark:hover:bg-slate-800 font-bold"
                        >
                            {t('render.prevDay')}
                        </Button>

                        <div className="text-sm font-bold text-slate-400">{t('render.day')} {currentStep + 1}{t('render.dayUnit')}</div>

                        {currentStep === days.length - 1 ? (
                            <Button
                                theme="emerald"
                                onClick={handleFinalSubmit}
                                disabled={isCompleted || isSubmitting}
                                leftIcon={isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                                className="shadow-md font-bold"
                            >
                                {isCompleted ? t('render.submitted') : "✔ 上交整个打卡副本"}
                            </Button>
                        ) : (
                            <Button
                                theme="indigo"
                                onClick={() => setCurrentStep(prev => prev + 1)}
                                rightIcon={<ChevronRight size={18} />}
                                className="font-bold shadow-md"
                            >
                                ✔ 完成今日任务
                            </Button>
                        )}
                    </div>
                </footer>
            </div>
        );
    }

    if (isAssignmentSheet) {
        const sheet = assignment?.content_data as any || {};
        const keyPoints = sheet?.keyPoints || [];
        const assignments = sheet?.assignments || [];
        const feedback = sheet?.feedback || { ratings: [] };

        // Helper to get category style for key points, matches ESL planner
        const getCategoryStyle = (text: string) => {
            if (text.startsWith('【课程简介】')) return { color: 'text-violet-600', bg: 'bg-violet-50', label: '📖' };
            if (text.startsWith('【本课词汇】')) return { color: 'text-teal-600', bg: 'bg-teal-50', label: '📝' };
            if (text.startsWith('【语法/句型】')) return { color: 'text-indigo-600', bg: 'bg-indigo-50', label: '📐' };
            if (text.startsWith('【Phonics】')) return { color: 'text-pink-600', bg: 'bg-pink-50', label: '🔤' };
            return { color: 'text-slate-600', bg: 'bg-slate-50', label: '•' };
        };

        const StarRatingReadOnly = ({ score }: { score: number }) => (
            <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                        key={s}
                        className={`w-3 h-3 md:w-4 md:h-4 ${s <= score ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`}
                    />
                ))}
            </div>
        );

        return (
            <div className="fixed inset-0 bg-slate-50 dark:bg-slate-950 z-[100] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 h-16 flex items-center justify-between shrink-0 shadow-sm">
                    <div className="flex items-center gap-3">
                        <button onClick={onClose} title={t('render.cancel')} className="p-2 -ml-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                            <X size={20} />
                        </button>
                        <div>
                            <h2 className="font-bold text-slate-800 dark:text-white leading-tight truncate max-w-[200px] md:max-w-md">{assignment.title}</h2>
                            <div className="text-xs font-medium text-slate-500">
                                作业清单
                            </div>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                    <div className="max-w-2xl mx-auto space-y-6">

                        {/* Section 1: Lesson Summary */}
                        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-5">
                            <h4 className="text-sm font-black text-indigo-900 dark:text-indigo-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <BookOpen className="w-4 h-4 text-indigo-500" />
                                本课内容总结
                            </h4>
                            {sheet.lessonSummary && (
                                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap mb-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50">
                                    {sheet.lessonSummary}
                                </p>
                            )}

                            {keyPoints.length > 0 && (
                                <div className="space-y-2 mt-4">
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">学习重点</div>
                                    {keyPoints.map((kp: string, i: number) => {
                                        const style = getCategoryStyle(kp);
                                        return (
                                            <div key={i} className={`flex items-start gap-2 p-3 rounded-xl ${style.bg} border border-transparent`}>
                                                <span className="text-sm flex-shrink-0 mt-0.5">{style.label}</span>
                                                <div className={`flex-1 text-sm ${style.color} leading-relaxed whitespace-pre-wrap`}>
                                                    {kp}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Section 2: Assignments Checklist */}
                        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-5">
                            <h4 className="text-sm font-black text-indigo-900 dark:text-indigo-300 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <ClipboardList className="w-4 h-4 text-indigo-500" />
                                作业清单
                            </h4>
                            <div className="space-y-3">
                                {assignments.map((item: any, i: number) => {
                                    const key = `assign_t${i}`;
                                    const isChecked = answers[key] === true;

                                    return (
                                        <label key={i} className={`flex items-start gap-3 p-4 rounded-xl border transition-colors cursor-pointer ${item.isFixed ? 'bg-amber-50/30 border-amber-100 hover:bg-amber-50/60' : 'bg-slate-50/50 border-slate-100 dark:border-slate-800 dark:bg-slate-800/30 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={e => !isCompleted && handleAnswerChange(key, e.target.checked)}
                                                disabled={isCompleted}
                                                className="mt-1 w-5 h-5 rounded border-slate-300 text-sky-500 focus:ring-sky-500 shrink-0"
                                            />
                                            <div className="flex-1 min-w-0 pt-0.5">
                                                <p className={`font-bold text-sm ${isChecked ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-200'}`}>
                                                    {item.title}
                                                </p>
                                                {item.description && (
                                                    <p className={`text-xs mt-1 ${isChecked ? 'text-slate-400 line-through' : 'text-slate-500'}`}>
                                                        {item.description}
                                                    </p>
                                                )}
                                            </div>
                                            {item.isFixed && (
                                                <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded uppercase flex-shrink-0 mt-0.5">固定</span>
                                            )}
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Section 3: Teacher Feedback */}
                        {sheet.showComment !== false && (feedback.ratings?.length > 0 || feedback.overallComment) && (
                            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-5">
                                <h4 className="text-sm font-black text-indigo-900 dark:text-indigo-300 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <MessageSquare className="w-4 h-4 text-indigo-500" />
                                    课堂表现反馈
                                </h4>

                                {feedback.ratings && feedback.ratings.length > 0 && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                                        {feedback.ratings.map((r: any, i: number) => (
                                            <div key={i} className="flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100 dark:border-white/5">
                                                <div>
                                                    <div className="text-sm font-bold text-slate-700 dark:text-slate-300">{r.dimension}</div>
                                                    <div className="text-[10px] text-slate-400">{r.dimension_en}</div>
                                                </div>
                                                <StarRatingReadOnly score={r.score} />
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {feedback.overallComment && (
                                    <div className="bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30 rounded-xl p-4 relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-400"></div>
                                        <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">老师寄语</div>
                                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed italic">
                                            "{feedback.overallComment}"
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        <FeedbackCard />
                    </div>
                </div>

                <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                    <div className="max-w-2xl mx-auto flex items-center justify-between">
                        <Button
                            variant="ghost"
                            onClick={onClose}
                            className="dark:text-slate-300 dark:hover:bg-slate-800 font-bold"
                        >
                            {t('render.cancel')}
                        </Button>

                        <Button
                            theme={isCompleted ? "emerald" : "indigo"}
                            onClick={handleFinalSubmit}
                            disabled={isCompleted || isSubmitting}
                            leftIcon={isSubmitting ? <Loader2 size={18} className="animate-spin" /> : (isCompleted ? <CheckCircle2 size={18} /> : <Send size={18} />)}
                            className="shadow-md font-bold min-w-[120px]"
                        >
                            {isCompleted ? t('render.submitted') : t('render.markDone')}
                        </Button>
                    </div>
                </footer>
            </div>
        );
    }

    if (isEssay) {
        return (
            <div className="fixed inset-0 bg-slate-50 dark:bg-slate-950 z-[100] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 h-16 flex items-center justify-between shrink-0 shadow-sm">
                    <div className="flex items-center gap-3">
                        <button onClick={onClose} title={t('render.cancel')} className="p-2 -ml-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                            <X size={20} />
                        </button>
                        <div>
                            <h2 className="font-bold text-slate-800 dark:text-white leading-tight">{assignment.title}</h2>
                            <div className="text-xs font-medium text-pink-500">Essay Writing Lab</div>
                        </div>
                    </div>
                </header>
                <div className="flex-1 overflow-y-auto p-4 md:p-8 flex items-center justify-center">
                    <div className="text-center space-y-4 max-w-md mx-auto">
                        <div className="w-16 h-16 bg-pink-100 dark:bg-pink-900/40 text-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                            <BookOpen size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white">Essay Lab Module</h3>
                        <p className="text-slate-500 dark:text-slate-400">
                            This module is currently in development. The <code className="text-pink-500 font-bold">{'<EssayWritingCanvas />'}</code> hook has been successfully pre-installed in the Polymorphic Render Engine.
                        </p>
                        <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-mono text-slate-500 mt-4 shadow-inner">
                            {`<EssayWritingCanvas \n  assignmentId="${assignment.id}" \n/>`}
                        </div>
                        <Button variant="ghost" onClick={onClose} className="mt-8 font-bold text-slate-500">
                            {t('render.cancel')}
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-xl">
                <h3 className="text-xl font-bold mb-4">{assignment.title}</h3>
                <p className="text-slate-500 mb-6">{t('render.offlineMsg')}</p>
                <div className="flex gap-3 justify-end">
                    <Button variant="ghost" onClick={onClose} className="dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white font-bold">{t('render.cancel')}</Button>
                    {!isCompleted && (
                        <Button
                            theme="indigo"
                            onClick={handleFinalSubmit}
                            disabled={isSubmitting}
                            loading={isSubmitting}
                            className="font-bold"
                        >
                            {isSubmitting ? t('render.submitting') : t('render.markDone')}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};
