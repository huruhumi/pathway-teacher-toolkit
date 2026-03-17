import type { Part } from "@google/genai";
import type { LessonInput } from "../../types";

export function buildContents(input: LessonInput, fallbackText: string): any {
  if (input.uploadedFiles && input.uploadedFiles.length > 0) {
    const parts: Part[] = input.uploadedFiles.map(file => ({
      inlineData: { mimeType: file.type, data: file.data }
    }));
    if (input.factSheet) {
      parts.push({ text: `[璇剧▼鑳屾櫙鐭ヨ瘑搴曠 鈥?鏉ヨ嚜宸查獙璇佹潵婧怾\n${input.factSheet.slice(0, 20000)}` });
    }
    parts.push({ text: fallbackText });
    return [{ parts }];
  }

  if (input.factSheet) {
    const parts: Part[] = [
      { text: `[璇剧▼鑳屾櫙鐭ヨ瘑搴曠 鈥?鏉ヨ嚜宸查獙璇佹潵婧怾\n${input.factSheet.slice(0, 20000)}` },
      { text: fallbackText },
    ];
    return [{ parts }];
  }

  return [{ text: fallbackText }];
}
