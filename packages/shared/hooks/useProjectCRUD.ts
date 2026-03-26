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

function normalizeTimestamp(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const n = Number(value);
        if (Number.isFinite(n)) return n;
    }
    return 0;
}

function nonEmptyArray(value: unknown): boolean {
    return Array.isArray(value) && value.length > 0;
}

function nonEmptyString(value: unknown, minLen = 1): boolean {
    return typeof value === 'string' && value.trim().length >= minLen;
}

function isLikelyRegressedRecord(current: unknown, backup: unknown): boolean {
    if (!current || !backup || typeof current !== 'object' || typeof backup !== 'object') return false;
    const currentPlan = (current as any).plan;
    const backupPlan = (backup as any).plan;
    if (!currentPlan || !backupPlan || typeof currentPlan !== 'object' || typeof backupPlan !== 'object') return false;

    const currentSignals = [
        nonEmptyArray(currentPlan.handbook),
        nonEmptyArray(currentPlan.imagePrompts),
        nonEmptyArray(currentPlan.visualReferences),
        nonEmptyString(currentPlan.notebookLMPrompt, 20),
        nonEmptyArray(currentPlan?.supplies?.permanent) || nonEmptyArray(currentPlan?.supplies?.consumables),
        nonEmptyString(currentPlan.factSheet, 80),
    ];
    const backupSignals = [
        nonEmptyArray(backupPlan.handbook),
        nonEmptyArray(backupPlan.imagePrompts),
        nonEmptyArray(backupPlan.visualReferences),
        nonEmptyString(backupPlan.notebookLMPrompt, 20),
        nonEmptyArray(backupPlan?.supplies?.permanent) || nonEmptyArray(backupPlan?.supplies?.consumables),
        nonEmptyString(backupPlan.factSheet, 80),
    ];

    let missingRichFields = 0;
    for (let i = 0; i < backupSignals.length; i += 1) {
        if (backupSignals[i] && !currentSignals[i]) missingRichFields += 1;
    }
    if (missingRichFields >= 2) return true;

    const currentRoadmapLen = Array.isArray(currentPlan.roadmap) ? currentPlan.roadmap.length : 0;
    const backupRoadmapLen = Array.isArray(backupPlan.roadmap) ? backupPlan.roadmap.length : 0;
    if (backupRoadmapLen >= 4 && currentRoadmapLen > 0 && currentRoadmapLen <= Math.floor(backupRoadmapLen * 0.5)) {
        return true;
    }

    return false;
}

function shouldPreferIncoming(incoming: unknown, existing: unknown): boolean {
    const incomingTs = normalizeTimestamp((incoming as any)?.timestamp);
    const existingTs = normalizeTimestamp((existing as any)?.timestamp);
    if (incomingTs > existingTs) return true;
    if (incomingTs < existingTs) return false;

    // Same timestamp: prefer richer/non-regressed payload
    if (isLikelyRegressedRecord(incoming, existing)) return false;
    if (isLikelyRegressedRecord(existing, incoming)) return true;

    const incomingSize = JSON.stringify(incoming ?? {}).length;
    const existingSize = JSON.stringify(existing ?? {}).length;
    return incomingSize >= existingSize;
}

const HISTORY_LIMIT_PER_RECORD = 8;

interface RecordHistoryEnvelope<T> {
    updatedAt: number;
    itemsById: Record<string, T[]>;
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
    const historyStorageKey = `${storageKey}:history`;
    const itemsRef = useRef<T[]>([]);

    useEffect(() => {
        itemsRef.current = items;
    }, [items]);

    const persistLocal = useCallback(async (nextItems: T[]) => {
        await localforage.setItem(localStorageKey, nextItems.slice(0, limit));
    }, [localStorageKey, limit]);

    const readHistory = useCallback(async (): Promise<RecordHistoryEnvelope<T>> => {
        const raw = await localforage.getItem<RecordHistoryEnvelope<T>>(historyStorageKey);
        if (raw && typeof raw === 'object' && raw.itemsById) return raw;
        return { updatedAt: Date.now(), itemsById: {} };
    }, [historyStorageKey]);

    const persistHistory = useCallback(async (history: RecordHistoryEnvelope<T>) => {
        await localforage.setItem(historyStorageKey, history);
    }, [historyStorageKey]);

