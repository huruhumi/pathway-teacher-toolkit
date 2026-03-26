import { Type } from '@google/genai';
import { createAIClient, retryAICall as retryOperation } from '@pathway/ai';
import type {
  CurriculumParams,
  FactSheetFreshnessMeta,
  FactSheetResult,
  FactSheetSource,
  FreshnessRiskLevel,
  LessonInput,
  ThemeFreshnessTier,
} from '../types';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const HIGH_FRESHNESS_PATTERNS: RegExp[] = [
  /\b(policy|regulation|law|guideline|outbreak|epidemic|pandemic|alert|latest|breaking)\b/i,
  /\b(real[-\s]?time|this year|current year|202\d)\b/i,
];

const MEDIUM_FRESHNESS_PATTERNS: RegExp[] = [
  /\b(seasonal|season|trend|migration|phenology|annual|recent years|climate pattern)\b/i,
];

const HIGH_FRESHNESS_PATTERNS_ZH_SAFE: RegExp[] = [
  /(?:\u653f\u7b56|\u6cd5\u89c4|\u76d1\u7ba1|\u75ab\u60c5|\u901a\u62a5|\u9884\u8b66|\u6700\u65b0|\u5b9e\u65f6|\u7a81\u53d1)/,
];

const MEDIUM_FRESHNESS_PATTERNS_ZH_SAFE: RegExp[] = [
  /(?:\u5b63\u8282|\u8d8b\u52bf|\u8fc1\u5f99|\u7269\u5019|\u5e74\u5ea6|\u8fd1\u5e74|\u6c14\u5019\u53d8\u5316|\u672c\u5730\u5b9e\u8df5)/,
];

const groundingResponseSchema = {
  type: Type.OBJECT,
  required: ['factSheetEnglish', 'factSheetChinese', 'sources'],
  properties: {
    factSheetEnglish: { type: Type.STRING },
    factSheetChinese: { type: Type.STRING },
    sources: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ['title', 'url', 'publishedAt'],
        properties: {
          title: { type: Type.STRING },
          url: { type: Type.STRING },
          publishedAt: { type: Type.STRING },
        },
      },
    },
  },
} as const;

const topicKnowledgeResponseSchema = {
  type: Type.OBJECT,
  required: ['knowledgeChinese', 'sources'],
  properties: {
    knowledgeChinese: { type: Type.STRING },
    sources: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ['title', 'url', 'publishedAt'],
        properties: {
          title: { type: Type.STRING },
          url: { type: Type.STRING },
          publishedAt: { type: Type.STRING },
        },
      },
    },
  },
} as const;

type CacheEntry = { expiresAt: number; result: FactSheetResult };
type GroundingRequest = {
  cacheKey: string;
  theme: string;
  context: string;
  targetAge: string;
  durationMinutes: number;
  modeLabel: string;
  locationHint?: string;
  tierOverride?: ThemeFreshnessTier;
  signal?: AbortSignal;
};

type RawGroundingPayload = {
  factSheetEnglish?: string;
  factSheetChinese?: string;
  sources?: Array<{ title?: string; url?: string; publishedAt?: string }>;
};

export type StructuredTopicKnowledgeResult = {
  content: string;
  sources: FactSheetSource[];
  freshnessMeta: FactSheetFreshnessMeta;
};

type StructuredTopicGroundingRequest = {
  cacheKey: string;
  topic: string;
  context?: string;
  targetAge?: string;
  modeLabel?: string;
  tierOverride?: ThemeFreshnessTier;
  signal?: AbortSignal;
};

type RawTopicKnowledgePayload = {
  knowledgeChinese?: string;
  sources?: Array<{ title?: string; url?: string; publishedAt?: string }>;
};

let groundingQueue: Promise<void> = Promise.resolve();
const groundingCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<FactSheetResult>>();
const topicGroundingCache = new Map<string, { expiresAt: number; result: StructuredTopicKnowledgeResult }>();
const topicInFlight = new Map<string, Promise<StructuredTopicKnowledgeResult>>();

function runGroundingSerially<T>(task: () => Promise<T>): Promise<T> {
  const scheduled = groundingQueue.then(task, task);
  groundingQueue = scheduled.then(() => undefined, () => undefined);
  return scheduled;
}

