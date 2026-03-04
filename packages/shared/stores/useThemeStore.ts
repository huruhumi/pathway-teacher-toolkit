import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { safeStorage } from '../safeStorage';

interface ThemeState {
    isDarkMode: boolean;
    toggleDarkMode: () => void;
    setDarkMode: (isDark: boolean) => void;
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set) => ({
            isDarkMode: safeStorage.get('pathway_darkMode', false), // Initialize from old key for migration
            toggleDarkMode: () => {
                set((state) => {
                    const newValue = !state.isDarkMode;
                    applyThemeClass(newValue);
                    return { isDarkMode: newValue };
                });
            },
            setDarkMode: (isDark) => {
                set({ isDarkMode: isDark });
                applyThemeClass(isDark);
            },
        }),
        {
            name: 'pathway-theme-storage', // unique name
            storage: createJSONStorage(() => localStorage),
            onRehydrateStorage: () => (state) => {
                // Apply theme immediately after store loads from localStorage
                if (state) {
                    applyThemeClass(state.isDarkMode);
                }
            },
        }
    )
);

// Helper to interact with the DOM
const applyThemeClass = (isDark: boolean) => {
    if (typeof document !== 'undefined') {
        if (isDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }
};
