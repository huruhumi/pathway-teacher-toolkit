import React from 'react';
import { Info, MapPin, Target, X, Plus, GripVertical, Trash2, BookOpen, Lightbulb, Layout, Wand2, Loader2 } from 'lucide-react';
import { RichTextEditor } from '../RichTextEditor';
import { RoadmapItem } from '../../types';
import { BasicInfoState } from '../../stores/useLessonStore';
import { useLanguage } from '../../i18n/LanguageContext';

interface TabRoadmapProps {
    basicInfo: BasicInfoState;
    missionBriefing: { title: string; narrative: string };
    roadmap: RoadmapItem[];
    draggedRoadmapIndex: number | null;
    generatingExtraFor: { roadmapIndex: number; type: 'info' | 'tip' } | null;
    generatingStepFor: number | null;
    isAddingRoadmapItem: boolean;

    // Handlers
    handleBasicInfoChange: (field: string, value: string) => void;
    setMissionBriefing: React.Dispatch<React.SetStateAction<{ title: string; narrative: string }>> | ((mb: { title: string; narrative: string } | ((prev: { title: string; narrative: string }) => { title: string; narrative: string })) => void);
    handleGoalChange: (index: number, value: string) => void;
    addGoal: () => void;
    removeGoal: (index: number) => void;
    handleRoadmapChange: (index: number, field: keyof RoadmapItem, value: string) => void;
    removeRoadmapItem: (index: number) => void;
    addRoadmapItem: () => void;
    handleBackgroundInfoChange: (roadmapIndex: number, infoIndex: number, value: string) => void;
    addBackgroundInfoItem: (roadmapIndex: number) => void;
    removeBackgroundInfoItem: (roadmapIndex: number, infoIndex: number) => void;
    handleTeachingTipsChange: (roadmapIndex: number, tipIndex: number, value: string) => void;
    addTeachingTipsItem: (roadmapIndex: number) => void;
    removeTeachingTipsItem: (roadmapIndex: number, tipIndex: number) => void;
    handleStepChange: (roadmapIndex: number, stepIndex: number, value: string) => void;
    removeStep: (roadmapIndex: number, stepIndex: number) => void;
    handleAddStep: (roadmapIndex: number) => void;
    handleDragStart: (e: React.DragEvent, itemIndex: number, stepIndex: number) => void;
    handleDragOver: (e: React.DragEvent, itemIndex: number, stepIndex: number) => void;
    handleDrop: (e: React.DragEvent, targetItemIndex: number, targetStepIndex: number) => void;
    handleRoadmapDragStart: (e: React.DragEvent, index: number) => void;
    handleRoadmapDragOver: (e: React.DragEvent) => void;
    handleRoadmapDrop: (e: React.DragEvent, targetIndex: number) => void;
}

