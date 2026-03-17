export type ScoreDimensionKey =
    | 'accuracy'
    | 'teachability'
    | 'objective_alignment'
    | 'assessment_measurability'
    | 'age_appropriateness';

export interface DimensionScore {
    key: ScoreDimensionKey;
    label: string;
    score: number;
    maxScore: number;
    issues: string[];
    actionableFixes: string[];
}

export interface ScoreReport {
    overallScore: number;
    dimensionScores: DimensionScore[];
    risks: string[];
    actionableFixes: string[];
    reviewerStatus: 'ready_to_teach' | 'needs_teacher_review';
    generatedAt: string;
    calibration?: {
        textbookLevelKey: string;
        sampleCount: number;
        appliedDelta: number;
        confidence: 'low' | 'medium' | 'high';
    };
}

export interface TeacherReview {
    recordId: string;
    accepted: boolean;
    editedSections: string[];
    comment?: string;
    finalScore?: number;
    modelScore?: number;
    textbookLevelKey?: string;
    createdAt: string;
}

export interface ScoringCalibrationProfile {
    textbookLevelKey: string;
    sampleCount: number;
    avgDelta: number;
    updatedAt: string;
}
