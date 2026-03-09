import { useState, useCallback, useEffect, useRef } from 'react';
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

interface UseProjectCRUDOptions<T> {
    /** Supabase table name (REQUIRED — all data lives in Supabase). */
    cloudTable: string;
    /** Map Supabase row → local record shape. */
    mapFromCloud?: (row: any) => T;
    /** Map local record → Supabase row shape. */
    mapToCloud?: (record: T) => any;
    /** Optional migration function applied to each record on load.
     *  Use this to patch old schema records to the current shape. */
    migrate?: (item: T) => T;
}

/**
 * Pure Supabase CRUD hook.
 * All data is stored in and fetched from Supabase.
 * Requires an authenticated user — returns empty items if not logged in.
 */
export const useProjectCRUD = <T extends BaseRecord>(
    _storageKey: string, // kept for call-site compatibility, not used
    limit: number = 50,
    options: UseProjectCRUDOptions<T>,
) => {
    const [items, setItems] = useState<T[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const user = useAuthStore((s) => s.user);
    const {
        cloudTable,
        mapFromCloud = (r: any) => r as T,
        mapToCloud = (r: any) => r,
        migrate,
    } = options;

    // Track if initial fetch has happened to avoid duplicate fetches
    const hasFetched = useRef(false);

    // ── Fetch from Supabase on mount / login ──
    useEffect(() => {
        if (!user) {
            setItems([]);
            setIsLoading(false);
            hasFetched.current = false;
            return;
        }

        // Prevent duplicate fetch on re-render
        if (hasFetched.current) return;
        hasFetched.current = true;

        setIsLoading(true);
        fetchCloudRecords<any>(cloudTable, user.id)
            .then((rows) => {
                let mapped = rows.map(mapFromCloud);
                if (migrate) {
                    mapped = mapped.map(migrate);
                }
                setItems(mapped);
            })
            .catch((err) => {
                console.error(`[useProjectCRUD] fetch ${cloudTable}:`, err);
                setItems([]);
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, [user, cloudTable]);

    // ── Save (upsert) ──
    const saveItem = useCallback((item: T) => {
        // Optimistic local update
        setItems((prev) => {
            const exists = prev.some((p) => p.id === item.id);
            let updated = exists
                ? prev.map((p) => (p.id === item.id ? item : p))
                : [item, ...prev];
            if (updated.length > limit) updated = updated.slice(0, limit);
            return updated;
        });

        // Persist to Supabase
        if (user) {
            upsertCloudRecord(cloudTable, user.id, mapToCloud(item));
        }
    }, [limit, user, cloudTable, mapToCloud]);

    // ── Delete ──
    const deleteItem = useCallback((id: string) => {
        // Optimistic local update
        setItems((prev) => prev.filter((item) => item.id !== id));

        // Persist to Supabase
        if (user) {
            deleteCloudRecord(cloudTable, user.id, id);
        }
    }, [user, cloudTable]);

    // ── Rename ──
    const renameItem = useCallback((id: string, newName: string, nameField: keyof T = 'name' as keyof T) => {
        // Optimistic local update
        setItems((prev) => prev.map((item) => {
            if (item.id === id) {
                return { ...item, [nameField]: newName };
            }
            return item;
        }));

        // Persist to Supabase
        if (user) {
            renameCloudRecord(cloudTable, id, newName, nameField as string);
        }
    }, [user, cloudTable]);

    // ── Refresh (manual re-fetch from Supabase) ──
    const refresh = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const rows = await fetchCloudRecords<any>(cloudTable, user.id);
            let mapped = rows.map(mapFromCloud);
            if (migrate) {
                mapped = mapped.map(migrate);
            }
            setItems(mapped);
        } catch (err) {
            console.error(`[useProjectCRUD] refresh ${cloudTable}:`, err);
        } finally {
            setIsLoading(false);
        }
    }, [user, cloudTable, mapFromCloud, migrate]);

    return {
        items,
        setItems,
        isLoading,
        saveItem,
        deleteItem,
        renameItem,
        refresh,
    };
};
