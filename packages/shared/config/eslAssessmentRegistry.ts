import textbookLevelRegistry from './textbook-level-registry.json';
import assessmentPackRegistry from './assessment-pack-registry.json';
import type { GroundingStatus, QualityGate } from '../types/quality';

export type RegistryStatus = 'draft' | 'ready' | 'archived';

export interface TextbookLevelRegistryItem {
    levelKey: string;
    displayName: string;
    assessmentPackId: string;
    notebookId?: string;
    status: RegistryStatus;
}

export interface TextbookLevelOptionView {
    levelKey: string;
    status: RegistryStatus;
    textbookId: string;
    textbookName: string;
    volumeLabel: string;
    levelLabel: string;
    levelDisplayName: string;
}

export interface TextbookLevelGroupView {
    textbookId: string;
    textbookName: string;
    options: TextbookLevelOptionView[];
}

export interface AssessmentPackRegistryItem {
    id: string;
    title: string;
    summary: string;
    objectives: string[];
    performanceIndicators: string[];
    rubricBands: string[];
    commonErrors: string[];
    exemplarTasks: string[];
}

const LEVEL_REGISTRY = textbookLevelRegistry as TextbookLevelRegistryItem[];
const PACK_REGISTRY = assessmentPackRegistry as AssessmentPackRegistryItem[];

export function listTextbookLevelRegistry(): TextbookLevelRegistryItem[] {
    return LEVEL_REGISTRY;
}

export function listSelectableTextbookLevels(): TextbookLevelRegistryItem[] {
    return LEVEL_REGISTRY.filter((item) => item.status !== 'archived');
}

function inferTextbookIdentity(item: TextbookLevelRegistryItem): { textbookId: string; textbookName: string } {
    const key = item.levelKey.toLowerCase();
    if (key.startsWith('trailblazer-')) return { textbookId: 'trailblazer', textbookName: 'Trailblazer' };
    if (key.startsWith('reflect-')) return { textbookId: 'reflect', textbookName: 'Reflect' };
    if (key.startsWith('pathways-')) return { textbookId: 'pathways', textbookName: 'Pathways' };
    const token = (item.displayName || '').trim().split(/\s+/)[0] || 'other';
    return {
        textbookId: token.toLowerCase(),
        textbookName: token,
    };
}

export function buildTextbookLevelOptionViews(
    levels: TextbookLevelRegistryItem[] = listSelectableTextbookLevels(),
): TextbookLevelOptionView[] {
    return levels.map((item) => {
        const { textbookId, textbookName } = inferTextbookIdentity(item);
        const match = item.displayName.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
        const baseLabel = (match?.[1] || item.displayName || '').trim();
        const levelLabel = (match?.[2] || '').trim();
        let volumeLabel = baseLabel;
        const textbookPrefix = textbookName.toLowerCase();
        if (baseLabel.toLowerCase().startsWith(textbookPrefix)) {
            const next = baseLabel.slice(textbookName.length).trim();
            if (next) volumeLabel = next;
        }
        const levelDisplayName = levelLabel ? `${volumeLabel} (${levelLabel})` : volumeLabel;
        return {
            levelKey: item.levelKey,
            status: item.status,
            textbookId,
            textbookName,
            volumeLabel,
            levelLabel,
            levelDisplayName,
        };
    });
}

export function groupTextbookLevelOptionViews(
    levels: TextbookLevelRegistryItem[] = listSelectableTextbookLevels(),
): TextbookLevelGroupView[] {
    const options = buildTextbookLevelOptionViews(levels);
    const groups = new Map<string, TextbookLevelGroupView>();
    options.forEach((option) => {
        if (!groups.has(option.textbookId)) {
            groups.set(option.textbookId, {
                textbookId: option.textbookId,
                textbookName: option.textbookName,
                options: [],
            });
        }
        groups.get(option.textbookId)!.options.push(option);
    });
    return Array.from(groups.values());
}

export function findTextbookLevelEntry(levelKey: string): TextbookLevelRegistryItem | undefined {
    return LEVEL_REGISTRY.find((item) => item.levelKey === levelKey);
}

export function listAssessmentPackRegistry(): AssessmentPackRegistryItem[] {
    return PACK_REGISTRY;
}

export function findAssessmentPackById(id: string): AssessmentPackRegistryItem | undefined {
    return PACK_REGISTRY.find((item) => item.id === id);
}

export function buildAssessmentPackPrompt(pack: AssessmentPackRegistryItem): string {
    return [
        `[Assessment Pack: ${pack.title}]`,
        `Summary: ${pack.summary}`,
        `Objectives: ${pack.objectives.join(' | ')}`,
        `Performance Indicators: ${pack.performanceIndicators.join(' | ')}`,
        `Rubric Bands: ${pack.rubricBands.join(' | ')}`,
        `Common Errors to Watch: ${pack.commonErrors.join(' | ')}`,
        `Exemplar Tasks: ${pack.exemplarTasks.join(' | ')}`,
        'IMPORTANT: Align generated lesson objectives, activity evidence, and formative checks to this assessment pack.',
    ].join('\n');
}

export function deriveQualityGate(groundingStatus: GroundingStatus, issues: string[]): QualityGate {
    const normalizedIssues = Array.from(new Set(issues.filter(Boolean)));
    const needsReview = groundingStatus !== 'verified' || normalizedIssues.length > 0;
    return {
        pass: !needsReview,
        status: needsReview ? 'needs_review' : 'ok',
        issues: normalizedIssues,
    };
}
