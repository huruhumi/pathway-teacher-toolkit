import React, { useState, useRef } from 'react';
import { Game, StructuredLessonPlan, CEFRLevel } from '../../types';
import { generateSingleGame } from '../../services/worksheetService';
import { generateLessonImage } from '../../services/lessonKitService';
import {
    Sparkles, Loader2, Bot, X, Plus, Trash2, GripVertical, RefreshCw,
    Image as ImageIcon,
} from 'lucide-react';
import { AutoResizeTextarea } from '../common/AutoResizeTextarea';


const skills = [
    "Random", "Listening", "Speaking", "Reading", "Writing", "Vocabulary", "Grammar", "Phonics", "Pronunciation"
];
const gameTypes = [
    "Random", "Warm-up", "Icebreaker", "Review", "Practice", "Production", "Role-play",
    "Information Gap", "Memory Game", "Relay Race", "Scavenger Hunt",
    "Digital Tool", "TPR (Movement)", "Board Game Style", "Creative Storytelling", "Debate"
];

interface ActivitiesTabProps {
    editableGames: Game[];
    setEditableGames: (games: Game[]) => void;
    editablePlan: StructuredLessonPlan | null;
    gameImages: Record<number, string>;
    onGameImagesChange: (imgs: Record<number, string>) => void;
}

