import { useState, useEffect, useRef, useCallback } from 'react';

export type SaveStatus = 'saved' | 'saving' | 'unsaved';

interface UseAutoSaveProps<T> {
    getCurrentContentObject: () => T;
    onSave: (content: T) => void | Promise<unknown>;
    editablePlan: any;
    debounceMs?: number;
}

export const useAutoSave = <T>({
    getCurrentContentObject,
    onSave,
    editablePlan,
    debounceMs = 3000,
}: UseAutoSaveProps<T>) => {
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSnapshotRef = useRef<string>('');
    const isMountedRef = useRef(true);
    const isSavingRef = useRef(false);

    // Cleanup on unmount
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    const performSave = useCallback(async () => {
        if (!editablePlan || !isMountedRef.current || isSavingRef.current) return;
        isSavingRef.current = true;
        setSaveStatus('saving');
        try {
            const currentData = getCurrentContentObject();
            const result = await onSave(currentData) as { ok?: boolean; message?: string } | void;
            if (result && typeof result === 'object' && 'ok' in result && result.ok === false) {
                throw new Error(result.message || 'Save failed.');
            }

            const snapshot = JSON.stringify(currentData);
            lastSnapshotRef.current = snapshot;

            if (isMountedRef.current) {
                setLastSaved(new Date());
                setSaveStatus('saved');
            }
        } catch (error) {
            console.error('Auto-save failed:', error);
            if (isMountedRef.current) {
                setSaveStatus('unsaved');
            }
        } finally {
            isSavingRef.current = false;
        }
    }, [editablePlan, getCurrentContentObject, onSave]);

    // Watch for changes and debounce
    useEffect(() => {
        if (!editablePlan) return;
        if (isSavingRef.current) return;

        let currentSnapshot: string;
        try {
            currentSnapshot = JSON.stringify(getCurrentContentObject());
        } catch {
            return;
        }

        // Initialize snapshot on first run
        if (!lastSnapshotRef.current) {
            lastSnapshotRef.current = currentSnapshot;
            return;
        }

        // If content changed, mark unsaved and start debounce
        if (currentSnapshot !== lastSnapshotRef.current) {
            setSaveStatus('unsaved');

            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => {
                void performSave();
            }, debounceMs);
        }
    }, [debounceMs, editablePlan, getCurrentContentObject, performSave]);

    // beforeunload warning
    useEffect(() => {
        const handler = (e: BeforeUnloadEvent) => {
            if (saveStatus === 'unsaved') {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [saveStatus]);

    const saveNow = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        void performSave();
    }, [performSave]);

    return { saveStatus, lastSaved, saveNow };
};