function parseDurationMinutes(value: string | number | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = `${value || ''}`;
  const match = text.match(/\d+/);
  return match ? Number(match[0]) : 180;
}

export function classifyThemeFreshness(inputText: string): ThemeFreshnessTier {
  const text = (inputText || '').trim();
  if (!text) return 'LOW';

  if (
    HIGH_FRESHNESS_PATTERNS.some((pattern) => pattern.test(text)) ||
    HIGH_FRESHNESS_PATTERNS_ZH_SAFE.some((pattern) => pattern.test(text))
  ) {
    return 'HIGH';
  }
  if (
    MEDIUM_FRESHNESS_PATTERNS.some((pattern) => pattern.test(text)) ||
    MEDIUM_FRESHNESS_PATTERNS_ZH_SAFE.some((pattern) => pattern.test(text))
  ) {
    return 'MEDIUM';
  }
  return 'LOW';
}

function normalizePublishedAt(raw: string | undefined): string | null {
  const value = asFlatString(raw).trim();
  if (!value || /unknown|n\/a|na/i.test(value)) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const asDate = new Date(value);
  if (Number.isNaN(asDate.getTime())) return null;
  return asDate.toISOString().slice(0, 10);
}

function normalizeSource(raw: { title?: string; url?: string; publishedAt?: string }): FactSheetSource | null {
  const title = asFlatString(raw?.title).trim();
  const url = asFlatString(raw?.url).trim();
  if (!title || !url) return null;
  if (!/^https?:\/\//i.test(url)) return null;

  return {
    title,
    url,
    publishedAt: normalizePublishedAt(raw.publishedAt),
  };
}

function asFlatString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  if (Array.isArray(value)) return value.map((item) => asFlatString(item)).filter(Boolean).join('\n');
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function parseGroundingJson<T>(rawText: string): T {
  const text = (rawText || '').trim();
  if (!text) throw new Error('Grounding returned an empty response.');

  try {
    return JSON.parse(text) as T;
  } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenced?.[1]) {
      return JSON.parse(fenced[1]) as T;
    }
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end + 1)) as T;
    }
    throw new Error('Grounding returned non-JSON content.');
  }
}

async function repairGroundingJson<T>(
  ai: ReturnType<typeof createAIClient>,
  rawText: string,
  schema: any,
  expectedShapeHint: string,
  signal?: AbortSignal,
): Promise<T> {
  const truncated = (rawText || '').slice(0, 20000);
  const response = await retryOperation(
    () =>
      ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          'Convert the following malformed JSON-like content into strict valid JSON.',
          `Expected shape: ${expectedShapeHint}`,
          'Rules:',
          '- Output JSON only.',
          '- Do not add facts not present in the input.',
          '- If a field is missing, use an empty string or empty array as appropriate.',
          '',
          'Input:',
          truncated,
        ].join('\n'),
        config: {
          responseMimeType: 'application/json',
          responseSchema: schema,
          temperature: 0,
        },
      }),
    signal,
  );
  return parseGroundingJson<T>(response.text || '');
}

function evaluateSourceDateCoverage(
  sources: FactSheetSource[],
): { knownCount: number; coverage: number; unknownRatio: number } {
  if (sources.length === 0) {
    return { knownCount: 0, coverage: 0, unknownRatio: 1 };
  }

  let knownCount = 0;
  let unknownCount = 0;

  sources.forEach((source) => {
    if (!source.publishedAt) {
      unknownCount += 1;
      return;
    }
    knownCount += 1;
  });

  return {
    knownCount,
    coverage: knownCount / sources.length,
    unknownRatio: unknownCount / sources.length,
  };
}

function resolveRiskLevelFromDateCompleteness(unknownRatio: number): FreshnessRiskLevel {
  if (unknownRatio <= 0.35) return 'LOW';
  if (unknownRatio <= 0.6) return 'MEDIUM';
  return 'HIGH';
}

function resolveQuality(contentLength: number, sourceCount: number): 'good' | 'low' | 'insufficient' {
  if (contentLength >= 1500 && sourceCount >= 3) return 'good';
  if (contentLength >= 700 && sourceCount >= 2) return 'low';
  return 'insufficient';
}

