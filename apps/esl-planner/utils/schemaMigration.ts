/**
 * Schema migration for ESL Planner saved records.
 *
 * Applied when loading records from Supabase via useProjectCRUD's `migrate` option.
 * Patches old record shapes to match the current TypeScript types.
 */
import type { SavedLesson, SavedCurriculum } from '../types';

/** Migrate a SavedLesson to the latest schema. */
export function migrateSavedLesson(raw: SavedLesson): SavedLesson {
    // --- lastModified: default to timestamp ---
    if (!raw.lastModified) {
        raw.lastModified = raw.timestamp;
    }

    // --- description ---
    if (!raw.description) {
        raw.description = '';
    }

    const content = raw.content;
    if (!content) return raw;

    // --- worksheets: default to empty array ---
    if (!content.worksheets) {
        content.worksheets = [];
    }

    // --- readingCompanion: ensure structure ---
    if (!content.readingCompanion) {
        (content as any).readingCompanion = { days: [], webResources: [] };
    } else {
        if (!content.readingCompanion.webResources) {
            content.readingCompanion.webResources = [];
        }
    }

    // --- phonics: migrate deprecated decodableText → decodableTexts ---
    if (content.phonics) {
        const p = content.phonics as any;
        if (p.decodableText && (!p.decodableTexts || p.decodableTexts.length === 0)) {
            p.decodableTexts = [p.decodableText];
        }
        if (!p.decodableTexts) p.decodableTexts = [];
        if (!p.decodableTextPrompts) p.decodableTextPrompts = [];
        if (!p.keyPoints) p.keyPoints = [];
    }

    // --- flashcardImages / decodableTextImages ---
    if (!content.flashcardImages) {
        content.flashcardImages = {};
    }
    if (!content.decodableTextImages) {
        content.decodableTextImages = {};
    }

    // --- summary: ensure structure ---
    if (!content.summary) {
        (content as any).summary = { objectives: '', targetVocab: [], grammarPoints: [] };
    }

    // --- games: ensure isCompleted defaults ---
    if (content.games) {
        content.games = content.games.map(g => ({
            ...g,
            isCompleted: g.isCompleted ?? false,
        }));
    }

    // --- stages: ensure new optional fields ---
    if (content.structuredLessonPlan?.stages) {
        content.structuredLessonPlan.stages = content.structuredLessonPlan.stages.map(s => ({
            ...s,
            teachingTips: s.teachingTips || [],
            backgroundKnowledge: s.backgroundKnowledge || [],
        }));
    }

    return raw;
}

/** Migrate a SavedCurriculum to the latest schema. */
export function migrateSavedCurriculum(raw: SavedCurriculum): SavedCurriculum {
    if (!raw.lastModified) {
        raw.lastModified = raw.timestamp;
    }
    if (!raw.description) {
        raw.description = raw.curriculum?.overview || '';
    }
    // Ensure lessons have newer fields
    if (raw.curriculum?.lessons) {
        raw.curriculum.lessons = raw.curriculum.lessons.map((l, i) => ({
            ...l,
            unitNumber: l.unitNumber ?? undefined,
            lessonInUnit: l.lessonInUnit ?? undefined,
            lessonType: l.lessonType ?? undefined,
        }));
    }
    return raw;
}
