import React, { useState, useEffect } from 'react';
import { LessonPlanResponse, RoadmapItem, VocabularyItem, VisualReferenceItem } from '../types';
import { Clipboard, Check, Box, BookOpen, ImageIcon, FileText, BadgeCheck, Printer, Loader2, Sparkles, Download, Compass, Languages, ChevronDown, Share2, Save, X } from 'lucide-react';
import { generateSingleStep, generateImagePrompt, generateImage, generateVocabularyItem, generateVisualReferenceItem, generateRoadmapItem, generateBadgePrompt, generateSingleBackgroundInfo, generateSingleTeachingTip } from '../services/geminiService';
import { useLessonStore } from '../stores/useLessonStore';
import { useLanguage } from '../i18n/LanguageContext';
import { RichTextEditor } from './RichTextEditor';

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
    const handleBasicInfoChange = (field: string, value: string) => {
        setBasicInfo(prev => ({ ...prev, [field]: value }));
    };

    const addGoal = () => {
        setBasicInfo(prev => ({ ...prev, learningGoals: [...prev.learningGoals, "New Learning Goal"] }));
    };

    const handleGoalChange = (index: number, value: string) => {
        setBasicInfo(prev => {
            const newGoals = [...prev.learningGoals];
            newGoals[index] = value;
            return { ...prev, learningGoals: newGoals };
        });
    };

    const removeGoal = (index: number) => {
        setBasicInfo(prev => ({
            ...prev,
            learningGoals: prev.learningGoals.filter((_, i) => i !== index)
        }));
    };

    // Roadmap Handlers
    const handleRoadmapChange = (index: number, field: keyof RoadmapItem, value: string) => {
        setRoadmap(prev => {
            const newRoadmap = [...prev];
            newRoadmap[index] = { ...newRoadmap[index], [field]: value };
            return newRoadmap;
        });
    };

    const removeRoadmapItem = (index: number) => {
        setRoadmap(prev => prev.filter((_, i) => i !== index));
    };

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

    const handleSupplyChange = (type: 'permanent' | 'consumables', index: number, value: string) => {
        setSupplies(prev => {
            const newList = [...prev[type]];
            newList[index] = value;
            return { ...prev, [type]: newList };
        });
    };

    const addSupplyItem = (type: 'permanent' | 'consumables') => {
        setSupplies(prev => ({
            ...prev,
            [type]: [...prev[type], "New Item"]
        }));
    };

    const removeSupplyItem = (type: 'permanent' | 'consumables', index: number) => {
        setSupplies(prev => ({
            ...prev,
            [type]: prev[type].filter((_, i) => i !== index)
        }));
    };

    const handleSafetyChange = (index: number, value: string) => {
        setSafetyProtocol(prev => {
            const newProtocol = [...prev];
            newProtocol[index] = value;
            return newProtocol;
        });
    };

    const addSafetyItem = () => {
        setSafetyProtocol(prev => [...prev, "New Safety Rule"]);
    };

    const removeSafetyItem = (index: number) => {
        setSafetyProtocol(prev => prev.filter((_, i) => i !== index));
    };

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

    const handleDownloadFlashcard = (index: number) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const vocab = vocabList[index];
        const image = generatedImages[index];
        const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Flashcard - ${vocab.word}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;800&display=swap" rel="stylesheet">
        <style>
          @page { size: A4 landscape; margin: 0; }
          body { 
            margin: 0; 
            font-family: 'Inter', sans-serif; 
            -webkit-print-color-adjust: exact; 
          }
          .page { 
            width: 297mm; 
            height: 210mm; 
            display: flex; 
            flex-direction: column; 
            justify-content: center; 
            align-items: center; 
            page-break-after: always; 
            position: relative;
            background: white;
            padding: 20mm;
            box-sizing: border-box;
          }
          .image-container {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          img { 
            max-width: 100%; 
            max-height: 100%; 
            object-fit: contain; 
            border-radius: 4mm;
          }
          .text-container {
             text-align: center;
             display: flex;
             flex-direction: column;
             align-items: center;
             justify-content: center;
             height: 100%;
             padding: 20mm;
          }
          h1 { 
            font-size: 8rem; 
            font-weight: 800; 
            color: #1e293b; 
            margin: 0 0 1rem 0; 
            line-height: 1;
            letter-spacing: -0.02em;
          }
          p { 
            font-size: 2.5rem; 
            color: #64748b; 
            max-width: 80%;
            margin: 0;
            line-height: 1.4;
          }
          .label {
            position: absolute;
            bottom: 15mm;
            right: 15mm;
            font-size: 0.8rem;
            color: #94a3b8;
            font-weight: 500;
          }
        </style>
      </head>
      <body>
         <div class="page">
          <div class="image-container">
             ${image ? `<img src="${image}" />` : '<div style="font-size: 2rem; color: #cbd5e1; font-weight: bold; border: 2px dashed #e2e8f0; padding: 2rem; border-radius: 1rem;">No Image Generated</div>'}
          </div>
          <div class="label">Front: Image (${vocab.word})</div>
        </div>
        
        <div class="page">
          <div class="text-container">
            <h1>${vocab.word}</h1>
            <p>${vocab.definition}</p>
          </div>
          <div class="label">Back: Definition</div>
        </div>
        <script>
            window.onload = () => {
                setTimeout(() => {
                    window.print();
                }, 500);
            };
        </script>
      </body>
      </html>
    `;
        printWindow.document.write(html);
        printWindow.document.close();
    };

    const handleDownloadAllFlashcards = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const pagesHtml = vocabList.map((vocab, index) => {
            const image = generatedImages[index];
            return `
        <!-- Card ${index + 1} Front -->
        <div class="page">
          <div class="image-container">
             ${image ? `<img src="${image}" />` : '<div style="font-size: 2rem; color: #cbd5e1; font-weight: bold; border: 2px dashed #e2e8f0; padding: 2rem; border-radius: 1rem;">No Image Generated</div>'}
          </div>
          <div class="label">Front: Image (${vocab.word})</div>
        </div>
        
        <!-- Card ${index + 1} Back -->
        <div class="page">
          <div class="text-container">
            <h1>${vocab.word}</h1>
            <p>${vocab.definition}</p>
          </div>
          <div class="label">Back: Definition</div>
        </div>
        `;
        }).join('');

        const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>All Flashcards - ${basicInfo.theme}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;800&display=swap" rel="stylesheet">
        <style>
          @page { size: A4 landscape; margin: 0; }
          body { 
            margin: 0; 
            font-family: 'Inter', sans-serif; 
            -webkit-print-color-adjust: exact; 
          }
          .page { 
            width: 297mm; 
            height: 210mm; 
            display: flex; 
            flex-direction: column; 
            justify-content: center; 
            align-items: center; 
            page-break-after: always; 
            position: relative;
            background: white;
            padding: 20mm;
            box-sizing: border-box;
          }
          .image-container {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          img { 
            max-width: 100%; 
            max-height: 100%; 
            object-fit: contain; 
            border-radius: 4mm;
          }
          .text-container {
             text-align: center;
             display: flex;
             flex-direction: column;
             align-items: center;
             justify-content: center;
             height: 100%;
             padding: 20mm;
          }
          h1 { 
            font-size: 8rem; 
            font-weight: 800; 
            color: #1e293b; 
            margin: 0 0 1rem 0; 
            line-height: 1;
            letter-spacing: -0.02em;
          }
          p { 
            font-size: 2.5rem; 
            color: #64748b; 
            max-width: 80%;
            margin: 0;
            line-height: 1.4;
          }
          .label {
            position: absolute;
            bottom: 15mm;
            right: 15mm;
            font-size: 0.8rem;
            color: #94a3b8;
            font-weight: 500;
          }
          @media print {
            body { margin: 0; }
          }
        </style>
      </head>
      <body>
        ${pagesHtml}
        <script>
            window.onload = () => {
                setTimeout(() => {
                    window.print();
                }, 1000);
            };
        </script>
      </body>
      </html>
    `;

        printWindow.document.write(html);
        printWindow.document.close();
    };

    const copyToClipboard = (text: string, type: 'notebook' | 'image' | 'content', index?: number) => {
        navigator.clipboard.writeText(text);
        if (type === 'notebook') {
            setCopiedNotebook(true);
            setTimeout(() => setCopiedNotebook(false), 2000);
        } else if (type === 'image' && typeof index === 'number') {
            setCopiedImagePrompt(index);
            setTimeout(() => setCopiedImagePrompt(null), 2000);
        } else if (type === 'content' && typeof index === 'number') {
            setCopiedContentPrompt(index);
            setTimeout(() => setCopiedContentPrompt(null), 2000);
        }
    };

    const handleCopyAllPrompts = () => {
        const allText = handbookPages.map(page =>
            `Page ${page.pageNumber}: ${page.title}\n\n[Content Prompt]:\n${page.contentPrompt}\n\n[Visual Prompt]:\n${page.visualPrompt}\n`
        ).join('\n-------------------\n\n');
        navigator.clipboard.writeText(allText);
        alert("All handbook prompts copied to clipboard!");
    };

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        // Common Header
        const headerHtml = `
      <div class="mb-8 p-6 bg-slate-50 rounded-xl border border-slate-100">
        <h1 class="text-3xl font-bold text-slate-900 mb-2">${missionBriefing.title}</h1>
        <p class="text-lg text-slate-600 italic">${missionBriefing.narrative}</p>
      </div>
    `;

        let bodyContent = '';

        if (activeTab === 'roadmap') {
            const goalsHtml = basicInfo.learningGoals.map(g =>
                `<li class="flex items-start gap-2 mb-2"><span class="text-emerald-500 font-bold">•</span><span>${g}</span></li>`
            ).join('');

            const roadmapHtml = roadmap.map(item => {
                const stepsHtml = item.steps.map((s, i) =>
                    `<li class="flex gap-3 mb-2">
                    <span class="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold border border-slate-200">${i + 1}</span>
                    <span class="text-slate-700">${s}</span>
                </li>`
                ).join('');

                const backgroundInfoHtml = (item.backgroundInfo && item.backgroundInfo.length > 0)
                    ? `<div class="bg-blue-50 p-3 rounded-lg border border-blue-100 mb-4">
                     <h4 class="text-xs font-bold text-blue-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                        Background Info
                     </h4>
                     <ul class="text-sm text-blue-900 list-disc list-inside">
                        ${item.backgroundInfo.map(el => `<li>${el}</li>`).join('')}
                     </ul>
                   </div>`
                    : '';

                const teachingTipsHtml = (item.teachingTips && item.teachingTips.length > 0)
                    ? `<div class="bg-purple-50 p-3 rounded-lg border border-purple-100 mb-4">
                     <h4 class="text-xs font-bold text-purple-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                        Teaching Tips
                     </h4>
                     <ul class="text-sm text-purple-900 list-disc list-inside">
                        ${item.teachingTips.map(el => `<li>${el}</li>`).join('')}
                     </ul>
                   </div>`
                    : '';

                return `
                <div class="mb-8 pl-4 border-l-2 border-emerald-200 relative">
                    <div class="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-emerald-500 ring-4 ring-white"></div>
                    <div class="flex items-baseline gap-4 mb-2">
                        <span class="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded">${item.timeRange}</span>
                        <h3 class="text-xl font-bold text-slate-800">${item.phase} <span class="text-slate-300 font-light mx-2">/</span> ${item.activity}</h3>
                    </div>
                     <div class="flex gap-4 mb-3 text-sm">
                        <span class="px-2 py-1 bg-blue-50 text-blue-700 rounded border border-blue-100 font-semibold">${item.activityType || 'Activity'}</span>
                        <span class="px-2 py-1 bg-emerald-50 text-emerald-700 rounded border border-emerald-100 font-semibold">${item.location || 'Location'}</span>
                        <span class="px-2 py-1 bg-amber-50 text-amber-700 rounded border border-amber-100 italic">Goal: ${item.learningObjective || 'Standard'}</span>
                     </div>
                    <p class="text-slate-600 italic mb-4">${item.description}</p>
                    ${backgroundInfoHtml}
                    ${teachingTipsHtml}
                    <div class="bg-slate-50 p-4 rounded-lg border border-slate-100">
                        <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">${t('print.instructions')}</h4>
                        <ul class="text-sm">${stepsHtml}</ul>
                    </div>
                </div>
            `;
            }).join('');

            bodyContent = `
            <div class="mb-8">
                <h2 class="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">${t('print.workshopOverview')}</h2>
                <div class="grid grid-cols-2 gap-4 mb-6 text-sm">
                    <div class="p-3 border rounded">
                        <div class="text-slate-400 text-xs uppercase font-bold">${t('print.theme')}</div>
                        <div class="font-semibold">${basicInfo.theme}</div>
                    </div>
                    <div class="p-3 border rounded">
                        <div class="text-slate-400 text-xs uppercase font-bold">${t('print.type')}</div>
                        <div class="font-semibold">${basicInfo.activityType}</div>
                    </div>
                    <div class="p-3 border rounded">
                        <div class="text-slate-400 text-xs uppercase font-bold">${t('print.audience')}</div>
                        <div class="font-semibold">${basicInfo.targetAudience}</div>
                    </div>
                    <div class="p-3 border rounded">
                        <div class="text-slate-400 text-xs uppercase font-bold">Timing</div>
                        <div class="font-semibold">${durationDisplay}</div>
                    </div>
                </div>
                <div class="mb-6">
                    <h3 class="text-sm font-bold text-slate-500 uppercase mb-2">Learning Goals</h3>
                    <ul class="bg-white border rounded-xl p-4 text-sm">${goalsHtml}</ul>
                </div>
                <div class="mb-6">
                    <h3 class="text-sm font-bold text-slate-500 uppercase mb-2">Location</h3>
                    <div class="p-3 border rounded bg-white font-semibold text-sm">${basicInfo.location}</div>
                </div>
            </div>
            <div class="mt-8">
                 <h2 class="text-xl font-bold text-slate-800 mb-6 pb-2 border-b">Agenda & Steps</h2>
                 ${roadmapHtml}
            </div>
        `;
        } else if (activeTab === 'supplies') {
            const permanentHtml = supplies.permanent.map(i => `<li>${i}</li>`).join('');
            const consumablesHtml = supplies.consumables.map(i => `<li>${i}</li>`).join('');
            const safetyHtml = safetyProtocol.map(s => `<li class="mb-1">${s}</li>`).join('');

            bodyContent = `
            <div class="grid grid-cols-1 gap-8">
               <div class="p-6 border rounded-xl">
                   <h2 class="text-xl font-bold text-slate-800 mb-4">Supply List</h2>
                   <div class="mb-4">
                       <h3 class="font-bold text-slate-500 text-sm uppercase mb-2">Permanent Tools</h3>
                       <ul class="list-disc list-inside text-slate-700 space-y-1">${permanentHtml}</ul>
                   </div>
                   <div>
                       <h3 class="font-bold text-slate-500 text-sm uppercase mb-2">Consumables</h3>
                       <ul class="list-disc list-inside text-slate-700 space-y-1">${consumablesHtml}</ul>
                   </div>
               </div>
               <div class="p-6 border rounded-xl bg-amber-50 border-amber-100">
                   <h2 class="text-xl font-bold text-amber-900 mb-4">Safety Protocol</h2>
                   <ol class="list-decimal list-inside text-amber-800 space-y-2">${safetyHtml}</ol>
               </div>
            </div>
       `;
        } else if (activeTab === 'flashcards') {
            const cardsHtml = vocabList.map((v, idx) =>
                `<div class="border rounded p-4 text-center break-inside-avoid">
                ${generatedImages[idx] ? `<img src="${generatedImages[idx]}" style="max-width:100%; height:auto; margin-bottom: 1rem; border-radius: 0.5rem;" />` : ''}
                <h3 class="text-xl font-bold mb-2">${v.word}</h3>
                <p class="text-sm italic text-slate-600">${v.definition}</p>
             </div>`
            ).join('');

            bodyContent = `
            <div class="space-y-8">
                <div class="p-6 border rounded-xl">
                     <h2 class="text-xl font-bold text-slate-800 mb-4">Teaching Flashcards</h2>
                     <div class="grid grid-cols-3 gap-4">
                        ${cardsHtml}
                     </div>
                </div>
            </div>
         `;
        } else if (activeTab === 'visuals') {
            const visualsHtml = visualRefs.map((v, idx) =>
                `<div class="border rounded p-4 text-center break-inside-avoid">
               ${generatedVisuals[idx] ? `<img src="${generatedVisuals[idx]}" style="max-width:100%; height:auto; margin-bottom: 1rem; border-radius: 0.5rem;" />` : ''}
               <h3 class="text-xl font-bold mb-1">${v.label}</h3>
               <div class="text-xs uppercase font-bold text-slate-400 mb-2">${v.type}</div>
               <p class="text-sm text-slate-600">${v.description}</p>
            </div>`
            ).join('');

            bodyContent = `
           <div class="space-y-8">
               <div class="p-6 border rounded-xl">
                    <h2 class="text-xl font-bold text-slate-800 mb-4">Visual References</h2>
                    <div class="grid grid-cols-2 gap-6">
                       ${visualsHtml}
                    </div>
               </div>
           </div>
        `;
        } else if (activeTab === 'handbook') {
            bodyContent = `
            <div class="p-6 border rounded-xl bg-indigo-50 border-indigo-100">
                <h2 class="text-xl font-bold text-indigo-900 mb-4">Handbook Design Plan</h2>
                <p class="text-indigo-700 text-sm mb-4">Detailed breakdown of the student handbook.</p>
                <div class="space-y-6">
                  ${handbookPages.map(page => `
                    <div class="border border-indigo-200 rounded-lg p-4 bg-white break-inside-avoid">
                      <h3 class="font-bold text-lg mb-1">Page ${page.pageNumber}: ${page.title}</h3>
                      <div class="text-xs uppercase font-bold text-indigo-500 mb-2">${page.section}</div>
                      <div class="mb-3"><span class="font-semibold text-xs text-slate-500">Layout Description:</span> <div class="text-sm text-slate-700 italic mt-1">${page.layoutDescription}</div></div>
                      <div class="mb-3">
                        <span class="font-semibold text-xs text-slate-500">Visual Prompt:</span> 
                        <div class="text-xs font-mono bg-slate-50 p-2 rounded mt-1 border border-slate-100">${page.visualPrompt}</div>
                      </div>
                      <div class="mb-1">
                        <span class="font-semibold text-xs text-slate-500">Content Prompt:</span> 
                        <div class="text-xs font-mono bg-slate-50 p-2 rounded mt-1 border border-slate-100">${page.contentPrompt}</div>
                      </div>
                    </div>
                  `).join('')}
                </div>
            </div>
        `;
        } else if (activeTab === 'badge') {
            bodyContent = `
            <div class="p-6 border rounded-xl flex flex-col items-center justify-center text-center">
                <h2 class="text-2xl font-bold text-slate-800 mb-4">Achievement Badge</h2>
                <div class="mb-6">
                    ${badgeImage ? `<img src="${badgeImage}" style="width: 200px; height: 200px; border-radius: 50%; border: 4px solid #f1f5f9;" />` : '<div style="width: 200px; height: 200px; border-radius: 50%; background: #f8fafc; border: 4px dashed #e2e8f0; display: flex; align-items: center; justify-content: center; color: #94a3b8;">No Badge</div>'}
                </div>
                <h3 class="text-xl font-bold text-slate-700">${basicInfo.theme}</h3>
                <p class="text-slate-500">Official Workshop Badge</p>
            </div>
        `;
        }

        const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Print View - ${activeTab}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Inter', sans-serif; }
          @media print {
            .no-print { display: none; }
            body { padding: 0; }
            .break-inside-avoid { break-inside: avoid; }
          }
        </style>
      </head>
      <body class="bg-white p-8 md:p-12 max-w-5xl mx-auto">
        <div class="flex justify-between items-center mb-8 no-print">
            <div class="text-sm text-slate-500">Preview Mode</div>
            <button onclick="window.print()" class="bg-slate-900 text-white px-4 py-2 rounded-lg font-bold hover:bg-slate-800 transition-colors flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>
                Print / Save PDF
            </button>
        </div>
        ${headerHtml}
        ${bodyContent}
      </body>
      </html>
    `;

        printWindow.document.write(html);
        printWindow.document.close();
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
            <div className="sticky top-20 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm mb-6 -mx-4 sm:-mx-6 px-4 sm:px-6 py-1.5 flex flex-col sm:flex-row justify-between items-center gap-2">
                <div className="flex gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0 no-scrollbar">
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
                                className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${activeTab === tab.id
                                    ? 'bg-emerald-600 text-white shadow-md'
                                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                    }`}
                            >
                                <Icon size={14} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                        onClick={handleLanguageToggle}
                        className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold text-xs transition-colors whitespace-nowrap border ${displayLanguage === 'zh'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                        title={lang === 'zh' ? '切换到英文' : 'Translate to Chinese'}
                    >
                        <Languages size={14} className={displayLanguage === 'zh' ? 'text-blue-600' : 'text-slate-500'} />
                        <span className="hidden md:inline">{displayLanguage === 'zh' ? t('lp.langToggle') : 'EN / 中'}</span>
                    </button>
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 text-slate-700 rounded-lg font-semibold text-xs hover:bg-slate-200 transition-colors whitespace-nowrap"
                    >
                        <Printer size={14} />
                        <span className="hidden md:inline">{t('lp.print')}</span>
                    </button>
                    {onSave && (
                        <button
                            onClick={handleSaveClick}
                            disabled={isSaved}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-white rounded-lg font-semibold text-xs shadow-md transition-all whitespace-nowrap ${isSaved ? 'bg-emerald-500 hover:bg-emerald-500 cursor-default' : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg'
                                }`}
                        >
                            {isSaved ? <Check size={14} /> : <Save size={14} />}
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