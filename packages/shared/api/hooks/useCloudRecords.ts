import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    fetchCloudRecords,
    upsertCloudRecord,
    deleteCloudRecord,
    renameCloudRecord,
    CloudRecord,
} from '../../services/cloudSync';

// ── Query Keys ──
export const cloudRecordKeys = {
    all: (table: string) => ['cloudRecords', table] as const,
    byUser: (table: string, userId: string) => ['cloudRecords', table, userId] as const,
};

// ── Fetch hook ──
export function useCloudRecords<T extends CloudRecord>(
    tableName: string,
    userId: string | undefined,
    options?: { enabled?: boolean },
) {
    return useQuery({
        queryKey: cloudRecordKeys.byUser(tableName, userId ?? ''),
        queryFn: () => fetchCloudRecords<T>(tableName, userId!),
        enabled: !!userId && (options?.enabled !== false),
    });
}

// ── Upsert mutation ──
export function useUpsertCloudRecord<T extends CloudRecord>(tableName: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ userId, record }: { userId: string; record: T }) =>
            upsertCloudRecord(tableName, userId, record),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({
                queryKey: cloudRecordKeys.byUser(tableName, variables.userId),
            });
        },
    });
}

// ── Delete mutation ──
export function useDeleteCloudRecord(tableName: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ userId, recordId }: { userId: string; recordId: string }) =>
            deleteCloudRecord(tableName, userId, recordId),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({
                queryKey: cloudRecordKeys.byUser(tableName, variables.userId),
            });
        },
    });
}

// ── Rename mutation ──
export function useRenameCloudRecord(tableName: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ recordId, newName, nameColumn }: { recordId: string; newName: string; nameColumn?: string }) =>
            renameCloudRecord(tableName, recordId, newName, nameColumn),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: cloudRecordKeys.all(tableName),
            });
        },
    });
}
