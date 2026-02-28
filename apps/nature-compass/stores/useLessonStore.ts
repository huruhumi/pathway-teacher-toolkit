import { create } from 'zustand';
import { LessonPlanResponse, RoadmapItem, SupplyList, VocabularyItem, VisualReferenceItem, HandbookPage } from '../types';

export interface BasicInfoState {
    theme: string;
    activityType: string;
    targetAudience: string;
    learningGoals: string[];
    location: string;
}

export interface LessonStore {
    // --- Core Plan Data (editable) ---
    roadmap: RoadmapItem[];
    basicInfo: BasicInfoState;
    missionBriefing: { title: string; narrative: string };
    durationDisplay: string;
    supplies: SupplyList;
    safetyProtocol: string[];
    vocabList: VocabularyItem[];
    visualRefs: VisualReferenceItem[];
    handbookPages: HandbookPage[];

    // --- Language ---
    displayLanguage: 'en' | 'zh';
    translatedPlan: LessonPlanResponse | null;

    // --- Badge ---
    badgeImage: string | null;
    loadingBadge: boolean;
    badgePrompt: string;

    // --- Flashcard Assets ---
    generatedImages: Record<number, string>;
    loadingImages: Set<number>;
    artStyles: Record<number, string>;
    isAddingWord: boolean;

    // --- Visual Assets ---
    generatedVisuals: Record<number, string>;
    loadingVisuals: Set<number>;
    visualStyles: Record<number, string>;
    isAddingVisual: boolean;

    // --- Roadmap Loading ---
    generatingStepFor: number | null;
    isAddingRoadmapItem: boolean;
    generatingExtraFor: { roadmapIndex: number; type: 'info' | 'tip' } | null;

    // --- Drag & Drop ---
    draggedStep: { itemIndex: number; stepIndex: number } | null;
    draggedRoadmapIndex: number | null;

    // --- Actions ---
    setRoadmap: (roadmap: RoadmapItem[] | ((prev: RoadmapItem[]) => RoadmapItem[])) => void;
    setBasicInfo: (info: BasicInfoState | ((prev: BasicInfoState) => BasicInfoState)) => void;
    setMissionBriefing: (mb: { title: string; narrative: string } | ((prev: { title: string; narrative: string }) => { title: string; narrative: string })) => void;
    setDurationDisplay: (d: string) => void;
    setSupplies: (s: SupplyList | ((prev: SupplyList) => SupplyList)) => void;
    setSafetyProtocol: (s: string[] | ((prev: string[]) => string[])) => void;
    setVocabList: (v: VocabularyItem[] | ((prev: VocabularyItem[]) => VocabularyItem[])) => void;
    setVisualRefs: (v: VisualReferenceItem[] | ((prev: VisualReferenceItem[]) => VisualReferenceItem[])) => void;
    setHandbookPages: (h: HandbookPage[] | ((prev: HandbookPage[]) => HandbookPage[])) => void;
    setDisplayLanguage: (l: 'en' | 'zh') => void;
    setTranslatedPlan: (p: LessonPlanResponse | null) => void;
    setBadgeImage: (img: string | null) => void;
    setLoadingBadge: (b: boolean) => void;
    setBadgePrompt: (p: string) => void;
    setGeneratedImages: (imgs: Record<number, string> | ((prev: Record<number, string>) => Record<number, string>)) => void;
    setLoadingImages: (s: Set<number> | ((prev: Set<number>) => Set<number>)) => void;
    setArtStyles: (s: Record<number, string> | ((prev: Record<number, string>) => Record<number, string>)) => void;
    setIsAddingWord: (b: boolean) => void;
    setGeneratedVisuals: (v: Record<number, string> | ((prev: Record<number, string>) => Record<number, string>)) => void;
    setLoadingVisuals: (s: Set<number> | ((prev: Set<number>) => Set<number>)) => void;
    setVisualStyles: (s: Record<number, string> | ((prev: Record<number, string>) => Record<number, string>)) => void;
    setIsAddingVisual: (b: boolean) => void;
    setGeneratingStepFor: (n: number | null) => void;
    setIsAddingRoadmapItem: (b: boolean) => void;
    setGeneratingExtraFor: (g: { roadmapIndex: number; type: 'info' | 'tip' } | null) => void;
    setDraggedStep: (d: { itemIndex: number; stepIndex: number } | null) => void;
    setDraggedRoadmapIndex: (n: number | null) => void;

    // Bulk initializer
    applyPlanToState: (p: LessonPlanResponse) => void;
    resetAssets: () => void;
}

// Helper to handle function-or-value setters like React's setState
const resolveValue = <T>(val: T | ((prev: T) => T), prev: T): T =>
    typeof val === 'function' ? (val as (prev: T) => T)(prev) : val;

