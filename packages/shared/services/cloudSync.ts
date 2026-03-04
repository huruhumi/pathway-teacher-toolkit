/**
 * Generic Cloud Sync Service
 * 
 * Provides a table-agnostic CRUD layer over Supabase.
 * Each app passes its own `tableName` (e.g. 'lesson_plans', 'essay_records').
 * Falls back silently when Supabase is not configured.
 */
import { supabase, isSupabaseEnabled } from './supabaseClient';

export interface CloudRecord {
    id: string;
    [key: string]: any;
}

// ── Fetch all records for a user ──
export async function fetchCloudRecords<T extends CloudRecord>(
    tableName: string,
    userId: string,
    orderBy: string = 'updated_at',
): Promise<T[]> {
    if (!isSupabaseEnabled() || !supabase) return [];

    const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('user_id', userId)
        .order(orderBy, { ascending: false });

    if (error) {
        console.error(`[cloudSync] fetch ${tableName}:`, error.message);
        return [];
    }
    return (data ?? []) as T[];
}

// ── Upsert a single record ──
export async function upsertCloudRecord<T extends CloudRecord>(
    tableName: string,
    userId: string,
    record: T,
): Promise<void> {
    if (!isSupabaseEnabled() || !supabase) return;

    const { error } = await supabase
        .from(tableName)
        .upsert(
            { ...record, user_id: userId, updated_at: new Date().toISOString() },
            { onConflict: 'id' },
        );

    if (error) {
        console.error(`[cloudSync] upsert ${tableName}:`, error.message);
    }
}

// ── Delete a record ──
export async function deleteCloudRecord(
    tableName: string,
    userId: string,
    recordId: string,
): Promise<void> {
    if (!isSupabaseEnabled() || !supabase) return;

    const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', recordId)
        .eq('user_id', userId);

    if (error) {
        console.error(`[cloudSync] delete ${tableName}:`, error.message);
    }
}

// ── Rename a record (update a single column) ──
export async function renameCloudRecord(
    tableName: string,
    recordId: string,
    newName: string,
    nameColumn: string = 'name',
): Promise<void> {
    if (!isSupabaseEnabled() || !supabase) return;

    const { error } = await supabase
        .from(tableName)
        .update({ [nameColumn]: newName, updated_at: new Date().toISOString() })
        .eq('id', recordId);

    if (error) {
        console.error(`[cloudSync] rename ${tableName}:`, error.message);
    }
}
