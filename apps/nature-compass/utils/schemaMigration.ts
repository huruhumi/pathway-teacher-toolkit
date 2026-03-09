/**
 * Schema migration for Nature Compass saved records.
 * 
 * Applied when loading records from Supabase via useProjectCRUD's `migrate` option.
 * Patches old record shapes to match the current TypeScript types.
 */
import type { SavedLessonPlan, SavedCurriculum, LessonPlanResponse, HandbookPage } from '../types';

/** Migrate a SavedLessonPlan to the latest schema. */
export function migrateSavedPlan(raw: SavedLessonPlan): SavedLessonPlan {
    const plan = raw.plan;
    if (!plan) return raw;

    // --- basicInfo.location ---
    if (plan.basicInfo && !('location' in plan.basicInfo)) {
        (plan.basicInfo as any).location = '';
    }

    // --- handbookStructurePlan ---
    if (!('handbookStructurePlan' in plan)) {
        (plan as any).handbookStructurePlan = undefined;
    }

    // --- handbook[].section: 'Introduction' → keep as-is (valid), ensure 'Cover' works ---
    if (plan.handbook) {
        plan.handbook = plan.handbook.map((page: HandbookPage) => {
            // Old records might lack section — provide fallback
            if (!page.section) {
                return { ...page, section: 'Activity/Worksheet' as HandbookPage['section'] };
            }
            return page;
        });
    }

    // --- translatedPlan: ensure it exists ---
    if (!('translatedPlan' in plan)) {
        (plan as any).translatedPlan = undefined;
    }

    // --- language: ensure it exists ---
    if (!raw.language) {
        raw.language = 'en';
    }

    return raw;
}

/** Migrate a SavedCurriculum to the latest schema. */
export function migrateSavedCurriculum(raw: SavedCurriculum): SavedCurriculum {
    // Curricula haven't had major schema changes yet.
    // Add future migrations here.
    if (!raw.description) {
        raw.description = raw.curriculum?.overview || '';
    }
    return raw;
}