export const ActivitiesTab: React.FC<ActivitiesTabProps> = React.memo(({
    editableGames,
    setEditableGames,
    editablePlan,
    gameImages,
    onGameImagesChange,
}) => {
    const [isGeneratingGame, setIsGeneratingGame] = useState(false);
    const [gameFilterSkill, setGameFilterSkill] = useState('Random');
    const [gameFilterType, setGameFilterType] = useState('Random');
    const [dragIdx, setDragIdx] = useState<number | null>(null);
    const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
    const [regeneratingIdx, setRegeneratingIdx] = useState<number | null>(null);
    const [generatingImageIdx, setGeneratingImageIdx] = useState<number | null>(null);
    const [isGeneratingAll, setIsGeneratingAll] = useState(false);
    const stopGeneratingRef = useRef(false);

    const handleGameChange = (index: number, field: keyof Game, value: any) => {
        const newGames = [...editableGames];
        (newGames[index] as any)[field] = value;
        setEditableGames(newGames);
    };

    const toggleGameCompletion = (index: number) => {
        const newGames = [...editableGames];
        newGames[index] = { ...newGames[index], isCompleted: !newGames[index].isCompleted };
        setEditableGames(newGames);
    };

    const removeGame = (index: number) => {
        setEditableGames(editableGames.filter((_, i) => i !== index));
        // Rebuild image mapping
        const rebuilt: Record<number, string> = {};
        for (const [key, val] of Object.entries(gameImages) as [string, string][]) {
            const k = Number(key);
            if (k < index) rebuilt[k] = val;
            else if (k > index) rebuilt[k - 1] = val;
        }
        onGameImagesChange(rebuilt);
    };

    const handleGameDragEnd = (fromIdx: number, toIdx: number) => {
        if (fromIdx === toIdx) return;
        const newGames = [...editableGames];
        const [moved] = newGames.splice(fromIdx, 1);
        newGames.splice(toIdx, 0, moved);
        setEditableGames(newGames);

        // Rebuild image mapping based on array permutation
        const rebuilt: Record<number, string> = {};
        for (const [key, val] of Object.entries(gameImages) as [string, string][]) {
            const k = Number(key);
            let newIndex = k;
            if (k === fromIdx) {
                newIndex = toIdx;
            } else if (fromIdx < toIdx && k > fromIdx && k <= toIdx) {
                newIndex = k - 1;
            } else if (fromIdx > toIdx && k >= toIdx && k < fromIdx) {
                newIndex = k + 1;
            }
            rebuilt[newIndex] = val;
        }
        onGameImagesChange(rebuilt);
    };

    const handleGenerateNewGame = async () => {
        if (!editablePlan) return;
        setIsGeneratingGame(true);
        try {
            const newGame = await generateSingleGame(
                editablePlan.classInformation.level as CEFRLevel,
                editablePlan.classInformation.topic,
                gameFilterType,
                gameFilterSkill,
                JSON.stringify(editablePlan.lessonDetails)
            );
            setEditableGames([...editableGames, { ...newGame, isCompleted: false }]);
        } catch (err) {
            console.error('Failed to generate game', err);
        } finally {
            setIsGeneratingGame(false);
        }
    };

    const handleGenerateGameImage = async (idx: number) => {
        const game = editableGames[idx];
        if (!game || generatingImageIdx !== null) return;
        setGeneratingImageIdx(idx);
        try {
            const prompt = `Create a clean, professional instructional illustration showing the rules of a classroom game called "${game.name}". The illustration should visually explain these steps using icons, arrows, numbered visual cues, and simple cartoon figures: ${game.instructions}. Style requirements: Use a unified flat illustration style with soft rounded shapes. Primary color palette: Violet #7C3AED, Purple #9333EA, Fuchsia #C026D3, with white background. Show the game flow as a visual diagram or step sequence. Use simple stick figures or cartoon children to represent students and teacher. DO NOT include any text or words in the image AT ALL — only visual elements, icons, arrows, and figures. Make it look like a professional infographic instruction card. Clean, minimal, child-friendly aesthetic.`;
            const imageUrl = await generateLessonImage(prompt, '4:3');
            onGameImagesChange({ ...gameImages, [idx]: imageUrl });
        } catch (err) {
            console.error('Failed to generate game image:', err);
            alert(`Failed to generate game image for "${game.name}": ${(err as Error).message}`);
        } finally {
            setGeneratingImageIdx(null);
        }
    };

    const handleStopGenerating = () => {
        stopGeneratingRef.current = true;
    };

    const handleGenerateAllGameImages = async () => {
        if (isGeneratingAll) {
            handleStopGenerating();
            return;
        }
        setIsGeneratingAll(true);
        stopGeneratingRef.current = false;
        try {
            const newImages = { ...gameImages };
            for (let i = 0; i < editableGames.length; i++) {
                if (stopGeneratingRef.current) break;
                if (!newImages[i]) {
                    setGeneratingImageIdx(i);
                    const game = editableGames[i];
                    const prompt = `Create a clean, professional instructional illustration showing the rules of a classroom game called "${game.name}". The illustration should visually explain these steps using icons, arrows, numbered visual cues, and simple cartoon figures: ${game.instructions}. Style requirements: Use a unified flat illustration style with soft rounded shapes. Primary color palette: Violet #7C3AED, Purple #9333EA, Fuchsia #C026D3, with white background. Show the game flow as a visual diagram or step sequence. Use simple stick figures or cartoon children to represent students and teacher. DO NOT include any text or words in the image AT ALL — only visual elements, icons, arrows, and figures. Make it look like a professional infographic instruction card. Clean, minimal, child-friendly aesthetic.`;
                    try {
                        const imageUrl = await generateLessonImage(prompt, '4:3');
                        newImages[i] = imageUrl;
                        onGameImagesChange({ ...newImages });
                    } catch (err) {
                        console.error('Failed to generate game image for', game.name, err);
                        alert(`Failed to generate game image for "${game.name}": ${(err as Error).message}`);
                    }
                }
            }
        } finally {
            setIsGeneratingAll(false);
            setGeneratingImageIdx(null);
            stopGeneratingRef.current = false;
        }
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                    <img id="pathway-logo" src={`${import.meta.env.BASE_URL}logo.png`} alt="Pathway Academy" className="w-10 h-10 object-contain" />
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">Classroom Games &amp; Activities</h3>
                </div>
                <div className="flex gap-2 no-print">
                    <button
                        onClick={handleGenerateAllGameImages}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 ${isGeneratingAll
                            ? 'bg-red-50 text-red-600 hover:bg-red-100'
                            : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                            }`}
                    >
                        {isGeneratingAll ? <X size={14} /> : <ImageIcon size={14} />}
                        {isGeneratingAll ? 'Stop' : 'Generate All Images'}
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900/80 p-6 rounded-3xl border border-slate-200 dark:border-white/10 shadow-sm no-print mb-8">
                <h4 className="text-sm font-black text-indigo-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-500" />
                    Generate New Game / Activity
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Focus Skill</label>
                        <select
                            value={gameFilterSkill}
                            onChange={(e) => setGameFilterSkill(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-colors"
                        >
                            {skills.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Game Style</label>
                        <select
                            value={gameFilterType}
                            onChange={(e) => setGameFilterType(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-colors"
                        >
                            {gameTypes.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={handleGenerateNewGame}
                            disabled={isGeneratingGame}
                            className="w-full h-[46px] bg-indigo-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-sm hover:shadow-md disabled:bg-indigo-400 disabled:shadow-none"
                        >
                            {isGeneratingGame ? <Loader2 className="w-5 h-5 animate-spin" /> : <Bot className="w-5 h-5" />}
                            Generate AI Activity
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {editableGames.map((game, idx) => (
                    <div
                        key={idx}
                        draggable
                        onDragStart={() => setDragIdx(idx)}
                        onDragOver={(e) => { e.preventDefault(); setDragOverIdx(idx); }}
                        onDragEnd={() => {
                            if (dragIdx !== null && dragOverIdx !== null) handleGameDragEnd(dragIdx, dragOverIdx);
                            setDragIdx(null);
                            setDragOverIdx(null);
                        }}
                        className={`bg-white dark:bg-slate-900/80 border rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col h-full group relative ${dragOverIdx === idx ? 'border-violet-400 ring-2 ring-violet-200' : game.isCompleted ? 'border-emerald-200 opacity-75' : 'border-slate-200 dark:border-white/10 hover:border-indigo-300'}`}
                    >
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-2 mr-3">
                                <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 no-print" title="Drag to reorder">
                                    <GripVertical className="w-5 h-5" />
                                </div>
                            </div>
                            <div className="flex-1 mr-4">
                                <div className="flex items-center gap-3 mb-2 flex-wrap">
                                    <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">{game.type}</span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{game.interactionType}</span>
                                    {game.linkedStage && (
                                        <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                                            🔗 {game.linkedStage}
                                        </span>
                                    )}
                                </div>
                                <AutoResizeTextarea
                                    value={game.name}
                                    onChange={(e) => handleGameChange(idx, 'name', e.target.value)}
                                    className="text-xl font-bold text-slate-800 dark:text-slate-200 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none w-full transition-colors pb-1 resize-none"
                                    minRows={1}
                                />
                            </div>
                            <div className="flex items-center gap-1 shrink-0 no-print">
                                <button
                                    onClick={async () => {
                                        if (!editablePlan || regeneratingIdx !== null) return;
                                        setRegeneratingIdx(idx);
                                        try {
                                            const newGame = await generateSingleGame(
                                                editablePlan.classInformation.level as CEFRLevel,
                                                editablePlan.classInformation.topic,
                                                game.type || 'Random',
                                                game.interactionType || 'Random',
                                                JSON.stringify(editablePlan.lessonDetails)
                                            );
                                            const newGames = [...editableGames];
                                            newGames[idx] = { ...newGame, linkedStage: game.linkedStage, isCompleted: false };
                                            setEditableGames(newGames);
                                        } catch (e) {
                                            console.error('Failed to regenerate game', e);
                                        } finally {
                                            setRegeneratingIdx(null);
                                        }
                                    }}
                                    disabled={regeneratingIdx !== null}
                                    className="p-2 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-xl opacity-0 group-hover:opacity-100 transition-all"
                                    title="Regenerate this activity"
                                >
                                    {regeneratingIdx === idx ? <Loader2 className="w-5 h-5 animate-spin text-indigo-500" /> : <RefreshCw className="w-5 h-5" />}
                                </button>
                                <button
                                    onClick={() => handleGenerateGameImage(idx)}
                                    disabled={generatingImageIdx !== null}
                                    className="p-2 text-slate-300 hover:text-violet-500 hover:bg-violet-50 rounded-xl opacity-0 group-hover:opacity-100 transition-all"
                                    title="生成游戏规则指示图"
                                >
                                    {generatingImageIdx === idx ? <Loader2 className="w-5 h-5 animate-spin text-violet-500" /> : <ImageIcon className="w-5 h-5" />}
                                </button>
                                <button onClick={() => removeGame(idx)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl opacity-0 group-hover:opacity-100 transition-all" title="Delete activity">
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 space-y-6">
                            {/* Generated Game Rule Image */}
                            {gameImages[idx] && (
                                <div className="relative group/img">
                                    <img
                                        src={gameImages[idx]}
                                        alt={`${game.name} - Game Rules`}
                                        className="w-full rounded-xl border border-violet-200 shadow-sm"
                                    />
                                    <button
                                        onClick={() => {
                                            const n = { ...gameImages };
                                            delete n[idx];
                                            onGameImagesChange(n);
                                        }}
                                        className="absolute top-2 right-2 p-1.5 bg-white/80 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg opacity-0 group-hover/img:opacity-100 transition-all shadow-sm no-print"
                                        title="Remove image"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                            <div>
                                <h5 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-1"><Sparkles className="w-3 h-3" /> Instructions</h5>
                                <AutoResizeTextarea
                                    value={game.instructions?.includes('\n') ? game.instructions : (game.instructions || '').replace(/(?!^)(\d+)\.\s/g, '\n$1. ')}
                                    onChange={(e) => handleGameChange(idx, 'instructions', e.target.value)}
                                    className="w-full text-sm text-slate-700 dark:text-slate-400 leading-relaxed bg-slate-50/50 border border-transparent hover:border-slate-200 focus:border-indigo-300 rounded-xl p-3 outline-none transition-all"
                                    minRows={4}
                                />
                            </div>

                            <div>
                                <h5 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-1">📦 Materials</h5>
                                <div className="flex flex-wrap gap-2">
                                    {game.materials.map((m, i) => (
                                        <div key={i} className="flex items-center gap-2 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 px-3 py-1.5 rounded-lg group/mat shadow-sm">
                                            <input
                                                value={m}
                                                onChange={(e) => {
                                                    const newMats = [...game.materials];
                                                    newMats[i] = e.target.value;
                                                    handleGameChange(idx, 'materials', newMats);
                                                }}
                                                className="text-[11px] font-semibold text-slate-700 dark:text-slate-400 bg-transparent border-none outline-none focus:text-indigo-600 min-w-[50px] w-fit"
                                            />
                                            <button
                                                onClick={() => {
                                                    const newMats = game.materials.filter((_, mi) => mi !== i);
                                                    handleGameChange(idx, 'materials', newMats);
                                                }}
                                                className="text-slate-300 hover:text-red-500 opacity-0 group-hover/mat:opacity-100 transition-opacity no-print"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        onClick={() => handleGameChange(idx, 'materials', [...game.materials, "New Material"])}
                                        className="p-1.5 border border-dashed border-slate-300 rounded-lg text-slate-400 hover:text-indigo-500 hover:border-indigo-300 hover:bg-indigo-50 transition-all no-print flex items-center justify-center gap-1"
                                    >
                                        <Plus className="w-3 h-3" /><span className="text-[10px] font-bold pr-1">Add</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
});
