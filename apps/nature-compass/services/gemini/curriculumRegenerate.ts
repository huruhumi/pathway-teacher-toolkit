import { createAIClient, retryAICall as retryOperation } from '@pathway/ai';
import { Curriculum, CurriculumParams, InputSnapshot, LessonPlanResponse, RoadmapItem } from '../../types';
import { curriculumSchema, roadmapItemSchema } from './curriculumSchemas';
import { getDefaultPageConfig } from '../../constants/handbookDefaults';
import { generateDownstreamContent } from './supportingContent';

type MustHaveConstraint = {
    id: string;
    source: string;
    keywords: string[];
};

const EN_STOPWORDS = new Set([
    'the', 'and', 'for', 'with', 'into', 'from', 'that', 'this', 'then', 'step', 'learn', 'guide',
    'children', 'kids', 'students', 'activity', 'phase', 'should', 'need', 'must', 'about', 'basic',
    'use', 'using', 'lead', 'teaching',
]);

const ZH_STOPWORDS = new Set([
    '这个', '阶段', '应该', '带领', '孩子', '孩子们', '学习', '进行', '并', '然后', '让', '老师', '活动', '步骤', '要求',
    '认识', '基础', '知识', '带着',
]);

const KEYWORD_HINTS: Array<{ pattern: RegExp; keywords: string[] }> = [
    { pattern: /(电子秤|秤|量勺|称重|weigh|scale|measuring spoon)/i, keywords: ['电子秤', '量勺', '称重', 'scale', 'measuring spoon'] },
    { pattern: /(克|毫升|单位|g\b|ml\b|gram|milliliter)/i, keywords: ['克', '毫升', '单位', 'g', 'ml', 'gram', 'milliliter'] },
    { pattern: /(混合|面团|dough|mix)/i, keywords: ['混合', '面团', 'dough', 'mix'] },
    { pattern: /(模具|花朵|切出|cutter|flower[- ]?shaped|cut)/i, keywords: ['模具', '花朵', '切出', 'cutter', 'flower'] },
    { pattern: /(糖霜|装饰|icing|decorate|decorat)/i, keywords: ['糖霜', '装饰', 'icing', 'decorate'] },
];

