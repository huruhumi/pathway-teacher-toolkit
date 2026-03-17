import localforage from 'localforage';
import type { SaveResult } from '@shared/types';
import type { TeacherReview, ScoringCalibrationProfile } from '@shared/types/scoring';
import { useAuthStore } from '@shared/stores/useAuthStore';
import {
    fetchCloudRecords,
    upsertCloudRecord,
    updateRecordIndexQualityStatus,
} from '@shared/services/cloudSync';
import { mergeScoringCalibrationProfiles, recordCalibrationSample } from './scoring/scoringCalibration';

const STORAGE_KEY = 'esl_teacher_reviews';

type TeacherReviewInput = Omit<TeacherReview, 'createdAt'>;

async function getLocalReviews(): Promise<TeacherReview[]> {
    const raw = await localforage.getItem<TeacherReview[]>(STORAGE_KEY);
    return raw ?? [];
}

async function setLocalReviews(reviews: TeacherReview[]): Promise<void> {
    await localforage.setItem(STORAGE_KEY, reviews);
}

export async function saveTeacherReview(input: TeacherReviewInput): Promise<SaveResult> {
    const review: TeacherReview = {
        ...input,
        createdAt: new Date().toISOString(),
    };

    const local = await getLocalReviews();
    const next = [
        review,
        ...local.filter((item) => item.recordId !== review.recordId),
    ];
    await setLocalReviews(next);

    const user = useAuthStore.getState().user;
    if (!user) {
        return { ok: true, source: 'local', pendingSync: true };
    }

    const id = `${user.id}:${review.recordId}`;
    const cloudResult = await upsertCloudRecord('teacher_reviews', user.id, {
        id,
        record_id: review.recordId,
        accepted: review.accepted,
        edited_sections: review.editedSections,
        comment: review.comment || null,
        final_score: review.finalScore ?? null,
        model_score: review.modelScore ?? null,
        textbook_level_key: review.textbookLevelKey ?? null,
        created_at: review.createdAt,
    });

    if (!cloudResult.ok) {
        return cloudResult;
    }

    await updateRecordIndexQualityStatus(
        user.id,
        review.recordId,
        review.accepted ? 'ok' : 'needs_review',
    );

    if (
        review.textbookLevelKey
        && typeof review.modelScore === 'number'
        && typeof review.finalScore === 'number'
    ) {
        const profile = recordCalibrationSample(
            review.textbookLevelKey,
            review.modelScore,
            review.finalScore,
        );
        await upsertCloudRecord('esl_scoring_calibration', user.id, {
            id: `${user.id}:${profile.textbookLevelKey}`,
            textbook_level_key: profile.textbookLevelKey,
            sample_count: profile.sampleCount,
            avg_delta: profile.avgDelta,
            updated_at: profile.updatedAt,
        });
    }

    return cloudResult;
}

export async function listTeacherReviews(): Promise<TeacherReview[]> {
    const local = await getLocalReviews();
    const user = useAuthStore.getState().user;
    if (!user) return local;

    const cloud = await fetchCloudRecords<any>('teacher_reviews', user.id, 'updated_at', 200);
    const calibrationRows = await fetchCloudRecords<any>('esl_scoring_calibration', user.id, 'updated_at', 200);
    if (calibrationRows.length > 0) {
        const profiles: ScoringCalibrationProfile[] = calibrationRows
            .map((row) => ({
                textbookLevelKey: row.textbook_level_key,
                sampleCount: Number(row.sample_count) || 0,
                avgDelta: Number(row.avg_delta) || 0,
                updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
            }))
            .filter((item) => item.textbookLevelKey);
        mergeScoringCalibrationProfiles(profiles);
    }

    if (cloud.length === 0) return local;

    const cloudMapped: TeacherReview[] = cloud.map((row) => ({
        recordId: row.record_id,
        accepted: Boolean(row.accepted),
        editedSections: Array.isArray(row.edited_sections) ? row.edited_sections : [],
        comment: row.comment || undefined,
        finalScore: typeof row.final_score === 'number' ? row.final_score : undefined,
        modelScore: typeof row.model_score === 'number' ? row.model_score : undefined,
        textbookLevelKey: row.textbook_level_key || undefined,
        createdAt: row.created_at || row.updated_at || new Date().toISOString(),
    }));

    const mergedMap = new Map<string, TeacherReview>();
    [...local, ...cloudMapped].forEach((item) => {
        const prev = mergedMap.get(item.recordId);
        if (!prev || new Date(item.createdAt).getTime() >= new Date(prev.createdAt).getTime()) {
            mergedMap.set(item.recordId, item);
        }
    });

    const merged = Array.from(mergedMap.values());
    await setLocalReviews(merged);
    return merged;
}
