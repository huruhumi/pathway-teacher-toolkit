import type { LessonInput } from '../../types';
import { PATHWAY_BRAND_STYLE_BLOCK } from './constants';

type PlanPromptArgs = {
  isCN: boolean;
  structure: string;
  knowledgeBlock: string;
  input: LessonInput;
};

type HandbookPromptArgs = {
  isCN: boolean;
  structure: string;
  roadmapSummary: string;
  knowledgeBlock: string;
  input: LessonInput;
};

export function buildTopicExtractionPrompt(structure: string): string {
  return `Analyze the handbook page outline below and extract high-value research topics.

[OUTLINE]
${structure}

[OUTPUT JSON FIELDS]
- topics: 8-15 concrete searchable knowledge topics in outline order
- suggestedTheme: concise theme title (<= 20 characters in target language)
- suggestedIntro: 1-2 sentence intro (short and student-friendly)
- Prioritize: historical context, scientific facts, cultural context, ecological knowledge.`;
}

export function buildResearchTopicPrompt(topic: string): string {
  return `Research the topic below and produce a factual teaching knowledge brief in Simplified Chinese.

Topic: ${topic}

Requirements:
- Output length around 500-1500 Chinese characters
- Include concrete data, dates, locations, terms, and causal relationships
- Keep it suitable for children/teens education scenarios
- Add citation markers when possible, e.g. [1], [2]
- Do not fabricate facts; if uncertain, explicitly say so`;
}

function resolveAgeStyleGuide(studentAge: LessonInput['studentAge']): string {
  const ageNum = parseInt(String(studentAge), 10) || 8;
  if (ageNum <= 5) return 'Soft rounded cartoon style, high visual ratio, large shapes, minimal text.';
  if (ageNum <= 8) return 'Friendly flat vector style, bold outlines, playful composition.';
  return 'Sophisticated flat/infographic style with cleaner data-oriented composition.';
}

function buildFactSheetGroundingBlock(input: LessonInput): string {
  if (!input.factSheet) return '';
  const freshness = input.factSheetMeta
    ? `
Freshness metadata:
- Theme tier: ${input.factSheetMeta.themeTier}
- Target window: ${input.factSheetMeta.targetWindow}
- Effective window: ${input.factSheetMeta.effectiveWindow}
- Risk level: ${input.factSheetMeta.riskLevel}
- Coverage: ${(input.factSheetMeta.coverage * 100).toFixed(0)}%`
    : '';

  return `
[FACT SHEET GROUNDING]
The generated output must stay grounded in the fact sheet.
Do not add unsupported claims.
${input.factSheetQuality === 'insufficient' ? '- Fact sheet quality is insufficient: mark uncertain additions as [Unverified].' : ''}
${input.factSheetQuality === 'low' ? '- Fact sheet quality is low: use cautious wording and avoid over-claiming.' : ''}
${freshness}
Fact sheet excerpt:
${input.factSheet.slice(0, 8000)}
`;
}

export function buildStructuredPlanSystemInstruction(args: PlanPromptArgs): string {
  const { isCN, structure, knowledgeBlock, input } = args;
  const roadmapLensRule = input.mode === 'family'
    ? 'Roadmap steps must be direct parent read-aloud lines; activityInstructions must follow "story/fact explanation + mission task" for child execution.'
    : 'Roadmap steps must be direct teacher read-aloud lines; activityInstructions must be worksheet/task-sheet style for students.';
  const weatherRule = input.weather === 'Rainy'
    ? 'RAINY mode: every phase must provide indoor-safe equivalent execution. Do not output outdoor-only instructions unless explicitly marked optional for clear weather.'
    : 'SUNNY mode: prioritize outdoor observation/action while keeping safety and feasibility clear.';
  const modeRule = input.mode === 'family'
    ? `Family mode (parent + child). ${input.familyEslEnabled ? 'English exploration is ON: add only light English touchpoints.' : 'Pure exploration mode: do not force ESL routines.'}`
    : `School mode (teacher + class). ESL target level: ${input.cefrLevel || 'A1 (Beginner)'}.`;
  const factSheetGroundingBlock = buildFactSheetGroundingBlock(input);

  return `You are a STEAM outdoor curriculum design expert.
Generate a teaching plan from the user-defined handbook outline and knowledge base.

[USER OUTLINE]
${structure}

[KNOWLEDGE BASE]
${knowledgeBlock || '(empty)'}
${factSheetGroundingBlock}

[EXECUTION CONTEXT]
- Weather: ${input.weather}
- Mode: ${modeRule}
- Target age: ${input.studentAge}
- Duration: ${input.duration} minutes

[REQUIREMENTS]
1. Generate roadmap phases aligned to the outline structure.
2. Every phase.backgroundInfo must be grounded in knowledge-base facts.
3. supplies must cover materials and props implied by the outline.
4. Extract 8-12 vocabulary items with concise definitions.
5. safetyProtocol must match activity risks and be actionable.
6. Output language: ${isCN ? 'Simplified Chinese' : 'English'}.
7. ${weatherRule}
8. ${roadmapLensRule}
9. Include actionable safety cues in each phase (ratio, boundaries, tool handling, allergy/weather risk).`;
}

