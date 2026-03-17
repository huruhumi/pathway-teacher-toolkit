import type { GeneratedContent, LessonStage } from '../types';

export type ReviewSeverity = 'pass' | 'info' | 'warning' | 'error';

export interface ReviewItem {
    id: string;
    section: string;
    severity: ReviewSeverity;
    issue: string;
    suggestion: string;
    field?: string;
    /** Index of the stage in stages[], if applicable */
    stageIndex?: number;
    /** Whether the user dismissed this item */
    dismissed?: boolean;
}

// ---------- helpers ----------

const BLOOM_VERBS = new Set([
    'identify', 'describe', 'explain', 'apply', 'analyze', 'evaluate', 'create',
    'list', 'name', 'define', 'classify', 'compare', 'demonstrate', 'use',
    'practice', 'produce', 'write', 'read', 'speak', 'listen', 'match',
    'complete', 'role-play', 'discuss', 'present', 'summarize', 'recall',
]);

const LEVEL_VOCAB_RANGES: Record<string, [number, number]> = {
    'Pre-A1': [3, 6],
    'A1': [5, 8],
    'Beginner': [5, 8],
    'A2': [6, 10],
    'B1': [8, 12],
    'B2': [10, 15],
    'C1': [12, 18],
    'C2': [15, 22],
};

function getVocabRange(level: string): [number, number] {
    for (const [key, range] of Object.entries(LEVEL_VOCAB_RANGES)) {
        if (level.toLowerCase().includes(key.toLowerCase())) return range;
    }
    return [5, 12]; // fallback
}

function parseTiming(timing: string): number {
    const match = timing.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
}

let idCounter = 0;
function makeId(): string {
    return `review-${Date.now()}-${idCounter++}`;
}

// ---------- dimension checks ----------

function checkLessonDetails(content: GeneratedContent): ReviewItem[] {
    const items: ReviewItem[] = [];
    const plan = content.structuredLessonPlan;
    const details = plan?.lessonDetails;
    if (!details) {
        items.push({ id: makeId(), section: 'Lesson Details', severity: 'error', issue: '课程详情缺失', suggestion: '请检查生成内容，lessonDetails 字段为空。' });
        return items;
    }

    // Check objectives have measurable verbs
    if (!details.objectives || details.objectives.length === 0) {
        items.push({ id: makeId(), section: 'Lesson Details', severity: 'error', issue: '缺少教学目标', suggestion: '请添加至少 2-3 条可衡量的教学目标。', field: 'objectives' });
    } else {
        details.objectives.forEach((obj, i) => {
            const words = obj.toLowerCase().split(/\s+/);
            const hasVerb = words.some(w => BLOOM_VERBS.has(w));
            if (!hasVerb) {
                items.push({
                    id: makeId(), section: 'Lesson Details', severity: 'warning',
                    issue: `目标 ${i + 1} 缺少可衡量的行为动词`,
                    suggestion: `"${obj.slice(0, 60)}..." — 建议使用 identify / describe / produce / compare 等可衡量动词开头。`,
                    field: 'objectives',
                });
            }
        });
    }

    // Check aim
    if (!details.aim?.trim()) {
        items.push({ id: makeId(), section: 'Lesson Details', severity: 'warning', issue: '教学目的 (aim) 为空', suggestion: '请填写一句话概括本课的核心目的。', field: 'aim' });
    }

    return items;
}

function checkVocabulary(content: GeneratedContent, level: string): ReviewItem[] {
    const items: ReviewItem[] = [];
    const vocab = content.structuredLessonPlan?.lessonDetails?.targetVocab;
    if (!vocab || vocab.length === 0) {
        items.push({ id: makeId(), section: 'Vocabulary', severity: 'warning', issue: '未设定目标词汇', suggestion: '建议至少添加 5 个目标词汇。', field: 'targetVocab' });
        return items;
    }

    const [min, max] = getVocabRange(level);
    if (vocab.length < min) {
        items.push({ id: makeId(), section: 'Vocabulary', severity: 'info', issue: `词汇量偏少 (${vocab.length} 词)`, suggestion: `${level} 级别建议 ${min}-${max} 词，当前仅 ${vocab.length} 词。` });
    } else if (vocab.length > max) {
        items.push({ id: makeId(), section: 'Vocabulary', severity: 'warning', issue: `词汇量过多 (${vocab.length} 词)`, suggestion: `${level} 级别建议 ${min}-${max} 词，当前 ${vocab.length} 词，学生可能难以吸收。` });
    }

    // Check for duplicates
    const seen = new Set<string>();
    const duplicates: string[] = [];
    vocab.forEach(v => {
        const w = v.word?.toLowerCase().trim();
        if (seen.has(w)) duplicates.push(v.word);
        else seen.add(w);
    });
    if (duplicates.length > 0) {
        items.push({ id: makeId(), section: 'Vocabulary', severity: 'warning', issue: `词汇重复: ${duplicates.join(', ')}`, suggestion: '请移除重复词汇。' });
    }

    // Check definitions
    const noDefinition = vocab.filter(v => !v.definition?.trim());
    if (noDefinition.length > 0) {
        items.push({ id: makeId(), section: 'Vocabulary', severity: 'info', issue: `${noDefinition.length} 个词缺少释义`, suggestion: `这些词没有释义: ${noDefinition.map(v => v.word).join(', ')}` });
    }

    return items;
}

