import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import { GeneratedContent, SavedLesson, SavedCurriculum, ESLCurriculum, CurriculumParams } from '../types';

import { imageStorage } from '@shared/imageStorage';
import { imageStore } from '@shared/imageStore';
import { isToday, isThisWeek, isThisMonth } from '../utils/dateHelpers';
import { useAppStore, useSessionStore } from '../stores/appStore';
import { useAuthStore } from '@pathway/platform';
import { useProjectCRUD } from '@shared/hooks/useProjectCRUD';
import type { SaveResult, RecordIndexEntry } from '@shared/types';
import type { TeacherReview } from '@shared/types/scoring';
import { useToast } from '@shared/stores/useToast';
import { upsertRecordIndexEntry, updateRecordIndexQualityStatus } from '@shared/services/cloudSync';
import {
    assessESLCurriculumQuality,
    assessESLLessonKitQuality,
} from '@shared/config/recordQuality';
import { migrateSavedLesson, migrateSavedCurriculum } from '../utils/schemaMigration';
import {
    curriculumRepositoryAdapter,
    lessonRepositoryAdapter,
} from '../services/recordRepositoryAdapter';
import { generateRecordId, isUuidLike } from '../utils/id';
import { listTeacherReviews, saveTeacherReview } from '../services/teacherReviewService';

/** Check if a string looks like a base64 data URI (not an IndexedDB key reference) */
const isBase64 = (s?: string) => s?.startsWith('data:');

type ImageRefs = {
    flashcardImages?: Record<number, string>;
    decodableTextImages?: Record<number, string>;
    grammarInfographicUrl?: string;
    blackboardImageUrl?: string;
    worksheets?: Array<{
        sections?: Array<{ items: Array<{ imageUrl?: string }> }>;
        items?: Array<{ imageUrl?: string }>;
    }>;
};

