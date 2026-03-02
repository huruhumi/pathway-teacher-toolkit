import { useState, useEffect, useCallback } from 'react';

/**
 * useState replacement that syncs the active tab with the URL hash.
 * On page refresh, restores the tab from `#hash`. Supports browser back/forward.
 *
 * @param defaultTab - fallback tab when no hash is present
 * @param validTabs - optional set of valid tab values to guard against stale hashes
 */
export function useHashTab<T extends string>(
    defaultTab: T,
    validTabs?: T[],
): [T, (tab: T) => void] {
    const readHash = useCallback((): T => {
        const hash = window.location.hash.slice(1); // remove '#'
        if (!hash) return defaultTab;
        if (validTabs && !validTabs.includes(hash as T)) return defaultTab;
        return hash as T;
    }, [defaultTab, validTabs]);

    const [tab, setTabState] = useState<T>(readHash);

    const setTab = useCallback(
        (newTab: T) => {
            setTabState(newTab);
            // Replace (not push) so we don't pollute history with every tab click
            window.history.replaceState(null, '', `#${newTab}`);
        },
        [],
    );

    // Listen for browser back/forward (popstate)
    useEffect(() => {
        const onHashChange = () => {
            setTabState(readHash());
        };
        window.addEventListener('hashchange', onHashChange);
        return () => window.removeEventListener('hashchange', onHashChange);
    }, [readHash]);

    return [tab, setTab];
}
