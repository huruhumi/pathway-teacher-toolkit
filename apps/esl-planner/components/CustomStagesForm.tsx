import React, { useState } from 'react';
import { Loader2, Wand2, ChevronDown, ChevronUp, Trash2, Plus } from 'lucide-react';
import { CustomStageInput } from '../types';
import { analyzeVideoWithGemini } from '../services/gemini/videoAnalyzer';
import { AutoResizeTextarea } from './common/AutoResizeTextarea';

interface CustomStagesFormProps {
    customStages: CustomStageInput[];
    onChange: (stages: CustomStageInput[]) => void;
    topic?: string;
}

export const DEFAULT_PPP_STAGES = [
    "WARM-UP & REVIEW",
    "PRESENTATION",
    "CONTROLLED PRACTICE",
    "FREER PRACTICE & PRODUCTION",
    "WRAP-UP & ASSESSMENT"
];

export const CustomStagesForm: React.FC<CustomStagesFormProps> = ({ customStages, onChange, topic }) => {
    const [analyzingStage, setAnalyzingStage] = useState<number | null>(null);
    const [expandedStages, setExpandedStages] = useState<Record<number, boolean>>({
        0: true, 1: true, 2: true, 3: true, 4: true
    });

    const handleUpdate = (index: number, field: keyof CustomStageInput, value: string) => {
        const next = [...customStages];
        next[index] = { ...next[index], [field]: value };
        onChange(next);
    };

    const handleAnalyze = async (index: number) => {
        const url = customStages[index].videoUrl;
        const name = customStages[index].videoName;
        if (!url) return;

        setAnalyzingStage(index);
        try {
            const script = await analyzeVideoWithGemini(url, topic, name);
            handleUpdate(index, 'videoContent', script);
        } catch (error) {
            console.error(error);
            alert("Video analysis failed. Please manually enter the lyrics or script.");
        } finally {
            setAnalyzingStage(null);
        }
    };

    const toggleExpand = (index: number) => {
        setExpandedStages(prev => ({ ...prev, [index]: !prev[index] }));
    };

    const handleAddStage = () => {
        const newIndex = customStages.length;
        onChange([...customStages, { stageName: `CUSTOM STAGE ${newIndex + 1}`, description: '' }]);
        setExpandedStages(prev => ({ ...prev, [newIndex]: true }));
    };

    const handleRemoveStage = (index: number) => {
        const next = [...customStages];
        next.splice(index, 1);
        onChange(next);

        const nextExpanded: Record<number, boolean> = {};
        for (let i = 0; i < next.length; i++) {
            nextExpanded[i] = i >= index ? expandedStages[i + 1] : expandedStages[i];
        }
        setExpandedStages(nextExpanded);
    };

    return (
        <div className="space-y-4">
            <p className="text-sm text-gray-500 mb-2">
                Provide detailed instructions for each stage. The AI will strictly follow these when generating the lesson plan.
            </p>
            {customStages.map((stage, index) => {
                const isExpanded = expandedStages[index];
                return (
                    <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 overflow-hidden">
                        <div
                            className="bg-gray-50 dark:bg-gray-900 px-4 py-3 flex justify-between items-center select-none"
                        >
                            <div className="flex-1 flex items-center gap-2 mr-4">
                                <span
                                    className="font-semibold text-gray-500 cursor-pointer"
                                    onClick={() => toggleExpand(index)}
                                >
                                    {index + 1}.
                                </span>
                                <input
                                    type="text"
                                    value={stage.stageName}
                                    onChange={(e) => handleUpdate(index, 'stageName', e.target.value)}
                                    placeholder="Stage Name"
                                    className="flex-1 bg-transparent border-0 border-b border-transparent focus:border-indigo-500 focus:ring-0 px-0 py-0 font-semibold text-gray-800 dark:text-gray-200 placeholder-gray-400"
                                />
                            </div>
                            <div className="flex items-center gap-3">
                                {customStages.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); handleRemoveStage(index); }}
                                        className="text-gray-400 hover:text-red-500 transition-colors cursor-pointer p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700"
                                        title="Remove stage"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                                <div onClick={() => toggleExpand(index)} className="cursor-pointer p-1">
                                    {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                                </div>
                            </div>
                        </div>

                        {isExpanded && (
                            <div className="px-4 py-4 space-y-4">
                                {/* Required Description */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Stage Description <span className="text-red-500">*</span>
                                    </label>
                                    <AutoResizeTextarea
                                        value={stage.description}
                                        onChange={(e) => handleUpdate(index, 'description', e.target.value)}
                                        placeholder={`E.g. Briefly describe what will happen in ${stage.stageName}...`}
                                        className="w-full px-3 py-2 text-sm leading-relaxed rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        minRows={2}
                                    />
                                </div>

                                {/* Activity Design */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Activity Design <span className="text-gray-400 font-normal">(Optional)</span>
                                    </label>
                                    <AutoResizeTextarea
                                        value={stage.activityDesign || ''}
                                        onChange={(e) => handleUpdate(index, 'activityDesign', e.target.value)}
                                        placeholder="Specific activity rules, groupings, or games..."
                                        className="w-full px-3 py-2 text-sm leading-relaxed rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        minRows={2}
                                    />
                                </div>

                                {/* Video Area */}
                                <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700 space-y-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">Multimedia / Video Integration</h5>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                            <input
                                                type="text"
                                                value={stage.videoName || ''}
                                                onChange={(e) => handleUpdate(index, 'videoName', e.target.value)}
                                                placeholder="Video Name (e.g. Hello Song)"
                                                className="w-full px-3 py-2 text-sm rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={stage.videoUrl || ''}
                                                onChange={(e) => handleUpdate(index, 'videoUrl', e.target.value)}
                                                placeholder="YouTube URL"
                                                className="flex-1 px-3 py-2 text-sm rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleAnalyze(index)}
                                                disabled={!stage.videoUrl || analyzingStage === index}
                                                className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                                            >
                                                {analyzingStage === index ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Wand2 className="w-4 h-4" />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                                            Video Content / Script (Lyrics, key dialogue, etc.)
                                        </label>
                                        <AutoResizeTextarea
                                            value={stage.videoContent || ''}
                                            onChange={(e) => handleUpdate(index, 'videoContent', e.target.value)}
                                            placeholder="Paste the lyrics here or use the Magic Wand to extract from URL..."
                                            className="w-full px-3 py-2 text-sm leading-relaxed rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white font-mono text-xs"
                                            minRows={3}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}

            <button
                type="button"
                onClick={handleAddStage}
                className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-500 dark:text-gray-400 hover:border-indigo-500 hover:text-indigo-600 dark:hover:border-indigo-400 dark:hover:text-indigo-400 transition-colors flex items-center justify-center gap-2 bg-gray-50/50 dark:bg-gray-800/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
            >
                <Plus className="w-4 h-4" />
                Add Stage
            </button>
        </div>
    );
};
