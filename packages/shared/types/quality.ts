export type GroundingStatus = 'verified' | 'mixed' | 'unverified';

export interface QualityGate {
    pass: boolean;
    status: 'ok' | 'needs_review';
    issues: string[];
}

