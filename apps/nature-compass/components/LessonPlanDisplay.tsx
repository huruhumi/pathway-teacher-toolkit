import React, { useState, useEffect, useCallback } from 'react';
import { LessonPlanResponse, RoadmapItem, VocabularyItem, VisualReferenceItem } from '../types';
import { Clipboard, Check, Box, BookOpen, ImageIcon, FileText, BadgeCheck, Printer, Loader2, Sparkles, Download, Compass, Languages, ChevronDown, Share2, Save, X } from 'lucide-react';
import { generateSingleStep, generateImagePrompt, generateImage, generateVocabularyItem, generateVisualReferenceItem, generateRoadmapItem, generateBadgePrompt, generateSingleBackgroundInfo, generateSingleTeachingTip } from '../services/geminiService';
import { useLessonStore } from '../stores/useLessonStore';
import { useLanguage } from '../i18n/LanguageContext';
import { RichTextEditor } from './RichTextEditor';
import { usePrintUtils } from '../hooks/usePrintUtils';

// Tab Components
import { TabRoadmap } from './tabs/TabRoadmap';
import { TabSupplies } from './tabs/TabSupplies';
import { TabFlashcards } from './tabs/TabFlashcards';
import { TabVisuals } from './tabs/TabVisuals';
import { TabHandbook } from './tabs/TabHandbook';
import { TabBadge } from './tabs/TabBadge';

// Utils
import { sanitizeFilename, downloadImage } from '../utils/fileHelpers';

interface LessonPlanDisplayProps {
    plan: LessonPlanResponse;
    onSave?: (plan: LessonPlanResponse, coverImage?: string | null) => void;
}

type Tab = 'roadmap' | 'supplies' | 'flashcards' | 'visuals' | 'handbook' | 'badge';

