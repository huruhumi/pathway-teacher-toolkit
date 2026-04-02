import React, { useState } from 'react';
import { ReadingCompanionContent, ReadingTask, WebResource, StructuredLessonPlan, CEFRLevel, SentenceCitation } from '../../types';
import { generateWebResource, generateNewCompanionDay, generateTrivia, translateTaskText } from '../../services/worksheetService';
import { extractCompanionFromPDF } from '../../services/gemini/companionParser';
import { Settings2, BookOpen, Clock, Loader2, Sparkles, Plus, ExternalLink, RefreshCw, Layers, Book, Wand2, RefreshCcw, Save, MessageSquare, Download, Check, AlertCircle, Globe, Lightbulb, Trash2, X, List, Languages, GripVertical, Upload, Copy, ClipboardPaste } from 'lucide-react';
import { useAuthStore } from '@shared/stores/useAuthStore';
import { AssignModal } from '../AssignModal';
import { useLanguage } from '../../i18n/LanguageContext';
import { handleError } from '@shared/services/logger';
import { useToast } from '@shared/stores/useToast';
import * as edu from '@pathway/education';
import { AutoResizeTextarea } from '../common/AutoResizeTextarea';
import { getCitationTooltip } from '../../utils/citationTooltip';

interface CompanionTabProps {
    editableReadingCompanion: ReadingCompanionContent;
    setEditableReadingCompanion: (companion: ReadingCompanionContent) => void;
    editablePlan: StructuredLessonPlan | null;
    ageGroup?: string;
    sentenceCitations?: SentenceCitation[];
    onRegenerate?: () => Promise<void> | void;
    isRegenerating?: boolean;
    regenerateError?: string | null;
    regenerateSuccessMessage?: string | null;
}

