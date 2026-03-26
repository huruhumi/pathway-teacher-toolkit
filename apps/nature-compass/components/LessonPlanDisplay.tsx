import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { HandbookPhasePagePlan, LessonPlanResponse, RoadmapItem, VocabularyItem, VisualReferenceItem } from '../types';
import { Clipboard, Check, Box, BookOpen, BookOpenCheck, ImageIcon, FileText, BadgeCheck, Printer, Loader2, Sparkles, Download, Compass, Languages, ChevronDown, ChevronUp, Share2, Save, X } from 'lucide-react';
import {
    generateSingleStep,
    generateVocabularyItem,
    generateVisualReferenceItem,
    generateRoadmapItem,
    generateSingleBackgroundInfo,
    generateSingleTeachingTip,
    translateLessonPlan,
    translateRoadmapItem,
} from '../services/contentGenerators';
import { generateDownstreamContent } from '../services/gemini/supportingContent';
import type { InputSnapshot } from '../types';
import { generateImagePrompt, generateImage, generateBadgePrompt } from '../services/imageService';
import { regenerateSinglePhase } from '../services/curriculumService';
import { useLessonStore } from '../stores/useLessonStore';
import { useAppStore } from '../stores/appStore';
import { useToast } from '@shared/stores/useToast';
import { useLanguage } from '../i18n/LanguageContext';
import { RichTextEditor } from './RichTextEditor';
import { usePrintUtils } from '../hooks/usePrintUtils';
import { useSlideExport } from '../hooks/useSlideExport';
import { useAutoSave, SaveStatus } from '@shared/hooks/useAutoSave';


import { TabRoadmap } from './tabs/TabRoadmap';
import { TabSupplies } from './tabs/TabSupplies';
import { TabFlashcards } from './tabs/TabFlashcards';
import { TabVisuals } from './tabs/TabVisuals';
import { TabHandbook } from './tabs/TabHandbook';
import { TabPoster } from './tabs/TabPoster';
import { TabFactSheet } from './tabs/TabFactSheet';
import type { CommitStatus } from './CommitProgressModal';
import {
    normalizePhasePagePlan,
    PhaseHandbookPlanner,
    validatePhasePagePlan,
} from './PhaseHandbookPlanner';

// Utils
import { sanitizeFilename, downloadImage } from '../utils/fileHelpers';

interface LessonPlanDisplayProps {
    plan: LessonPlanResponse;
    onSave?: (plan: LessonPlanResponse, coverImage?: string | null) => void | Promise<unknown>;
    mode?: 'school' | 'family';
}

type Tab = 'roadmap' | 'supplies' | 'factsheet' | 'flashcards' | 'visuals' | 'handbook' | 'poster';
const DEFAULT_PHASE_DURATION_MINUTES = 20;

function parseRoadmapPhaseDurationMinutes(timeRange: string): number {
    const value = (timeRange || '').trim();
    if (!value) return DEFAULT_PHASE_DURATION_MINUTES;

    const direct = value.match(/(\d+)\s*-\s*(\d+)\s*m?$/i);
    if (direct) {
        const start = Number(direct[1]);
        const end = Number(direct[2]);
        if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
            return end - start;
        }
    }

    const numbers = value.match(/\d+/g);
    if (numbers && numbers.length >= 2) {
        const start = Number(numbers[0]);
        const end = Number(numbers[1]);
        if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
            return end - start;
        }
    }

    return DEFAULT_PHASE_DURATION_MINUTES;
}

function normalizeRoadmapTimeline(items: RoadmapItem[]): RoadmapItem[] {
    let cursor = 0;
    let previousDuration = DEFAULT_PHASE_DURATION_MINUTES;

    return items.map((item) => {
        const parsedDuration = parseRoadmapPhaseDurationMinutes(item.timeRange);
        const duration = Number.isFinite(parsedDuration) && parsedDuration > 0
            ? parsedDuration
            : previousDuration;
        const start = cursor;
        const end = start + duration;
        cursor = end;
        previousDuration = duration;
        return {
            ...item,
            timeRange: `${start}-${end}m`,
        };
    });
}

function hasRoadmap(items?: RoadmapItem[] | null): boolean {
    return Array.isArray(items) && items.length > 0;
}

function cloneRoadmap(items: RoadmapItem[]): RoadmapItem[] {
    return items.map((item) => ({
        ...item,
        steps: [...(item.steps || [])],
        backgroundInfo: [...(item.backgroundInfo || [])],
        teachingTips: [...(item.teachingTips || [])],
    }));
}

function roadmapLooksChinese(items?: RoadmapItem[] | null): boolean {
    if (!Array.isArray(items) || items.length === 0) return false;
    const sample = items
        .slice(0, 3)
        .map((item) => `${item.phase || ''} ${item.activity || ''} ${item.description || ''}`)
        .join(' ');
    const cjk = (sample.match(/[\u4e00-\u9fff]/g) || []).length;
    const latin = (sample.match(/[A-Za-z]/g) || []).length;
    return cjk > 0 && cjk >= latin;
}

