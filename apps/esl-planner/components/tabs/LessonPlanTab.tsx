import React, { useState, useCallback, useEffect } from 'react';
import { StructuredLessonPlan, CEFRLevel, LessonStage } from '../../types';
import { Loader2, Plus, Trash2, ExternalLink, GripVertical, Info, Target, List, AlertCircle, BookOpen, Layers, Users, Lightbulb, Zap, X, ChevronDown, ChevronRight, Check } from 'lucide-react';
import { generateSingleObjective, generateSingleMaterial, generateSingleVocabItem, generateVocabDefinition, generateSingleAnticipatedProblem, generateSingleStage, generateSingleGrammarPoint, generateSingleTeachingTip, generateSingleBackgroundKnowledge, generateFillerActivity } from '../../services/itemGenerators';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { AutoResizeTextarea } from '../common/AutoResizeTextarea';



interface LessonPlanTabProps {
    editablePlan: StructuredLessonPlan;
    setEditablePlan: (plan: StructuredLessonPlan) => void;
}

export const LessonPlanTab: React.FC<LessonPlanTabProps> = React.memo(({
    editablePlan,
    setEditablePlan,
}) => {
    // Local loading states
    const [isGeneratingObjective, setIsGeneratingObjective] = useState(false);
    const [isGeneratingMaterial, setIsGeneratingMaterial] = useState(false);
    const [isGeneratingVocab, setIsGeneratingVocab] = useState(false);
    const [generatingDefFor, setGeneratingDefFor] = useState<number | null>(null);
    const [isGeneratingSingleGrammar, setIsGeneratingSingleGrammar] = useState(false);
    const [isGeneratingProblem, setIsGeneratingProblem] = useState(false);
    const [isGeneratingStage, setIsGeneratingStage] = useState(false);
    const [generatingExtraFor, setGeneratingExtraFor] = useState<{ stageIndex: number; type: 'tip' | 'bg' | 'filler' } | null>(null);
    const [expandedStages, setExpandedStages] = useState<Set<number>>(new Set());
    const [showStageInput, setShowStageInput] = useState(false);
    const [stagePrompt, setStagePrompt] = useState('');
    const [stageComments, setStageComments] = useState<string[]>([]);
    const [regeneratingStageIndex, setRegeneratingStageIndex] = useState<number | null>(null);
    const [stageRegenerationErrors, setStageRegenerationErrors] = useState<Record<number, string>>({});
    const toggleStage = useCallback((idx: number) => {
        setExpandedStages((prev) => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx); else next.add(idx);
            return next;
        });
    }, []);

    useEffect(() => {
        setStageComments((prev) => editablePlan.stages.map((_, idx) => prev[idx] || ''));
        setStageRegenerationErrors((prev) => {
            const next: Record<number, string> = {};
            editablePlan.stages.forEach((_, idx) => {
                if (prev[idx]) next[idx] = prev[idx];
            });
            return next;
        });
    }, [editablePlan.stages.length]);

    // --- Handlers ---
    const handlePlanInfoChange = (section: keyof StructuredLessonPlan, field: string, value: any) => {
        setEditablePlan({
            ...editablePlan,
            [section]: {
                ...(editablePlan[section] as Record<string, unknown>),
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

    const handleStageArrayChange = (stageIndex: number, field: 'teachingTips' | 'backgroundKnowledge', itemIndex: number, value: string) => {
        const newStages = [...editablePlan.stages];
        const arr = [...(newStages[stageIndex][field] || [])];
        arr[itemIndex] = value;
        newStages[stageIndex] = { ...newStages[stageIndex], [field]: arr };
        setEditablePlan({ ...editablePlan, stages: newStages });
    };

    const removeStageArrayItem = (stageIndex: number, field: 'teachingTips' | 'backgroundKnowledge', itemIndex: number) => {
        const newStages = [...editablePlan.stages];
        const arr = (newStages[stageIndex][field] || []).filter((_: any, i: number) => i !== itemIndex);
        newStages[stageIndex] = { ...newStages[stageIndex], [field]: arr };
        setEditablePlan({ ...editablePlan, stages: newStages });
    };

    const addTeachingTip = async (stageIndex: number) => {
        setGeneratingExtraFor({ stageIndex, type: 'tip' });
        try {
            const stage = editablePlan.stages[stageIndex];
            const newTip = await generateSingleTeachingTip(
                editablePlan.classInformation.level as CEFRLevel,
                editablePlan.classInformation.topic,
                stage.stage,
                stage.teachingTips || []
            );
            const newStages = [...editablePlan.stages];
            newStages[stageIndex] = { ...newStages[stageIndex], teachingTips: [...(newStages[stageIndex].teachingTips || []), newTip] };
            setEditablePlan({ ...editablePlan, stages: newStages });
        } catch (e: unknown) {
            console.error('Failed to generate teaching tip', e);
            const newStages = [...editablePlan.stages];
            newStages[stageIndex] = { ...newStages[stageIndex], teachingTips: [...(newStages[stageIndex].teachingTips || []), 'New teaching tip'] };
            setEditablePlan({ ...editablePlan, stages: newStages });
        } finally {
            setGeneratingExtraFor(null);
        }
    };

    const addBackgroundKnowledge = async (stageIndex: number) => {
        setGeneratingExtraFor({ stageIndex, type: 'bg' });
        try {
            const stage = editablePlan.stages[stageIndex];
            const newInfo = await generateSingleBackgroundKnowledge(
                editablePlan.classInformation.level as CEFRLevel,
                editablePlan.classInformation.topic,
                stage.stage,
                stage.backgroundKnowledge || []
            );
            const newStages = [...editablePlan.stages];
            newStages[stageIndex] = { ...newStages[stageIndex], backgroundKnowledge: [...(newStages[stageIndex].backgroundKnowledge || []), newInfo] };
            setEditablePlan({ ...editablePlan, stages: newStages });
        } catch (e: unknown) {
            console.error('Failed to generate background knowledge', e);
            const newStages = [...editablePlan.stages];
            newStages[stageIndex] = { ...newStages[stageIndex], backgroundKnowledge: [...(newStages[stageIndex].backgroundKnowledge || []), 'New background knowledge'] };
            setEditablePlan({ ...editablePlan, stages: newStages });
        } finally {
            setGeneratingExtraFor(null);
        }
    };

    const addFillerActivity = async (stageIndex: number) => {
        setGeneratingExtraFor({ stageIndex, type: 'filler' });
        try {
            const stage = editablePlan.stages[stageIndex];
            const filler = await generateFillerActivity(
                editablePlan.classInformation.level as CEFRLevel,
                editablePlan.classInformation.topic,
                stage.stage
            );
            const newStages = [...editablePlan.stages];
            newStages[stageIndex] = { ...newStages[stageIndex], fillerActivity: filler };
            setEditablePlan({ ...editablePlan, stages: newStages });
        } catch (e: unknown) {
            console.error('Failed to generate filler activity', e);
            const newStages = [...editablePlan.stages];
            newStages[stageIndex] = { ...newStages[stageIndex], fillerActivity: 'Quick review activity' };
            setEditablePlan({ ...editablePlan, stages: newStages });
        } finally {
            setGeneratingExtraFor(null);
        }
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
        } catch (e: unknown) {
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
        } catch (e: unknown) {
            console.error(e);
            setEditablePlan({ ...editablePlan, lessonDetails: { ...editablePlan.lessonDetails, materials: [...editablePlan.lessonDetails.materials, "New Material"] } });
        } finally {
            setIsGeneratingMaterial(false);
        }
    };

    const addVocabEntry = () => {
        setEditablePlan({
            ...editablePlan,
            lessonDetails: {
                ...editablePlan.lessonDetails,
                targetVocab: [...editablePlan.lessonDetails.targetVocab, { word: '', definition: '' }]
            }
        });
    };

    const generateDefinitionForVocab = async (index: number) => {
        const word = editablePlan.lessonDetails.targetVocab[index]?.word?.trim();
        if (!word || generatingDefFor !== null) return;
        setGeneratingDefFor(index);
        try {
            const def = await generateVocabDefinition(word, editablePlan.classInformation.level as CEFRLevel);
            if (def) {
                const newVocab = [...editablePlan.lessonDetails.targetVocab];
                newVocab[index] = { ...newVocab[index], definition: def };
                setEditablePlan({ ...editablePlan, lessonDetails: { ...editablePlan.lessonDetails, targetVocab: newVocab } });
            }
        } catch (e: unknown) {
            console.error('Failed to generate definition', e);
        } finally {
            setGeneratingDefFor(null);
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
        } catch (e: unknown) {
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
        } catch (e: unknown) {
            console.error(e);
            setEditablePlan({ ...editablePlan, lessonDetails: { ...editablePlan.lessonDetails, anticipatedProblems: [...editablePlan.lessonDetails.anticipatedProblems, { problem: "Anticipated Problem", solution: "Suggested Solution" }] } });
        } finally {
            setIsGeneratingProblem(false);
        }
    };

    const addStageEntry = async (index?: number, customPrompt?: string) => {
        if (isGeneratingStage) return;
        setIsGeneratingStage(true);
        try {
            const newStage = await generateSingleStage(
                editablePlan.classInformation.level as CEFRLevel,
                editablePlan.classInformation.topic,
                editablePlan.stages,
                customPrompt || undefined
            );
            const newStages = [...editablePlan.stages];
            if (typeof index === 'number') {
                newStages.splice(index + 1, 0, newStage);
            } else {
                newStages.push(newStage);
            }
            setEditablePlan({ ...editablePlan, stages: newStages });
        } catch (e: unknown) {
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

    const updateStageComment = (index: number, value: string) => {
        setStageComments((prev) => {
            const next = [...prev];
            next[index] = value;
            return next;
        });
    };

    const regenerateStageFromComment = async (stageIndex: number) => {
        if (regeneratingStageIndex !== null) return;
        const feedback = (stageComments[stageIndex] || '').trim();
        if (!feedback) {
            setStageRegenerationErrors((prev) => ({
                ...prev,
                [stageIndex]: 'Please provide feedback before regenerating this stage.',
            }));
            return;
        }

        setRegeneratingStageIndex(stageIndex);
        setStageRegenerationErrors((prev) => {
            const next = { ...prev };
            delete next[stageIndex];
            return next;
        });

        try {
            const currentStage = editablePlan.stages[stageIndex];
            const previousStages = editablePlan.stages.slice(0, stageIndex);
            const nextStages = editablePlan.stages.slice(stageIndex + 1);
            const contextStages = [...previousStages, ...nextStages];

            const customPrompt = `Regenerate ONLY this specific stage using teacher feedback.
Target stage index: ${stageIndex + 1} / ${editablePlan.stages.length}
Teacher feedback and improvement request:
${feedback}

Current stage to improve:
${JSON.stringify(currentStage)}

Previous stages:
${JSON.stringify(previousStages)}

Next stages:
${JSON.stringify(nextStages)}

Requirements:
- Keep pedagogical continuity with previous and next stages.
- Keep timing close to "${currentStage.timing}" unless feedback explicitly asks otherwise.
- teacherActivity and studentActivity must be numbered steps with matching step count.
- interaction must be comma-separated and map 1:1 to numbered steps.
- Return one complete stage only.`;

            const regenerated = await generateSingleStage(
                editablePlan.classInformation.level as CEFRLevel,
                editablePlan.classInformation.topic,
                contextStages,
                customPrompt,
            );

            const normalizedStage: LessonStage = {
                stage: String(regenerated.stage || currentStage.stage || '').trim(),
                stageAim: String(regenerated.stageAim || currentStage.stageAim || '').trim(),
                timing: String(regenerated.timing || currentStage.timing || '').trim(),
                interaction: String(regenerated.interaction || currentStage.interaction || '').trim(),
                teacherActivity: String(regenerated.teacherActivity || currentStage.teacherActivity || '').trim(),
                studentActivity: String(regenerated.studentActivity || currentStage.studentActivity || '').trim(),
                teachingTips: Array.isArray(regenerated.teachingTips) ? regenerated.teachingTips : (currentStage.teachingTips || []),
                backgroundKnowledge: Array.isArray(regenerated.backgroundKnowledge) ? regenerated.backgroundKnowledge : (currentStage.backgroundKnowledge || []),
                fillerActivity: regenerated.fillerActivity || currentStage.fillerActivity || '',
            };

            const newStages = [...editablePlan.stages];
            newStages[stageIndex] = normalizedStage;
            setEditablePlan({ ...editablePlan, stages: newStages });
        } catch (e: unknown) {
            console.error('Failed to regenerate stage from feedback', e);
            setStageRegenerationErrors((prev) => ({
                ...prev,
                [stageIndex]: e instanceof Error ? e.message : 'Failed to regenerate this stage.',
            }));
        } finally {
            setRegeneratingStageIndex(null);
        }
    };

    return (
        <DragDropContext onDragEnd={handleDragEnd}>
            <div className="space-y-5 animate-fade-in">
                {/* === Info Card === */}
                <div className="bg-white dark:bg-slate-900/80 dark:backdrop-blur-xl rounded-xl border border-slate-200 dark:border-white/5 p-4 shadow-sm">
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                        <Info size={18} className="text-violet-600" />
                        Lesson Details
                    </h3>
                    {/* Topic �?own row */}
                    <div className="mb-4">
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">TOPIC</label>
                        <input
                            value={editablePlan.classInformation.topic}
                            onChange={(e) => handlePlanInfoChange('classInformation', 'topic', e.target.value)}
                            className="w-full font-semibold text-slate-800 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 focus:border-violet-500 outline-none py-1 bg-transparent"
                        />
                    </div>
                    {/* Level / Students / Date �?3 columns */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        {[
                            { key: 'level', label: 'LEVEL' },
                            { key: 'students', label: 'STUDENTS' },
                            { key: 'date', label: 'DATE' },
                        ].map(({ key, label }) => (
                            <div key={key}>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">{label}</label>
                                <input
                                    value={editablePlan.classInformation[key as keyof typeof editablePlan.classInformation]}
                                    onChange={(e) => handlePlanInfoChange('classInformation', key, e.target.value)}
                                    className="w-full font-semibold text-slate-800 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 focus:border-violet-500 outline-none py-1 bg-transparent"
                                />
                            </div>
                        ))}
                    </div>

                    {/* Lesson Aim */}
                    <div className="mb-4">
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">LESSON AIM</label>
                        <AutoResizeTextarea
                            value={editablePlan.lessonDetails.aim}
                            onChange={(e) => {
                                setEditablePlan({
                                    ...editablePlan,
                                    lessonDetails: { ...editablePlan.lessonDetails, aim: e.target.value }
                                });
                            }}
                            className="w-full font-medium text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 py-1 bg-transparent outline-none focus:border-violet-500"
                            minRows={1}
                            placeholder="Overall aim of this lesson..."
                        />
                    </div>

                    {/* Learning Objectives */}
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">LEARNING OBJECTIVES</label>
                        <Droppable droppableId="objectives-list" type="objectives">
                            {(provided) => (
                                <div className="space-y-2" ref={provided.innerRef} {...provided.droppableProps}>
                                    {editablePlan.lessonDetails.objectives.map((obj, i) => (
                                        <Draggable draggableId={`objective-${i}`} index={i}>
                                            {(provided, snapshot) => (
                                                <div
                                                    ref={provided.innerRef}
                                                    {...provided.draggableProps}
                                                    className={`flex items-center gap-2 group ${snapshot.isDragging ? 'opacity-90 shadow-lg bg-white dark:bg-slate-800 rounded-lg p-2 border border-violet-200' : ''}`}
                                                >
                                                    <div {...provided.dragHandleProps} className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing">
                                                        <GripVertical size={14} />
                                                    </div>
                                                    <Target size={16} className="text-violet-500 flex-shrink-0" />
                                                    <AutoResizeTextarea
                                                        value={obj}
                                                        onChange={(e) => handleArrayChange('objectives', i, e.target.value)}
                                                        className="flex-1 text-sm text-slate-700 dark:text-slate-300 border-b border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:border-violet-500 outline-none py-1 bg-transparent resize-none"
                                                        minRows={1}
                                                    />
                                                    <button onClick={() => deleteArrayItem('objectives', i)} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity no-print">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            )}
                                        </Draggable>
                                    ))}
                                    {provided.placeholder}
                                    <button onClick={addObjectiveEntry} disabled={isGeneratingObjective} className="text-xs font-bold text-violet-600 hover:text-violet-700 flex items-center gap-1 mt-2 no-print">
                                        {isGeneratingObjective ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add Objective
                                    </button>
                                </div>
                            )}
                        </Droppable>
                    </div>
                </div>

                {/* === Vocab & Grammar side-by-side === */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Vocabulary */}
                    <div className="bg-white dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm overflow-hidden">
                        <div className="bg-slate-50 dark:bg-slate-800/50 px-4 py-3 border-b border-slate-100 dark:border-white/5 flex justify-between items-center">
                            <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-2">
                                <BookOpen size={16} className="text-teal-500" /> Target Vocabulary
                            </h4>
                            <button onClick={addVocabEntry} className="text-teal-600 hover:text-teal-800 flex items-center gap-1 text-xs font-bold no-print">
                                <Plus size={12} /> ADD
                            </button>
                        </div>
                        <Droppable droppableId="vocab-list" type="targetVocab">
                            {(provided) => (
                                <div className="divide-y divide-slate-100 dark:divide-white/5" ref={provided.innerRef} {...provided.droppableProps}>
                                    {editablePlan.lessonDetails.targetVocab.map((v, i) => (
                                        <Draggable draggableId={`vocab-${i}`} index={i}>
                                            {(provided, snapshot) => (
                                                <div ref={provided.innerRef} {...provided.draggableProps}
                                                    className={`p-3 flex gap-2 group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors ${snapshot.isDragging ? 'opacity-90 shadow-xl border border-teal-200 rounded-lg' : ''}`}>
                                                    <div {...provided.dragHandleProps} className="mt-2 text-slate-300 hover:text-slate-500 cursor-grab">
                                                        <GripVertical size={14} />
                                                    </div>
                                                    <div className="flex-1 space-y-1">
                                                        <div className="flex items-center gap-1">
                                                            <input value={v.word} onChange={(e) => handleVocabChange(i, 'word', e.target.value)}
                                                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); generateDefinitionForVocab(i); } }}
                                                                className="font-bold text-sm text-slate-800 dark:text-slate-100 bg-transparent flex-1 border-b border-transparent hover:border-slate-200 focus:border-teal-400 outline-none pb-0.5" placeholder="Type a word..." autoFocus={!v.word} />
                                                            {v.word.trim() && (
                                                                <button
                                                                    onClick={() => generateDefinitionForVocab(i)}
                                                                    disabled={generatingDefFor === i}
                                                                    className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-500/10 transition-colors no-print"
                                                                    title="Generate definition"
                                                                >
                                                                    {generatingDefFor === i ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                                                </button>
                                                            )}
                                                        </div>
                                                        <AutoResizeTextarea value={v.definition} onChange={(e) => handleVocabChange(i, 'definition', e.target.value)}
                                                            className="w-full text-xs text-slate-500 dark:text-slate-400 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-teal-400 outline-none" minRows={1} placeholder="Definition (auto-generated or manual)" />
                                                    </div>
                                                    <button onClick={() => deleteVocabItem(i)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 no-print"><Trash2 size={14} /></button>
                                                </div>
                                            )}
                                        </Draggable>
                                    ))}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    </div>

                    {/* Grammar & Sentences */}
                    <div className="bg-white dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm overflow-hidden">
                        <div className="bg-slate-50 dark:bg-slate-800/50 px-4 py-3 border-b border-slate-100 dark:border-white/5 flex justify-between items-center">
                            <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-2">
                                <Layers size={16} className="text-indigo-500" /> Grammar & Sentences
                            </h4>
                            <button onClick={addSentenceEntry} disabled={isGeneratingSingleGrammar} className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 text-xs font-bold no-print">
                                {isGeneratingSingleGrammar ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} ADD
                            </button>
                        </div>
                        <Droppable droppableId="sentences-list" type="grammarSentences">
                            {(provided) => (
                                <div className="divide-y divide-slate-100 dark:divide-white/5" ref={provided.innerRef} {...provided.droppableProps}>
                                    {editablePlan.lessonDetails.grammarSentences.map((s, i) => (
                                        <Draggable draggableId={`sentence-${i}`} index={i}>
                                            {(provided, snapshot) => (
                                                <div ref={provided.innerRef} {...provided.draggableProps}
                                                    className={`flex gap-2 items-start p-3 group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors ${snapshot.isDragging ? 'opacity-90 shadow-xl border border-indigo-200 rounded-lg' : ''}`}>
                                                    <div {...provided.dragHandleProps} className="mt-1 text-slate-300 hover:text-slate-500 cursor-grab">
                                                        <GripVertical size={14} />
                                                    </div>
                                                    <AutoResizeTextarea value={s} onChange={(e) => handleArrayChange('grammarSentences', i, e.target.value)}
                                                        className="w-full text-sm text-slate-700 dark:text-slate-300 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-indigo-400 outline-none" minRows={1} placeholder="Grammar point..." />
                                                    <button onClick={() => deleteArrayItem('grammarSentences', i)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 no-print"><Trash2 size={14} /></button>
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

                {/* === Materials === */}
                <div className="bg-white dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-white/5 p-4 shadow-sm">
                    <div className="flex justify-between items-center mb-3">
                        <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-2">
                            <List size={16} className="text-violet-500" /> Materials & Equipment
                        </h4>
                        <button onClick={addMaterialEntry} disabled={isGeneratingMaterial} className="text-violet-600 hover:text-violet-800 flex items-center gap-1 text-xs font-bold no-print">
                            {isGeneratingMaterial ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} ADD
                        </button>
                    </div>
                    <Droppable droppableId="materials-list" type="materials">
                        {(provided) => (
                            <div className="space-y-2" ref={provided.innerRef} {...provided.droppableProps}>
                                {editablePlan.lessonDetails.materials.map((mat, i) => (
                                    <Draggable draggableId={`material-${i}`} index={i}>
                                        {(provided, snapshot) => (
                                            <div ref={provided.innerRef} {...provided.draggableProps}
                                                className={`flex items-start gap-2 group ${snapshot.isDragging ? 'opacity-90 shadow-lg bg-white dark:bg-slate-800 rounded-lg p-2 border border-violet-200' : ''}`}>
                                                <div {...provided.dragHandleProps} className="mt-1 text-slate-300 hover:text-slate-500 cursor-grab">
                                                    <GripVertical size={14} />
                                                </div>
                                                <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2.5 flex-shrink-0" />
                                                <AutoResizeTextarea value={mat} onChange={(e) => handleArrayChange('materials', i, e.target.value)}
                                                    className="flex-1 text-sm text-slate-700 dark:text-slate-300 border-b border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:border-violet-500 outline-none py-1 bg-transparent resize-none" minRows={1} />
                                                <button onClick={() => deleteArrayItem('materials', i)} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 no-print"><Trash2 size={14} /></button>
                                            </div>
                                        )}
                                    </Draggable>
                                ))}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </div>

                {/* === Anticipated Problems === */}
                <div className="bg-amber-50 dark:bg-amber-900/10 rounded-xl p-4 border border-amber-100 dark:border-amber-800/30">
                    <div className="flex justify-between items-center mb-3">
                        <label className="block text-xs font-bold text-amber-600 dark:text-amber-400 uppercase flex items-center gap-1">
                            <AlertCircle size={14} /> Anticipated Problems & Solutions
                        </label>
                        <button onClick={addProblemEntry} disabled={isGeneratingProblem} className="text-xs font-semibold text-amber-600 hover:text-amber-800 flex items-center gap-1 no-print">
                            {isGeneratingProblem ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Add Pair
                        </button>
                    </div>
                    <Droppable droppableId="problems-list" type="anticipatedProblems">
                        {(provided) => (
                            <div className="space-y-3" ref={provided.innerRef} {...provided.droppableProps}>
                                {editablePlan.lessonDetails.anticipatedProblems.map((p, i) => (
                                    <Draggable draggableId={`problem-${i}`} index={i}>
                                        {(provided, snapshot) => (
                                            <div ref={provided.innerRef} {...provided.draggableProps}
                                                className={`bg-white dark:bg-slate-900/60 rounded-lg border border-amber-200 dark:border-amber-800/30 p-3 group ${snapshot.isDragging ? 'shadow-xl opacity-90' : ''}`}>
                                                <div className="flex gap-2">
                                                    <div {...provided.dragHandleProps} className="mt-1 text-amber-300 hover:text-amber-500 cursor-grab">
                                                        <GripVertical size={14} />
                                                    </div>
                                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="text-[10px] font-bold text-amber-500 uppercase mb-1 block">Problem</label>
                                                            <AutoResizeTextarea value={p.problem} onChange={(e) => handleProblemSolutionChange(i, 'problem', e.target.value)}
                                                                className="w-full text-sm text-amber-900 dark:text-amber-200 bg-transparent border-b border-transparent focus:border-amber-400 outline-none resize-none" minRows={1} placeholder="Describe the problem..." />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-bold text-emerald-500 uppercase mb-1 block">Solution</label>
                                                            <AutoResizeTextarea value={p.solution} onChange={(e) => handleProblemSolutionChange(i, 'solution', e.target.value)}
                                                                className="w-full text-sm text-emerald-900 dark:text-emerald-200 bg-transparent border-b border-transparent focus:border-emerald-400 outline-none resize-none" minRows={1} placeholder="Suggested solution..." />
                                                        </div>
                                                    </div>
                                                    <button onClick={() => deleteProblemItem(i)} className="opacity-0 group-hover:opacity-100 text-amber-300 hover:text-red-500 no-print"><Trash2 size={14} /></button>
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

                {/* === Teaching Stages (Roadmap-style) === */}
                <div className="space-y-4">
                    <Droppable droppableId="stages-list" type="stages">
                        {(provided) => (
                            <div className="space-y-4" ref={provided.innerRef} {...provided.droppableProps}>
                                {editablePlan.stages.map((stage, i) => (
                                    <Draggable draggableId={`stage-${i}`} index={i}>
                                        {(provided, snapshot) => (
                                            <div
                                                ref={provided.innerRef}
                                                {...provided.draggableProps}
                                                data-stage-index={i}
                                                className={`bg-white dark:bg-slate-900/80 rounded-xl border transition-all ${snapshot.isDragging ? 'border-violet-400 shadow-lg opacity-50' : 'border-slate-200 dark:border-white/5 hover:border-violet-300 shadow-sm'}`}
                                            >
                                                {/* Stage Header */}
                                                <div
                                                    className="p-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-white/5 flex items-start gap-3 rounded-t-xl cursor-pointer group select-none"
                                                    onClick={() => toggleStage(i)}
                                                >
                                                    <div {...provided.dragHandleProps} className="mt-1 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300" onClick={(e) => e.stopPropagation()}>
                                                        <GripVertical size={16} />
                                                    </div>
                                                    <div className="mt-1 text-slate-400 flex-shrink-0">
                                                        {expandedStages.has(i) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                    </div>
                                                    <div className="flex-1 space-y-2">
                                                        {/* Row 1: Time + Stage name + Interaction badge */}
                                                        <div className="flex flex-wrap items-center gap-3">
                                                            <input
                                                                value={stage.timing}
                                                                onChange={(e) => handleStageChange(i, 'timing', e.target.value)}
                                                                className="w-20 text-sm font-bold text-violet-700 dark:text-violet-300 bg-violet-50/50 dark:bg-violet-500/10 border border-transparent hover:border-violet-200 dark:hover:border-violet-700 rounded px-2 py-1 outline-none flex-shrink-0 text-center"
                                                            />
                                                            <input
                                                                value={stage.stage}
                                                                onChange={(e) => handleStageChange(i, 'stage', e.target.value)}
                                                                className="flex-1 min-w-[100px] font-bold text-slate-800 dark:text-slate-100 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-violet-500 outline-none uppercase tracking-wide"
                                                            />
                                                        </div>
                                                        {/* Row 2: Aim */}
                                                        <AutoResizeTextarea
                                                            value={stage.stageAim}
                                                            onChange={(e) => handleStageChange(i, 'stageAim', e.target.value)}
                                                            className="w-full text-sm italic text-slate-500 dark:text-slate-400 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-violet-500 outline-none resize-none"
                                                            minRows={1}
                                                            placeholder="Stage aim..."
                                                        />
                                                    </div>
                                                    <button onClick={(e) => { e.stopPropagation(); deleteStageEntry(i); }} className="text-slate-400 hover:text-red-500 p-1 no-print">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>

                                                {/* Stage Body (collapsible) */}
                                                {expandedStages.has(i) && <div className="p-4 animate-fade-in">
                                                    {/* === Background Knowledge === */}
                                                    <div className="mb-4 bg-blue-50 dark:bg-blue-500/10 rounded-lg p-2.5 border border-blue-100 dark:border-blue-500/20">
                                                        <label className="block text-xs font-bold text-blue-500 uppercase mb-2 flex items-center gap-1">
                                                            <BookOpen size={12} /> Background Knowledge
                                                        </label>
                                                        <div className="space-y-2">
                                                            {(stage.backgroundKnowledge && stage.backgroundKnowledge.length > 0) ? stage.backgroundKnowledge.map((info, infoIdx) => (
                                                                <div key={infoIdx} className="flex items-start gap-2">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2 flex-shrink-0" />
                                                                    <AutoResizeTextarea
                                                                        value={info}
                                                                        onChange={(e) => handleStageArrayChange(i, 'backgroundKnowledge', infoIdx, e.target.value)}
                                                                        className="flex-1 text-sm text-blue-900 dark:text-blue-200 bg-transparent border-b border-transparent focus:border-blue-300 outline-none"
                                                                        minRows={1}
                                                                    />
                                                                    <button onClick={() => removeStageArrayItem(i, 'backgroundKnowledge', infoIdx)} className="text-blue-300 hover:text-red-500 no-print">
                                                                        <X size={14} />
                                                                    </button>
                                                                </div>
                                                            )) : <div className="text-sm text-blue-300 italic px-2">No background info yet.</div>}
                                                        </div>
                                                        <div className="flex justify-end mt-2 no-print">
                                                            <button
                                                                onClick={() => addBackgroundKnowledge(i)}
                                                                disabled={generatingExtraFor?.stageIndex === i && generatingExtraFor?.type === 'bg'}
                                                                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                                            >
                                                                {generatingExtraFor?.stageIndex === i && generatingExtraFor?.type === 'bg' ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* === Teaching Tips === */}
                                                    <div className="mb-4 bg-purple-50 dark:bg-purple-500/10 rounded-lg p-2.5 border border-purple-100 dark:border-purple-500/20">
                                                        <label className="block text-xs font-bold text-purple-500 uppercase mb-2 flex items-center gap-1">
                                                            <Lightbulb size={12} /> Teaching Tips
                                                        </label>
                                                        <div className="space-y-2">
                                                            {(stage.teachingTips && stage.teachingTips.length > 0) ? stage.teachingTips.map((tip, tipIdx) => (
                                                                <div key={tipIdx} className="flex items-start gap-2">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-2 flex-shrink-0" />
                                                                    <AutoResizeTextarea
                                                                        value={tip}
                                                                        onChange={(e) => handleStageArrayChange(i, 'teachingTips', tipIdx, e.target.value)}
                                                                        className="flex-1 text-sm text-purple-900 dark:text-purple-200 bg-transparent border-b border-transparent focus:border-purple-300 outline-none"
                                                                        minRows={1}
                                                                    />
                                                                    <button onClick={() => removeStageArrayItem(i, 'teachingTips', tipIdx)} className="text-purple-300 hover:text-red-500 no-print">
                                                                        <X size={14} />
                                                                    </button>
                                                                </div>
                                                            )) : <div className="text-sm text-purple-300 italic px-2">No teaching tips yet.</div>}
                                                        </div>
                                                        <div className="flex justify-end mt-2 no-print">
                                                            <button
                                                                onClick={() => addTeachingTip(i)}
                                                                disabled={generatingExtraFor?.stageIndex === i && generatingExtraFor?.type === 'tip'}
                                                                className="text-xs font-semibold text-purple-600 hover:text-purple-800 flex items-center gap-1"
                                                            >
                                                                {generatingExtraFor?.stageIndex === i && generatingExtraFor?.type === 'tip' ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* === Filler Activity === */}
                                                    <div className="mb-4 bg-amber-50 dark:bg-amber-500/10 rounded-lg p-2.5 border border-amber-100 dark:border-amber-500/20">
                                                        <label className="block text-xs font-bold text-amber-600 uppercase mb-2 flex items-center gap-1">
                                                            <Zap size={12} /> Filler Activity
                                                        </label>
                                                        {stage.fillerActivity ? (
                                                            <div className="flex items-start gap-2">
                                                                <AutoResizeTextarea
                                                                    value={stage.fillerActivity}
                                                                    onChange={(e) => handleStageChange(i, 'fillerActivity', e.target.value)}
                                                                    className="flex-1 text-sm text-amber-900 dark:text-amber-200 bg-transparent border-b border-transparent focus:border-amber-300 outline-none"
                                                                    minRows={1}
                                                                />
                                                                <button onClick={() => handleStageChange(i, 'fillerActivity', '')} className="text-amber-300 hover:text-red-500 no-print">
                                                                    <X size={14} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="text-sm text-amber-300 italic px-2">No filler activity.</div>
                                                        )}
                                                        {!stage.fillerActivity && (
                                                            <div className="flex justify-end mt-2 no-print">
                                                                <button
                                                                    onClick={() => addFillerActivity(i)}
                                                                    disabled={generatingExtraFor?.stageIndex === i && generatingExtraFor?.type === 'filler'}
                                                                    className="text-xs font-semibold text-amber-600 hover:text-amber-800 flex items-center gap-1"
                                                                >
                                                                    {generatingExtraFor?.stageIndex === i && generatingExtraFor?.type === 'filler' ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Column headers */}
                                                    <div className="grid grid-cols-[1.5rem_4.5rem_1fr_1fr_1.75rem] gap-x-2 mb-2 items-center">
                                                        <div />
                                                        <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center justify-center gap-0.5">
                                                            <Users size={10} /> MODE
                                                        </label>
                                                        <label className="text-[10px] font-black text-violet-400 uppercase tracking-widest flex items-center justify-center gap-1">
                                                            <BookOpen size={12} /> TEACHER SCRIPT
                                                        </label>
                                                        <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center justify-center gap-1">
                                                            <Target size={12} /> STUDENT ACTIVITY
                                                        </label>
                                                        <div />
                                                    </div>
                                                    {/* Step rows */}
                                                    {(() => {
                                                        const stripHtml = (s: string) => s.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s{2,}/g, ' ').trim();
                                                        const splitSteps = (text: string): string[] => {
                                                            const cleaned = stripHtml(text);
                                                            const parts = cleaned.split(/(?=\d+\.\s)/).map(s => s.replace(/^\d+\.\s*/, '').trim()).filter(Boolean);
                                                            return parts.length > 0 ? parts : [cleaned];
                                                        };
                                                        const splitInteractions = (text: string): string[] =>
                                                            text.split(/[,;]/).map(s => s.trim()).filter(Boolean);
                                                        const teacherSteps = splitSteps(stage.teacherActivity);
                                                        const studentSteps = splitSteps(stage.studentActivity);
                                                        const interactionParts = splitInteractions(stage.interaction);
                                                        const maxLen = Math.max(teacherSteps.length, studentSteps.length);
                                                        const mergeSteps = (steps: string[]): string =>
                                                            steps.map((s, idx) => `${idx + 1}. ${s}`).join(' ');
                                                        const deleteStepGroup = (stepIndex: number) => {
                                                            const nextTeacher = teacherSteps.filter((_, idx) => idx !== stepIndex).filter(Boolean);
                                                            const nextStudent = studentSteps.filter((_, idx) => idx !== stepIndex).filter(Boolean);
                                                            const nextInteraction = interactionParts.filter((_, idx) => idx !== stepIndex).filter(Boolean);
                                                            handleStageChange(i, 'teacherActivity', mergeSteps(nextTeacher));
                                                            handleStageChange(i, 'studentActivity', mergeSteps(nextStudent));
                                                            handleStageChange(i, 'interaction', nextInteraction.join(', '));
                                                        };

                                                        return Array.from({ length: maxLen }).map((_, si) => (
                                                            <div key={si} className="grid grid-cols-[1.5rem_4.5rem_1fr_1fr_1.75rem] gap-x-2 mb-1.5 items-center group/step">
                                                                <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                                                                    {si + 1}
                                                                </span>
                                                                <input
                                                                    value={interactionParts[si] ?? interactionParts[interactionParts.length - 1] ?? ''}
                                                                    onChange={(e) => {
                                                                        const updated = [...interactionParts];
                                                                        while (updated.length <= si) updated.push('');
                                                                        updated[si] = e.target.value;
                                                                        handleStageChange(i, 'interaction', updated.filter(Boolean).join(', '));
                                                                    }}
                                                                    className="w-full text-[10px] font-semibold text-blue-600 dark:text-blue-300 bg-blue-50/30 dark:bg-blue-500/10 hover:bg-blue-50 dark:hover:bg-blue-500/15 rounded-lg px-2 py-1.5 outline-none transition-colors text-center border border-transparent focus:border-blue-300 dark:focus:border-blue-600"
                                                                    title="Interaction mode"
                                                                />
                                                                <AutoResizeTextarea
                                                                    value={teacherSteps[si] || ''}
                                                                    onChange={(e) => {
                                                                        const updated = [...teacherSteps];
                                                                        updated[si] = e.target.value;
                                                                        handleStageChange(i, 'teacherActivity', mergeSteps(updated.filter((s, idx) => s || idx < maxLen)));
                                                                    }}
                                                                    className="w-full text-sm text-violet-900 dark:text-violet-200 bg-violet-50/30 dark:bg-violet-500/10 hover:bg-violet-50 dark:hover:bg-violet-500/15 rounded-lg px-2.5 py-1.5 outline-none transition-colors leading-relaxed resize-none border border-transparent focus:border-violet-300 dark:focus:border-violet-600"
                                                                    minRows={1}
                                                                    placeholder="Teacher action..."
                                                                />
                                                                <AutoResizeTextarea
                                                                    value={studentSteps[si] || ''}
                                                                    onChange={(e) => {
                                                                        const updated = [...studentSteps];
                                                                        updated[si] = e.target.value;
                                                                        handleStageChange(i, 'studentActivity', mergeSteps(updated.filter((s, idx) => s || idx < maxLen)));
                                                                    }}
                                                                    className="w-full text-sm text-emerald-900 dark:text-emerald-200 bg-emerald-50/30 dark:bg-emerald-500/10 hover:bg-emerald-50 dark:hover:bg-emerald-500/15 rounded-lg px-2.5 py-1.5 outline-none transition-colors leading-relaxed resize-none border border-transparent focus:border-emerald-300 dark:focus:border-emerald-600"
                                                                    minRows={1}
                                                                    placeholder="Student action..."
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => deleteStepGroup(si)}
                                                                    className="h-7 w-7 rounded-md border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-red-500 hover:border-red-300 dark:hover:border-red-500 transition-colors flex items-center justify-center opacity-0 group-hover/step:opacity-100 focus:opacity-100 no-print"
                                                                    aria-label="Delete this interaction row"
                                                                    title="Delete this interaction row"
                                                                >
                                                                    <X size={13} />
                                                                </button>
                                                            </div>
                                                        ));
                                                    })()}

                                                    <div className="mt-4 rounded-lg border border-violet-200/70 dark:border-violet-700/60 bg-violet-50/40 dark:bg-violet-500/5 p-3 no-print">
                                                        <label className="block text-[11px] font-bold text-violet-700 dark:text-violet-300 uppercase tracking-wide mb-1.5">
                                                            Stage Comment / Improvement Notes
                                                        </label>
                                                        <AutoResizeTextarea
                                                            value={stageComments[i] || ''}
                                                            onChange={(e) => updateStageComment(i, e.target.value)}
                                                            className="w-full text-sm text-slate-700 dark:text-slate-200 bg-white/90 dark:bg-slate-900/80 border border-violet-200/80 dark:border-violet-700 rounded-lg px-3 py-2 outline-none focus:border-violet-500 resize-none"
                                                            minRows={2}
                                                            placeholder="Add your evaluation and specific improvement request for this stage..."
                                                        />
                                                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                                                            <p className="text-[11px] text-violet-700/80 dark:text-violet-300/80">
                                                                Regenerated stage updates this lesson plan and will be used in next Phase 2 generation.
                                                            </p>
                                                            <button
                                                                onClick={() => regenerateStageFromComment(i)}
                                                                disabled={regeneratingStageIndex !== null}
                                                                className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                                                            >
                                                                {regeneratingStageIndex === i ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                                                                {regeneratingStageIndex === i ? 'Regenerating...' : 'Submit & Regenerate Stage'}
                                                            </button>
                                                        </div>
                                                        {stageRegenerationErrors[i] && (
                                                            <p className="mt-1.5 text-[11px] text-red-600 dark:text-red-400">
                                                                {stageRegenerationErrors[i]}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>}
                                            </div>
                                        )}
                                    </Draggable>
                                ))}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>

                    {showStageInput ? (
                        <div className="border-2 border-dashed border-violet-300 dark:border-violet-700 rounded-xl p-4 space-y-3 bg-violet-50/50 dark:bg-violet-500/5 no-print">
                            <label className="text-xs font-bold text-violet-600 uppercase">Describe the stage you want (or leave empty for auto)</label>
                            <textarea
                                value={stagePrompt}
                                onChange={(e) => setStagePrompt(e.target.value)}
                                placeholder="e.g. A competitive team game to review vocabulary from this lesson..."
                                className="w-full border border-violet-200 dark:border-violet-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 outline-none focus:border-violet-500 resize-none"
                                rows={2}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        addStageEntry(undefined, stagePrompt.trim());
                                        setStagePrompt('');
                                        setShowStageInput(false);
                                    }
                                }}
                            />
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => { addStageEntry(undefined, stagePrompt.trim()); setStagePrompt(''); setShowStageInput(false); }}
                                    disabled={isGeneratingStage}
                                    className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 transition-colors flex items-center gap-1.5"
                                >
                                    {isGeneratingStage ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                                    Generate
                                </button>
                                <button
                                    onClick={() => { setShowStageInput(false); setStagePrompt(''); }}
                                    className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-500 hover:text-slate-700 transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowStageInput(true)}
                            disabled={isGeneratingStage}
                            className="w-full py-3 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-slate-500 dark:text-slate-400 font-semibold hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-all flex items-center justify-center gap-2 no-print"
                        >
                            {isGeneratingStage ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
                            Add Teaching Stage
                        </button>
                    )}
                </div>
            </div>
        </DragDropContext>
    );
});