    const snapshotRecord = useCallback(async (record: T | null | undefined) => {
        if (!record?.id) return;
        const history = await readHistory();
        const bucket = history.itemsById[record.id] || [];
        const latest = bucket[0];
        const nextTs = normalizeTimestamp(record.timestamp);
        const lastTs = normalizeTimestamp(latest?.timestamp);
        const samePayload = latest && JSON.stringify(latest) === JSON.stringify(record);
        if (samePayload || (nextTs > 0 && lastTs > 0 && nextTs === lastTs)) return;
        history.itemsById[record.id] = [record, ...bucket].slice(0, HISTORY_LIMIT_PER_RECORD);
        history.updatedAt = Date.now();
        await persistHistory(history);
    }, [persistHistory, readHistory]);

    const recoverFromHistoryIfNewer = useCallback(async (candidateItems: T[]): Promise<{ merged: T[]; recoveredCount: number; recoveredIds: string[] }> => {
        if (candidateItems.length === 0) return { merged: candidateItems, recoveredCount: 0, recoveredIds: [] };
        const history = await readHistory();
        const merged: T[] = [];
        let recoveredCount = 0;
        const recoveredIds: string[] = [];
        for (const item of candidateItems) {
            const bucket = history.itemsById[item.id] || [];
            const latest = bucket[0];
            if (!latest) {
                merged.push(item);
                continue;
            }
            const itemTs = normalizeTimestamp(item.timestamp);
            const backupTs = normalizeTimestamp(latest.timestamp);
            const itemSize = JSON.stringify(item).length;
            const backupSize = JSON.stringify(latest).length;
            const looksRegressed = backupSize > Math.max(2000, Math.floor(itemSize * 1.4));
            const looksStructurallyRegressed = isLikelyRegressedRecord(item, latest);
            if (backupTs > itemTs || looksRegressed || looksStructurallyRegressed) {
                merged.push(latest);
                recoveredCount += 1;
                recoveredIds.push(item.id);
            } else {
                merged.push(item);
            }
        }
        return { merged, recoveredCount, recoveredIds };
    }, [readHistory]);

