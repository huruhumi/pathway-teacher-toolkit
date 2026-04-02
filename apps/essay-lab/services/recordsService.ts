import localforage from 'localforage';
import { SavedRecord } from '../types';
import type { SaveResult } from '@shared/types';
import { useAuthStore } from '@shared/stores/useAuthStore';
import {
  upsertCloudRecord,
  deleteCloudRecord,
  restoreCloudRecord,
  listDeletedCloudRecords,
  upsertRecordIndexEntry,
  deleteRecordIndexEntry,
} from '@shared/services/cloudSync';
import { assessEssayRecordQuality } from '@shared/config/recordQuality';

const STORAGE_KEY = 'essay_lab_records';
const DELETED_STORAGE_KEY = `${STORAGE_KEY}:deleted`;
const MAX_RECORDS = 100;
const RECYCLE_RETENTION_DAYS = 30;
const DELETED_META_KEY = '__deletedMeta';

type DeletedMeta = {
  deletedAt?: number;
  purgeAt?: number;
};

type SavedRecordWithMeta = SavedRecord & {
  __deletedMeta?: DeletedMeta;
};

function normalizeTimestamp(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now();
}

function uniqueLatest(records: SavedRecord[]): SavedRecord[] {
  const sorted = [...records].sort((a, b) => normalizeTimestamp(b.timestamp) - normalizeTimestamp(a.timestamp));
  const seen = new Set<string>();
  const result: SavedRecord[] = [];
  for (const record of sorted) {
    if (!record?.id || seen.has(record.id)) continue;
    seen.add(record.id);
    result.push({
      ...record,
      timestamp: normalizeTimestamp(record.timestamp),
    });
    if (result.length >= MAX_RECORDS) break;
  }
  return result;
}

function attachDeletedMeta(record: SavedRecord, deletedAt: number, purgeAt: number): SavedRecord {
  return {
    ...(record as any),
    [DELETED_META_KEY]: {
      deletedAt,
      purgeAt,
    } satisfies DeletedMeta,
  } as SavedRecord;
}

function stripDeletedMeta(record: SavedRecord): SavedRecord {
  const next = { ...(record as any) };
  if (DELETED_META_KEY in next) {
    delete next[DELETED_META_KEY];
  }
  return next as SavedRecord;
}

export function readDeletedMeta(record: SavedRecord): { deletedAt: number; purgeAt: number | null } {
  const deletedAtRaw = Number((record as any)?.[DELETED_META_KEY]?.deletedAt || 0);
  const purgeAtRaw = Number((record as any)?.[DELETED_META_KEY]?.purgeAt || 0);
  return {
    deletedAt: Number.isFinite(deletedAtRaw) && deletedAtRaw > 0 ? deletedAtRaw : normalizeTimestamp(record.timestamp),
    purgeAt: Number.isFinite(purgeAtRaw) && purgeAtRaw > 0 ? purgeAtRaw : null,
  };
}

async function setDeletedRecords(records: SavedRecord[]): Promise<void> {
  const deduped = uniqueLatest(
    records.map((record) => {
      const { deletedAt } = readDeletedMeta(record);
      return { ...record, timestamp: deletedAt };
    }),
  );
  await localforage.setItem(DELETED_STORAGE_KEY, deduped.slice(0, MAX_RECORDS));
}

function buildEssayIndexEntry(userId: string, record: SavedRecord) {
  const quality = assessEssayRecordQuality(record.report as any, record.essayText);
  return {
    recordId: record.id,
    appId: 'essay-lab',
    recordType: 'essay_report',
    ownerId: userId,
    title: record.topicText || 'Essay Report',
    searchableText: [
      record.topicText,
      record.grade,
      record.cefr,
      record.report?.overallGrade,
      record.report?.originalText?.slice(0, 300),
    ].filter(Boolean).join(' '),
    textbookLevelKey: null,
    cefr: record.cefr,
    curriculumId: null,
    unitNumber: null,
    tags: ['essay', 'correction', ...(quality.status === 'needs_review' ? ['needs-review'] : ['ready'])],
    qualityStatus: quality.status,
    updatedAt: new Date().toISOString(),
  };
}

export async function getRecords(): Promise<SavedRecord[]> {
  try {
    const raw = await localforage.getItem<SavedRecord[]>(STORAGE_KEY);
    const records = (raw || []).filter((record) => !(record as any)?.[DELETED_META_KEY]);
    return uniqueLatest(records).slice(0, MAX_RECORDS);
  } catch {
    return [];
  }
}

export async function setRecords(records: SavedRecord[]): Promise<void> {
  await localforage.setItem(STORAGE_KEY, uniqueLatest(records).slice(0, MAX_RECORDS));
}

export async function getDeletedRecords(): Promise<SavedRecord[]> {
  try {
    const raw = await localforage.getItem<SavedRecord[]>(DELETED_STORAGE_KEY);
    return uniqueLatest(raw || []).slice(0, MAX_RECORDS);
  } catch {
    return [];
  }
}

export async function saveRecord(record: SavedRecord): Promise<SaveResult> {
  const records = await getRecords();
  const updated = uniqueLatest([record, ...records]);
  await setRecords(updated);

  const deleted = await getDeletedRecords();
  if (deleted.some((item) => item.id === record.id)) {
    await setDeletedRecords(deleted.filter((item) => item.id !== record.id));
  }

  const user = useAuthStore.getState().user;
  if (!user) {
    return { ok: true, source: 'local', pendingSync: true };
  }

  const cloudResult = await upsertCloudRecord('essay_records', user.id, {
    id: record.id,
    grade: record.grade,
    cefr: record.cefr,
    topic_text: record.topicText || null,
    essay_text: record.essayText || null,
    report_data: record.report,
  });

  if (cloudResult.ok) {
    await upsertRecordIndexEntry(buildEssayIndexEntry(user.id, record));
  }

  return cloudResult;
}

