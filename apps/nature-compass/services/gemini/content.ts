import type { Part } from "@google/genai";
import type { LessonInput } from "../../types";

function buildFreshnessMetaText(input: LessonInput): string {
  if (!input.factSheetMeta) return "";

  return `\n[Freshness]\n` +
    `Tier=${input.factSheetMeta.themeTier}; ` +
    `target=${input.factSheetMeta.targetWindow}; ` +
    `effective=${input.factSheetMeta.effectiveWindow}; ` +
    `risk=${input.factSheetMeta.riskLevel}; ` +
    `coverage=${(input.factSheetMeta.coverage * 100).toFixed(0)}%`;
}

export function buildContents(input: LessonInput, fallbackText: string): any {
  const factSheetBlock = input.factSheet
    ? `[Grounded Fact Sheet]\n${input.factSheet.slice(0, 20000)}${buildFreshnessMetaText(input)}`
    : null;

  if (input.uploadedFiles && input.uploadedFiles.length > 0) {
    const parts: Part[] = input.uploadedFiles.map((file) => ({
      inlineData: { mimeType: file.type, data: file.data },
    }));
    if (factSheetBlock) parts.push({ text: factSheetBlock });
    parts.push({ text: fallbackText });
    return [{ parts }];
  }

  if (factSheetBlock) {
    return [{ parts: [{ text: factSheetBlock }, { text: fallbackText }] }];
  }

  return [{ text: fallbackText }];
}

