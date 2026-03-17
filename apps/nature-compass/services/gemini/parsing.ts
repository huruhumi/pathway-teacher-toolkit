import type { LessonPlanResponse } from "../../types";

export function extractJSON(raw: string): unknown {
  const start = raw.indexOf('{');
  if (start === -1) throw new Error('No JSON object found in response');
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return JSON.parse(raw.slice(start, i + 1));
    }
  }
  return JSON.parse(raw);
}

export function tryPartialParse(
  text: string,
  lastKnownKeys: string[],
  onPartialResult: (partial: Partial<LessonPlanResponse>, completedKeys: string[]) => void,
): string[] {
  try {
    const parsed = JSON.parse(text);
    const keys = Object.keys(parsed);
    if (keys.length > lastKnownKeys.length) {
      onPartialResult(parsed, keys);
      return keys;
    }
  } catch {
    let attempt = text;
    const openBraces = (attempt.match(/{/g) || []).length;
    const closeBraces = (attempt.match(/}/g) || []).length;
    const openBrackets = (attempt.match(/\[/g) || []).length;
    const closeBrackets = (attempt.match(/\]/g) || []).length;
    attempt = attempt.replace(/,\s*$/, '');
    for (let i = 0; i < openBrackets - closeBrackets; i++) attempt += ']';
    for (let i = 0; i < openBraces - closeBraces; i++) attempt += '}';
    try {
      const parsed = JSON.parse(attempt);
      const keys = Object.keys(parsed);
      if (keys.length > lastKnownKeys.length) {
        onPartialResult(parsed, keys);
        return keys;
      }
    } catch {
      // Ignore partial parse failures and keep accumulating.
    }
  }
  return lastKnownKeys;
}
