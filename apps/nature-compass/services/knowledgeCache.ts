import localforage from 'localforage';
import type { StructuredKnowledge } from '../types';

const knowledgeDB = localforage.createInstance({ name: 'nc-knowledge-cache' });
const SEARCH_FAILED_PREFIXES = ['(search failed:', '(搜索失败', '(鎼滅储澶辫触'];

export function normalizeKnowledgeTopicKey(topic: string): string {
  return topic.replace(/\s+/g, '').toLowerCase();
}

export function isSearchFailedKnowledgeContent(content: string): boolean {
  const normalized = content.trim().toLowerCase();
  return SEARCH_FAILED_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function charSimilarity(a: string, b: string): number {
  const na = normalizeKnowledgeTopicKey(a);
  const nb = normalizeKnowledgeTopicKey(b);
  if (na === nb) return 1;
  if (na.length < 2 || nb.length < 2) return 0;

  const bigrams = (s: string) => {
    const set = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.slice(i, i + 2);
      set.set(bg, (set.get(bg) || 0) + 1);
    }
    return set;
  };

  const aGrams = bigrams(na);
  const bGrams = bigrams(nb);
  let overlap = 0;

  for (const [bg, count] of aGrams) {
    overlap += Math.min(count, bGrams.get(bg) || 0);
  }

  return (2 * overlap) / (na.length - 1 + nb.length - 1);
}

export async function findBestKnowledgeCacheMatch(
  topic: string,
  minSimilarity = 0.6,
): Promise<StructuredKnowledge | null> {
  const exact = await knowledgeDB.getItem<StructuredKnowledge>(normalizeKnowledgeTopicKey(topic));
  if (exact?.content && !isSearchFailedKnowledgeContent(exact.content)) return exact;

  const keys = await knowledgeDB.keys();
  const normalizedTopic = normalizeKnowledgeTopicKey(topic);
  let bestScore = 0;
  let bestKey = '';

  for (const key of keys) {
    if (Math.abs(key.length - normalizedTopic.length) > Math.max(key.length, normalizedTopic.length) * 0.5) {
      continue;
    }

    const score = charSimilarity(topic, key);
    if (score > bestScore) {
      bestScore = score;
      bestKey = key;
    }
  }

  if (bestScore < minSimilarity || !bestKey) {
    return null;
  }

  const cached = await knowledgeDB.getItem<StructuredKnowledge>(bestKey);
  if (!cached?.content || isSearchFailedKnowledgeContent(cached.content)) {
    return null;
  }

  console.log(`[KnowledgeCache] Fuzzy match: "${topic}" -> "${cached.topic}" (score: ${bestScore.toFixed(2)})`);
  return cached;
}

export async function saveKnowledgeToCache(entry: StructuredKnowledge): Promise<void> {
  await knowledgeDB.setItem(normalizeKnowledgeTopicKey(entry.topic), entry);
}
