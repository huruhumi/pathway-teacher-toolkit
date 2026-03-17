import { getTotalPages } from '../constants/handbookDefaults';
import type { LessonInput, LessonPlanResponse } from '../types';
import { buildFamilyModeRules, buildHandbookRules, resolvePageConfig } from './gemini/handbookRules';
import { generateFactSheetCore } from './gemini/lessonPlan';
import { streamLessonPlanCore } from './gemini/streamCore';
import { generateLessonPlanStreamingCore, generateLessonPlanStreamingCNCore } from './gemini/streaming';

export async function generateFactSheet(
  input: LessonInput,
  signal?: AbortSignal
): Promise<{ content: string; quality: 'good' | 'low' | 'insufficient' }> {
  return generateFactSheetCore(input, signal);
}

export const generateLessonPlanStreaming = async (
  input: LessonInput,
  onPartialResult: (partial: Partial<LessonPlanResponse>, completedKeys: string[]) => void,
  signal?: AbortSignal,
): Promise<LessonPlanResponse> => {
  return generateLessonPlanStreamingCore(
    {
      resolvePageConfig,
      buildFamilyModeRules,
      buildHandbookRules,
      getTotalPages,
      streamCore: streamLessonPlanCore,
    },
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
    {
      resolvePageConfig,
      buildHandbookRules,
      getTotalPages,
      streamCore: streamLessonPlanCore,
    },
    input,
    onPartialResult,
    signal,
  );
};
