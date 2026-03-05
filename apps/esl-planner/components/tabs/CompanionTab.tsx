import React, { useState } from 'react';
import { ReadingCompanionContent, ReadingTask, WebResource, StructuredLessonPlan, CEFRLevel } from '../../types';
import { generateReadingTask, generateWebResource, generateNewCompanionDay, generateTrivia } from '../../services/geminiService';
import { Check, Trash2, Plus, X, ExternalLink, Loader2, Globe, Lightbulb, RefreshCw, Target, List, AlertCircle } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { AssignModal } from '../AssignModal';
import * as edu from '@shared/services/educationService';
import { useAuthStore } from '@shared/stores/useAuthStore';
interface AutoResizeTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    minRows?: number;
}
const AutoResizeTextarea: React.FC<AutoResizeTextareaProps> = ({ minRows = 1, className, ...props }) => {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);
    React.useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [props.value]);
    return <textarea ref={textareaRef} rows={minRows} className={`resize-none overflow-hidden ${className || ''}`} {...props} />;
};

interface CompanionTabProps {
    editableReadingCompanion: ReadingCompanionContent;
    setEditableReadingCompanion: (companion: ReadingCompanionContent) => void;
    editablePlan: StructuredLessonPlan | null;
}

export const CompanionTab: React.FC<CompanionTabProps> = ({
    editableReadingCompanion,
    setEditableReadingCompanion,
    editablePlan,
}) => {
    const [isAddingDay, setIsAddingDay] = useState(false);
    const [addingTaskIndex, setAddingTaskIndex] = useState<number | null>(null);
    const [addingDayResourceIndex, setAddingDayResourceIndex] = useState<number | null>(null);
    const [isRegeneratingTriviaMap, setIsRegeneratingTriviaMap] = useState<Record<number, boolean>>({});

    const { t } = useLanguage();
    const teacherId = useAuthStore(s => s.user?.id);
    const [isAssignOpen, setIsAssignOpen] = useState(false);
    const [isAssigning, setIsAssigning] = useState(false);
    const [assignError, setAssignError] = useState('');
    const [assignSuccess, setAssignSuccess] = useState('');

    const handleTaskChange = (dIdx: number, tIdx: number, field: keyof ReadingTask, value: any) => {
        const newDays = [...editableReadingCompanion.days];
        const tasks = [...(newDays[dIdx].tasks || [])];
        tasks[tIdx] = { ...tasks[tIdx], [field]: value };
        newDays[dIdx].tasks = tasks;
        setEditableReadingCompanion({ ...editableReadingCompanion, days: newDays });
    };

    const handleDeleteTask = (dIdx: number, tIdx: number) => {
        const newDays = [...editableReadingCompanion.days];
        const tasks = [...(newDays[dIdx].tasks || [])];
        tasks.splice(tIdx, 1);
        newDays[dIdx].tasks = tasks;
        setEditableReadingCompanion({ ...editableReadingCompanion, days: newDays });
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
            const newTrivia = await generateTrivia(editablePlan.classInformation.topic, day.focus);
            const newDays = [...editableReadingCompanion.days];
            newDays[dIdx] = { ...newDays[dIdx], trivia: newTrivia };
            setEditableReadingCompanion({ ...editableReadingCompanion, days: newDays });
        } catch (e) {
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
        } catch (e) {
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

    const handleAddNewTask = async (dIdx: number) => {
        if (!editablePlan || addingTaskIndex !== null) return;
        setAddingTaskIndex(dIdx);
        try {
            const day = editableReadingCompanion.days[dIdx];
            const newTask = await generateReadingTask(
                editablePlan.classInformation.level as CEFRLevel,
                editablePlan.classInformation.topic,
                day.focus
            );
            const newDays = [...editableReadingCompanion.days];
            newDays[dIdx] = {
                ...newDays[dIdx],
                tasks: [...(newDays[dIdx].tasks || []), newTask]
            };
            setEditableReadingCompanion({ ...editableReadingCompanion, days: newDays });
        } catch (e) {
            console.error("Failed to add task", e);
        } finally {
            setAddingTaskIndex(null);
        }
    };

    const handleAddNewDay = async () => {
        if (!editablePlan || isAddingDay) return;
        setIsAddingDay(true);
        try {
            const nextDayNum = editableReadingCompanion.days.length + 1;
            const newDay = await generateNewCompanionDay(
                editablePlan.classInformation.level as CEFRLevel,
                editablePlan.classInformation.topic,
                nextDayNum
            );
            setEditableReadingCompanion({
                ...editableReadingCompanion,
                days: [...editableReadingCompanion.days, newDay]
            });
        } catch (e) {
            console.error("Failed to add day", e);
        } finally {
            setIsAddingDay(false);
        }
    };

    const handleAssign = async (classId: string, dueDate: string) => {
        if (!teacherId || !editablePlan || !editableReadingCompanion) return;
        setIsAssigning(true);
        setAssignError('');
        setAssignSuccess('');

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

                setAssignSuccess(t('assign.success') as string);
                setTimeout(() => {
                    setIsAssignOpen(false);
                    setAssignSuccess('');
                }, 2000);
            } else {
                setAssignError(t('assign.error') as string);
            }
        } catch (e: any) {
            console.error("Assignment failed:", e);
            setAssignError(e.message || t('assign.error'));
        } finally {
            setIsAssigning(false);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in relative">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <h3 className="text-xl font-bold text-slate-800">7-Day Learning Companion</h3>
                <div className="flex gap-2 no-print">
                    <button
                        onClick={() => setIsAssignOpen(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-medium rounded-xl hover:shadow-lg transition-transform hover:-translate-y-0.5"
                        title={t('assign.title') as string}
                    >
                        ✨ {t('assign.confirm') as string}
                    </button>
                </div>
            </div>

            <div className="space-y-6">
                {editableReadingCompanion.days.map((day, dIdx) => (
                    <div key={dIdx} className="bg-white border rounded-xl overflow-hidden shadow-sm flex flex-col border-slate-200 print:break-inside-avoid print:shadow-none print:border-slate-300">
                        {/* Compact Top Header */}
                        <div className="w-full bg-slate-50/80 px-4 py-3 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 print:bg-slate-50">
                            <div className="flex items-center gap-3 w-full sm:w-auto flex-1 min-w-0">
                                <div className="px-3 shrink-0 h-10 bg-white rounded-lg flex items-center justify-center text-violet-600 font-bold text-sm border border-slate-200 shadow-sm print:shadow-none whitespace-nowrap">
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
                                        className="text-base font-bold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-violet-500 outline-none w-full pb-0.5 transition-colors heading-font placeholder:text-slate-300 truncate"
                                        placeholder="Day Focus"
                                    />
                                    <input
                                        value={day.focus_cn}
                                        onChange={(e) => {
                                            const newDays = [...editableReadingCompanion.days];
                                            newDays[dIdx].focus_cn = e.target.value;
                                            setEditableReadingCompanion({ ...editableReadingCompanion, days: newDays });
                                        }}
                                        className="text-[11px] font-medium text-slate-500 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-violet-500 outline-none w-full transition-colors placeholder:text-slate-300 truncate mt-0.5"
                                        placeholder="Chinese Translation"
                                    />
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end print:hidden">
                                <button onClick={() => handleAddNewTask(dIdx)} disabled={addingTaskIndex === dIdx} className="px-3 py-1.5 bg-white text-slate-600 border border-slate-200 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-violet-50 hover:text-violet-700 hover:border-violet-200 transition-all flex items-center gap-1.5 disabled:opacity-50">
                                    {addingTaskIndex === dIdx ? <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-500" /> : <Plus className="w-3.5 h-3.5" />}
                                    <span>Task</span>
                                </button>
                                <button onClick={() => handleAddDayResource(dIdx)} disabled={addingDayResourceIndex === dIdx} className="px-3 py-1.5 bg-white text-slate-600 border border-slate-200 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-violet-50 hover:text-violet-700 hover:border-violet-200 transition-all flex items-center gap-1.5 disabled:opacity-50">
                                    {addingDayResourceIndex === dIdx ? <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-500" /> : <Globe className="w-3.5 h-3.5" />}
                                    <span>Resource</span>
                                </button>
                            </div>
                        </div>

                        {/* Tight 2-Column Body Grid */}
                        <div className="p-4 flex flex-col lg:flex-row gap-5">
                            {/* Left Column: Core Task + Step-by-Step */}
                            <div className="flex-1 flex flex-col gap-4">
                                <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 shadow-sm print:border-slate-200 print:shadow-none">
                                    <div className="flex items-center gap-1.5 mb-2">
                                        <div className="bg-blue-100 text-blue-600 p-1 rounded-md">
                                            <Target size={12} />
                                        </div>
                                        <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">Core Task</h5>
                                    </div>
                                    <div className="space-y-1">
                                        <AutoResizeTextarea
                                            value={day.activity}
                                            onChange={(e) => {
                                                const newDays = [...editableReadingCompanion.days];
                                                newDays[dIdx].activity = e.target.value;
                                                setEditableReadingCompanion({ ...editableReadingCompanion, days: newDays });
                                            }}
                                            className="w-full text-[13px] font-semibold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-400 outline-none transition-colors leading-snug placeholder:text-slate-300"
                                            minRows={1}
                                            placeholder="Core activity description (English)..."
                                        />
                                        <AutoResizeTextarea
                                            value={day.activity_cn}
                                            onChange={(e) => {
                                                const newDays = [...editableReadingCompanion.days];
                                                newDays[dIdx].activity_cn = e.target.value;
                                                setEditableReadingCompanion({ ...editableReadingCompanion, days: newDays });
                                            }}
                                            className="w-full text-[11px] text-slate-500 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-400 outline-none transition-colors leading-tight placeholder:text-slate-300 mt-1"
                                            minRows={1}
                                            placeholder="Core activity description (Chinese)..."
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                                        <div className="bg-emerald-100 text-emerald-600 p-1 rounded-md">
                                            <List size={12} />
                                        </div>
                                        <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">Step-by-Step Tasks</h5>
                                    </div>
                                    <div className="space-y-2">
                                        {day.tasks?.map((task, tIdx) => (
                                            <div key={tIdx} className="flex gap-2 items-start p-2 bg-slate-50/50 rounded-lg border border-slate-100/60 group hover:border-slate-300 transition-colors print:border-slate-200">
                                                <button
                                                    onClick={() => handleTaskChange(dIdx, tIdx, 'isCompleted', !task.isCompleted)}
                                                    className={`w-4 h-4 shrink-0 rounded border transition-all mt-0.5 flex items-center justify-center print:border-slate-400 ${task.isCompleted ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-300 hover:border-emerald-400'}`}
                                                >
                                                    {task.isCompleted && <Check className="w-2.5 h-2.5 text-white stroke-[3] print:text-black" />}
                                                </button>
                                                <div className="flex-1 flex flex-col">
                                                    <input
                                                        value={task.text}
                                                        onChange={(e) => handleTaskChange(dIdx, tIdx, 'text', e.target.value)}
                                                        className={`w-full text-xs font-medium bg-transparent border-b border-transparent hover:border-slate-300 focus:border-violet-400 outline-none pb-0.5 transition-colors leading-tight ${task.isCompleted ? 'text-slate-400 line-through' : 'text-slate-700'}`}
                                                    />
                                                    <input
                                                        value={task.text_cn}
                                                        onChange={(e) => handleTaskChange(dIdx, tIdx, 'text_cn', e.target.value)}
                                                        className={`w-full text-[10px] text-slate-500 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-violet-400 outline-none transition-colors leading-tight ${task.isCompleted ? 'text-slate-300' : 'text-slate-500'}`}
                                                    />
                                                </div>
                                                <button onClick={() => handleDeleteTask(dIdx, tIdx)} className="text-slate-300 hover:text-red-500 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                        {(!day.tasks || day.tasks.length === 0) && <p className="text-[10px] text-slate-400 text-center py-3 bg-slate-50/50 rounded-lg border border-dashed border-slate-200 print:hidden">No tasks defined.</p>}
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
                                    <div className="flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                                        <div className="bg-orange-100 text-orange-600 p-1 rounded-md">
                                            <Globe size={12} />
                                        </div>
                                        <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">Web Resources</h5>
                                    </div>
                                    <div className="space-y-2">
                                        {day.resources?.map((res, rIdx) => (
                                            <div key={rIdx} className="bg-slate-50/50 p-2.5 rounded-lg border border-slate-100/60 shadow-sm relative group hover:border-slate-300 transition-colors print:border-slate-200 print:shadow-none">
                                                <button onClick={() => handleDeleteDayResource(dIdx, rIdx)} className="absolute top-2 right-2 p-0.5 text-slate-300 hover:bg-red-50 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded print:hidden">
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                                <div className="flex items-center mb-1 pr-5">
                                                    <input
                                                        value={res.title}
                                                        onChange={(e) => handleDayResourceChange(dIdx, rIdx, 'title', e.target.value)}
                                                        className="flex-1 text-[11px] font-bold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-orange-400 outline-none transition-colors truncate"
                                                    />
                                                    <a href={res.url} target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:text-orange-600 transition-colors ml-1.5 shrink-0 print:hidden" title="Open Link">
                                                        <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                </div>
                                                <input
                                                    value={res.url}
                                                    onChange={(e) => handleDayResourceChange(dIdx, rIdx, 'url', e.target.value)}
                                                    className="w-full text-[9px] text-slate-400 truncate mb-1.5 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-orange-400 outline-none transition-colors font-mono"
                                                    placeholder="URL link..."
                                                />
                                                <AutoResizeTextarea
                                                    value={res.description}
                                                    onChange={(e) => handleDayResourceChange(dIdx, rIdx, 'description', e.target.value)}
                                                    className="w-full text-[10px] font-medium text-slate-600 leading-snug bg-white border border-slate-200/60 hover:border-slate-300 focus:border-orange-300 rounded md p-1.5 outline-none transition-colors"
                                                    minRows={1}
                                                />
                                            </div>
                                        ))}
                                        {(!day.resources || day.resources.length === 0) && (
                                            <button onClick={() => handleManualAddDayResource(dIdx)} className="w-full py-3 border border-dashed border-slate-200 rounded-lg text-slate-400 hover:text-orange-600 hover:bg-orange-50/50 hover:border-orange-300 transition-all flex items-center justify-center gap-1.5 bg-slate-50/50 print:hidden">
                                                <Globe className="w-3 h-3 opacity-70" />
                                                <span className="text-[9px] font-bold uppercase tracking-wider">Add Manual Resource</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            <button onClick={handleAddNewDay} disabled={isAddingDay} className="w-full py-4 border border-dashed border-slate-300 rounded-2xl text-slate-500 hover:text-indigo-600 hover:bg-slate-50 hover:border-indigo-300 transition-all font-bold text-sm flex items-center justify-center gap-2 no-print bg-white shadow-sm hover:shadow-md">
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

            {assignSuccess && (
                <div className="fixed bottom-6 right-6 bg-emerald-50 text-emerald-600 border border-emerald-200 px-6 py-3 rounded-xl shadow-lg z-50 flex items-center gap-2 animate-in slide-in-from-bottom">
                    <Check className="w-4 h-4" /> {assignSuccess}
                </div>
            )}
            {assignError && (
                <div className="fixed bottom-6 right-6 bg-red-50 text-red-600 border border-red-200 px-6 py-3 rounded-xl shadow-lg z-50 flex items-center gap-2 animate-in slide-in-from-bottom">
                    <AlertCircle className="w-4 h-4" /> {assignError}
                </div>
            )}
        </div>
    );
};
