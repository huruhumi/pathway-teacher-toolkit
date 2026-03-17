import { Type } from "@google/genai";
import { createAIClient } from "@pathway/ai";
import type { SentenceCitation } from "../../types";
import { retryApiCall } from "./shared";

type GroundingSource = {
  id?: string;
  title?: string;
  url?: string;
  status?: string;
  type?: string;
};

type CitationTarget = {
  section: string;
  text: string;
};

const CITATION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    citations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          section: { type: Type.STRING },
          sentence: { type: Type.STRING },
          sourceIds: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["section", "sentence", "sourceIds"],
      },
    },
  },
  required: ["citations"],
};

const normalizeText = (value: string) =>
  value.replace(/\s+/g, " ").trim().toLowerCase();

const sanitizeSentence = (value: string) =>
  value.replace(/\s+/g, " ").trim();

export async function mapSentenceCitations(options: {
  targets: CitationTarget[];
  sources?: GroundingSource[];
  factSheet?: string;
  signal?: AbortSignal;
}): Promise<SentenceCitation[]> {
  const targets = options.targets
    .map((item) => ({
      section: item.section.trim(),
      text: sanitizeSentence(item.text),
    }))
    .filter((item) => item.section && item.text);
  const sources = (options.sources || [])
    .map((source, index) => ({
      id: source.id || `source-${index + 1}`,
      title:
        source.title?.trim() ||
        source.id?.trim() ||
        `Source ${index + 1}`,
      url: source.url?.trim() || "",
    }))
    .filter((source) => source.id);

  if (!targets.length || !sources.length) return [];

  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const sourceCatalog = sources
    .map((source) => `${source.id} | ${source.title} | ${source.url || "-"}`)
    .join("\n");
  const targetCatalog = targets
    .map((target) => `${target.section} => ${target.text}`)
    .join("\n");
  const factSheet = (options.factSheet || "").slice(0, 12000);

  const ai = createAIClient();
  const response = await retryApiCall(
    () =>
      ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `You map generated teaching sentences to exact grounding sources.
Return JSON only.

Rules:
1. For each target sentence, pick 1-2 best matching sourceIds from SOURCE CATALOG.
2. sourceIds MUST come from SOURCE CATALOG IDs only.
3. Keep section and sentence exactly as provided in TARGET SENTENCES.
4. If no reliable match, return empty sourceIds for that sentence.
5. Do not invent source IDs.

SOURCE CATALOG:
${sourceCatalog}

TARGET SENTENCES:
${targetCatalog}

NOTEBOOK FACT SHEET (optional evidence context):
${factSheet || "(none)"}
`,
        config: {
          responseMimeType: "application/json",
          responseSchema: CITATION_SCHEMA,
        },
      }),
    3,
    1200,
    options.signal,
  );

  const parsed = JSON.parse(response.text || "{}");
  const rawCitations = Array.isArray(parsed?.citations) ? parsed.citations : [];

  const targetKeyMap = new Map(
    targets.map((target) => [
      `${target.section}::${normalizeText(target.text)}`,
      target.text,
    ]),
  );

  const mapped: SentenceCitation[] = [];
  for (const item of rawCitations) {
    const section = typeof item?.section === "string" ? item.section.trim() : "";
    const sentence = typeof item?.sentence === "string" ? sanitizeSentence(item.sentence) : "";
    const sourceIds = Array.isArray(item?.sourceIds)
      ? item.sourceIds
        .map((id: unknown) => (typeof id === "string" ? id.trim() : ""))
        .filter((id: string) => Boolean(id) && sourceById.has(id))
      : [];
    if (!section || !sentence || sourceIds.length === 0) continue;

    const normalizedKey = `${section}::${normalizeText(sentence)}`;
    const canonicalSentence = targetKeyMap.get(normalizedKey) || sentence;
    mapped.push({
      section,
      sentence: canonicalSentence,
      sourceIds,
      sourceTitles: sourceIds
        .map((id) => sourceById.get(id)?.title || "")
        .filter(Boolean),
      sourceUrls: sourceIds
        .map((id) => sourceById.get(id)?.url || "")
        .filter(Boolean),
    });
  }

  return mapped;
}

