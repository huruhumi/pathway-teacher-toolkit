import type { LessonInput, LessonPlanResponse, StructuredKnowledge } from '../types';
import { generateStructuredPlan } from './structuredHandbookService';

export type StructuredGenerationStage = 'plan' | 'handbook';

/**
 * Phase 1 only — generates the structured plan (roadmap, basicInfo, etc.)
 * Handbook generation is deferred to Phase 2 via the UI trigger.
 */
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

  // Phase 1 output — handbook will be generated in Phase 2
  return {
    ...plan,
    generationPhase: 'roadmap_only',
    handbook: [],
    supplies: plan.supplies || { permanent: [], consumables: [] },
    imagePrompts: [],
    notebookLMPrompt: '',
    handbookStylePrompt: '',
    handbookStructurePlan: `Structured mode: custom outline provided, handbook pages pending Phase 2 generation`,
  };
}

// Re-export generateStructuredHandbook for Phase 2 callers
export { generateStructuredHandbook } from './structuredHandbookService';
