import { useEffect, useRef, useState } from 'react';
import { useToast } from '@shared/stores/useToast';
import type { LessonInput, LessonPlanResponse } from '../types';
import {
  buildInputSnapshot,
  generateFactSheet,
  generateFactSheetFallback,
  generateLessonPlanStreaming,
  generateLessonPlanStreamingCN,
} from '../services/lessonKitService';
import { translateLessonPlan } from '../services/contentGenerators';
import { generateStructuredLessonPlan } from '../services/structuredGeneration';

const LOADING_STEPS = [
  'Researching background knowledge...',
  'Consulting the Curriculum Oracle...',
  'Designing the teaching roadmap...',
  'Building vocabulary & safety protocols...',
  'Curating specialized vocabulary...',
  'Translating materials to Chinese...',
  'Applying final polish...',
];

const resolvePureChineseRoute = (kitLanguage: 'en' | 'zh', input: LessonInput): boolean =>
  kitLanguage === 'zh' || (input.mode === 'family' && !input.familyEslEnabled);

const getStructuredLoadingStep = (stage: 'plan' | 'handbook'): number => (stage === 'plan' ? 2 : 3);

const resolveLoadingStepFromPartialKeys = (keys: string[]): number | null => {
  if (keys.includes('vocabulary')) return 4;
  if (keys.includes('handbook')) return 3;
  if (keys.includes('roadmap')) return 2;
  if (keys.includes('missionBriefing')) return 1;
  return null;
};

type UseLessonKitGenerationParams = {
  input: LessonInput;
  currentKitLanguage: 'en' | 'zh';
  setInput: (input: LessonInput | ((prev: LessonInput) => LessonInput)) => void;
  setCurrentPlanId: (id: string | null) => void;
  setLessonPlan: (plan: LessonPlanResponse | null) => void;
};

type UseLessonKitGenerationResult = {
  isLoading: boolean;
  error: string | null;
  loadingStep: number;
  factSheetDecision: {
    reason: string;
    isFallbackLoading: boolean;
  } | null;
  handleSubmit: () => Promise<void>;
  handleStop: () => void;
  handleContinueWithoutFactSheet: () => void;
  handleUseFallbackFactSheet: () => Promise<void>;
};

class FactSheetGenerationError extends Error {
  readonly code = 'FACT_SHEET_GENERATION_FAILED' as const;
}

