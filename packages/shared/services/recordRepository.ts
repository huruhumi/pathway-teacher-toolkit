import type { RecordEnvelope, RecordQuery, RecordRepository, SaveResult } from '@shared/types';
import {
    fetchCloudRecords,
    upsertCloudRecord,
    deleteCloudRecord,
    renameCloudRecord,
} from './cloudSync';

interface CreateSupabaseRecordRepositoryOptions<TPayload> {
    tableName: string;
    userId: string;
    mapFromRow: (row: any) => RecordEnvelope<TPayload>;
    mapToRow: (record: RecordEnvelope<TPayload>) => Record<string, unknown>;
}

export function createSupabaseRecordRepository<TPayload>({
    tableName,
    userId,
    mapFromRow,
    mapToRow,
}: CreateSupabaseRecordRepositoryOptions<TPayload>): RecordRepository<TPayload> {
    return {
        save: async (record: RecordEnvelope<TPayload>): Promise<SaveResult> => (
            upsertCloudRecord(tableName, userId, mapToRow(record) as { id: string })
        ),

        getById: async (id: string): Promise<RecordEnvelope<TPayload> | null> => {
            const rows = await fetchCloudRecords<any>(tableName, userId, 'updated_at');
            const hit = rows.find((row) => row.id === id);
            return hit ? mapFromRow(hit) : null;
        },

        list: async (_query?: RecordQuery): Promise<RecordEnvelope<TPayload>[]> => {
            const rows = await fetchCloudRecords<any>(tableName, userId, 'updated_at');
            return rows.map((row) => mapFromRow(row));
        },

        delete: async (id: string): Promise<SaveResult> => (
            deleteCloudRecord(tableName, userId, id)
        ),

        rename: async (id: string, title: string): Promise<SaveResult> => (
            renameCloudRecord(tableName, userId, id, title, 'name')
        ),
    };
}
