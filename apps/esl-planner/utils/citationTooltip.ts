import type { SentenceCitation } from "../types";

const normalize = (value: string) => value.replace(/\s+/g, " ").trim().toLowerCase();

export const findSentenceCitation = (
  citations: SentenceCitation[] | undefined,
  section: string,
  sentence: string,
): SentenceCitation | undefined => {
  if (!citations?.length || !section || !sentence) return undefined;
  const sectionNorm = section.trim();
  const sentenceNorm = normalize(sentence);
  if (!sentenceNorm) return undefined;

  const exact = citations.find(
    (item) =>
      item.section === sectionNorm &&
      normalize(item.sentence) === sentenceNorm,
  );
  if (exact) return exact;

  return citations.find((item) => {
    if (item.section !== sectionNorm) return false;
    const itemSentenceNorm = normalize(item.sentence);
    return (
      sentenceNorm.includes(itemSentenceNorm) ||
      itemSentenceNorm.includes(sentenceNorm)
    );
  });
};

export const buildCitationTooltip = (citation: SentenceCitation): string => {
  const sources = citation.sourceTitles.map((title, index) => {
    const url = citation.sourceUrls?.[index];
    return `${index + 1}. ${title}${url ? ` (${url})` : ""}`;
  });
  return `Grounding source(s):\n${sources.join("\n")}`;
};

export const getCitationTooltip = (
  citations: SentenceCitation[] | undefined,
  section: string,
  sentence: string,
): string | undefined => {
  const citation = findSentenceCitation(citations, section, sentence);
  if (!citation || !citation.sourceTitles.length) return undefined;
  return buildCitationTooltip(citation);
};