export function useLessonKitGeneration(params: UseLessonKitGenerationParams): UseLessonKitGenerationResult {
  const { input, currentKitLanguage, setInput, setCurrentPlanId, setLessonPlan } = params;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const [factSheetDecision, setFactSheetDecision] = useState<{
    reason: string;
    isFallbackLoading: boolean;
  } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pendingInputRef = useRef<LessonInput | null>(null);
  const decisionResolverRef = useRef<((value: LessonInput) => void) | null>(null);
  const decisionRejectRef = useRef<((reason?: any) => void) | null>(null);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isLoading) {
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev < LOADING_STEPS.length - 1 ? prev + 1 : prev));
      }, 3500);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  const handleStop = () => {
    if (!abortControllerRef.current) return;
    abortControllerRef.current.abort();
    abortControllerRef.current = null;
    decisionRejectRef.current?.(new DOMException('Aborted', 'AbortError'));
    decisionResolverRef.current = null;
    decisionRejectRef.current = null;
    pendingInputRef.current = null;
    setFactSheetDecision(null);
    setIsLoading(false);
    setError('Generation stopped by user.');
  };

  const finalizeGeneratedPlan = (result: LessonPlanResponse, enrichedInput: LessonInput) => {
    // Inject _inputSnapshot so Phase 2 / Commit can reconstruct full context (Issue #2 / #5)
    if (!result._inputSnapshot) {
      result._inputSnapshot = buildInputSnapshot(enrichedInput);
    }

    if (enrichedInput.factSheet) {
      result.factSheet = enrichedInput.factSheet;
    }
    if (enrichedInput.factSheetSources?.length) {
      result.factSheetSources = enrichedInput.factSheetSources;
    }
    if (enrichedInput.factSheetMeta) {
      result.factSheetMeta = enrichedInput.factSheetMeta;
    }
    if (enrichedInput.structuredKnowledge?.length) {
      result.structuredKnowledge = enrichedInput.structuredKnowledge;
    }

    setLessonPlan(result);
    setTimeout(() => {
      const resultsElement = document.getElementById('results-section');
      if (resultsElement) {
        resultsElement.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  const generateNormalModePlan = async (
    enrichedInput: LessonInput,
    isPureChineseRoute: boolean,
    signal: AbortSignal,
  ): Promise<LessonPlanResponse> => {
    const streamFn = isPureChineseRoute ? generateLessonPlanStreamingCN : generateLessonPlanStreaming;
    setLoadingStep(1);

    return streamFn(
      enrichedInput,
      (_, keys) => {
        const step = resolveLoadingStepFromPartialKeys(keys);
        if (step !== null) setLoadingStep(step);
      },
      signal,
    );
  };

  const applyChineseTranslationIfNeeded = async (
    result: LessonPlanResponse,
    isPureChineseRoute: boolean,
    signal: AbortSignal,
    mode: 'structured' | 'normal',
  ) => {
    setLoadingStep(5);
    if (isPureChineseRoute) return;

    try {
      const translatedResult = await translateLessonPlan(result, 'Simplified Chinese', signal);
      // Issue #12 fix: preserve _inputSnapshot and generationPhase — translateLessonPlan's schema strips them
      result.translatedPlan = {
        ...translatedResult,
        _inputSnapshot: result._inputSnapshot,
        generationPhase: result.generationPhase,
      };
    } catch (transErr) {
      if (mode === 'structured') {
        console.error('Translation failed for structured mode:', transErr);
      } else {
        console.error('Upfront translation failed, falling back to English only:', transErr);
      }
    }
  };

  const ensureFactSheetForGeneration = async (
    currentInput: LessonInput,
    signal: AbortSignal,
  ): Promise<LessonInput> => {
    if (currentInput.factSheet) return currentInput;

    console.log('[LessonKit] Step 0: Generating fact sheet via Google Search grounding...');
    try {
      const fs = await generateFactSheet(currentInput, signal);
      console.log(`[LessonKit] Fact sheet generated: ${fs.content.length} chars, quality=${fs.quality}`);
      if (!fs.content) return currentInput;

      const enriched = {
        ...currentInput,
        factSheet: fs.content,
        factSheetQuality: fs.quality,
        factSheetSources: fs.sources,
        factSheetMeta: fs.freshnessMeta,
      };
      setInput(enriched);
      return enriched;
    } catch (fsErr: any) {
      if (fsErr.name === 'AbortError') throw fsErr;
      throw new FactSheetGenerationError(
        fsErr?.message || 'Google grounding fact sheet generation failed.',
      );
    }
  };

  const awaitFactSheetDecision = (
    baseInput: LessonInput,
    reason: string,
  ): Promise<LessonInput> => {
    pendingInputRef.current = baseInput;
    setFactSheetDecision({
      reason,
      isFallbackLoading: false,
    });

    return new Promise<LessonInput>((resolve, reject) => {
      decisionResolverRef.current = resolve;
      decisionRejectRef.current = reject;
    });
  };

  const clearFactSheetDecisionState = () => {
    setFactSheetDecision(null);
    decisionResolverRef.current = null;
    decisionRejectRef.current = null;
    pendingInputRef.current = null;
  };

  const handleContinueWithoutFactSheet = () => {
    const baseInput = pendingInputRef.current || input;
    const resolve = decisionResolverRef.current;
    if (!resolve) return;
    clearFactSheetDecisionState();
    useToast.getState().info('Continuing without fact sheet grounding.');
    resolve(baseInput);
  };

  const handleUseFallbackFactSheet = async () => {
    const baseInput = pendingInputRef.current;
    const signal = abortControllerRef.current?.signal;
    const resolve = decisionResolverRef.current;
    const reject = decisionRejectRef.current;
    if (!baseInput || !signal || !resolve || !reject) return;

    setFactSheetDecision((prev) => (prev ? { ...prev, isFallbackLoading: true } : prev));

    try {
      const fs = await generateFactSheetFallback(baseInput, signal);
      const enriched: LessonInput = {
        ...baseInput,
        factSheet: fs.content || undefined,
        factSheetQuality: fs.quality,
        factSheetSources: fs.sources,
        factSheetMeta: fs.freshnessMeta,
      };
      setInput(enriched);
      clearFactSheetDecisionState();
      useToast.getState().success('Fallback fact sheet generated. Continuing...');
      resolve(enriched);
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        clearFactSheetDecisionState();
        reject(err);
        return;
      }
      const msg = err?.message || 'Fallback fact sheet generation failed.';
      setFactSheetDecision((prev) => (prev ? { ...prev, isFallbackLoading: false, reason: msg } : prev));
      useToast.getState().error(`Fallback failed: ${msg}`);
    }
  };

  const runStructuredModeIfApplicable = async (
    enrichedInput: LessonInput,
    signal: AbortSignal,
  ): Promise<boolean> => {
    if (enrichedInput.handbookMode !== 'structured' || !enrichedInput.customStructure) {
      return false;
    }

    const structure = enrichedInput.customStructure;
    const knowledge = enrichedInput.structuredKnowledge || [];
    const isPureChineseRoute = resolvePureChineseRoute(currentKitLanguage, enrichedInput);
    const genLang = isPureChineseRoute ? 'zh' : 'en';

    const result = await generateStructuredLessonPlan(
      enrichedInput,
      structure,
      knowledge,
      genLang,
      (stage) => setLoadingStep(getStructuredLoadingStep(stage)),
      signal,
    );

    await applyChineseTranslationIfNeeded(result, isPureChineseRoute, signal, 'structured');
    finalizeGeneratedPlan(result, enrichedInput);
    return true;
  };

  const runNormalModeFlow = async (enrichedInput: LessonInput, signal: AbortSignal): Promise<void> => {
    const isPureChineseRoute = resolvePureChineseRoute(currentKitLanguage, enrichedInput);
    const result = await generateNormalModePlan(enrichedInput, isPureChineseRoute, signal);
    await applyChineseTranslationIfNeeded(result, isPureChineseRoute, signal, 'normal');
    finalizeGeneratedPlan(result, enrichedInput);
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setLoadingStep(0);
    setError(null);
    setLessonPlan(null);
    setCurrentPlanId(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      let enrichedInput: LessonInput;
      try {
        enrichedInput = await ensureFactSheetForGeneration({ ...input }, controller.signal);
      } catch (err: any) {
        if (err?.name === 'AbortError') throw err;
        if ((err as FactSheetGenerationError).code === 'FACT_SHEET_GENERATION_FAILED') {
          const decisionInput = await awaitFactSheetDecision(
            { ...input },
            err?.message || 'Google grounding fact sheet generation failed.',
          );
          enrichedInput = decisionInput;
        } else {
          throw err;
        }
      }

      const handledByStructuredFlow = await runStructuredModeIfApplicable(enrichedInput, controller.signal);
      if (!handledByStructuredFlow) {
        await runNormalModeFlow(enrichedInput, controller.signal);
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || (err.message && err.message.includes('aborted'))) {
        setError('Generation stopped.');
      } else {
        const errorMessage = err.message || 'Failed to generate lesson plan. Please try again.';
        setError(errorMessage);
        useToast.getState().error(`Error: ${errorMessage}`);
        console.error(err);
      }
    } finally {
      if (abortControllerRef.current === controller) {
        setIsLoading(false);
        setLoadingStep(0);
        abortControllerRef.current = null;
      }
    }
  };

  return {
    isLoading,
    error,
    loadingStep,
    factSheetDecision,
    handleSubmit,
    handleStop,
    handleContinueWithoutFactSheet,
    handleUseFallbackFactSheet,
  };
}
