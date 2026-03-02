import React, { useState } from 'react';
import { ReadingCompanionContent, ReadingTask, WebResource, StructuredLessonPlan, CEFRLevel } from '../../types';
import { generateReadingTask, generateWebResource, generateNewCompanionDay, generateTrivia } from '../../services/geminiService';
import { Check, Trash2, Plus, X, ExternalLink, Loader2, Globe, Lightbulb, RefreshCw } from 'lucide-react';

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

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <h3 className="text-xl font-bold text-slate-800">7-Day Post-Class Review Plan</h3>
                <div className="flex gap-2 no-print">
                </div>
            </div>

            <div className="space-y-12">
                {editableReadingCompanion.days.map((day, dIdx) => (
                    <div key={dIdx} className="bg-white border rounded-2xl overflow-hidden shadow-sm flex flex-col md:flex-row min-h-[400px] border-slate-200">
                        <div className="w-full md:w-64 bg-orange-50/50 p-6 border-b md:border-b-0 md:border-r border-slate-100 flex flex-col">
                            <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center text-orange-500 font-bold text-xl border border-orange-100 shadow-sm mb-6">
                                {day.day}
                            </div>
                            <div className="flex-1">
                                <input
                                    value={day.focus}
                                    onChange={(e) => {
                                        const newDays = [...editableReadingCompanion.days];
                                        newDays[dIdx].focus = e.target.value;
                                        setEditableReadingCompanion({ ...editableReadingCompanion, days: newDays });
                                    }}
                                    className="text-lg font-bold text-orange-900 bg-transparent border-b border-transparent hover:border-orange-200 focus:border-orange-400 outline-none w-full mb-2 pb-1 transition-colors"
                                    placeholder="Day Focus"
                                />
                                <input
                                    value={day.focus_cn}
                                    onChange={(e) => {
                                        const newDays = [...editableReadingCompanion.days];
                                        newDays[dIdx].focus_cn = e.target.value;
                                        setEditableReadingCompanion({ ...editableReadingCompanion, days: newDays });
                                    }}
                                    className="text-xs font-semibold text-orange-600 italic bg-transparent border-b border-transparent hover:border-orange-200 focus:border-orange-400 outline-none w-full pb-1 transition-colors"
                                    placeholder="Chinese translation"
                                />
                            </div>
                            <div className="pt-6 border-t border-slate-200/50 space-y-3 no-print">
                                <button onClick={() => handleAddNewTask(dIdx)} disabled={addingTaskIndex === dIdx} className="w-full py-2 bg-orange-50 text-orange-600 border border-orange-200 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-orange-100 hover:text-orange-700 transition-all shadow-sm flex items-center justify-center gap-1 disabled:opacity-50">
                                    {addingTaskIndex === dIdx ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Smart Task
                                </button>
                                <button onClick={() => handleAddDayResource(dIdx)} disabled={addingDayResourceIndex === dIdx} className="w-full py-2 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-indigo-100 hover:text-indigo-700 transition-all shadow-sm flex items-center justify-center gap-1 disabled:opacity-50">
                                    {addingDayResourceIndex === dIdx ? <Loader2 className="w-3 h-3 animate-spin" /> : <Globe className="w-3 h-3" />} Resource
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 bg-white">
                            <div className="space-y-8">
                                <div>
                                    <h5 className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-3 flex items-center gap-1"><Lightbulb className="w-3 h-3" /> Core Task</h5>
                                    <div className="space-y-2">
                                        <AutoResizeTextarea
                                            value={day.activity}
                                            onChange={(e) => {
                                                const newDays = [...editableReadingCompanion.days];
                                                newDays[dIdx].activity = e.target.value;
                                                setEditableReadingCompanion({ ...editableReadingCompanion, days: newDays });
                                            }}
                                            className="w-full text-sm font-semibold text-slate-800 bg-slate-50/50 border border-transparent hover:border-slate-200 focus:border-orange-300 p-3 rounded-xl outline-none transition-colors leading-relaxed"
                                            minRows={2}
                                            placeholder="Core activity description..."
                                        />
                                        <AutoResizeTextarea
                                            value={day.activity_cn}
                                            onChange={(e) => {
                                                const newDays = [...editableReadingCompanion.days];
                                                newDays[dIdx].activity_cn = e.target.value;
                                                setEditableReadingCompanion({ ...editableReadingCompanion, days: newDays });
                                            }}
                                            className="w-full text-xs text-slate-500 italic bg-slate-50/30 border border-transparent hover:border-slate-200 focus:border-orange-300 p-3 rounded-xl outline-none transition-colors"
                                            minRows={1}
                                            placeholder="Chinese translation..."
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1"><Check className="w-3 h-3" /> Step-by-Step Guidance</h5>
                                    <div className="space-y-3">
                                        {day.tasks?.map((task, tIdx) => (
                                            <div key={tIdx} className="flex gap-3 items-start bg-white p-3 rounded-xl border border-slate-100 shadow-sm group hover:border-indigo-200 transition-colors">
                                                <button
                                                    onClick={() => handleTaskChange(dIdx, tIdx, 'isCompleted', !task.isCompleted)}
                                                    className={`w-5 h-5 rounded-md border shrink-0 transition-all mt-0.5 flex items-center justify-center ${task.isCompleted ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-slate-50 border-slate-300 hover:border-indigo-400'}`}
                                                >
                                                    {task.isCompleted && <Check className="w-3 h-3 stroke-[3]" />}
                                                </button>
                                                <div className="flex-1 space-y-1">
                                                    <input
                                                        value={task.text}
                                                        onChange={(e) => handleTaskChange(dIdx, tIdx, 'text', e.target.value)}
                                                        className={`w-full text-sm font-medium bg-transparent border-b border-transparent hover:border-slate-200 focus:border-indigo-400 outline-none pb-0.5 transition-colors ${task.isCompleted ? 'text-slate-400 line-through' : 'text-slate-700'}`}
                                                    />
                                                    <input
                                                        value={task.text_cn}
                                                        onChange={(e) => handleTaskChange(dIdx, tIdx, 'text_cn', e.target.value)}
                                                        className={`w-full text-[11px] italic bg-transparent border-b border-transparent hover:border-slate-200 focus:border-indigo-400 outline-none pb-0.5 transition-colors ${task.isCompleted ? 'text-slate-300' : 'text-slate-500'}`}
                                                    />
                                                </div>
                                                <button onClick={() => handleDeleteTask(dIdx, tIdx)} className="text-slate-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity no-print">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                        {(!day.tasks || day.tasks.length === 0) && <p className="text-xs text-slate-400 italic text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">No specific tasks defined. Click 'Smart Task' to generate.</p>}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-8">
                                {day.trivia && (
                                    <div className="bg-amber-50/40 p-5 rounded-2xl border border-amber-100 relative group transition-colors hover:border-amber-200">
                                        <div className="absolute top-4 right-4 no-print opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleRegenerateTrivia(dIdx)}
                                                disabled={isRegeneratingTriviaMap[dIdx]}
                                                className="p-1.5 text-amber-500 hover:text-amber-700 hover:bg-amber-100 rounded transition-colors disabled:opacity-50"
                                                title="Regenerate Trivia Fact"
                                            >
                                                {isRegeneratingTriviaMap[dIdx] ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                            </button>
                                        </div>
                                        <h5 className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                            <Lightbulb className="w-3.5 h-3.5" />
                                            Daily Trivia
                                        </h5>
                                        {isRegeneratingTriviaMap[dIdx] ? (
                                            <div className="space-y-3 py-2 animate-pulse">
                                                <div className="h-4 bg-amber-200/50 rounded w-full"></div>
                                                <div className="h-4 bg-amber-200/50 rounded w-3/4"></div>
                                                <div className="h-3 bg-amber-200/30 rounded w-1/2 mt-4"></div>
                                            </div>
                                        ) : (
                                            <div className="space-y-2 pr-6">
                                                <AutoResizeTextarea
                                                    value={day.trivia.en}
                                                    onChange={(e) => handleDayTriviaChange(dIdx, 'en', e.target.value)}
                                                    className="w-full text-sm font-semibold text-amber-900 leading-relaxed bg-transparent border-b border-transparent hover:border-amber-200 focus:border-amber-400 outline-none pb-0.5 transition-colors"
                                                    minRows={1}
                                                />
                                                <AutoResizeTextarea
                                                    value={day.trivia.cn}
                                                    onChange={(e) => handleDayTriviaChange(dIdx, 'cn', e.target.value)}
                                                    className="w-full text-xs text-amber-700 italic bg-transparent border-b border-transparent hover:border-amber-200 focus:border-amber-400 outline-none pb-0.5 transition-colors"
                                                    minRows={1}
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div>
                                    <h5 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-1"><Globe className="w-3 h-3" /> Web Resources</h5>
                                    <div className="space-y-3">
                                        {day.resources?.map((res, rIdx) => (
                                            <div key={rIdx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative group hover:border-indigo-300 transition-colors">
                                                <button onClick={() => handleDeleteDayResource(dIdx, rIdx)} className="absolute top-3 right-3 p-1.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity rounded no-print">
                                                    <X className="w-4 h-4" />
                                                </button>
                                                <div className="flex justify-between items-start mb-2 pr-8">
                                                    <input
                                                        value={res.title}
                                                        onChange={(e) => handleDayResourceChange(dIdx, rIdx, 'title', e.target.value)}
                                                        className="flex-1 text-sm font-bold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none pb-0.5 transition-colors"
                                                    />
                                                    <a href={res.url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-indigo-600 transition-colors ml-2 mt-0.5 no-print">
                                                        <ExternalLink className="w-3.5 h-3.5" />
                                                    </a>
                                                </div>
                                                <input
                                                    value={res.url}
                                                    onChange={(e) => handleDayResourceChange(dIdx, rIdx, 'url', e.target.value)}
                                                    className="w-full text-[10px] text-indigo-400 truncate mb-3 bg-transparent border-b border-transparent hover:border-indigo-200 focus:border-indigo-400 outline-none pb-0.5 transition-colors italic hover:text-indigo-600"
                                                    placeholder="URL link..."
                                                />
                                                <AutoResizeTextarea
                                                    value={res.description}
                                                    onChange={(e) => handleDayResourceChange(dIdx, rIdx, 'description', e.target.value)}
                                                    className="w-full text-[11px] text-slate-600 leading-relaxed bg-slate-50/50 border border-transparent hover:border-slate-200 focus:border-indigo-300 rounded-lg p-2 outline-none transition-colors"
                                                    minRows={2}
                                                />
                                            </div>
                                        ))}
                                        {(!day.resources || day.resources.length === 0) && (
                                            <button onClick={() => handleManualAddDayResource(dIdx)} className="w-full py-4 border border-dashed border-slate-300 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-slate-50 hover:border-indigo-300 transition-all flex items-center justify-center gap-2 no-print bg-white">
                                                <Globe className="w-4 h-4 opacity-50" />
                                                <span className="text-[11px] font-bold uppercase tracking-wider">Add Manual Resource</span>
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
        </div>
    );
};
