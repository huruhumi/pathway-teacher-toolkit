/**
 * Curriculum-level review engine — provides CROSS-LESSON structural checks
 * for an ESLCurriculum, complementing the per-lesson lessonReviewEngine.
 */
import type { ESLCurriculum, CurriculumLesson } from '../types';

export type CurriculumReviewSeverity = 'pass' | 'info' | 'warning' | 'error';

export interface CurriculumReviewItem {
    id: string;
    dimension: string;
    severity: CurriculumReviewSeverity;
    issue: string;
    suggestion: string;
    affectedLessons?: number[]; // lesson indexes
}

let cidCounter = 0;
function cid(): string {
    return `cr-${Date.now()}-${cidCounter++}`;
}

// ---------- 1. Grammar focus continuity ----------
function checkGrammarContinuity(curriculum: ESLCurriculum): CurriculumReviewItem[] {
    const items: CurriculumReviewItem[] = [];
    const grammarByLesson = curriculum.lessons.map((l) => (l.grammarFocus || '').trim().toLowerCase());
    const seen = new Map<string, number[]>();

    grammarByLesson.forEach((g, i) => {
        if (!g) return;
        if (!seen.has(g)) seen.set(g, []);
        seen.get(g)!.push(i);
    });

    // Check for exact duplicates
    for (const [grammar, indexes] of seen) {
        if (indexes.length > 1 && grammar.length > 0) {
            items.push({
                id: cid(),
                dimension: '语法连贯性',
                severity: 'warning',
                issue: `语法焦点 "${grammar}" 在课 ${indexes.map((i) => i + 1).join(', ')} 中完全重复。`,
                suggestion: '考虑将重复的语法点设为复习课、或调整为递进式教学（如简单句→复合句→复杂句）。',
                affectedLessons: indexes,
            });
        }
    }

    // Check for empty grammar focus
    const empty = grammarByLesson.map((g, i) => (g ? null : i)).filter((i) => i !== null) as number[];
    if (empty.length > 0 && empty.length < curriculum.lessons.length) {
        items.push({
            id: cid(),
            dimension: '语法连贯性',
            severity: 'info',
            issue: `课 ${empty.map((i) => i + 1).join(', ')} 没有设置语法焦点。`,
            suggestion: '如果是有意为之（如纯词汇课/复习课）可以忽略，否则建议补充明确的语法目标。',
            affectedLessons: empty,
        });
    }

    if (items.length === 0) {
        items.push({
            id: cid(),
            dimension: '语法连贯性',
            severity: 'pass',
            issue: '语法焦点在各课间无明显重复，连贯性良好。',
            suggestion: '',
        });
    }
    return items;
}

// ---------- 2. Vocabulary recycling ----------
function checkVocabRecycling(curriculum: ESLCurriculum): CurriculumReviewItem[] {
    const items: CurriculumReviewItem[] = [];
    const vocabMap = new Map<string, number[]>();

    curriculum.lessons.forEach((l, i) => {
        (l.suggestedVocabulary || []).forEach((word) => {
            const w = word.trim().toLowerCase();
            if (!w) return;
            if (!vocabMap.has(w)) vocabMap.set(w, []);
            vocabMap.get(w)!.push(i);
        });
    });

    const totalWords = vocabMap.size;
    const recycled = [...vocabMap.values()].filter((indexes) => indexes.length >= 2).length;
    const recycleRate = totalWords > 0 ? recycled / totalWords : 0;

    if (totalWords > 0 && recycleRate < 0.15) {
        items.push({
            id: cid(),
            dimension: '词汇复现率',
            severity: 'warning',
            issue: `共 ${totalWords} 个不同词汇中，只有 ${recycled} 个 (${(recycleRate * 100).toFixed(0)}%) 在多节课中出现。`,
            suggestion: '研究表明学生需要 6-8 次接触才能掌握新词。建议在后续课程中有意识地复现重点词汇。',
        });
    } else if (totalWords > 0) {
        items.push({
            id: cid(),
            dimension: '词汇复现率',
            severity: 'pass',
            issue: `共 ${totalWords} 个不同词汇，${recycled} 个 (${(recycleRate * 100).toFixed(0)}%) 在多节课中复现，复现率合格。`,
            suggestion: '',
        });
    }

    // Check for lessons with no vocabulary
    const noVocab = curriculum.lessons
        .map((l, i) => ((l.suggestedVocabulary || []).length === 0 ? i : null))
        .filter((i) => i !== null) as number[];
    if (noVocab.length > 0) {
        items.push({
            id: cid(),
            dimension: '词汇复现率',
            severity: 'info',
            issue: `课 ${noVocab.map((i) => i + 1).join(', ')} 没有建议词汇。`,
            suggestion: '确认这些课是否为复习/评估课型，若不是请补充目标词汇。',
            affectedLessons: noVocab,
        });
    }

    return items;
}