export const TabRoadmap: React.FC<TabRoadmapProps> = ({
    basicInfo,
    missionBriefing,
    roadmap,
    draggedRoadmapIndex,
    generatingExtraFor,
    generatingStepFor,
    isAddingRoadmapItem,
    handleBasicInfoChange,
    setMissionBriefing,
    handleGoalChange,
    addGoal,
    removeGoal,
    handleRoadmapChange,
    removeRoadmapItem,
    addRoadmapItem,
    handleBackgroundInfoChange,
    addBackgroundInfoItem,
    removeBackgroundInfoItem,
    handleTeachingTipsChange,
    addTeachingTipsItem,
    removeTeachingTipsItem,
    handleStepChange,
    removeStep,
    handleAddStep,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleRoadmapDragStart,
    handleRoadmapDragOver,
    handleRoadmapDrop
}) => {
    const { t } = useLanguage();
    return (
        <div className="space-y-5 animate-fade-in">
            <div className="bg-white dark:bg-slate-900/80 dark:backdrop-blur-xl rounded-xl border border-slate-200 dark:border-white/5 p-4 shadow-sm">
                <h3 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <Info size={18} className="text-emerald-600" />
                    {t('road.workshopDetails')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">{t('road.theme')}</label>
                        <input
                            value={basicInfo.theme}
                            onChange={(e) => handleBasicInfoChange('theme', e.target.value)}
                            className="w-full font-semibold text-slate-800 border-b border-slate-200 focus:border-emerald-500 outline-none py-1 bg-transparent"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">{t('road.activityType')}</label>
                        <input
                            value={basicInfo.activityType}
                            onChange={(e) => handleBasicInfoChange('activityType', e.target.value)}
                            className="w-full font-semibold text-slate-800 border-b border-slate-200 focus:border-emerald-500 outline-none py-1 bg-transparent"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">{t('road.targetAudience')}</label>
                        <input
                            value={basicInfo.targetAudience}
                            onChange={(e) => handleBasicInfoChange('targetAudience', e.target.value)}
                            className="w-full font-semibold text-slate-800 border-b border-slate-200 focus:border-emerald-500 outline-none py-1 bg-transparent"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">{t('road.location')}</label>
                        <div className="flex items-center gap-2">
                            <MapPin size={16} className="text-emerald-500" />
                            <input
                                value={basicInfo.location || ''}
                                onChange={(e) => handleBasicInfoChange('location', e.target.value)}
                                className="flex-1 font-semibold text-slate-800 border-b border-slate-200 focus:border-emerald-500 outline-none py-1 bg-transparent"
                            />
                        </div>
                    </div>
                </div>

                <div className="mb-4">
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">{t('road.introContext')}</label>
                    <RichTextEditor
                        value={missionBriefing.narrative}
                        onChange={(html) => (setMissionBriefing as any)(prev => ({ ...prev, narrative: html }))}
                        placeholder="Enter mission briefing narrative..."
                        className="font-medium text-slate-700 border-b border-slate-200 py-1 bg-transparent"
                        rows={2}
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">{t('road.learningGoals')}</label>
                    <div className="space-y-2">
                        {basicInfo.learningGoals.map((goal, i) => (
                            <div key={i} className="flex items-center gap-2 group">
                                <Target size={16} className="text-emerald-500" />
                                <input
                                    value={goal}
                                    onChange={(e) => handleGoalChange(i, e.target.value)}
                                    className="flex-1 text-sm text-slate-700 border-b border-transparent hover:border-slate-200 focus:border-emerald-500 outline-none py-1 bg-transparent"
                                />
                                <button onClick={() => removeGoal(i)} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity">
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                        <button onClick={addGoal} className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 mt-2">
                            <Plus size={14} /> {t('road.addGoal')}</button>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                {roadmap.map((item, idx) => (
                    <div
                        key={idx}
                        draggable
                        onDragStart={(e) => handleRoadmapDragStart(e, idx)}
                        onDragOver={handleRoadmapDragOver}
                        onDrop={(e) => handleRoadmapDrop(e, idx)}
                        className={`bg-white dark:bg-slate-900/80 rounded-xl border transition-all ${draggedRoadmapIndex === idx ? 'border-emerald-400 shadow-lg opacity-50' : 'border-slate-200 dark:border-white/5 hover:border-emerald-300 shadow-sm'}`}
                    >
                        <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-start gap-3 rounded-t-xl cursor-grab active:cursor-grabbing group">
                            <div className="mt-1 text-slate-400 group-hover:text-slate-600">
                                <GripVertical size={16} />
                            </div>
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4">
                                <div className="md:col-span-2">
                                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">{t('road.time')}</label>
                                    <input
                                        value={item.timeRange}
                                        onChange={(e) => handleRoadmapChange(idx, 'timeRange', e.target.value)}
                                        className="w-full text-sm font-bold text-emerald-700 bg-emerald-50/50 border border-transparent hover:border-emerald-200 rounded px-2 py-1 outline-none"
                                    />
                                </div>
                                <div className="md:col-span-4">
                                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">{t('road.phase')}</label>
                                    <input
                                        value={item.phase}
                                        onChange={(e) => handleRoadmapChange(idx, 'phase', e.target.value)}
                                        className="w-full font-bold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-emerald-500 outline-none"
                                    />
                                </div>
                                <div className="md:col-span-6">
                                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">{t('road.activityName')}</label>
                                    <input
                                        value={item.activity}
                                        onChange={(e) => handleRoadmapChange(idx, 'activity', e.target.value)}
                                        className="w-full font-bold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-emerald-500 outline-none"
                                    />
                                </div>
                            </div>
                            <button onClick={() => removeRoadmapItem(idx)} className="text-slate-400 hover:text-red-500 p-1">
                                <Trash2 size={16} />
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">{t('road.description')}</label>
                                    <textarea
                                        value={item.description}
                                        onChange={(e) => handleRoadmapChange(idx, 'description', e.target.value)}
                                        rows={2}
                                        className="w-full text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
                                    />
                                </div>
                                <div>
                                    <div className="grid grid-cols-2 gap-3 mb-3">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">{t('road.type')}</label>
                                            <input
                                                value={item.activityType}
                                                onChange={(e) => handleRoadmapChange(idx, 'activityType', e.target.value)}
                                                className="w-full text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded px-2 py-1"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">{t('road.location')}</label>
                                            <input
                                                value={item.location}
                                                onChange={(e) => handleRoadmapChange(idx, 'location', e.target.value)}
                                                className="w-full text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded px-2 py-1"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">{t('road.objective')}</label>
                                        <input
                                            value={item.learningObjective}
                                            onChange={(e) => handleRoadmapChange(idx, 'learningObjective', e.target.value)}
                                            className="w-full text-xs italic text-slate-500 border-b border-slate-200 focus:border-emerald-500 outline-none pb-1 bg-transparent"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-blue-50 rounded-lg p-2.5 border border-blue-100">
                                <label className="block text-xs font-bold text-blue-500 uppercase mb-2 flex items-center gap-1">
                                    <BookOpen size={12} /> {t('road.backgroundInfo')}</label>
                                <div className="space-y-2">
                                    {(item.backgroundInfo && item.backgroundInfo.length > 0) ? item.backgroundInfo.map((info, infoIdx) => (
                                        <div key={infoIdx} className="flex items-start gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2 flex-shrink-0" />
                                            <textarea
                                                value={info}
                                                onChange={(e) => handleBackgroundInfoChange(idx, infoIdx, e.target.value)}
                                                className="flex-1 text-sm text-blue-900 bg-transparent border-b border-transparent focus:border-blue-300 outline-none resize-none"
                                                rows={1}
                                                style={{ minHeight: '1.5em', height: 'auto' }}
                                                onInput={(e) => { e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px'; }}
                                            />
                                            <button onClick={() => removeBackgroundInfoItem(idx, infoIdx)} className="text-blue-300 hover:text-red-500">
                                                <X size={14} />
                                            </button>
                                        </div>
                                    )) : <div className="text-sm text-blue-300 italic px-2">{t('fc.noImage') || 'No info'}</div>}
                                </div>
                                <div className="flex justify-end mt-2">
                                    <button
                                        onClick={() => addBackgroundInfoItem(idx)}
                                        disabled={generatingExtraFor?.roadmapIndex === idx && generatingExtraFor?.type === 'info'}
                                        className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                    >
                                        {generatingExtraFor?.roadmapIndex === idx && generatingExtraFor?.type === 'info' ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                                        {t('road.addBgInfo')}</button>
                                </div>
                            </div>

                            <div className="bg-purple-50 rounded-lg p-2.5 border border-purple-100">
                                <label className="block text-xs font-bold text-purple-500 uppercase mb-2 flex items-center gap-1">
                                    <Lightbulb size={12} /> {t('road.teachingTips')}</label>
                                <div className="space-y-2">
                                    {(item.teachingTips && item.teachingTips.length > 0) ? item.teachingTips.map((tip, tipIdx) => (
                                        <div key={tipIdx} className="flex items-start gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-2 flex-shrink-0" />
                                            <textarea
                                                value={tip}
                                                onChange={(e) => handleTeachingTipsChange(idx, tipIdx, e.target.value)}
                                                className="flex-1 text-sm text-purple-900 bg-transparent border-b border-transparent focus:border-purple-300 outline-none resize-none"
                                                rows={1}
                                                style={{ minHeight: '1.5em', height: 'auto' }}
                                                onInput={(e) => { e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px'; }}
                                            />
                                            <button onClick={() => removeTeachingTipsItem(idx, tipIdx)} className="text-purple-300 hover:text-red-500">
                                                <X size={14} />
                                            </button>
                                        </div>
                                    )) : <div className="text-sm text-purple-300 italic px-2">No teaching suggestions.</div>}
                                </div>
                                <div className="flex justify-end mt-2">
                                    <button
                                        onClick={() => addTeachingTipsItem(idx)}
                                        disabled={generatingExtraFor?.roadmapIndex === idx && generatingExtraFor?.type === 'tip'}
                                        className="text-xs font-semibold text-purple-600 hover:text-purple-800 flex items-center gap-1"
                                    >
                                        {generatingExtraFor?.roadmapIndex === idx && generatingExtraFor?.type === 'tip' ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                                        {t('road.addTip')}</button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-2">
                                    <Layout size={14} /> {t('road.teacherInstructions')}</label>
                                <div className="space-y-2">
                                    {item.steps.map((step, sIdx) => (
                                        <div
                                            key={sIdx}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, idx, sIdx)}
                                            onDragOver={(e) => handleDragOver(e, idx, sIdx)}
                                            onDrop={(e) => handleDrop(e, idx, sIdx)}
                                            className="flex items-start gap-3 group p-2 rounded hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-colors"
                                        >
                                            <div className="mt-1 cursor-grab text-slate-300 hover:text-slate-500">
                                                <GripVertical size={16} />
                                            </div>
                                            <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                                                {sIdx + 1}
                                            </div>
                                            <div className="flex-1">
                                                <textarea
                                                    value={step}
                                                    onChange={(e) => handleStepChange(idx, sIdx, e.target.value)}
                                                    rows={1}
                                                    className="w-full text-sm text-slate-700 bg-transparent border-none outline-none resize-none overflow-hidden focus:ring-0 p-0"
                                                    style={{ minHeight: '1.5em', height: 'auto' }}
                                                    onInput={(e) => {
                                                        e.currentTarget.style.height = 'auto';
                                                        e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
                                                    }}
                                                />
                                            </div>
                                            <button onClick={() => removeStep(idx, sIdx)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-opacity">
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    onClick={() => handleAddStep(idx)}
                                    disabled={generatingStepFor === idx}
                                    className="mt-3 text-sm font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-2 px-2 py-1 rounded hover:bg-emerald-50 transition-colors"
                                >
                                    {generatingStepFor === idx ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                                    {t('road.generateStep')}</button>
                            </div>
                        </div>
                    </div>
                ))}

                <button
                    onClick={addRoadmapItem}
                    disabled={isAddingRoadmapItem}
                    className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 font-semibold hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all flex items-center justify-center gap-2"
                >
                    {isAddingRoadmapItem ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
                    {t('road.addPhaseBtn')}</button>
            </div>
        </div>
    );
};