function formatFactSheetContent(
  english: string,
  chinese: string,
  sources: FactSheetSource[],
  freshnessMeta: FactSheetFreshnessMeta,
): string {
  const sourceLines = sources.length > 0
    ? sources
      .map((source, idx) => `[${idx + 1}] ${source.title} | ${source.url} | published: ${source.publishedAt || 'unknown'}`)
      .join('\n')
    : '- No structured sources returned.';

  const riskBlock = [
    `Theme Freshness Tier: ${freshnessMeta.themeTier}`,
    `Target Window: ${freshnessMeta.targetWindow}`,
    `Effective Window: ${freshnessMeta.effectiveWindow}`,
    `Risk Level: ${freshnessMeta.riskLevel}`,
    `Coverage: ${(freshnessMeta.coverage * 100).toFixed(0)}%`,
  ].join('\n');

  return [
    '## PART 1: ENGLISH',
    english.trim(),
    '',
    '## PART 2: CHINESE',
    chinese.trim(),
    '',
    '## FRESHNESS AUDIT',
    riskBlock,
    '',
    '## SOURCES',
    sourceLines,
  ].join('\n');
}

function formatTopicKnowledgeContent(
  topic: string,
  chinese: string,
  freshnessMeta: FactSheetFreshnessMeta,
): string {
  const riskBlock = [
    `Theme Freshness Tier: ${freshnessMeta.themeTier}`,
    `Target Window: ${freshnessMeta.targetWindow}`,
    `Effective Window: ${freshnessMeta.effectiveWindow}`,
    `Risk Level: ${freshnessMeta.riskLevel}`,
    `Coverage: ${(freshnessMeta.coverage * 100).toFixed(0)}%`,
  ].join('\n');

  return [
    `### ${topic.trim()}`,
    chinese.trim(),
    '',
    '[Freshness Audit]',
    riskBlock,
  ].join('\n');
}

function buildGroundingPrompt(req: GroundingRequest): string {
  return [
    'You are a curriculum research assistant for K-12 nature education.',
    'Use Google Search grounding to build a reliable bilingual fact sheet.',
    '',
    '## Topic',
    `Theme: ${req.theme}`,
    `Context: ${req.context}`,
    `Target Age: ${req.targetAge}`,
    `Duration: ${req.durationMinutes} minutes`,
    `Mode: ${req.modeLabel}`,
    req.locationHint ? `Location hint: ${req.locationHint}` : '',
    '',
    '## Source Date Handling',
    'Use direct grounded search with no strict publication-time filter.',
    'Prefer recent/authoritative sources when possible, but do not block results by date window.',
    '',
    '## Output JSON Contract',
    '- factSheetEnglish: full English fact sheet with headings and [n] citations.',
    '- factSheetChinese: same content in Simplified Chinese with matching structure.',
    '- sources: array of {title, url, publishedAt}.',
    '- publishedAt must be YYYY-MM-DD when known, otherwise "unknown".',
    '',
    '## Rules',
    '- Prefer educational, academic, government, museum, or scientific org sources.',
    '- Never fabricate facts or publication dates.',
    '- Keep factual claims tied to provided sources.',
  ].filter(Boolean).join('\n');
}

function buildTopicKnowledgePrompt(req: StructuredTopicGroundingRequest): string {
  return [
    'You are a curriculum research assistant for K-12 nature education.',
    'Use Google Search grounding to produce a topic knowledge brief.',
    '',
    '## Topic',
    `Topic: ${req.topic}`,
    `Context: ${req.context || 'General topic research for structured handbook generation.'}`,
    `Target Age: ${req.targetAge || '6-8 years'}`,
    `Mode: ${req.modeLabel || 'school'}`,
    '',
    '## Source Date Handling',
    'Use direct grounded search with no strict publication-time filter.',
    'Prefer recent/authoritative sources when possible, but do not block results by date window.',
    '',
    '## Output JSON Contract',
    '- knowledgeChinese: factual brief in Simplified Chinese (~400-1200 chars), with [n] citation markers.',
    '- sources: array of {title, url, publishedAt}.',
    '- publishedAt must be YYYY-MM-DD when known, otherwise "unknown".',
    '',
    '## Rules',
    '- Focus on facts that are useful for handbook and lesson design.',
    '- Never fabricate facts or dates.',
    '- Keep claims traceable to returned sources.',
  ].join('\n');
}

