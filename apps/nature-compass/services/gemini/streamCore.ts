import { LessonPlanResponse } from "../../types";
import { lessonPlanSchema } from "./schema";
import { extractJSON, tryPartialParse } from "./parsing";
import { NatureLessonPlanResponseSchema } from "@shared/types/schemas";
import { createAIClient, retryAICall as retryOperation } from "@pathway/ai";

export async function streamLessonPlanCore(
  systemInstruction: string,
  contents: any,
  onPartialResult: (partial: Partial<LessonPlanResponse>, completedKeys: string[]) => void,
  signal?: AbortSignal,
): Promise<LessonPlanResponse> {
  const ai = createAIClient();
  let accumulatedText = "";
  let lastKnownKeys: string[] = [];

  return await retryOperation(async () => {
    // Reset accumulator on each retry to prevent memory leak from prior failed attempts
    accumulatedText = "";
    lastKnownKeys = [];

    const response = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: lessonPlanSchema,
        temperature: 0.5,
      },
      contents,
    });

    for await (const chunk of response) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const chunkText = chunk.text;
      if (chunkText) {
        accumulatedText += chunkText;
        lastKnownKeys = tryPartialParse(accumulatedText, lastKnownKeys, onPartialResult);
      }
    }

    if (!accumulatedText) throw new Error("No response from Gemini stream");
    return NatureLessonPlanResponseSchema.parse(extractJSON(accumulatedText)) as LessonPlanResponse;
  }, signal);
}