export const useLessonStore = create<LessonStore>((set, get) => ({
    // --- Initial State ---
    roadmap: [],
    basicInfo: { theme: '', activityType: '', targetAudience: '', learningGoals: [], location: 'Outdoor Park / School Garden' },
    missionBriefing: { title: '', narrative: '' },
    durationDisplay: '180 Minutes',
    supplies: { permanent: [], consumables: [] },
    safetyProtocol: [],
    vocabList: [],
    visualRefs: [],
    handbookPages: [],
    displayLanguage: 'en',
    translatedPlan: null,
    badgeImage: null,
    loadingBadge: false,
    badgePrompt: '',
    generatedImages: {},
    loadingImages: new Set(),
    artStyles: {},
    isAddingWord: false,
    generatedVisuals: {},
    loadingVisuals: new Set(),
    visualStyles: {},
    isAddingVisual: false,
    generatingStepFor: null,
    isAddingRoadmapItem: false,
    generatingExtraFor: null,
    draggedStep: null,
    draggedRoadmapIndex: null,

    // --- Setters ---
    setRoadmap: (roadmap) => set((s) => ({ roadmap: resolveValue(roadmap, s.roadmap) })),
    setBasicInfo: (info) => set((s) => ({ basicInfo: resolveValue(info, s.basicInfo) })),
    setMissionBriefing: (mb) => set((s) => ({ missionBriefing: resolveValue(mb, s.missionBriefing) })),
    setDurationDisplay: (d) => set({ durationDisplay: d }),
    setSupplies: (s) => set((state) => ({ supplies: resolveValue(s, state.supplies) })),
    setSafetyProtocol: (s) => set((state) => ({ safetyProtocol: resolveValue(s, state.safetyProtocol) })),
    setVocabList: (v) => set((state) => ({ vocabList: resolveValue(v, state.vocabList) })),
    setVisualRefs: (v) => set((state) => ({ visualRefs: resolveValue(v, state.visualRefs) })),
    setHandbookPages: (h) => set((state) => ({ handbookPages: resolveValue(h, state.handbookPages) })),
    setDisplayLanguage: (l) => set({ displayLanguage: l }),
    setTranslatedPlan: (p) => set({ translatedPlan: p }),
    setBadgeImage: (img) => set({ badgeImage: img }),
    setLoadingBadge: (b) => set({ loadingBadge: b }),
    setBadgePrompt: (p) => set({ badgePrompt: p }),
    setGeneratedImages: (imgs) => set((s) => ({ generatedImages: resolveValue(imgs, s.generatedImages) })),
    setLoadingImages: (s) => set((state) => ({ loadingImages: resolveValue(s, state.loadingImages) })),
    setArtStyles: (s) => set((state) => ({ artStyles: resolveValue(s, state.artStyles) })),
    setIsAddingWord: (b) => set({ isAddingWord: b }),
    setGeneratedVisuals: (v) => set((s) => ({ generatedVisuals: resolveValue(v, s.generatedVisuals) })),
    setLoadingVisuals: (s) => set((state) => ({ loadingVisuals: resolveValue(s, state.loadingVisuals) })),
    setVisualStyles: (s) => set((state) => ({ visualStyles: resolveValue(s, state.visualStyles) })),
    setIsAddingVisual: (b) => set({ isAddingVisual: b }),
    setGeneratingStepFor: (n) => set({ generatingStepFor: n }),
    setIsAddingRoadmapItem: (b) => set({ isAddingRoadmapItem: b }),
    setGeneratingExtraFor: (g) => set({ generatingExtraFor: g }),
    setDraggedStep: (d) => set({ draggedStep: d }),
    setDraggedRoadmapIndex: (n) => set({ draggedRoadmapIndex: n }),

    // --- Bulk Actions ---
    applyPlanToState: (p: LessonPlanResponse) => {
        const cleanedRoadmap = p.roadmap.map(item => ({
            ...item,
            steps: item.steps ? item.steps.map(s => s.replace(/^\d+\.\s*/, '')) : [],
            backgroundInfo: item.backgroundInfo || [],
            teachingTips: item.teachingTips || []
        }));
        set({
            roadmap: cleanedRoadmap,
            basicInfo: {
                ...p.basicInfo,
                location: (p.basicInfo as any).location || 'Outdoor Park / School Garden'
            },
            missionBriefing: p.missionBriefing,
            durationDisplay: '180 Minutes',
            supplies: p.supplies,
            safetyProtocol: Array.isArray(p.safetyProtocol) ? p.safetyProtocol : [p.safetyProtocol],
            vocabList: p.vocabulary.keywords || [],
            visualRefs: p.visualReferences || [],
            handbookPages: p.handbook || [],
        });
    },

    resetAssets: () => set({
        generatedImages: {},
        loadingImages: new Set(),
        artStyles: {},
        isAddingWord: false,
        generatedVisuals: {},
        loadingVisuals: new Set(),
        visualStyles: {},
        isAddingVisual: false,
        isAddingRoadmapItem: false,
        badgeImage: null,
        loadingBadge: false,
    }),
}));
