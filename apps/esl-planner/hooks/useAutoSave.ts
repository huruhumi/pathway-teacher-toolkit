import { useState, useEffect, useRef, useCallback } from 'react';
import { GeneratedContent } from '../types';

export type SaveStatus = 'saved' | 'saving' | 'unsaved';

interface UseAutoSaveProps {
    getCurrentContentObject: () => GeneratedContent;
    onSave: (content: GeneratedContent) => void;
    editablePlan: any;
    debounceMs?: number;
}

export const useAutoSave = ({
    getCurrentContentObject,
    onSave,
    editablePlan,
    debounceMs = 3000,
}: UseAutoSaveProps) => {
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSnapshotRef = useRef<string>('');
    const isMountedRef = useRef(true);

    // Cleanup on unmount
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    const performSave = useCallback(() => {
        if (!editablePlan || !isMountedRef.current) return;
        setSaveStatus('saving');
        try {
            const currentData = getCurrentContentObject();
            onSave(currentData);

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
        }
    }, [editablePlan, getCurrentContentObject, onSave]);

    // Watch for changes and debounce
    useEffect(() => {
        if (!editablePlan) return;

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
                performSave();
            }, debounceMs);
        }
    });

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
        performSave();
    }, [performSave]);

    return { saveStatus, lastSaved, saveNow };
};
