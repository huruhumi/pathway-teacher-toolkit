import { getTotalPages } from '../constants/handbookDefaults';
import type { FactSheetResult, InputSnapshot, LessonInput, LessonPlanResponse } from '../types';
import { buildFamilyModeRules, buildHandbookRules, resolvePageConfig } from './gemini/handbookRules';
import { generateLessonGroundingFactSheet } from './groundingService';
import { generateFactSheetCore } from './gemini/lessonPlan';
import { streamLessonPlanCore } from './gemini/streamCore';
import { generateLessonPlanStreamingCore, generateLessonPlanStreamingCNCore } from './gemini/streaming';
import { roadmapOnlySchema } from './gemini/schema';
import { NatureRoadmapOnlySchema } from '@shared/types/schemas';

export async function generateFactSheet(
  input: LessonInput,
  signal?: AbortSignal
): Promise<FactSheetResult> {
  return generateLessonGroundingFactSheet(input, signal);
}

export async function generateFactSheetFallback(
  input: LessonInput,
  signal?: AbortSignal
): Promise<FactSheetResult> {
  const legacy = await generateFactSheetCore(input, signal);
  return {
    content: legacy.content || '',
    quality: legacy.quality,
    sources: [],
    freshnessMeta: {
      themeTier: 'LOW',
      targetWindow: '1y',
      effectiveWindow: '5y',
      riskLevel: 'HIGH',
      coverage: 0,
      degradeNotes: ['Fallback fact sheet generated without structured source/date coverage.'],
    },
  };
}

/** Build a snapshot of all LessonInput fields needed by Phase 2 / Commit */
export function buildInputSnapshot(input: LessonInput): InputSnapshot {
  return {
    mode: input.mode,
    familyEslEnabled: input.familyEslEnabled,
    weather: input.weather,
    studentAge: input.studentAge,
    cefrLevel: input.cefrLevel || 'A1 (Beginner)',
    duration: input.duration,
    handbookMode: input.handbookMode,
    handbookPreset: input.handbookPreset,
    handbookPageConfig: input.handbookPageConfig,
    autoPageTarget: input.autoPageTarget,
    handbookPhasePagePlan: input.handbookPhasePagePlan,
    factSheet: input.factSheet,
    factSheetQuality: input.factSheetQuality,
    factSheetSources: input.factSheetSources,
    factSheetMeta: input.factSheetMeta,
    handbookStyleId: input.handbookStyleId,
    customStructure: input.customStructure,
    structuredKnowledge: input.structuredKnowledge,
  };
}

const sharedDeps = {
  resolvePageConfig,
  buildHandbookRules,
  getTotalPages,
  streamCore: streamLessonPlanCore,
  roadmapOnlySchema,
  roadmapOnlyValidationSchema: NatureRoadmapOnlySchema,
};

export const generateLessonPlanStreaming = async (
  input: LessonInput,
  onPartialResult: (partial: Partial<LessonPlanResponse>, completedKeys: string[]) => void,
  signal?: AbortSignal,
): Promise<LessonPlanResponse> => {
  return generateLessonPlanStreamingCore(
    { ...sharedDeps, buildFamilyModeRules },
    input,
    onPartialResult,
    signal,
  );
};

export const generateLessonPlanStreamingCN = async (
  input: LessonInput,
  onPartialResult: (partial: Partial<LessonPlanResponse>, completedKeys: string[]) => void,
  signal?: AbortSignal,
): Promise<LessonPlanResponse> => {
  return generateLessonPlanStreamingCNCore(
    sharedDeps,
    input,
    onPartialResult,
    signal,
  );
};
