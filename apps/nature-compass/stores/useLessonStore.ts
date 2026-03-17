import { create } from 'zustand';
import { LessonPlanResponse, RoadmapItem, SupplyList, VocabularyItem, VisualReferenceItem, HandbookPage } from '../types';
import type { ThemePalette } from '../services/gemini/poster';
import localforage from 'localforage';

// Dedicated localforage instance for poster assets (survives refresh, large capacity)
const posterDB = localforage.createInstance({ name: 'nc-poster-assets' });

// --- Session persistence helpers for core plan data ---
const PLAN_KEY = 'nc_planData';

function loadPersistedPlan() {
    try {
        const raw = sessionStorage.getItem(PLAN_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

function savePlanData(fields: Record<string, unknown>) {
    try {
        const existing = loadPersistedPlan() || {};
        sessionStorage.setItem(PLAN_KEY, JSON.stringify({ ...existing, ...fields }));
    } catch { /* quota exceeded — non-critical */ }
}

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

    // --- Badge (Legacy) ---
    badgeImage: string | null;
    loadingBadge: boolean;
    badgePrompt: string;

    // --- Poster ---
    posterType: 'cover' | 'intro' | 'showcase' | 'allpages';
    posterPlatform: 'wechat' | 'xhs';
    posterLanguage: 'en' | 'zh';
    posterCopy: string;
    posterBgImage: string | null;
    posterHydrated: boolean;
    showcaseImages: string[];
    gridImages: string[];
    loadingPosterCopy: boolean;
    loadingPosterImage: boolean;
    posterPrompt: string;
    themePalette: ThemePalette | null;

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

    // Poster setters
    setPosterType: (t: 'cover' | 'intro' | 'showcase') => void;
    setPosterPlatform: (pf: 'wechat' | 'xhs') => void;
    setPosterLanguage: (l: 'en' | 'zh') => void;
    setPosterCopy: (p: string) => void;
    setPosterBgImage: (img: string | null) => void;
    setShowcaseImages: (imgs: string[] | ((prev: string[]) => string[])) => void;
    setGridImages: (imgs: string[] | ((prev: string[]) => string[])) => void;
    setLoadingPosterCopy: (b: boolean) => void;
    setLoadingPosterImage: (b: boolean) => void;
    setPosterPrompt: (p: string) => void;
    setThemePalette: (p: ThemePalette | null) => void;
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

export const useLessonStore = create<LessonStore>((set, get) => {
    const saved = loadPersistedPlan();
    return ({
        // --- Initial State (hydrated from sessionStorage if available) ---
        roadmap: saved?.roadmap || [],
        basicInfo: saved?.basicInfo || { theme: '', activityType: '', targetAudience: '', learningGoals: [], location: 'Outdoor Park / School Garden' },
        missionBriefing: saved?.missionBriefing || { title: '', narrative: '' },
        durationDisplay: saved?.durationDisplay || '180 Minutes',
        supplies: saved?.supplies || { permanent: [], consumables: [] },
        safetyProtocol: saved?.safetyProtocol || [],
        vocabList: saved?.vocabList || [],
        visualRefs: saved?.visualRefs || [],
        handbookPages: saved?.handbookPages || [],
        displayLanguage: 'en',
        translatedPlan: null,
        badgeImage: null,
        loadingBadge: false,
        badgePrompt: '',

        posterType: (sessionStorage.getItem('nc_posterType') as any) || 'cover',
        posterPlatform: (sessionStorage.getItem('nc_posterPlatform') as any) || 'xhs',
        posterLanguage: 'zh',
        posterCopy: sessionStorage.getItem('nc_posterCopy') || '',
        posterBgImage: null as string | null,  // hydrated async from localforage
        posterHydrated: false,
        showcaseImages: [] as string[],  // hydrated async from localforage
        gridImages: [] as string[],  // hydrated async from localforage
        loadingPosterCopy: false,
        loadingPosterImage: false,
        posterPrompt: sessionStorage.getItem('nc_posterPrompt') || '',
        themePalette: (() => { try { const s = sessionStorage.getItem('nc_themePalette'); return s ? JSON.parse(s) : null; } catch { return null; } })(),
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
        setRoadmap: (roadmap) => set((s) => { const v = resolveValue(roadmap, s.roadmap); savePlanData({ roadmap: v }); return { roadmap: v }; }),
        setBasicInfo: (info) => set((s) => { const v = resolveValue(info, s.basicInfo); savePlanData({ basicInfo: v }); return { basicInfo: v }; }),
        setMissionBriefing: (mb) => set((s) => { const v = resolveValue(mb, s.missionBriefing); savePlanData({ missionBriefing: v }); return { missionBriefing: v }; }),
        setDurationDisplay: (d) => { savePlanData({ durationDisplay: d }); set({ durationDisplay: d }); },
        setSupplies: (s) => set((state) => { const v = resolveValue(s, state.supplies); savePlanData({ supplies: v }); return { supplies: v }; }),
        setSafetyProtocol: (s) => set((state) => { const v = resolveValue(s, state.safetyProtocol); savePlanData({ safetyProtocol: v }); return { safetyProtocol: v }; }),
        setVocabList: (v) => set((state) => { const val = resolveValue(v, state.vocabList); savePlanData({ vocabList: val }); return { vocabList: val }; }),
        setVisualRefs: (v) => set((state) => { const val = resolveValue(v, state.visualRefs); savePlanData({ visualRefs: val }); return { visualRefs: val }; }),
        setHandbookPages: (h) => set((state) => ({ handbookPages: resolveValue(h, state.handbookPages) })),
        setDisplayLanguage: (l) => set({ displayLanguage: l }),
        setTranslatedPlan: (p) => set({ translatedPlan: p }),
        setBadgeImage: (img) => set((s) => {
            if (s.badgeImage && s.badgeImage.startsWith('blob:')) URL.revokeObjectURL(s.badgeImage);
            return { badgeImage: img };
        }),
        setLoadingBadge: (b) => set({ loadingBadge: b }),
        setBadgePrompt: (p) => set({ badgePrompt: p }),

        // Poster Setters
        setPosterType: (t) => set({ posterType: t }),
        setPosterPlatform: (pf) => { sessionStorage.setItem('nc_posterPlatform', pf); set({ posterPlatform: pf }); },
        setPosterLanguage: (l) => set({ posterLanguage: l }),
        setPosterCopy: (c) => { sessionStorage.setItem('nc_posterCopy', c); set({ posterCopy: c }); },
        setPosterBgImage: (img) => set((s) => {
            if (s.posterBgImage && s.posterBgImage.startsWith('blob:')) URL.revokeObjectURL(s.posterBgImage);
            // Persist to localforage (IndexedDB) — no quota issues with large images
            if (img) {
                posterDB.setItem('posterBgImage', img).catch(e => console.warn('[poster] localforage save failed:', e));
            } else {
                posterDB.removeItem('posterBgImage').catch(() => { });
            }
            return { posterBgImage: img };
        }),
        setShowcaseImages: (images) => set((s) => {
            const next = resolveValue(images, s.showcaseImages);
            posterDB.setItem('showcaseImages', next).catch(() => { });
            return { showcaseImages: next };
        }),
        setGridImages: (images) => set((s) => {
            const next = resolveValue(images, s.gridImages);
            posterDB.setItem('gridImages', next).catch(() => { });
            return { gridImages: next };
        }),
        setLoadingPosterCopy: (b) => set({ loadingPosterCopy: b }),
        setLoadingPosterImage: (b) => set({ loadingPosterImage: b }),
        setPosterPrompt: (p) => { sessionStorage.setItem('nc_posterPrompt', p); set({ posterPrompt: p }); },
        setThemePalette: (p) => { try { if (p) sessionStorage.setItem('nc_themePalette', JSON.stringify(p)); else sessionStorage.removeItem('nc_themePalette'); } catch { } set({ themePalette: p }); },

        setGeneratedImages: (imgs) => set((s) => {
            const next = resolveValue(imgs, s.generatedImages);
            // Revoke blob URLs for keys being overwritten
            for (const key of Object.keys(s.generatedImages)) {
                const oldUrl = s.generatedImages[key];
                const newUrl = next[key];
                if (oldUrl && oldUrl !== newUrl && oldUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(oldUrl);
                }
            }
            return { generatedImages: next };
        }),
        setLoadingImages: (s) => set((state) => ({ loadingImages: resolveValue(s, state.loadingImages) })),
        setArtStyles: (s) => set((state) => ({ artStyles: resolveValue(s, state.artStyles) })),
        setIsAddingWord: (b) => set({ isAddingWord: b }),
        setGeneratedVisuals: (v) => set((s) => {
            const next = resolveValue(v, s.generatedVisuals);
            // Revoke blob URLs for keys being overwritten
            for (const key of Object.keys(s.generatedVisuals)) {
                const oldUrl = s.generatedVisuals[key];
                const newUrl = next[key];
                if (oldUrl && oldUrl !== newUrl && oldUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(oldUrl);
                }
            }
            return { generatedVisuals: next };
        }),
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
            const newState = {
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
            };
            savePlanData(newState);
            set(newState);
        },

        resetAssets: () => set((s) => {
            if (s.badgeImage && s.badgeImage.startsWith('blob:')) URL.revokeObjectURL(s.badgeImage);
            if (s.posterBgImage && s.posterBgImage.startsWith('blob:')) URL.revokeObjectURL(s.posterBgImage);
            Object.values(s.generatedImages).forEach(url => { if (url.startsWith('blob:')) URL.revokeObjectURL(url); });
            Object.values(s.generatedVisuals).forEach(url => { if (url.startsWith('blob:')) URL.revokeObjectURL(url); });

            // Clear poster storage so new lesson starts fresh
            ['nc_posterCopy', 'nc_posterPrompt', 'nc_themePalette', PLAN_KEY].forEach(k => sessionStorage.removeItem(k));
            posterDB.clear().catch(() => { });

            return {
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
                posterBgImage: null,
                posterCopy: '',
                posterPrompt: '',
                themePalette: null,
                showcaseImages: [],
                gridImages: [],
                loadingPosterImage: false,
            };
        }),
    });
});

// Hydrate poster assets from IndexedDB (async, runs once on module load)
(async () => {
    try {
        const [bg, showcase, grid] = await Promise.all([
            posterDB.getItem<string>('posterBgImage'),
            posterDB.getItem<string[]>('showcaseImages'),
            posterDB.getItem<string[]>('gridImages'),
        ]);
        useLessonStore.setState({
            ...(bg ? { posterBgImage: bg } : {}),
            ...(showcase?.length ? { showcaseImages: showcase } : {}),
            ...(grid?.length ? { gridImages: grid } : {}),
            posterHydrated: true,
        });
    } catch (e) {
        console.warn('[poster] localforage hydration failed:', e);
        useLessonStore.setState({ posterHydrated: true });
    }
})();