async function fetchGroundedFactSheetDirect(req: GroundingRequest): Promise<FactSheetResult> {
  const ai = createAIClient();

  const response = await retryOperation(
    () =>
      ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: buildGroundingPrompt(req),
        config: {
          tools: [
            {
              googleSearch: {},
            },
          ],
          temperature: 0.2,
        },
      }),
    req.signal,
  );

  let payload: RawGroundingPayload;
  try {
    payload = parseGroundingJson<RawGroundingPayload>(response.text || '');
  } catch {
    payload = await repairGroundingJson<RawGroundingPayload>(
      ai,
      response.text || '',
      groundingResponseSchema as any,
      '{ factSheetEnglish: string, factSheetChinese: string, sources: [{ title, url, publishedAt }] }',
      req.signal,
    );
  }
  const english = asFlatString(payload.factSheetEnglish).trim();
  const chinese = asFlatString(payload.factSheetChinese).trim();
  const sources = (Array.isArray(payload.sources) ? payload.sources : [])
    .map(normalizeSource)
    .filter((item): item is FactSheetSource => Boolean(item));

  const tier = req.tierOverride || classifyThemeFreshness(`${req.theme}\n${req.context}`);
  const { coverage, unknownRatio } = evaluateSourceDateCoverage(sources);
  const freshnessMeta: FactSheetFreshnessMeta = {
    themeTier: tier,
    targetWindow: '1y',
    effectiveWindow: '5y',
    riskLevel: resolveRiskLevelFromDateCompleteness(unknownRatio),
    coverage,
  };

  const content = formatFactSheetContent(english, chinese, sources, freshnessMeta);
  return {
    content,
    quality: resolveQuality(content.length, sources.length),
    sources,
    freshnessMeta,
  };
}

async function fetchTopicKnowledgeDirect(
  req: StructuredTopicGroundingRequest,
): Promise<StructuredTopicKnowledgeResult> {
  const ai = createAIClient();

  const response = await retryOperation(
    () =>
      ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: buildTopicKnowledgePrompt(req),
        config: {
          tools: [
            {
              googleSearch: {},
            },
          ],
          temperature: 0.2,
        },
      }),
    req.signal,
  );

  let payload: RawTopicKnowledgePayload;
  try {
    payload = parseGroundingJson<RawTopicKnowledgePayload>(response.text || '');
  } catch {
    payload = await repairGroundingJson<RawTopicKnowledgePayload>(
      ai,
      response.text || '',
      topicKnowledgeResponseSchema as any,
      '{ knowledgeChinese: string, sources: [{ title, url, publishedAt }] }',
      req.signal,
    );
  }
  const knowledgeChinese = asFlatString(payload.knowledgeChinese).trim();
  if (!knowledgeChinese) throw new Error('Topic grounding returned empty knowledgeChinese.');

  const sources = (Array.isArray(payload.sources) ? payload.sources : [])
    .map(normalizeSource)
    .filter((item): item is FactSheetSource => Boolean(item));

  const tier = req.tierOverride || classifyThemeFreshness(`${req.topic}\n${req.context || ''}`);
  const { coverage, unknownRatio } = evaluateSourceDateCoverage(sources);
  const freshnessMeta: FactSheetFreshnessMeta = {
    themeTier: tier,
    targetWindow: '1y',
    effectiveWindow: '5y',
    riskLevel: resolveRiskLevelFromDateCompleteness(unknownRatio),
    coverage,
  };

  return {
    content: formatTopicKnowledgeContent(req.topic, knowledgeChinese, freshnessMeta),
    sources,
    freshnessMeta,
  };
}

