import React, { useState } from 'react';
import { ReadingCompanionContent, ReadingTask, WebResource, StructuredLessonPlan, CEFRLevel } from '../../types';
import { generateReadingTask, generateWebResource, generateNewCompanionDay, generateTrivia } from '../../services/geminiService';
import { Check, Trash2, Plus, X, ExternalLink, Download, Loader2, Globe, Lightbulb, RefreshCw } from 'lucide-react';

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
    openViewer: (tabId: string, subTabId?: string) => void;
    handleDownloadCompanionMd: () => void;
}

export const CompanionTab: React.FC<CompanionTabProps> = ({
    editableReadingCompanion,
    setEditableReadingCompanion,
    editablePlan,
    openViewer,
    handleDownloadCompanionMd
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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h3 className="text-xl font-bold text-slate-800">7-Day Post-Class Review Plan</h3>
                <div className="flex gap-2 no-print">
                    <button onClick={() => openViewer('companion')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-sm font-bold shadow-sm">
                        <ExternalLink className="w-4 h-4" /> Interactive View
                    </button>
                    <button onClick={handleDownloadCompanionMd} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all text-sm font-bold shadow-sm">
                        <Download className="w-4 h-4" /> Download MD
                    </button>
                </div>
            </div>

            <div className="space-y-12">
                {editableReadingCompanion.days.map((day, dIdx) => (
                    <div key={dIdx} className="bg-white border-2 border-orange-100 rounded-[2.5rem] overflow-hidden shadow-sm flex flex-col md:flex-row min-h-[400px]">
                        <div className="w-full md:w-64 bg-orange-50/50 p-8 border-b md:border-b-0 md:border-r border-orange-100 flex flex-col">
                            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-orange-500 font-black text-2xl border-2 border-orange-100 shadow-sm mb-6">
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
                                    className="text-xl font-black text-orange-900 bg-transparent border-none outline-none focus:ring-1 focus:ring-orange-200 rounded w-full mb-1"
                                />
                                <input
                                    value={day.focus_cn}
                                    onChange={(e) => {
                                        const newDays = [...editableReadingCompanion.days];
                                        newDays[dIdx].focus_cn = e.target.value;
                                        setEditableReadingCompanion({ ...editableReadingCompanion, days: newDays });
                                    }}
                                    className="text-xs font-bold text-orange-600 italic bg-transparent border-none outline-none focus:ring-1 focus:ring-orange-200 rounded w-full"
                                />
                            </div>
                            <div className="pt-6 border-t border-orange-100/50 space-y-3 no-print">
                                <button onClick={() => handleAddNewTask(dIdx)} disabled={addingTaskIndex === dIdx} className="w-full py-2 bg-orange-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-600 transition-all shadow-sm disabled:opacity-50">
                                    {addingTaskIndex === dIdx ? 'Generating...' : 'Add Smart Task'}
                                </button>
                                <button onClick={() => handleAddDayResource(dIdx)} disabled={addingDayResourceIndex === dIdx} className="w-full py-2 bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-sm disabled:opacity-50">
                                    {addingDayResourceIndex === dIdx ? 'Finding...' : 'Add Resource'}
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 p-8 grid grid-cols-1 lg:grid-cols-2 gap-12 bg-white">
                            <div className="space-y-8">
                                <div>
                                    <h5 className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-4">Core Task</h5>
                                    <div className="space-y-1">
                                        <AutoResizeTextarea
                                            value={day.activity}
                                            onChange={(e) => {
                                                const newDays = [...editableReadingCompanion.days];
                                                newDays[dIdx].activity = e.target.value;
                                                setEditableReadingCompanion({ ...editableReadingCompanion, days: newDays });
                                            }}
                                            className="w-full text-base font-bold text-slate-800 bg-transparent border-none outline-none focus:bg-orange-50/30 p-2 rounded-xl"
                                            minRows={1}
                                        />
                                        <AutoResizeTextarea
                                            value={day.activity_cn}
                                            onChange={(e) => {
                                                const newDays = [...editableReadingCompanion.days];
                                                newDays[dIdx].activity_cn = e.target.value;
                                                setEditableReadingCompanion({ ...editableReadingCompanion, days: newDays });
                                            }}
                                            className="w-full text-xs text-slate-400 italic bg-transparent border-none outline-none focus:bg-orange-50/30 p-2 rounded-xl"
                                            minRows={1}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h5 className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-4">Step-by-Step Guidance</h5>
                                    <div className="space-y-3">
                                        {day.tasks?.map((task, tIdx) => (
                                            <div key={tIdx} className="flex gap-4 items-start bg-slate-50/50 p-4 rounded-2xl border border-slate-100 group">
                                                <button
                                                    onClick={() => handleTaskChange(dIdx, tIdx, 'isCompleted', !task.isCompleted)}
                                                    className={`w-5 h-5 rounded-md border-2 shrink-0 transition-all mt-1 ${task.isCompleted ? 'bg-orange-500 border-orange-500 text-white flex items-center justify-center' : 'bg-white border-orange-200 hover:border-orange-500'}`}
                                                >
                                                    {task.isCompleted && <Check className="w-3 h-3 stroke-[3]" />}
                                                </button>
                                                <div className="flex-1">
                                                    <input
                                                        value={task.text}
                                                        onChange={(e) => handleTaskChange(dIdx, tIdx, 'text', e.target.value)}
                                                        className={`w-full text-sm font-medium bg-transparent border-none outline-none ${task.isCompleted ? 'text-slate-400 line-through' : 'text-slate-700'}`}
                                                    />
                                                    <input
                                                        value={task.text_cn}
                                                        onChange={(e) => handleTaskChange(dIdx, tIdx, 'text_cn', e.target.value)}
                                                        className={`w-full text-xs italic bg-transparent border-none outline-none ${task.isCompleted ? 'text-slate-300' : 'text-slate-400'}`}
                                                    />
                                                </div>
                                                <button onClick={() => handleDeleteTask(dIdx, tIdx)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity no-print">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                        {(!day.tasks || day.tasks.length === 0) && <p className="text-xs text-slate-300 italic text-center py-4">No specific tasks defined. Click 'Add Smart Task' above.</p>}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-10">
                                {day.trivia && (
                                    <div className="bg-yellow-50/50 p-8 rounded-[2rem] border border-yellow-100 relative overflow-hidden group">
                                        <div className="absolute top-6 right-8 no-print">
                                            <button
                                                onClick={() => handleRegenerateTrivia(dIdx)}
                                                disabled={isRegeneratingTriviaMap[dIdx]}
                                                className="w-10 h-10 border-2 border-[#f59e0b] bg-white rounded-lg flex items-center justify-center text-[#f59e0b] hover:bg-orange-50 transition-all shadow-sm disabled:opacity-50"
                                                title="Regenerate Trivia Fact"
                                            >
                                                {isRegeneratingTriviaMap[dIdx] ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                                            </button>
                                        </div>
                                        <h5 className="text-[10px] font-black text-yellow-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <Lightbulb className="w-4 h-4" />
                                            Daily Trivia Fact
                                        </h5>
                                        {isRegeneratingTriviaMap[dIdx] ? (
                                            <div className="space-y-3 py-2 animate-pulse">
                                                <div className="h-4 bg-yellow-200/50 rounded w-full"></div>
                                                <div className="h-4 bg-yellow-200/50 rounded w-3/4"></div>
                                                <div className="h-3 bg-yellow-200/30 rounded w-1/2 mt-4"></div>
                                            </div>
                                        ) : (
                                            <>
                                                <AutoResizeTextarea
                                                    value={day.trivia.en}
                                                    onChange={(e) => handleDayTriviaChange(dIdx, 'en', e.target.value)}
                                                    className="w-full text-lg font-bold text-yellow-900 leading-relaxed bg-transparent border-none outline-none"
                                                    minRows={1}
                                                />
                                                <AutoResizeTextarea
                                                    value={day.trivia.cn}
                                                    onChange={(e) => handleDayTriviaChange(dIdx, 'cn', e.target.value)}
                                                    className="w-full text-sm text-yellow-700 italic mt-3 bg-transparent border-none outline-none"
                                                    minRows={1}
                                                />
                                            </>
                                        )}
                                    </div>
                                )}

                                <div className="space-y-4">
                                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Recommended Web Resources</h5>
                                    <div className="space-y-4">
                                        {day.resources?.map((res, rIdx) => (
                                            <div key={rIdx} className="bg-blue-50/30 p-6 rounded-[1.5rem] border border-blue-100 relative group">
                                                <button onClick={() => handleDeleteDayResource(dIdx, rIdx)} className="absolute top-2 right-2 p-1 text-blue-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all no-print">
                                                    <X className="w-3 h-3" />
                                                </button>
                                                <div className="flex justify-between items-start mb-2">
                                                    <input
                                                        value={res.title}
                                                        onChange={(e) => handleDayResourceChange(dIdx, rIdx, 'title', e.target.value)}
                                                        className="flex-1 text-sm font-bold text-blue-900 bg-transparent border-none outline-none focus:ring-1 focus:ring-blue-100 rounded"
                                                    />
                                                    <a href={res.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-600 transition-colors ml-2 no-print">
                                                        <ExternalLink className="w-3.5 h-3.5" />
                                                    </a>
                                                </div>
                                                <input
                                                    value={res.url}
                                                    onChange={(e) => handleDayResourceChange(dIdx, rIdx, 'url', e.target.value)}
                                                    className="w-full text-[10px] text-slate-400 truncate mb-2 bg-transparent border-none outline-none italic"
                                                    placeholder="https://..."
                                                />
                                                <AutoResizeTextarea
                                                    value={res.description}
                                                    onChange={(e) => handleDayResourceChange(dIdx, rIdx, 'description', e.target.value)}
                                                    className="w-full text-[11px] text-slate-500 leading-relaxed bg-transparent border-none outline-none focus:bg-blue-50 rounded"
                                                    minRows={1}
                                                />
                                            </div>
                                        ))}
                                        {(!day.resources || day.resources.length === 0) && (
                                            <button onClick={() => handleManualAddDayResource(dIdx)} className="w-full py-6 border-2 border-dashed border-blue-100 rounded-3xl text-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center gap-2 no-print">
                                                <Globe className="w-5 h-5 opacity-40" />
                                                <span className="text-xs font-bold">Add Manual Resource</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            <button onClick={handleAddNewDay} disabled={isAddingDay} className="w-full py-6 border-2 border-dashed border-orange-100 rounded-3xl text-orange-400 hover:bg-orange-50 transition-all font-bold text-sm flex items-center justify-center gap-2 no-print">
                {isAddingDay ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                {isAddingDay ? 'Planning Next Day...' : 'Extend Review Plan (Add Day)'}
            </button>
        </div>
    );
};
