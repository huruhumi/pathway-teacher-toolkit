import React, { useState } from 'react';
import { StructuredLessonPlan, CEFRLevel, LessonStage } from '../../types';
import { Loader2, Plus, ChevronUp, ChevronDown, Trash2, ExternalLink } from 'lucide-react';
import { generateSingleObjective, generateSingleMaterial, generateSingleVocabItem, generateSingleAnticipatedProblem, generateSingleStage, generateSingleGrammarPoint } from '../../services/geminiService';

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
    openViewer: (tabId: string, subTabId?: string) => void;
}

export const LessonPlanTab: React.FC<LessonPlanTabProps> = ({
    editablePlan,
    setEditablePlan,
    openViewer,
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
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h3 className="text-xl font-bold text-slate-800">Detailed Lesson Plan</h3>
                <div className="flex gap-2 no-print">
                    <button
                        onClick={() => openViewer('plan')}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm text-sm font-semibold"
                    >
                        <ExternalLink className="w-4 h-4" />
                        Open in Viewer
                    </button>
                </div>
            </div>

            <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
                <div className="bg-[#14b8a6] p-4 text-white grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {['level', 'date', 'topic', 'students'].map((f) => (
                        <div key={f}>
                            <label className="block text-teal-100 text-xs font-semibold mb-1 uppercase">{f}</label>
                            <input value={editablePlan.classInformation[f as keyof typeof editablePlan.classInformation]} onChange={(e) => handlePlanInfoChange('classInformation', f, e.target.value)} className="w-full bg-white/20 border-none text-white rounded px-2 py-1 focus:ring-1 focus:ring-white outline-none" />
                        </div>
                    ))}
                </div>

                <div className="p-6 space-y-6">
                    <div className="border border-indigo-200 rounded-lg overflow-hidden">
                        <div className="bg-indigo-50 px-4 py-2 border-b border-indigo-100 flex justify-between items-center">
                            <h4 className="font-bold text-indigo-900 text-sm">Lesson objectives:</h4>
                            <button onClick={addObjectiveEntry} disabled={isGeneratingObjective} className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 text-xs font-bold uppercase no-print">
                                {isGeneratingObjective ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Add
                            </button>
                        </div>
                        <div className="bg-[#dbeafe] p-4 space-y-3">
                            {editablePlan.lessonDetails.objectives.map((obj, i) => (
                                <div key={i} className="flex gap-2 group items-start">
                                    <div className="flex-1">
                                        <AutoResizeTextarea
                                            value={obj}
                                            onChange={(e) => handleArrayChange('objectives', i, e.target.value)}
                                            className="w-full bg-white/50 border-none text-slate-800 focus:bg-white p-2 rounded outline-none shadow-sm transition-all"
                                            minRows={1}
                                            placeholder="Enter objective..."
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity no-print">
                                        <button onClick={() => moveArrayItem('objectives', i, 'up')} className="p-1 text-indigo-400 hover:text-indigo-600 bg-white rounded shadow-xs"><ChevronUp className="w-3 h-3" /></button>
                                        <button onClick={() => moveArrayItem('objectives', i, 'down')} className="p-1 text-indigo-400 hover:text-indigo-600 bg-white rounded shadow-xs"><ChevronDown className="w-3 h-3" /></button>
                                        <button onClick={() => deleteArrayItem('objectives', i)} className="p-1 text-red-400 hover:text-red-600 bg-white rounded shadow-xs"><Trash2 className="w-3 h-3" /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="border border-indigo-200 rounded-lg overflow-hidden">
                        <div className="bg-indigo-50 px-4 py-2 border-b border-indigo-100 flex justify-between items-center">
                            <h4 className="font-bold text-indigo-900 text-sm">Materials and equipment:</h4>
                            <button onClick={addMaterialEntry} disabled={isGeneratingMaterial} className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 text-xs font-bold uppercase no-print">
                                {isGeneratingMaterial ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Add
                            </button>
                        </div>
                        <div className="bg-[#dbeafe] p-4 space-y-3">
                            {editablePlan.lessonDetails.materials.map((mat, i) => (
                                <div key={i} className="flex gap-2 group items-start">
                                    <div className="flex-1">
                                        <AutoResizeTextarea
                                            value={mat}
                                            onChange={(e) => handleArrayChange('materials', i, e.target.value)}
                                            className="w-full bg-white/50 border-none text-slate-800 focus:bg-white p-2 rounded outline-none shadow-sm transition-all"
                                            minRows={1}
                                            placeholder="Enter material..."
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity no-print">
                                        <button onClick={() => moveArrayItem('materials', i, 'up')} className="p-1 text-indigo-400 hover:text-indigo-600 bg-white rounded shadow-xs"><ChevronUp className="w-3 h-3" /></button>
                                        <button onClick={() => moveArrayItem('materials', i, 'down')} className="p-1 text-indigo-400 hover:text-indigo-600 bg-white rounded shadow-xs"><ChevronDown className="w-3 h-3" /></button>
                                        <button onClick={() => deleteArrayItem('materials', i)} className="p-1 text-red-400 hover:text-red-600 bg-white rounded shadow-xs"><Trash2 className="w-3 h-3" /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="border border-indigo-200 rounded-lg overflow-hidden">
                        <div className="grid grid-cols-[1fr_1fr_120px] bg-indigo-50 border-b border-indigo-100">
                            <div className="px-4 py-2 border-r border-indigo-200 flex justify-between items-center">
                                <h4 className="font-bold text-indigo-900 text-sm">Anticipated problems:</h4>
                            </div>
                            <div className="px-4 py-2 border-r border-indigo-200">
                                <h4 className="font-bold text-indigo-900 text-sm">Solutions:</h4>
                            </div>
                            <div className="px-4 py-2 bg-indigo-100 flex items-center justify-center no-print">
                                <button onClick={addProblemEntry} disabled={isGeneratingProblem} className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 text-[10px] font-black uppercase tracking-wider">
                                    {isGeneratingProblem ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Add Pair
                                </button>
                            </div>
                        </div>
                        <div className="bg-[#dbeafe] divide-y divide-indigo-200/30">
                            {editablePlan.lessonDetails.anticipatedProblems.map((p, i) => (
                                <div key={i} className="grid grid-cols-[1fr_1fr_120px] group">
                                    <div className="p-4 border-r border-indigo-200">
                                        <AutoResizeTextarea
                                            value={p.problem}
                                            onChange={(e) => handleProblemSolutionChange(i, 'problem', e.target.value)}
                                            className="w-full bg-white/50 border-none text-slate-800 focus:bg-white p-2 rounded outline-none shadow-xs transition-all"
                                            minRows={2}
                                            placeholder="Problem..."
                                        />
                                    </div>
                                    <div className="p-4 border-r border-indigo-200">
                                        <AutoResizeTextarea
                                            value={p.solution}
                                            onChange={(e) => handleProblemSolutionChange(i, 'solution', e.target.value)}
                                            className="w-full bg-white/30 border-none text-slate-800 focus:bg-white p-2 rounded outline-none shadow-xs transition-all"
                                            minRows={2}
                                            placeholder="Solution..."
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1 p-2 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity no-print">
                                        <button onClick={() => moveProblemItem(i, 'up')} className="p-1.5 text-indigo-400 hover:text-indigo-600 bg-white rounded shadow-xs"><ChevronUp className="w-4 h-4" /></button>
                                        <button onClick={() => moveProblemItem(i, 'down')} className="p-1.5 text-indigo-400 hover:text-indigo-600 bg-white rounded shadow-xs"><ChevronDown className="w-4 h-4" /></button>
                                        <button onClick={() => deleteProblemItem(i)} className="p-1.5 text-red-400 hover:text-red-600 bg-white rounded shadow-xs"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                        <div className="bg-teal-50/30 p-4 rounded-xl border border-teal-100">
                            <h4 className="font-bold text-teal-800 mb-4 flex justify-between items-center">Target Vocabulary <button onClick={addVocabEntry} disabled={isGeneratingVocab} className="text-xs bg-teal-600 text-white px-2 py-1 rounded hover:bg-teal-700 flex items-center gap-1 no-print">
                                {isGeneratingVocab ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Add
                            </button></h4>
                            <div className="grid grid-cols-1 gap-3">
                                {editablePlan.lessonDetails.targetVocab.map((v, i) => (
                                    <div key={i} className="bg-white p-3 rounded-lg border border-teal-100 shadow-sm relative group flex gap-2">
                                        <div className="flex-1 space-y-2">
                                            <input value={v.word} onChange={(e) => handleVocabChange(i, 'word', e.target.value)} placeholder="Word/Phrase" className="font-bold text-teal-700 bg-transparent w-full border-b border-teal-50 focus:border-teal-300 outline-none p-1" />
                                            <AutoResizeTextarea value={v.definition} onChange={(e) => handleVocabChange(i, 'definition', e.target.value)} placeholder="Definition/Example" className="w-full text-xs text-slate-500 bg-transparent outline-none p-1" minRows={1} />
                                        </div>
                                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity no-print">
                                            <button onClick={() => moveVocabItem(i, 'up')} className="p-1 text-teal-400 hover:text-teal-600"><ChevronUp className="w-3 h-3" /></button>
                                            <button onClick={() => moveVocabItem(i, 'down')} className="p-1 text-teal-400 hover:text-teal-600"><ChevronDown className="w-3 h-3" /></button>
                                            <button onClick={() => deleteVocabItem(i)} className="p-1 text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-indigo-50/30 p-4 rounded-xl border border-indigo-100">
                            <h4 className="font-bold text-indigo-800 mb-4 flex justify-between items-center">Grammar & Sentences <button onClick={addSentenceEntry} disabled={isGeneratingSingleGrammar} className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-teal-700 flex items-center gap-1 no-print">
                                {isGeneratingSingleGrammar ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Add
                            </button></h4>
                            <div className="space-y-2">
                                {editablePlan.lessonDetails.grammarSentences.map((s, i) => (
                                    <div key={i} className="flex gap-2 items-start bg-white p-3 rounded-lg border border-indigo-50 shadow-sm group">
                                        <span className="text-indigo-400 font-bold mt-2">•</span>
                                        <AutoResizeTextarea value={s} onChange={(e) => handleArrayChange('grammarSentences', i, e.target.value)} placeholder="Grammar point or target sentence..." className="w-full bg-transparent outline-none text-sm text-slate-700 p-1" minRows={1} />
                                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity no-print">
                                            <button onClick={() => moveArrayItem('grammarSentences', i, 'up')} className="p-1 text-indigo-400 hover:text-indigo-600"><ChevronUp className="w-3 h-3" /></button>
                                            <button onClick={() => moveArrayItem('grammarSentences', i, 'down')} className="p-1 text-indigo-400 hover:text-indigo-600"><ChevronDown className="w-3 h-3" /></button>
                                            <button onClick={() => deleteArrayItem('grammarSentences', i)} className="p-1 text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="border border-purple-200 rounded-lg overflow-hidden mt-6">
                        {/* Note: I'm leaving Phonics point focus handlers in LessonPlanTab since they edit the plan's key structures (or wait, phonicsContent.keyPoints is separate). Let's review if Phonics focus should be injected. User requested Phonics tab separate. The old plan shows Phonics focus here inside the Plan tab. I will require phonicsContent to be passed in props if I keep it here, or I can extract it out.
                        For now let's pass it via props to maintain the exact old UI layout. */}
                        {/* The Phonics focus section inside Plan tab */}
                        <div className="bg-purple-50 px-4 py-2 border-b border-purple-100 flex justify-between items-center">
                            <h4 className="font-bold text-purple-900 text-sm">Teaching Stages & Flow</h4>
                            <button onClick={() => addStageEntry()} disabled={isGeneratingStage} className="bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-black transition-colors flex items-center gap-1 shadow-sm no-print">
                                {isGeneratingStage ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Add Stage
                            </button>
                        </div>
                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                            <table className="w-full min-w-[800px] text-sm text-left border-collapse">
                                <thead className="bg-slate-100 text-slate-600 font-bold">
                                    <tr>
                                        <th className="px-4 py-3 border-b border-slate-200 w-32">Stage</th>
                                        <th className="px-4 py-3 border-b border-slate-200 w-24">Timing</th>
                                        <th className="px-4 py-3 border-b border-slate-200 w-1/3">Teacher Activity (Script)</th>
                                        <th className="px-4 py-3 border-b border-slate-200 w-1/3">Student Activity</th>
                                        <th className="px-4 py-3 border-b border-slate-200 w-24 text-center no-print">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {editablePlan.stages.map((stage, i) => (
                                        <tr key={i} className="align-top hover:bg-slate-50/50 transition-colors group">
                                            <td className="p-2 border-r border-slate-200">
                                                <input value={stage.stage} onChange={(e) => handleStageChange(i, 'stage', e.target.value)} className="w-full font-bold text-teal-700 bg-transparent outline-none p-2 focus:bg-white rounded border border-transparent focus:border-teal-200" />
                                            </td>
                                            <td className="p-2 border-r border-slate-200">
                                                <input value={stage.timing} onChange={(e) => handleStageChange(i, 'timing', e.target.value)} className="w-full text-slate-500 bg-transparent outline-none p-2 focus:bg-white rounded border border-transparent focus:border-indigo-200" />
                                            </td>
                                            <td className="p-2 border-r border-slate-200 bg-yellow-50/10">
                                                <AutoResizeTextarea
                                                    value={stage.teacherActivity}
                                                    onChange={(e) => handleStageChange(i, 'teacherActivity', e.target.value)}
                                                    className="w-full bg-transparent text-slate-800 focus:bg-white p-2 rounded border border-transparent focus:border-teal-200 outline-none transition-all"
                                                    minRows={5}
                                                    placeholder="Teacher says..."
                                                />
                                            </td>
                                            <td className="p-2 border-r border-slate-200">
                                                <AutoResizeTextarea
                                                    value={stage.studentActivity}
                                                    onChange={(e) => handleStageChange(i, 'studentActivity', e.target.value)}
                                                    className="w-full bg-transparent text-slate-600 focus:bg-white p-2 rounded border border-transparent focus:border-teal-200 outline-none transition-all"
                                                    minRows={5}
                                                    placeholder="Students respond..."
                                                />
                                            </td>
                                            <td className="p-2 align-middle text-center no-print">
                                                <div className="flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity no-print">
                                                    <button onClick={() => moveStageEntry(i, 'up')} className="p-1 text-slate-400 hover:text-indigo-600" title="Move Up"><ChevronUp className="w-4 h-4" /></button>
                                                    <button onClick={() => addStageEntry(i)} className="p-1 text-teal-400 hover:text-teal-600" title="Insert Below"><Plus className="w-4 h-4" /></button>
                                                    <button onClick={() => moveStageEntry(i, 'down')} className="p-1 text-slate-400 hover:text-indigo-600" title="Move Down"><ChevronDown className="w-4 h-4" /></button>
                                                    <button onClick={() => deleteStageEntry(i)} className="p-1 text-red-400 hover:text-red-600" title="Delete"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
