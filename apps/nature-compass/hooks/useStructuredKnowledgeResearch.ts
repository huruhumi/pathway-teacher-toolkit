import { useCallback, useState } from 'react';
import type { StructuredKnowledge } from '../types';
import { extractResearchTopics, batchResearch } from '../services/structuredHandbookService';
import { findBestKnowledgeCacheMatch, saveKnowledgeToCache } from '../services/knowledgeCache';

export type StructuredResearchStatus = 'idle' | 'extracting' | 'searching' | 'done' | 'error';

type IndexedKnowledge = StructuredKnowledge & { _idx?: number };

type UseStructuredKnowledgeResearchOptions = {
  structure: string;
  isZh: boolean;
  hasKnowledge: boolean;
  onKnowledgeReady: (knowledge: StructuredKnowledge[]) => void;
  onMetaReady?: (meta: { theme: string; intro: string }) => void;
};

type StructuredKnowledgeResearchState = {
  status: StructuredResearchStatus;
  progress: { completed: number; total: number };
  cacheStats: { cached: number; searched: number } | null;
  error: string | null;
  runResearch: () => Promise<void>;
};

export function useStructuredKnowledgeResearch(
  options: UseStructuredKnowledgeResearchOptions,
): StructuredKnowledgeResearchState {
  const { structure, isZh, hasKnowledge, onKnowledgeReady, onMetaReady } = options;
  const [status, setStatus] = useState<StructuredResearchStatus>(hasKnowledge ? 'done' : 'idle');
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [cacheStats, setCacheStats] = useState<{ cached: number; searched: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runResearch = useCallback(async () => {
    if (!structure.trim()) return;

    setStatus('extracting');
    setError(null);
    setCacheStats(null);

    try {
      const extraction = await extractResearchTopics(structure);
      if (!extraction.topics.length) {
        setError(isZh ? '未能提取到研究主题' : 'No research topics extracted');
        setStatus('error');
        return;
      }

      if (onMetaReady && (extraction.suggestedTheme || extraction.suggestedIntro)) {
        onMetaReady({ theme: extraction.suggestedTheme, intro: extraction.suggestedIntro });
      }

      const cachedResults: IndexedKnowledge[] = [];
      const uncachedTopics: { topic: string; idx: number }[] = [];

      for (let i = 0; i < extraction.topics.length; i++) {
        const topic = extraction.topics[i];
        const cached = await findBestKnowledgeCacheMatch(topic);
        if (cached) {
          cachedResults.push({ ...cached, _idx: i });
        } else {
          uncachedTopics.push({ topic, idx: i });
        }
      }

      let indexedSearchResults: IndexedKnowledge[] = [];
      if (uncachedTopics.length > 0) {
        setStatus('searching');
        setProgress({ completed: 0, total: uncachedTopics.length });

        const searchedResults = await batchResearch(
          uncachedTopics.map((t) => t.topic),
          (completed, total) => setProgress({ completed, total }),
          undefined,
          structure,
        );

        indexedSearchResults = searchedResults.map((result, si) => {
          const origIdx = uncachedTopics[si]?.idx ?? si;
          void saveKnowledgeToCache(result).catch(() => {});
          return { ...result, _idx: origIdx };
        });
      }

      const allResults: IndexedKnowledge[] = [...cachedResults, ...indexedSearchResults];
      const orderedResults: (StructuredKnowledge | null)[] = new Array(extraction.topics.length).fill(null);

      for (const result of allResults) {
        const idx = result._idx ?? 0;
        const { _idx, ...clean } = result;
        orderedResults[idx] = clean;
      }

      const finalResults = orderedResults.filter((r): r is StructuredKnowledge => Boolean(r));
      setCacheStats({ cached: cachedResults.length, searched: indexedSearchResults.length });
      onKnowledgeReady(finalResults);
      setStatus('done');
    } catch (err: any) {
      setError(err.message || 'Research failed');
      setStatus('error');
    }
  }, [structure, isZh, onKnowledgeReady, onMetaReady]);

  return {
    status,
    progress,
    cacheStats,
    error,
    runResearch,
  };
}
