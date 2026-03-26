/**
 * Phase 2: Generate downstream content (handbook, supplies, imagePrompts, etc.)
 * from a completed Phase 1 roadmap.
 *
 * This service reconstructs LessonInput from _inputSnapshot so handbook rules
 * remain consistent with initial generation settings.
 */

import type { InputSnapshot, LessonInput, LessonPlanResponse, HandbookPage, SupplyList } from '../../types';
import { getDefaultPageConfig, getTotalPages } from '../../constants/handbookDefaults';
import { buildHandbookRules, buildFamilyModeRules, resolvePageConfig } from './handbookRules';
import { downstreamSchema } from './curriculumSchemas';
import { createAIClient, retryAICall as retryOperation } from '@pathway/ai';

export interface DownstreamResult {
    handbook: HandbookPage[];
    supplies: SupplyList;
    imagePrompts: string[];
    notebookLMPrompt: string;
    handbookStylePrompt: string;
    teacherContentPrompt?: string;
}

function buildRoadmapTableOfContents(roadmap: LessonPlanResponse['roadmap'], isCN: boolean): string {
    if (!Array.isArray(roadmap) || roadmap.length === 0) {
        return isCN
            ? '本次活动阶段总览：\n1. 活动导入\n2. 核心探索\n3. 总结分享'
            : 'Activity Roadmap Overview:\n1. Warm-up\n2. Core Exploration\n3. Reflection & Share';
    }

    const lines = roadmap.map((item, idx) => {
        const phase = (item.phase || '').trim() || (isCN ? `阶段${idx + 1}` : `Phase ${idx + 1}`);
        const activity = (item.activity || '').trim() || (isCN ? '活动' : 'Activity');
        const time = (item.timeRange || '').trim();
        if (isCN) {
            return `${idx + 1}. ${phase}：${activity}${time ? `（${time}）` : ''}`;
        }
        return `${idx + 1}. ${phase}: ${activity}${time ? ` (${time})` : ''}`;
    });

    return isCN
        ? `本次活动阶段路线图（非页码目录）：\n${lines.join('\n')}\n\n请按阶段顺序开展活动。`
        : `Workshop Stage Roadmap (not a page index):\n${lines.join('\n')}\n\nFollow the stage sequence during delivery.`;
}

function normalizeTableOfContentsPages(
    result: DownstreamResult,
    roadmap: LessonPlanResponse['roadmap'],
    isCN: boolean,
): DownstreamResult {
    const tocContent = buildRoadmapTableOfContents(roadmap, isCN);
    return {
        ...result,
        handbook: result.handbook.map((page) => {
            if (page.section !== 'Table of Contents') return page;
            return {
                ...page,
                title: isCN ? '目录' : 'Table of Contents',
                contentPrompt: tocContent,
                teacherContentPrompt: isCN
                    ? '快速浏览活动阶段并确认教学顺序，不需要逐页页码定位。'
                    : 'Use this as a quick stage roadmap; no per-page number indexing is needed.',
            };
        }),
    };
}

const FIXED_SECTION_COUNTS: Record<'Cover' | 'Certificate' | 'Back Cover', number> = {
    Cover: 1,
    Certificate: 1,
    'Back Cover': 1,
};

const SECTION_ALIAS_MAP: Array<{ section: HandbookPage['section']; aliases: string[] }> = [
    { section: 'Cover', aliases: ['cover', 'front cover', '封面', '封皮'] },
    { section: 'Table of Contents', aliases: ['table of contents', 'contents', 'toc', '目录', '目錄'] },
    { section: 'Safety', aliases: ['safety', 'safety rules', '安全', '安全守则', '安全須知', '安全须知'] },
    { section: 'Prop Checklist', aliases: ['prop checklist', 'materials checklist', 'material checklist', 'checklist', '道具清单', '材料清单', '物料清单'] },
    { section: 'Phase Transition', aliases: ['phase transition', 'transition', '过渡', '阶段过渡', '轉場', '转场'] },
    { section: 'Background Knowledge', aliases: ['background knowledge', 'background info', '背景知识', '背景信息'] },
    { section: 'Activity/Worksheet', aliases: ['activity worksheet', 'activity/worksheet', 'worksheet', '任务单', '活动工作表', '活动/工作表'] },
    { section: 'Reading', aliases: ['reading', '阅读', '閱讀'] },
    { section: 'Instructions', aliases: ['instructions', 'instruction', '步骤说明', '说明', '指引'] },
    { section: 'Reflection', aliases: ['reflection', 'reflect', '反思', '总结', '總結'] },
    { section: 'Certificate', aliases: ['certificate', 'certification', '证书', '證書'] },
    { section: 'Back Cover', aliases: ['back cover', 'backcover', '封底'] },
];

