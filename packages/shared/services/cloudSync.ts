import type { PostgrestError } from '@supabase/supabase-js';
import type { RecordIndexEntry, SaveResult } from '@shared/types';
import { isSupabaseEnabled, supabase } from './supabaseClient';

export interface CloudRecord {
    id: string;
    [key: string]: any;
}

export interface RecordIndexListParams {
    ownerId: string;
    appId?: string;
    recordType?: string;
    keyword?: string;
    textbookLevelKey?: string;
    cefr?: string;
    curriculumId?: string;
    unitNumber?: number;
    qualityStatus?: 'ok' | 'needs_review' | 'unknown';
    limit?: number;
    offset?: number;
}

export interface RecordIndexListResult {
    items: RecordIndexEntry[];
    total: number;
    errorCode?: string;
}

export interface CloudQueryOptions {
    includeDeleted?: boolean;
    deletedOnly?: boolean;
}

export interface CloudQueryResult<T extends CloudRecord> {
    ok: boolean;
    items: T[];
    errorCode?: string;
    message?: string;
}

export interface DeleteCloudRecordOptions {
    mode?: 'soft' | 'hard';
    retentionDays?: number;
    allowHardDeleteFallback?: boolean;
}

function fromSupabaseError(error: PostgrestError | null): SaveResult {
    if (!error) return { ok: true, source: 'cloud' };
    return {
        ok: false,
        source: 'cloud',
        errorCode: error.code || 'SUPABASE_ERROR',
        message: error.message,
        retryable: !error.code?.startsWith('23'),
    };
}

function disabledResult(): SaveResult {
    return {
        ok: false,
        source: 'none',
        errorCode: 'SUPABASE_DISABLED',
        message: 'Supabase is not configured.',
        retryable: true,
    };
}

