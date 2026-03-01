/**
 * Safe localStorage wrapper with quota-exceeded handling.
 * All JSON parse/stringify errors and quota exceeded errors are caught gracefully.
 */
export const safeStorage = {
    get<T>(key: string, fallback: T): T {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch {
            return fallback;
        }
    },

    set(key: string, value: unknown): boolean {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.warn(`[safeStorage] Failed to write key "${key}":`, e);
            return false;
        }
    },

    remove(key: string): void {
        try {
            localStorage.removeItem(key);
        } catch { }
    },
};
