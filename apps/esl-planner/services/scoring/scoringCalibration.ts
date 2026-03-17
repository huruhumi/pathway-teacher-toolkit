import type { ScoreReport, ScoringCalibrationProfile } from '@shared/types/scoring';

const STORAGE_KEY = 'esl_scoring_calibration_profiles_v1';

type CalibrationMap = Record<string, ScoringCalibrationProfile>;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function readCalibrationMap(): CalibrationMap {
    if (typeof window === 'undefined') return {};
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as CalibrationMap;
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function writeCalibrationMap(map: CalibrationMap): void {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch {
        // no-op: calibration is a soft enhancement and should never block generation
    }
}

function confidenceFromSamples(sampleCount: number): 'low' | 'medium' | 'high' {
    if (sampleCount >= 16) return 'high';
    if (sampleCount >= 6) return 'medium';
    return 'low';
}

function dampingBySamples(sampleCount: number): number {
    if (sampleCount >= 16) return 1;
    if (sampleCount >= 6) return 0.7;
    if (sampleCount >= 3) return 0.4;
    return 0;
}

export function getScoringCalibrationProfile(textbookLevelKey?: string): ScoringCalibrationProfile | null {
    if (!textbookLevelKey) return null;
    const map = readCalibrationMap();
    return map[textbookLevelKey] || null;
}

export function listScoringCalibrationProfiles(): ScoringCalibrationProfile[] {
    const map = readCalibrationMap();
    return Object.values(map).sort((a, b) => b.sampleCount - a.sampleCount);
}

export function mergeScoringCalibrationProfiles(
    profiles: ScoringCalibrationProfile[],
): void {
    if (!profiles.length) return;
    const map = readCalibrationMap();

    profiles.forEach((profile) => {
        if (!profile?.textbookLevelKey) return;
        const prev = map[profile.textbookLevelKey];
        if (!prev) {
            map[profile.textbookLevelKey] = profile;
            return;
        }

        const shouldUseIncoming =
            profile.sampleCount > prev.sampleCount
            || (
                profile.sampleCount === prev.sampleCount
                && new Date(profile.updatedAt).getTime() > new Date(prev.updatedAt).getTime()
            );

        if (shouldUseIncoming) {
            map[profile.textbookLevelKey] = profile;
        }
    });

    writeCalibrationMap(map);
}

export function recordCalibrationSample(
    textbookLevelKey: string,
    modelScore: number,
    finalScore: number,
): ScoringCalibrationProfile {
    const map = readCalibrationMap();
    const prev = map[textbookLevelKey];
    const prevCount = prev?.sampleCount ?? 0;
    const prevAvg = prev?.avgDelta ?? 0;
    const sampleCount = prevCount + 1;
    const delta = clamp(finalScore - modelScore, -25, 25);
    const avgDelta = clamp(((prevAvg * prevCount) + delta) / sampleCount, -15, 15);

    const next: ScoringCalibrationProfile = {
        textbookLevelKey,
        sampleCount,
        avgDelta,
        updatedAt: new Date().toISOString(),
    };

    map[textbookLevelKey] = next;
    writeCalibrationMap(map);
    return next;
}

export function applyCalibrationToScoreReport(
    report: ScoreReport,
    textbookLevelKey?: string,
): ScoreReport {
    if (!textbookLevelKey) return report;

    const profile = getScoringCalibrationProfile(textbookLevelKey);
    if (!profile) return report;

    const appliedDelta = clamp(profile.avgDelta * dampingBySamples(profile.sampleCount), -10, 10);
    if (Math.abs(appliedDelta) < 0.25) {
        return {
            ...report,
            calibration: {
                textbookLevelKey,
                sampleCount: profile.sampleCount,
                appliedDelta: 0,
                confidence: confidenceFromSamples(profile.sampleCount),
            },
        };
    }

    const dimensionScores = report.dimensionScores.map((item) => ({
        ...item,
        score: clamp(Math.round(item.score + appliedDelta), 0, item.maxScore),
    }));
    const overallScore = clamp(Math.round(
        dimensionScores.reduce((sum, item) => sum + item.score, 0) / dimensionScores.length,
    ), 0, 100);

    const reviewerStatus =
        overallScore >= 80 && report.reviewerStatus === 'ready_to_teach'
            ? 'ready_to_teach'
            : overallScore >= 80 && report.reviewerStatus === 'needs_teacher_review' && appliedDelta > 0
                ? 'ready_to_teach'
                : 'needs_teacher_review';

    return {
        ...report,
        overallScore,
        dimensionScores,
        reviewerStatus,
        calibration: {
            textbookLevelKey,
            sampleCount: profile.sampleCount,
            appliedDelta,
            confidence: confidenceFromSamples(profile.sampleCount),
        },
    };
}