const STUDENT_BOOK_SUFFIX_RE = /\s*Student(?:'|\u2019)?s?\s*Book/gi;

function stripStudentBookSuffix(value?: string): string {
    return (value || '')
        .replace(STUDENT_BOOK_SUFFIX_RE, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeIdentityPart(value?: string): string {
    return (value || '').trim().toLowerCase();
}

function buildCurriculumIdentityKey(record: {
    textbookTitle?: string;
    targetLevel?: string;
    totalLessons?: number;
    curriculum?: ESLCurriculum | null;
}): string {
    const seriesCandidate = record.curriculum?.seriesName || record.textbookTitle || record.curriculum?.textbookTitle || '';
    const series = normalizeIdentityPart(stripStudentBookSuffix(seriesCandidate));
    const level = normalizeIdentityPart(record.targetLevel || record.curriculum?.targetLevel || '');
    const totalLessons = Number(record.totalLessons || record.curriculum?.totalLessons || record.curriculum?.lessons?.length || 0);
    const baseSeries = series || normalizeIdentityPart(record.textbookTitle || record.curriculum?.textbookTitle || '');
    return `${baseSeries}::${level}::${totalLessons}`;
}

function dedupeCurriculaByIdentity(records: SavedCurriculum[]): SavedCurriculum[] {
    const byIdentity = new Map<string, SavedCurriculum>();
    records.forEach((record) => {
        const key = buildCurriculumIdentityKey(record);
        const existing = byIdentity.get(key);
        const currentTs = record.lastModified ?? record.timestamp;
        const existingTs = existing ? (existing.lastModified ?? existing.timestamp) : -1;
        if (!existing || currentTs >= existingTs) {
            byIdentity.set(key, record);
        }
    });
    return Array.from(byIdentity.values());
}

function extractImageRefs(content: GeneratedContent): ImageRefs {
    return {
        flashcardImages: content.flashcardImages ? { ...content.flashcardImages } : undefined,
        decodableTextImages: content.decodableTextImages ? { ...content.decodableTextImages } : undefined,
        grammarInfographicUrl: content.grammarInfographicUrl,
        blackboardImageUrl: content.blackboardImageUrl,
        worksheets: content.worksheets?.map(ws => ({
            sections: ws.sections?.map(sec => ({
                items: sec.items.map(item => ({ imageUrl: item.imageUrl }))
            })),
            items: ws.items?.map(item => ({ imageUrl: item.imageUrl }))
        })),
    };
}

function applyImageRefs(content: GeneratedContent, refs: ImageRefs): GeneratedContent {
    const next = { ...content };
    if (refs.flashcardImages) next.flashcardImages = { ...refs.flashcardImages };
    if (refs.decodableTextImages) next.decodableTextImages = { ...refs.decodableTextImages };
    if (refs.grammarInfographicUrl !== undefined) next.grammarInfographicUrl = refs.grammarInfographicUrl;
    if (refs.blackboardImageUrl !== undefined) next.blackboardImageUrl = refs.blackboardImageUrl;
    if (refs.worksheets && next.worksheets) {
        next.worksheets = next.worksheets.map((ws, wi) => ({
            ...ws,
            sections: ws.sections?.map((sec, si) => ({
                ...sec,
                items: sec.items.map((item, ii) => ({
                    ...item,
                    imageUrl: refs.worksheets?.[wi]?.sections?.[si]?.items?.[ii]?.imageUrl ?? item.imageUrl,
                })),
            })),
            items: ws.items?.map((item, ii) => ({
                ...item,
                imageUrl: refs.worksheets?.[wi]?.items?.[ii]?.imageUrl ?? item.imageUrl,
            })),
        }));
    }
    return next;
}

/** Extract all base64 images from GeneratedContent, store in IndexedDB, return content with key refs */
async function stripImages(lessonId: string, content: GeneratedContent): Promise<GeneratedContent> {
    const entries: Array<{ key: string; data: string }> = [];
    const stripped = { ...content };

    // flashcardImages
    if (stripped.flashcardImages) {
        const refs: Record<number, string> = {};
        for (const [idx, data] of Object.entries(stripped.flashcardImages)) {
            if (isBase64(data)) {
                const key = `esl-${lessonId}-fc-${idx}`;
                entries.push({ key, data });
                refs[Number(idx)] = key;
            } else {
                refs[Number(idx)] = data; // already a ref
            }
        }
        stripped.flashcardImages = refs;
    }

    // decodableTextImages
    if (stripped.decodableTextImages) {
        const refs: Record<number, string> = {};
        for (const [idx, data] of Object.entries(stripped.decodableTextImages)) {
            if (isBase64(data)) {
                const key = `esl-${lessonId}-dt-${idx}`;
                entries.push({ key, data });
                refs[Number(idx)] = key;
            } else {
                refs[Number(idx)] = data;
            }
        }
        stripped.decodableTextImages = refs;
    }

    // grammarInfographicUrl
    if (isBase64(stripped.grammarInfographicUrl)) {
        const key = `esl-${lessonId}-grammar`;
        entries.push({ key, data: stripped.grammarInfographicUrl! });
        stripped.grammarInfographicUrl = key;
    }

    // blackboardImageUrl
    if (isBase64(stripped.blackboardImageUrl)) {
        const key = `esl-${lessonId}-blackboard`;
        entries.push({ key, data: stripped.blackboardImageUrl! });
        stripped.blackboardImageUrl = key;
    }

    // worksheet item imageUrls
    if (stripped.worksheets) {
        stripped.worksheets = stripped.worksheets.map((ws, wi) => ({
            ...ws,
            sections: ws.sections?.map((sec, si) => ({
                ...sec,
                items: sec.items.map((item, ii) => {
                    if (isBase64(item.imageUrl)) {
                        const key = `esl-${lessonId}-ws-${wi}-${si}-${ii}`;
                        entries.push({ key, data: item.imageUrl! });
                        return { ...item, imageUrl: key };
                    }
                    return item;
                })
            })),
            items: ws.items?.map((item, ii) => {
                if (isBase64(item.imageUrl)) {
                    const key = `esl-${lessonId}-wsi-${wi}-${ii}`;
                    entries.push({ key, data: item.imageUrl! });
                    return { ...item, imageUrl: key };
                }
                return item;
            })
        }));
    }

    if (entries.length > 0) {
        const urlMap = await imageStorage.saveBatch(entries);
        // Replace key refs with URLs where upload succeeded
        if (stripped.flashcardImages) {
            for (const [idx, val] of Object.entries(stripped.flashcardImages)) {
                const key = val as string;
                if (urlMap[key] && urlMap[key] !== entries.find(e => e.key === key)?.data) {
                    (stripped.flashcardImages as Record<number, string>)[Number(idx)] = urlMap[key];
                }
            }
        }
        if (stripped.decodableTextImages) {
            for (const [idx, val] of Object.entries(stripped.decodableTextImages)) {
                const key = val as string;
                if (urlMap[key] && urlMap[key] !== entries.find(e => e.key === key)?.data) {
                    (stripped.decodableTextImages as Record<number, string>)[Number(idx)] = urlMap[key];
                }
            }
        }
        if (stripped.grammarInfographicUrl && urlMap[stripped.grammarInfographicUrl]) {
            stripped.grammarInfographicUrl = urlMap[stripped.grammarInfographicUrl];
        }
        if (stripped.blackboardImageUrl && urlMap[stripped.blackboardImageUrl]) {
            stripped.blackboardImageUrl = urlMap[stripped.blackboardImageUrl];
        }
        if (stripped.worksheets) {
            stripped.worksheets = stripped.worksheets.map(ws => ({
                ...ws,
                sections: ws.sections?.map(sec => ({
                    ...sec,
                    items: sec.items.map(item => {
                        if (item.imageUrl && urlMap[item.imageUrl]) {
                            return { ...item, imageUrl: urlMap[item.imageUrl] };
                        }
                        return item;
                    })
                })),
                items: ws.items?.map(item => {
                    if (item.imageUrl && urlMap[item.imageUrl]) {
                        return { ...item, imageUrl: urlMap[item.imageUrl] };
                    }
                    return item;
                })
            }));
        }
    }
    return stripped;
}

/** Hydrate IndexedDB key references back to base64 data in a SavedLesson's content */
async function hydrateImages(lesson: SavedLesson): Promise<SavedLesson> {
    const c = { ...lesson.content };
    const hasRefs = (c as any).__imageRefs !== undefined;
    if (!hasRefs) {
        (c as any).__imageRefs = extractImageRefs(c);
        (c as any).__imageRefsFull = false;
    }
    const keys: string[] = [];

    // Collect all non-base64 refs
    if (c.flashcardImages) Object.values(c.flashcardImages).forEach(v => { if (!isBase64(v)) keys.push(v); });
    if (c.decodableTextImages) Object.values(c.decodableTextImages).forEach(v => { if (!isBase64(v)) keys.push(v); });
    if (c.grammarInfographicUrl && !isBase64(c.grammarInfographicUrl)) keys.push(c.grammarInfographicUrl);
    if (c.blackboardImageUrl && !isBase64(c.blackboardImageUrl)) keys.push(c.blackboardImageUrl);
    c.worksheets?.forEach(ws => {
        ws.sections?.forEach(sec => sec.items.forEach(item => { if (item.imageUrl && !isBase64(item.imageUrl)) keys.push(item.imageUrl); }));
        ws.items?.forEach(item => { if (item.imageUrl && !isBase64(item.imageUrl)) keys.push(item.imageUrl); });
    });

    if (keys.length === 0) return lesson;

    const images = await imageStorage.getBatch(keys);
    const resolve = (ref?: string) => (ref && images[ref]) || ref;

    // Hydrate
    if (c.flashcardImages) {
        const h: Record<number, string> = {};
        for (const [idx, ref] of Object.entries(c.flashcardImages)) h[Number(idx)] = resolve(ref) || ref;
        c.flashcardImages = h;
    }
    if (c.decodableTextImages) {
        const h: Record<number, string> = {};
        for (const [idx, ref] of Object.entries(c.decodableTextImages)) h[Number(idx)] = resolve(ref) || ref;
        c.decodableTextImages = h;
    }
    c.grammarInfographicUrl = resolve(c.grammarInfographicUrl);
    c.blackboardImageUrl = resolve(c.blackboardImageUrl);
    if (c.worksheets) {
        c.worksheets = c.worksheets.map(ws => ({
            ...ws,
            sections: ws.sections?.map(sec => ({
                ...sec,
                items: sec.items.map(item => ({ ...item, imageUrl: resolve(item.imageUrl) }))
            })),
            items: ws.items?.map(item => ({ ...item, imageUrl: resolve(item.imageUrl) }))
        }));
    }

    return { ...lesson, content: c };
}

function dehydrateLesson(lesson: SavedLesson): SavedLesson {
    const c: any = lesson.content;
    if (!c || c.__imageRefs === undefined) return lesson;
    const refs = c.__imageRefs;
    const refsFull = c.__imageRefsFull === true;
    let nextContent: GeneratedContent;
    if (refsFull) {
        nextContent = refs as GeneratedContent;
    } else {
        nextContent = applyImageRefs({ ...lesson.content }, refs as ImageRefs);
    }
    delete (nextContent as any).__imageRefs;
    delete (nextContent as any).__imageRefsFull;
    return { ...lesson, content: nextContent };
}

/** Generate a short description for a saved lesson kit */
function generateLessonDescription(content: GeneratedContent): string {
    const plan = content.structuredLessonPlan;
    const parts: string[] = [];
    parts.push(`A ${plan.classInformation.level} lesson on "${plan.classInformation.topic}"`);
    const counts: string[] = [];
    if (content.slides?.length) counts.push(`${content.slides.length} slides`);
    if (content.games?.length) counts.push(`${content.games.length} activities`);
    if (content.flashcards?.length) counts.push(`${content.flashcards.length} flashcards`);
    if (content.worksheets?.length) counts.push(`${content.worksheets.length} worksheets`);
    if (content.readingCompanion?.days?.length) counts.push(`${content.readingCompanion.days.length}-day review plan`);
    if (counts.length) parts.push(`with ${counts.join(', ')}`);
    let desc = parts.join(' ') + '.';
    // Fix L: Mark plan_only records visually
    if (content.generationPhase === 'plan_only') {
        desc += ' (Draft - plan only)';
    }
    return desc;
}

/** Generate a short description for a saved curriculum */
function generateCurriculumDescription(curriculum: ESLCurriculum): string {
    return curriculum.overview || `A ${curriculum.targetLevel} curriculum with ${curriculum.totalLessons} lessons covering "${curriculum.textbookTitle}".`;
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceTopicText(value: string | undefined, oldTopic: string, newTopic: string): string | undefined {
    if (!value) return value;
    if (!oldTopic || oldTopic === newTopic) return value;
    const matcher = new RegExp(escapeRegExp(oldTopic), 'g');
    return value.replace(matcher, newTopic);
}

function applyRenamedLessonTopic(lesson: SavedLesson, newTopicRaw: string): SavedLesson {
    const newTopic = newTopicRaw.trim();
    const oldTopic = (lesson.topic || lesson.content?.structuredLessonPlan?.classInformation?.topic || '').trim();
    const baseContent = lesson.content;
    const nextPlan = {
        ...baseContent.structuredLessonPlan,
        classInformation: {
            ...baseContent.structuredLessonPlan.classInformation,
            topic: newTopic,
        },
    };

    const assignmentSheet = baseContent.assignmentSheet
        ? {
            ...baseContent.assignmentSheet,
            lessonSummary: baseContent.assignmentSheet.lessonSummary?.startsWith('本课学习主题：')
                ? `本课学习主题：${newTopic}`
                : replaceTopicText(baseContent.assignmentSheet.lessonSummary, oldTopic, newTopic) || baseContent.assignmentSheet.lessonSummary,
            keyPoints: (baseContent.assignmentSheet.keyPoints || []).map((entry) => replaceTopicText(entry, oldTopic, newTopic) || entry),
        }
        : baseContent.assignmentSheet;

    const nextContent: GeneratedContent = {
        ...baseContent,
        structuredLessonPlan: nextPlan,
        lessonPlanMarkdown: replaceTopicText(baseContent.lessonPlanMarkdown, oldTopic, newTopic) || baseContent.lessonPlanMarkdown,
        notebookLMPrompt: replaceTopicText(baseContent.notebookLMPrompt, oldTopic, newTopic) || baseContent.notebookLMPrompt,
        assignmentSheet,
        _generationContext: baseContent._generationContext
            ? {
                ...baseContent._generationContext,
                topic: newTopic,
                lessonTitle: newTopic,
            }
            : baseContent._generationContext,
    };

    const nextDescription = lesson.description
        ? replaceTopicText(lesson.description, oldTopic, newTopic) || lesson.description
        : generateLessonDescription(nextContent);

    return {
        ...lesson,
        topic: newTopic,
        description: nextDescription,
        lastModified: Date.now(),
        content: nextContent,
    };
}

function stripLessonMetaFromContent(content: any): GeneratedContent {
    if (!content || typeof content !== 'object') return content as GeneratedContent;
    const next = { ...content };
    if ('__recordMeta' in next) {
        delete next.__recordMeta;
    }
    return next as GeneratedContent;
}

function withLessonMeta(content: GeneratedContent, lesson: SavedLesson): GeneratedContent & { __recordMeta: Record<string, unknown> } {
    return {
        ...content,
        __recordMeta: {
            curriculumId: lesson.curriculumId ?? null,
            unitNumber: lesson.unitNumber ?? null,
            lessonIndex: lesson.lessonIndex ?? null,
        },
    };
}

function buildLessonIndexBase(record: SavedLesson): Omit<RecordIndexEntry, 'recordId' | 'ownerId' | 'updatedAt'> {
    const quality = assessESLLessonKitQuality(record.content);
    return {
        appId: 'esl-planner',
        recordType: 'lesson_kit',
        title: record.topic || 'Untitled Lesson',
        searchableText: [
            record.topic,
            record.level,
            record.description,
            record.content?.structuredLessonPlan?.lessonDetails?.objectives?.join(' '),
            record.content?.structuredLessonPlan?.lessonDetails?.targetVocab?.map((item) => item.word).join(' '),
        ].filter(Boolean).join(' '),
        textbookLevelKey: record.content?.textbookLevelKey ?? null,
        cefr: record.level ?? null,
        curriculumId: record.curriculumId ?? null,
        unitNumber: record.unitNumber ?? null,
        tags: ['esl', 'lesson-kit', ...(quality.status === 'needs_review' ? ['needs-review'] : ['ready'])],
        qualityStatus: quality.status,
    };
}

function buildCurriculumIndexBase(record: SavedCurriculum): Omit<RecordIndexEntry, 'recordId' | 'ownerId' | 'updatedAt'> {
    const quality = assessESLCurriculumQuality(record.curriculum, record.params);
    return {
        appId: 'esl-planner',
        recordType: 'curriculum',
        title: record.textbookTitle || 'Untitled Curriculum',
        searchableText: [
            record.textbookTitle,
            record.targetLevel,
            record.description,
            record.curriculum?.overview,
            record.curriculum?.lessons?.map((lesson) => lesson.title).join(' '),
        ].filter(Boolean).join(' '),
        textbookLevelKey: record.params?.textbookLevelKey ?? null,
        cefr: record.targetLevel ?? null,
        curriculumId: record.id,
        unitNumber: null,
        tags: ['esl', 'curriculum', ...(quality.status === 'needs_review' ? ['needs-review'] : ['ready'])],
        qualityStatus: quality.status,
    };
}

function useLessonHistoryState() {
    const user = useAuthStore((s) => s.user);
    const {
        activeLessonId, setActiveLessonId, prefilledValues,
        curSearch, curLevel, curDate, curSort, curLessonRange,
        kitSearch, kitLevel, kitDate, kitSort, kitTextbook, recordsTab
    } = useAppStore();

    const {
        items: savedLessons,
        setItems: setSavedLessons,
        saveItem: saveLessonDb,
        deleteItem: deleteLessonDb,
        hydrateByIds: hydrateLessonRowsByIds,
        listDeletedItems: listDeletedLessonsDb,
        restoreItem: restoreLessonDb,
        purgeItem: purgeLessonDb,
    } = useProjectCRUD<SavedLesson>('esl_smart_planner_history', 300, {
        cloudTable: 'esl_lessons',
        repositoryAdapter: lessonRepositoryAdapter,
        mapToCloud: (l: SavedLesson) => ({
            id: l.id,
            name: l.topic,
            level: l.level,
            description: l.description,
            content_data: withLessonMeta(l.content, l),
        }),
        mapFromCloud: (row: any) => {
            const cloudContent = stripLessonMetaFromContent(row.content_data);
            const meta = row.content_data?.__recordMeta || {};
            return {
                id: row.id,
                timestamp: new Date(row.updated_at || row.created_at).getTime(),
                topic: row.name || 'Untitled',
                level: row.level,
                description: row.description || '',
                content: cloudContent,
                curriculumId: row.curriculum_id ?? meta.curriculumId ?? undefined,
                unitNumber: row.unit_number ?? meta.unitNumber ?? undefined,
                lessonIndex: row.lesson_index ?? meta.lessonIndex ?? undefined,
            } as SavedLesson;
        },
        buildIndexEntry: (record: SavedLesson) => buildLessonIndexBase(record),
        migrate: migrateSavedLesson,
    });
    const {
        items: savedCurricula,
        setItems: setSavedCurricula,
        saveItem: saveCurriculumDb,
        deleteItem: deleteCurriculumDb,
        hydrateByIds: hydrateCurriculumRowsByIds,
        listDeletedItems: listDeletedCurriculaDb,
        restoreItem: restoreCurriculumDb,
        purgeItem: purgeCurriculumDb,
    } = useProjectCRUD<SavedCurriculum>('esl_planner_curricula', 200, {
        cloudTable: 'esl_curricula',
        repositoryAdapter: curriculumRepositoryAdapter,
        mapToCloud: (c: SavedCurriculum) => ({ id: c.id, name: c.textbookTitle, level: c.targetLevel, total_lessons: c.totalLessons, description: c.description, curriculum_data: c.curriculum, params_data: c.params }),
        mapFromCloud: (row: any) => ({ id: row.id, timestamp: new Date(row.updated_at || row.created_at).getTime(), textbookTitle: row.name, targetLevel: row.level, totalLessons: row.total_lessons, description: row.description || '', curriculum: row.curriculum_data, params: row.params_data } as SavedCurriculum),
        buildIndexEntry: (record: SavedCurriculum) => buildCurriculumIndexBase(record),
        migrate: migrateSavedCurriculum,
    });

    // Title editing state (still local because transient UI state)
    const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [teacherReviewMap, setTeacherReviewMap] = useState<Record<string, TeacherReview>>({});
    const prevActiveLessonId = useRef<string | null>(null);
    const lessonIndexSyncSignatureRef = useRef('');
    const curriculumIndexSyncSignatureRef = useRef('');
    const pendingLessonIdRef = useRef<string | null>(null);
    const curriculumIdByIdentityRef = useRef<Record<string, string>>({});
    const canonicalCurricula = useMemo(
        () => dedupeCurriculaByIdentity(savedCurricula),
        [savedCurricula],
    );

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const reviews = await listTeacherReviews();
            if (cancelled) return;
            const mapped = reviews.reduce<Record<string, TeacherReview>>((acc, item) => {
                acc[item.recordId] = item;
                return acc;
            }, {});
            setTeacherReviewMap(mapped);
        })();
        return () => {
            cancelled = true;
        };
    }, [user?.id]);

    useEffect(() => {
        if (!user || savedLessons.length === 0) return;
        const signature = savedLessons
            .map((item) => `${item.id}:${item.lastModified ?? item.timestamp}`)
            .sort()
            .join('|');
        if (signature === lessonIndexSyncSignatureRef.current) return;
        lessonIndexSyncSignatureRef.current = signature;

        let cancelled = false;
        (async () => {
            for (const record of savedLessons) {
                if (cancelled) return;
                const base = buildLessonIndexBase(record);
                await upsertRecordIndexEntry({
                    ...base,
                    ownerId: user.id,
                    recordId: record.id,
                    updatedAt: new Date(record.lastModified ?? record.timestamp).toISOString(),
                });
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [savedLessons, user?.id]);

    useEffect(() => {
        const nextMap = { ...curriculumIdByIdentityRef.current };
        canonicalCurricula.forEach((record) => {
            const key = buildCurriculumIdentityKey(record);
            if (key) nextMap[key] = record.id;
        });
        curriculumIdByIdentityRef.current = nextMap;
    }, [canonicalCurricula]);

    useEffect(() => {
        if (!user || canonicalCurricula.length === 0) return;
        const signature = canonicalCurricula
            .map((item) => `${item.id}:${item.lastModified ?? item.timestamp}`)
            .sort()
            .join('|');
        if (signature === curriculumIndexSyncSignatureRef.current) return;
        curriculumIndexSyncSignatureRef.current = signature;

        let cancelled = false;
        (async () => {
            for (const record of canonicalCurricula) {
                if (cancelled) return;
                const base = buildCurriculumIndexBase(record);
                await upsertRecordIndexEntry({
                    ...base,
                    ownerId: user.id,
                    recordId: record.id,
                    updatedAt: new Date(record.lastModified ?? record.timestamp).toISOString(),
                });
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [canonicalCurricula, user?.id]);

    useEffect(() => {
        if (activeLessonId && pendingLessonIdRef.current === activeLessonId) {
            // Pending ID was promoted to active — clear it
            pendingLessonIdRef.current = null;
        } else if (!activeLessonId) {
            // Active lesson cleared (new generation starting) — clear pending to avoid
            // stale ID reuse that would overwrite a different lesson record
            pendingLessonIdRef.current = null;
        }
    }, [activeLessonId]);

    // Hydrate images from IndexedDB only for the ACTIVE lesson (lazy loading)
    // Previously hydrated ALL lessons at once, causing 200-500MB memory spikes
    useEffect(() => {
        if (!activeLessonId) return;
        const lesson = savedLessons.find(l => l.id === activeLessonId);
        if (!lesson) return;
        // Skip if already hydrated (has base64 data)
        const fc = lesson.content.flashcardImages;
        const hasImages = fc && Object.values(fc).some(v => typeof v === 'string' && (v.startsWith('data:') || v.startsWith('http')));
        if (hasImages) return;
        // Check if there are any refs to hydrate
        const hasRefs = fc && Object.values(fc).some(v => typeof v === 'string' && !v.startsWith('data:') && v.length > 0);
        if (!fc && !lesson.content.grammarInfographicUrl && !lesson.content.blackboardImageUrl) return;
        console.log('[Hydrate] Starting hydration for lesson', activeLessonId, hasRefs ? '(has refs)' : '(no refs)');
        let cancelled = false;
        hydrateImages(lesson).then(hydrated => {
            if (cancelled) return;
            // Merge only hydrated content so stale async hydration cannot overwrite
            // newer metadata edits (e.g. renamed titles from Records page).
            setSavedLessons(prev => prev.map(l => (
                l.id === hydrated.id
                    ? { ...l, content: hydrated.content }
                    : l
            )));
        });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeLessonId, savedLessons.length]);

    // Dehydrate images for the previously active lesson to avoid memory buildup
    useEffect(() => {
        const prevId = prevActiveLessonId.current;
        if (prevId && prevId !== activeLessonId) {
            setSavedLessons(prev => prev.map(l => l.id === prevId ? dehydrateLesson(l) : l));
        }
        prevActiveLessonId.current = activeLessonId || null;
    }, [activeLessonId, setSavedLessons]);

    // --- Filtered Curricula ---
    const filteredCurricula = useMemo(() => {
        let result = [...canonicalCurricula];
        if (curSearch.trim()) {
            const q = curSearch.toLowerCase();
            result = result.filter(c => c.textbookTitle.toLowerCase().includes(q) || c.targetLevel.toLowerCase().includes(q));
        }
        if (curLevel !== 'All Levels') result = result.filter(c => c.targetLevel === curLevel);
        if (curDate === 'today') result = result.filter(c => isToday(c.timestamp));
        else if (curDate === 'week') result = result.filter(c => isThisWeek(c.timestamp));
        else if (curDate === 'month') result = result.filter(c => isThisMonth(c.timestamp));
        if (curLessonRange !== 'all') {
            result = result.filter(c => {
                const n = c.totalLessons;
                if (curLessonRange === '1-10') return n >= 1 && n <= 10;
                if (curLessonRange === '11-20') return n >= 11 && n <= 20;
                if (curLessonRange === '21-40') return n >= 21 && n <= 40;
                if (curLessonRange === '40+') return n > 40;
                return true;
            });
        }
        result.sort((a, b) => {
            if (curSort === 'newest') return b.timestamp - a.timestamp;
            if (curSort === 'oldest') return a.timestamp - b.timestamp;
            if (curSort === 'az') return a.textbookTitle.localeCompare(b.textbookTitle);
            if (curSort === 'za') return b.textbookTitle.localeCompare(a.textbookTitle);
            return 0;
        });
        return result;
    }, [canonicalCurricula, curSearch, curLevel, curDate, curSort, curLessonRange]);

    // --- Filtered Kits ---
    const filteredKits = useMemo(() => {
        let result = [...savedLessons];
        if (kitSearch.trim()) {
            const q = kitSearch.toLowerCase();
            result = result.filter(l =>
                l.topic.toLowerCase().includes(q)
                || l.level?.toLowerCase().includes(q)
                || l.description?.toLowerCase().includes(q)
            );
        }
        if (kitLevel !== 'All Levels') result = result.filter(l => l.level === kitLevel);
        if (kitTextbook && kitTextbook !== 'all') {
            const tb = kitTextbook.toLowerCase();
            result = result.filter(l => {
                if (!l.curriculumId) return false;
                const cur = canonicalCurricula.find(c => c.id === l.curriculumId);
                const seriesName = cur?.curriculum?.seriesName
                    || cur?.textbookTitle?.replace(/\s*Student(?:'|\u2019)?s?\s*Book/gi, '').trim()
                    || cur?.textbookTitle;
                return seriesName?.toLowerCase() === tb;
            });
        }
        if (kitDate === 'today') result = result.filter(l => isToday(l.timestamp));
        else if (kitDate === 'week') result = result.filter(l => isThisWeek(l.timestamp));
        else if (kitDate === 'month') result = result.filter(l => isThisMonth(l.timestamp));
        result.sort((a, b) => {
            if (kitSort === 'newest') return b.timestamp - a.timestamp;
            if (kitSort === 'oldest') return a.timestamp - b.timestamp;
            if (kitSort === 'az') return a.topic.localeCompare(b.topic);
            if (kitSort === 'za') return b.topic.localeCompare(a.topic);
            return 0;
        });
        return result;
    }, [savedLessons, canonicalCurricula, kitSearch, kitLevel, kitDate, kitSort, kitTextbook]);

    // --- Unique textbook names for filter dropdown ---
    const textbookNames = useMemo(() => {
        const names = new Set<string>();
        canonicalCurricula.forEach(c => {
            const cleanedTitle = stripStudentBookSuffix(c.textbookTitle);
            const name = c.curriculum?.seriesName
                || cleanedTitle || c.textbookTitle
                || c.textbookTitle?.replace(/\s*Student(?:'|’)?s?\s*Book/gi, '').trim()
                || c.textbookTitle;
            if (name) names.add(name);
        });
        return Array.from(names).sort();
    }, [canonicalCurricula]);


    // --- CRUD handlers ---

    const handleSaveLesson = async (content: GeneratedContent): Promise<SaveResult> => {
        const existing = savedLessons.find(l => l.id === activeLessonId);
        const candidateId = activeLessonId || existing?.id || pendingLessonIdRef.current || generateRecordId();
        const shouldUpgradeLegacyId = Boolean(user && candidateId && !isUuidLike(candidateId));
        const lessonId = shouldUpgradeLegacyId ? generateRecordId() : candidateId;
        const legacyIdToRemove = shouldUpgradeLegacyId ? candidateId : null;
        pendingLessonIdRef.current = lessonId;
        // Strip images to IndexedDB before saving to localStorage
        const strippedContent = await stripImages(lessonId, content);
        const contentWithRefs = {
            ...content,
            __imageRefs: strippedContent,
            __imageRefsFull: true,
        } as any;

        const desc = existing?.description || generateLessonDescription(content);

        const newRecord: SavedLesson = {
            id: lessonId,
            timestamp: existing?.timestamp || Date.now(),
            lastModified: Date.now(),
            topic: content.structuredLessonPlan.classInformation.topic || existing?.topic || 'Untitled Lesson',
            level: content.structuredLessonPlan.classInformation.level,
            description: desc,
            content: strippedContent,
            // Curriculum metadata from prefilledValues (preserve existing on re-save)
            curriculumId: existing?.curriculumId ?? prefilledValues?.curriculumId,
            unitNumber: existing?.unitNumber ?? prefilledValues?.unitNumber,
            lessonIndex: existing?.lessonIndex ?? prefilledValues?.lessonIndex,
        };

        const saveResult = await saveLessonDb(newRecord);
        if (!saveResult.ok) {
            useToast.getState().error('Lesson save failed. Your local draft is kept. Click save again to retry cloud sync.');
            return saveResult;
        }

        if (activeLessonId !== lessonId) {
            setActiveLessonId(lessonId);
        }

        // In-memory keeps full base64 for display
        setSavedLessons((prev) => prev
            .filter((l) => (legacyIdToRemove ? l.id !== legacyIdToRemove : true))
            .map((l) => (l.id === lessonId ? { ...l, content: contentWithRefs } : l)));

        return saveResult;
    };

    const handleSaveCurriculum = async (curriculum: ESLCurriculum, params: CurriculumParams): Promise<SaveResult> => {
        const identityKey = buildCurriculumIdentityKey({
            textbookTitle: curriculum.textbookTitle,
            targetLevel: curriculum.targetLevel,
            totalLessons: curriculum.totalLessons,
            curriculum,
        });
        const exists = canonicalCurricula.find((c) => buildCurriculumIdentityKey(c) === identityKey);
        const desc = generateCurriculumDescription(curriculum);
        const candidateId = exists?.id || curriculumIdByIdentityRef.current[identityKey] || generateRecordId();
        const shouldUpgradeLegacyId = Boolean(user && candidateId && !isUuidLike(candidateId));
        const curriculumId = shouldUpgradeLegacyId ? generateRecordId() : candidateId;
        const legacyIdToRemove = shouldUpgradeLegacyId ? candidateId : null;

        const newRecord: SavedCurriculum = {
            id: curriculumId,
            timestamp: exists ? exists.timestamp : Date.now(),
            lastModified: Date.now(),
            textbookTitle: curriculum.textbookTitle,
            targetLevel: curriculum.targetLevel,
            totalLessons: curriculum.totalLessons,
            description: exists?.description || desc,
            curriculum,
            params,
        };

        const saveResult = await saveCurriculumDb(newRecord);
        if (!saveResult.ok) {
            useToast.getState().error('Curriculum save failed. Your local draft is kept. Click save again to retry cloud sync.');
            return saveResult;
        }
        curriculumIdByIdentityRef.current[identityKey] = curriculumId;

        if (legacyIdToRemove) {
            setSavedCurricula((prev) => prev.filter((c) => c.id !== legacyIdToRemove));
        }
        setSavedCurricula((prev) => dedupeCurriculaByIdentity(prev));

        return saveResult;
    };

    const handleDeleteCurriculum = async (id: string, e?: React.MouseEvent): Promise<SaveResult> => {
        e?.stopPropagation();
        const result = await deleteCurriculumDb(id);
        return result;
    };

    const handleDeleteRecord = async (id: string, e?: React.MouseEvent): Promise<SaveResult> => {
        e?.preventDefault();
        e?.stopPropagation();
        const result = await deleteLessonDb(id);
        if (result.ok) {
            if (activeLessonId === id) setActiveLessonId(null);
            // Clean up IndexedDB images after delete is confirmed.
            await imageStorage.removeByPrefix(`esl-${id}-`);
        }
        return result;
    };

    const listDeletedLessons = async (): Promise<SavedLesson[]> => listDeletedLessonsDb();

    const listDeletedCurricula = async (): Promise<SavedCurriculum[]> => listDeletedCurriculaDb();

    const handleRestoreLesson = async (id: string): Promise<SaveResult> => {
        const result = await restoreLessonDb(id);
        return result;
    };

    const handleRestoreCurriculum = async (id: string): Promise<SaveResult> => {
        const result = await restoreCurriculumDb(id);
        return result;
    };

    const handlePurgeLesson = async (id: string): Promise<SaveResult> => {
        const result = await purgeLessonDb(id);
        if (result.ok) {
            if (activeLessonId === id) setActiveLessonId(null);
            await imageStorage.removeByPrefix(`esl-${id}-`);
        }
        return result;
    };

    const handlePurgeCurriculum = async (id: string): Promise<SaveResult> => {
        const result = await purgeCurriculumDb(id);
        return result;
    };

    const startEditing = (lesson: SavedLesson, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingLessonId(lesson.id);
        setEditTitle(lesson.topic);
    };

    const saveTitle = async (id: string, e?: React.MouseEvent | React.KeyboardEvent) => {
        if (e) e.stopPropagation();
        if (!editTitle.trim()) return;
        const lesson = savedLessons.find(l => l.id === id);
        if (lesson) {
            const updated = applyRenamedLessonTopic(lesson, editTitle);
            await saveLessonDb(updated);
        }
        setEditingLessonId(null);
    };

    const cancelEditing = (e: React.MouseEvent) => { e.stopPropagation(); setEditingLessonId(null); };

    const handleRenameLesson = async (id: string, newName: string): Promise<SaveResult> => {
        if (!newName.trim()) return { ok: false, source: 'local', message: 'Title cannot be empty.' };
        const lesson = savedLessons.find(l => l.id === id);
        if (lesson) {
            const nextTitle = newName.trim();
            if (lesson.topic === nextTitle) {
                return { ok: true, source: 'local' };
            }
            const updated = applyRenamedLessonTopic(lesson, nextTitle);
            const result = await saveLessonDb(updated);
            if (result.ok && activeLessonId === id) {
                // Keep Create page state in sync to avoid hidden auto-save writing stale title back.
                useSessionStore.getState().setState((prev) => ({
                    ...prev,
                    generatedContent: updated.content,
                }));
            }
            return result;
        }
        return { ok: false, source: 'local', message: 'Lesson not found.' };
    };

    const hydrateLessonsByIds = async (ids: string[]) => hydrateLessonRowsByIds(ids);
    const hydrateCurriculaByIds = async (ids: string[]) => hydrateCurriculumRowsByIds(ids);

    const handleTeacherReview = async (
        recordId: string,
        accepted: boolean,
        payload?: {
            editedSections?: string[];
            comment?: string;
            finalScore?: number;
            modelScore?: number;
            textbookLevelKey?: string;
        },
    ): Promise<SaveResult> => {
        const result = await saveTeacherReview({
            recordId,
            accepted,
            editedSections: payload?.editedSections ?? [],
            comment: payload?.comment,
            finalScore: payload?.finalScore,
            modelScore: payload?.modelScore,
            textbookLevelKey: payload?.textbookLevelKey,
        });
        if (result.ok) {
            setTeacherReviewMap((prev) => ({
                ...prev,
                [recordId]: {
                    recordId,
                    accepted,
                    editedSections: payload?.editedSections ?? [],
                    comment: payload?.comment,
                    finalScore: payload?.finalScore,
                    modelScore: payload?.modelScore,
                    textbookLevelKey: payload?.textbookLevelKey,
                    createdAt: new Date().toISOString(),
                },
            }));
            // Sync qualityGate & reviewerStatus so sidebar queue and risk badge update
            if (accepted) {
                setSavedLessons((prev) => prev.map((l) => {
                    if (l.id !== recordId) return l;
                    const c = { ...l.content };
                    if (c.qualityGate) c.qualityGate = { ...c.qualityGate, status: 'ok' as const };
                    if (c.scoreReport) c.scoreReport = { ...c.scoreReport, reviewerStatus: 'ready_to_teach' as const };
                    const updated = { ...l, content: c };
                    // Persist the updated content
                    saveLessonDb(updated).catch(() => { /* silent – review already saved */ });
                    // Also update record_index so sidebar review queue reflects the change
                    if (user?.id) {
                        updateRecordIndexQualityStatus(user.id, recordId, 'ok').catch(() => { });
                    }
                    return updated;
                }));
            }
        }
        return result;
    };

    return {
        // Data
        savedLessons,
        savedCurricula: canonicalCurricula,
        filteredCurricula,
        filteredKits,
        textbookNames,

        // Title editing
        editingLessonId, editTitle, setEditTitle,
        startEditing, saveTitle, cancelEditing,

        // CRUD
        handleSaveLesson,
        handleSaveCurriculum,
        handleDeleteCurriculum,
        handleDeleteRecord,
        listDeletedLessons,
        listDeletedCurricula,
        handleRestoreLesson,
        handleRestoreCurriculum,
        handlePurgeLesson,
        handlePurgeCurriculum,
        handleRenameLesson,
        handleTeacherReview,

        // Raw DB Save for Batch Generation
        saveLessonDb,
        hydrateLessonsByIds,
        hydrateCurriculaByIds,
        teacherReviewMap,
    };
}

type LessonHistoryState = ReturnType<typeof useLessonHistoryState>;

const LessonHistoryContext = createContext<LessonHistoryState | null>(null);

export const LessonHistoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const value = useLessonHistoryState();
    return React.createElement(LessonHistoryContext.Provider, { value }, children);
};

export function useLessonHistory(): LessonHistoryState {
    const context = useContext(LessonHistoryContext);
    if (!context) {
        throw new Error('useLessonHistory must be used inside <LessonHistoryProvider>.');
    }
    return context;
}
