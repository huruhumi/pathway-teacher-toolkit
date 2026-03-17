import localforage from 'localforage';
import { SavedRecord } from '../types';
import type { SaveResult } from '@shared/types';
import { useAuthStore } from '@shared/stores/useAuthStore';
import {
  upsertCloudRecord,
  deleteCloudRecord,
  upsertRecordIndexEntry,
  deleteRecordIndexEntry,
} from '@shared/services/cloudSync';
import { assessEssayRecordQuality } from '@shared/config/recordQuality';

const STORAGE_KEY = 'essay_lab_records';
const MAX_RECORDS = 100;

export async function getRecords(): Promise<SavedRecord[]> {
  try {
    const raw = await localforage.getItem<SavedRecord[]>(STORAGE_KEY);
    return (raw || []).slice(0, MAX_RECORDS);
  } catch {
    return [];
  }
}

export async function setRecords(records: SavedRecord[]): Promise<void> {
  await localforage.setItem(STORAGE_KEY, records.slice(0, MAX_RECORDS));
}

export async function saveRecord(record: SavedRecord): Promise<SaveResult> {
  const records = await getRecords();
  const updated = [record, ...records].slice(0, MAX_RECORDS);
  await setRecords(updated);

  // Cloud sync
  const user = useAuthStore.getState().user;
  if (user) {
    const cloudResult = await upsertCloudRecord('essay_records', user.id, {
      id: record.id,
      grade: record.grade,
      cefr: record.cefr,
      topic_text: record.topicText || null,
      essay_text: record.essayText || null,
      report_data: record.report,
    });
    if (cloudResult.ok) {
      const quality = assessEssayRecordQuality(record.report as any, record.essayText);
      await upsertRecordIndexEntry({
        recordId: record.id,
        appId: 'essay-lab',
        recordType: 'essay_report',
        ownerId: user.id,
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
      });
    }
    return cloudResult;
  }
  return { ok: true, source: 'local', pendingSync: true };
}

export async function deleteRecord(id: string): Promise<SaveResult> {
  const records = await getRecords();
  const updated = records.filter((r) => r.id !== id);
  await setRecords(updated);

  const user = useAuthStore.getState().user;
  if (user) {
    const cloudResult = await deleteCloudRecord('essay_records', user.id, id);
    if (cloudResult.ok) {
      await deleteRecordIndexEntry(user.id, id);
    }
    return cloudResult;
  }
  return { ok: true, source: 'local', pendingSync: true };
}