export async function generateGroundedFactSheet(req: GroundingRequest): Promise<FactSheetResult> {
  const now = Date.now();
  const cached = groundingCache.get(req.cacheKey);
  if (cached && cached.expiresAt > now) return cached.result;

  const existingPromise = inFlight.get(req.cacheKey);
  if (existingPromise) return existingPromise;

  const promise = runGroundingSerially(async () => {
    const tier = req.tierOverride || classifyThemeFreshness(`${req.theme}\n${req.context}`);
    const result = await fetchGroundedFactSheetDirect({ ...req, tierOverride: tier });
    result.freshnessMeta.degradeNotes = [
      'Freshness time-window filter disabled. Direct grounded search was used.',
    ];

    groundingCache.set(req.cacheKey, {
      result,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return result;
  });

  inFlight.set(req.cacheKey, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(req.cacheKey);
  }
}

async function generateGroundedTopicKnowledge(
  req: StructuredTopicGroundingRequest,
): Promise<StructuredTopicKnowledgeResult> {
  const now = Date.now();
  const cached = topicGroundingCache.get(req.cacheKey);
  if (cached && cached.expiresAt > now) return cached.result;

  const existingPromise = topicInFlight.get(req.cacheKey);
  if (existingPromise) return existingPromise;

  const promise = runGroundingSerially(async () => {
    const tier = req.tierOverride || classifyThemeFreshness(`${req.topic}\n${req.context || ''}`);
    const result = await fetchTopicKnowledgeDirect({ ...req, tierOverride: tier });
    result.freshnessMeta.degradeNotes = [
      'Freshness time-window filter disabled. Direct grounded search was used.',
    ];

    topicGroundingCache.set(req.cacheKey, {
      result,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return result;
  });

  topicInFlight.set(req.cacheKey, promise);
  try {
    return await promise;
  } finally {
    topicInFlight.delete(req.cacheKey);
  }
}

export async function generateStructuredTopicKnowledge(
  topic: string,
  context = '',
  signal?: AbortSignal,
): Promise<StructuredTopicKnowledgeResult> {
  const trimmedTopic = (topic || '').trim();
  if (!trimmedTopic) throw new Error('Structured topic is empty.');

  const cacheKey = [
    'structured-topic',
    trimmedTopic,
    context.trim(),
  ].join('::');

  return generateGroundedTopicKnowledge({
    cacheKey,
    topic: trimmedTopic,
    context,
    targetAge: '6-12 years',
    modeLabel: 'structured',
    signal,
  });
}

export async function generateLessonGroundingFactSheet(
  input: LessonInput,
  signal?: AbortSignal,
): Promise<FactSheetResult> {
  const cacheKey = [
    'lesson',
    input.theme || 'untitled',
    input.topicIntroduction || '',
    input.studentAge || '',
    String(input.duration || ''),
    input.mode || 'school',
    input.weather || '',
    input.season || '',
    input.activityFocus.join('|'),
  ].join('::');

  const context = [
    input.topicIntroduction,
    `Weather: ${input.weather}`,
    `Season: ${input.season}`,
    `Focus: ${input.activityFocus.join(', ') || 'general nature exploration'}`,
    `CEFR: ${input.cefrLevel || 'N/A'}`,
  ].filter(Boolean).join('\n');

  return generateGroundedFactSheet({
    cacheKey,
    theme: input.theme || 'Nature education lesson',
    context,
    targetAge: input.studentAge || '6-8 years',
    durationMinutes: parseDurationMinutes(input.duration),
    modeLabel: input.mode === 'family' ? 'family' : 'school',
    signal,
  });
}

export async function generateCurriculumGroundingFactSheet(
  params: CurriculumParams,
  lessonTitles: string[],
  signal?: AbortSignal,
): Promise<FactSheetResult> {
  const cacheKey = [
    'curriculum',
    params.customTheme || 'untitled',
    params.city || '',
    params.ageGroup || '',
    String(params.lessonCount || ''),
    params.duration || '',
    params.mode || 'school',
    params.preferredLocation || '',
    params.customDescription || '',
    lessonTitles.join('|'),
  ].join('::');

  const context = [
    params.customDescription || '',
    `City: ${params.city || 'Wuhan'}`,
    `Preferred location: ${params.preferredLocation || 'not specified'}`,
    `Lesson count: ${params.lessonCount}`,
    `English level: ${params.englishLevel}`,
    `Lesson titles: ${lessonTitles.join(' | ')}`,
  ].filter(Boolean).join('\n');

  return generateGroundedFactSheet({
    cacheKey,
    theme: params.customTheme || lessonTitles[0] || 'Nature curriculum',
    context,
    targetAge: params.ageGroup || '6-8 years',
    durationMinutes: parseDurationMinutes(params.duration),
    modeLabel: params.mode === 'family' ? 'family' : 'school',
    locationHint: params.city,
    signal,
  });
}
