import type { RecordEnvelope, RecordRepository } from '@shared/types';
import { createSupabaseRecordRepository } from '@shared/services/recordRepository';
import type { SavedCurriculum, SavedLesson } from '../types';

const APP_ID = 'esl-planner';
const LESSON_RECORD_TYPE = 'lesson_kit';
const CURRICULUM_RECORD_TYPE = 'curriculum';
const SCHEMA_VERSION = 1;

function toIsoFromMillis(value?: number): string {
    return new Date(value ?? Date.now()).toISOString();
}

function stripLessonMetaFromContent(content: any): SavedLesson['content'] {
    if (!content || typeof content !== 'object') return content as SavedLesson['content'];
    const next = { ...content };
    if ('__recordMeta' in next) {
        delete next.__recordMeta;
    }
    return next as SavedLesson['content'];
}

function withLessonMeta(
    content: SavedLesson['content'],
    lesson: Pick<SavedLesson, 'curriculumId' | 'unitNumber' | 'lessonIndex'>,
): SavedLesson['content'] & { __recordMeta: Record<string, unknown> } {
    return {
        ...content,
        __recordMeta: {
            curriculumId: lesson.curriculumId ?? null,
            unitNumber: lesson.unitNumber ?? null,
            lessonIndex: lesson.lessonIndex ?? null,
        },
    };
}

export function toLessonEnvelope(record: SavedLesson, ownerId?: string): RecordEnvelope<SavedLesson> {
    return {
        id: record.id,
        appId: APP_ID,
        recordType: LESSON_RECORD_TYPE,
        title: record.topic || 'Untitled Lesson',
        description: record.description,
        payload: record,
        schemaVersion: SCHEMA_VERSION,
        createdAt: toIsoFromMillis(record.timestamp),
        updatedAt: toIsoFromMillis(record.lastModified ?? record.timestamp),
        ownerId,
    };
}

export function fromLessonEnvelope(envelope: RecordEnvelope<SavedLesson>): SavedLesson {
    const payload = envelope.payload;
    return {
        ...payload,
        timestamp: new Date(envelope.createdAt).getTime(),
        lastModified: new Date(envelope.updatedAt).getTime(),
    };
}

export function createLessonRecordRepository(userId: string): RecordRepository<SavedLesson> {
    return createSupabaseRecordRepository<SavedLesson>({
        tableName: 'esl_lessons',
        userId,
        mapFromRow: (row: any) => {
            const updatedAt = row.updated_at || row.created_at || new Date().toISOString();
            const meta = row.content_data?.__recordMeta || {};
            const payload: SavedLesson = {
                id: row.id,
                timestamp: new Date(updatedAt).getTime(),
                lastModified: new Date(updatedAt).getTime(),
                topic: row.name || 'Untitled Lesson',
                level: row.level || '',
                description: row.description || '',
                content: stripLessonMetaFromContent(row.content_data),
                curriculumId: row.curriculum_id ?? meta.curriculumId ?? undefined,
                unitNumber: row.unit_number ?? meta.unitNumber ?? undefined,
                lessonIndex: row.lesson_index ?? meta.lessonIndex ?? undefined,
            };
            return {
                id: payload.id,
                appId: APP_ID,
                recordType: LESSON_RECORD_TYPE,
                title: payload.topic,
                description: payload.description,
                payload,
                schemaVersion: SCHEMA_VERSION,
                createdAt: row.created_at || updatedAt,
                updatedAt,
                ownerId: userId,
            };
        },
        mapToRow: (record: RecordEnvelope<SavedLesson>) => {
            const payload = record.payload;
            return {
                id: record.id,
                name: record.title || payload.topic,
                level: payload.level,
                description: record.description ?? payload.description ?? null,
                content_data: withLessonMeta(payload.content, payload),
                curriculum_id: payload.curriculumId ?? null,
                unit_number: payload.unitNumber ?? null,
                lesson_index: payload.lessonIndex ?? null,
            };
        },
    });
}

export function toCurriculumEnvelope(record: SavedCurriculum, ownerId?: string): RecordEnvelope<SavedCurriculum> {
    return {
        id: record.id,
        appId: APP_ID,
        recordType: CURRICULUM_RECORD_TYPE,
        title: record.textbookTitle || 'Untitled Curriculum',
        description: record.description,
        payload: record,
        schemaVersion: SCHEMA_VERSION,
        createdAt: toIsoFromMillis(record.timestamp),
        updatedAt: toIsoFromMillis(record.lastModified ?? record.timestamp),
        ownerId,
    };
}

export function fromCurriculumEnvelope(envelope: RecordEnvelope<SavedCurriculum>): SavedCurriculum {
    const payload = envelope.payload;
    return {
        ...payload,
        timestamp: new Date(envelope.createdAt).getTime(),
        lastModified: new Date(envelope.updatedAt).getTime(),
    };
}

export function createCurriculumRecordRepository(userId: string): RecordRepository<SavedCurriculum> {
    return createSupabaseRecordRepository<SavedCurriculum>({
        tableName: 'esl_curricula',
        userId,
        mapFromRow: (row: any) => {
            const updatedAt = row.updated_at || row.created_at || new Date().toISOString();
            const payload: SavedCurriculum = {
                id: row.id,
                timestamp: new Date(updatedAt).getTime(),
                lastModified: new Date(updatedAt).getTime(),
                textbookTitle: row.name || 'Untitled Curriculum',
                targetLevel: row.level || '',
                totalLessons: row.total_lessons || 0,
                description: row.description || '',
                curriculum: row.curriculum_data,
                params: row.params_data,
            };
            return {
                id: payload.id,
                appId: APP_ID,
                recordType: CURRICULUM_RECORD_TYPE,
                title: payload.textbookTitle,
                description: payload.description,
                payload,
                schemaVersion: SCHEMA_VERSION,
                createdAt: row.created_at || updatedAt,
                updatedAt,
                ownerId: userId,
            };
        },
        mapToRow: (record: RecordEnvelope<SavedCurriculum>) => {
            const payload = record.payload;
            return {
                id: record.id,
                name: record.title || payload.textbookTitle,
                level: payload.targetLevel,
                total_lessons: payload.totalLessons,
                description: record.description ?? payload.description ?? null,
                curriculum_data: payload.curriculum,
                params_data: payload.params,
            };
        },
    });
}

export const lessonRepositoryAdapter = {
    create: createLessonRecordRepository,
    toEnvelope: toLessonEnvelope,
    fromEnvelope: fromLessonEnvelope,
    dualWrite: true,
    readFromRepository: true,
};

export const curriculumRepositoryAdapter = {
    create: createCurriculumRecordRepository,
    toEnvelope: toCurriculumEnvelope,
    fromEnvelope: fromCurriculumEnvelope,
    dualWrite: true,
    readFromRepository: true,
};