function checkStageTiming(content: GeneratedContent): ReviewItem[] {
    const items: ReviewItem[] = [];
    const stages = content.structuredLessonPlan?.stages;
    if (!stages || stages.length === 0) {
        items.push({ id: makeId(), section: 'Stage Timing', severity: 'error', issue: '缺少教学阶段', suggestion: '请检查生成内容，stages 数组为空。' });
        return items;
    }

    let totalTime = 0;
    stages.forEach((stage, i) => {
        const mins = parseTiming(stage.timing);
        totalTime += mins;
        if (mins > 0 && mins < 3) {
            items.push({
                id: makeId(), section: `Stage ${i + 1}: ${stage.stage}`, severity: 'warning',
                issue: `时长过短 (${mins}min)`, suggestion: '少于 3 分钟的阶段难以有效执行，建议合并到相邻阶段。',
                stageIndex: i,
            });
        }
        if (mins > 20) {
            items.push({
                id: makeId(), section: `Stage ${i + 1}: ${stage.stage}`, severity: 'warning',
                issue: `时长过长 (${mins}min)`, suggestion: '超过 20 分钟的阶段容易导致学生注意力下降，建议拆分为两个子阶段。',
                stageIndex: i,
            });
        }
    });

    return items;
}

function checkInteraction(content: GeneratedContent): ReviewItem[] {
    const items: ReviewItem[] = [];
    const stages = content.structuredLessonPlan?.stages;
    if (!stages || stages.length < 2) return items;

    const interactions = stages.map(s => (s.interaction || '').toLowerCase());
    const teacherFronted = interactions.filter(i => i.includes('t-s') || i.includes('teacher') || i === 'whole class' || i === 'lockstep').length;
    const ratio = teacherFronted / interactions.length;

    if (ratio > 0.7 && stages.length >= 4) {
        items.push({
            id: makeId(), section: 'Interaction Pattern', severity: 'warning',
            issue: `${teacherFronted}/${stages.length} 阶段为 T→S 模式 (${Math.round(ratio * 100)}%)`,
            suggestion: '建议增加 pair work / group work 环节，提高学生互动比例。',
        });
    }

    const hasPairOrGroup = interactions.some(i => i.includes('pair') || i.includes('group') || i.includes('s-s'));
    if (!hasPairOrGroup && stages.length >= 3) {
        items.push({
            id: makeId(), section: 'Interaction Pattern', severity: 'info',
            issue: '全程无 pair work 或 group work',
            suggestion: '建议在 Practice 或 Production 阶段加入学生之间的互动。',
        });
    }

    return items;
}

function checkActivityAlignment(content: GeneratedContent): ReviewItem[] {
    const items: ReviewItem[] = [];
    const stages = content.structuredLessonPlan?.stages;
    if (!stages) return items;

    stages.forEach((stage, i) => {
        if (!stage.teacherActivity?.trim() && !stage.studentActivity?.trim()) {
            items.push({
                id: makeId(), section: `Stage ${i + 1}: ${stage.stage}`, severity: 'error',
                issue: '缺少教师/学生活动描述',
                suggestion: '请填写该阶段的 Teacher Activity 和 Student Activity。',
                stageIndex: i, field: 'teacherActivity',
            });
        } else if (stage.teacherActivity?.trim() && !stage.studentActivity?.trim()) {
            items.push({
                id: makeId(), section: `Stage ${i + 1}: ${stage.stage}`, severity: 'warning',
                issue: '缺少学生活动描述',
                suggestion: '只有教师活动没有学生活动，请补充该阶段学生具体做什么。',
                stageIndex: i, field: 'studentActivity',
            });
        }
    });

    return items;
}

