import { useState, useEffect, useRef, useCallback } from 'react';
import * as edu from '@pathway/education';

/**
 * Auto-save hook for student assignment drafts.
 * Debounces answer changes and saves content to DB without touching status.
 * Uses useRef to avoid stale closure issues.
 */
export function useAutoSave(
    submissionId: string | undefined,
    answers: any,
    enabled: boolean,
    debounceMs = 3000
) {
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const answersRef = useRef(answers);
    const prevAnswersJson = useRef<string>('');

    // Keep ref in sync with latest answers
    useEffect(() => {
        answersRef.current = answers;
    }, [answers]);

    const save = useCallback(async () => {
        if (!submissionId) return;
        const json = JSON.stringify(answersRef.current);
        // Skip if nothing changed since last save
        if (json === prevAnswersJson.current) return;
        prevAnswersJson.current = json;
        setIsSaving(true);
        try {
            await edu.upsertSubmission({
                id: submissionId,
                content: answersRef.current,
            });
            setLastSaved(new Date());
        } catch (err) {
            console.error('[useAutoSave] save failed:', err);
        } finally {
            setIsSaving(false);
        }
    }, [submissionId]);

    useEffect(() => {
        if (!enabled || !submissionId) return;
        const timer = setTimeout(save, debounceMs);
        return () => clearTimeout(timer);
    }, [answers, enabled, submissionId, save, debounceMs]);

    return { isSaving, lastSaved };
}
