import { useState, useCallback } from 'react';
import { safeStorage } from '../safeStorage';

export interface BaseRecord {
    id: string;
    timestamp: number;
    [key: string]: any;
}

export const useProjectCRUD = <T extends BaseRecord>(storageKey: string, limit: number = 50) => {
    const [items, setItems] = useState<T[]>(() => safeStorage.get<T[]>(storageKey, []));

    const saveItem = useCallback((item: T) => {
        setItems((prev) => {
            // If the item already exists, update it, otherwise add to front
            const exists = prev.some((p) => p.id === item.id);
            let updated = exists
                ? prev.map((p) => (p.id === item.id ? item : p))
                : [item, ...prev];
            if (updated.length > limit) updated = updated.slice(0, limit);
            safeStorage.set(storageKey, updated);
            return updated;
        });
    }, [storageKey, limit]);

    const deleteItem = useCallback((id: string) => {
        setItems((prev) => {
            const updated = prev.filter((item) => item.id !== id);
            safeStorage.set(storageKey, updated);
            return updated;
        });
    }, [storageKey]);

    const renameItem = useCallback((id: string, newName: string, nameField: keyof T = 'name' as keyof T) => {
        setItems((prev) => {
            const updated = prev.map((item) => {
                if (item.id === id) {
                    return { ...item, [nameField]: newName };
                }
                return item;
            });
            safeStorage.set(storageKey, updated);
            return updated;
        });
    }, [storageKey]);

    return {
        items,
        setItems,
        saveItem,
        deleteItem,
        renameItem
    };
};
