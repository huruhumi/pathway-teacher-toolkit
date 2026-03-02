import React, { useState } from 'react';
import { StructuredLessonPlan, CEFRLevel, LessonStage } from '../../types';
import { Loader2, Plus, Trash2, ExternalLink, GripVertical, Info, Target, List, AlertCircle, BookOpen, Layers } from 'lucide-react';
import { generateSingleObjective, generateSingleMaterial, generateSingleVocabItem, generateSingleAnticipatedProblem, generateSingleStage, generateSingleGrammarPoint } from '../../services/geminiService';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

// We need a shared AutoResizeTextarea to avoid duplicating it everywhere.
// Since it's currently inside OutputDisplay, we should probably extract it too, but for now we'll put a copy here or extract it later.
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

    return (
        <textarea
            ref={textareaRef}
            rows={minRows}
            className={`resize-none overflow-hidden ${className || ''}`}
            {...props}
        />
    );
};


interface LessonPlanTabProps {
    editablePlan: StructuredLessonPlan;
    setEditablePlan: (plan: StructuredLessonPlan) => void;
}

export const LessonPlanTab: React.FC<LessonPlanTabProps> = ({
    editablePlan,
    setEditablePlan,
}) => {
    // Local loading states
    const [isGeneratingObjective, setIsGeneratingObjective] = useState(false);
    const [isGeneratingMaterial, setIsGeneratingMaterial] = useState(false);
    const [isGeneratingVocab, setIsGeneratingVocab] = useState(false);
    const [isGeneratingSingleGrammar, setIsGeneratingSingleGrammar] = useState(false);
    const [isGeneratingProblem, setIsGeneratingProblem] = useState(false);
    const [isGeneratingStage, setIsGeneratingStage] = useState(false);

    // --- Handlers ---
    const handlePlanInfoChange = (section: keyof StructuredLessonPlan, field: string, value: any) => {
        setEditablePlan({
            ...editablePlan,
            [section]: {
                ...(editablePlan[section as keyof typeof editablePlan] as any),
                [field]: value
            }
        });
    };

    const handleArrayChange = (field: 'objectives' | 'materials' | 'grammarSentences', index: number, value: string) => {
        const newArray = [...editablePlan.lessonDetails[field]];
        newArray[index] = value;
        setEditablePlan({ ...editablePlan, lessonDetails: { ...editablePlan.lessonDetails, [field]: newArray } });
    };

    const deleteArrayItem = (field: 'objectives' | 'materials' | 'grammarSentences', index: number) => {
        const newArray = [...editablePlan.lessonDetails[field]];
        newArray.splice(index, 1);
        setEditablePlan({ ...editablePlan, lessonDetails: { ...editablePlan.lessonDetails, [field]: newArray } });
    };

    const moveArrayItem = (field: 'objectives' | 'materials' | 'grammarSentences', index: number, direction: 'up' | 'down') => {
        const newArray = [...editablePlan.lessonDetails[field]];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= newArray.length) return;
        [newArray[index], newArray[targetIndex]] = [newArray[targetIndex], newArray[index]];
        setEditablePlan({ ...editablePlan, lessonDetails: { ...editablePlan.lessonDetails, [field]: newArray } });
    };

    const handleVocabChange = (index: number, field: 'word' | 'definition', value: string) => {
        const newVocab = [...editablePlan.lessonDetails.targetVocab];
        newVocab[index] = { ...newVocab[index], [field]: value };
        setEditablePlan({ ...editablePlan, lessonDetails: { ...editablePlan.lessonDetails, targetVocab: newVocab } });
    };

    const deleteVocabItem = (index: number) => {
        const newVocab = [...editablePlan.lessonDetails.targetVocab];
        newVocab.splice(index, 1);
        setEditablePlan({ ...editablePlan, lessonDetails: { ...editablePlan.lessonDetails, targetVocab: newVocab } });
    };

    const moveVocabItem = (index: number, direction: 'up' | 'down') => {
        const newVocab = [...editablePlan.lessonDetails.targetVocab];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= newVocab.length) return;
        [newVocab[index], newVocab[targetIndex]] = [newVocab[targetIndex], newVocab[index]];
        setEditablePlan({ ...editablePlan, lessonDetails: { ...editablePlan.lessonDetails, targetVocab: newVocab } });
    };

    const handleProblemSolutionChange = (index: number, field: 'problem' | 'solution', value: string) => {
        const newProblems = [...editablePlan.lessonDetails.anticipatedProblems];
        newProblems[index] = { ...newProblems[index], [field]: value };
        setEditablePlan({ ...editablePlan, lessonDetails: { ...editablePlan.lessonDetails, anticipatedProblems: newProblems } });
    };

    const deleteProblemItem = (index: number) => {
        const newProblems = [...editablePlan.lessonDetails.anticipatedProblems];
        newProblems.splice(index, 1);
        setEditablePlan({ ...editablePlan, lessonDetails: { ...editablePlan.lessonDetails, anticipatedProblems: newProblems } });
    };

    const moveProblemItem = (index: number, direction: 'up' | 'down') => {
        const newProblems = [...editablePlan.lessonDetails.anticipatedProblems];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= newProblems.length) return;
        [newProblems[index], newProblems[targetIndex]] = [newProblems[targetIndex], newProblems[index]];
        setEditablePlan({ ...editablePlan, lessonDetails: { ...editablePlan.lessonDetails, anticipatedProblems: newProblems } });
    };

    const handleStageChange = (index: number, field: keyof LessonStage, value: string) => {
        const newStages = [...editablePlan.stages];
        newStages[index] = { ...newStages[index], [field]: value };
        setEditablePlan({ ...editablePlan, stages: newStages });
    };

    const handleDragEnd = (result: DropResult) => {
        if (!result.destination) return;

        const { source, destination, type } = result;
        if (source.index === destination.index) return;

        if (type === 'objectives' || type === 'materials' || type === 'grammarSentences') {
            const newArray = Array.from(editablePlan.lessonDetails[type]);
            const [removed] = newArray.splice(source.index, 1);
            newArray.splice(destination.index, 0, removed);
            setEditablePlan({ ...editablePlan, lessonDetails: { ...editablePlan.lessonDetails, [type]: newArray } });
        } else if (type === 'targetVocab') {
            const newVocab = Array.from(editablePlan.lessonDetails.targetVocab);
            const [removed] = newVocab.splice(source.index, 1);
            newVocab.splice(destination.index, 0, removed);
            setEditablePlan({ ...editablePlan, lessonDetails: { ...editablePlan.lessonDetails, targetVocab: newVocab } });
        } else if (type === 'anticipatedProblems') {
            const newProblems = Array.from(editablePlan.lessonDetails.anticipatedProblems);
            const [removed] = newProblems.splice(source.index, 1);
            newProblems.splice(destination.index, 0, removed);
            setEditablePlan({ ...editablePlan, lessonDetails: { ...editablePlan.lessonDetails, anticipatedProblems: newProblems } });
        } else if (type === 'stages') {
            const newStages = Array.from(editablePlan.stages);
            const [removed] = newStages.splice(source.index, 1);
            newStages.splice(destination.index, 0, removed);
            setEditablePlan({ ...editablePlan, stages: newStages });
        }
    };

    // --- Generation Functions ---
    const addObjectiveEntry = async () => {
        if (isGeneratingObjective) return;
        setIsGeneratingObjective(true);
        try {
            const newObj = await generateSingleObjective(
                editablePlan.classInformation.level as CEFRLevel,
                editablePlan.classInformation.topic,
                editablePlan.lessonDetails.objectives
            );
            if (newObj) {
                setEditablePlan({ ...editablePlan, lessonDetails: { ...editablePlan.lessonDetails, objectives: [...editablePlan.lessonDetails.objectives, newObj] } });
            }
        } catch (e) {
            console.error(e);
            setEditablePlan({ ...editablePlan, lessonDetails: { ...editablePlan.lessonDetails, objectives: [...editablePlan.lessonDetails.objectives, "New Learning Objective"] } });
        } finally {
            setIsGeneratingObjective(false);
        }
    };

    const addMaterialEntry = async () => {
        if (isGeneratingMaterial) return;
        setIsGeneratingMaterial(true);
        try {
            const newMat = await generateSingleMaterial(
                editablePlan.classInformation.level as CEFRLevel,
                editablePlan.classInformation.topic,
                editablePlan.lessonDetails.materials
            );
            if (newMat) {
                setEditablePlan({ ...editablePlan, lessonDetails: { ...editablePlan.lessonDetails, materials: [...editablePlan.lessonDetails.materials, newMat] } });
            }
        } catch (e) {
            console.error(e);
            setEditablePlan({ ...editablePlan, lessonDetails: { ...editablePlan.lessonDetails, materials: [...editablePlan.lessonDetails.materials, "New Material"] } });
        } finally {
            setIsGeneratingMaterial(false);
        }
    };

    const addVocabEntry = async () => {
        if (isGeneratingVocab) return;
        setIsGeneratingVocab(true);
        try {
            const existing = editablePlan.lessonDetails.targetVocab;
            const newV = await generateSingleVocabItem(
                editablePlan.classInformation.level as CEFRLevel,
                editablePlan.classInformation.topic,
                existing
            );
            if (newV) {
                setEditablePlan({ ...editablePlan, lessonDetails: { ...editablePlan.lessonDetails, targetVocab: [...editablePlan.lessonDetails.targetVocab, newV] } });
            }
        } catch (e) {
            console.error(e);
            setEditablePlan({ ...editablePlan, lessonDetails: { ...editablePlan.lessonDetails, targetVocab: [...editablePlan.lessonDetails.targetVocab, { word: "New Word", definition: "New Definition" }] } });
        } finally {
            setIsGeneratingVocab(false);
        }
    };

    const addSentenceEntry = async () => {
        if (isGeneratingSingleGrammar) return;
        setIsGeneratingSingleGrammar(true);
        try {
            const newSentence = await generateSingleGrammarPoint(
                editablePlan.classInformation.level as CEFRLevel,
                editablePlan.classInformation.topic,
                editablePlan.lessonDetails.grammarSentences
            );
            if (newSentence) {
                const newArray = [...editablePlan.lessonDetails.grammarSentences, newSentence];
                setEditablePlan({ ...editablePlan, lessonDetails: { ...editablePlan.lessonDetails, grammarSentences: newArray } });
            }
        } catch (e) {
            console.error(e);
            setEditablePlan({ ...editablePlan, lessonDetails: { ...editablePlan.lessonDetails, grammarSentences: [...editablePlan.lessonDetails.grammarSentences, "New target sentence."] } });
        } finally {
            setIsGeneratingSingleGrammar(false);
        }
    };

    const addProblemEntry = async () => {
        if (isGeneratingProblem) return;
        setIsGeneratingProblem(true);
        try {
            const existing = editablePlan.lessonDetails.anticipatedProblems;
            const newP = await generateSingleAnticipatedProblem(
                editablePlan.classInformation.level as CEFRLevel,
                editablePlan.classInformation.topic,
                existing
            );
            if (newP) {
                setEditablePlan({ ...editablePlan, lessonDetails: { ...editablePlan.lessonDetails, anticipatedProblems: [...editablePlan.lessonDetails.anticipatedProblems, newP] } });
            }
        } catch (e) {
            console.error(e);
            setEditablePlan({ ...editablePlan, lessonDetails: { ...editablePlan.lessonDetails, anticipatedProblems: [...editablePlan.lessonDetails.anticipatedProblems, { problem: "Anticipated Problem", solution: "Suggested Solution" }] } });
        } finally {
            setIsGeneratingProblem(false);
        }
    };

    const addStageEntry = async (index?: number) => {
        if (isGeneratingStage) return;
        setIsGeneratingStage(true);
        try {
            const newStage = await generateSingleStage(
                editablePlan.classInformation.level as CEFRLevel,
                editablePlan.classInformation.topic,
                editablePlan.stages
            );
            const newStages = [...editablePlan.stages];
            if (typeof index === 'number') {
                newStages.splice(index + 1, 0, newStage);
            } else {
                newStages.push(newStage);
            }
            setEditablePlan({ ...editablePlan, stages: newStages });
        } catch (e) {
            console.error(e);
            const fallbackStage: LessonStage = {
                stage: "New Stage",
                stageAim: "Aim of the stage",
                timing: "5 mins",
                interaction: "T-Ss",
                teacherActivity: "1. Teacher introduces context...",
                studentActivity: "1. Students respond..."
            };
            const newStages = [...editablePlan.stages];
            if (typeof index === 'number') {
                newStages.splice(index + 1, 0, fallbackStage);
            } else {
                newStages.push(fallbackStage);
            }
            setEditablePlan({ ...editablePlan, stages: newStages });
        } finally {
            setIsGeneratingStage(false);
        }
    };

    const deleteStageEntry = (index: number) => {
        const newStages = [...editablePlan.stages];
        newStages.splice(index, 1);
        setEditablePlan({ ...editablePlan, stages: newStages });
    };

    const moveStageEntry = (index: number, direction: 'up' | 'down') => {
        const newStages = [...editablePlan.stages];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= newStages.length) return;
        [newStages[index], newStages[targetIndex]] = [newStages[targetIndex], newStages[index]];
        setEditablePlan({ ...editablePlan, stages: newStages });
    };

    return (
        <DragDropContext onDragEnd={handleDragEnd}>
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h3 className="text-xl font-bold text-slate-800">Detailed Lesson Plan</h3>
                </div>

                <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden mb-6">
                    <div className="bg-slate-50 p-4 border-b border-slate-100 grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {['level', 'date', 'topic', 'students'].map((f) => (
                            <div key={f}>
                                <label className="block text-slate-400 text-[10px] font-bold mb-1 uppercase tracking-widest">{f}</label>
                                <input
                                    value={editablePlan.classInformation[f as keyof typeof editablePlan.classInformation]}
                                    onChange={(e) => handlePlanInfoChange('classInformation', f, e.target.value)}
                                    className="w-full font-bold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none pb-1 transition-colors"
                                />
                            </div>
                        ))}
                    </div>

                    <div className="p-6 space-y-6">
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
                            <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                                <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                    <Target className="text-emerald-500 w-4 h-4" />
                                    Lesson Objectives
                                </h4>
                                <button onClick={addObjectiveEntry} disabled={isGeneratingObjective} className="text-emerald-600 hover:text-emerald-800 flex items-center gap-1 text-xs font-bold uppercase tracking-widest no-print transition-colors">
                                    {isGeneratingObjective ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Add
                                </button>
                            </div>
                            <Droppable droppableId="objectives-list" type="objectives">
                                {(provided) => (
                                    <div className="p-4 space-y-3" ref={provided.innerRef} {...provided.droppableProps}>
                                        {editablePlan.lessonDetails.objectives.map((obj, i) => (
                                            <Draggable key={`objective-${i}`} draggableId={`objective-${i}`} index={i}>
                                                {(provided, snapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        className={`flex gap-2 group items-start ${snapshot.isDragging ? 'opacity-90 shadow-lg bg-white rounded-lg p-2 border border-emerald-200' : ''}`}
                                                    >
                                                        <div
                                                            {...provided.dragHandleProps}
                                                            className="mt-2 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing px-1 transition-colors"
                                                        >
                                                            <GripVertical size={16} />
                                                        </div>
                                                        <div className="flex-1">
                                                            <AutoResizeTextarea
                                                                value={obj}
                                                                onChange={(e) => handleArrayChange('objectives', i, e.target.value)}
                                                                className="w-full text-sm text-slate-700 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-emerald-500 outline-none py-1 transition-colors"
                                                                minRows={1}
                                                                placeholder="Enter objective..."
                                                            />
                                                        </div>
                                                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity no-print">
                                                            <button onClick={() => deleteArrayItem('objectives', i)} className="p-1.5 text-slate-400 hover:text-red-500 rounded mt-1 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                                        </div>
                                                    </div>
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </div>

                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
                            <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                                <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                    <List className="text-emerald-500 w-4 h-4" />
                                    Materials and Equipment
                                </h4>
                                <button onClick={addMaterialEntry} disabled={isGeneratingMaterial} className="text-emerald-600 hover:text-emerald-800 flex items-center gap-1 text-xs font-bold uppercase tracking-widest no-print transition-colors">
                                    {isGeneratingMaterial ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Add
                                </button>
                            </div>
                            <Droppable droppableId="materials-list" type="materials">
                                {(provided) => (
                                    <div className="p-4 space-y-3" ref={provided.innerRef} {...provided.droppableProps}>
                                        {editablePlan.lessonDetails.materials.map((mat, i) => (
                                            <Draggable key={`material-${i}`} draggableId={`material-${i}`} index={i}>
                                                {(provided, snapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        className={`flex gap-2 group items-start ${snapshot.isDragging ? 'opacity-90 shadow-lg bg-white rounded-lg p-2 border border-emerald-200' : ''}`}
                                                    >
                                                        <div
                                                            {...provided.dragHandleProps}
                                                            className="mt-2 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing px-1 transition-colors"
                                                        >
                                                            <GripVertical size={16} />
                                                        </div>
                                                        <div className="flex-1">
                                                            <AutoResizeTextarea
                                                                value={mat}
                                                                onChange={(e) => handleArrayChange('materials', i, e.target.value)}
                                                                className="w-full text-sm text-slate-700 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-emerald-500 outline-none py-1 transition-colors"
                                                                minRows={1}
                                                                placeholder="Enter material..."
                                                            />
                                                        </div>
                                                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity no-print">
                                                            <button onClick={() => deleteArrayItem('materials', i)} className="p-1.5 text-slate-400 hover:text-red-500 rounded mt-1 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                                        </div>
                                                    </div>
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </div>

                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
                            <div className="grid grid-cols-[1fr_1fr_120px] bg-slate-50 border-b border-slate-100">
                                <div className="px-4 py-3 border-r border-slate-100 flex justify-between items-center">
                                    <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                        <AlertCircle className="text-amber-500 w-4 h-4" />
                                        Anticipated Problems
                                    </h4>
                                </div>
                                <div className="px-4 py-3 border-r border-slate-100 flex items-center">
                                    <h4 className="font-bold text-slate-800 text-sm">Suggested Solutions</h4>
                                </div>
                                <div className="px-4 py-3 flex items-center justify-center no-print">
                                    <button onClick={addProblemEntry} disabled={isGeneratingProblem} className="text-amber-600 hover:text-amber-800 flex items-center gap-1 text-[10px] font-black uppercase tracking-wider transition-colors">
                                        {isGeneratingProblem ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Add Pair
                                    </button>
                                </div>
                            </div>
                            <Droppable droppableId="problems-list" type="anticipatedProblems">
                                {(provided) => (
                                    <div className="divide-y divide-slate-100" ref={provided.innerRef} {...provided.droppableProps}>
                                        {editablePlan.lessonDetails.anticipatedProblems.map((p, i) => (
                                            <Draggable key={`problem-${i}`} draggableId={`problem-${i}`} index={i}>
                                                {(provided, snapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        className={`grid grid-cols-[40px_1fr_1fr_60px] group bg-white hover:bg-slate-50/50 transition-colors ${snapshot.isDragging ? 'opacity-90 shadow-xl border border-amber-200 z-50 relative' : ''}`}
                                                    >
                                                        <div className="p-4 flex items-start justify-center border-r border-slate-100">
                                                            <div
                                                                {...provided.dragHandleProps}
                                                                className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing px-1 mt-1 transition-colors"
                                                            >
                                                                <GripVertical size={16} />
                                                            </div>
                                                        </div>
                                                        <div className="p-4 border-r border-slate-100 bg-amber-50/10">
                                                            <AutoResizeTextarea
                                                                value={p.problem}
                                                                onChange={(e) => handleProblemSolutionChange(i, 'problem', e.target.value)}
                                                                className="w-full text-sm text-slate-700 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-amber-400 outline-none pb-1 transition-colors"
                                                                minRows={2}
                                                                placeholder="Describe the problem..."
                                                            />
                                                        </div>
                                                        <div className="p-4 border-r border-slate-100">
                                                            <AutoResizeTextarea
                                                                value={p.solution}
                                                                onChange={(e) => handleProblemSolutionChange(i, 'solution', e.target.value)}
                                                                className="w-full text-sm text-slate-700 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-amber-400 outline-none pb-1 transition-colors"
                                                                minRows={2}
                                                                placeholder="Describe the solution..."
                                                            />
                                                        </div>
                                                        <div className="flex flex-col gap-1 p-4 items-center justify-start opacity-0 group-hover:opacity-100 transition-opacity no-print">
                                                            <button onClick={() => deleteProblemItem(i)} className="p-1.5 text-slate-400 hover:text-red-500 rounded transition-colors mt-1"><Trash2 className="w-4 h-4" /></button>
                                                        </div>
                                                    </div>
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                                <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                                    <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                        <BookOpen className="text-teal-500 w-4 h-4" />
                                        Target Vocabulary
                                    </h4>
                                    <button onClick={addVocabEntry} disabled={isGeneratingVocab} className="text-teal-600 hover:text-teal-800 flex items-center gap-1 text-xs font-bold uppercase tracking-widest no-print transition-colors">
                                        {isGeneratingVocab ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Add
                                    </button>
                                </div>
                                <Droppable droppableId="vocab-list" type="targetVocab">
                                    {(provided) => (
                                        <div className="grid grid-cols-1 gap-0 divide-y divide-slate-100 flex-1" ref={provided.innerRef} {...provided.droppableProps}>
                                            {editablePlan.lessonDetails.targetVocab.map((v, i) => (
                                                <Draggable key={`vocab-${i}`} draggableId={`vocab-${i}`} index={i}>
                                                    {(provided, snapshot) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            className={`bg-white p-3 relative group flex gap-2 hover:bg-slate-50/50 transition-colors ${snapshot.isDragging ? 'opacity-90 shadow-xl border border-teal-200 z-50 rounded-lg' : ''}`}
                                                        >
                                                            <div
                                                                {...provided.dragHandleProps}
                                                                className="mt-2 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing px-1 transition-colors"
                                                            >
                                                                <GripVertical size={16} />
                                                            </div>
                                                            <div className="flex-1 space-y-2">
                                                                <input
                                                                    value={v.word}
                                                                    onChange={(e) => handleVocabChange(i, 'word', e.target.value)}
                                                                    placeholder="Word/Phrase"
                                                                    className="font-bold text-slate-800 bg-transparent w-full border-b border-transparent hover:border-slate-200 focus:border-teal-400 outline-none pb-1 transition-colors"
                                                                />
                                                                <AutoResizeTextarea
                                                                    value={v.definition}
                                                                    onChange={(e) => handleVocabChange(i, 'definition', e.target.value)}
                                                                    placeholder="Definition/Example"
                                                                    className="w-full text-sm text-slate-500 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-teal-400 outline-none pb-1 transition-colors"
                                                                    minRows={1}
                                                                />
                                                            </div>
                                                            <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity no-print">
                                                                <button onClick={() => deleteVocabItem(i)} className="p-1.5 text-slate-400 hover:text-red-500 rounded mt-1 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </Draggable>
                                            ))}
                                            {provided.placeholder}
                                        </div>
                                    )}
                                </Droppable>
                            </div>

                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                                <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                                    <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                        <Layers className="text-indigo-500 w-4 h-4" />
                                        Grammar & Sentences
                                    </h4>
                                    <button onClick={addSentenceEntry} disabled={isGeneratingSingleGrammar} className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 text-xs font-bold uppercase tracking-widest no-print transition-colors">
                                        {isGeneratingSingleGrammar ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Add
                                    </button>
                                </div>
                                <Droppable droppableId="sentences-list" type="grammarSentences">
                                    {(provided) => (
                                        <div className="divide-y divide-slate-100 flex-1" ref={provided.innerRef} {...provided.droppableProps}>
                                            {editablePlan.lessonDetails.grammarSentences.map((s, i) => (
                                                <Draggable key={`sentence-${i}`} draggableId={`sentence-${i}`} index={i}>
                                                    {(provided, snapshot) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            className={`flex gap-2 items-start bg-white p-4 group hover:bg-slate-50/50 transition-colors ${snapshot.isDragging ? 'opacity-90 shadow-xl border border-indigo-200 z-50 rounded-lg' : ''}`}
                                                        >
                                                            <div
                                                                {...provided.dragHandleProps}
                                                                className="mt-1 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing px-1 transition-colors"
                                                            >
                                                                <GripVertical size={16} />
                                                            </div>
                                                            <AutoResizeTextarea
                                                                value={s}
                                                                onChange={(e) => handleArrayChange('grammarSentences', i, e.target.value)}
                                                                placeholder="Grammar point or target sentence..."
                                                                className="w-full bg-transparent border-b border-transparent hover:border-slate-200 focus:border-indigo-400 outline-none text-sm text-slate-700 pb-1 transition-colors"
                                                                minRows={1}
                                                            />
                                                            <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity no-print">
                                                                <button onClick={() => deleteArrayItem('grammarSentences', i)} className="p-1.5 text-slate-400 hover:text-red-500 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </Draggable>
                                            ))}
                                            {provided.placeholder}
                                        </div>
                                    )}
                                </Droppable>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-8">
                            {/* The Phonics focus section inside Plan tab */}
                            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center sticky top-0 z-10">
                                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <Layers className="w-5 h-5 text-indigo-500" />
                                    Teaching Stages & Flow
                                </h3>
                                <button onClick={() => addStageEntry()} disabled={isGeneratingStage} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-all no-print">
                                    {isGeneratingStage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add Stage
                                </button>
                            </div>
                            <Droppable droppableId="stages-list" type="stages">
                                {(provided) => (
                                    <div className="p-6 space-y-4" ref={provided.innerRef} {...provided.droppableProps}>
                                        {editablePlan.stages.map((stage, i) => (
                                            <Draggable key={`stage-${i}`} draggableId={`stage-${i}`} index={i}>
                                                {(provided, snapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        className={`group relative bg-white border border-slate-200 rounded-xl p-5 transition-all ${snapshot.isDragging ? 'shadow-2xl border-indigo-400 opacity-95 scale-[1.02] z-50' : 'hover:border-slate-300 hover:shadow-md'}`}
                                                    >
                                                        <div className="absolute left-0 top-0 bottom-0 w-12 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-slate-50 border-r border-slate-100 rounded-l-xl no-print">
                                                            <div
                                                                {...provided.dragHandleProps}
                                                                className="p-2 text-slate-400 hover:text-indigo-600 cursor-grab active:cursor-grabbing"
                                                            >
                                                                <GripVertical size={20} />
                                                            </div>
                                                            <button
                                                                onClick={() => addStageEntry(i)}
                                                                className="p-2 text-slate-300 hover:text-indigo-500 mt-2"
                                                                title="Insert Below"
                                                            >
                                                                <Plus className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => deleteStageEntry(i)}
                                                                className="p-2 text-slate-300 hover:text-red-500 mt-2"
                                                                title="Delete Stage"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>

                                                        <div className="pl-10">
                                                            <div className="flex flex-wrap gap-3 mb-4 items-center">
                                                                <input
                                                                    value={stage.timing}
                                                                    onChange={(e) => handleStageChange(i, 'timing', e.target.value)}
                                                                    className="w-20 font-black text-indigo-600 bg-indigo-50/50 border border-indigo-100 rounded-lg px-3 py-1.5 text-center focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all text-sm"
                                                                    placeholder="e.g. 5m"
                                                                />
                                                                <input
                                                                    value={stage.stage}
                                                                    onChange={(e) => handleStageChange(i, 'stage', e.target.value)}
                                                                    className="flex-1 min-w-[150px] font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all text-sm uppercase tracking-wider"
                                                                    placeholder="Stage Name (e.g. WARM UP)"
                                                                />
                                                            </div>

                                                            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                <div>
                                                                    <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2 block">Teacher Activity (Script)</label>
                                                                    <AutoResizeTextarea
                                                                        value={stage.teacherActivity}
                                                                        onChange={(e) => handleStageChange(i, 'teacherActivity', e.target.value)}
                                                                        className="w-full text-sm text-indigo-900 bg-indigo-50/50 border-none focus:bg-indigo-50 rounded-xl p-3 outline-none transition-colors leading-relaxed min-h-[60px]"
                                                                        placeholder="What the teacher should say/do..."
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2 block">Student Activity</label>
                                                                    <AutoResizeTextarea
                                                                        value={stage.studentActivity}
                                                                        onChange={(e) => handleStageChange(i, 'studentActivity', e.target.value)}
                                                                        className="w-full text-sm text-emerald-900 bg-emerald-50/50 border-none focus:bg-emerald-50 rounded-xl p-3 outline-none transition-colors leading-relaxed min-h-[60px]"
                                                                        placeholder="What the students should do..."
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </div>
                    </div>
                </div>
            </div>
        </DragDropContext>
    );
};
