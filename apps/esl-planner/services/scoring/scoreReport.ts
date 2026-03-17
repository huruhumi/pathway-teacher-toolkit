import type { ScoreReport, DimensionScore } from '@shared/types/scoring';
import type { GroundingStatus, QualityGate } from '@shared/types/quality';
import type { GeneratedContent } from '../../types';
import { applyCalibrationToScoreReport } from './scoringCalibration';

interface BuildScoreReportOptions {
    content: GeneratedContent;
    groundingStatus: GroundingStatus;
    qualityGate: QualityGate;
    textbookLevelKey?: string;
}

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

function createDimension(
    key: DimensionScore['key'],
    label: string,
    score: number,
    issues: string[],
    fixes: string[],
): DimensionScore {
    return {
        key,
        label,
        score: clamp(Math.round(score)),
        maxScore: 100,
        issues: Array.from(new Set(issues.filter(Boolean))),
        actionableFixes: Array.from(new Set(fixes.filter(Boolean))),
    };
}

export function buildESLScoreReport({
    content,
    groundingStatus,
    qualityGate,
    textbookLevelKey,
}: BuildScoreReportOptions): ScoreReport {
    const risks: string[] = [];

    let accuracyBase = groundingStatus === 'verified' ? 90 : groundingStatus === 'mixed' ? 78 : 62;
    accuracyBase -= qualityGate.issues.length * 5;
    const accuracyIssues = [...qualityGate.issues];
    const accuracyFixes: string[] = [];
    if (groundingStatus === 'unverified') {
        accuracyIssues.push('Knowledge grounding is unverified.');
        accuracyFixes.push('Connect textbook-level knowledge base and regenerate before classroom delivery.');
        risks.push('Generated content is not fully grounded to textbook evidence.');
    }
    const accuracy = createDimension(
        'accuracy',
        'Accuracy',
        accuracyBase,
        accuracyIssues,
        accuracyFixes,
    );

    const stageCount = content.structuredLessonPlan?.stages?.length || 0;
    const gameCount = content.games?.length || 0;
    const materialCount = content.structuredLessonPlan?.lessonDetails?.materials?.length || 0;
    let teachabilityBase = 65 + Math.min(stageCount, 6) * 4 + Math.min(gameCount, 4) * 3;
    const teachabilityIssues: string[] = [];
    const teachabilityFixes: string[] = [];
    if (materialCount < 3) {
        teachabilityBase -= 8;
        teachabilityIssues.push('Material list is too thin for execution.');
        teachabilityFixes.push('Add concrete materials and preparation notes for each stage.');
    }
    if (stageCount < 3) {
        teachabilityBase -= 12;
        teachabilityIssues.push('Lesson staging is insufficient.');
        teachabilityFixes.push('Expand stages into warm-up, input, practice, and closure.');
    }
    const teachability = createDimension(
        'teachability',
        'Teaching Practicality',
        teachabilityBase,
        teachabilityIssues,
        teachabilityFixes,
    );

    const objectiveCount = content.structuredLessonPlan?.lessonDetails?.objectives?.length || 0;
    const vocabCount = content.structuredLessonPlan?.lessonDetails?.targetVocab?.length || 0;
    const grammarCount = content.structuredLessonPlan?.lessonDetails?.grammarSentences?.length || 0;
    let alignmentBase = 60 + Math.min(objectiveCount, 6) * 5 + Math.min(vocabCount, 10) * 1.5 + Math.min(grammarCount, 6) * 2;
    const alignmentIssues: string[] = [];
    const alignmentFixes: string[] = [];
    if (objectiveCount === 0) {
        alignmentBase -= 20;
        alignmentIssues.push('No explicit learning objectives were generated.');
        alignmentFixes.push('Define 3-5 measurable objectives aligned to textbook level outcomes.');
    }
    if (vocabCount < 4) {
        alignmentBase -= 8;
        alignmentIssues.push('Target vocabulary coverage is too narrow.');
        alignmentFixes.push('Expand target vocabulary with level-appropriate lexical sets.');
    }
    const objectiveAlignment = createDimension(
        'objective_alignment',
        'Objective Alignment',
        alignmentBase,
        alignmentIssues,
        alignmentFixes,
    );

    const worksheetCount = content.worksheets?.length || 0;
    const companionDays = content.readingCompanion?.days?.length || 0;
    let measurabilityBase = 62 + Math.min(worksheetCount, 3) * 10 + (companionDays >= 3 ? 8 : 0);
    const measurabilityIssues: string[] = [];
    const measurabilityFixes: string[] = [];
    if (worksheetCount === 0) {
        measurabilityBase -= 18;
        measurabilityIssues.push('No worksheet evidence for assessment.');
        measurabilityFixes.push('Add formative checks or exit tickets tied to each objective.');
    }
    if (!content.structuredLessonPlan?.lessonDetails?.anticipatedProblems?.length) {
        measurabilityBase -= 8;
        measurabilityIssues.push('Anticipated problem-solving evidence is missing.');
        measurabilityFixes.push('Add anticipated problems with observable intervention criteria.');
    }
    const assessmentMeasurability = createDimension(
        'assessment_measurability',
        'Assessment Measurability',
        measurabilityBase,
        measurabilityIssues,
        measurabilityFixes,
    );

    const studentCountRaw = content.structuredLessonPlan?.classInformation?.students || '';
    const studentCount = Number.parseInt(studentCountRaw, 10);
    let ageFitBase = 78;
    const ageFitIssues: string[] = [];
    const ageFitFixes: string[] = [];
    if (Number.isFinite(studentCount) && studentCount > 24) {
        ageFitBase -= 10;
        ageFitIssues.push('Large class size may reduce activity feasibility.');
        ageFitFixes.push('Provide large-class adaptations and simplified station rotations.');
    }
    if (content.flashcards?.length === 0 && content.games?.length === 0) {
        ageFitBase -= 14;
        ageFitIssues.push('Low engagement materials for young learners.');
        ageFitFixes.push('Add game-like practice and visual supports for age engagement.');
    }
    const ageAppropriateness = createDimension(
        'age_appropriateness',
        'Age Appropriateness',
        ageFitBase,
        ageFitIssues,
        ageFitFixes,
    );

    const dimensionScores = [
        accuracy,
        teachability,
        objectiveAlignment,
        assessmentMeasurability,
        ageAppropriateness,
    ];

    const overallScore = Math.round(
        dimensionScores.reduce((sum, item) => sum + item.score, 0) / dimensionScores.length,
    );
    const actionableFixes = Array.from(
        new Set(dimensionScores.flatMap((item) => item.actionableFixes)),
    );

    const reviewerStatus =
        overallScore >= 80 && qualityGate.status === 'ok' && groundingStatus !== 'unverified'
            ? 'ready_to_teach'
            : 'needs_teacher_review';

    if (reviewerStatus === 'needs_teacher_review' && risks.length === 0) {
        risks.push('At least one scoring dimension requires teacher review before delivery.');
    }

    const baseReport: ScoreReport = {
        overallScore,
        dimensionScores,
        risks,
        actionableFixes,
        reviewerStatus,
        generatedAt: new Date().toISOString(),
    };

    return applyCalibrationToScoreReport(
        baseReport,
        textbookLevelKey || content.textbookLevelKey,
    );
}