function splitFeedbackItems(feedback: string): string[] {
    const text = (feedback || '').trim();
    if (!text) return [];

    const numbered = text
        .replace(/\r/g, '')
        .split(/(?=\s*\d+[.)、])/g)
        .map((s) => s.trim().replace(/^\d+[.)、]\s*/, ''))
        .filter(Boolean);
    if (numbered.length >= 2) return numbered;

    const lines = text
        .split(/\n+/)
        .map((s) => s.trim().replace(/^[-*•]\s*/, ''))
        .filter(Boolean);
    if (lines.length > 1) return lines;

    const clauses = text
        .split(/[。；;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    return clauses.length > 1 ? clauses : [text];
}

function extractKeywordsFromItem(item: string): string[] {
    const keywords: string[] = [];
    const cleaned = item.trim();
    if (!cleaned) return keywords;

    for (const hint of KEYWORD_HINTS) {
        if (hint.pattern.test(cleaned)) {
            for (const kw of hint.keywords) {
                if (!keywords.includes(kw)) keywords.push(kw);
            }
        }
    }

    const zhTokens = cleaned.match(/[\u4e00-\u9fff]{1,8}/g) || [];
    for (const token of zhTokens) {
        if (ZH_STOPWORDS.has(token)) continue;
        if (token.length === 1 && !['克'].includes(token)) continue;
        if (!keywords.includes(token)) keywords.push(token);
    }

    const enTokens = cleaned.toLowerCase().match(/[a-z][a-z0-9-]{1,}/g) || [];
    for (const token of enTokens) {
        if (EN_STOPWORDS.has(token)) continue;
        if (token.length < 3 && !['g', 'ml'].includes(token)) continue;
        if (!keywords.includes(token)) keywords.push(token);
    }

    return keywords.slice(0, 8);
}

function buildMustHaveConstraints(feedback: string): MustHaveConstraint[] {
    const items = splitFeedbackItems(feedback);
    return items
        .map((item, idx) => ({
            id: `REQ-${idx + 1}`,
            source: item,
            keywords: extractKeywordsFromItem(item),
        }))
        .filter((c) => c.source.length > 0);
}

function buildMustHaveBlock(constraints: MustHaveConstraint[]): string {
    if (!constraints.length) return '';
    const lines = constraints.map((c) => {
        const kw = c.keywords.length ? ` | keywords: ${c.keywords.join(', ')}` : '';
        return `- ${c.id}: ${c.source}${kw}`;
    });
    return `
[MUST-HAVE USER REQUIREMENTS]
${lines.join('\n')}

[MUST-HAVE EXECUTION RULE]
- Every MUST-HAVE item above MUST be reflected explicitly in output.
- Keep AI expansion: you may add extra high-quality details, but do not drop any MUST-HAVE.
- Place MUST-HAVE coverage mainly in: steps + activityInstructions + learningObjective.
- For each MUST-HAVE, include at least one concrete keyword/phrase from the requirement.`;
}

function phaseToValidationText(phase: RoadmapItem): string {
    return [
        phase.phase || '',
        phase.activity || '',
        phase.description || '',
        phase.learningObjective || '',
        ...(phase.steps || []),
        ...(phase.backgroundInfo || []),
        ...(phase.teachingTips || []),
        phase.activityInstructions || '',
    ]
        .join('\n')
        .toLowerCase();
}

function evaluateCoverage(
    phase: RoadmapItem,
    constraints: MustHaveConstraint[],
): { missing: MustHaveConstraint[]; coverage: number } {
    if (!constraints.length) return { missing: [], coverage: 1 };
    const text = phaseToValidationText(phase);
    const missing: MustHaveConstraint[] = [];

    for (const c of constraints) {
        const keys = c.keywords.length ? c.keywords : [c.source];
        const hitCount = keys.reduce((count, kw) => (text.includes(kw.toLowerCase()) ? count + 1 : count), 0);
        const requiredHits = keys.length >= 3 ? 2 : 1;
        if (hitCount < requiredHits) missing.push(c);
    }

    const coverage = (constraints.length - missing.length) / constraints.length;
    return { missing, coverage };
}

function buildMissingBlock(missing: MustHaveConstraint[]): string {
    if (!missing.length) return '';
    const lines = missing.map((m) => `- ${m.id}: ${m.source}`).join('\n');
    return `
[MISSING MUST-HAVE TO FIX]
${lines}

You must fix all missing items above in this rewrite.`;
}

export const regenerateCurriculumWithFeedback = async (
    currentCurriculum: Curriculum,
    params: CurriculumParams,
    feedback: string,
    language: 'en' | 'zh',
): Promise<Curriculum> => {
    const ai = createAIClient();
    const mustOutputChinese = language === 'zh';

    const systemInstruction = `You are a curriculum optimization specialist. Rewrite the curriculum based on feedback.

[CURRENT CURRICULUM]
${JSON.stringify(currentCurriculum, null, 2)}

[USER FEEDBACK]
"${feedback}"

[HARD CONSTRAINTS]
1. Keep exactly ${params.lessonCount} lessons.
2. Keep each lesson duration at ${params.duration}.
3. Target age: ${params.ageGroup}, city: ${params.city}.
4. Keep STEAM framing and "outdoor primary path + indoor rainy fallback" logic.
5. ${mustOutputChinese ? 'ALL output values MUST be Simplified Chinese.' : 'ALL output values MUST be English.'}`;

    return await retryOperation(async () => {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: 'Regenerate the curriculum according to the instructions.',
            config: {
                systemInstruction,
                responseMimeType: 'application/json',
                responseSchema: curriculumSchema,
                temperature: 0.5,
            },
        });

        const text = response.text;
        if (!text) throw new Error('AI returned an empty response.');
        return JSON.parse(text) as Curriculum;
    });
};