function isMissingColumnError(error: PostgrestError | null, columnName: string): boolean {
    if (!error) return false;
    const msg = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`.toLowerCase();
    return error.code === '42703' || msg.includes(columnName.toLowerCase());
}

async function queryCloudRecords<T extends CloudRecord>(
    tableName: string,
    userId: string,
    orderBy: string = 'updated_at',
    limit?: number,
    options?: CloudQueryOptions,
): Promise<CloudQueryResult<T>> {
    if (!isSupabaseEnabled() || !supabase) {
        return { ok: false, items: [], errorCode: 'SUPABASE_DISABLED', message: 'Supabase is not configured.' };
    }

    const run = async (withDeleteFilter: boolean) => {
        let query = supabase
            .from(tableName)
            .select('*')
            .eq('user_id', userId)
            .order(orderBy, { ascending: false });

        if (withDeleteFilter) {
            if (options?.deletedOnly) query = query.not('deleted_at', 'is', null);
            else if (!options?.includeDeleted) query = query.is('deleted_at', null);
        }

        if (typeof limit === 'number') {
            query = query.limit(limit);
        }

        return query;
    };

    let { data, error } = await run(true);
    if (error && isMissingColumnError(error, 'deleted_at') && !options?.deletedOnly) {
        ({ data, error } = await run(false));
    }

    if (error) {
        console.error(`[cloudSync] fetch ${tableName}:`, error.message);
        return {
            ok: false,
            items: [],
            errorCode: error.code || 'SUPABASE_ERROR',
            message: error.message,
        };
    }

    return { ok: true, items: (data ?? []) as T[] };
}

export async function fetchCloudRecords<T extends CloudRecord>(
    tableName: string,
    userId: string,
    orderBy: string = 'updated_at',
    limit?: number,
): Promise<T[]> {
    const result = await queryCloudRecords<T>(tableName, userId, orderBy, limit, { includeDeleted: true });
    return result.items;
}

export async function fetchCloudRecordsResult<T extends CloudRecord>(
    tableName: string,
    userId: string,
    orderBy: string = 'updated_at',
    limit?: number,
    options?: CloudQueryOptions,
): Promise<CloudQueryResult<T>> {
    return queryCloudRecords<T>(tableName, userId, orderBy, limit, options);
}

export async function fetchCloudRecordsByIds<T extends CloudRecord>(
    tableName: string,
    userId: string,
    ids: string[],
    options?: CloudQueryOptions,
): Promise<T[]> {
    if (!isSupabaseEnabled() || !supabase || ids.length === 0) return [];

    const run = async (withDeleteFilter: boolean) => {
        let query = supabase
            .from(tableName)
            .select('*')
            .eq('user_id', userId)
            .in('id', ids);

        if (withDeleteFilter) {
            if (options?.deletedOnly) query = query.not('deleted_at', 'is', null);
            else if (!options?.includeDeleted) query = query.is('deleted_at', null);
        }
        return query;
    };

    let { data, error } = await run(true);
    if (error && isMissingColumnError(error, 'deleted_at') && !options?.deletedOnly) {
        ({ data, error } = await run(false));
    }
    if (error) {
        console.error(`[cloudSync] fetchByIds ${tableName}:`, error.message);
        return [];
    }

    const rowById = new Map((data ?? []).map((row: any) => [row.id, row]));
    return ids.map((id) => rowById.get(id)).filter(Boolean) as T[];
}

export async function upsertCloudRecord<T extends CloudRecord>(
    tableName: string,
    userId: string,
    record: T,
): Promise<SaveResult> {
    if (!isSupabaseEnabled() || !supabase) return disabledResult();

    try {
        const payload = { ...record, user_id: userId, updated_at: new Date().toISOString() };
        const { error, count } = await supabase
            .from(tableName)
            .upsert(payload, { onConflict: 'id', count: 'exact' });

        if (error) {
            console.error(`[cloudSync] upsert ${tableName}:`, error.message);
            return fromSupabaseError(error);
        }

        // Supabase/PostgREST silently drops upserts when RLS blocks them (returns 200 with 0 rows).
        // Detect this and return an explicit error so callers don't assume success.
        if (typeof count === 'number' && count === 0) {
            console.error(`[cloudSync] upsert ${tableName}: 0 rows affected (RLS or conflict mismatch). record.id=${record.id}`);
            return {
                ok: false,
                source: 'cloud',
                errorCode: 'ZERO_ROWS_AFFECTED',
                message: `Save appeared to succeed but 0 rows were written to ${tableName}. This usually means RLS blocked the operation.`,
                retryable: true,
            };
        }

        return { ok: true, source: 'cloud' };
    } catch (err: any) {
        console.error(`[cloudSync] network error upserting ${tableName}:`, err?.message);
        return { ok: false, source: 'cloud', errorCode: 'NETWORK_ERROR', message: err?.message || 'Network error', retryable: true };
    }
}

export async function deleteCloudRecord(
    tableName: string,
    userId: string,
    recordId: string,
    options?: DeleteCloudRecordOptions,
): Promise<SaveResult> {
    if (!isSupabaseEnabled() || !supabase) return disabledResult();

    const mode = options?.mode || 'hard';
    const retentionDays = Number.isFinite(options?.retentionDays as number)
        ? Math.max(1, Math.floor(options!.retentionDays as number))
        : 30;

    try {
        if (mode === 'soft') {
            const now = new Date();
            const purgeAt = new Date(now.getTime() + (retentionDays * 24 * 60 * 60 * 1000)).toISOString();
            const { error, count } = await supabase
                .from(tableName)
                .update(
                    {
                        deleted_at: now.toISOString(),
                        purge_at: purgeAt,
                        deleted_by: userId,
                        updated_at: now.toISOString(),
                    },
                    { count: 'exact' },
                )
                .eq('id', recordId)
                .eq('user_id', userId)
                .is('deleted_at', null);

            if (error) {
                if (isMissingColumnError(error, 'deleted_at') && options?.allowHardDeleteFallback) {
                    return deleteCloudRecord(tableName, userId, recordId, { mode: 'hard' });
                }
                console.error(`[cloudSync] soft-delete ${tableName}:`, error.message);
                return fromSupabaseError(error);
            }
            if (typeof count === 'number' && count === 0) {
                return {
                    ok: false,
                    source: 'cloud',
                    errorCode: 'ZERO_ROWS_AFFECTED',
                    message: `Delete wrote 0 rows in ${tableName}. Record may not exist, may already be deleted, or RLS blocked the operation.`,
                    retryable: true,
                };
            }
            return { ok: true, source: 'cloud' };
        }

        const { error, count } = await supabase
            .from(tableName)
            .delete({ count: 'exact' })
            .eq('id', recordId)
            .eq('user_id', userId);

        if (error) {
            console.error(`[cloudSync] delete ${tableName}:`, error.message);
            return fromSupabaseError(error);
        }
        if (typeof count === 'number' && count === 0) {
            return {
                ok: false,
                source: 'cloud',
                errorCode: 'ZERO_ROWS_AFFECTED',
                message: `Delete wrote 0 rows in ${tableName}. Record may not exist or RLS blocked the operation.`,
                retryable: true,
            };
        }
        return { ok: true, source: 'cloud' };
    } catch (err: any) {
        console.error(`[cloudSync] network error deleting ${tableName}:`, err?.message);
        return { ok: false, source: 'cloud', errorCode: 'NETWORK_ERROR', message: err?.message || 'Network error', retryable: true };
    }
}

export async function restoreCloudRecord(
    tableName: string,
    userId: string,
    recordId: string,
): Promise<SaveResult> {
    if (!isSupabaseEnabled() || !supabase) return disabledResult();

    try {
        const { error, count } = await supabase
            .from(tableName)
            .update(
                {
                    deleted_at: null,
                    purge_at: null,
                    deleted_by: null,
                    updated_at: new Date().toISOString(),
                },
                { count: 'exact' },
            )
            .eq('id', recordId)
            .eq('user_id', userId)
            .not('deleted_at', 'is', null);

        if (error) {
            console.error(`[cloudSync] restore ${tableName}:`, error.message);
            return fromSupabaseError(error);
        }
        if (typeof count === 'number' && count === 0) {
            return {
                ok: false,
                source: 'cloud',
                errorCode: 'ZERO_ROWS_AFFECTED',
                message: `Restore wrote 0 rows in ${tableName}. Record may already be active, missing, or blocked by RLS.`,
                retryable: true,
            };
        }
        return { ok: true, source: 'cloud' };
    } catch (err: any) {
        console.error(`[cloudSync] network error restoring ${tableName}:`, err?.message);
        return { ok: false, source: 'cloud', errorCode: 'NETWORK_ERROR', message: err?.message || 'Network error', retryable: true };
    }
}

export async function listDeletedCloudRecords<T extends CloudRecord>(
    tableName: string,
    userId: string,
    orderBy: string = 'deleted_at',
    limit?: number,
): Promise<CloudQueryResult<T>> {
    return queryCloudRecords<T>(tableName, userId, orderBy, limit, { deletedOnly: true });
}

export async function renameCloudRecord(
    tableName: string,
    userId: string,
    recordId: string,
    newName: string,
    nameColumn: string = 'name',
): Promise<SaveResult> {
    if (!isSupabaseEnabled() || !supabase) return disabledResult();

    const { error } = await supabase
        .from(tableName)
        .update({ [nameColumn]: newName, updated_at: new Date().toISOString() })
        .eq('id', recordId)
        .eq('user_id', userId);

    if (error) {
        console.error(`[cloudSync] rename ${tableName}:`, error.message);
    }
    return fromSupabaseError(error);
}

export async function upsertRecordIndexEntry(entry: RecordIndexEntry): Promise<SaveResult> {
    if (!isSupabaseEnabled() || !supabase) return disabledResult();

    const { error } = await supabase
        .from('record_index')
        .upsert({
            record_id: entry.recordId,
            app_id: entry.appId,
            record_type: entry.recordType,
            owner_id: entry.ownerId,
            title: entry.title,
            searchable_text: entry.searchableText,
            textbook_level_key: entry.textbookLevelKey ?? null,
            cefr: entry.cefr ?? null,
            curriculum_id: entry.curriculumId ?? null,
            unit_number: entry.unitNumber ?? null,
            tags: entry.tags ?? null,
            quality_status: entry.qualityStatus ?? null,
            updated_at: entry.updatedAt,
        }, {
            onConflict: 'record_id,owner_id',
        });

    if (error) {
        console.error('[cloudSync] upsert record_index:', error.message);
    }
    return fromSupabaseError(error);
}

export async function deleteRecordIndexEntry(
    ownerId: string,
    recordId: string,
): Promise<SaveResult> {
    if (!isSupabaseEnabled() || !supabase) return disabledResult();

    try {
        const { error } = await supabase
            .from('record_index')
            .delete()
            .eq('owner_id', ownerId)
            .eq('record_id', recordId);

        if (error) {
            console.error('[cloudSync] delete record_index:', error.message);
        }
        return fromSupabaseError(error);
    } catch (err: any) {
        console.error('[cloudSync] network error deleting record_index:', err?.message);
        return { ok: false, source: 'cloud', errorCode: 'NETWORK_ERROR', message: err?.message || 'Network error', retryable: true };
    }
}

export async function listRecordIndexEntries(params: RecordIndexListParams): Promise<RecordIndexListResult> {
    if (!isSupabaseEnabled() || !supabase) {
        return { items: [], total: 0, errorCode: 'SUPABASE_DISABLED' };
    }

    const {
        ownerId,
        appId,
        recordType,
        keyword,
        textbookLevelKey,
        cefr,
        curriculumId,
        unitNumber,
        qualityStatus,
        limit = 24,
        offset = 0,
    } = params;

    let query = supabase
        .from('record_index')
        .select('*', { count: 'exact' })
        .eq('owner_id', ownerId)
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (appId) query = query.eq('app_id', appId);
    if (recordType) query = query.eq('record_type', recordType);
    if (textbookLevelKey) query = query.eq('textbook_level_key', textbookLevelKey);
    if (cefr) query = query.eq('cefr', cefr);
    if (curriculumId) query = query.eq('curriculum_id', curriculumId);
    if (typeof unitNumber === 'number') query = query.eq('unit_number', unitNumber);
    if (qualityStatus) query = query.eq('quality_status', qualityStatus);
    if (keyword?.trim()) query = query.ilike('searchable_text', `%${keyword.trim()}%`);

    const { data, error, count } = await query;
    if (error) {
        console.error('[cloudSync] list record_index:', error.message);
        return { items: [], total: 0, errorCode: error.code };
    }

    const items: RecordIndexEntry[] = (data ?? []).map((row: any) => ({
        recordId: row.record_id,
        appId: row.app_id,
        recordType: row.record_type,
        ownerId: row.owner_id,
        title: row.title,
        searchableText: row.searchable_text || '',
        textbookLevelKey: row.textbook_level_key,
        cefr: row.cefr,
        curriculumId: row.curriculum_id,
        unitNumber: row.unit_number,
        tags: row.tags,
        qualityStatus: row.quality_status,
        updatedAt: row.updated_at,
    }));

    return { items, total: count ?? 0 };
}

export async function updateRecordIndexQualityStatus(
    ownerId: string,
    recordId: string,
    qualityStatus: 'ok' | 'needs_review' | 'unknown',
): Promise<SaveResult> {
    if (!isSupabaseEnabled() || !supabase) return disabledResult();

    const { error } = await supabase
        .from('record_index')
        .update({
            quality_status: qualityStatus,
            updated_at: new Date().toISOString(),
        })
        .eq('owner_id', ownerId)
        .eq('record_id', recordId);

    if (error) {
        console.error('[cloudSync] update record_index quality:', error.message);
    }
    return fromSupabaseError(error);
}