export const LessonPlanDisplay: React.FC<LessonPlanDisplayProps> = ({ plan, onSave }) => {
    const [activeTab, setActiveTab] = useState<Tab>('roadmap');
    const { t, lang } = useLanguage();
    const [copiedNotebook, setCopiedNotebook] = useState(false);
    const [copiedStylePrompt, setCopiedStylePrompt] = useState(false);
    const [copiedImagePrompt, setCopiedImagePrompt] = useState<number | null>(null);
    const [copiedContentPrompt, setCopiedContentPrompt] = useState<number | null>(null);
    const [isSaved, setIsSaved] = useState(false);

    // Image Zoom State
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);

    // --- Zustand Store ---
    const {
        roadmap, setRoadmap,
        basicInfo, setBasicInfo,
        missionBriefing, setMissionBriefing,
        durationDisplay, setDurationDisplay,
        supplies, setSupplies,
        safetyProtocol, setSafetyProtocol,
        vocabList, setVocabList,
        visualRefs, setVisualRefs,
        handbookPages, setHandbookPages,
        displayLanguage, setDisplayLanguage,
        translatedPlan, setTranslatedPlan,
        badgeImage, setBadgeImage,
        loadingBadge, setLoadingBadge,
        badgePrompt, setBadgePrompt,
        generatedImages, setGeneratedImages,
        loadingImages, setLoadingImages,
        artStyles, setArtStyles,
        isAddingWord, setIsAddingWord,
        generatedVisuals, setGeneratedVisuals,
        loadingVisuals, setLoadingVisuals,
        visualStyles, setVisualStyles,
        isAddingVisual, setIsAddingVisual,
        generatingStepFor, setGeneratingStepFor,
        isAddingRoadmapItem, setIsAddingRoadmapItem,
        generatingExtraFor, setGeneratingExtraFor,
        draggedStep, setDraggedStep,
        draggedRoadmapIndex, setDraggedRoadmapIndex,
        applyPlanToState,
        resetAssets,
    } = useLessonStore();

    const { handleDownloadFlashcard, handleDownloadAllFlashcards, handlePrint } = usePrintUtils(activeTab, t);

    // Sync state if prop changes (e.g. re-generation)
    useEffect(() => {
        applyPlanToState(plan);
        setDisplayLanguage('en');
        // Extract the pre-translated plan if it exists
        setTranslatedPlan(plan.translatedPlan || null);

        // Reset generated assets only when the base plan changes
        resetAssets();
        setBadgePrompt(`A circular merit badge sticker for: "${plan.basicInfo.theme}". Vector style, simple icon, white background, high quality.`);

    }, [plan]);

    // Language Toggle Handler
    const handleLanguageToggle = () => {
        if (displayLanguage === 'en') {
            if (translatedPlan) {
                applyPlanToState(translatedPlan);
                setDisplayLanguage('zh');
            } else {
                alert("Chinese translation is not available for this plan.");
            }
        } else {
            applyPlanToState(plan);
            setDisplayLanguage('en');
        }
    };

    // --- Handlers ---



    const handleSaveClick = () => {
        if (!onSave) return;

        const currentPlan: LessonPlanResponse = {
            ...plan,
            missionBriefing: missionBriefing,
            basicInfo: basicInfo,
            roadmap: roadmap,
            supplies: supplies,
            safetyProtocol: safetyProtocol,
            vocabulary: {
                ...plan.vocabulary,
                keywords: vocabList
            },
            visualReferences: visualRefs,
            handbookStylePrompt: plan.handbookStylePrompt,
            handbook: handbookPages,
            translatedPlan: plan.translatedPlan,
        };
        onSave(currentPlan, badgeImage);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
    };

    const handleGenerateBadge = async () => {
        setLoadingBadge(true);
        try {
            // Use user edited prompt directly
            const image = await generateImage(badgePrompt, "1:1");
            setBadgeImage(image);
        } catch (e) {
            console.error("Badge generation failed", e);
        } finally {
            setLoadingBadge(false);
        }
    };

    // Basic Info Handlers
    const handleBasicInfoChange = useCallback((field: string, value: string) => {
        setBasicInfo(prev => ({ ...prev, [field]: value }));
    }, [setBasicInfo]);

    const addGoal = useCallback(() => {
        setBasicInfo(prev => ({ ...prev, learningGoals: [...prev.learningGoals, "New Learning Goal"] }));
    }, [setBasicInfo]);

    const handleGoalChange = useCallback((index: number, value: string) => {
        setBasicInfo(prev => {
            const newGoals = [...prev.learningGoals];
            newGoals[index] = value;
            return { ...prev, learningGoals: newGoals };
        });
    }, [setBasicInfo]);

    const removeGoal = useCallback((index: number) => {
        setBasicInfo(prev => ({
            ...prev,
            learningGoals: prev.learningGoals.filter((_, i) => i !== index)
        }));
    }, [setBasicInfo]);

    // Roadmap Handlers
    const handleRoadmapChange = useCallback((index: number, field: keyof RoadmapItem, value: string) => {
        setRoadmap(prev => {
            const newRoadmap = [...prev];
            newRoadmap[index] = { ...newRoadmap[index], [field]: value };
            return newRoadmap;
        });
    }, [setRoadmap]);

    const removeRoadmapItem = useCallback((index: number) => {
        setRoadmap(prev => prev.filter((_, i) => i !== index));
    }, [setRoadmap]);

    const addRoadmapItem = async () => {
        setIsAddingRoadmapItem(true);
        try {
            const newItem = await generateRoadmapItem(basicInfo.theme, basicInfo.activityType, roadmap);
            setRoadmap(prev => [...prev, newItem]);
        } catch (e) {
            console.error(e);
            setRoadmap(prev => [...prev, {
                timeRange: "00-15m",
                phase: "New Phase",
                activity: "New Activity",
                activityType: "General",
                location: "Classroom",
                description: "Brief description...",
                learningObjective: "Objective",
                steps: ["Step 1"],
                backgroundInfo: ["Background info"],
                teachingTips: ["Teaching tip"]
            }]);
        } finally {
            setIsAddingRoadmapItem(false);
        }
    };

    // Background Info Handlers
    const handleBackgroundInfoChange = (roadmapIndex: number, infoIndex: number, value: string) => {
        setRoadmap(prev => {
            const newRoadmap = [...prev];
            const newInfos = [...(newRoadmap[roadmapIndex].backgroundInfo || [])];
            newInfos[infoIndex] = value;
            newRoadmap[roadmapIndex] = { ...newRoadmap[roadmapIndex], backgroundInfo: newInfos };
            return newRoadmap;
        });
    };

    const addBackgroundInfoItem = async (roadmapIndex: number) => {
        setGeneratingExtraFor({ roadmapIndex, type: 'info' });
        try {
            const item = roadmap[roadmapIndex];
            const newInfo = await generateSingleBackgroundInfo(basicInfo.theme, item.activity, item.backgroundInfo);
            setRoadmap(prev => {
                const newRoadmap = [...prev];
                newRoadmap[roadmapIndex] = {
                    ...newRoadmap[roadmapIndex],
                    backgroundInfo: [...(newRoadmap[roadmapIndex].backgroundInfo || []), newInfo]
                };
                return newRoadmap;
            });
        } catch (e) {
            setRoadmap(prev => {
                const newRoadmap = [...prev];
                newRoadmap[roadmapIndex] = {
                    ...newRoadmap[roadmapIndex],
                    backgroundInfo: [...(newRoadmap[roadmapIndex].backgroundInfo || []), "New background info"]
                };
                return newRoadmap;
            });
        } finally {
            setGeneratingExtraFor(null);
        }
    };

    const removeBackgroundInfoItem = (roadmapIndex: number, infoIndex: number) => {
        setRoadmap(prev => {
            const newRoadmap = [...prev];
            newRoadmap[roadmapIndex] = {
                ...newRoadmap[roadmapIndex],
                backgroundInfo: (newRoadmap[roadmapIndex].backgroundInfo || []).filter((_, i) => i !== infoIndex)
            };
            return newRoadmap;
        });
    };

    // Teaching Tips Handlers
    const handleTeachingTipsChange = (roadmapIndex: number, tipIndex: number, value: string) => {
        setRoadmap(prev => {
            const newRoadmap = [...prev];
            const newTips = [...(newRoadmap[roadmapIndex].teachingTips || [])];
            newTips[tipIndex] = value;
            newRoadmap[roadmapIndex] = { ...newRoadmap[roadmapIndex], teachingTips: newTips };
            return newRoadmap;
        });
    };

    const addTeachingTipsItem = async (roadmapIndex: number) => {
        setGeneratingExtraFor({ roadmapIndex, type: 'tip' });
        try {
            const item = roadmap[roadmapIndex];
            const newTip = await generateSingleTeachingTip(basicInfo.theme, item.activity, item.teachingTips);
            setRoadmap(prev => {
                const newRoadmap = [...prev];
                newRoadmap[roadmapIndex] = {
                    ...newRoadmap[roadmapIndex],
                    teachingTips: [...(newRoadmap[roadmapIndex].teachingTips || []), newTip]
                };
                return newRoadmap;
            });
        } catch (e) {
            setRoadmap(prev => {
                const newRoadmap = [...prev];
                newRoadmap[roadmapIndex] = {
                    ...newRoadmap[roadmapIndex],
                    teachingTips: [...(newRoadmap[roadmapIndex].teachingTips || []), "New teaching tip"]
                };
                return newRoadmap;
            });
        } finally {
            setGeneratingExtraFor(null);
        }
    };

    const removeTeachingTipsItem = (roadmapIndex: number, tipIndex: number) => {
        setRoadmap(prev => {
            const newRoadmap = [...prev];
            newRoadmap[roadmapIndex] = {
                ...newRoadmap[roadmapIndex],
                teachingTips: (newRoadmap[roadmapIndex].teachingTips || []).filter((_, i) => i !== tipIndex)
            };
            return newRoadmap;
        });
    };

    // Step Handlers
    const handleStepChange = (roadmapIndex: number, stepIndex: number, value: string) => {
        setRoadmap(prev => {
            const newRoadmap = [...prev];
            const newSteps = [...newRoadmap[roadmapIndex].steps];
            newSteps[stepIndex] = value;
            newRoadmap[roadmapIndex] = { ...newRoadmap[roadmapIndex], steps: newSteps };
            return newRoadmap;
        });
    };

    const removeStep = (roadmapIndex: number, stepIndex: number) => {
        setRoadmap(prev => {
            const newRoadmap = [...prev];
            newRoadmap[roadmapIndex] = {
                ...newRoadmap[roadmapIndex],
                steps: newRoadmap[roadmapIndex].steps.filter((_, i) => i !== stepIndex)
            };
            return newRoadmap;
        });
    };

    const handleAddStep = async (roadmapIndex: number) => {
        setGeneratingStepFor(roadmapIndex);
        try {
            const item = roadmap[roadmapIndex];
            const newStepText = await generateSingleStep(
                { phase: item.phase, activity: item.activity, description: item.description },
                item.steps
            );
            setRoadmap(prev => {
                const newRoadmap = [...prev];
                newRoadmap[roadmapIndex] = {
                    ...newRoadmap[roadmapIndex],
                    steps: [...newRoadmap[roadmapIndex].steps, newStepText]
                };
                return newRoadmap;
            });
        } catch (e) {
            console.error(e);
        } finally {
            setGeneratingStepFor(null);
        }
    };

    const handleDragStart = (e: React.DragEvent, itemIndex: number, stepIndex: number) => {
        setDraggedStep({ itemIndex, stepIndex });
        e.stopPropagation();
    };

    const handleDragOver = (e: React.DragEvent, itemIndex: number, stepIndex: number) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent, targetItemIndex: number, targetStepIndex: number) => {
        e.preventDefault();
        e.stopPropagation();
        if (!draggedStep) return;
        if (draggedStep.itemIndex !== targetItemIndex) return;

        setRoadmap(prev => {
            const newRoadmap = [...prev];
            const steps = [...newRoadmap[targetItemIndex].steps];
            const [movedStep] = steps.splice(draggedStep.stepIndex, 1);
            steps.splice(targetStepIndex, 0, movedStep);
            newRoadmap[targetItemIndex] = { ...newRoadmap[targetItemIndex], steps };
            return newRoadmap;
        });
        setDraggedStep(null);
    };

    const handleRoadmapDragStart = (e: React.DragEvent, index: number) => {
        setDraggedRoadmapIndex(index);
    };

    const handleRoadmapDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleRoadmapDrop = (e: React.DragEvent, targetIndex: number) => {
        e.preventDefault();
        if (draggedRoadmapIndex === null) return;
        if (draggedRoadmapIndex === targetIndex) {
            setDraggedRoadmapIndex(null);
            return;
        }

        setRoadmap(prev => {
            const newRoadmap = [...prev];
            const [movedItem] = newRoadmap.splice(draggedRoadmapIndex, 1);
            newRoadmap.splice(targetIndex, 0, movedItem);
            return newRoadmap;
        });
        setDraggedRoadmapIndex(null);
    };

    const handleSupplyChange = useCallback((type: 'permanent' | 'consumables', index: number, value: string) => {
        setSupplies(prev => {
            const newList = [...prev[type]];
            newList[index] = value;
            return { ...prev, [type]: newList };
        });
    }, [setSupplies]);

    const addSupplyItem = useCallback((type: 'permanent' | 'consumables') => {
        setSupplies(prev => ({
            ...prev,
            [type]: [...prev[type], "New Item"]
        }));
    }, [setSupplies]);

    const removeSupplyItem = useCallback((type: 'permanent' | 'consumables', index: number) => {
        setSupplies(prev => ({
            ...prev,
            [type]: prev[type].filter((_, i) => i !== index)
        }));
    }, [setSupplies]);

    const handleSafetyChange = useCallback((index: number, value: string) => {
        setSafetyProtocol(prev => {
            const newProtocol = [...prev];
            newProtocol[index] = value;
            return newProtocol;
        });
    }, [setSafetyProtocol]);

    const addSafetyItem = useCallback(() => {
        setSafetyProtocol(prev => [...prev, "New Safety Rule"]);
    }, [setSafetyProtocol]);

    const removeSafetyItem = useCallback((index: number) => {
        setSafetyProtocol(prev => prev.filter((_, i) => i !== index));
    }, [setSafetyProtocol]);

    const handleGenerateVisual = async (index: number) => {
        setLoadingVisuals(prev => new Set(prev).add(index));
        try {
            const item = visualRefs[index];
            const style = visualStyles[index] || "Realistic Photo";
            const prompt = await generateImagePrompt(item.description, basicInfo.theme, basicInfo.activityType, style);
            const base64Image = await generateImage(prompt);
            setGeneratedVisuals(prev => ({ ...prev, [index]: base64Image }));
        } catch (e) {
            console.error("Visual gen failed", e);
        } finally {
            setLoadingVisuals(prev => {
                const next = new Set(prev);
                next.delete(index);
                return next;
            });
        }
    };

    const handleVisualRefChange = (index: number, field: keyof VisualReferenceItem, value: string) => {
        setVisualRefs(prev => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    };

    const handleAddVisualRef = async () => {
        setIsAddingVisual(true);
        try {
            const existingLabels = visualRefs.map(r => r.label);
            const newVisual = await generateVisualReferenceItem(basicInfo.theme, basicInfo.activityType, existingLabels);
            setVisualRefs(prev => [...prev, newVisual]);
        } catch (e) {
            console.error(e);
            setVisualRefs(prev => [...prev, { label: "New Visual", description: "Description", type: "Diagram" }]);
        } finally {
            setIsAddingVisual(false);
        }
    };

    const updateVocab = (index: number, field: keyof VocabularyItem, value: string) => {
        setVocabList(prev => {
            const newList = [...prev];
            newList[index] = { ...newList[index], [field]: value };
            return newList;
        });
    };

    const handleRemoveWord = (index: number) => {
        setVocabList(prev => prev.filter((_, i) => i !== index));
    };

    const handleAddWord = async () => {
        setIsAddingWord(true);
        try {
            const existingWords = vocabList.map(v => v.word);
            const newVocab = await generateVocabularyItem(basicInfo.theme, existingWords);
            setVocabList(prev => [...prev, newVocab]);
        } catch (e) {
            setVocabList(prev => [...prev, { word: "New Word", definition: "Definition" }]);
        } finally {
            setIsAddingWord(false);
        }
    };

    const handleGenerateSingleImage = async (index: number) => {
        setLoadingImages(prev => new Set(prev).add(index));
        try {
            const item = vocabList[index];
            const style = artStyles[index] || "Educational vector illustration";
            const prompt = await generateImagePrompt(item.word, basicInfo.theme, basicInfo.activityType, style);
            const base64 = await generateImage(prompt);
            setGeneratedImages(prev => ({ ...prev, [index]: base64 }));
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingImages(prev => {
                const next = new Set(prev);
                next.delete(index);
                return next;
            });
        }
    };

    const handleGenerateMissingImages = async () => {
        const missingIndices = vocabList.map((_, i) => i).filter(i => !generatedImages[i]);
        for (const idx of missingIndices) {
            await handleGenerateSingleImage(idx);
        }
    };

    const handleHandbookPageChange = (index: number, field: 'visualPrompt' | 'contentPrompt' | 'layoutDescription', value: string) => {
        setHandbookPages(prev => {
            const newPages = [...prev];
            newPages[index] = { ...newPages[index], [field]: value };
            return newPages;
        });
    };


    const renderContent = () => {
        switch (activeTab) {
            case 'roadmap':
                return (
                    <TabRoadmap
                        basicInfo={basicInfo}
                        missionBriefing={missionBriefing}
                        roadmap={roadmap}
                        draggedRoadmapIndex={draggedRoadmapIndex}
                        generatingExtraFor={generatingExtraFor}
                        generatingStepFor={generatingStepFor}
                        isAddingRoadmapItem={isAddingRoadmapItem}
                        handleBasicInfoChange={handleBasicInfoChange}
                        setMissionBriefing={setMissionBriefing}
                        handleGoalChange={handleGoalChange}
                        addGoal={addGoal}
                        removeGoal={removeGoal}
                        handleRoadmapChange={handleRoadmapChange}
                        removeRoadmapItem={removeRoadmapItem}
                        addRoadmapItem={addRoadmapItem}
                        handleBackgroundInfoChange={handleBackgroundInfoChange}
                        addBackgroundInfoItem={addBackgroundInfoItem}
                        removeBackgroundInfoItem={removeBackgroundInfoItem}
                        handleTeachingTipsChange={handleTeachingTipsChange}
                        addTeachingTipsItem={addTeachingTipsItem}
                        removeTeachingTipsItem={removeTeachingTipsItem}
                        handleStepChange={handleStepChange}
                        removeStep={removeStep}
                        handleAddStep={handleAddStep}
                        handleDragStart={handleDragStart}
                        handleDragOver={handleDragOver}
                        handleDrop={handleDrop}
                        handleRoadmapDragStart={handleRoadmapDragStart}
                        handleRoadmapDragOver={handleRoadmapDragOver}
                        handleRoadmapDrop={handleRoadmapDrop}
                    />
                );
            case 'supplies':
                return (
                    <TabSupplies
                        supplies={supplies}
                        safetyProtocol={safetyProtocol}
                        handleSupplyChange={handleSupplyChange}
                        addSupplyItem={addSupplyItem}
                        removeSupplyItem={removeSupplyItem}
                        handleSafetyChange={handleSafetyChange}
                        addSafetyItem={addSafetyItem}
                        removeSafetyItem={removeSafetyItem}
                    />
                );
            case 'flashcards':
                return (
                    <TabFlashcards
                        vocabList={vocabList}
                        generatedImages={generatedImages}
                        loadingImages={loadingImages}
                        artStyles={artStyles}
                        isAddingWord={isAddingWord}
                        basicInfo={basicInfo}
                        setArtStyles={setArtStyles}
                        handleGenerateMissingImages={handleGenerateMissingImages}
                        handleDownloadAllFlashcards={handleDownloadAllFlashcards}
                        handleGenerateSingleImage={handleGenerateSingleImage}
                        updateVocab={updateVocab}
                        handleDownloadFlashcard={handleDownloadFlashcard}
                        handleRemoveWord={handleRemoveWord}
                        handleAddWord={handleAddWord}
                        setZoomedImage={setZoomedImage}
                    />
                );
            case 'visuals':
                return (
                    <TabVisuals
                        visualRefs={visualRefs}
                        generatedVisuals={generatedVisuals}
                        loadingVisuals={loadingVisuals}
                        visualStyles={visualStyles}
                        isAddingVisual={isAddingVisual}
                        setVisualStyles={setVisualStyles}
                        setVisualRefs={setVisualRefs}
                        handleGenerateVisual={handleGenerateVisual}
                        handleVisualRefChange={handleVisualRefChange}
                        handleAddVisualRef={handleAddVisualRef}
                        setZoomedImage={setZoomedImage}
                    />
                );
            case 'handbook':
                return (
                    <TabHandbook
                        plan={plan}
                        handbookPages={handbookPages}
                        handleHandbookPageChange={handleHandbookPageChange}
                        handleCopyAllPrompts={handleCopyAllPrompts}
                        copyToClipboard={copyToClipboard}
                        copiedImagePrompt={copiedImagePrompt}
                        copiedContentPrompt={copiedContentPrompt}
                    />
                );
            case 'badge':
                return (
                    <TabBadge
                        badgePrompt={badgePrompt}
                        badgeImage={badgeImage}
                        loadingBadge={loadingBadge}
                        basicInfo={basicInfo}
                        setBadgePrompt={setBadgePrompt}
                        handleGenerateBadge={handleGenerateBadge}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <div className="w-full">
            {/* Unified Sticky Header - Always Stacked */}
            <div className="flex flex-col gap-3 sticky top-6 z-40 bg-white/90 backdrop-blur-xl p-3 rounded-2xl border border-slate-200 shadow-sm mx-4 mt-4 no-print mb-6">
                {/* Tabs Group */}
                <div className="flex flex-nowrap overflow-x-auto pb-1 gap-2 items-center hide-scrollbar w-full">
                    {[
                        { id: 'roadmap', label: t('tab.roadmap'), icon: Compass },
                        { id: 'supplies', label: t('tab.supplies'), icon: Box },
                        { id: 'flashcards', label: t('tab.flashcards'), icon: BookOpen },
                        { id: 'visuals', label: t('tab.visuals'), icon: ImageIcon },
                        { id: 'handbook', label: t('tab.handbook'), icon: FileText },
                        { id: 'badge', label: t('tab.badge'), icon: BadgeCheck },
                    ].map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as Tab)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-bold transition-all whitespace-nowrap flex-shrink-0 ${activeTab === tab.id
                                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200/50 translate-y-[-1px]'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                    }`}
                            >
                                <Icon className="w-3.5 h-3.5" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Actions Group */}
                <div className="no-print flex items-center justify-between md:justify-end gap-3 w-full pt-2 border-t border-slate-100">
                    <button
                        onClick={handleLanguageToggle}
                        className={`flex items-center justify-center gap-2 px-4 py-2 rounded-full font-bold text-sm transition-colors whitespace-nowrap border ${displayLanguage === 'zh'
                            ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                        title={lang === 'zh' ? '切换到英文' : 'Translate to Chinese'}
                    >
                        <Languages className={`w-4 h-4 ${displayLanguage === 'zh' ? 'text-blue-600' : 'text-slate-500'}`} />
                        <span className="hidden md:inline">{displayLanguage === 'zh' ? t('lp.langToggle') : 'EN / 中'}</span>
                    </button>
                    <button
                        onClick={handlePrint}
                        className="flex items-center justify-center gap-2 px-5 py-2 bg-slate-100 text-slate-700 rounded-full hover:bg-slate-200 transition-colors whitespace-nowrap text-sm font-bold"
                    >
                        <Printer className="w-4 h-4" />
                        <span className="hidden md:inline">Print View</span>
                    </button>
                    {onSave && (
                        <button
                            onClick={handleSaveClick}
                            disabled={isSaved}
                            className={`flex items-center justify-center gap-2 px-5 py-2 text-white rounded-full font-bold text-sm shadow-md transition-all whitespace-nowrap ${isSaved
                                ? 'bg-emerald-500 hover:bg-emerald-500 cursor-default disabled:opacity-100'
                                : 'bg-slate-900 hover:bg-slate-800 hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:translate-y-0'
                                }`}
                        >
                            {isSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                            <span className="hidden md:inline">{isSaved ? t('lp.saved') : t('lp.save')}</span>
                        </button>
                    )}
                </div>
            </div>

            <div className="min-h-[600px]">
                {renderContent()}
            </div>

            {zoomedImage && (
                <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setZoomedImage(null)}>
                    <div className="relative max-w-5xl max-h-[90vh]">
                        <img src={zoomedImage} alt="Zoomed" className="max-w-full max-h-[90vh] rounded-lg shadow-2xl" />
                        <button className="absolute top-4 right-4 text-white hover:text-red-400 p-2 bg-black/50 rounded-full">
                            <X size={24} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};