export const regenerateSinglePhase = async (
    plan: LessonPlanResponse,
    phaseIndex: number,
    feedback: string,
    language: 'en' | 'zh',
    inputSnapshot?: import('../../types').InputSnapshot,
): Promise<RoadmapItem> => {
    const ai = createAIClient();
    const mustOutputChinese = language === 'zh';
    const currentPhase = plan.roadmap[phaseIndex];
    const allPhases = plan.roadmap.map((p, i) => `[Phase ${i + 1}] ${p.phase}: ${p.activity} (${p.timeRange})`).join('\n');

    const mode = inputSnapshot?.mode || 'school';
    const weather = inputSnapshot?.weather || 'Sunny';
    const studentAge = inputSnapshot?.studentAge || '6-12';
    const cefrLevel = inputSnapshot?.cefrLevel || 'A1 (Beginner)';
    const isFamily = mode === 'family';
    const isRainy = weather === 'Rainy';
    const familyEslEnabled = inputSnapshot?.familyEslEnabled ?? false;

    const contextBlock = `
[LESSON CONTEXT]
Mode: ${mode}${isFamily ? ' (family: parents + children)' : ' (school: teacher + class group)'}
Weather: ${weather}${isRainy ? ' -> MUST provide indoor-safe equivalent execution.' : ' -> outdoor-first execution.'}
Student Age: ${studentAge}
${!isFamily || familyEslEnabled ? `CEFR Level: ${cefrLevel}` : 'No ESL focus (pure exploration).'}
Duration: ${inputSnapshot?.duration || 180} minutes

[WEATHER STRATEGY]
${isRainy
        ? `- Rainy mode is active.
- Use indoor-safe maker/lab/home alternatives.
- Preserve the same learning objective as sunny version.
- Do not produce outdoor-only instructions.`
        : `- Sunny mode: prioritize outdoor observation, collection, and experimentation.`}

${isFamily
        ? `[FAMILY MODE RULES]
- Remove classroom/group-management wording.
- Use parent-friendly read-aloud guidance.
- Focus on bonding, curiosity prompts, and safety.
- Keep materials lightweight and easy to carry.
${familyEslEnabled ? '- Add only light English exploration (2-3 words per phase), no formal drills.' : '- Pure exploration: do not force ESL routines.'}`
        : `[SCHOOL MODE RULES]
- Keep teacher execution clarity, pacing, and differentiation.
- Keep student tasks explicit and assessable.`}
`;

    const qualityBlock = `
[QUALITY REQUIREMENTS - KEEP SAME STANDARD AS INITIAL GENERATION]
1. description: 6-8 concrete sentences.
2. steps: 5-7 actionable lines.
3. backgroundInfo: 5-8 factual points with specifics.
4. teachingTips: 3-5 practical facilitation tips.
5. activityInstructions: objective + materials + numbered steps + timing hints.
6. learningObjective: specific and measurable.
7. Use easy-to-source materials only.

[5E ALIGNMENT]
Phase should stay coherent with 5E progression.
Current index: Phase ${phaseIndex + 1} of ${plan.roadmap.length}.`;
    const mustHaveConstraints = buildMustHaveConstraints(feedback);
    const mustHaveBlock = buildMustHaveBlock(mustHaveConstraints);

    const factSheetBlock = inputSnapshot?.factSheet
        ? `\n[FACTUAL GROUNDING]\nbackgroundInfo and description should stay grounded in this fact sheet:\n${inputSnapshot.factSheet.slice(0, 4000)}\n`
        : '';

    const buildSystemInstruction = (missingBlock = '') => `You are a STEAM lesson design expert. Rewrite one roadmap phase based on feedback while keeping roadmap coherence.

[LESSON INFO]
Theme: ${plan.basicInfo.theme}
Activity Type: ${plan.basicInfo.activityType}
Audience: ${plan.basicInfo.targetAudience}
Location: ${plan.basicInfo.location}
All phases:
${allPhases}
${contextBlock}

[PHASE TO REWRITE #${phaseIndex + 1}]
${JSON.stringify(currentPhase, null, 2)}

[USER FEEDBACK]
"${feedback}"
${mustHaveBlock}
${missingBlock}
${qualityBlock}
${factSheetBlock}

[OUTPUT LANGUAGE]
${mustOutputChinese ? 'ALL output values MUST be Simplified Chinese.' : 'ALL output values MUST be English.'}

Keep the same time range (${currentPhase.timeRange}).`;

    const regenerateOnce = async (missingBlock = '', temperature = 0.45): Promise<RoadmapItem> => {
        return retryOperation(async () => {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: 'Regenerate this roadmap phase according to the instructions.',
                config: {
                    systemInstruction: buildSystemInstruction(missingBlock),
                    responseMimeType: 'application/json',
                    responseSchema: roadmapItemSchema,
                    temperature,
                },
            });

            const text = response.text;
            if (!text) throw new Error('AI returned an empty response.');
            return JSON.parse(text) as RoadmapItem;
        });
    };

    const firstPass = await regenerateOnce();
    if (!mustHaveConstraints.length) return firstPass;

    const firstCoverage = evaluateCoverage(firstPass, mustHaveConstraints);
    if (firstCoverage.missing.length === 0) return firstPass;

    const secondPass = await regenerateOnce(buildMissingBlock(firstCoverage.missing), 0.35);
    const secondCoverage = evaluateCoverage(secondPass, mustHaveConstraints);
    if (secondCoverage.missing.length > 0) {
        console.warn('[regenerateSinglePhase] must-have coverage incomplete after retry:', {
            phaseIndex,
            missing: secondCoverage.missing.map((m) => m.source),
            coverage: secondCoverage.coverage,
        });
    }
    return secondPass;
};