export const CompanionTab: React.FC<CompanionTabProps> = React.memo(({
    editableReadingCompanion,
    setEditableReadingCompanion,
    editablePlan,
    ageGroup,
    sentenceCitations,
    onRegenerate,
    isRegenerating = false,
    regenerateError,
    regenerateSuccessMessage,
}) => {
    const [isAddingDay, setIsAddingDay] = useState(false);
    const [addingDayResourceIndex, setAddingDayResourceIndex] = useState<number | null>(null);
    const [isRegeneratingTriviaMap, setIsRegeneratingTriviaMap] = useState<Record<number, boolean>>({});
    const [translatingTask, setTranslatingTask] = useState<string | null>(null); // "dIdx-tIdx"
    const [dragTask, setDragTask] = useState<{ dIdx: number; tIdx: number } | null>(null);
    const [dragOverTask, setDragOverTask] = useState<{ dIdx: number; tIdx: number } | null>(null);
    const [dragDayIdx, setDragDayIdx] = useState<number | null>(null);
    const [dragOverDayTarget, setDragOverDayTarget] = useState<{ idx: number; position: 'before' | 'after' } | null>(null);
    const [isUploadingPdf, setIsUploadingPdf] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [copiedResource, setCopiedResource] = useState<WebResource | null>(null);
    const [copiedTask, setCopiedTask] = useState<ReadingTask | null>(null);

    const { t } = useLanguage();
    const teacherId = useAuthStore(s => s.user?.id);
    const [isAssignOpen, setIsAssignOpen] = useState(false);
    const [isAssigning, setIsAssigning] = useState(false);
    const getCitationTitle = (section: string, text: string) => getCitationTooltip(sentenceCitations, section, text);

    const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            useToast.getState().error('Please upload a valid PDF file.');
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        setIsUploadingPdf(true);
        try {
            const buffer = await file.arrayBuffer();
            const base64 = btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
            const parsed = await extractCompanionFromPDF(base64);
            if (parsed.days && parsed.days.length > 0) {
                setEditableReadingCompanion(parsed);
                useToast.getState().success('Successfully imported Learning Companion from PDF.');
            } else {
                useToast.getState().error('Failed to parse PDF content.');
            }
        } catch (error) {
            console.error(error);
            useToast.getState().error('Error analyzing PDF.');
        } finally {
            setIsUploadingPdf(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleTaskChange = (dIdx: number, tIdx: number, field: keyof ReadingTask, value: any) => {
        const newDays = [...editableReadingCompanion.days];
        const tasks = [...(newDays[dIdx].tasks || [])];
        tasks[tIdx] = { ...tasks[tIdx], [field]: value };
        newDays[dIdx].tasks = tasks;
        setEditableReadingCompanion({ ...editableReadingCompanion, days: newDays });
    };

    const handleTranslateTask = async (dIdx: number, tIdx: number) => {
        const key = `${dIdx}-${tIdx}`;
        if (translatingTask === key) return;
        setTranslatingTask(key);
        try {
            const task = editableReadingCompanion.days[dIdx].tasks?.[tIdx];
            if (!task) return;
            // Determine which field has content to translate FROM
            const sourceText = task.text?.trim() || task.text_cn?.trim() || '';
            if (!sourceText) return;
            const { translated, targetField } = await translateTaskText(sourceText);
            if (translated) {
                handleTaskChange(dIdx, tIdx, targetField, translated);
            }
        } catch (e: unknown) {
            console.error('Translation failed:', e);
        } finally {
            setTranslatingTask(null);
        }
    };

    const handleDeleteTask = (dIdx: number, tIdx: number) => {
        const newDays = [...editableReadingCompanion.days];
        const tasks = [...(newDays[dIdx].tasks || [])];
        tasks.splice(tIdx, 1);
        newDays[dIdx].tasks = tasks;
        setEditableReadingCompanion({ ...editableReadingCompanion, days: newDays });
    };

    const handleCopyTask = (task: ReadingTask) => {
        setCopiedTask({
            text: String(task.text || ''),
            text_cn: String(task.text_cn || ''),
            isCompleted: false,
        });
        useToast.getState().success('Task copied!');
    };

    const handlePasteTask = (dIdx: number) => {
        if (!copiedTask) return;
        const newDays = [...editableReadingCompanion.days];
        newDays[dIdx] = {
            ...newDays[dIdx],
            tasks: [...(newDays[dIdx].tasks || []), { ...copiedTask, isCompleted: false }],
        };
        setEditableReadingCompanion({ ...editableReadingCompanion, days: newDays });
        useToast.getState().success('Task pasted!');
    };

    const handleCancelCopiedTask = () => {
        setCopiedTask(null);
        useToast.getState().info('Task paste cancelled.');
    };

    const handleDayResourceChange = (dIdx: number, rIdx: number, field: keyof WebResource, value: string) => {
        const newDays = [...editableReadingCompanion.days];
        const resources = [...(newDays[dIdx].resources || [])];
        resources[rIdx] = { ...resources[rIdx], [field]: value };
        newDays[dIdx].resources = resources;
        setEditableReadingCompanion({ ...editableReadingCompanion, days: newDays });
    };

    const handleDeleteDayResource = (dIdx: number, rIdx: number) => {
        const newDays = [...editableReadingCompanion.days];
        const resources = [...(newDays[dIdx].resources || [])];
        resources.splice(rIdx, 1);
        newDays[dIdx].resources = resources;
        setEditableReadingCompanion({ ...editableReadingCompanion, days: newDays });
    };

    const handlePasteResource = (dIdx: number) => {
        if (!copiedResource) return;
        const newDays = [...editableReadingCompanion.days];
        newDays[dIdx] = {
            ...newDays[dIdx],
            resources: [...(newDays[dIdx].resources || []), { ...copiedResource }],
        };
        setEditableReadingCompanion({ ...editableReadingCompanion, days: newDays });
        useToast.getState().success('Resource pasted!');
    };

    const handleCancelCopiedResource = () => {
        setCopiedResource(null);
        useToast.getState().info('Resource paste cancelled.');
    };

    const handleDayTriviaChange = (dIdx: number, field: 'en' | 'cn', value: string) => {
        const newDays = [...editableReadingCompanion.days];
        const day = { ...newDays[dIdx] };
        day.trivia = { ...(day.trivia || { en: '', cn: '' }), [field]: value };
        newDays[dIdx] = day;
        setEditableReadingCompanion({ ...editableReadingCompanion, days: newDays });
    };

    const handleRegenerateTrivia = async (dIdx: number) => {
        if (!editablePlan || isRegeneratingTriviaMap[dIdx]) return;
        setIsRegeneratingTriviaMap(prev => ({ ...prev, [dIdx]: true }));
        try {
            const day = editableReadingCompanion.days[dIdx];
            const taskTexts = (day.tasks || []).map(t => t.text).filter(Boolean);
            const newTrivia = await generateTrivia(
                editablePlan.classInformation.topic,
                day.focus,
                { dayNumber: Number(day.day) || dIdx + 1, taskTexts },
            );
            const newDays = [...editableReadingCompanion.days];
            newDays[dIdx] = { ...newDays[dIdx], trivia: newTrivia };
            setEditableReadingCompanion({ ...editableReadingCompanion, days: newDays });
        } catch (e: unknown) {
            console.error("Failed to regenerate trivia", e);
        } finally {
            setIsRegeneratingTriviaMap(prev => ({ ...prev, [dIdx]: false }));
        }
    };

    const handleAddDayResource = async (dIdx: number) => {
        if (!editablePlan || addingDayResourceIndex !== null) return;
        setAddingDayResourceIndex(dIdx);
        try {
            const day = editableReadingCompanion.days[dIdx];
            const newResource = await generateWebResource(editablePlan.classInformation.topic, day.focus);
            const newDays = [...editableReadingCompanion.days];
            newDays[dIdx] = {
                ...newDays[dIdx],
                resources: [...(newDays[dIdx].resources || []), newResource]
            };
            setEditableReadingCompanion({ ...editableReadingCompanion, days: newDays });
        } catch (e: unknown) {
            console.error("Failed to generate resource", e);
        } finally {
            setAddingDayResourceIndex(null);
        }
    };

    const handleManualAddDayResource = (dayIdx: number) => {
        const newDays = [...editableReadingCompanion.days];
        const newResource: WebResource = {
            title: "New Resource",
            title_cn: "新资源",
            url: "",
            description: "Resource description...",
            description_cn: "资源描述..."
        };
        newDays[dayIdx] = {
            ...newDays[dayIdx],
            resources: [...(newDays[dayIdx].resources || []), newResource]
        };
        setEditableReadingCompanion({ ...editableReadingCompanion, days: newDays });
    };

    const handleAddBlankTask = (dIdx: number) => {
        const newDays = [...editableReadingCompanion.days];
        const blankTask: ReadingTask = { text: '', text_cn: '', isCompleted: false };
        newDays[dIdx] = {
            ...newDays[dIdx],
            tasks: [...(newDays[dIdx].tasks || []), blankTask]
        };
        setEditableReadingCompanion({ ...editableReadingCompanion, days: newDays });
    };

    const handleTaskDragEnd = (dIdx: number, fromIdx: number, toIdx: number) => {
        if (fromIdx === toIdx) return;
        const newDays = [...editableReadingCompanion.days];
        const tasks = [...(newDays[dIdx].tasks || [])];
        const [moved] = tasks.splice(fromIdx, 1);
        tasks.splice(toIdx, 0, moved);
        newDays[dIdx] = { ...newDays[dIdx], tasks };
        setEditableReadingCompanion({ ...editableReadingCompanion, days: newDays });
    };

    const handleDayDrop = (targetIdx: number, position: 'before' | 'after') => {
        if (dragDayIdx === null) return;
        const newDays = [...editableReadingCompanion.days];
        const [movedDay] = newDays.splice(dragDayIdx, 1);
        let insertIdx = position === 'before' ? targetIdx : targetIdx + 1;
        if (dragDayIdx < insertIdx) insertIdx -= 1;
        insertIdx = Math.max(0, Math.min(insertIdx, newDays.length));
        newDays.splice(insertIdx, 0, movedDay);
        const renumberedDays = newDays.map((day, idx) => ({ ...day, day: idx + 1 }));
        setEditableReadingCompanion({ ...editableReadingCompanion, days: renumberedDays });
    };

    const handleDayDragEnd = () => {
        setDragDayIdx(null);
        setDragOverDayTarget(null);
    };

    const handleAddNewDay = async () => {
        if (!editablePlan || isAddingDay) return;
        setIsAddingDay(true);
        try {
            const nextDayNum = editableReadingCompanion.days.length + 1;
            const newDay = await generateNewCompanionDay(
                editablePlan.classInformation.level as CEFRLevel,
                editablePlan.classInformation.topic,
                nextDayNum,
                { ageGroup },
            );
            setEditableReadingCompanion({
                ...editableReadingCompanion,
                days: [...editableReadingCompanion.days, newDay]
            });
        } catch (e: unknown) {
            console.error("Failed to add day", e);
        } finally {
            setIsAddingDay(false);
        }
    };

    const handleAssign = async (classId: string, dueDate: string) => {
        if (!teacherId || !editablePlan || !editableReadingCompanion) return;
        setIsAssigning(true);

        try {
            const assignment = await edu.upsertAssignment({
                teacher_id: teacherId,
                title: `${editablePlan.classInformation.topic} - Learning Companion`,
                description: `A 7-day learning companion for ${editablePlan.classInformation.topic}`,
                class_id: classId,
                content_type: 'companion',
                content_data: editableReadingCompanion, // JSON payload
                due_date: dueDate || null
            } as any);

            if (assignment) {
                const clsStudents = await edu.fetchClassStudents(classId);
                const sids = clsStudents.map(cs => cs.student_id);
                await edu.createSubmissionsForClass(assignment.id, sids);

                setIsAssignOpen(false);
                useToast.getState().success(t('assign.success') as string);
            } else {
                useToast.getState().error(t('assign.error') as string);
            }
        } catch (e: any) {
            console.error("Assignment failed:", e);
            handleError(e, t('assign.error'), 'CompanionTab');
            useToast.getState().error(t('assign.error') as string);
        } finally {
            setIsAssigning(false);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in relative">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <div className="flex items-center gap-3">
                    <img id="pathway-logo" src={`${import.meta.env.BASE_URL}logo.png`} alt="Pathway Academy" className="w-10 h-10 object-contain" />
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">7-Day Learning Companion</h3>
                </div>
                <div className="flex gap-2 no-print">
                    <input
                        type="file"
                        accept=".pdf"
                        ref={fileInputRef}
                        onChange={handlePdfUpload}
                        className="hidden"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingPdf}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:border-violet-400 hover:text-violet-600 transition-all disabled:opacity-50"
                        title="Upload old Learning Companion PDF to autofill"
                    >
                        {isUploadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        Import PDF
                    </button>
                    <button
                        onClick={() => onRegenerate?.()}
                        disabled={!onRegenerate || isRegenerating}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:border-violet-400 hover:text-violet-600 transition-all disabled:opacity-50"
                        title="Regenerate companion with current lesson plan and prompt"
                    >
                        {isRegenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        Regenerate
                    </button>
                    <button
                        onClick={() => setIsAssignOpen(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-medium rounded-xl hover:shadow-lg transition-transform hover:-translate-y-0.5"
                        title={t('assign.title') as string}
                    >
                        ✨ {t('assign.confirm') as string}
                    </button>
                </div>
            </div>

            {(isRegenerating || regenerateError || regenerateSuccessMessage) && (
                <div
                    className={`rounded-2xl border px-4 py-3 flex items-start gap-3 text-sm ${
                        regenerateError
                            ? 'border-red-200 bg-red-50 text-red-700'
                            : regenerateSuccessMessage
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-violet-200 bg-violet-50 text-violet-700'
                    }`}
                >
                    {isRegenerating ? (
                        <Loader2 className="w-4 h-4 mt-0.5 animate-spin shrink-0" />
                    ) : regenerateError ? (
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    ) : (
                        <Check className="w-4 h-4 mt-0.5 shrink-0" />
                    )}
                    <span>
                        {isRegenerating
                            ? 'Regenerating companion with the latest lesson plan, prompt, and stage media...'
                            : regenerateError || regenerateSuccessMessage}
                    </span>
                </div>
            )}

            <div className="space-y-6">
                {editableReadingCompanion.days.map((day, dIdx) => (
                    <div
                        key={dIdx}
                        onDragOver={(e) => {
                            if (dragDayIdx === null) return;
                            e.preventDefault();
                            const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                            const position = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
                            setDragOverDayTarget({ idx: dIdx, position });
                        }}
                        onDrop={(e) => {
                            if (dragDayIdx === null) return;
                            e.preventDefault();
                            const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                            const position = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
                            handleDayDrop(dIdx, position);
                            handleDayDragEnd();
                        }}
                        className={`bg-white dark:bg-slate-900/80 border rounded-xl overflow-hidden shadow-sm flex flex-col border-slate-200 dark:border-white/10 print:break-inside-avoid print:shadow-none print:border-slate-300 ${dragOverDayTarget?.idx === dIdx && dragDayIdx !== null ? 'ring-2 ring-violet-300 border-violet-300' : ''}`}
                    >
                        {dragDayIdx !== null && dragOverDayTarget?.idx === dIdx && dragOverDayTarget.position === 'before' && (
                            <div className="h-1 bg-violet-400/80" />
                        )}
                        {/* Compact Top Header */}
                        <div className="w-full bg-slate-50/80 px-4 py-3 border-b border-slate-200 dark:border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 print:bg-slate-50">
                            <div className="flex items-center gap-3 w-full sm:w-auto flex-1 min-w-0">
                                <button
                                    draggable
                                    onDragStart={() => {
                                        setDragDayIdx(dIdx);
                                        setDragOverDayTarget({ idx: dIdx, position: 'before' });
                                    }}
                                    onDragEnd={handleDayDragEnd}
                                    className="p-1.5 rounded-md text-slate-300 hover:text-slate-500 hover:bg-slate-100 cursor-grab active:cursor-grabbing print:hidden"
                                    title="Drag to reorder day cards"
                                >
                                    <GripVertical className="w-4 h-4" />
                                </button>
                                <div className="px-3 shrink-0 h-10 bg-white dark:bg-slate-900/80 rounded-lg flex items-center justify-center text-violet-600 font-bold text-sm border border-slate-200 dark:border-white/10 shadow-sm print:shadow-none whitespace-nowrap">
                                    Day {day.day}
                                </div>
                                <div className="flex flex-col min-w-0 flex-1">
                                    <input
                                        value={day.focus}
                                        onChange={(e) => {
                                            const newDays = [...editableReadingCompanion.days];
                                            newDays[dIdx].focus = e.target.value;
                                            setEditableReadingCompanion({ ...editableReadingCompanion, days: newDays });
                                        }}
                                        className="text-base font-bold text-slate-800 dark:text-slate-200 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-violet-500 outline-none w-full pb-0.5 transition-colors heading-font placeholder:text-slate-300"
                                        placeholder="Day Focus"
                                    />
                                    <input
                                        value={day.focus_cn}
                                        onChange={(e) => {
                                            const newDays = [...editableReadingCompanion.days];
                                            newDays[dIdx].focus_cn = e.target.value;
                                            setEditableReadingCompanion({ ...editableReadingCompanion, days: newDays });
                                        }}
                                        className="text-[11px] font-medium text-slate-500 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-violet-500 outline-none w-full transition-colors placeholder:text-slate-300 mt-0.5"
                                        placeholder="Chinese Translation"
                                    />
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end print:hidden">
                                <button onClick={() => handleAddBlankTask(dIdx)} className="px-3 py-1.5 bg-white dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/10 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-violet-50 hover:text-violet-700 hover:border-violet-200 transition-all flex items-center gap-1.5">
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Task</span>
                                </button>
                                <button onClick={() => handleManualAddDayResource(dIdx)} className="px-3 py-1.5 bg-white dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/10 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-violet-50 hover:text-violet-700 hover:border-violet-200 transition-all flex items-center gap-1.5">
                                    <Globe className="w-3.5 h-3.5" />
                                    <span>Resource</span>
                                </button>
                            </div>
                        </div>

                        {/* Tight 2-Column Body Grid */}
                        <div className="p-4 flex flex-col lg:flex-row gap-5">
                            {/* Left Column: Step-by-Step */}
                            <div className="flex-1 flex flex-col gap-4">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-1.5">
                                        <div className="flex items-center gap-1.5">
                                            <div className="bg-emerald-100 text-emerald-600 p-1 rounded-md">
                                                <List size={12} />
                                            </div>
                                            <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">Step-by-Step Tasks</h5>
                                        </div>
                                        {copiedTask && (
                                            <div className="flex items-center gap-1 print:hidden">
                                                <button
                                                    onClick={() => handlePasteTask(dIdx)}
                                                    className="text-[10px] flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-bold uppercase tracking-wider bg-emerald-50 hover:bg-emerald-100 transition-colors px-1.5 py-0.5 rounded"
                                                    title="Paste copied task"
                                                >
                                                    <ClipboardPaste className="w-3 h-3" />
                                                    Paste
                                                </button>
                                                <button
                                                    onClick={handleCancelCopiedTask}
                                                    className="text-[10px] flex items-center gap-1 text-slate-500 hover:text-slate-700 font-bold uppercase tracking-wider bg-slate-100 hover:bg-slate-200 transition-colors px-1.5 py-0.5 rounded"
                                                    title="Cancel copied task"
                                                >
                                                    <X className="w-3 h-3" />
                                                    Cancel
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        {day.tasks?.map((task, tIdx) => (
                                            <div
                                                key={tIdx}
                                                draggable
                                                onDragStart={() => setDragTask({ dIdx, tIdx })}
                                                onDragOver={(e) => { e.preventDefault(); setDragOverTask({ dIdx, tIdx }); }}
                                                onDragEnd={() => {
                                                    if (dragTask && dragOverTask && dragTask.dIdx === dragOverTask.dIdx) {
                                                        handleTaskDragEnd(dragTask.dIdx, dragTask.tIdx, dragOverTask.tIdx);
                                                    }
                                                    setDragTask(null);
                                                    setDragOverTask(null);
                                                }}
                                                className={`flex gap-2 items-start p-2 bg-slate-50/50 rounded-lg border group hover:border-slate-300 transition-colors print:border-slate-200 ${dragOverTask?.dIdx === dIdx && dragOverTask?.tIdx === tIdx ? 'border-violet-400 bg-violet-50/30' : 'border-slate-100 dark:border-white/5/60'}`}
                                            >
                                                <div className="shrink-0 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 mt-0.5 print:hidden" title="Drag to reorder">
                                                    <GripVertical className="w-3.5 h-3.5" />
                                                </div>
                                                <button
                                                    onClick={() => handleTaskChange(dIdx, tIdx, 'isCompleted', !task.isCompleted)}
                                                    className={`w-4 h-4 shrink-0 rounded border transition-all mt-0.5 flex items-center justify-center print:border-slate-400 ${task.isCompleted ? 'bg-emerald-500 border-emerald-500' : 'bg-white dark:bg-slate-900/80 border-slate-300 hover:border-emerald-400'}`}
                                                >
                                                    {task.isCompleted && <Check className="w-2.5 h-2.5 text-white stroke-[3] print:text-black" />}
                                                </button>
                                                <div className="flex-1 flex flex-col">
                                                    <AutoResizeTextarea
                                                        value={task.text}
                                                        onChange={(e) => handleTaskChange(dIdx, tIdx, 'text', e.target.value)}
                                                        className={`w-full text-xs font-medium bg-transparent border-b border-transparent hover:border-slate-300 focus:border-violet-400 outline-none pb-0.5 transition-colors leading-tight resize-none ${task.isCompleted ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-400'}`}
                                                    />
                                                    <AutoResizeTextarea
                                                        value={task.text_cn}
                                                        onChange={(e) => handleTaskChange(dIdx, tIdx, 'text_cn', e.target.value)}
                                                        className={`w-full text-[10px] text-slate-500 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-violet-400 outline-none transition-colors leading-tight resize-none ${task.isCompleted ? 'text-slate-300' : 'text-slate-500'}`}
                                                    />
                                                </div>
                                                <button
                                                    onClick={() => handleTranslateTask(dIdx, tIdx)}
                                                    disabled={translatingTask === `${dIdx}-${tIdx}`}
                                                    className="shrink-0 p-0.5 text-slate-300 hover:text-violet-600 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-100 print:hidden"
                                                    title="Auto-translate EN↔CN"
                                                >
                                                    {translatingTask === `${dIdx}-${tIdx}` ? <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-500" /> : <Languages className="w-3.5 h-3.5" />}
                                                </button>
                                                <button
                                                    onClick={() => handleCopyTask(task)}
                                                    className="shrink-0 text-slate-300 hover:text-blue-500 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity print:hidden"
                                                    title="Copy task"
                                                >
                                                    <Copy className="w-3.5 h-3.5" />
                                                </button>
                                                <button onClick={() => handleDeleteTask(dIdx, tIdx)} className="shrink-0 text-slate-300 hover:text-red-500 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity print:hidden" title="Delete task">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                        {(!day.tasks || day.tasks.length === 0) && <p className="text-[10px] text-slate-400 text-center py-3 bg-slate-50/50 rounded-lg border border-dashed border-slate-200 dark:border-white/10 print:hidden">No tasks defined.</p>}
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Trivia + Resources */}
                            <div className="flex-1 flex flex-col gap-4">
                                {day.trivia && (
                                    <div className="bg-amber-50/40 p-3 rounded-xl border border-amber-100 relative group transition-colors hover:border-amber-200 hover:bg-amber-50/80 print:border-slate-200 print:bg-slate-50">
                                        <div className="absolute top-2 right-2 print:hidden opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleRegenerateTrivia(dIdx)}
                                                disabled={isRegeneratingTriviaMap[dIdx]}
                                                className="p-1 text-amber-500 hover:text-amber-700 hover:bg-amber-100 rounded disabled:opacity-50"
                                                title="Regenerate Trivia Fact"
                                            >
                                                {isRegeneratingTriviaMap[dIdx] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                            </button>
                                        </div>
                                        <h5 className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1.5 flex items-center gap-1.5 print:text-slate-600">
                                            <Lightbulb className="w-3 h-3" />
                                            Daily Trivia
                                        </h5>
                                        {isRegeneratingTriviaMap[dIdx] ? (
                                            <div className="space-y-1.5 py-1 animate-pulse">
                                                <div className="h-3 bg-amber-200/50 rounded w-full"></div>
                                                <div className="h-3 bg-amber-200/50 rounded w-3/4"></div>
                                            </div>
                                        ) : (
                                            <div className="space-y-1 pr-5">
                                                <AutoResizeTextarea
                                                    value={day.trivia.en}
                                                    onChange={(e) => handleDayTriviaChange(dIdx, 'en', e.target.value)}
                                                    title={getCitationTitle(`readingCompanion.days.${dIdx}.trivia.en`, day.trivia.en)}
                                                    className="w-full text-xs font-semibold text-amber-900 leading-snug bg-transparent border-b border-transparent hover:border-amber-200 focus:border-amber-400 outline-none transition-colors print:text-slate-800"
                                                    minRows={1}
                                                />
                                                <AutoResizeTextarea
                                                    value={day.trivia.cn}
                                                    onChange={(e) => handleDayTriviaChange(dIdx, 'cn', e.target.value)}
                                                    className="w-full text-[10px] text-amber-700 italic bg-transparent border-b border-transparent hover:border-amber-200 focus:border-amber-400 outline-none transition-colors print:text-slate-600"
                                                    minRows={1}
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="space-y-2 relative">
                                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-1.5">
                                        <div className="flex items-center gap-1.5">
                                            <div className="bg-orange-100 text-orange-600 p-1 rounded-md">
                                                <Globe size={12} />
                                            </div>
                                            <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">Web Resources</h5>
                                        </div>
                                        {copiedResource && (
                                            <div className="flex items-center gap-1 print:hidden">
                                                <button
                                                    onClick={() => handlePasteResource(dIdx)}
                                                    className="text-[10px] flex items-center gap-1 text-orange-500 hover:text-orange-700 font-bold uppercase tracking-wider bg-orange-50/80 hover:bg-orange-100 transition-colors px-1.5 py-0.5 rounded"
                                                    title="Paste copied resource"
                                                >
                                                    <ClipboardPaste className="w-3 h-3" />
                                                    Paste
                                                </button>
                                                <button
                                                    onClick={handleCancelCopiedResource}
                                                    className="text-[10px] flex items-center gap-1 text-slate-500 hover:text-slate-700 font-bold uppercase tracking-wider bg-slate-100 hover:bg-slate-200 transition-colors px-1.5 py-0.5 rounded"
                                                    title="Cancel copied resource"
                                                >
                                                    <X className="w-3 h-3" />
                                                    Cancel
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        {day.resources?.map((res, rIdx) => (
                                            <div key={rIdx} className="bg-slate-50/50 p-2.5 rounded-lg border border-slate-100 dark:border-white/5/60 shadow-sm relative group hover:border-slate-300 transition-colors print:border-slate-200 print:shadow-none">
                                                <div className="flex items-center mb-1 gap-2">
                                                    <input
                                                        value={res.title}
                                                        onChange={(e) => handleDayResourceChange(dIdx, rIdx, 'title', e.target.value)}
                                                        className="flex-1 text-[11px] font-bold text-slate-800 dark:text-slate-200 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-orange-400 outline-none transition-colors"
                                                    />
                                                    <div className="flex items-center gap-1 shrink-0 print:hidden opacity-0 group-hover:opacity-100 transition-all">
                                                        <a href={res.url} target="_blank" rel="noopener noreferrer" className="p-0.5 text-orange-400 hover:bg-orange-50 hover:text-orange-600 rounded transition-colors" title="Open Link">
                                                            <ExternalLink className="w-3.5 h-3.5" />
                                                        </a>
                                                        <button onClick={() => {
                                                            setCopiedResource({
                                                                title: String(res.title || ''),
                                                                title_cn: String(res.title_cn || ''),
                                                                url: String(res.url || ''),
                                                                description: String(res.description || ''),
                                                                description_cn: String(res.description_cn || ''),
                                                            });
                                                            useToast.getState().success('Resource copied!');
                                                        }} className="p-0.5 text-slate-400 hover:bg-blue-50 hover:text-blue-500 rounded transition-colors" title="Copy Resource">
                                                            <Copy className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button onClick={() => handleDeleteDayResource(dIdx, rIdx)} className="p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded transition-colors" title="Delete Resource">
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                                <input
                                                    value={res.url}
                                                    onChange={(e) => handleDayResourceChange(dIdx, rIdx, 'url', e.target.value)}
                                                    className="w-full text-[9px] text-slate-400 mb-1.5 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-orange-400 outline-none transition-colors font-mono break-all"
                                                    placeholder="URL link..."
                                                />
                                                <AutoResizeTextarea
                                                    value={res.description_cn || res.description}
                                                    onChange={(e) => handleDayResourceChange(dIdx, rIdx, 'description_cn', e.target.value)}
                                                    className="w-full text-[10px] font-medium text-slate-600 dark:text-slate-400 leading-snug bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-white/10/60 hover:border-slate-300 focus:border-orange-300 rounded md p-1.5 outline-none transition-colors"
                                                    minRows={1}
                                                />
                                            </div>
                                        ))}
                                        {(!day.resources || day.resources.length === 0) && (
                                            <button onClick={() => handleManualAddDayResource(dIdx)} className="w-full py-3 border border-dashed border-slate-200 dark:border-white/10 rounded-lg text-slate-400 hover:text-orange-600 hover:bg-orange-50/50 hover:border-orange-300 transition-all flex items-center justify-center gap-1.5 bg-slate-50/50 print:hidden">
                                                <Globe className="w-3 h-3 opacity-70" />
                                                <span className="text-[9px] font-bold uppercase tracking-wider">Add Manual Resource</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        {dragDayIdx !== null && dragOverDayTarget?.idx === dIdx && dragOverDayTarget.position === 'after' && (
                            <div className="h-1 bg-violet-400/80" />
                        )}
                    </div>
                ))}
            </div>
            <button onClick={handleAddNewDay} disabled={isAddingDay} className="w-full py-4 border border-dashed border-slate-300 rounded-2xl text-slate-500 hover:text-indigo-600 hover:bg-slate-50 hover:border-indigo-300 transition-all font-bold text-sm flex items-center justify-center gap-2 no-print bg-white dark:bg-slate-900/80 shadow-sm hover:shadow-md">
                {isAddingDay ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                {isAddingDay ? 'Planning Next Day...' : 'Extend Review Plan (Add Day)'}
            </button>

            <AssignModal
                isOpen={isAssignOpen}
                onClose={() => setIsAssignOpen(false)}
                onAssign={handleAssign}
                assignmentType="companion"
                isSaving={isAssigning}
            />
        </div>
    );
});