export function buildStructuredHandbookSystemInstruction(args: HandbookPromptArgs): string {
  const { isCN, structure, roadmapSummary, knowledgeBlock, input } = args;
  const ageStyleGuide = resolveAgeStyleGuide(input.studentAge);
  const hasKnowledge = Boolean(knowledgeBlock.trim());
  const teacherPromptRule =
    input.mode === 'family'
      ? 'direct read-aloud parent facilitation script with EXACT labels: Do Together, Ask Together, Reflect Together.'
      : 'direct read-aloud teacher script with: Objective, Opening Script, Guided Questions (3-5), Differentiation & Time Control.';
  const studentContentRule =
    input.mode === 'family'
      ? 'For Activity/Worksheet and Reading pages, contentPrompt MUST follow "story/fact explanation + mission task".'
      : 'For Activity/Worksheet pages, contentPrompt MUST be worksheet/task-sheet style: Task Goal, Materials Checklist, numbered Steps, and response spaces.';
  const weatherRule = input.weather === 'Rainy'
    ? 'RAINY mode: handbook activity execution must be indoor-safe by default.'
    : 'SUNNY mode: prioritize outdoor observation/exploration when feasible.';
  const factSheetGroundingBlock = buildFactSheetGroundingBlock(input);

  return `You are a student-handbook visual/content designer.
Generate handbook pages strictly from the outline.

[USER OUTLINE]
${structure}

[ROADMAP SUMMARY]
${roadmapSummary}

[KNOWLEDGE BASE]
${knowledgeBlock || '(empty)'}
${factSheetGroundingBlock}

[EXECUTION CONTEXT]
- Weather: ${input.weather}
- Mode: ${input.mode}
- Target age: ${input.studentAge}
- Duration: ${input.duration} minutes

[BRAND RULES]
${PATHWAY_BRAND_STYLE_BLOCK}

[DESIGN RULES]
1. Generate one handbook entry per outline page with continuous numbering.
2. visualPrompt must be production-ready (scene, composition, lighting, focal elements).
3. Cover/Back Cover use full-bleed thematic visuals; content pages keep white backgrounds (#FFFFFF).
4. section must be one of: Cover, Table of Contents, Safety, Prop Checklist, Phase Transition, Background Knowledge, Activity/Worksheet, Reflection, Certificate, Back Cover.
5. Set phaseIndex (0-based) for roadmap-bound pages.
6. Use brand naming: Nature Compass. Do not use Pathway Academy.
7. Age style guide: ${ageStyleGuide}
8. ${
    hasKnowledge
      ? 'Use skeleton contentPrompt format: title + type + 3-5 retrievable topic bullets + interaction format.'
      : 'contentPrompt must include full printable copy.'
  }
9. Background Knowledge and Activity/Worksheet pages MUST include teacherContentPrompt:
   - ${teacherPromptRule}
10. ${studentContentRule}
11. ${weatherRule}
12. Output language: ${isCN ? 'Simplified Chinese' : 'English'}.`;
}
