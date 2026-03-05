import { useState, useCallback, useEffect } from 'react';
import { safeStorage } from '../safeStorage';
import { useAuthStore } from '../stores/useAuthStore';
import {
    fetchCloudRecords,
    upsertCloudRecord,
    deleteCloudRecord,
    renameCloudRecord,
} from '../services/cloudSync';

export interface BaseRecord {
    id: string;
    timestamp: number;
    name?: string;
    [key: string]: any;
}

interface UseProjectCRUDOptions {
    /** Supabase table name. If provided, CRUD auto-syncs to cloud for logged-in users. */
    cloudTable?: string;
    /** Column used for mapping from cloud row → local record. Default: pass-through. */
    mapFromCloud?: (row: any) => any;
    /** Column used for mapping from local record → cloud row. Default: pass-through. */
    mapToCloud?: (record: any) => any;
}

export const useProjectCRUD = <T extends BaseRecord>(
    storageKey: string,
    limit: number = 50,
    options: UseProjectCRUDOptions = {},
) => {
    const [items, setItems] = useState<T[]>(() => safeStorage.get<T[]>(storageKey, []));
    const user = useAuthStore((s) => s.user);
    const { cloudTable, mapFromCloud = (r: any) => r, mapToCloud = (r: any) => r } = options;

    // ── Same-tab cross-instance sync via custom event ──
    useEffect(() => {
        const handleSync = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail === storageKey) {
                setItems(safeStorage.get<T[]>(storageKey, []));
            }
        };
        // Cross-tab sync via native storage event
        const handleStorage = (e: StorageEvent) => {
            if (e.key === storageKey) {
                setItems(safeStorage.get<T[]>(storageKey, []));
            }
        };
        window.addEventListener('storage-sync', handleSync);
        window.addEventListener('storage', handleStorage);
        return () => {
            window.removeEventListener('storage-sync', handleSync);
            window.removeEventListener('storage', handleStorage);
        };
    }, [storageKey]);

    // ── Cloud sync on login ──
    useEffect(() => {
        if (!user || !cloudTable) return;

        fetchCloudRecords<any>(cloudTable, user.id).then((cloudRows) => {
            if (cloudRows.length === 0) return;
            setItems((prev) => {
                const localIds = new Set(prev.map((p) => p.id));
                const merged = [...prev];
                for (const row of cloudRows) {
                    const mapped = mapFromCloud(row);
                    if (!localIds.has(mapped.id)) {
                        merged.push(mapped as T);
                    }
                }
                safeStorage.set(storageKey, merged);
                setTimeout(() => window.dispatchEvent(new CustomEvent('storage-sync', { detail: storageKey })), 0);
                return merged;
            });
        });
    }, [user, cloudTable]);

    const saveItem = useCallback((item: T) => {
        setItems((prev) => {
            const exists = prev.some((p) => p.id === item.id);
            let updated = exists
                ? prev.map((p) => (p.id === item.id ? item : p))
                : [item, ...prev];
            if (updated.length > limit) updated = updated.slice(0, limit);
            safeStorage.set(storageKey, updated);
            // Notify other hook instances in same tab
            setTimeout(() => window.dispatchEvent(new CustomEvent('storage-sync', { detail: storageKey })), 0);
            return updated;
        });

        // Cloud sync (fire-and-forget)
        if (user && cloudTable) {
            upsertCloudRecord(cloudTable, user.id, mapToCloud(item));
        }
    }, [storageKey, limit, user, cloudTable, mapToCloud]);

    const deleteItem = useCallback((id: string) => {
        setItems((prev) => {
            const updated = prev.filter((item) => item.id !== id);
            safeStorage.set(storageKey, updated);
            setTimeout(() => window.dispatchEvent(new CustomEvent('storage-sync', { detail: storageKey })), 0);
            return updated;
        });

        if (user && cloudTable) {
            deleteCloudRecord(cloudTable, user.id, id);
        }
    }, [storageKey, user, cloudTable]);

    const renameItem = useCallback((id: string, newName: string, nameField: keyof T = 'name' as keyof T) => {
        setItems((prev) => {
            const updated = prev.map((item) => {
                if (item.id === id) {
                    return { ...item, [nameField]: newName };
                }
                return item;
            });
            safeStorage.set(storageKey, updated);
            setTimeout(() => window.dispatchEvent(new CustomEvent('storage-sync', { detail: storageKey })), 0);
            return updated;
        });

        if (user && cloudTable) {
            renameCloudRecord(cloudTable, id, newName, nameField as string);
        }
    }, [storageKey, user, cloudTable]);

    return {
        items,
        setItems,
        saveItem,
        deleteItem,
        renameItem
    };
};