export const LessonPlanDisplay: React.FC<LessonPlanDisplayProps> = ({ plan, onSave, mode = 'school' }) => {
    const [activeTab, setActiveTab] = useState<Tab>('roadmap');
    const { t, lang } = useLanguage();
    const [copiedNotebook, setCopiedNotebook] = useState(false);
    const [copiedStylePrompt, setCopiedStylePrompt] = useState(false);
    const [copiedImagePrompt, setCopiedImagePrompt] = useState<number | null>(null);
    const [copiedContentPrompt, setCopiedContentPrompt] = useState<number | null>(null);
    const [isSaved, setIsSaved] = useState(false);
    const [slideVersionPref, setSlideVersionPref] = useState<'detailed' | 'simple' | 'both'>('both');
    const [regeneratingPhase, setRegeneratingPhase] = useState<number | null>(null);
    const [isCommitting, setIsCommitting] = useState(false);
    const [commitStatus, setCommitStatus] = useState<CommitStatus>('idle');
    const [commitError, setCommitError] = useState<string>('');
    const [handbookPhasePlan, setHandbookPhasePlan] = useState<HandbookPhasePagePlan | null>(null);
    const [showPhasePlannerModal, setShowPhasePlannerModal] = useState(false);
    const [pendingCommitComment, setPendingCommitComment] = useState<string | undefined>(undefined);
    const [showBackToTop, setShowBackToTop] = useState(false);
    const [isSyncingTranslation, setIsSyncingTranslation] = useState(false);
    const [syncingPhaseIndex, setSyncingPhaseIndex] = useState<number | null>(null);
    const lastEnglishRoadmapRef = useRef<RoadmapItem[] | null>(
        hasRoadmap(plan.roadmap) && !roadmapLooksChinese(plan.roadmap)
            ? normalizeRoadmapTimeline(cloneRoadmap(plan.roadmap))
            : null,
    );
    const isRecoveringEnglishRoadmapRef = useRef(false);


    // Slide Export
    const { exportState, startExport, cancelExport, resetExport, isProxyAvailable } = useSlideExport();

    // App input for regeneration
    const input = useAppStore(s => s.input);

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

    const effectiveRoadmap = useMemo(() => {
        if (Array.isArray(roadmap) && roadmap.length > 0) {
            return roadmap;
        }
        const zhBranch = translatedPlan?.roadmap || plan.translatedPlan?.roadmap || [];
        const enBranch = plan.roadmap || [];
        if (displayLanguage === 'zh') {
            return zhBranch.length > 0 ? zhBranch : enBranch;
        }
        return enBranch.length > 0 ? enBranch : zhBranch;
    }, [displayLanguage, plan.roadmap, plan.translatedPlan?.roadmap, roadmap, translatedPlan?.roadmap]);

    const recoverEnglishRoadmapFromChinese = useCallback(async (zhRoadmap: RoadmapItem[]) => {
        if (!hasRoadmap(zhRoadmap)) return null;
        try {
            const translated = await Promise.all(
                zhRoadmap.map((item) => translateRoadmapItem(item, 'English')),
            );
            return normalizeRoadmapTimeline(translated);
        } catch (error) {
            console.warn('[RecoverENRoadmap] zh->en translation failed:', error);
            return null;
        }
    }, []);

    // Sync state if prop changes (e.g. re-generation)
    useEffect(() => {
        // Auto-detect display language:
        // If the English roadmap is empty but translatedPlan has roadmap data,
        // the plan was generated in Chinese-only mode — default to 'zh'.
        const hasEnglishRoadmap = (plan.roadmap?.length ?? 0) > 0;
        const hasTranslatedRoadmap = (plan.translatedPlan?.roadmap?.length ?? 0) > 0;
        const autoLang = (!hasEnglishRoadmap && hasTranslatedRoadmap) ? 'zh' : 'en';

        // Apply the correct plan data to the store based on auto-detected language.
        // If autoLang='zh', use translatedPlan so the store has actual data.
        if (autoLang === 'zh' && plan.translatedPlan) {
            applyPlanToState(plan.translatedPlan);
        } else {
            applyPlanToState(plan);
        }
        setDisplayLanguage(autoLang);

        // Extract the pre-translated plan if it exists
        setTranslatedPlan(plan.translatedPlan || null);
        if (hasRoadmap(plan.roadmap) && !roadmapLooksChinese(plan.roadmap)) {
            lastEnglishRoadmapRef.current = normalizeRoadmapTimeline(cloneRoadmap(plan.roadmap || []));
        }
        const plannerRoadmap = autoLang === 'zh'
            ? (plan.translatedPlan?.roadmap || plan.roadmap || [])
            : (plan.roadmap || plan.translatedPlan?.roadmap || []);
        setHandbookPhasePlan(
            normalizePhasePagePlan(
                plan._inputSnapshot?.handbookPhasePagePlan,
                plannerRoadmap,
            ),
        );
        setShowPhasePlannerModal(false);
        setPendingCommitComment(undefined);

        // Reset generated assets only when the base plan changes
        resetAssets();
        const themeForBadge = plan.basicInfo?.theme || plan.translatedPlan?.basicInfo?.theme || 'Nature Activity';
        setBadgePrompt(`A circular merit badge sticker for: "${themeForBadge}". Vector style, simple icon, white background, high quality.`);

    }, [plan]);

    useEffect(() => {
        setHandbookPhasePlan(prev => normalizePhasePagePlan(prev || undefined, effectiveRoadmap || []));
    }, [effectiveRoadmap]);

    useEffect(() => {
        const onScroll = () => {
            setShowBackToTop(window.scrollY > 500);
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const buildPlanForPersistence = useCallback((): LessonPlanResponse => {
        const canUseCurrentRoadmap =
            hasRoadmap(roadmap) && !(displayLanguage === 'en' && roadmapLooksChinese(roadmap));
        const canUsePlanRoadmap =
            hasRoadmap(plan.roadmap) && !(displayLanguage === 'en' && roadmapLooksChinese(plan.roadmap));
        const persistedRoadmap = canUseCurrentRoadmap
            ? roadmap
            : (canUsePlanRoadmap
                ? (plan.roadmap || [])
                : (translatedPlan?.roadmap || plan.translatedPlan?.roadmap || []));
        const editedViewPlan: LessonPlanResponse = {
            ...plan,
            missionBriefing,
            basicInfo,
            roadmap: persistedRoadmap,
            supplies,
            safetyProtocol,
            vocabulary: {
                ...plan.vocabulary,
                keywords: vocabList,
            },
            visualReferences: visualRefs,
            handbookStylePrompt: plan.handbookStylePrompt,
            handbook: handbookPages,
        };

        if (displayLanguage === 'en') {
            return {
                ...editedViewPlan,
                translatedPlan: translatedPlan ?? plan.translatedPlan,
            };
        }

        const existingZh = translatedPlan ?? plan.translatedPlan;
        const zhUpdated: LessonPlanResponse = {
            ...(existingZh || editedViewPlan),
            missionBriefing,
            basicInfo,
            roadmap: persistedRoadmap,
            supplies,
            safetyProtocol,
            vocabulary: {
                ...((existingZh?.vocabulary) || plan.vocabulary),
                keywords: vocabList,
            },
            visualReferences: visualRefs,
            handbookStylePrompt: existingZh?.handbookStylePrompt || plan.handbookStylePrompt,
            handbook: handbookPages,
        };

        const hasEnglishBase = Array.isArray(plan.roadmap) && plan.roadmap.length > 0;
        if (!hasEnglishBase) {
            // Chinese-primary records (EN base missing): persist edited content as main plan.
            return {
                ...editedViewPlan,
                translatedPlan: zhUpdated,
            };
        }

        // EN base exists: keep EN base intact and only update the ZH branch.
        return {
            ...plan,
            translatedPlan: zhUpdated,
        };
    }, [
        basicInfo,
        displayLanguage,
        handbookPages,
        missionBriefing,
        plan,
        roadmap,
        safetyProtocol,
        supplies,
        translatedPlan,
        visualRefs,
        vocabList,
    ]);

    // --- Auto-Save ---
    const getCurrentContentObject = useCallback(() => {
        const currentPlan: LessonPlanResponse = buildPlanForPersistence();
        return { plan: currentPlan, coverImage: badgeImage };
    }, [badgeImage, buildPlanForPersistence]);

    const { saveStatus, lastSaved } = useAutoSave({
        getCurrentContentObject,
        onSave: (data: { plan: LessonPlanResponse; coverImage: string | null }) => {
            onSave?.(data.plan, data.coverImage);
        },
        editablePlan: onSave ? plan : null, // Only auto-save if onSave prop exists
        debounceMs: 5000,
    });

    // Language Toggle Handler
    const handleLanguageToggle = () => {
        if (displayLanguage === 'en') {
            // Keep EN source-of-truth in sync before switching away.
            if (hasRoadmap(roadmap) && !roadmapLooksChinese(roadmap) && plan.roadmap !== roadmap) {
                plan.roadmap = roadmap;
                lastEnglishRoadmapRef.current = normalizeRoadmapTimeline(cloneRoadmap(roadmap));
            }
            if (translatedPlan) {
                applyPlanToState(translatedPlan);
                setDisplayLanguage('zh');
            } else {
                useToast.getState().error("Chinese translation is not available for this plan.");
            }
        } else {
            // Keep ZH source-of-truth in sync before switching back.
            if (translatedPlan && hasRoadmap(roadmap) && translatedPlan.roadmap !== roadmap) {
                setTranslatedPlan({ ...translatedPlan, roadmap });
            }
            if (!hasRoadmap(plan.roadmap) && hasRoadmap(translatedPlan?.roadmap || plan.translatedPlan?.roadmap || [])) {
                const fallback = translatedPlan?.roadmap || plan.translatedPlan?.roadmap || [];
                const cachedEn = lastEnglishRoadmapRef.current;
                if (hasRoadmap(cachedEn)) {
                    const recovered = normalizeRoadmapTimeline(cloneRoadmap(cachedEn || []));
                    plan.roadmap = recovered;
                    applyPlanToState({ ...plan, roadmap: recovered });
                } else {
                    applyPlanToState({ ...plan, roadmap: normalizeRoadmapTimeline(cloneRoadmap(fallback)) });
                    void (async () => {
                        const recovered = await recoverEnglishRoadmapFromChinese(fallback);
                        if (recovered && recovered.length > 0) {
                            lastEnglishRoadmapRef.current = normalizeRoadmapTimeline(cloneRoadmap(recovered));
                            plan.roadmap = recovered;
                            setRoadmap(recovered);
                            useToast.getState().success(lang === 'zh' ? '已自动恢复英文阶段内容。' : 'English roadmap restored automatically.');
                        }
                    })();
                }
            } else {
                applyPlanToState(plan);
            }
            setDisplayLanguage('en');
        }
    };

    const handleSyncTranslation = async () => {
        if (isSyncingTranslation) return;

        const sourceBase = displayLanguage === 'zh' ? (translatedPlan || plan) : plan;
        const sourcePlan: LessonPlanResponse = {
            ...sourceBase,
            missionBriefing,
            basicInfo,
            roadmap,
            supplies,
            safetyProtocol,
            vocabulary: {
                ...(sourceBase.vocabulary || plan.vocabulary),
                keywords: vocabList,
            },
            visualReferences: visualRefs,
            handbook: handbookPages,
        };

        // translateLessonPlan uses lessonPlanSchema; keep payload schema-clean.
        const translationPayload: LessonPlanResponse = {
            ...sourcePlan,
            translatedPlan: undefined,
            factSheet: undefined,
            factSheetSources: undefined,
            factSheetMeta: undefined,
            structuredKnowledge: undefined,
            generationPhase: undefined,
            _inputSnapshot: undefined,
        };

        const sharedMeta = {
            _inputSnapshot: plan._inputSnapshot,
            generationPhase: plan.generationPhase,
            factSheet: plan.factSheet,
            factSheetSources: plan.factSheetSources,
            factSheetMeta: plan.factSheetMeta,
            structuredKnowledge: plan.structuredKnowledge,
        };

        setIsSyncingTranslation(true);
        try {
            const targetLanguage = displayLanguage === 'en' ? 'Simplified Chinese' : 'English';
            const translated = await translateLessonPlan(translationPayload, targetLanguage);
            const translatedWithMeta: LessonPlanResponse = {
                ...translated,
                ...sharedMeta,
            };

            if (displayLanguage === 'en') {
                setTranslatedPlan(translatedWithMeta);
                plan.translatedPlan = translatedWithMeta;
            } else {
                // Keep currently edited Chinese as source-of-truth, and refresh EN base.
                const currentZhWithMeta: LessonPlanResponse = {
                    ...sourcePlan,
                    ...sharedMeta,
                };
                setTranslatedPlan(currentZhWithMeta);
                plan.translatedPlan = currentZhWithMeta;

                Object.assign(plan, translatedWithMeta);
                plan.translatedPlan = currentZhWithMeta;
            }

            useToast.getState().success(
                lang === 'zh'
                    ? (displayLanguage === 'en' ? '已同步翻译到中文。' : '已同步翻译到英文。')
                    : (displayLanguage === 'en' ? 'Synced translation to Chinese.' : 'Synced translation to English.'),
            );
        } catch (err: any) {
            console.error('[SyncTranslation] Failed:', err);
            useToast.getState().error(
                lang === 'zh'
                    ? `同步翻译失败：${err?.message || '未知错误'}`
                    : `Translation sync failed: ${err?.message || 'Unknown error'}`,
            );
        } finally {
            setIsSyncingTranslation(false);
        }
    };

    const handleSyncSinglePhase = async (phaseIndex: number) => {
        if (syncingPhaseIndex !== null || isSyncingTranslation) return;
        if (!roadmap[phaseIndex]) return;

        setSyncingPhaseIndex(phaseIndex);
        try {
            const targetLanguage = displayLanguage === 'en' ? 'Simplified Chinese' : 'English';
            const translatedPhase = await translateRoadmapItem(roadmap[phaseIndex], targetLanguage);

            if (displayLanguage === 'en') {
                const baseZh = translatedPlan || plan.translatedPlan;
                if (!baseZh) {
                    throw new Error('Chinese translation is not available yet. Please run full sync once first.');
                }

                const nextZhRoadmap = Array.isArray(baseZh.roadmap) ? [...baseZh.roadmap] : [];
                const fallback = nextZhRoadmap[phaseIndex] || roadmap[phaseIndex];
                nextZhRoadmap[phaseIndex] = {
                    ...fallback,
                    ...translatedPhase,
                    timeRange: fallback?.timeRange || roadmap[phaseIndex].timeRange,
                };

                const nextZhPlan: LessonPlanResponse = {
                    ...baseZh,
                    roadmap: nextZhRoadmap,
                };
                setTranslatedPlan(nextZhPlan);
                plan.translatedPlan = nextZhPlan;
            } else {
                const nextEnRoadmap = Array.isArray(plan.roadmap) ? [...plan.roadmap] : [];
                const fallback = nextEnRoadmap[phaseIndex] || roadmap[phaseIndex];
                nextEnRoadmap[phaseIndex] = {
                    ...fallback,
                    ...translatedPhase,
                    timeRange: fallback?.timeRange || roadmap[phaseIndex].timeRange,
                };
                plan.roadmap = nextEnRoadmap;

                if (translatedPlan) {
                    const nextZhPlan: LessonPlanResponse = {
                        ...translatedPlan,
                        roadmap: [...roadmap],
                    };
                    setTranslatedPlan(nextZhPlan);
                    plan.translatedPlan = nextZhPlan;
                }
            }

            useToast.getState().success(
                lang === 'zh'
                    ? `阶段 ${phaseIndex + 1} 已同步。`
                    : `Phase ${phaseIndex + 1} synced.`,
            );
        } catch (err: any) {
            console.error('[SyncSinglePhase] Failed:', err);
            useToast.getState().error(
                lang === 'zh'
                    ? `阶段同步失败: ${err?.message || '未知错误'}`
                    : `Phase sync failed: ${err?.message || 'Unknown error'}`,
            );
        } finally {
            setSyncingPhaseIndex(null);
        }
    };

    // --- Handlers ---



    const handleSaveClick = async () => {
        if (!onSave) return;

        const currentPlan: LessonPlanResponse = buildPlanForPersistence();
        const result = await onSave(currentPlan, badgeImage) as { ok?: boolean } | void;
        if (result && typeof result === 'object' && 'ok' in result && result.ok === false) {
            useToast.getState().error(lang === 'zh' ? '保存失败，请稍后重试。' : 'Save failed. Please retry.');
            return;
        }
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
    };

    const handleGenerateBadge = async () => {
        setLoadingBadge(true);
        try {
            // Use user edited prompt directly
            const image = await generateImage(badgePrompt, "1:1");
            setBadgeImage(image);
        } catch (e: unknown) {
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
        const dropAt = (items: RoadmapItem[] | undefined) =>
            normalizeRoadmapTimeline((items || []).filter((_, i) => i !== index));

        setDraggedRoadmapIndex(null);

        const nextCurrentRoadmap = dropAt(roadmap);
        setRoadmap(nextCurrentRoadmap);

        if (displayLanguage === 'en') {
            plan.roadmap = nextCurrentRoadmap;
            if (translatedPlan?.roadmap?.length) {
                const nextZhRoadmap = dropAt(translatedPlan.roadmap);
                setTranslatedPlan({ ...translatedPlan, roadmap: nextZhRoadmap });
            }
            return;
        }

        if (displayLanguage === 'zh') {
            if (translatedPlan) {
                setTranslatedPlan({ ...translatedPlan, roadmap: nextCurrentRoadmap });
            }
            plan.roadmap = dropAt(plan.roadmap || []);
        }
    }, [displayLanguage, plan, roadmap, setDraggedRoadmapIndex, setRoadmap, setTranslatedPlan, translatedPlan]);

    // Keep mutable source plans aligned with the currently edited roadmap to prevent
    // deleted/reordered phases from snapping back after language switches.
    useEffect(() => {
        if (displayLanguage === 'en') {
            if (hasRoadmap(roadmap)) {
                if (!roadmapLooksChinese(roadmap)) {
                    lastEnglishRoadmapRef.current = normalizeRoadmapTimeline(cloneRoadmap(roadmap));
                }
                if (!roadmapLooksChinese(roadmap) && plan.roadmap !== roadmap) {
                    plan.roadmap = roadmap;
                }
                return;
            }
            // Guard: never clobber EN source with an accidental empty store snapshot.
            const zhFallback = translatedPlan?.roadmap || plan.translatedPlan?.roadmap || [];
            if (!hasRoadmap(plan.roadmap) && hasRoadmap(zhFallback)) {
                if (hasRoadmap(lastEnglishRoadmapRef.current)) {
                    const recovered = normalizeRoadmapTimeline(cloneRoadmap(lastEnglishRoadmapRef.current || []));
                    plan.roadmap = recovered;
                    setRoadmap(recovered);
                }
            }
            return;
        }
        if (displayLanguage === 'zh' && translatedPlan && hasRoadmap(roadmap) && translatedPlan.roadmap !== roadmap) {
            setTranslatedPlan({ ...translatedPlan, roadmap });
        }
    }, [displayLanguage, plan, roadmap, translatedPlan, setRoadmap, setTranslatedPlan]);

    useEffect(() => {
        if (displayLanguage !== 'en') return;
        if (!hasRoadmap(roadmap)) return;
        if (!roadmapLooksChinese(roadmap)) return;
        if (isRecoveringEnglishRoadmapRef.current) return;

        const zhSource = translatedPlan?.roadmap || plan.translatedPlan?.roadmap || roadmap;
        if (!hasRoadmap(zhSource)) return;

        isRecoveringEnglishRoadmapRef.current = true;
        void (async () => {
            const recovered = await recoverEnglishRoadmapFromChinese(zhSource);
            if (recovered && recovered.length > 0 && !roadmapLooksChinese(recovered)) {
                lastEnglishRoadmapRef.current = normalizeRoadmapTimeline(cloneRoadmap(recovered));
                plan.roadmap = recovered;
                setRoadmap(recovered);
                useToast.getState().success(lang === 'zh' ? '检测到英文路线图异常，已自动恢复为英文。' : 'Detected invalid EN roadmap and restored it automatically.');
            }
            isRecoveringEnglishRoadmapRef.current = false;
        })();
    }, [
        displayLanguage,
        lang,
        plan,
        roadmap,
        translatedPlan,
        setRoadmap,
        recoverEnglishRoadmapFromChinese,
    ]);

    const addRoadmapItem = async () => {
        setIsAddingRoadmapItem(true);
        try {
            const newItem = await generateRoadmapItem(basicInfo.theme, basicInfo.activityType, roadmap);
            setRoadmap(prev => normalizeRoadmapTimeline([...prev, newItem]));
        } catch (e: unknown) {
            console.error(e);
            setRoadmap(prev => normalizeRoadmapTimeline([...prev, {
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
            }]));
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
        } catch (e: unknown) {
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
        } catch (e: unknown) {
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
        } catch (e: unknown) {
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

        const move = (items: RoadmapItem[] | undefined) => {
            const list = [...(items || [])];
            if (
                draggedRoadmapIndex < 0 ||
                draggedRoadmapIndex >= list.length ||
                targetIndex < 0 ||
                targetIndex >= list.length
            ) {
                return normalizeRoadmapTimeline(list);
            }
            const [movedItem] = list.splice(draggedRoadmapIndex, 1);
            list.splice(targetIndex, 0, movedItem);
            return normalizeRoadmapTimeline(list);
        };

        const nextCurrentRoadmap = move(roadmap);
        setRoadmap(nextCurrentRoadmap);

        if (displayLanguage === 'en') {
            plan.roadmap = nextCurrentRoadmap;
            if (translatedPlan?.roadmap?.length) {
                setTranslatedPlan({ ...translatedPlan, roadmap: move(translatedPlan.roadmap) });
            }
        } else if (displayLanguage === 'zh') {
            if (translatedPlan) {
                setTranslatedPlan({ ...translatedPlan, roadmap: nextCurrentRoadmap });
            }
            plan.roadmap = move(plan.roadmap || []);
        }

        setDraggedRoadmapIndex(null);
    };

    const handleRoadmapDragEnd = () => {
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
        } catch (e: unknown) {
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
        } catch (e: unknown) {
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
        } catch (e: unknown) {
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
        } catch (e: unknown) {
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

    const handleStylePromptChange = (prompt: string) => {
        plan.handbookStylePrompt = prompt;
    };

    const handleRegeneratePhase = async (phaseIndex: number, feedback: string) => {
        setRegeneratingPhase(phaseIndex);
        try {
            const currentPlan: LessonPlanResponse = {
                ...plan,
                roadmap,
                basicInfo: { ...plan.basicInfo, ...basicInfo },
                handbook: handbookPages,
                supplies,
                safetyProtocol,
            };

            // Fix C: pass _inputSnapshot for full mode/weather/age context
            // Fix B: always generate in English (higher quality), then translate
            const genLang = displayLanguage === 'zh' && !translatedPlan ? 'zh' : 'en';
            const newPhase = await regenerateSinglePhase(currentPlan, phaseIndex, feedback, genLang as 'en' | 'zh', plan._inputSnapshot);
            const normalizedEnglishPhase = genLang === 'en'
                ? await translateRoadmapItem(newPhase, 'English')
                : newPhase;

            // Update the English roadmap
            const updated = [...roadmap];
            if (displayLanguage === 'zh' && translatedPlan) {
                // We're viewing Chinese — update translatedPlan directly, then sync English
                const updatedTranslated = [...roadmap];
                // Generate Chinese version too
                const cnPhase = await regenerateSinglePhase(currentPlan, phaseIndex, feedback, 'zh', plan._inputSnapshot);
                updatedTranslated[phaseIndex] = cnPhase;
                updated[phaseIndex] = normalizedEnglishPhase; // English version
                setRoadmap(updatedTranslated); // Display Chinese
                // Sync both
                const nextEnRoadmap = Array.isArray(plan.roadmap) ? [...plan.roadmap] : [];
                nextEnRoadmap[phaseIndex] = normalizedEnglishPhase;
                plan.roadmap = nextEnRoadmap;
                const syncedTranslated = { ...translatedPlan, roadmap: updatedTranslated };
                setTranslatedPlan(syncedTranslated);
            } else {
                // Viewing English — update English, then translate for Chinese
                updated[phaseIndex] = normalizedEnglishPhase;
                setRoadmap(updated);
                const nextEnRoadmap = Array.isArray(plan.roadmap) ? [...plan.roadmap] : [];
                nextEnRoadmap[phaseIndex] = normalizedEnglishPhase;
                plan.roadmap = nextEnRoadmap;

                // Fix A: sync translatedPlan if it exists
                if (translatedPlan) {
                    try {
                        const cnPhase = await regenerateSinglePhase(currentPlan, phaseIndex, feedback, 'zh', plan._inputSnapshot);
                        const updatedTranslatedRoadmap = [...translatedPlan.roadmap];
                        updatedTranslatedRoadmap[phaseIndex] = cnPhase;
                        setTranslatedPlan({ ...translatedPlan, roadmap: updatedTranslatedRoadmap });
                    } catch (transErr) {
                        console.warn('[RegeneratePhase] Chinese sync failed, ZH version may be stale:', transErr);
                    }
                }
            }

            useToast.getState().success(lang === 'zh' ? `阶段 ${phaseIndex + 1} 已更新！` : `Phase ${phaseIndex + 1} updated!`);
        } catch (err: any) {
            console.error('[RegeneratePhase] Failed:', err);
            useToast.getState().error(lang === 'zh' ? `重新生成失败: ${err.message}` : `Regeneration failed: ${err.message}`);
        } finally {
            setRegeneratingPhase(null);
        }
    };

    const commitAbortRef = React.useRef<AbortController | null>(null);

    const handleCancelCommit = () => {
        if (commitAbortRef.current) {
            commitAbortRef.current.abort();
            commitAbortRef.current = null;
        }
        setIsCommitting(false);
        setCommitStatus('idle');
        useToast.getState().info(lang === 'zh' ? '已停止生成' : 'Generation cancelled');
    };

    const handbookPlanValidation = handbookPhasePlan
        ? validatePhasePagePlan(handbookPhasePlan, effectiveRoadmap.length)
        : { valid: false, reason: lang === 'zh' ? '请先配置逐阶段手册分页' : 'Please configure phase page allocation first' };

    const commitBlockReason =
        input.handbookMode !== 'structured' && !handbookPlanValidation.valid
            ? (handbookPlanValidation.reason || (lang === 'zh' ? '请先完成分页配置' : 'Please finish page allocation first'))
            : null;

    const requiresPhasePlanner = input.handbookMode !== 'structured';

    const handleCommit = async (regenerationComment?: string) => {
        if (commitBlockReason) {
            useToast.getState().error(commitBlockReason);
            return;
        }

        const abortController = new AbortController();
        commitAbortRef.current = abortController;
        setIsCommitting(true);
        setCommitStatus('generating');
        setCommitError('');
        try {
            const snapshot: InputSnapshot = plan._inputSnapshot || {
                mode: input.mode,
                familyEslEnabled: input.familyEslEnabled,
                weather: input.weather,
                studentAge: input.studentAge,
                cefrLevel: input.cefrLevel || 'A1 (Beginner)',
                duration: input.duration,
                handbookMode: input.handbookMode,
                handbookPreset: input.handbookPreset,
                handbookPageConfig: input.handbookPageConfig,
                autoPageTarget: input.autoPageTarget,
                handbookPhasePagePlan: input.handbookPhasePagePlan,
                factSheet: input.factSheet,
                factSheetQuality: input.factSheetQuality,
                factSheetSources: input.factSheetSources,
                factSheetMeta: input.factSheetMeta,
                handbookStyleId: input.handbookStyleId,
                customStructure: input.customStructure,
                structuredKnowledge: input.structuredKnowledge,
            };

            if (handbookPhasePlan && input.handbookMode !== 'structured') {
                snapshot.handbookPhasePagePlan = handbookPhasePlan;
                snapshot.autoPageTarget = handbookPhasePlan.totalPages;
            }
            plan._inputSnapshot = snapshot;

            // Use the currently edited roadmap in the active language as the source of truth.
            // This ensures manual edits are respected when committing Phase 2 regeneration.
            const activeRoadmap = roadmap?.length ? roadmap : effectiveRoadmap;
            const enRoadmap = displayLanguage === 'en'
                ? activeRoadmap
                : (plan.roadmap?.length ? plan.roadmap : activeRoadmap);
            const zhRoadmap = displayLanguage === 'zh'
                ? activeRoadmap
                : (
                    translatedPlan?.roadmap?.length
                        ? translatedPlan.roadmap
                        : (plan.translatedPlan?.roadmap?.length ? plan.translatedPlan.roadmap : activeRoadmap)
                );

            // Build EN version of plan (using original EN roadmap + current basicInfo edits)
            const enPlan: LessonPlanResponse = {
                ...plan,
                roadmap: enRoadmap,
                basicInfo: { ...plan.basicInfo, ...basicInfo },
                handbook: handbookPages,
                supplies,
                safetyProtocol,
            };

            // Build ZH version of plan (using ZH roadmap from translatedPlan)
            const zhPlan: LessonPlanResponse = {
                ...(translatedPlan || plan),
                roadmap: zhRoadmap,
                basicInfo: { ...(translatedPlan?.basicInfo || plan.basicInfo), ...basicInfo },
                supplies,
                safetyProtocol,
            };

            // Always generate EN first (source of truth)
            const downstreamEN = await generateDownstreamContent(
                enPlan,
                snapshot,
                'en',
                abortController.signal,
                regenerationComment,
            );

            // Update EN plan state — show in UI if currently viewing EN
            if (displayLanguage === 'en') {
                if (downstreamEN.handbook) setHandbookPages(downstreamEN.handbook);
                if (downstreamEN.supplies) setSupplies(downstreamEN.supplies);
            }
            if (downstreamEN.imagePrompts) plan.imagePrompts = downstreamEN.imagePrompts;
            if (downstreamEN.notebookLMPrompt) plan.notebookLMPrompt = downstreamEN.notebookLMPrompt;
            if (downstreamEN.handbookStylePrompt) plan.handbookStylePrompt = downstreamEN.handbookStylePrompt;
            plan.handbook = downstreamEN.handbook;
            plan.supplies = downstreamEN.supplies;

            // Always generate ZH version too
            try {
                const downstreamZH = await generateDownstreamContent(
                    zhPlan,
                    snapshot,
                    'zh',
                    abortController.signal,
                    regenerationComment,
                );
                const base = translatedPlan || plan;
                setTranslatedPlan({
                    ...base,
                    handbook: downstreamZH.handbook,
                    supplies: downstreamZH.supplies,
                    _inputSnapshot: plan._inputSnapshot,
                    generationPhase: 'complete',
                });
                // If currently viewing Chinese, show ZH handbook
                if (displayLanguage === 'zh') {
                    setHandbookPages(downstreamZH.handbook);
                    setSupplies(downstreamZH.supplies);
                }
            } catch (transErr) {
                console.error('[Commit] Chinese handbook generation failed:', transErr);
            }

            // Mark phase complete
            plan.generationPhase = 'complete';

            setCommitStatus('done');
            useToast.getState().success(lang === 'zh' ? '手册和配套内容已更新！' : 'Handbook & downstream content updated!');
        } catch (err: any) {
            console.error('[Commit] Failed:', err);
            setCommitStatus('error');
            setCommitError(err.message || 'Unknown error');
            useToast.getState().error(lang === 'zh' ? `Commit 失败: ${err.message}` : `Commit failed: ${err.message}`);
        } finally {
            setIsCommitting(false);
        }
    };

    const requestPhase2Commit = (regenerationComment?: string) => {
        if (requiresPhasePlanner) {
            setPendingCommitComment(regenerationComment);
            setShowPhasePlannerModal(true);
            setActiveTab('roadmap');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
        void handleCommit(regenerationComment);
    };

    const handleConfirmPhasePlannerAndCommit = () => {
        setShowPhasePlannerModal(false);
        void handleCommit(pendingCommitComment);
    };

    const handleExportSlides = async () => {
        // Reset any stuck state from previous attempts
        resetExport();

        const available = await isProxyAvailable();
        console.log('[Export] Proxy available:', available);
        if (!available) {
            useToast.getState().error(lang === 'zh' ? '本地代理未运行，请先执行: node scripts/nlm-proxy.mjs' : 'Local proxy not running. Start it with: node scripts/nlm-proxy.mjs');
            return;
        }
        const title = plan.basicInfo?.theme || plan.missionBriefing?.title || 'Handbook';
        const detectedLang = /[\u4e00-\u9fff]/.test(title) ? 'zh' as const : 'en' as const;
        console.log('[Export] Starting export:', { title, detectedLang, pages: handbookPages.length });
        startExport(
            title,
            handbookPages,
            plan.handbookStylePrompt || '',
            detectedLang,
            mode,
            slideVersionPref,
            plan.factSheet || null,
            plan.factSheetMeta || plan._inputSnapshot?.factSheetMeta || input.factSheetMeta || null,
            null, // structurePlan not needed for NotebookLM
            JSON.stringify(roadmap)
        );
    };

    const copyToClipboard = async (text: string, type: 'image' | 'content', index: number) => {
        await navigator.clipboard.writeText(text);
        if (type === 'image') {
            setCopiedImagePrompt(index);
            setTimeout(() => setCopiedImagePrompt(null), 2000);
        } else {
            setCopiedContentPrompt(index);
            setTimeout(() => setCopiedContentPrompt(null), 2000);
        }
    };

    const handleCopyAllPrompts = async () => {
        let allPrompts = `--- Global Style Prompt ---\n${plan.handbookStylePrompt}\n\n`;
        allPrompts += handbookPages.map((page, i) =>
            `--- Page ${i + 1}: ${page.title} (${page.section}) ---\n[Layout] ${page.layoutDescription}\n[Visual] ${page.visualPrompt}\n[Content] ${page.contentPrompt}`
        ).join('\n\n');
        await navigator.clipboard.writeText(allPrompts);
        setCopiedNotebook(true);
        setTimeout(() => setCopiedNotebook(false), 2000);
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
                        handleRoadmapDragEnd={handleRoadmapDragEnd}
                        onRegeneratePhase={handleRegeneratePhase}
                        regeneratingPhase={regeneratingPhase}
                        onSyncPhase={handleSyncSinglePhase}
                        syncingPhaseIndex={syncingPhaseIndex}
                        phaseSyncTargetLanguage={displayLanguage === 'en' ? 'zh' : 'en'}
                        contentLanguage={displayLanguage}
                        onCommit={requestPhase2Commit}
                        isCommitting={isCommitting}
                        commitStatus={commitStatus}
                        commitError={commitError}
                        onCancelCommit={handleCancelCommit}
                        commitBlockReason={input.handbookMode === 'structured' ? commitBlockReason : null}
                        isPlannerMode={showPhasePlannerModal && requiresPhasePlanner}
                        onExitPlannerMode={() => setShowPhasePlannerModal(false)}
                        plannerPanel={
                            showPhasePlannerModal && requiresPhasePlanner && handbookPhasePlan ? (
                                <div className="rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden bg-white dark:bg-slate-900/80">
                                    <div className="px-4 py-3 border-b border-slate-200 dark:border-white/10 flex items-center justify-between gap-3">
                                        <div>
                                            <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                                Phase 2 Handbook Allocation
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                Set total pages, confirm auto-allocation, then fine-tune.
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setShowPhasePlannerModal(false)}
                                            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-700"
                                            title="Close planner"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                    <div className="p-4 space-y-3">
                                        <PhaseHandbookPlanner
                                            roadmap={effectiveRoadmap}
                                            value={handbookPhasePlan}
                                            onChange={setHandbookPhasePlan}
                                            lang={lang}
                                        />
                                        {commitBlockReason && (
                                            <div className="px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-700">
                                                {commitBlockReason}
                                            </div>
                                        )}
                                        <div className="pt-1 flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => setShowPhasePlannerModal(false)}
                                                className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleConfirmPhasePlannerAndCommit}
                                                disabled={isCommitting || Boolean(commitBlockReason)}
                                                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white text-sm font-bold"
                                            >
                                                {isCommitting ? 'Generating...' : 'Generate Supporting Content'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : null
                        }
                    />
                );
            case 'factsheet':
                return (plan.factSheet || plan._inputSnapshot?.factSheet) ? <TabFactSheet factSheet={plan.factSheet || plan._inputSnapshot?.factSheet || ''} /> : (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <BookOpenCheck className="w-12 h-12 text-slate-300 mb-4" />
                        <p className="text-slate-500 font-medium">{lang === 'zh' ? '暂无知识底稿' : 'No fact sheet available'}</p>
                        <p className="text-slate-400 text-sm mt-1">{lang === 'zh' ? '从课程大纲页面生成课件包时会自动创建' : 'Generated automatically when creating a kit from the curriculum page'}</p>
                    </div>
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
                        onStylePromptChange={handleStylePromptChange}
                        onExportSlides={handleExportSlides}
                        exportState={exportState}
                        onCancelExport={() => { cancelExport(); resetExport(); }}
                        slideVersionPref={slideVersionPref}
                        setSlideVersionPref={setSlideVersionPref}
                        mode={mode}
                    />
                );
            case 'poster':
                return <TabPoster />;
            default:
                return null;
        }
    };

    return (
        <div className="w-full">
            {/* Unified Sticky Header - Always Stacked */}
            <div className="flex flex-col gap-3 sticky top-6 z-40 bg-white dark:bg-slate-900/80/90 backdrop-blur-xl p-3 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm mx-4 mt-4 no-print mb-6">
                {/* Tabs Group */}
                <div className="flex flex-nowrap overflow-x-auto pb-1 gap-2 items-center hide-scrollbar w-full">
                    {(() => {
                        const hasDownstreamContent =
                            ((supplies?.permanent?.length || 0) + (supplies?.consumables?.length || 0) > 0)
                            || ((handbookPages?.length || 0) > 0)
                            || ((plan?.imagePrompts?.length || 0) > 0)
                            || Boolean(plan?.notebookLMPrompt);
                        const isRoadmapOnly = plan.generationPhase === 'roadmap_only' && !hasDownstreamContent;
                        const allTabs = [
                            { id: 'roadmap', label: t('tab.roadmap'), icon: Compass, phase1: true },
                            { id: 'supplies', label: t('tab.supplies'), icon: Box, phase1: false },
                            { id: 'factsheet', label: lang === 'zh' ? '知识底稿' : 'Fact Sheet', icon: BookOpenCheck, phase1: true },
                            { id: 'flashcards', label: t('tab.flashcards'), icon: BookOpen, phase1: false },
                            { id: 'visuals', label: t('tab.visuals'), icon: ImageIcon, phase1: false },
                            { id: 'handbook', label: t('tab.handbook'), icon: FileText, phase1: false },
                            { id: 'poster', label: lang === 'zh' ? '营销海报' : 'Social Poster', icon: Sparkles, phase1: false },
                        ];
                        const visibleTabs = isRoadmapOnly ? allTabs.filter(tab => tab.phase1) : allTabs;
                        return visibleTabs.map((tab) => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as Tab)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-bold transition-all whitespace-nowrap flex-shrink-0 ${activeTab === tab.id
                                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200/50 translate-y-[-1px]'
                                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 hover:text-slate-900'
                                        }`}
                                >
                                    <Icon className="w-3.5 h-3.5" />
                                    {tab.label}
                                </button>
                            );
                        });
                    })()}
                </div>

                {/* Phase 2 CTA — shown when only roadmap is generated */}
                {(() => {
                    const hasDownstreamContent =
                        ((supplies?.permanent?.length || 0) + (supplies?.consumables?.length || 0) > 0)
                        || ((handbookPages?.length || 0) > 0)
                        || ((plan?.imagePrompts?.length || 0) > 0)
                        || Boolean(plan?.notebookLMPrompt);
                    const isRoadmapOnly = plan.generationPhase === 'roadmap_only' && !hasDownstreamContent;
                    return isRoadmapOnly;
                })() && (
                    <div className="space-y-2 px-1">
                        <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800/30">
                            <span className="text-amber-700 dark:text-amber-300 text-sm font-medium flex-1">
                                {lang === 'zh' ? '✨ 路线图已就绪！点击生成配套手册、物料清单和视觉素材' : '✨ Roadmap ready! Generate the handbook, supplies list & visual assets'}
                            </span>
                            <button
                                onClick={() => requestPhase2Commit()}
                                disabled={isCommitting}
                                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-full transition-colors disabled:opacity-50 whitespace-nowrap"
                            >
                                {isCommitting
                                    ? (lang === 'zh' ? '⏳ 生成中...' : '⏳ Generating...')
                                    : (lang === 'zh' ? '🚀 生成配套内容' : '🚀 Generate Content')}
                            </button>
                        </div>
                        {/* Inline progress bar */}
                        {commitStatus === 'generating' && (
                            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-white/10 space-y-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                                    <span className="text-xs text-slate-600 dark:text-slate-400 flex-1">
                                        {lang === 'zh' ? 'AI 正在生成配套内容，约 30-60 秒...' : 'AI generating supporting content (~30-60s)...'}
                                    </span>
                                    <button
                                        onClick={handleCancelCommit}
                                        className="px-2.5 py-1 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-full transition-colors"
                                    >
                                        {lang === 'zh' ? '停止' : 'Stop'}
                                    </button>
                                </div>
                                <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full animate-pulse" style={{ width: '60%' }} />
                                </div>
                            </div>
                        )}
                        {commitStatus === 'error' && (
                            <div className="px-4 py-2.5 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800/30 flex items-center gap-2">
                                <span className="text-red-600 text-sm">{lang === 'zh' ? '❌ 生成失败' : '❌ Generation failed'}: {commitError}</span>
                                <button onClick={() => setCommitStatus('idle')} className="ml-auto text-xs text-red-500 hover:text-red-700 underline">
                                    {lang === 'zh' ? '关闭' : 'Dismiss'}
                                </button>
                            </div>
                        )}
                        {commitStatus === 'done' && (
                            <div className="px-4 py-2.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800/30 flex items-center gap-2">
                                <span className="text-emerald-700 text-sm font-medium">{lang === 'zh' ? '✅ 配套内容已生成！' : '✅ Supporting content generated!'}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Actions Group */}
                <div className="no-print flex items-center justify-between md:justify-end gap-3 w-full pt-2 border-t border-slate-100 dark:border-white/5">
                    <button
                        onClick={handleLanguageToggle}
                        className={`flex items-center justify-center gap-2 px-4 py-2 rounded-full font-bold text-sm transition-colors whitespace-nowrap border ${displayLanguage === 'zh'
                            ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                            : 'bg-white dark:bg-slate-900/80 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:bg-slate-50'
                            }`}
                        title={t('lp.translateTitle')}
                    >
                        <Languages className={`w-4 h-4 ${displayLanguage === 'zh' ? 'text-blue-600' : 'text-slate-500'}`} />
                        <span className="hidden md:inline">{displayLanguage === 'zh' ? t('lp.langToggle') : 'EN / 中文'}</span>
                    </button>
                    <button
                        onClick={handleSyncTranslation}
                        disabled={isSyncingTranslation}
                        className="flex items-center justify-center gap-2 px-4 py-2 rounded-full font-bold text-sm transition-colors whitespace-nowrap border bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 disabled:opacity-60"
                        title={lang === 'zh'
                            ? (displayLanguage === 'en' ? '将当前编辑内容同步翻译到中文' : '将当前编辑内容同步翻译到英文')
                            : (displayLanguage === 'en' ? 'Sync current edits to Chinese' : 'Sync current edits to English')}
                    >
                        {isSyncingTranslation ? <Loader2 className="w-4 h-4 animate-spin" /> : <Languages className="w-4 h-4" />}
                        <span className="hidden md:inline">
                            {lang === 'zh'
                                ? (displayLanguage === 'en' ? '同步到中文' : '同步到英文')
                                : (displayLanguage === 'en' ? 'Sync to Chinese' : 'Sync to English')}
                        </span>
                    </button>
                    <button
                        onClick={handlePrint}
                        className="flex items-center justify-center gap-2 px-5 py-2 bg-slate-100 text-slate-700 dark:text-slate-400 rounded-full hover:bg-slate-200 transition-colors whitespace-nowrap text-sm font-bold"
                    >
                        <Printer className="w-4 h-4" />
                        <span className="hidden md:inline">{t('lp.printView')}</span>
                    </button>


                    {onSave && (
                        <>
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
                        </>
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

            {showBackToTop && (
                <button
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="fixed bottom-6 right-6 z-50 w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg flex items-center justify-center transition-colors"
                    title="Back to top"
                    aria-label="Back to top"
                >
                    <ChevronUp size={18} />
                </button>
            )}



        </div>
    );
};