function normalizeSectionToken(value: string | undefined): string {
    return (value || '')
        .toLowerCase()
        .replace(/[_-]/g, ' ')
        .replace(/[^\w\u4e00-\u9fff\s/]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function canonicalizeSection(section: string | undefined, title?: string): HandbookPage['section'] | string {
    const sectionToken = normalizeSectionToken(section);
    const titleToken = normalizeSectionToken(title);

    const exactKnownSections = new Set<HandbookPage['section']>([
        'Introduction',
        'Cover',
        'Table of Contents',
        'Safety',
        'Prop Checklist',
        'Phase Transition',
        'Background Knowledge',
        'Reading',
        'Instructions',
        'Activity/Worksheet',
        'Reflection',
        'Certificate',
        'Back Cover',
    ]);
    if (section && exactKnownSections.has(section as HandbookPage['section'])) {
        return section as HandbookPage['section'];
    }

    for (const row of SECTION_ALIAS_MAP) {
        if (row.aliases.some((alias) => sectionToken === alias || sectionToken.includes(alias))) {
            return row.section;
        }
    }
    for (const row of SECTION_ALIAS_MAP) {
        if (row.aliases.some((alias) => titleToken === alias || titleToken.includes(alias))) {
            return row.section;
        }
    }

    // Best-effort fallback for generic "front/back matter" sections.
    if (sectionToken === 'front matter' || sectionToken === 'frontmatter') return 'Cover';
    if (sectionToken === 'back matter' || sectionToken === 'backmatter') return 'Back Cover';

    return section || '';
}

function normalizeHandbookSections(result: DownstreamResult): DownstreamResult {
    return {
        ...result,
        handbook: (result.handbook || []).map((page) => ({
            ...page,
            section: canonicalizeSection(page.section, page.title) as HandbookPage['section'],
        })),
    };
}

function pickFirstIndex(pages: HandbookPage[], sections: Array<HandbookPage['section'] | string>): number {
    const wanted = new Set(sections);
    return pages.findIndex((p) => wanted.has(p.section));
}

function pickLastIndex(pages: HandbookPage[], sections: Array<HandbookPage['section'] | string>): number {
    const wanted = new Set(sections);
    for (let i = pages.length - 1; i >= 0; i--) {
        if (wanted.has(pages[i].section)) return i;
    }
    return -1;
}

function repairFixedSystemPages(result: DownstreamResult, isCN: boolean): DownstreamResult {
    const pages = [...(result.handbook || [])];
    if (pages.length === 0) return result;

    const count = (section: HandbookPage['section']) => countSection(pages, section);
    const reserved = new Set<number>();
    const reserve = (idx: number) => {
        if (idx >= 0 && idx < pages.length) reserved.add(idx);
    };
    const pickLastSystemIndex = () => {
        for (let i = pages.length - 1; i >= 0; i--) {
            if (reserved.has(i)) continue;
            const section = pages[i].section as HandbookPage['section'];
            if (!PHASE_BOUND_SECTIONS.has(section)) return i;
        }
        return -1;
    };

    // Cover fallback: prefer Introduction/Front matter-like system page, then first page.
    if (count('Cover') === 0) {
        let idx = pickFirstIndex(pages, ['Introduction', 'Table of Contents', 'Safety', 'Prop Checklist']);
        if (idx < 0 || reserved.has(idx)) {
            idx = pages.findIndex((p, i) => !reserved.has(i) && !PHASE_BOUND_SECTIONS.has(p.section as HandbookPage['section']));
        }
        if (idx < 0) idx = 0;
        pages[idx] = {
            ...pages[idx],
            section: 'Cover',
            title: pages[idx].title || (isCN ? '封面' : 'Cover'),
            phaseIndex: undefined,
        };
        reserve(idx);
    }

    // Certificate fallback: prefer end-system pages, then penultimate page.
    if (count('Certificate') === 0) {
        let idx = pickLastIndex(pages, ['Reflection', 'Back Cover', 'Table of Contents', 'Safety', 'Prop Checklist']);
        if (idx < 0 || reserved.has(idx)) {
            idx = pickLastSystemIndex();
        }
        if (idx < 0) {
            idx = Math.max(0, pages.length - 2);
            if (reserved.has(idx)) {
                idx = Math.max(0, pages.length - 1);
            }
        }
        pages[idx] = {
            ...pages[idx],
            section: 'Certificate',
            title: pages[idx].title || (isCN ? '证书' : 'Certificate'),
            phaseIndex: undefined,
        };
        reserve(idx);
    }

    // Back cover fallback: prefer last system page, then final page.
    if (count('Back Cover') === 0) {
        let idx = pickLastIndex(pages, ['Reflection', 'Certificate', 'Table of Contents', 'Safety', 'Prop Checklist']);
        if (idx < 0 || reserved.has(idx)) {
            idx = pickLastSystemIndex();
        }
        if (idx < 0) {
            idx = pages.length - 1;
            if (reserved.has(idx)) {
                idx = Math.max(0, pages.length - 2);
            }
        }
        pages[idx] = {
            ...pages[idx],
            section: 'Back Cover',
            title: pages[idx].title || (isCN ? '封底' : 'Back Cover'),
            phaseIndex: undefined,
        };
    }

    return {
        ...result,
        handbook: pages,
    };
}

function enforceFixedSectionsHard(result: DownstreamResult): DownstreamResult {
    const pages = [...(result.handbook || [])];
    if (pages.length === 0) return result;

    const has = (section: HandbookPage['section']) => pages.some((p) => p.section === section);
    const forceSet = (idx: number, section: HandbookPage['section'], fallbackTitle: string) => {
        const safe = Math.max(0, Math.min(idx, pages.length - 1));
        pages[safe] = {
            ...pages[safe],
            section,
            title: pages[safe]?.title || fallbackTitle,
            phaseIndex: undefined,
        };
    };

    if (!has('Cover')) {
        forceSet(0, 'Cover', 'Cover');
    }

    if (!has('Back Cover')) {
        forceSet(pages.length - 1, 'Back Cover', 'Back Cover');
    }

    if (!has('Certificate')) {
        let certIdx = pages.length > 1 ? pages.length - 2 : 0;
        if (certIdx === 0 && pages.length > 2 && pages[0]?.section === 'Cover') {
            certIdx = 1;
        }
        if (certIdx === pages.length - 1 && pages.length > 1) {
            certIdx = pages.length - 2;
        }
        forceSet(certIdx, 'Certificate', 'Certificate');
    }

    return {
        ...result,
        handbook: pages,
    };
}

function enforceSystemSectionsFromPlan(
    result: DownstreamResult,
    phasePlan?: InputSnapshot['handbookPhasePagePlan'],
): DownstreamResult {
    if (!phasePlan) return result;
    const pages = [...(result.handbook || [])];
    if (pages.length === 0) return result;

    const systemSections: HandbookPage['section'][] = [
        'Table of Contents',
        'Safety',
        'Prop Checklist',
        'Reflection',
    ];
    const expected: Record<HandbookPage['section'], number> = {
        'Table of Contents': phasePlan.systemPages.tableOfContents,
        Safety: phasePlan.systemPages.safety,
        'Prop Checklist': phasePlan.systemPages.propChecklist,
        Reflection: phasePlan.systemPages.reflection,
    } as Record<HandbookPage['section'], number>;
    const fixed = new Set<HandbookPage['section']>(['Cover', 'Certificate', 'Back Cover']);
    const used = new Set<number>();
    const currentCount = (section: HandbookPage['section']) => countSection(pages, section);
    const buildPhaseSurplusPool = (): number[] => {
        const pool: number[] = [];
        for (const row of phasePlan.phasePages) {
            const pickSurplusIndexes = (section: HandbookPage['section'], expected: number) => {
                if (expected < 0) return;
                const indexes = pages
                    .map((p, i) => ({ p, i }))
                    .filter(({ p }) => p.phaseIndex === row.phaseIndex && p.section === section)
                    .map(({ i }) => i);
                const surplus = Math.max(0, indexes.length - expected);
                if (surplus > 0) {
                    indexes.reverse().slice(0, surplus).forEach((i) => pool.push(i));
                }
            };

            pickSurplusIndexes('Background Knowledge', row.backgroundKnowledge);
            pickSurplusIndexes('Activity/Worksheet', row.activityWorksheet);
            pickSurplusIndexes('Reading', row.reading);

            const transitionIndexes = pages
                .map((p, i) => ({ p, i }))
                .filter(
                    ({ p }) =>
                        p.phaseIndex === row.phaseIndex &&
                        (p.section === 'Phase Transition' || p.section === 'Instructions'),
                )
                .map(({ i }) => i);
            const transitionSurplus = Math.max(0, transitionIndexes.length - row.phaseTransition);
            if (transitionSurplus > 0) {
                transitionIndexes.reverse().slice(0, transitionSurplus).forEach((i) => pool.push(i));
            }
        }
        return pool;
    };

    // Step 1: collect reassignable surplus from system sections
    const surplusPool: number[] = [];
    for (const section of systemSections) {
        const actual = currentCount(section);
        const need = expected[section];
        const surplus = Math.max(0, actual - need);
        if (!surplus) continue;
        const idxs = pages
            .map((p, i) => ({ p, i }))
            .filter(({ p }) => p.section === section)
            .map(({ i }) => i)
            .reverse()
            .slice(0, surplus);
        idxs.forEach((i) => surplusPool.push(i));
    }

    // Step 2: fill deficits using surplus first
    const fillOne = (target: HandbookPage['section'], idx: number) => {
        if (idx < 0 || idx >= pages.length) return;
        pages[idx] = {
            ...pages[idx],
            section: target,
            phaseIndex: undefined,
            title: pages[idx].title || target,
        };
        used.add(idx);
    };

    for (const target of systemSections) {
        while (currentCount(target) < expected[target] && surplusPool.length > 0) {
            const idx = surplusPool.shift()!;
            if (used.has(idx)) continue;
            fillOne(target, idx);
        }
    }

    // Step 3: if still short, borrow neutral system pages (non-fixed, non-phase-bound)
    const neutralCandidates = () =>
        pages
            .map((p, i) => ({ p, i }))
            .filter(({ p, i }) =>
                !used.has(i) &&
                !fixed.has(p.section as HandbookPage['section']) &&
                !systemSections.includes(p.section as HandbookPage['section']) &&
                !PHASE_BOUND_SECTIONS.has(p.section as HandbookPage['section']))
            .map(({ i }) => i);

    for (const target of systemSections) {
        while (currentCount(target) < expected[target]) {
            const idx = neutralCandidates()[0];
            if (idx === undefined) break;
            fillOne(target, idx);
        }
    }

    // Step 4: if still short, borrow from phase pages that are currently above phase-plan quota.
    const phaseSurplusPool = buildPhaseSurplusPool();
    for (const target of systemSections) {
        while (currentCount(target) < expected[target] && phaseSurplusPool.length > 0) {
            const idx = phaseSurplusPool.shift()!;
            if (used.has(idx)) continue;
            if (fixed.has(pages[idx].section as HandbookPage['section'])) continue;
            fillOne(target, idx);
        }
    }

    return {
        ...result,
        handbook: pages,
    };
}

const PHASE_BOUND_SECTIONS = new Set<HandbookPage['section']>([
    'Phase Transition',
    'Background Knowledge',
    'Activity/Worksheet',
    'Reading',
    'Instructions',
]);

function normalizePhaseIndexes(
    result: DownstreamResult,
    roadmapLength: number,
): DownstreamResult {
    if (!Array.isArray(result.handbook) || roadmapLength <= 0) return result;

    const toInt = (value: unknown): number | null => {
        if (typeof value === 'number' && Number.isInteger(value)) return value;
        if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value.trim());
        return null;
    };

    const phasePages = result.handbook.filter((p) => PHASE_BOUND_SECTIONS.has(p.section));
    const numericIndexes = phasePages
        .map((p) => toInt((p as any).phaseIndex))
        .filter((idx): idx is number => idx !== null);

    if (numericIndexes.length === 0) return result;

    const hasZero = numericIndexes.some((idx) => idx === 0);
    const hasRoadmapLength = numericIndexes.some((idx) => idx === roadmapLength);
    const allWithinOneBased = numericIndexes.every((idx) => idx >= 1 && idx <= roadmapLength);
    const likelyOneBased = !hasZero && hasRoadmapLength && allWithinOneBased;

    const normalizeIndex = (idx: number): number => {
        if (likelyOneBased) return idx - 1;
        if (idx < 0) return 0;
        if (idx >= roadmapLength && idx <= roadmapLength + 1) return roadmapLength - 1;
        return idx;
    };

    return {
        ...result,
        handbook: result.handbook.map((page) => {
            if (!PHASE_BOUND_SECTIONS.has(page.section)) return page;
            const raw = toInt((page as any).phaseIndex);
            if (raw === null) return page;
            return {
                ...page,
                phaseIndex: normalizeIndex(raw),
            };
        }),
    };
}

const PHASE_PAGE_SECTION_ORDER: Array<'Background Knowledge' | 'Activity/Worksheet' | 'Reading' | 'Phase Transition'> = [
    'Background Knowledge',
    'Activity/Worksheet',
    'Reading',
    'Phase Transition',
];

const SYSTEM_PAGE_SECTION_ORDER: Array<'Table of Contents' | 'Safety' | 'Prop Checklist'> = [
    'Table of Contents',
    'Safety',
    'Prop Checklist',
];

interface PhasePageBlueprintItem {
    pageNumber: number;
    section: HandbookPage['section'];
    phaseIndex?: number;
}

function buildPhasePageBlueprint(
    phasePlan: InputSnapshot['handbookPhasePagePlan'],
): PhasePageBlueprintItem[] {
    if (!phasePlan) return [];
    const items: PhasePageBlueprintItem[] = [];
    let pageNumber = 1;
    const push = (section: HandbookPage['section'], count: number, phaseIndex?: number) => {
        const safeCount = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
        for (let i = 0; i < safeCount; i++) {
            items.push({
                pageNumber,
                section,
                phaseIndex,
            });
            pageNumber += 1;
        }
    };

    // Front fixed + system
    push('Cover', 1);
    for (const section of SYSTEM_PAGE_SECTION_ORDER) {
        if (section === 'Table of Contents') push(section, phasePlan.systemPages.tableOfContents);
        if (section === 'Safety') push(section, phasePlan.systemPages.safety);
        if (section === 'Prop Checklist') push(section, phasePlan.systemPages.propChecklist);
    }

    // Per-phase content
    const sorted = [...phasePlan.phasePages].sort((a, b) => a.phaseIndex - b.phaseIndex);
    for (const row of sorted) {
        for (const section of PHASE_PAGE_SECTION_ORDER) {
            if (section === 'Background Knowledge') push(section, row.backgroundKnowledge, row.phaseIndex);
            if (section === 'Activity/Worksheet') push(section, row.activityWorksheet, row.phaseIndex);
            if (section === 'Reading') push(section, row.reading, row.phaseIndex);
            if (section === 'Phase Transition') push(section, row.phaseTransition, row.phaseIndex);
        }
    }

    // Back system + fixed
    push('Reflection', phasePlan.systemPages.reflection);
    push('Certificate', 1);
    push('Back Cover', 1);

    return items;
}

function matchSlotBySection(page: HandbookPage, slot: PhasePageBlueprintItem): boolean {
    if (slot.section === 'Phase Transition') {
        return page.section === 'Phase Transition' || page.section === 'Instructions';
    }
    return page.section === slot.section;
}

function alignHandbookToPhaseBlueprint(
    result: DownstreamResult,
    phasePlan?: InputSnapshot['handbookPhasePagePlan'],
): DownstreamResult {
    if (!phasePlan) return result;
    const blueprint = buildPhasePageBlueprint(phasePlan);
    if (blueprint.length === 0) return result;
    const sourcePages = [...(result.handbook || [])];
    if (sourcePages.length === 0) return result;

    const used = new Set<number>();
    const pickPageIndex = (slot: PhasePageBlueprintItem): number => {
        const exact = sourcePages.findIndex((page, idx) => {
            if (used.has(idx)) return false;
            if (!matchSlotBySection(page, slot)) return false;
            if (slot.phaseIndex === undefined) {
                return page.phaseIndex === undefined || page.phaseIndex === null;
            }
            return page.phaseIndex === slot.phaseIndex;
        });
        if (exact >= 0) return exact;

        const sectionOnly = sourcePages.findIndex((page, idx) => !used.has(idx) && matchSlotBySection(page, slot));
        if (sectionOnly >= 0) return sectionOnly;

        if (slot.phaseIndex !== undefined) {
            const phaseOnly = sourcePages.findIndex((page, idx) => !used.has(idx) && page.phaseIndex === slot.phaseIndex);
            if (phaseOnly >= 0) return phaseOnly;
        }

        return sourcePages.findIndex((_, idx) => !used.has(idx));
    };

    const alignedPages: HandbookPage[] = blueprint.map((slot) => {
        const pickedIndex = pickPageIndex(slot);
        if (pickedIndex < 0) {
            return {
                pageNumber: slot.pageNumber,
                section: slot.section,
                title: slot.section,
                layoutDescription: '',
                visualPrompt: '',
                contentPrompt: '',
                teacherContentPrompt: '',
                phaseIndex: slot.phaseIndex,
            };
        }
        used.add(pickedIndex);
        const base = sourcePages[pickedIndex];
        return {
            ...base,
            pageNumber: slot.pageNumber,
            section: slot.section,
            phaseIndex: slot.phaseIndex,
            title: base.title || slot.section,
        };
    });

    return {
        ...result,
        handbook: alignedPages,
    };
}

/**
 * Final hard-guard: preserve page content order, but force metadata to match
 * the confirmed phase blueprint before strict validation.
 */
function forceApplyBlueprintMeta(
    result: DownstreamResult,
    phasePlan?: InputSnapshot['handbookPhasePagePlan'],
): DownstreamResult {
    if (!phasePlan) return result;
    const blueprint = buildPhasePageBlueprint(phasePlan);
    const pages = [...(result.handbook || [])].sort((a, b) => (a.pageNumber || 0) - (b.pageNumber || 0));
    if (!pages.length || pages.length !== blueprint.length) return result;

    const rewritten = pages.map((page, i) => {
        const slot = blueprint[i];
        return {
            ...page,
            pageNumber: slot.pageNumber,
            section: slot.section,
            phaseIndex: slot.phaseIndex,
        };
    });

    return {
        ...result,
        handbook: rewritten,
    };
}

function countSection(pages: HandbookPage[], section: HandbookPage['section']): number {
    return pages.filter((p) => p.section === section).length;
}

function countPhaseSection(
    pages: HandbookPage[],
    phaseIndex: number,
    section: HandbookPage['section'],
): number {
    return pages.filter((p) => p.phaseIndex === phaseIndex && p.section === section).length;
}

function countPhaseTransitionPages(pages: HandbookPage[], phaseIndex: number): number {
    return pages.filter(
        (p) =>
            p.phaseIndex === phaseIndex &&
            (p.section === 'Phase Transition' || p.section === 'Instructions'),
    ).length;
}

function normalizeTextForDedup(value: string | undefined): string {
    return (value || '')
        .toLowerCase()
        .replace(/[^\w\u4e00-\u9fff\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function validateNoDuplicatePages(pages: HandbookPage[]): string | null {
    const seenContentKey = new Set<string>();
    const seenTitleKey = new Set<string>();

    for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const phaseKey = Number.isInteger(page.phaseIndex) ? String(page.phaseIndex) : 'system';
        const normalizedTitle = normalizeTextForDedup(page.title).slice(0, 120);
        const normalizedContent = normalizeTextForDedup(page.contentPrompt).slice(0, 260);

        if (normalizedContent.length >= 20) {
            const contentKey = `${page.section}|${phaseKey}|${normalizedContent}`;
            if (seenContentKey.has(contentKey)) {
                return `duplicate page content detected near page ${i + 1} for section "${page.section}" (phase=${phaseKey}).`;
            }
            seenContentKey.add(contentKey);
        }

        if (normalizedTitle.length >= 8) {
            const titleKey = `${page.section}|${phaseKey}|${normalizedTitle}`;
            if (seenTitleKey.has(titleKey)) {
                return `duplicate page title detected near page ${i + 1} for section "${page.section}" (phase=${phaseKey}).`;
            }
            seenTitleKey.add(titleKey);
        }
    }

    return null;
}

function validateDownstreamResult(
    result: DownstreamResult,
    handbookPageTarget: number,
    roadmapLength: number,
    phasePlan?: InputSnapshot['handbookPhasePagePlan'],
): string | null {
    if (!Array.isArray(result.handbook)) {
        return 'handbook is missing or not an array.';
    }

    if (result.handbook.length !== handbookPageTarget) {
        return `handbook page count mismatch: expected ${handbookPageTarget}, got ${result.handbook.length}.`;
    }

    const duplicateError = validateNoDuplicatePages(result.handbook);
    if (duplicateError) {
        return duplicateError;
    }

    // Phase-bound pages must carry a valid phaseIndex.
    for (const page of result.handbook) {
        if (!PHASE_BOUND_SECTIONS.has(page.section)) continue;
        const idx = page.phaseIndex;
        if (!Number.isInteger(idx) || idx < 0 || idx >= roadmapLength) {
            return `invalid phaseIndex for "${page.section}" page "${page.title}": got ${String(idx)}, roadmap length=${roadmapLength}.`;
        }
    }

    // System pages must not carry phaseIndex.
    for (const page of result.handbook) {
        if (PHASE_BOUND_SECTIONS.has(page.section)) continue;
        if (page.phaseIndex !== undefined && page.phaseIndex !== null) {
            return `system page "${page.section}" should not have phaseIndex, got ${String(page.phaseIndex)}.`;
        }
    }

    if (!phasePlan) return null;

    const blueprint = buildPhasePageBlueprint(phasePlan);
    if (blueprint.length !== result.handbook.length) {
        return `phase blueprint mismatch: expected ${blueprint.length} slots, got ${result.handbook.length} pages.`;
    }

    const byPageNumber = [...result.handbook].sort((a, b) => (a.pageNumber || 0) - (b.pageNumber || 0));
    for (let i = 0; i < byPageNumber.length; i++) {
        const page = byPageNumber[i];
        const expected = blueprint[i];
        if (page.pageNumber !== expected.pageNumber) {
            return `pageNumber mismatch at index ${i + 1}: expected ${expected.pageNumber}, got ${page.pageNumber}.`;
        }
        if (page.section !== expected.section) {
            return `page ${page.pageNumber} section mismatch: expected "${expected.section}", got "${page.section}".`;
        }
        if (expected.phaseIndex === undefined) {
            if (page.phaseIndex !== undefined && page.phaseIndex !== null) {
                return `page ${page.pageNumber} system section "${page.section}" should not have phaseIndex.`;
            }
        } else if (page.phaseIndex !== expected.phaseIndex) {
            return `page ${page.pageNumber} phaseIndex mismatch: expected ${expected.phaseIndex}, got ${String(page.phaseIndex)}.`;
        }
    }

    // Fixed pages are always strict.
    for (const [section, expected] of Object.entries(FIXED_SECTION_COUNTS) as Array<[keyof typeof FIXED_SECTION_COUNTS, number]>) {
        const actual = countSection(result.handbook, section);
        if (actual !== expected) {
            return `fixed section "${section}" mismatch: expected ${expected}, got ${actual}.`;
        }
    }

    // System page counts from plan.
    const systemChecks: Array<[HandbookPage['section'], number]> = [
        ['Table of Contents', phasePlan.systemPages.tableOfContents],
        ['Safety', phasePlan.systemPages.safety],
        ['Prop Checklist', phasePlan.systemPages.propChecklist],
        ['Reflection', phasePlan.systemPages.reflection],
    ];
    for (const [section, expected] of systemChecks) {
        const actual = countSection(result.handbook, section);
        if (actual !== expected) {
            return `system section "${section}" mismatch: expected ${expected}, got ${actual}.`;
        }
    }

    // Per-phase strict allocation.
    for (const row of phasePlan.phasePages) {
        if (row.phaseIndex < 0 || row.phaseIndex >= roadmapLength) {
            return `phase plan contains out-of-range phaseIndex=${row.phaseIndex}, roadmap length=${roadmapLength}.`;
        }

        const expectedPairs: Array<[HandbookPage['section'], number]> = [
            ['Background Knowledge', row.backgroundKnowledge],
            ['Activity/Worksheet', row.activityWorksheet],
            ['Reading', row.reading],
        ];
        for (const [section, expected] of expectedPairs) {
            const actual = countPhaseSection(result.handbook, row.phaseIndex, section);
            if (actual !== expected) {
                return `phase ${row.phaseIndex + 1} "${section}" mismatch: expected ${expected}, got ${actual}.`;
            }
        }
        const transitionActual = countPhaseTransitionPages(result.handbook, row.phaseIndex);
        if (transitionActual !== row.phaseTransition) {
            return `phase ${row.phaseIndex + 1} "Phase Transition" mismatch: expected ${row.phaseTransition}, got ${transitionActual}.`;
        }

        const learningPages =
            countPhaseSection(result.handbook, row.phaseIndex, 'Activity/Worksheet') +
            countPhaseSection(result.handbook, row.phaseIndex, 'Reading');
        if (learningPages < 1) {
            return `phase ${row.phaseIndex + 1} has no Activity/Worksheet or Reading page.`;
        }
    }

    return null;
}

/** Reconstruct a minimal LessonInput from InputSnapshot (enough for handbook rules) */
function reconstructInput(snapshot: InputSnapshot): LessonInput {
    return {
        mode: snapshot.mode,
        familyEslEnabled: snapshot.familyEslEnabled ?? false,
        weather: snapshot.weather,
        studentAge: snapshot.studentAge,
        cefrLevel: snapshot.cefrLevel,
        duration: snapshot.duration,
        handbookMode: snapshot.handbookMode,
        handbookPreset: snapshot.handbookPreset ?? 'standard',
        handbookPageConfig: snapshot.handbookPageConfig ?? getDefaultPageConfig(),
        autoPageTarget: snapshot.autoPageTarget,
        handbookPhasePagePlan: snapshot.handbookPhasePagePlan,
        factSheet: snapshot.factSheet,
        factSheetQuality: snapshot.factSheetQuality,
        factSheetSources: snapshot.factSheetSources,
        factSheetMeta: snapshot.factSheetMeta,
        handbookStyleId: snapshot.handbookStyleId,
        customStructure: snapshot.customStructure,
        structuredKnowledge: snapshot.structuredKnowledge,
        // Not needed by handbook rules; safe defaults:
        theme: '',
        topicIntroduction: '',
        activityFocus: [],
        season: 'Spring',
        studentCount: 12,
        uploadedFiles: [],
    };
}

function buildFreshnessBlock(snapshot: InputSnapshot): string {
    if (!snapshot.factSheetMeta) return '';
    return `\n[Freshness Handling]
- Apply cautious wording when source freshness is weak.
- NEVER output freshness metadata in handbook pages:
  do not output risk level, target/effective window, coverage, or "Freshness Risk/Audit" text.
`;
}

function stripFreshnessMarkers(value: string | undefined): string {
    if (!value) return '';
    let cleaned = value;

    const patterns: RegExp[] = [
        /⚠\s*Freshness Risk:[^\n]*/gi,
        /⚠\s*时效风险提示：[^\n]*/g,
        /\[Freshness Risk\]/gi,
        /\[Freshness Audit\]/gi,
        /Theme Freshness Tier:\s*[^\n]*/gi,
        /Target Window:\s*[^\n]*/gi,
        /Effective Window:\s*[^\n]*/gi,
        /Risk Level:\s*[^\n]*/gi,
        /Coverage:\s*[^\n]*/gi,
        /-+\s*Theme tier:\s*[^\n]*/gi,
        /-+\s*Target window:\s*[^\n]*/gi,
        /-+\s*Effective window:\s*[^\n]*/gi,
        /-+\s*Risk level:\s*[^\n]*/gi,
        /-+\s*Coverage:\s*[^\n]*/gi,
        /Some evidence is older than one year; please verify with up-to-date authoritative sources\./gi,
        /部分信息可能不是近一年证据，请教师\/家长结合最新权威信息复核。?/g,
    ];
    for (const pattern of patterns) {
        cleaned = cleaned.replace(pattern, '');
    }

    return cleaned
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
}

function sanitizeFactSheetForPrompt(factSheet: string): string {
    if (!factSheet) return '';
    let cleaned = factSheet;
    cleaned = cleaned.replace(/##\s*FRESHNESS AUDIT[\s\S]*?(?=\n##\s*SOURCES|\n##\s*PART|\Z)/gi, '\n');
    cleaned = stripFreshnessMarkers(cleaned);
    return cleaned.slice(0, 8000);
}

function scrubFreshnessFromHandbookPages(result: DownstreamResult): DownstreamResult {
    if (!Array.isArray(result.handbook)) return result;
    return {
        ...result,
        handbook: result.handbook.map((page) => ({
            ...page,
            title: stripFreshnessMarkers(page.title),
            contentPrompt: stripFreshnessMarkers(page.contentPrompt),
            teacherContentPrompt: stripFreshnessMarkers(page.teacherContentPrompt || ''),
            visualPrompt: stripFreshnessMarkers(page.visualPrompt || ''),
            layoutDescription: stripFreshnessMarkers(page.layoutDescription || ''),
        })),
    };
}

function buildAudienceQualityBlock(isFamily: boolean): string {
    if (isFamily) {
        return `
[Audience Lens - Family Mode]
- teacherContentPrompt is for PARENTS and must be direct read-aloud facilitation script.
- Use exactly three labeled parts:
  1) Do Together
  2) Ask Together
  3) Reflect Together
- Build from roadmap.learningObjective + steps[] + teachingTips[].
- Child-facing Activity/Worksheet and Reading pages should follow:
  Story/Fact -> Mission Task.
- Avoid classroom management wording in family mode child pages.
`;
    }
    return `
[Audience Lens - School Mode]
- teacherContentPrompt is for TEACHERS and must be direct read-aloud classroom script.
- Recommended order:
  Objective -> Opening Script -> Guided Questions (3-5) -> Differentiation and Time Control.
- Student-facing Activity/Worksheet pages must look like task sheets:
  Task Goal, Materials Checklist, Numbered Steps, Response space.
`;
}

function buildRegenerationCommentBlock(regenerationComment?: string): string {
    const comment = (regenerationComment || '').trim();
    if (!comment) return '';
    return `
[Regeneration Comment Priority]
This is a second-pass regeneration request after user review.
Keep the original generation logic and structure unchanged, then apply this comment:
"${comment}"
If there is conflict, preserve hard constraints (page count, phase mapping, schema) first.
`;
}

export async function generateDownstreamContent(
    plan: LessonPlanResponse,
    inputSnapshot: InputSnapshot,
    language: 'en' | 'zh',
    signal?: AbortSignal,
    regenerationComment?: string,
): Promise<DownstreamResult> {
    const ai = createAIClient();
    const input = reconstructInput(inputSnapshot);
    const isCN = language === 'zh';
    const isFamily = input.mode === 'family';

    const phasePlan = inputSnapshot.handbookPhasePagePlan;
    const handbookRules = phasePlan
        ? `
[Handbook Rules - Phase Plan Mode]
- Treat [Phase Page Allocation - STRICT] as the ONLY section/page-count authority.
- Do NOT apply any additional structural distribution from handbookMode/preset/custom config.
- Keep strict roadmap order and bind every phase-bound page to correct phaseIndex.
- For multiple pages under the same phase+section, each page must cover a different subtopic/task.
- NEVER duplicate title or contentPrompt across pages.
- Keep student/teacher boundary strict: contentPrompt = student-facing only; teacherContentPrompt = teacher-facing guidance only.
`
        : buildHandbookRules(input);
    const familyRules = buildFamilyModeRules(input);

    const pageConfig = resolvePageConfig(input);
    const handbookPageTarget = phasePlan?.totalPages ?? (pageConfig
        ? getTotalPages(pageConfig)
        : input.autoPageTarget || (input.duration <= 60 ? 15 : input.duration <= 90 ? 20 : input.duration <= 120 ? 25 : 30));

    const roadmapSummary = plan.roadmap
        .map((r, i) => {
            const bgInfo = r.backgroundInfo?.length
                ? `\n  Background Info: ${r.backgroundInfo.slice(0, 3).join('; ')}`
                : '';
            const actInstr = r.activityInstructions
                ? `\n  Activity Instructions: ${r.activityInstructions.slice(0, 300)}`
                : '';
            const objective = r.learningObjective
                ? `\n  Learning Objective: ${r.learningObjective}`
                : '';
            return `[Phase ${i + 1}] ${r.phase}: ${r.activity} (${r.timeRange})${objective}\n  Description: ${r.description.slice(0, 400)}${bgInfo}${actInstr}`;
        })
        .join('\n\n');

    const groundedFactSheet = inputSnapshot.factSheet ? sanitizeFactSheetForPrompt(inputSnapshot.factSheet) : '';
    const factSheetBlock = groundedFactSheet
        ? `\n[Factual Grounding]
The handbook contentPrompt must stay grounded in this fact sheet. Do not add unsupported facts:
${groundedFactSheet}
${buildFreshnessBlock(inputSnapshot)}`
        : '';

    const structuredOutlineBlock = inputSnapshot.customStructure
        ? `\n[Structured Outline Priority]
The user provided a custom handbook outline.
Preserve section intent and ordering while mapping to roadmap phases.
Custom outline:
${inputSnapshot.customStructure.slice(0, 6000)}
${inputSnapshot.structuredKnowledge?.length
            ? `Preferred reference anchors:
${inputSnapshot.structuredKnowledge.map((k) => `- ${k.topic}`).join('\n')}`
            : ''}\n`
        : '';

    const weatherEnforcementBlock = input.weather === 'Rainy'
        ? `\n[Weather Enforcement]
RAINY scenario: Activity pages must describe indoor-safe execution.
Do not include outdoor-only instructions unless explicitly marked as optional weather-clear extension.`
        : `\n[Weather Enforcement]
SUNNY scenario: prioritize outdoor observation/action in activity pages, with concise safety reminders.`;

    const phaseBlueprint = phasePlan ? buildPhasePageBlueprint(phasePlan) : [];
    const phaseBlueprintLines = phaseBlueprint
        .map((slot) => `- pageNumber=${slot.pageNumber}: ${slot.section}${slot.phaseIndex === undefined ? '' : ` (phaseIndex=${slot.phaseIndex})`}`)
        .join('\n');

    const phasePlanBlock = phasePlan
        ? `\n[Phase Page Allocation - STRICT]
Follow this exact allocation plan.
Total handbook pages must equal ${phasePlan.totalPages}.
Fixed pages are always exactly one each: Cover, Certificate, Back Cover.
System pages:
- Table of Contents: ${phasePlan.systemPages.tableOfContents}
- Safety: ${phasePlan.systemPages.safety}
- Prop Checklist: ${phasePlan.systemPages.propChecklist}
- Reflection: ${phasePlan.systemPages.reflection}
Per-phase pages (phaseIndex is 0-based and must match roadmap order):
${phasePlan.phasePages.map((row) => `- phaseIndex=${row.phaseIndex}: Background Knowledge=${row.backgroundKnowledge}, Activity/Worksheet=${row.activityWorksheet}, Reading=${row.reading}, Phase Transition=${row.phaseTransition}`).join('\n')}
Rules:
1. Do not average pages across phases.
2. Respect each phase explicit counts exactly.
3. Every roadmap phase must have at least one Activity/Worksheet or Reading page.
4. Assign correct phaseIndex for all phase-bound pages.
5. Follow page sequence strictly by pageNumber from 1..N.

[Page Blueprint - STRICT ORDER]
${phaseBlueprintLines}
`
        : '';

    const audienceQualityBlock = buildAudienceQualityBlock(isFamily);
    const regenerationCommentBlock = buildRegenerationCommentBlock(regenerationComment);

    const outputLanguageRule = isCN
        ? 'All user-facing text (contentPrompt, teacherContentPrompt) must be Simplified Chinese. Keep visualPrompt and handbookStylePrompt in English.'
        : 'All user-facing text must be English.';

    const systemInstruction = `You are an educational publisher and curriculum designer.
Generate handbook and supporting downstream content from roadmap.

[Output Language Rule]
${outputLanguageRule}

[Handbook Rules]
${handbookRules}
${isFamily ? familyRules : ''}

[Roadmap Data Mapping]
Use roadmap fields directly:
- description -> Reading / Background Knowledge pages
- backgroundInfo[] -> Background Knowledge factual body
- activityInstructions -> Activity/Worksheet student task text
- steps[] + teachingTips[] + learningObjective -> teacherContentPrompt

[Roadmap Summary]
${roadmapSummary}

[Lesson Info]
- Theme: ${plan.basicInfo.theme}
- Activity Type: ${plan.basicInfo.activityType}
- Target Audience: ${plan.basicInfo.targetAudience}
- Location: ${plan.basicInfo.location}
- Student Age: ${input.studentAge}
- CEFR Level: ${input.cefrLevel}
- Weather: ${input.weather}

${weatherEnforcementBlock}
${audienceQualityBlock}
${regenerationCommentBlock}

[Key Requirements]
1. Strict 1:1 traceable mapping: every roadmap phase must have >=1 Activity/Worksheet or Reading page.
2. Target exactly ${handbookPageTarget} handbook pages.
3. Always include fixed pages exactly once: Cover, Certificate, Back Cover.
4. For Table of Contents / Safety / Prop Checklist / Reflection, follow [Phase Page Allocation - STRICT] counts exactly when provided (count can be 0).
5. contentPrompt must contain only student-facing content text. No layout instructions.
6. teacherContentPrompt must include objective, opening script, 3-5 guided questions, differentiation tips, timing hints. No layout instructions.
7. supplies must include only everyday accessible materials.
8. Back Cover contentPrompt must contain only inspirational quote + brief thank-you. No contact info.
9. No duplicate pages: do not repeat same title/contentPrompt within the same section+phase.
10. Table of Contents rule: show ONLY roadmap stage flow (phase/activity order). Do NOT list every handbook page and do NOT include page-number index lines.

${factSheetBlock}
${structuredOutlineBlock}
${phasePlanBlock}

Return valid JSON matching schema.`;

    return await retryOperation(async () => {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Generate complete handbook and supporting content.

Roadmap Summary:
${roadmapSummary}

Vocabulary:
${JSON.stringify(plan.vocabulary)}

Safety Protocol:
${JSON.stringify(plan.safetyProtocol)}`,
            config: {
                systemInstruction,
                responseMimeType: 'application/json',
                responseSchema: downstreamSchema,
                temperature: 0.5,
                maxOutputTokens: 65536,
            },
        });

        const text = response.text;
        if (!text) throw new Error('Empty response from Gemini during Phase 2 generation');

        let parsed: DownstreamResult;
        try {
            parsed = JSON.parse(text) as DownstreamResult;
        } catch {
            throw new Error(`Phase 2 JSON parse failed (response length=${text.length}). Retrying...`);
        }

        parsed = normalizeHandbookSections(parsed);
        parsed = normalizePhaseIndexes(parsed, plan.roadmap.length);
        parsed = repairFixedSystemPages(parsed, isCN);
        parsed = enforceFixedSectionsHard(parsed);
        parsed = enforceSystemSectionsFromPlan(parsed, phasePlan);
        parsed = normalizeTableOfContentsPages(parsed, plan.roadmap, isCN);
        parsed = enforceFixedSectionsHard(parsed);
        parsed = enforceSystemSectionsFromPlan(parsed, phasePlan);
        parsed = alignHandbookToPhaseBlueprint(parsed, phasePlan);
        parsed = normalizePhaseIndexes(parsed, plan.roadmap.length);
        parsed = normalizeTableOfContentsPages(parsed, plan.roadmap, isCN);
        parsed = scrubFreshnessFromHandbookPages(parsed);
        parsed = forceApplyBlueprintMeta(parsed, phasePlan);

        const validationError = validateDownstreamResult(
            parsed,
            handbookPageTarget,
            plan.roadmap.length,
            phasePlan,
        );
        if (validationError) {
            const fixedSummary = `Cover=${countSection(parsed.handbook, 'Cover')}, Certificate=${countSection(parsed.handbook, 'Certificate')}, BackCover=${countSection(parsed.handbook, 'Back Cover')}`;
            const systemSummary = `ToC=${countSection(parsed.handbook, 'Table of Contents')}, Safety=${countSection(parsed.handbook, 'Safety')}, PropChecklist=${countSection(parsed.handbook, 'Prop Checklist')}, Reflection=${countSection(parsed.handbook, 'Reflection')}`;
            throw new Error(`Phase 2 strict validation failed: ${validationError}. [fixed sections: ${fixedSummary}] [system sections: ${systemSummary}] Retrying...`);
        }

        return parsed;
    }, signal);
}
