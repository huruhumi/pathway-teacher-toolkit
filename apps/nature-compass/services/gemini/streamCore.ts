import type { Schema } from "@google/genai";
import { LessonPlanResponse } from "../../types";
import { lessonPlanSchema } from "./schema";
import { extractJSON, tryPartialParse } from "./parsing";
import { NatureLessonPlanResponseSchema } from "@shared/types/schemas";
import { createAIClient, retryAICall as retryOperation } from "@pathway/ai";
import type { z } from "zod";

export interface StreamCoreOptions {
  systemInstruction: string;
  contents: any;
  onPartialResult: (partial: Partial<LessonPlanResponse>, completedKeys: string[]) => void;
  signal?: AbortSignal;
  /** Gemini JSON response schema — defaults to full lessonPlanSchema */
  responseSchema?: Schema;
  /** Zod validation schema — defaults to NatureLessonPlanResponseSchema */
  validationSchema?: z.ZodType<any>;
}

export async function streamLessonPlanCore(
  systemInstructionOrOpts: string | StreamCoreOptions,
  contents?: any,
  onPartialResult?: (partial: Partial<LessonPlanResponse>, completedKeys: string[]) => void,
  signal?: AbortSignal,
): Promise<LessonPlanResponse> {
  // Support both legacy positional args and new options object
  let opts: StreamCoreOptions;
  if (typeof systemInstructionOrOpts === 'string') {
    opts = { systemInstruction: systemInstructionOrOpts, contents, onPartialResult: onPartialResult!, signal };
  } else {
    opts = systemInstructionOrOpts;
  }

  const schema = opts.responseSchema ?? lessonPlanSchema;
  const zodSchema = opts.validationSchema ?? NatureLessonPlanResponseSchema;

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
        systemInstruction: opts.systemInstruction,
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.5,
      },
      contents: opts.contents,
    });

    for await (const chunk of response) {
      if (opts.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const chunkText = chunk.text;
      if (chunkText) {
        accumulatedText += chunkText;
        lastKnownKeys = tryPartialParse(accumulatedText, lastKnownKeys, opts.onPartialResult);
      }
    }

    if (!accumulatedText) throw new Error("No response from Gemini stream");
    return zodSchema.parse(extractJSON(accumulatedText)) as LessonPlanResponse;
  }, opts.signal);
}
