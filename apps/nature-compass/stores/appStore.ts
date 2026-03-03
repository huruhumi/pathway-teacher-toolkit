import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { LessonPlanResponse, Curriculum, CurriculumParams, SavedLessonPlan, SavedCurriculum, LessonInput } from '../types';

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
    } | null;
    setExternalCurriculum: (cur: any) => void;

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

            clearSessionState: () => set({
                lessonPlan: null, curriculumResult: null, externalCurriculum: null
            })
        }),
        {
            name: 'nc-session-state',
            storage: createJSONStorage(() => sessionStorage),
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
        theme: '', topicIntroduction: '', activityFocus: [],
        weather: 'Sunny', season: 'Spring',
        studentAge: '6-8 years (Early Primary)', studentCount: 12,
        duration: 180, cefrLevel: 'A1 (Beginner)', handbookPages: 15,
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