export async function deleteRecord(id: string): Promise<SaveResult> {
  const activeBefore = await getRecords();
  const deletedBefore = await getDeletedRecords();
  const target = activeBefore.find((record) => record.id === id);

  await setRecords(activeBefore.filter((record) => record.id !== id));
  if (target) {
    const deletedAt = Date.now();
    const purgeAt = deletedAt + (RECYCLE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const tagged = attachDeletedMeta(target, deletedAt, purgeAt);
    await setDeletedRecords([tagged, ...deletedBefore.filter((record) => record.id !== id)]);
  }

  const user = useAuthStore.getState().user;
  if (!user) {
    return { ok: true, source: 'local', pendingSync: true };
  }

  const cloudResult = await deleteCloudRecord('essay_records', user.id, id, {
    mode: 'soft',
    retentionDays: RECYCLE_RETENTION_DAYS,
  });

  if (!cloudResult.ok) {
    const softDeleteColumnMissing =
      cloudResult.errorCode === '42703'
      || cloudResult.errorCode === 'PGRST204'
      || /deleted_at/i.test(String(cloudResult.message || ''));
    const recoverable =
      cloudResult.errorCode === 'NETWORK_ERROR'
      || cloudResult.errorCode === 'SUPABASE_DISABLED'
      || softDeleteColumnMissing;
    if (recoverable) {
      return { ok: true, source: 'mixed', pendingSync: true, message: cloudResult.message, errorCode: cloudResult.errorCode };
    }

    await setRecords(activeBefore);
    await setDeletedRecords(deletedBefore);
    return cloudResult;
  }

  await deleteRecordIndexEntry(user.id, id);
  return cloudResult;
}

export async function listDeletedRecords(): Promise<SavedRecord[]> {
  const localDeleted = await getDeletedRecords();
  const byId = new Map(localDeleted.map((record) => [record.id, record]));
  const user = useAuthStore.getState().user;

  if (user) {
    const cloudDeleted = await listDeletedCloudRecords<any>('essay_records', user.id, 'deleted_at', MAX_RECORDS);
    if (cloudDeleted.ok) {
      for (const row of cloudDeleted.items) {
        const mapped: SavedRecord = {
          id: row.id,
          timestamp: Date.parse(row.updated_at || row.created_at || new Date().toISOString()),
          grade: row.grade,
          cefr: row.cefr,
          topicText: row.topic_text || undefined,
          essayText: row.essay_text || undefined,
          report: row.report_data,
        };
        const deletedAtRaw = Date.parse(row.deleted_at || row.updated_at || new Date().toISOString());
        const purgeAtRaw = Date.parse(row.purge_at || '');
        const tagged = attachDeletedMeta(
          mapped,
          Number.isFinite(deletedAtRaw) ? deletedAtRaw : Date.now(),
          Number.isFinite(purgeAtRaw) ? purgeAtRaw : Date.now() + (RECYCLE_RETENTION_DAYS * 24 * 60 * 60 * 1000),
        );
        const existing = byId.get(tagged.id);
        if (!existing) {
          byId.set(tagged.id, tagged);
          continue;
        }
        if (readDeletedMeta(tagged).deletedAt >= readDeletedMeta(existing).deletedAt) {
          byId.set(tagged.id, tagged);
        }
      }
    }
  }

  const merged = Array.from(byId.values())
    .sort((a, b) => readDeletedMeta(b).deletedAt - readDeletedMeta(a).deletedAt)
    .slice(0, MAX_RECORDS);
  await setDeletedRecords(merged);
  return merged;
}

export async function restoreRecord(id: string): Promise<SaveResult> {
  const deletedBefore = await getDeletedRecords();
  const activeBefore = await getRecords();
  const target = deletedBefore.find((record) => record.id === id);

  await setDeletedRecords(deletedBefore.filter((record) => record.id !== id));
  if (target) {
    const restored = stripDeletedMeta(target);
    await setRecords(uniqueLatest([restored, ...activeBefore.filter((record) => record.id !== id)]));
  }

  const user = useAuthStore.getState().user;
  if (!user) {
    return { ok: true, source: 'local', pendingSync: true };
  }

  const cloudResult = await restoreCloudRecord('essay_records', user.id, id);
  if (!cloudResult.ok) {
    await setDeletedRecords(deletedBefore);
    await setRecords(activeBefore);
    return cloudResult;
  }

  if (target) {
    await upsertRecordIndexEntry(buildEssayIndexEntry(user.id, stripDeletedMeta(target)));
  }
  return cloudResult;
}

export async function purgeRecord(id: string): Promise<SaveResult> {
  const deletedBefore = await getDeletedRecords();
  await setDeletedRecords(deletedBefore.filter((record) => record.id !== id));

  const user = useAuthStore.getState().user;
  if (!user) {
    return { ok: true, source: 'local', pendingSync: false };
  }

  const cloudResult = await deleteCloudRecord('essay_records', user.id, id, { mode: 'hard' });
  if (!cloudResult.ok) {
    await setDeletedRecords(deletedBefore);
    return cloudResult;
  }

  await deleteRecordIndexEntry(user.id, id);
  return cloudResult;
}