function checkAnticipatedProblems(content: GeneratedContent): ReviewItem[] {
    const items: ReviewItem[] = [];
    const problems = content.structuredLessonPlan?.lessonDetails?.anticipatedProblems;
    if (!problems || problems.length === 0) {
        items.push({
            id: makeId(), section: 'Anticipated Problems', severity: 'info',
            issue: '未列出预期困难',
            suggestion: '建议至少列出 2-3 个学生可能遇到的困难及对应解决方案。',
            field: 'anticipatedProblems',
        });
    } else {
        const noSolution = problems.filter(p => !p.solution?.trim());
        if (noSolution.length > 0) {
            items.push({
                id: makeId(), section: 'Anticipated Problems', severity: 'warning',
                issue: `${noSolution.length} 个问题缺少解决方案`,
                suggestion: '每个预期困难都应有对应的解决方案。',
            });
        }
    }
    return items;
}

function checkMaterials(content: GeneratedContent): ReviewItem[] {
    const items: ReviewItem[] = [];

    if (!content.slides || content.slides.length === 0) {
        items.push({ id: makeId(), section: 'Materials', severity: 'info', issue: '未生成幻灯片', suggestion: '当前 Kit 没有 slides 内容。' });
    }
    if (!content.flashcards || content.flashcards.length === 0) {
        items.push({ id: makeId(), section: 'Materials', severity: 'info', issue: '未生成闪卡', suggestion: '当前 Kit 没有 flashcards。' });
    }
    if (content.worksheets && content.worksheets.length > 0) {
        content.worksheets.forEach((ws, wi) => {
            const allItems = ws.sections?.flatMap(s => s.items) || ws.items || [];
            const noAnswer = allItems.filter(item => !item.answer?.trim());
            if (noAnswer.length > 0) {
                items.push({
                    id: makeId(), section: `Worksheet: ${ws.title || `#${wi + 1}`}`, severity: 'warning',
                    issue: `${noAnswer.length}/${allItems.length} 题缺少答案`,
                    suggestion: '请补充练习题答案，便于教师核对。',
                });
            }
        });
    }

    return items;
}

function checkAssessment(content: GeneratedContent): ReviewItem[] {
    const items: ReviewItem[] = [];
    const stages = content.structuredLessonPlan?.stages;
    if (!stages || stages.length === 0) return items;

    const last = stages[stages.length - 1];
    const lastTwoStages = stages.slice(-2);
    const hasAssessment = lastTwoStages.some(s => {
        const combined = `${s.stage} ${s.stageAim} ${s.teacherActivity} ${s.studentActivity}`.toLowerCase();
        return /assess|check|quiz|exit ticket|formative|evaluation|wrap.?up.*check|review.*learn/i.test(combined);
    });

    if (!hasAssessment) {
        items.push({
            id: makeId(), section: 'Assessment', severity: 'warning',
            issue: '课程缺少形成性评估',
            suggestion: '建议在最后阶段加入 exit ticket 或 formative check，确认学生是否达成教学目标。',
        });
    }

    return items;
}

// ---------- main entry ----------

export function runStaticReview(content: GeneratedContent, level: string): ReviewItem[] {
    if (!content?.structuredLessonPlan) return [];

    idCounter = 0;
    const all: ReviewItem[] = [
        ...checkLessonDetails(content),
        ...checkVocabulary(content, level),
        ...checkStageTiming(content),
        ...checkInteraction(content),
        ...checkActivityAlignment(content),
        ...checkAnticipatedProblems(content),
        // Fix J: Skip materials check for plan_only records (empty slides/flashcards are expected)
        ...(content.generationPhase === 'plan_only' ? [] : checkMaterials(content)),
        ...checkAssessment(content),
    ];

    return all;
}

/**
 * Summary counts for display
 */
export function reviewSummary(items: ReviewItem[]): { pass: number; info: number; warning: number; error: number } {
    return {
        pass: items.filter(i => i.severity === 'pass').length,
        info: items.filter(i => i.severity === 'info').length,
        warning: items.filter(i => i.severity === 'warning').length,
        error: items.filter(i => i.severity === 'error').length,
    };
}