function parsePlanDurationMinutes(plan: LessonPlanResponse): number {
    const ranges = (plan.roadmap || [])
        .map((r) => r.timeRange || '')
        .map((text) => text.match(/(\d+)\s*-\s*(\d+)/))
        .filter((m): m is RegExpMatchArray => Boolean(m));
    if (!ranges.length) return 180;
    const end = Number(ranges[ranges.length - 1][2]);
    return Number.isFinite(end) && end > 0 ? end : 180;
}

function buildFallbackSnapshot(plan: LessonPlanResponse): InputSnapshot {
    return {
        mode: 'school',
        familyEslEnabled: false,
        weather: 'Sunny',
        studentAge: plan.basicInfo?.targetAudience || '3-5',
        cefrLevel: 'A1',
        duration: parsePlanDurationMinutes(plan),
        handbookMode: 'auto',
        handbookPreset: 'standard',
        handbookPageConfig: getDefaultPageConfig(),
        factSheet: plan.factSheet,
        factSheetSources: plan.factSheetSources,
        factSheetMeta: plan.factSheetMeta,
    };
}

/**
 * @deprecated Kept only as a compatibility shim.
 * Routes legacy callers to the unified Phase 2 pipeline in supportingContent.ts.
 */
export const regenerateDownstreamFromRoadmap = async (
    plan: LessonPlanResponse,
    language: 'en' | 'zh',
): Promise<Pick<LessonPlanResponse, 'handbook' | 'supplies' | 'imagePrompts' | 'notebookLMPrompt' | 'handbookStylePrompt'>> => {
    const snapshot = plan._inputSnapshot ?? buildFallbackSnapshot(plan);
    if (!plan._inputSnapshot) {
        console.warn('[regenerateDownstreamFromRoadmap] Missing _inputSnapshot, using fallback defaults to keep compatibility.');
    }

    const downstream = await generateDownstreamContent(plan, snapshot, language);
    return {
        handbook: downstream.handbook,
        supplies: downstream.supplies,
        imagePrompts: downstream.imagePrompts,
        notebookLMPrompt: downstream.notebookLMPrompt,
        handbookStylePrompt: downstream.handbookStylePrompt,
    };
};
