import { useState, useCallback } from 'react';

/**
 * Shared clipboard hook with auto-reset visual feedback.
 * Replaces the duplicated clipboard + setTimeout pattern found in 7+ files.
 */
export function useClipboard(resetMs = 2000) {
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const copy = useCallback(async (text: string, id?: string) => {
        await navigator.clipboard.writeText(text);
        setCopiedId(id ?? 'default');
        setTimeout(() => setCopiedId(null), resetMs);
    }, [resetMs]);

    return { copiedId, copy };
}
