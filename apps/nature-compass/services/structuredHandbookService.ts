/**
 * Structured Handbook Service
 *
 * Generates a complete LessonPlanResponse from a user-defined page-by-page outline.
 * Flow:
 *   1. extractResearchTopics() -> AI parses outline into key research topics
 *   2. batchResearch() -> Gemini Search Grounding per topic
 *   3. generateStructuredPlan() -> roadmap/supplies/vocab from outline + knowledge
 *   4. generateStructuredHandbook() -> handbook pages from outline + roadmap + knowledge
 */

import { createAIClient, retryAICall as retryOperation } from '@pathway/ai';
import { extractJSON } from './gemini/parsing';
import type { LessonInput, LessonPlanResponse, StructuredKnowledge } from '../types';
import { topicExtractionSchema, structuredPlanSchema, handbookPageSchema } from './gemini/structuredSchemas';
import {
  buildStructuredPlanSystemInstruction,
  buildStructuredHandbookSystemInstruction,
  buildTopicExtractionPrompt,
} from './gemini/structuredPrompts';
import { generateStructuredTopicKnowledge } from './groundingService';

const BATCH_SIZE = 4;
const BATCH_DELAY_MS = 2000;
const SEARCH_FAILED_PREFIX = '(Search failed:';

type StructuredPlanResult = Omit<
  LessonPlanResponse,
  'handbook' | 'handbookStylePrompt' | 'notebookLMPrompt' | 'handbookStructurePlan'
>;

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'Unknown error';
}

function isSearchFailureContent(content: string): boolean {
  return content.trim().toLowerCase().startsWith(SEARCH_FAILED_PREFIX.toLowerCase());
}

function buildKnowledgeBlock(knowledge: StructuredKnowledge[]): string {
  return knowledge
    .filter((item) => item.content && !isSearchFailureContent(item.content))
    .map((item) => `### ${item.topic}\n${item.content}`)
    .join('\n\n');
}

function normalizePlanPayload(payload: any): StructuredPlanResult {
  const vocabulary =
    payload?.vocabulary && !Array.isArray(payload.vocabulary)
      ? payload.vocabulary
      : {
          keywords: Array.isArray(payload?.vocabulary) ? payload.vocabulary : [],
          phrases: [],
        };

  return {
    missionBriefing: payload?.missionBriefing ?? { title: '', narrative: '' },
    basicInfo: payload?.basicInfo ?? {
      theme: '',
      activityType: '',
      targetAudience: '',
      location: '',
      learningGoals: [],
    },
    vocabulary,
    roadmap: Array.isArray(payload?.roadmap) ? payload.roadmap : [],
    supplies: payload?.supplies ?? { permanent: [], consumables: [] },
    safetyProtocol: Array.isArray(payload?.safetyProtocol) ? payload.safetyProtocol : [],
    visualReferences: Array.isArray(payload?.visualReferences) ? payload.visualReferences : [],
    imagePrompts: Array.isArray(payload?.imagePrompts) ? payload.imagePrompts : [],
  };
}

function normalizeHandbookPayload(payload: any): Pick<LessonPlanResponse, 'handbook' | 'handbookStylePrompt' | 'notebookLMPrompt'> {
  return {
    handbookStylePrompt: payload?.handbookStylePrompt ?? '',
    notebookLMPrompt: payload?.notebookLMPrompt ?? '',
    handbook: Array.isArray(payload?.handbook) ? payload.handbook : [],
  };
}

export interface TopicExtractionResult {
  topics: string[];
  suggestedTheme: string;
  suggestedIntro: string;
}

export async function extractResearchTopics(
  structure: string,
  signal?: AbortSignal,
): Promise<TopicExtractionResult> {
  const ai = createAIClient();

  return retryOperation(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: buildTopicExtractionPrompt(structure),
      config: {
        responseMimeType: 'application/json',
        responseSchema: topicExtractionSchema,
        temperature: 0.2,
      },
    });

    const text = response.text;
    if (!text) throw new Error('Empty response from topic extraction');

    const parsed = JSON.parse(text);
    return {
      topics: (parsed.topics || []).slice(0, 15),
      suggestedTheme: parsed.suggestedTheme || '',
      suggestedIntro: parsed.suggestedIntro || '',
    };
  }, signal);
}

