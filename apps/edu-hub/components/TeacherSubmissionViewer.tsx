import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { X, CheckCircle2, ChevronRight, ChevronLeft, Loader2, Star, MessageSquare } from 'lucide-react';
import type { Assignment, Submission } from '@pathway/education';
import type { Worksheet, ReadingCompanionContent } from '@shared/types/assignmentContent';
import * as edu from '@pathway/education';

interface Props {
    assignment: Assignment;
    submissions?: Submission[];
    initialSubmissionId?: string;
    onClose: () => void;
    onSubmissionUpdated: (sub: Submission) => void;

    // Legacy support
    submission?: Submission;
}

export const TeacherSubmissionViewer: React.FC<Props> = ({
    assignment,
    submissions = [],
    initialSubmissionId,
    onClose,
    onSubmissionUpdated,
    submission: propSubmission
}) => {
    const { t, lang } = useLanguage();
    const isWorksheet = assignment.content_type === 'worksheet';
    const isCompanion = assignment.content_type === 'companion';
    const isAssignmentSheet = assignment.content_type === 'assignment_sheet';

    // Submissions context
    const actualSubmissions = propSubmission ? [propSubmission] : submissions;
    const [currentIndex, setCurrentIndex] = useState(() => {
        if (!initialSubmissionId) return 0;
        const idx = actualSubmissions.findIndex(s => s.id === initialSubmissionId);
        return idx >= 0 ? idx : 0;
    });

    const submission = actualSubmissions[currentIndex];

    // Internal Viewer Step
    const [currentStep, setCurrentStep] = useState(0);

    // Grading state
    const [score, setScore] = useState<number | null>(submission?.score || null);
    const [notesInput, setNotesInput] = useState(submission?.teacher_notes || '');
    const [isSaving, setIsSaving] = useState(false);

    // When navigating to a new submission, reset grading state and steps
    useEffect(() => {
        if (submission) {
            setScore(submission.score || null);
            setNotesInput(submission.teacher_notes || '');
            setCurrentStep(0);
        }
    }, [submission?.id]);

    const handleSaveFeedback = async () => {
        if (!submission) return;
        setIsSaving(true);
        try {
            const updated: Partial<Submission> = {
                id: submission.id,
                score,
                teacher_notes: notesInput || null,
                status: 'returned' // Automatically mark returned when teacher grades
            };
            const result = await edu.upsertSubmission(updated);
            if (result) {
                onSubmissionUpdated(result);
                // Phase 6: auto-trigger submission tokens (idempotent)
                if (score && score > 0 && submission.student_id) {
                    const pts = score * 10; // score 5→50, 4→40, 3→30, 2→20, 1→10
                    edu.upsertTokenEvent({ student_id: submission.student_id, source_type: 'submission', source_id: `sub_${submission.id}`, delta: pts });
                }
            }
        } finally {
            setIsSaving(false);
        }
    };

    // Auto-save when switching sub if changed
    const autoSaveCurrentIfDirty = async () => {
        if (!submission) return;
        if (score !== (submission.score || null) || notesInput !== (submission.teacher_notes || '')) {
            await handleSaveFeedback();
        }
    };

    const handlePrevSub = async () => {
        if (currentIndex > 0) {
            await autoSaveCurrentIfDirty();
            setCurrentIndex(i => i - 1);
        }
    };

    const handleNextSub = async () => {
        if (currentIndex < actualSubmissions.length - 1) {
            await autoSaveCurrentIfDirty();
            setCurrentIndex(i => i + 1);
        }
    };

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Only trigger if we are not typing in a text area
            if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;

            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                handlePrevSub();
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                handleNextSub();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentIndex, actualSubmissions.length, score, notesInput, submission]);

    if (!submission) return null;

    const answers = submission.content || {};

    const StatusBadge = () => {
        if (submission.status === 'returned') return <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">Returned</span>;
        if (submission.status === 'completed') return <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">Completed</span>;
        if (submission.status === 'submitted') return <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">Needs Review</span>;
        return <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-xs">Pending</span>;
    };

    const GradingSidebar = () => (
        <div className="w-80 bg-slate-50 dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 p-6 flex flex-col shrink-0 relative">
            <h3 className="font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                <Star className="text-amber-500" size={18} /> {lang === 'zh' ? '批改打分' : 'Grading & Feedback'}
            </h3>

            {/* Batch Navigation */}
            {actualSubmissions.length > 1 && (
                <div className="flex items-center justify-between mb-8 bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <button
                        onClick={handlePrevSub}
                        disabled={currentIndex === 0 || isSaving}
                        className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-white disabled:opacity-30 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                        title="Shortcut: Left Arrow"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <div className="text-xs font-bold text-slate-400">
                        {currentIndex + 1} / {actualSubmissions.length}
                    </div>
                    <button
                        onClick={handleNextSub}
                        disabled={currentIndex === actualSubmissions.length - 1 || isSaving}
                        className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-white disabled:opacity-30 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                        title="Shortcut: Right Arrow"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>
            )}

            <div className="space-y-6 flex-1 text-sm">
                <div>
                    <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-2">Grade / Score</label>
                    <div className="flex flex-wrap gap-2">
                        {([5, 4, 3, 2, 1]).map(val => (
                            <button key={val}
                                onClick={() => setScore(val)}
                                className={`w-10 h-10 rounded-xl font-bold transition-all ${score === val ? 'bg-amber-500 text-white shadow-md' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-amber-300'}`}
                            >
                                {['', 'F', 'D', 'C', 'B', 'A'][val]}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label htmlFor="teacher-notes" className="block font-semibold text-slate-600 dark:text-slate-400 mb-2">Teacher Notes</label>
                    <textarea
                        id="teacher-notes"
                        value={notesInput}
                        onChange={e => setNotesInput(e.target.value)}
                        placeholder={lang === 'zh' ? "写下给学生的反馈（支持Markdown）..." : "Write feedback for the student (Markdown supported)..."}
                        className="w-full h-40 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 resize-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                        title="Teacher notes"
                    />
                </div>
            </div>

            <div className="pt-4 mt-auto border-t border-slate-200 dark:border-slate-800 space-y-3">
                <button
                    onClick={handleSaveFeedback}
                    disabled={isSaving}
                    className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold shadow-md transition-colors flex justify-center items-center gap-2 disabled:opacity-50"
                    title="Save feedback and return assignment"
                >
                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                    Save & Return
                </button>
            </div>

            {/* Hotkey hint */}
            <div className="absolute top-2 right-4 text-[10px] text-slate-400 font-medium">Speed Reviewer Active 🚀</div>
        </div>
    );

    if (isWorksheet) {
        const ws = assignment.content_data as Worksheet;
        const sections = ws?.sections || [];
        const section = sections[currentStep];

        return (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex overflow-hidden animate-in fade-in duration-200 p-4 md:p-8 justify-center items-stretch">
                <div className="w-full max-w-6xl bg-white dark:bg-slate-950 rounded-2xl shadow-2xl flex overflow-hidden">
                    {/* Main Content Area */}
                    <div className="flex-1 flex flex-col min-w-0">
                        <header className="px-6 h-16 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-4">
                                <button onClick={onClose} className="p-2 -ml-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800" title="Close viewer">
                                    <X size={20} />
                                </button>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="font-bold text-slate-800 dark:text-white truncate max-w-md">{assignment.title}</h2>
                                        <StatusBadge />
                                        <span className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full text-slate-500">
                                            {submission.student_id ? submission.student_id.substring(0, 8) : 'Unknown Student'}
                                        </span>
                                    </div>
                                    <div className="text-xs text-slate-500 mt-0.5">Section {currentStep + 1} of {sections.length} • {section?.title}</div>
                                </div>
                            </div>
                        </header>

                        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-900/50">
                            {section && (
                                <div className="max-w-3xl mx-auto space-y-6">
                                    {section.passage && (
                                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-2xl border border-indigo-100 dark:border-indigo-800/50">
                                            {section.passageTitle && <h3 className="text-lg font-bold text-indigo-900 dark:text-indigo-300 mb-3">{section.passageTitle}</h3>}
                                            <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{section.passage}</p>
                                        </div>
                                    )}

                                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-8">
                                        {section.items?.map((item, idx) => {
                                            const answerKey = `s${currentStep}_q${idx}`;
                                            const val = answers[answerKey] || '';

                                            return (
                                                <div key={idx} className="flex gap-4">
                                                    <span className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold flex shrink-0 items-center justify-center text-sm">{idx + 1}</span>
                                                    <div className="flex-1 pt-1">
                                                        <p className="font-semibold text-slate-800 dark:text-slate-200 mb-4">{item.question}</p>
                                                        {item.imageUrl && (
                                                            <img src={item.imageUrl} alt="" className="max-w-xs rounded-xl border border-slate-200 dark:border-white/10 mb-4" />
                                                        )}

                                                        {section.layout === 'multiple-choice' && item.options ? (
                                                            <div className="space-y-2">
                                                                {item.options.map((opt, oIdx) => {
                                                                    const isSelected = val === opt;
                                                                    return (
                                                                        <div key={oIdx} className={`flex items-start gap-3 p-3 rounded-xl border-2 ${isSelected ? 'border-sky-500 bg-sky-50 dark:bg-sky-500/10' : 'border-slate-200 dark:border-slate-700 opacity-60'}`}>
                                                                            <input type="radio" checked={isSelected} readOnly className="mt-1 w-4 h-4 text-sky-600" aria-label={`Option ${opt}`} />
                                                                            <span className={`text-sm ${isSelected ? 'font-semibold text-sky-900 dark:text-sky-300' : 'text-slate-500'}`}>{opt}</span>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        ) : (
                                                            <div className="w-full min-h-[100px] p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                                                                {val || <span className="text-slate-400 italic">No answer provided.</span>}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        <footer className="h-16 border-t border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between shrink-0">
                            <button onClick={() => setCurrentStep(p => p - 1)} disabled={currentStep === 0} className="px-4 py-2 font-medium text-slate-600 dark:text-slate-400 disabled:opacity-30 flex items-center gap-2" title="Previous section">
                                <ChevronLeft size={18} /> Prev
                            </button>
                            <div className="text-sm font-medium text-slate-400">{currentStep + 1} / {sections.length}</div>
                            <button onClick={() => setCurrentStep(p => p + 1)} disabled={currentStep === sections.length - 1} className="px-4 py-2 font-medium text-slate-600 dark:text-slate-400 disabled:opacity-30 flex items-center gap-2">
                                Next <ChevronRight size={18} />
                            </button>
                        </footer>
                    </div>

                    {/* Grading Sidebar */}
                    <GradingSidebar />
                </div>
            </div>
        );
    }

    if (isCompanion) {
        const comp = assignment.content_data as ReadingCompanionContent;
        const days = comp?.days || [];
        const day = days[currentStep];

        return (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex overflow-hidden animate-in fade-in duration-200 p-4 md:p-8 justify-center items-stretch">
                <div className="w-full max-w-6xl bg-white dark:bg-slate-950 rounded-2xl shadow-2xl flex overflow-hidden">
                    {/* Main Content Area */}
                    <div className="flex-1 flex flex-col min-w-0">
                        <header className="px-6 h-16 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-4">
                                <button onClick={onClose} className="p-2 -ml-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                                    <X size={20} />
                                </button>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="font-bold text-slate-800 dark:text-white truncate max-w-md">{assignment.title}</h2>
                                        <StatusBadge />
                                        <span className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full text-slate-500">
                                            {submission.student_id ? submission.student_id.substring(0, 8) : 'Unknown Student'}
                                        </span>
                                    </div>
                                    <div className="text-xs text-slate-500 mt-0.5">Day {currentStep + 1} of {days.length} • {day?.focus}</div>
                                </div>
                            </div>
                        </header>

                        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-900/50">
                            {day && (
                                <div className="max-w-2xl mx-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                                    <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">{day.activity}</h3>
                                        <p className="text-sm text-slate-500">{day.activity_cn}</p>
                                    </div>
                                    <div className="p-6">
                                        <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Task Checklist (Student's View)</h4>
                                        <div className="space-y-3">
                                            {day.tasks?.map((task, idx) => {
                                                const key = `d${currentStep}_t${idx}`;
                                                const isChecked = answers[key] === true;
                                                return (
                                                    <div key={idx} className="flex items-start gap-4 p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                                                        <input type="checkbox" checked={isChecked} readOnly className="mt-1 w-5 h-5 rounded border-slate-300 text-sky-500" />
                                                        <div>
                                                            <p className={`font-medium ${isChecked ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200'}`}>{task.text}</p>
                                                            {task.text_cn && <p className="text-xs text-slate-400 mt-1">{task.text_cn}</p>}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <footer className="h-16 border-t border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between shrink-0">
                            <button onClick={() => setCurrentStep(p => p - 1)} disabled={currentStep === 0} className="px-4 py-2 font-medium text-slate-600 dark:text-slate-400 disabled:opacity-30 flex items-center gap-2">
                                <ChevronLeft size={18} /> Prev Day
                            </button>
                            <div className="text-sm font-medium text-slate-400">{currentStep + 1} / {days.length}</div>
                            <button onClick={() => setCurrentStep(p => p + 1)} disabled={currentStep === days.length - 1} className="px-4 py-2 font-medium text-slate-600 dark:text-slate-400 disabled:opacity-30 flex items-center gap-2">
                                Next Day <ChevronRight size={18} />
                            </button>
                        </footer>
                    </div>

                    {/* Grading Sidebar */}
                    <GradingSidebar />
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full shadow-xl flex overflow-hidden">
                <div className="flex-1 p-6">
                    <h3 className="text-xl font-bold mb-4">{assignment.title}</h3>
                    <div className="flex items-center gap-2 mb-6">
                        <StatusBadge />
                        <span className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full text-slate-500">
                            {submission.student_id ? submission.student_id.substring(0, 8) : 'Unknown Student'}
                        </span>
                    </div>
                    <p className="text-slate-500 mb-6">This assignment type ({assignment.content_type}) does not have an interactive viewer. You can only grade it.</p>
                    <button onClick={onClose} className="px-4 py-2 text-sm font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg">Close</button>
                </div>
                <GradingSidebar />
            </div>
        </div>
    );
};
