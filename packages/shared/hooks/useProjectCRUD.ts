import { useState, useCallback, useEffect, useRef, type SetStateAction } from 'react';
import localforage from 'localforage';
import type {
    RecordEnvelope,
    RecordIndexEntry,
    RecordRepository,
    SaveResult,
} from '@shared/types';
import { useAuthStore } from '../stores/useAuthStore';
import { useToast } from '../stores/useToast';
import {
    fetchCloudRecords,
    fetchCloudRecordsByIds,
    upsertCloudRecord,
    deleteCloudRecord,
    renameCloudRecord,
    upsertRecordIndexEntry,
    deleteRecordIndexEntry,
} from '../services/cloudSync';

const SYNC_EVENT_NAME = 'pathway:project-crud-sync';

export interface BaseRecord {
    id: string;
    timestamp: number;
    name?: string;
    [key: string]: any;
}

interface RepositoryAdapter<T> {
    create: (userId: string) => RecordRepository<T>;
    toEnvelope: (record: T, userId: string) => RecordEnvelope<T>;
    fromEnvelope: (envelope: RecordEnvelope<T>) => T;
    dualWrite?: boolean;
    readFromRepository?: boolean;
}

interface UseProjectCRUDOptions<T> {
    cloudTable: string;
    mapFromCloud?: (row: any) => T;
    mapToCloud?: (record: T) => any;
    migrate?: (item: T) => T;
    repositoryAdapter?: RepositoryAdapter<T>;
    buildIndexEntry?: (record: T) => Omit<RecordIndexEntry, 'recordId' | 'ownerId' | 'updatedAt'> & {
        recordId?: string;
        updatedAt?: string;
    };
}