async function researchSingleTopic(
  topic: string,
  signal?: AbortSignal,
  contextText?: string,
): Promise<StructuredKnowledge> {
  try {
    const grounded = await generateStructuredTopicKnowledge(
      topic,
      contextText || 'Structured handbook topic research',
      signal,
    );
    return {
      topic,
      content: grounded.content,
      sources: grounded.sources.map((s) => s.url),
      sourceDetails: grounded.sources,
      freshnessMeta: grounded.freshnessMeta,
    };
  } catch (err: unknown) {
    const message = toErrorMessage(err);
    console.warn(`[StructuredHandbook] Research failed for topic "${topic}":`, message);
    return { topic, content: `${SEARCH_FAILED_PREFIX} ${message})`, sources: [] };
  }
}

export async function batchResearch(
  topics: string[],
  onProgress?: (completed: number, total: number) => void,
  signal?: AbortSignal,
  contextText?: string,
): Promise<StructuredKnowledge[]> {
  const results: StructuredKnowledge[] = [];
  const total = topics.length;

  for (let i = 0; i < topics.length; i += BATCH_SIZE) {
    if (signal?.aborted) throw new Error('Research cancelled');

    const batch = topics.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((topic) => researchSingleTopic(topic, signal, contextText)),
    );
    results.push(...batchResults);
    onProgress?.(Math.min(results.length, total), total);

    if (i + BATCH_SIZE < topics.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  return results;
}

export async function generateStructuredPlan(
  input: LessonInput,
  structure: string,
  knowledge: StructuredKnowledge[],
  language: 'en' | 'zh',
  signal?: AbortSignal,
): Promise<StructuredPlanResult> {
  const ai = createAIClient();
  const isCN = language === 'zh';
  const knowledgeBlock = buildKnowledgeBlock(knowledge);

  const systemInstruction = buildStructuredPlanSystemInstruction({
    isCN,
    structure,
    knowledgeBlock,
    input,
  });

  return retryOperation(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: isCN
        ? 'Generate the teaching plan from the outline and knowledge base. Output in Simplified Chinese.'
        : 'Generate the teaching plan from the outline and knowledge base. Output in English.',
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: structuredPlanSchema,
        temperature: 0.4,
      },
    });

    const text = response.text;
    if (!text) throw new Error('Empty response from plan generation');
    const payload = extractJSON(text);
    return normalizePlanPayload(payload);
  }, signal);
}

export async function generateStructuredHandbook(
  input: LessonInput,
  structure: string,
  knowledge: StructuredKnowledge[],
  plan: StructuredPlanResult,
  language: 'en' | 'zh',
  signal?: AbortSignal,
): Promise<Pick<LessonPlanResponse, 'handbook' | 'handbookStylePrompt' | 'notebookLMPrompt'>> {
  const ai = createAIClient();
  const isCN = language === 'zh';
  const knowledgeBlock = buildKnowledgeBlock(knowledge);

  const roadmapSummary = plan.roadmap
    .map((phase, index) => `Phase ${index + 1}: ${phase.phase} - ${phase.activity} (${phase.timeRange})`)
    .join('\n');

  const systemInstruction = buildStructuredHandbookSystemInstruction({
    isCN,
    structure,
    roadmapSummary,
    knowledgeBlock,
    input,
  });

  return retryOperation(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: isCN
        ? 'Generate handbook pages from the outline. Output in Simplified Chinese.'
        : 'Generate handbook pages from the outline. Output in English.',
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: handbookPageSchema,
        temperature: 0.4,
      },
    });

    const text = response.text;
    if (!text) throw new Error('Empty response from handbook generation');
    const payload = extractJSON(text);
    return normalizeHandbookPayload(payload);
  }, signal);
}