// ---------- 3. Activity diversity ----------
function checkActivityDiversity(curriculum: ESLCurriculum): CurriculumReviewItem[] {
    const items: CurriculumReviewItem[] = [];
    const allActivities = curriculum.lessons.flatMap((l) => l.suggestedActivities || []);
    const unique = new Set(allActivities.map((a) => a.trim().toLowerCase()));

    if (allActivities.length > 0 && unique.size < Math.min(4, curriculum.lessons.length)) {
        items.push({
            id: cid(),
            dimension: '活动多样性',
            severity: 'warning',
            issue: `${curriculum.lessons.length} 节课共使用了 ${unique.size} 种不同活动类型，多样性偏低。`,
            suggestion: '建议引入更多互动形式：角色扮演、信息差任务、拼图阅读、画廊漫步等，以维持学生的课堂参与度。',
        });
    } else if (allActivities.length > 0) {
        items.push({
            id: cid(),
            dimension: '活动多样性',
            severity: 'pass',
            issue: `活动类型丰富，共有 ${unique.size} 种不同活动形式。`,
            suggestion: '',
        });
    }

    return items;
}

// ---------- 4. Objective measurability ----------
const BLOOM_VERBS = new Set([
    'identify', 'describe', 'explain', 'apply', 'analyze', 'evaluate', 'create',
    'list', 'name', 'define', 'classify', 'compare', 'demonstrate', 'use',
    'write', 'read', 'speak', 'listen', 'practice', 'produce', 'recognize',
]);

function checkObjectiveMeasurability(curriculum: ESLCurriculum): CurriculumReviewItem[] {
    const items: CurriculumReviewItem[] = [];
    const weak: number[] = [];

    curriculum.lessons.forEach((l, i) => {
        const objs = l.objectives || [];
        if (objs.length === 0) {
            weak.push(i);
            return;
        }
        const hasBloom = objs.some((o) => {
            const firstWord = o.trim().split(/\s+/)[0]?.toLowerCase();
            return BLOOM_VERBS.has(firstWord);
        });
        if (!hasBloom) weak.push(i);
    });

    if (weak.length > 0) {
        items.push({
            id: cid(),
            dimension: '目标可衡量性',
            severity: weak.length > curriculum.lessons.length * 0.5 ? 'warning' : 'info',
            issue: `课 ${weak.map((i) => i + 1).join(', ')} 的学习目标缺少可衡量的 Bloom 动词（如 identify, describe, create 等）。`,
            suggestion: '使用 Bloom 分类法动词来表述目标，有助于教学评估的设计和学习成果的衡量。',
            affectedLessons: weak,
        });
    } else {
        items.push({
            id: cid(),
            dimension: '目标可衡量性',
            severity: 'pass',
            issue: '所有课程的学习目标均使用了可衡量的行为动词。',
            suggestion: '',
        });
    }

    return items;
}

// ---------- 5. Description completeness ----------
function checkDescriptionCompleteness(curriculum: ESLCurriculum): CurriculumReviewItem[] {
    const items: CurriculumReviewItem[] = [];
    const short: number[] = [];

    curriculum.lessons.forEach((l, i) => {
        if ((l.description || '').trim().length < 20) short.push(i);
    });

    if (short.length > 0) {
        items.push({
            id: cid(),
            dimension: '课程描述',
            severity: 'info',
            issue: `课 ${short.map((i) => i + 1).join(', ')} 的描述过于简短（少于 20 字符）。`,
            suggestion: '详细的课程描述有助于其他教师理解教学意图，建议补充 2-3 句话说明教学重点和预期成果。',
            affectedLessons: short,
        });
    } else {
        items.push({
            id: cid(),
            dimension: '课程描述',
            severity: 'pass',
            issue: '所有课程均有充足的描述文字。',
            suggestion: '',
        });
    }

    return items;
}

// ---------- Main entry ----------
export function runCurriculumReview(curriculum: ESLCurriculum): CurriculumReviewItem[] {
    cidCounter = 0;
    return [
        ...checkGrammarContinuity(curriculum),
        ...checkVocabRecycling(curriculum),
        ...checkActivityDiversity(curriculum),
        ...checkObjectiveMeasurability(curriculum),
        ...checkDescriptionCompleteness(curriculum),
    ];
}

export function curriculumReviewSummary(items: CurriculumReviewItem[]) {
    return {
        pass: items.filter((i) => i.severity === 'pass').length,
        info: items.filter((i) => i.severity === 'info').length,
        warning: items.filter((i) => i.severity === 'warning').length,
        error: items.filter((i) => i.severity === 'error').length,
    };
}
