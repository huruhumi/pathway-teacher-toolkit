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

    /**
     * Set an array value with a max record limit.
     * If the array exceeds maxRecords, the oldest entries (beginning of array) are trimmed.
     * Returns the trimmed items (if any) so callers can clean up related data (e.g. IndexedDB images).
     */
    setWithLimit<T>(key: string, value: T[], maxRecords: number = 50): { trimmed: T[]; success: boolean } {
        const trimmed = value.length > maxRecords ? value.slice(0, value.length - maxRecords) : [];
        const kept = value.length > maxRecords ? value.slice(-maxRecords) : value;
        const success = this.set(key, kept);
        return { trimmed, success };
    },
};
