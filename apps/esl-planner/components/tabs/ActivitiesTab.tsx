import React, { useState } from 'react';
import { Game, StructuredLessonPlan, CEFRLevel } from '../../types';
import { generateSingleGame } from '../../services/geminiService';
import { Sparkles, Loader2, Bot, CheckSquare, Gamepad2, Trash2, Plus, X, ExternalLink, Download } from 'lucide-react';

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

const skills = [
    "Random", "Vocabulary", "Grammar", "Phonics", "Reading", "Listening", "Speaking",
    "Writing", "Pronunciation", "Critical Thinking", "Idioms & Slang",
    "Presentation Skills", "Culture & Etiquette", "Problem Solving", "Social English"
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
    openViewer: (tabId: string, subTabId?: string) => void;
    handleDownloadGamesMd: () => void;
}

export const ActivitiesTab: React.FC<ActivitiesTabProps> = ({
    editableGames,
    setEditableGames,
    editablePlan,
    openViewer,
    handleDownloadGamesMd
}) => {
    const [isGeneratingGame, setIsGeneratingGame] = useState(false);
    const [gameFilterSkill, setGameFilterSkill] = useState('Random');
    const [gameFilterType, setGameFilterType] = useState('Random');

    const handleGameChange = (index: number, field: keyof Game, value: any) => {
        const newGames = [...editableGames];
        newGames[index] = { ...newGames[index], [field]: value };
        setEditableGames(newGames);
    };

    const toggleGameCompletion = (index: number) => {
        const newGames = [...editableGames];
        newGames[index] = { ...newGames[index], isCompleted: !newGames[index].isCompleted };
        setEditableGames(newGames);
    };

    const removeGame = (index: number) => {
        setEditableGames(editableGames.filter((_, i) => i !== index));
    };

    const handleGenerateNewGame = async () => {
        if (!editablePlan || isGeneratingGame) return;
        setIsGeneratingGame(true);
        try {
            let finalSkill = gameFilterSkill;
            let finalType = gameFilterType;
            if (finalSkill === 'Random') {
                const availableSkills = skills.filter(s => s !== 'Random');
                finalSkill = availableSkills[Math.floor(Math.random() * availableSkills.length)];
            }
            if (finalType === 'Random') {
                const availableTypes = gameTypes.filter(t => t !== 'Random');
                finalType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
            }
            const newGame = await generateSingleGame(
                editablePlan.classInformation.level as CEFRLevel,
                editablePlan.classInformation.topic,
                finalSkill,
                finalType,
                JSON.stringify(editablePlan.lessonDetails)
            );
            setEditableGames([...editableGames, { ...newGame, isCompleted: false }]);
        } catch (e) {
            console.error("Failed to generate new game", e);
        } finally {
            setIsGeneratingGame(false);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h3 className="text-xl font-bold text-gray-800">Classroom Games & Activities</h3>
                <div className="flex gap-2 no-print">
                    <button onClick={() => openViewer('games')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-sm font-bold shadow-sm">
                        <ExternalLink className="w-4 h-4" /> Print View
                    </button>
                    <button onClick={handleDownloadGamesMd} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all text-sm font-bold shadow-sm">
                        <Download className="w-4 h-4" /> Download MD
                    </button>
                </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-indigo-100 shadow-sm no-print">
                <h4 className="text-sm font-black text-indigo-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-500" />
                    Generate New Activity
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Focus Skill</label>
                        <select
                            value={gameFilterSkill}
                            onChange={(e) => setGameFilterSkill(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                            {skills.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Game Style</label>
                        <select
                            value={gameFilterType}
                            onChange={(e) => setGameFilterType(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                            {gameTypes.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={handleGenerateNewGame}
                            disabled={isGeneratingGame}
                            className="w-full h-[46px] bg-indigo-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-md disabled:opacity-50"
                        >
                            {isGeneratingGame ? <Loader2 className="w-5 h-5 animate-spin" /> : <Bot className="w-5 h-5" />}
                            Generate Smart Activity
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {editableGames.map((game, idx) => (
                    <div key={idx} className={`bg-white border-2 rounded-[2rem] p-8 shadow-sm hover:shadow-md transition-all flex flex-col h-full group relative ${game.isCompleted ? 'border-green-200 opacity-70' : 'border-indigo-50 hover:border-indigo-200'}`}>
                        <button onClick={() => removeGame(idx)} className="absolute top-4 right-4 p-2 bg-gray-50 text-gray-300 hover:text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-all no-print">
                            <Trash2 className="w-4 h-4" />
                        </button>
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex-1 mr-4">
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="bg-indigo-100 text-indigo-700 text-[10px] font-black px-2 py-1 rounded uppercase tracking-wider">{game.type}</span>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{game.interactionType}</span>
                                </div>
                                <input
                                    value={game.name}
                                    onChange={(e) => handleGameChange(idx, 'name', e.target.value)}
                                    className="text-2xl font-black text-gray-800 bg-transparent border-none outline-none focus:ring-1 focus:ring-indigo-100 rounded w-full"
                                />
                            </div>
                            <button
                                onClick={() => toggleGameCompletion(idx)}
                                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-sm shrink-0 no-print ${game.isCompleted ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400 hover:bg-indigo-500 hover:text-white'}`}
                                title={game.isCompleted ? "Mark as Incomplete" : "Mark as Planned"}
                            >
                                {game.isCompleted ? <CheckSquare className="w-6 h-6" /> : <Gamepad2 className="w-6 h-6" />}
                            </button>
                        </div>

                        <div className="flex-1 space-y-6">
                            <div>
                                <h5 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3">Implementation Steps</h5>
                                <AutoResizeTextarea
                                    value={game.instructions}
                                    onChange={(e) => handleGameChange(idx, 'instructions', e.target.value)}
                                    className="w-full text-sm text-gray-700 leading-relaxed bg-gray-50/30 border-none rounded-xl p-4 outline-none focus:bg-white focus:ring-1 focus:ring-indigo-100 transition-all"
                                    minRows={4}
                                />
                            </div>

                            <div>
                                <h5 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3">Required Materials</h5>
                                <div className="flex flex-wrap gap-2">
                                    {game.materials.map((m, i) => (
                                        <div key={i} className="flex items-center gap-2 bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-xl group/mat">
                                            <input
                                                value={m}
                                                onChange={(e) => {
                                                    const newMats = [...game.materials];
                                                    newMats[i] = e.target.value;
                                                    handleGameChange(idx, 'materials', newMats);
                                                }}
                                                className="text-[10px] font-bold text-gray-600 bg-transparent border-none outline-none focus:ring-1 focus:ring-indigo-100 min-w-[50px] w-fit"
                                            />
                                            <button
                                                onClick={() => {
                                                    const newMats = game.materials.filter((_, mi) => mi !== i);
                                                    handleGameChange(idx, 'materials', newMats);
                                                }}
                                                className="text-gray-300 hover:text-red-500 opacity-0 group-hover/mat:opacity-100 transition-opacity no-print"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        onClick={() => handleGameChange(idx, 'materials', [...game.materials, "New Material"])}
                                        className="p-1.5 border border-dashed border-indigo-200 rounded-xl text-indigo-400 hover:bg-indigo-50 transition-all no-print"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
