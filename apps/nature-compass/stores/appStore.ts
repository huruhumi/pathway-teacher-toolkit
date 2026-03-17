import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { LessonPlanResponse, Curriculum, CurriculumParams, SavedLessonPlan, SavedCurriculum, LessonInput } from '../types';
import { getDefaultPageConfig } from '../constants/handbookDefaults';
import type { RAGProgress } from '@pathway/notebooklm';

interface SessionState {
    lessonPlan: LessonPlanResponse | null;
    setLessonPlan: (plan: LessonPlanResponse | null) => void;

    curriculumResult: {
        curriculumEN: Curriculum | null;
        curriculumCN: Curriculum | null;
        params: CurriculumParams;
        activeLanguage: 'en' | 'zh';
    } | null;
    setCurriculumResult: (res: any) => void; // Using any for simplicity with complex functional updates

    externalCurriculum: {
        curriculum: Curriculum; params: CurriculumParams; language?: 'en' | 'zh';
        pairedCurriculum?: Curriculum; // The other language version if found
    } | null;
    setExternalCurriculum: (cur: any) => void;

    // RAG state — persists across page navigation
    ragProgress: RAGProgress | null;
    setRagProgress: (p: RAGProgress | null) => void;
    ragFactSheets: Array<{ lessonIndex: number; content: string; quality: string }> | null;
    setRagFactSheets: (fs: Array<{ lessonIndex: number; content: string; quality: string }> | null) => void;

    clearSessionState: () => void;
}

export const useSessionStore = create<SessionState>()(
    persist(
        (set, get) => ({
            lessonPlan: null,
            setLessonPlan: (plan) => set({ lessonPlan: plan }),

            curriculumResult: null,
            setCurriculumResult: (res) => set({
                curriculumResult: typeof res === 'function' ? res(get().curriculumResult) : res
            }),

            externalCurriculum: null,
            setExternalCurriculum: (cur) => set({
                externalCurriculum: typeof cur === 'function' ? cur(get().externalCurriculum) : cur
            }),

            ragProgress: null,
            setRagProgress: (p) => set({ ragProgress: p }),
            ragFactSheets: null,
            setRagFactSheets: (fs) => set({ ragFactSheets: fs }),

            clearSessionState: () => set({
                lessonPlan: null, curriculumResult: null, externalCurriculum: null,
                ragProgress: null, ragFactSheets: null,
            })
        }),
        {
            name: 'nc-session-state',
            storage: createJSONStorage(() => sessionStorage),
            partialize: (state) => ({
                lessonPlan: state.lessonPlan,
                curriculumResult: state.curriculumResult,
                externalCurriculum: state.externalCurriculum,
                // ragProgress and ragFactSheets excluded — large ephemeral data
            }),
        }
    )
);

interface AppState {
    input: LessonInput;
    setInput: (input: LessonInput | ((prev: LessonInput) => LessonInput)) => void;

    currentPlanId: string | null;
    setCurrentPlanId: (id: string | null) => void;

    currentKitLanguage: 'en' | 'zh';
    setCurrentKitLanguage: (lang: 'en' | 'zh') => void;
}

export const useAppStore = create<AppState>((set, get) => ({
    input: {
        mode: 'school', familyEslEnabled: false,
        theme: '', topicIntroduction: '', activityFocus: [],
        weather: 'Sunny', season: 'Spring',
        studentAge: '6-8 years (Early Primary)', studentCount: 12,
        duration: 180, cefrLevel: 'A1 (Beginner)',
        handbookMode: 'auto', handbookPreset: 'deep', handbookPageConfig: getDefaultPageConfig(),
        uploadedFiles: [],
    },
    setInput: (input) => set({
        input: typeof input === 'function' ? input(get().input) : input
    }),

    currentPlanId: null,
    setCurrentPlanId: (id) => set({ currentPlanId: id }),

    currentKitLanguage: 'en',
    setCurrentKitLanguage: (lang) => set({ currentKitLanguage: lang })
}));
