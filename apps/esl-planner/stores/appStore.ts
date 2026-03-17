import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AppState as ESLAppState, SavedLesson, SavedCurriculum, ESLCurriculum, CurriculumParams } from '../types';
import { MappedESLInput } from '../utils/curriculumMapper';

interface SessionState {
    state: ESLAppState;
    setState: (state: ESLAppState | ((prev: ESLAppState) => ESLAppState)) => void;

    loadedCurriculum: { curriculum: ESLCurriculum; params: CurriculumParams } | null;
    setLoadedCurriculum: (cur: { curriculum: ESLCurriculum; params: CurriculumParams } | null) => void;

    clearSessionState: () => void;
}

export const useSessionStore = create<SessionState>()(
    persist(
        (set, get) => ({
            state: { isLoading: false, generatedContent: null, error: null },
            setState: (stateArg) => set({
                state: typeof stateArg === 'function' ? stateArg(get().state) : stateArg
            }),

            loadedCurriculum: null,
            setLoadedCurriculum: (cur) => set({ loadedCurriculum: cur }),

            clearSessionState: () => set({
                state: { isLoading: false, generatedContent: null, error: null },
                loadedCurriculum: null
            })
        }),
        {
            name: 'esl-planner-session',
            storage: createJSONStorage(() => sessionStorage),
            partialize: (state) => ({
                state: {
                    ...state.state,
                    // Strip generatedContent from persistence — it can be very large
                    generatedContent: null,
                },
                loadedCurriculum: state.loadedCurriculum,
            }),
        }
    )
);

interface AppStoreState {
    activeLessonId: string | null;
    setActiveLessonId: (id: string | null) => void;

    prefilledValues: MappedESLInput | null;
    setPrefilledValues: (val: MappedESLInput | null) => void;

    // Filter states
    curSearch: string; setCurSearch: (v: string) => void;
    curLevel: string; setCurLevel: (v: string) => void;
    curDate: string; setCurDate: (v: string) => void;
    curSort: string; setCurSort: (v: string) => void;
    curLessonRange: string; setCurLessonRange: (v: string) => void;

    kitSearch: string; setKitSearch: (v: string) => void;
    kitLevel: string; setKitLevel: (v: string) => void;
    kitDate: string; setKitDate: (v: string) => void;
    kitSort: string; setKitSort: (v: string) => void;
    kitTextbook: string; setKitTextbook: (v: string) => void;

    recordsTab: 'curricula' | 'kits'; setRecordsTab: (v: 'curricula' | 'kits') => void;
}

export const useAppStore = create<AppStoreState>((set, get) => ({
    activeLessonId: null,
    setActiveLessonId: (id) => set({ activeLessonId: id }),

    prefilledValues: null,
    setPrefilledValues: (val) => set({ prefilledValues: val }),

    curSearch: '', setCurSearch: (v) => set({ curSearch: v }),
    curLevel: 'All Levels', setCurLevel: (v) => set({ curLevel: v }),
    curDate: 'all', setCurDate: (v) => set({ curDate: v }),
    curSort: 'newest', setCurSort: (v) => set({ curSort: v }),
    curLessonRange: 'all', setCurLessonRange: (v) => set({ curLessonRange: v }),

    kitSearch: '', setKitSearch: (v) => set({ kitSearch: v }),
    kitLevel: 'All Levels', setKitLevel: (v) => set({ kitLevel: v }),
    kitDate: 'all', setKitDate: (v) => set({ kitDate: v }),
    kitSort: 'newest', setKitSort: (v) => set({ kitSort: v }),
    kitTextbook: 'all', setKitTextbook: (v) => set({ kitTextbook: v }),

    recordsTab: 'curricula', setRecordsTab: (v) => set({ recordsTab: v })
}));
