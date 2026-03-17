import type { LessonInput, LessonPlanResponse, StructuredKnowledge } from '../types';
import { generateStructuredPlan, generateStructuredHandbook } from './structuredHandbookService';

export type StructuredGenerationStage = 'plan' | 'handbook';

export async function generateStructuredLessonPlan(
  input: LessonInput,
  structure: string,
  knowledge: StructuredKnowledge[],
  language: 'en' | 'zh',
  onStage?: (stage: StructuredGenerationStage) => void,
  signal?: AbortSignal,
): Promise<LessonPlanResponse> {
  onStage?.('plan');
  const plan = await generateStructuredPlan(input, structure, knowledge, language, signal);

  onStage?.('handbook');
  const handbookResult = await generateStructuredHandbook(input, structure, knowledge, plan, language, signal);

  return {
    ...plan,
    ...handbookResult,
    handbookStructurePlan: `Structured mode: ${handbookResult.handbook?.length || 0} pages from custom outline`,
  };
}
