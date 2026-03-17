export type RecordQualityStatus = 'ok' | 'needs_review' | 'unknown';

export interface SaveResult {
    ok: boolean;
    source: 'cloud' | 'local' | 'mixed' | 'none';
    errorCode?: string;
    message?: string;
    retryable?: boolean;
    pendingSync?: boolean;
}

export interface RecordEnvelope<TPayload = unknown> {
    id: string;
    appId: string;
    recordType: string;
    title: string;
    description?: string;
    payload: TPayload;
    schemaVersion: number;
    createdAt: string;
    updatedAt: string;
    ownerId?: string;
}

export interface RecordQuery {
    ownerId?: string;
    appId?: string;
    recordType?: string;
    keyword?: string;
    textbookLevelKey?: string;
    cefr?: string;
    curriculumId?: string;
    unitNumber?: number;
    qualityStatus?: RecordQualityStatus;
    limit?: number;
    offset?: number;
}

export interface RecordRepository<TPayload = unknown> {
    save: (record: RecordEnvelope<TPayload>) => Promise<SaveResult>;
    getById: (id: string) => Promise<RecordEnvelope<TPayload> | null>;
    list: (query?: RecordQuery) => Promise<RecordEnvelope<TPayload>[]>;
    delete: (id: string) => Promise<SaveResult>;
    rename: (id: string, title: string) => Promise<SaveResult>;
}

export interface RecordIndexEntry {
    recordId: string;
    appId: string;
    recordType: string;
    ownerId: string;
    title: string;
    searchableText: string;
    textbookLevelKey?: string | null;
    cefr?: string | null;
    curriculumId?: string | null;
    unitNumber?: number | null;
    tags?: string[] | null;
    qualityStatus?: RecordQualityStatus | null;
    updatedAt: string;
}