    const syncRecoveredToCloud = useCallback(async (merged: T[], recoveredIds: string[]) => {
        if (!user || recoveredIds.length === 0) return;
        const recoveredSet = new Set(recoveredIds);
        const repoAdapter = repositoryAdapterRef.current;
        for (const item of merged) {
            if (!recoveredSet.has(item.id)) continue;
            await upsertCloudRecord(cloudTable, user.id, mapToCloudRef.current(item));
            if (repoAdapter && repoAdapter.dualWrite !== false) {
                await repoAdapter.create(user.id).save(repoAdapter.toEnvelope(item, user.id));
            }
        }
    }, [cloudTable, user]);

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
                    // Merge strategy: cloud records take precedence, but keep local-only
                    // records that are missing from cloud (they may be pending sync).
                    // This prevents data loss when a cloud save silently failed.
                    if (mapped.length === 0 && localItems.length > 0) {
                        // Cloud returned empty — keep local cache (transient auth/network issue)
                        const recovered = await recoverFromHistoryIfNewer(localItems);
                        setItemsState(recovered.merged);
                        await persistLocal(recovered.merged);
                        if (recovered.recoveredCount > 0) {
                            useToast.getState().info(`Recovered ${recovered.recoveredCount} newer draft(s) from local history.`);
                            void syncRecoveredToCloud(recovered.merged, recovered.recoveredIds);
                        }
                    } else if (mapped.length > 0) {
                        const mergedById = new Map<string, T>();
                        for (const cloudItem of mapped) {
                            mergedById.set(cloudItem.id, cloudItem);
                        }
                        for (const localItem of localItems) {
                            const existing = mergedById.get(localItem.id);
                            if (!existing) {
                                mergedById.set(localItem.id, localItem);
                                continue;
                            }
                            if (shouldPreferIncoming(localItem, existing)) {
                                mergedById.set(localItem.id, localItem);
                            }
                        }
                        const merged = Array.from(mergedById.values())
                            .sort((a, b) => normalizeTimestamp(b.timestamp) - normalizeTimestamp(a.timestamp))
                            .slice(0, limit);
                        const recovered = await recoverFromHistoryIfNewer(merged);
                        setItemsState(recovered.merged);
                        await persistLocal(recovered.merged);
                        if (recovered.recoveredCount > 0) {
                            useToast.getState().info(`Recovered ${recovered.recoveredCount} newer draft(s) from local history.`);
                            void syncRecoveredToCloud(recovered.merged, recovered.recoveredIds);
                        }
                    } else {
                        const recovered = await recoverFromHistoryIfNewer(mapped);
                        setItemsState(recovered.merged);
                        await persistLocal(recovered.merged);
                        if (recovered.recoveredCount > 0) {
                            useToast.getState().info(`Recovered ${recovered.recoveredCount} newer draft(s) from local history.`);
                            void syncRecoveredToCloud(recovered.merged, recovered.recoveredIds);
                        }
                    }
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
    }, [cloudTable, limit, persistLocal, readLocal, recoverFromHistoryIfNewer, syncRecoveredToCloud, user?.id]);

    const saveItem = useCallback(async (item: T): Promise<SaveResult> => {
        const previousItem = itemsRef.current.find((p) => p.id === item.id);
        if (previousItem) {
            await snapshotRecord(previousItem);
        }
        const incomingTs = normalizeTimestamp(item.timestamp);
        const previousTs = normalizeTimestamp(previousItem?.timestamp);
        const nowTs = Date.now();
        const safeTimestamp = Math.max(incomingTs, nowTs, previousTs > 0 ? previousTs + 1 : 0);
        const itemToSave = safeTimestamp === incomingTs
            ? item
            : ({ ...item, timestamp: safeTimestamp } as T);
        let optimistic: T[] = [];
        setItemsState((prev) => {
            const exists = prev.some((p) => p.id === item.id);
            optimistic = exists
                ? prev.map((p) => (p.id === item.id ? itemToSave : p))
                : [itemToSave, ...prev];
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

        const cloudResult = await upsertCloudRecord(cloudTable, user.id, mapToCloudRef.current(itemToSave));
        if (!cloudResult.ok) {
            useToast.getState().error(`Save failed. ${cloudResult.message || 'Please retry.'}`);
            return { ...cloudResult, source: 'mixed', pendingSync: true };
        }

        const repoAdapter = repositoryAdapterRef.current;
        if (repoAdapter && repoAdapter.dualWrite !== false) {
            const repoResult = await repoAdapter.create(user.id).save(repoAdapter.toEnvelope(itemToSave, user.id));
            if (!repoResult.ok) {
                useToast.getState().warning('Saved to current storage, but repository sync failed. Retry when convenient.');
                return { ok: true, source: 'mixed', errorCode: repoResult.errorCode, message: repoResult.message, retryable: true };
            }
        }

        const indexBuilder = buildIndexEntryRef.current;
        if (indexBuilder) {
            const partial = indexBuilder(itemToSave);
            const indexResult = await upsertRecordIndexEntry({
                ...partial,
                recordId: partial.recordId || itemToSave.id,
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
    }, [broadcastSync, cloudTable, limit, persistLocal, snapshotRecord, user]);

    const deleteItem = useCallback(async (id: string): Promise<SaveResult> => {
        const target = itemsRef.current.find((p) => p.id === id);
        if (target) {
            await snapshotRecord(target);
        }
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
    }, [broadcastSync, cloudTable, persistLocal, snapshotRecord, user]);

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
            const localItems = await readLocal();
            if (mapped.length > 0 && localItems.length > 0) {
                const mergedById = new Map<string, T>();
                for (const cloudItem of mapped) {
                    mergedById.set(cloudItem.id, cloudItem);
                }
                for (const localItem of localItems) {
                    const existing = mergedById.get(localItem.id);
                    if (!existing) {
                        mergedById.set(localItem.id, localItem);
                        continue;
                    }
                    if (shouldPreferIncoming(localItem, existing)) {
                        mergedById.set(localItem.id, localItem);
                    }
                }
                const merged = Array.from(mergedById.values())
                    .sort((a, b) => normalizeTimestamp(b.timestamp) - normalizeTimestamp(a.timestamp))
                    .slice(0, limit);
                const recovered = await recoverFromHistoryIfNewer(merged);
                setItemsState(recovered.merged);
                await persistLocal(recovered.merged);
                if (recovered.recoveredCount > 0) {
                    useToast.getState().info(`Recovered ${recovered.recoveredCount} newer draft(s) from local history.`);
                    void syncRecoveredToCloud(recovered.merged, recovered.recoveredIds);
                }
            } else {
                const recovered = await recoverFromHistoryIfNewer(mapped);
                setItemsState(recovered.merged);
                await persistLocal(recovered.merged);
                if (recovered.recoveredCount > 0) {
                    useToast.getState().info(`Recovered ${recovered.recoveredCount} newer draft(s) from local history.`);
                    void syncRecoveredToCloud(recovered.merged, recovered.recoveredIds);
                }
            }
        } catch (err: any) {
            useToast.getState().error(`Refresh failed. ${err?.message || 'Please retry.'}`);
        } finally {
            setIsLoading(false);
        }
    }, [cloudTable, limit, persistLocal, readLocal, recoverFromHistoryIfNewer, syncRecoveredToCloud, user]);

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
