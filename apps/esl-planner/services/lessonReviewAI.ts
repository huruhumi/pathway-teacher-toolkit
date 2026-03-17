import { Type, GenerateContentResponse } from "@google/genai";
import type { GeneratedContent } from '../types';
import type { ReviewItem } from '../utils/lessonReviewEngine';
import { createAIClient } from '@pathway/ai';
import { retryApiCall } from './gemini/shared';

const REVIEW_SYSTEM_PROMPT = `You are an expert ESL teaching consultant reviewing a lesson plan. Provide a section-by-section quality audit.

Focus on:
1. Are activities age/level appropriate?
2. Are teacher instructions specific enough for another teacher to follow?
3. Is there clear scaffolding (I do → We do → You do)?
4. Do activities genuinely practice the stated objectives?
5. Are transitions between stages smooth?
6. Is the content culturally appropriate for Chinese ESL learners?
7. Are the vocabulary definitions learner-friendly (not dictionary-style)?
8. Do worksheets align with what was taught?

Use Chinese for issue and suggestion fields. Return JSON array only.`;

export async function runAIReview(content: GeneratedContent): Promise<ReviewItem[]> {
    const ai = createAIClient();
    const planSummary = buildPlanSummary(content);

    const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: planSummary,
        config: {
            systemInstruction: REVIEW_SYSTEM_PROMPT,
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        section: { type: Type.STRING, description: 'e.g. "Stage 3: Practice"' },
                        severity: { type: Type.STRING, enum: ['error', 'warning', 'info'] },
                        issue: { type: Type.STRING, description: 'Issue description in Chinese' },
                        suggestion: { type: Type.STRING, description: 'Actionable suggestion in Chinese' },
                        field: { type: Type.STRING, description: 'Optional field name e.g. studentActivity' },
                        stageIndex: { type: Type.NUMBER, description: 'Optional 0-based stage index' },
                    },
                    required: ['section', 'severity', 'issue', 'suggestion'],
                },
            },
            temperature: 0.3,
        },
    }));

    let parsed: any[];
    try {
        parsed = JSON.parse(response.text || '[]');
    } catch {
        console.error('[AI Review] Failed to parse response:', (response.text || '').slice(0, 500));
        return [];
    }

    if (!Array.isArray(parsed)) return [];

    return parsed.map((item: any, i: number) => ({
        id: `ai-review-${Date.now()}-${i}`,
        section: item.section || 'General',
        severity: (['error', 'warning', 'info'].includes(item.severity) ? item.severity : 'info') as ReviewItem['severity'],
        issue: item.issue || '',
        suggestion: item.suggestion || '',
        field: item.field,
        stageIndex: typeof item.stageIndex === 'number' ? item.stageIndex : undefined,
    }));
}

function buildPlanSummary(content: GeneratedContent): string {
    const plan = content.structuredLessonPlan;
    if (!plan) return 'No structured lesson plan available.';
    const parts: string[] = [];

    parts.push(`# Lesson Plan Review Request`);
    parts.push(`## Class Information`);
    parts.push(`- Level: ${plan.classInformation?.level || 'Unknown'}`);
    parts.push(`- Topic: ${plan.classInformation?.topic || 'Unknown'}`);
    parts.push(`- Students: ${plan.classInformation?.students || 'Unknown'}`);

    const details = plan.lessonDetails;
    if (details) {
        parts.push(`\n## Lesson Details`);
        parts.push(`- Aim: ${details.aim || '(not set)'}`);
        parts.push(`- Objectives: ${(details.objectives || []).join('; ') || '(none)'}`);
        parts.push(`- Target Vocabulary: ${(details.targetVocab || []).map(v => `${v.word} (${v.definition})`).join(', ') || '(none)'}`);
        if (details.grammarSentences?.length) {
            parts.push(`- Grammar: ${details.grammarSentences.join('; ')}`);
        }
        if (details.anticipatedProblems?.length) {
            parts.push(`- Anticipated Problems: ${details.anticipatedProblems.map(p => `[${p.problem}] → ${p.solution}`).join('; ')}`);
        }
    }

    parts.push(`\n## Stages`);
    (plan.stages || []).forEach((stage, i) => {
        parts.push(`### Stage ${i + 1}: ${stage.stage}`);
        parts.push(`- Aim: ${stage.stageAim}`);
        parts.push(`- Timing: ${stage.timing}`);
        parts.push(`- Interaction: ${stage.interaction}`);
        parts.push(`- Teacher Activity: ${stage.teacherActivity}`);
        parts.push(`- Student Activity: ${stage.studentActivity}`);
        if (stage.teachingTips?.length) parts.push(`- Tips: ${stage.teachingTips.join('; ')}`);
    });

    if (content.worksheets?.length) {
        parts.push(`\n## Worksheets`);
        content.worksheets.forEach((ws, i) => {
            parts.push(`### Worksheet ${i + 1}: ${ws.title} (${ws.type})`);
            parts.push(`Instructions: ${ws.instructions}`);
            const allItems = ws.sections?.flatMap(s => s.items) || ws.items || [];
            allItems.slice(0, 5).forEach((item, j) => {
                parts.push(`  Q${j + 1}: ${item.question} → A: ${item.answer || '(no answer)'}`);
            });
            if (allItems.length > 5) parts.push(`  ... and ${allItems.length - 5} more items`);
        });
    }

    return parts.join('\n');
}

