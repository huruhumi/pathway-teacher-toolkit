import { CEFRLevel } from "../types";
import type { TextbookLevelOptionView } from "@shared/config/eslAssessmentRegistry";
import { getCustomTextbookLevelLabel, isCustomTextbookLevelKey } from "./customTextbookLevels";

const mapTokenToCEFR = (token: string): CEFRLevel | null => {
  const normalized = token.trim().toUpperCase();
  if (!normalized) return null;
  if (normalized === "ZERO FOUNDATION") return CEFRLevel.Beginner;
  if (normalized === "PRE-A1") return CEFRLevel.PreA1;
  if (normalized === "A1") return CEFRLevel.A1;
  if (normalized === "A2") return CEFRLevel.A2;
  if (normalized === "B1" || normalized === "B1+") return CEFRLevel.B1;
  if (normalized === "B2") return CEFRLevel.B2;
  if (normalized === "C1") return CEFRLevel.C1;
  if (normalized === "C2") return CEFRLevel.C2;
  if (normalized.includes("TOEFL") || normalized.includes("IELTS")) return CEFRLevel.TOEFL_IELTS;
  return null;
};

const pickFromRange = (label: string): CEFRLevel | null => {
  const normalized = label.trim().toUpperCase();
  if (!normalized) return null;
  const tokens = normalized.match(/PRE-A1|A1|A2|B1\+?|B2|C1|C2|ZERO FOUNDATION/g) || [];
  if (!tokens.length) return null;
  return mapTokenToCEFR(tokens[0]);
};

export function resolveCEFRFromTextbookLevelKey(
  textbookLevelKey: string | undefined,
  textbookOptions: TextbookLevelOptionView[],
  fallback: CEFRLevel = CEFRLevel.Beginner,
): CEFRLevel {
  if (!textbookLevelKey) return fallback;
  if (isCustomTextbookLevelKey(textbookLevelKey)) {
    const customLabel = getCustomTextbookLevelLabel(textbookLevelKey);
    return (customLabel && pickFromRange(customLabel)) || fallback;
  }

  const option = textbookOptions.find((item) => item.levelKey === textbookLevelKey);
  if (!option) return fallback;
  return pickFromRange(option.levelLabel || option.levelDisplayName) || fallback;
}

