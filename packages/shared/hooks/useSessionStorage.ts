import { useState, useCallback } from 'react';

/**
 * A hook for managing state synced with sessionStorage.
 * Safe for SSR and handles quota errors smoothly.
 */
export function useSessionStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
    // Get from session storage then parse stored json or return initialValue
    const readValue = useCallback((): T => {
        if (typeof window === 'undefined') {
            return initialValue;
        }
        try {
            const item = window.sessionStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.warn(`Error reading sessionStorage key "${key}":`, error);
            return initialValue;
        }
    }, [key, initialValue]);

    // State to store our value
    const [storedValue, setStoredValue] = useState<T>(readValue);

    // Return a wrapped version of useState's setter function that persists the new value to sessionStorage.
    const setValue = useCallback((value: T | ((val: T) => T)) => {
        try {
            // Allow value to be a function so we have same API as useState
            const valueToStore = value instanceof Function ? value(storedValue) : value;

            // Save state
            setStoredValue(valueToStore);

            // Save to local storage
            if (typeof window !== 'undefined') {
                if (valueToStore === null || valueToStore === undefined) {
                    window.sessionStorage.removeItem(key);
                } else {
                    window.sessionStorage.setItem(key, JSON.stringify(valueToStore));
                }
            }
        } catch (error) {
            console.warn(`Error setting sessionStorage key "${key}":`, error);
        }
    }, [key, storedValue]);

    return [storedValue, setValue];
}