// ---------- Auto-fix a single review item ----------

const FIX_SYSTEM_PROMPT = `You are an ESL teaching expert. You will receive a specific issue found in a lesson plan and the current value of the problematic field.
Your job is to return ONLY the corrected/improved replacement value. Do not explain, do not wrap in quotes. Just return the replacement text directly.
If the field is an array (objectives, anticipatedProblems, etc.), return a JSON array.
Keep the same language and style as the original content.`;

export interface ApplyFixResult {
    updatedContent: GeneratedContent;
    appliedText: string;
    originalText: string;
    fixTarget: string;
}

export async function applyReviewFix(
    item: ReviewItem,
    content: GeneratedContent,
): Promise<ApplyFixResult> {
    const ai = createAIClient();
    const plan = content.structuredLessonPlan;
    if (!plan) throw new Error('No structured lesson plan');

    // Build context about what to fix
    let currentValue = '';
    let fixTarget = '';

    if (typeof item.stageIndex === 'number' && plan.stages[item.stageIndex]) {
        const stage = plan.stages[item.stageIndex];
        const field = item.field as keyof typeof stage;
        if (field && stage[field] !== undefined) {
            currentValue = String(stage[field]);
            fixTarget = `Stage ${item.stageIndex + 1} (${stage.stage}), field: ${field}`;
        } else {
            // Fix the whole stage description
            currentValue = JSON.stringify(stage, null, 2);
            fixTarget = `Stage ${item.stageIndex + 1} (${stage.stage}) - full stage`;
        }
    } else if (item.field === 'objectives') {
        currentValue = JSON.stringify(plan.lessonDetails.objectives);
        fixTarget = 'lessonDetails.objectives (array)';
    } else if (item.field === 'anticipatedProblems') {
        currentValue = JSON.stringify(plan.lessonDetails.anticipatedProblems);
        fixTarget = 'lessonDetails.anticipatedProblems (array of {problem, solution})';
    } else if (item.field === 'targetVocab') {
        currentValue = JSON.stringify(plan.lessonDetails.targetVocab);
        fixTarget = 'lessonDetails.targetVocab (array of {word, definition})';
    } else if (item.field === 'aim') {
        currentValue = plan.lessonDetails.aim;
        fixTarget = 'lessonDetails.aim (string)';
    } else {
        // Generic: provide the whole plan section for context
        currentValue = JSON.stringify(plan.lessonDetails, null, 2);
        fixTarget = `lessonDetails (general fix for: ${item.section})`;
    }

    const prompt = `Issue: ${item.issue}
Suggestion: ${item.suggestion}

Fix target: ${fixTarget}
Current value:
${currentValue}

Level: ${plan.classInformation?.level || 'Unknown'}
Topic: ${plan.classInformation?.topic || 'Unknown'}

Return ONLY the corrected replacement value for the fix target.`;

    const response: GenerateContentResponse = await retryApiCall(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            systemInstruction: FIX_SYSTEM_PROMPT,
            temperature: 0.3,
            maxOutputTokens: 2048,
        },
    }));

    const fixedText = (response.text || '').trim();
    if (!fixedText) throw new Error('AI returned empty fix');

    // Apply the fix to a deep-cloned content
    const updated = JSON.parse(JSON.stringify(content)) as GeneratedContent;
    const updatedPlan = updated.structuredLessonPlan;

    if (typeof item.stageIndex === 'number' && updatedPlan.stages[item.stageIndex]) {
        const stage = updatedPlan.stages[item.stageIndex];
        const field = item.field as keyof typeof stage;
        if (field && typeof stage[field] === 'string') {
            (stage as any)[field] = fixedText;
        } else {
            // Try to parse as full stage replacement
            try {
                const parsed = JSON.parse(fixedText);
                Object.assign(stage, parsed);
            } catch {
                // If not parseable, update the most common fields
                if (item.field === 'studentActivity') stage.studentActivity = fixedText;
                else if (item.field === 'teacherActivity') stage.teacherActivity = fixedText;
                else if (item.field === 'interaction') stage.interaction = fixedText;
                else stage.studentActivity = fixedText;
            }
        }
    } else if (item.field === 'objectives') {
        try {
            updatedPlan.lessonDetails.objectives = JSON.parse(fixedText);
        } catch {
            updatedPlan.lessonDetails.objectives = fixedText.split('\n').filter(Boolean);
        }
    } else if (item.field === 'anticipatedProblems') {
        try {
            updatedPlan.lessonDetails.anticipatedProblems = JSON.parse(fixedText);
        } catch {
            updatedPlan.lessonDetails.anticipatedProblems = [{ problem: fixedText, solution: '' }];
        }
    } else if (item.field === 'targetVocab') {
        try {
            updatedPlan.lessonDetails.targetVocab = JSON.parse(fixedText);
        } catch { /* keep original */ }
    } else if (item.field === 'aim') {
        updatedPlan.lessonDetails.aim = fixedText;
    }

    return { updatedContent: updated, appliedText: fixedText, originalText: currentValue, fixTarget };
}
