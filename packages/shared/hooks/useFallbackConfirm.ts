import { useRef, useState, useCallback } from 'react';

export interface FallbackPromptContent {
    title: string;
    detail: string;
}

/**
 * Hook that returns a promise-based API for pausing async generation
 * and asking the user to confirm/cancel a fallback scenario.
 *
 * Usage inside an async generation function:
 *   const choice = await askFallbackConfirm(title, detail);
 *   if (choice === 'cancel') throw new Error('AbortError');
 *
 * The component tree should render <FallbackPrompt /> when
 * `pendingFallback` is non-null.
 */
export function useFallbackConfirm() {
    const resolverRef = useRef<((choice: 'continue' | 'cancel' | 'retry') => void) | null>(null);
    const [pendingFallback, setPendingFallback] = useState<FallbackPromptContent | null>(null);

    const askFallbackConfirm = useCallback(
        (title: string, detail: string): Promise<'continue' | 'cancel' | 'retry'> => {
            return new Promise((resolve) => {
                setPendingFallback({ title, detail });
                resolverRef.current = resolve;
            });
        },
        [],
    );

    const handleFallbackChoice = useCallback(
        (choice: 'continue' | 'cancel' | 'retry') => {
            setPendingFallback(null);
            if (resolverRef.current) {
                resolverRef.current(choice);
                resolverRef.current = null;
            }
        },
        [],
    );

    const resetFallback = useCallback(() => {
        setPendingFallback(null);
        if (resolverRef.current) {
            resolverRef.current('cancel');
            resolverRef.current = null;
        }
    }, []);

    return {
        pendingFallback,
        askFallbackConfirm,
        handleFallbackChoice,
        resetFallback,
    } as const;
}