export const useProjectCRUD = <T extends BaseRecord>(
    storageKey: string,
    limit: number = 50,
    options: UseProjectCRUDOptions<T>,
) => {
    const [items, setItemsState] = useState<T[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const user = useAuthStore((s) => s.user);
    const {
        cloudTable,
        mapFromCloud = (r: any) => r as T,
        mapToCloud = (r: any) => r,
        migrate,
        repositoryAdapter,
        buildIndexEntry,
    } = options;
    const mapFromCloudRef = useRef(mapFromCloud);
    const mapToCloudRef = useRef(mapToCloud);
    const migrateRef = useRef(migrate);
    const repositoryAdapterRef = useRef(repositoryAdapter);
    const buildIndexEntryRef = useRef(buildIndexEntry);
    const syncedLocalUserIdRef = useRef<string | null>(null);

    useEffect(() => {
        mapFromCloudRef.current = mapFromCloud;
        mapToCloudRef.current = mapToCloud;
        migrateRef.current = migrate;
        repositoryAdapterRef.current = repositoryAdapter;
        buildIndexEntryRef.current = buildIndexEntry;
    }, [mapFromCloud, mapToCloud, migrate, repositoryAdapter, buildIndexEntry]);

    const localStorageKey = `${storageKey}:records`;

    const persistLocal = useCallback(async (nextItems: T[]) => {
        await localforage.setItem(localStorageKey, nextItems.slice(0, limit));
    }, [localStorageKey, limit]);

    const readLegacyLocalStorage = useCallback((): T[] => {
        if (typeof window === 'undefined') return [];
        try {
            const raw = window.localStorage.getItem(storageKey);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            return parsed.slice(0, limit) as T[];
        } catch {
            return [];
        }
    }, [limit, storageKey]);

    const readLocal = useCallback(async () => {
        const cached = await localforage.getItem<T[]>(localStorageKey);
        const normalizedCached = (cached ?? []).slice(0, limit);
        if (normalizedCached.length > 0) return normalizedCached;

        // One-time legacy migration path:
        // older builds wrote arrays directly to localStorage under `storageKey`.
        const legacy = readLegacyLocalStorage();
        if (legacy.length > 0) {
            await localforage.setItem(localStorageKey, legacy);
            return legacy;
        }
        return normalizedCached;
    }, [localStorageKey, limit, readLegacyLocalStorage]);

    const instanceId = useRef(crypto.randomUUID()).current;

    const broadcastSync = useCallback(() => {
        if (typeof window === 'undefined') return;
        window.dispatchEvent(new CustomEvent(SYNC_EVENT_NAME, {
            detail: { storageKey, sourceInstance: instanceId },
        }));
    }, [storageKey, instanceId]);

    const setItems = useCallback((next: SetStateAction<T[]>) => {
        let resolved: T[] = [];
        setItemsState((prev) => {
            const nextValue = typeof next === 'function'
                ? (next as (prevState: T[]) => T[])(prev)
                : next;
            resolved = nextValue.slice(0, limit);
            return resolved;
        });
        // Fire-and-forget persist then broadcast (not awaitable from SetStateAction)
        void persistLocal(resolved).then(broadcastSync);
    }, [broadcastSync, limit, persistLocal]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const onSync = async (event: Event) => {
            const payload = (event as CustomEvent<{ storageKey?: string; sourceInstance?: string }>).detail;
            if (payload?.storageKey !== storageKey) return;
            // Ignore events dispatched by this same hook instance to prevent
            // self-triggered re-reads that overwrite optimistic state updates.
            if (payload?.sourceInstance === instanceId) return;
            const synced = await readLocal();
            setItemsState(synced);
        };

        window.addEventListener(SYNC_EVENT_NAME, onSync as EventListener);
        return () => window.removeEventListener(SYNC_EVENT_NAME, onSync as EventListener);
    }, [instanceId, readLocal, storageKey]);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            setIsLoading(true);
            try {
                const localItems = await readLocal();
                if (!cancelled) {
                    setItemsState(localItems);
                }

                if (!user) {
                    if (!cancelled) setIsLoading(false);
                    syncedLocalUserIdRef.current = null;
                    return;
                }

                if (localItems.length > 0 && syncedLocalUserIdRef.current !== user.id) {
                    // Only sync local → cloud when cloud has NO data for this user
                    // (true offline-to-online first-time migration).
                    // Never blindly push cached local items back — they may include
                    // records already deleted on the server, causing "resurrection".
                    const repoAdapter = repositoryAdapterRef.current;
                    const canReadFromRepo = Boolean(repoAdapter && repoAdapter.readFromRepository !== false);
                    let cloudHasData = false;

                    if (canReadFromRepo) {
                        try {
                            const repo = repoAdapter!.create(user.id);
                            const existing = await repo.list({ ownerId: user.id, limit: 1 });
                            cloudHasData = existing.length > 0;
                        } catch { /* ignore — will fall through to cloud table check */ }
                    }
                    if (!cloudHasData) {
                        const existingRows = await fetchCloudRecords<any>(cloudTable, user.id, 'updated_at', 1);
                        cloudHasData = existingRows.length > 0;
                    }

                    if (!cloudHasData) {
                        // Cloud is empty — push local drafts up (genuine first sync)
                        const repo = repoAdapter ? repoAdapter.create(user.id) : null;
                        for (const item of localItems) {
                            await upsertCloudRecord(cloudTable, user.id, mapToCloudRef.current(item));
                            if (repo && repoAdapter?.dualWrite !== false) {
                                await repo.save(repoAdapter.toEnvelope(item, user.id));
                            }
                        }
                    }
                    syncedLocalUserIdRef.current = user.id;
                }

                const repoAdapter = repositoryAdapterRef.current;
                const canReadFromRepo = Boolean(repoAdapter && repoAdapter.readFromRepository !== false);
                let mapped: T[] = [];

                if (canReadFromRepo) {
                    try {
                        const repo = repoAdapter!.create(user.id);
                        const envelopes = await repo.list({ ownerId: user.id, limit });
                        mapped = envelopes
                            .slice(0, limit)
                            .map((envelope) => repoAdapter!.fromEnvelope(envelope));
                    } catch (repoErr: any) {
                        console.warn('[useProjectCRUD] repository list failed, falling back to cloud table:', repoErr?.message || repoErr);
                    }
                }

                if (mapped.length === 0) {
                    const rows = await fetchCloudRecords<any>(cloudTable, user.id, 'updated_at', limit);
                    mapped = rows.map((row) => mapFromCloudRef.current(row));
                }

                if (migrateRef.current) {
                    mapped = mapped.map((item) => migrateRef.current!(item));
                }

                if (!cancelled) {
                    // Keep non-empty local cache when cloud/repository returns empty.
                    // This avoids accidental data loss on transient auth/network issues.
                    const shouldKeepLocalCache = localItems.length > 0 && mapped.length === 0;
                    const nextItems = shouldKeepLocalCache ? localItems : mapped;
                    setItemsState(nextItems);
                    await persistLocal(nextItems);
                }
            } catch (err: any) {
                if (!cancelled) {
                    useToast.getState().error(
                        `Failed to load records from ${cloudTable}: ${err?.message || 'Unknown error'}`,
                    );
                }
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        void load();
        return () => {
            cancelled = true;
        };
    }, [cloudTable, limit, persistLocal, readLocal, user?.id]);

    const saveItem = useCallback(async (item: T): Promise<SaveResult> => {
        let optimistic: T[] = [];
        setItemsState((prev) => {
            const exists = prev.some((p) => p.id === item.id);
            optimistic = exists
                ? prev.map((p) => (p.id === item.id ? item : p))
                : [item, ...prev];
            optimistic = optimistic.slice(0, limit);
            return optimistic;
        });
        // IMPORTANT: await persist BEFORE broadcast to avoid race condition
        // (broadcastSync triggers onSync → readLocal which would read stale data)
        await persistLocal(optimistic);
        broadcastSync();

        if (!user) {
            return { ok: true, source: 'local', pendingSync: true };
        }

        const cloudResult = await upsertCloudRecord(cloudTable, user.id, mapToCloudRef.current(item));
        if (!cloudResult.ok) {
            useToast.getState().error(`Save failed. ${cloudResult.message || 'Please retry.'}`);
            return { ...cloudResult, source: 'mixed', pendingSync: true };
        }

        const repoAdapter = repositoryAdapterRef.current;
        if (repoAdapter && repoAdapter.dualWrite !== false) {
            const repoResult = await repoAdapter.create(user.id).save(repoAdapter.toEnvelope(item, user.id));
            if (!repoResult.ok) {
                useToast.getState().warning('Saved to current storage, but repository sync failed. Retry when convenient.');
                return { ok: true, source: 'mixed', errorCode: repoResult.errorCode, message: repoResult.message, retryable: true };
            }
        }

        const indexBuilder = buildIndexEntryRef.current;
        if (indexBuilder) {
            const partial = indexBuilder(item);
            const indexResult = await upsertRecordIndexEntry({
                ...partial,
                recordId: partial.recordId || item.id,
                ownerId: user.id,
                updatedAt: partial.updatedAt || new Date().toISOString(),
            });
            if (!indexResult.ok) {
                if (indexResult.errorCode !== '42P01') {
                    useToast.getState().warning('Saved, but search index update failed. Results may appear late.');
                }
                return { ok: true, source: 'mixed', errorCode: indexResult.errorCode, message: indexResult.message, retryable: true };
            }
        }

        return cloudResult;
    }, [broadcastSync, cloudTable, limit, persistLocal, user]);

    const deleteItem = useCallback(async (id: string): Promise<SaveResult> => {
        // Snapshot for rollback on failure
        let rollbackSnapshot: T[] | null = null;
        let optimistic: T[] = [];
        setItemsState((prev) => {
            rollbackSnapshot = prev;
            optimistic = prev.filter((item) => item.id !== id);
            return optimistic;
        });
        // IMPORTANT: await persist BEFORE broadcast to avoid race condition
        await persistLocal(optimistic);
        broadcastSync();

        if (!user) {
            return { ok: true, source: 'local', pendingSync: true };
        }

        try {
            const cloudResult = await deleteCloudRecord(cloudTable, user.id, id);
            if (!cloudResult.ok) {
                const recoverable =
                    cloudResult.errorCode === 'NETWORK_ERROR'
                    || cloudResult.errorCode === 'SUPABASE_DISABLED';

                // Local-first delete: keep optimistic local deletion on transient cloud/network failure.
                if (recoverable) {
                    return {
                        ok: true,
                        source: 'mixed',
                        errorCode: cloudResult.errorCode,
                        message: cloudResult.message || 'Cloud delete failed; local deletion kept.',
                        retryable: true,
                        pendingSync: true,
                    };
                }

                // Rollback optimistic deletion
                if (rollbackSnapshot) {
                    setItemsState(rollbackSnapshot);
                    await persistLocal(rollbackSnapshot);
                }
                useToast.getState().error(`Delete failed. ${cloudResult.message || 'Please retry.'}`);
                return { ...cloudResult, source: 'mixed', pendingSync: true };
            }

            // NOTE: skip repo.delete for delete operations — repo.delete internally calls
            // deleteCloudRecord on the same table, so it would be a redundant duplicate request.

            const indexResult = await deleteRecordIndexEntry(user.id, id);
            if (!indexResult.ok && indexResult.errorCode !== '42P01') {
                useToast.getState().warning('Deleted record, but search index cleanup failed. Finder results may lag.');
                broadcastSync();
                return {
                    ok: true,
                    source: 'mixed',
                    errorCode: indexResult.errorCode,
                    message: indexResult.message,
                    retryable: true,
                };
            }

            broadcastSync();
            return cloudResult;
        } catch (err: any) {
            const message = err?.message || 'Unexpected error';
            const isNetworkLike = /Failed to fetch|NetworkError|network/i.test(String(message));
            if (isNetworkLike) {
                return {
                    ok: true,
                    source: 'mixed',
                    errorCode: 'NETWORK_ERROR',
                    message: String(message),
                    retryable: true,
                    pendingSync: true,
                };
            }

            // Rollback on unexpected error
            if (rollbackSnapshot) {
                setItemsState(rollbackSnapshot);
                await persistLocal(rollbackSnapshot);
            }
            console.error('[useProjectCRUD] deleteItem unexpected error:', err);
            return { ok: false, source: 'cloud', errorCode: 'UNEXPECTED_DELETE_ERROR', message, retryable: true };
        }
    }, [broadcastSync, cloudTable, persistLocal, user]);

    const renameItem = useCallback(async (
        id: string,
        newName: string,
        nameField: keyof T = 'name' as keyof T,
    ): Promise<SaveResult> => {
        let optimistic: T[] = [];
        setItemsState((prev) => {
            optimistic = prev.map((item) => (item.id === id
                ? { ...item, [nameField]: newName }
                : item));
            return optimistic;
        });
        await persistLocal(optimistic);
        broadcastSync();

        if (!user) {
            return { ok: true, source: 'local', pendingSync: true };
        }

        const cloudResult = await renameCloudRecord(cloudTable, user.id, id, newName, nameField as string);
        if (!cloudResult.ok) {
            useToast.getState().error(`Rename failed. ${cloudResult.message || 'Please retry.'}`);
            return { ...cloudResult, source: 'mixed', pendingSync: true };
        }

        const repoAdapter = repositoryAdapterRef.current;
        if (repoAdapter && repoAdapter.dualWrite !== false) {
            const repoResult = await repoAdapter.create(user.id).rename(id, newName);
            if (!repoResult.ok) {
                useToast.getState().warning('Renamed in current storage, but repository sync failed.');
                return { ok: true, source: 'mixed', errorCode: repoResult.errorCode, message: repoResult.message, retryable: true };
            }
        }

        return cloudResult;
    }, [broadcastSync, cloudTable, persistLocal, user]);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        try {
            if (!user) {
                const localItems = await readLocal();
                setItemsState(localItems);
                return;
            }

            const repoAdapter = repositoryAdapterRef.current;
            const canReadFromRepo = Boolean(repoAdapter && repoAdapter.readFromRepository !== false);
            let mapped: T[] = [];

            if (canReadFromRepo) {
                try {
                    const repo = repoAdapter!.create(user.id);
                    const envelopes = await repo.list({ ownerId: user.id, limit });
                    mapped = envelopes
                        .slice(0, limit)
                        .map((envelope) => repoAdapter!.fromEnvelope(envelope));
                } catch (repoErr: any) {
                    console.warn('[useProjectCRUD] repository refresh failed, fallback to cloud table:', repoErr?.message || repoErr);
                }
            }

            if (mapped.length === 0) {
                const rows = await fetchCloudRecords<any>(cloudTable, user.id, 'updated_at', limit);
                mapped = rows.map((row) => mapFromCloudRef.current(row));
            }

            if (migrateRef.current) {
                mapped = mapped.map((item) => migrateRef.current!(item));
            }
            setItemsState(mapped);
            await persistLocal(mapped);
        } catch (err: any) {
            useToast.getState().error(`Refresh failed. ${err?.message || 'Please retry.'}`);
        } finally {
            setIsLoading(false);
        }
    }, [cloudTable, limit, persistLocal, readLocal, user]);

    const hydrateByIds = useCallback(async (ids: string[]): Promise<T[]> => {
        if (ids.length === 0) return [];

        if (!user) {
            const localItems = await readLocal();
            const map = new Map(localItems.map((item) => [item.id, item]));
            return ids.map((id) => map.get(id)).filter(Boolean) as T[];
        }

        const repoAdapter = repositoryAdapterRef.current;
        const canReadFromRepo = Boolean(repoAdapter && repoAdapter.readFromRepository !== false);
        let mapped: T[] = [];

        if (canReadFromRepo) {
            try {
                const repo = repoAdapter!.create(user.id);
                const envelopes = await Promise.all(ids.map((id) => repo.getById(id)));
                mapped = envelopes
                    .filter(Boolean)
                    .map((envelope) => repoAdapter!.fromEnvelope(envelope!));
            } catch (repoErr: any) {
                console.warn('[useProjectCRUD] repository getById failed, fallback to cloud ids:', repoErr?.message || repoErr);
            }
        }

        if (mapped.length === 0) {
            const rows = await fetchCloudRecordsByIds<any>(cloudTable, user.id, ids);
            mapped = rows.map((row) => mapFromCloudRef.current(row));
        }

        if (migrateRef.current) {
            mapped = mapped.map((item) => migrateRef.current!(item));
        }
        return mapped;
    }, [cloudTable, readLocal, user]);

    return {
        items,
        setItems,
        isLoading,
        saveItem,
        deleteItem,
        renameItem,
        refresh,
        hydrateByIds,
    };
};
