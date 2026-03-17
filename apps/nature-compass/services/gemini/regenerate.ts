import { Schema, Type } from "@google/genai";
import { createAIClient, retryAICall as retryOperation } from "@pathway/ai";
import type { HandbookPageConfig, LessonInput, LessonPlanResponse } from "../../types";
import { lessonPlanSchema } from "./schema";

type ResolvePageConfig = (input: LessonInput) => HandbookPageConfig[] | null;
type BuildHandbookRules = (input: LessonInput) => string;

export interface RegenerateDeps {
  resolvePageConfig: ResolvePageConfig;
  buildHandbookRules: BuildHandbookRules;
  getTotalPages: (pageConfig: HandbookPageConfig[]) => number;
}

const regenerateSchema = {
  type: Type.OBJECT,
  properties: {
    roadmap: lessonPlanSchema.properties!.roadmap,
    handbook: lessonPlanSchema.properties!.handbook,
    handbookStructurePlan: { type: Type.STRING, description: "Updated structure plan for the handbook." },
  },
  required: ["roadmap", "handbook", "handbookStructurePlan"] as string[],
};

export async function regenerateWithFeedbackCore(
  deps: RegenerateDeps,
  currentPlan: LessonPlanResponse,
  feedback: string,
  input: LessonInput,
  onProgress?: (message: string) => void,
  signal?: AbortSignal,
): Promise<{ roadmap: LessonPlanResponse["roadmap"]; handbook: LessonPlanResponse["handbook"]; handbookStructurePlan?: string }> {
  const ai = createAIClient();
  const isFamily = input.mode === "family";

  const pageConfig = deps.resolvePageConfig(input);
  const handbookPageTarget = pageConfig
    ? deps.getTotalPages(pageConfig)
    : (input.autoPageTarget || (input.duration <= 60 ? 15 : input.duration <= 90 ? 20 : input.duration <= 120 ? 25 : 30));

  const outputLanguage = /[\u4e00-\u9fff]/.test(currentPlan.missionBriefing?.title || "")
    ? "Chinese"
    : "English";

  const systemInstruction = `
You are an expert curriculum revision specialist.

Your task: revise roadmap and handbook of an existing "${input.duration}-minute Nature Compass ${isFamily ? "parent-child exploration" : "workshop"} plan" based on user feedback.

[CURRENT ROADMAP]
${JSON.stringify(currentPlan.roadmap, null, 2)}

[CURRENT HANDBOOK STRUCTURE]
${currentPlan.handbookStructurePlan || "Not available"}

[USER FEEDBACK]
"${feedback}"

[INSTRUCTIONS]
1. Analyze user feedback carefully.
2. Modify roadmap to address feedback: add, remove, rebalance, or restructure phases as needed.
3. Keep 5E model structure: Engage, Explore, Explain, Elaborate, Evaluate.
4. Keep roadmap detail quality: 6-8 sentence descriptions, 5-7 steps, 5-8 backgroundInfo items, teachingTips, activityInstructions.
5. Regenerate handbook to match new roadmap, ensuring each roadmap phase has corresponding handbook pages.
6. Handbook must have exactly ${handbookPageTarget} pages.
7. Preserve theme "${input.theme}" and target audience (Ages ${input.studentAge}).
${input.factSheet ? "8. Use ONLY facts from the provided fact sheet for backgroundInfo and descriptions." : ""}

${deps.buildHandbookRules(input)}

[LANGUAGE]
ALL output must be in ${outputLanguage}.
`;

  onProgress?.("Applying feedback and regenerating roadmap + handbook...");

  return await retryOperation(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: regenerateSchema as Schema,
        temperature: 0.5,
      },
      contents: input.factSheet
        ? [{ role: "user", parts: [{ text: `Fact Sheet:\n${input.factSheet}\n\nPlease regenerate roadmap and handbook using the feedback above.` }] }]
        : [{ role: "user", parts: [{ text: "Please regenerate roadmap and handbook using the feedback above." }] }],
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from Gemini");

    const parsed = JSON.parse(text);
    if (!parsed.roadmap || !parsed.handbook) {
      throw new Error("Missing roadmap or handbook in response");
    }

    return {
      roadmap: parsed.roadmap,
      handbook: parsed.handbook,
      handbookStructurePlan: parsed.handbookStructurePlan,
    };
  }, signal);
}
