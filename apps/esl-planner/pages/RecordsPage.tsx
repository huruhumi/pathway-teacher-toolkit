import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, BookOpen, GraduationCap, Download, Layers, FileText, ChevronRight, FolderOpen, Library, Hash, CheckSquare, Square, FolderPlus, X, FileCheck, Wrench, AlertTriangle, Trash2, Loader2 } from 'lucide-react';
import { RecordCard } from '@shared/components/RecordCard';
import { RecordsTabSwitcher } from '@shared/components/RecordsTabSwitcher';
import { Modal } from '@shared/components/ui/Modal';
import { FilterBar } from '../components/FilterBar';
import { EmptyState } from '@shared/components/EmptyState';
import { handleDownloadZip } from '../utils/exportUtils';
import { useLanguage } from '../i18n/LanguageContext';
import { useToast } from '@shared/stores/useToast';
import type { TeacherReview } from '@shared/types/scoring';
import { assessESLCurriculumQuality } from '@shared/config/recordQuality';
import { findTextbookLevelEntry } from '@shared/config/eslAssessmentRegistry';
import { getCustomTextbookLevelLabel } from '../utils/customTextbookLevels';
import { ImageMigrationButton } from '@shared/components/ImageMigrationButton';

import type { SavedLesson, SavedCurriculum, CurriculumLesson } from '../types';

import { useLessonHistory } from '../hooks/useLessonHistory';
import { useAppStore, useSessionStore } from '../stores/appStore';

export interface RecordsPageProps {
    onGoToCurriculum: () => void;
    onGoToCreate: () => void;
}

function getLessonRiskSignal(lesson: SavedLesson, review?: TeacherReview): { riskScore: number; unresolved: boolean; reasons: string[] } {
    const report = lesson.content?.scoreReport;
    const qualityStatus = lesson.content?.qualityGate?.status;
    const groundingStatus = lesson.content?.groundingStatus;

    let riskScore = 0;
    const reasons: string[] = [];

    if (!report) {
        // Fix I: plan_only records don't have scoreReport yet — don't penalize
        if (lesson.content?.generationPhase === 'plan_only') {
            reasons.push('pending_supporting_content');
        } else {
            riskScore += 25;
            reasons.push('missing_score_report');
        }
    } else if (typeof report.overallScore === 'number') {
        const scoreGap = Math.max(0, 85 - report.overallScore);
        riskScore += Math.min(30, scoreGap);
        if (report.overallScore < 80) reasons.push('low_model_score');
    }

    if (qualityStatus === 'needs_review') {
        riskScore += 20;
        reasons.push('quality_gate_needs_review');
    }
    if (groundingStatus === 'unverified') {
        riskScore += 25;
        reasons.push('grounding_unverified');
    }
    if (report?.reviewerStatus === 'needs_teacher_review') {
        riskScore += 12;
        reasons.push('model_requests_review');
    }
    if (review) {
        if (!review.accepted) {
            riskScore += 15;
            reasons.push('teacher_marked_needs_fix');
        }
        if (
            typeof review.finalScore === 'number'
            && typeof report?.overallScore === 'number'
            && review.finalScore < report.overallScore - 8
        ) {
            riskScore += 8;
            reasons.push('teacher_score_below_model');
        }
    }

    const unresolved = review
        ? !review.accepted
        : (
            qualityStatus === 'needs_review'
            || report?.reviewerStatus === 'needs_teacher_review'
            || (typeof report?.overallScore === 'number' && report.overallScore < 80)
        );

    if (unresolved && reasons.length === 0) {
        reasons.push('pending_manual_review');
    }

    return {
        riskScore: Math.min(100, Math.max(0, Math.round(riskScore))),
        unresolved,
        reasons: Array.from(new Set(reasons)),
    };
}

type LessonRiskCode =
    | 'missing_score_report'
    | 'low_model_score'
    | 'quality_gate_needs_review'
    | 'grounding_unverified'
    | 'model_requests_review'
    | 'teacher_marked_needs_fix'
    | 'teacher_score_below_model'
    | 'pending_manual_review';

type TextbookLevelTreeNode = {
    name: string;
    levels: {
        levelKey: string;
        levelLabel: string;
        curriculumIds: Set<string>;
        units: Map<number, CurriculumLesson[]>;
    }[];
};

function getRiskReasonLabel(code: string): string {
    const mapping: Record<LessonRiskCode, string> = {
        missing_score_report: 'Missing score report',
        low_model_score: 'Low model score',
        quality_gate_needs_review: 'Quality gate: needs review',
        grounding_unverified: 'Notebook grounding unverified',
        model_requests_review: 'Model requests teacher review',
        teacher_marked_needs_fix: 'Teacher marked: needs fix',
        teacher_score_below_model: 'Teacher score is below model score',
        pending_manual_review: 'Pending manual review',
    };
    return mapping[code as LessonRiskCode] || code;
}

export const RecordsPage: React.FC<RecordsPageProps> = ({
    onGoToCurriculum,
    onGoToCreate,
}) => {
    const { lang, t } = useLanguage();
    const { savedCurricula, savedLessons, ...history } = useLessonHistory();
    const { setLoadedCurriculum, setState } = useSessionStore();
    const {
        setActiveLessonId, activeLessonId,
        recordsTab, setRecordsTab,
        curSearch, setCurSearch, curLevel, setCurLevel, curDate, setCurDate, curSort, setCurSort, curLessonRange, setCurLessonRange,
        kitSearch, setKitSearch, kitLevel, setKitLevel, kitDate, setKitDate, kitSort, setKitSort
    } = useAppStore();

    const [isExporting, setIsExporting] = useState<string | null>(null);
    const [expandedRiskId, setExpandedRiskId] = useState<string | null>(null);
    const [isExportingCur, setIsExportingCur] = useState<string | null>(null);
    const [selectedTextbook, setSelectedTextbook] = useState<string | null>(null);
    const [selectedLevelKey, setSelectedLevelKey] = useState<string | null>(null);
    const [selectedUnit, setSelectedUnit] = useState<number | null>(null);
    const [reviewLessonId, setReviewLessonId] = useState<string | null>(null);
    const [reviewAccepted, setReviewAccepted] = useState(true);
    const [reviewFinalScore, setReviewFinalScore] = useState('');
    const [reviewComment, setReviewComment] = useState('');
    const [reviewEditedSections, setReviewEditedSections] = useState<string[]>([]);
    const [riskViewOnly, setRiskViewOnly] = useState(false);
    const [curQuality, setCurQuality] = useState<'all' | 'ok' | 'needs_review'>('all');

    // --- Kit Selection for batch assign ---
    const [selectedKitIds, setSelectedKitIds] = useState<Set<string>>(new Set());
    const [showAssignPicker, setShowAssignPicker] = useState(false);
    const [assignTextbook, setAssignTextbook] = useState<string>('');
    const [assignUnit, setAssignUnit] = useState<number | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeletingBatch, setIsDeletingBatch] = useState(false);

    // Ref to always access latest savedLessons inside async callbacks (avoids stale closure)
    const savedLessonsRef = useRef(savedLessons);
    savedLessonsRef.current = savedLessons;

    const toggleKitSelection = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedKitIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const handleBatchAssign = async () => {
        const isStandalone = assignTextbook === 'Standalone';
        if (!assignTextbook || (!isStandalone && assignUnit === null) || selectedKitIds.size === 0) return;
        const tb = textbookLevelTree.find(t => t.name === assignTextbook);
        if (!tb) return;
        // Collect all curriculumIds from all levels in this textbook
        const allCurriculumIds = new Set<string>();
        tb.levels.forEach(level => level.curriculumIds.forEach(id => allCurriculumIds.add(id)));
        const curriculumId = [...allCurriculumIds][0];
        // For Standalone: no unit structure, use unitNumber 0
        const targetUnit = isStandalone ? 0 : assignUnit!;
        // Determine existing max lessonIndex in target unit for proper ordering
        const existingInUnit = savedLessons.filter(
            l => l.curriculumId === curriculumId && l.unitNumber === targetUnit
        );
        let nextIndex = existingInUnit.reduce((max, l) => Math.max(max, (l.lessonIndex ?? -1) + 1), 0);
        const ops: Promise<unknown>[] = [];
        selectedKitIds.forEach(kitId => {
            const lesson = savedLessons.find(l => l.id === kitId);
            if (lesson) {
                ops.push(history.saveLessonDb({
                    ...lesson,
                    curriculumId,
                    unitNumber: targetUnit,
                    lessonIndex: lesson.lessonIndex ?? nextIndex++,
                    lastModified: Date.now(),
                }));
            }
        });
        await Promise.all(ops);
        useToast.getState().success(
            lang === 'zh'
                ? `已归档 ${ops.length} 个课件到 ${assignTextbook}${isStandalone ? '' : ` Unit ${assignUnit}`}`
                : `Assigned ${ops.length} kit(s) to ${assignTextbook} Unit ${assignUnit}`
        );
        setSelectedKitIds(new Set());
        setShowAssignPicker(false);
        setAssignTextbook('');
        setAssignUnit(null);
    };

    const handleBatchDelete = async () => {
        if (selectedKitIds.size === 0) return;
        setIsDeletingBatch(true);
        let successCount = 0;
        let failCount = 0;
        for (const kitId of selectedKitIds) {
            const lesson = savedLessonsRef.current.find(l => l.id === kitId);
            if (!lesson) continue;
            try {
                const result = await history.handleDeleteRecord(kitId);
                if (result.ok) successCount++;
                else failCount++;
            } catch {
                failCount++;
            }
        }
        setSelectedKitIds(new Set());
        setShowDeleteConfirm(false);
        setIsDeletingBatch(false);
        if (failCount === 0) {
            useToast.getState().success(`已删除 ${successCount} 个 Lesson Kit。`);
        } else {
            useToast.getState().warning(`删除完成：成功 ${successCount}，失败 ${failCount}。`);
        }
    };

    const handleSelectAllVisible = () => {
        const visibleIds = displayedKitsBase.map(l => l.id);
        const allSelected = visibleIds.every(id => selectedKitIds.has(id));
        if (allSelected) {
            setSelectedKitIds(new Set());
        } else {
            setSelectedKitIds(new Set(visibleIds));
        }
    };

    const executeDelete = async (kind: 'curriculum' | 'lesson', id: string, title: string) => {
        try {
            const result = kind === 'curriculum'
                ? await history.handleDeleteCurriculum(id)
                : await history.handleDeleteRecord(id);
            if (!result.ok) {
                useToast.getState().error(`Delete failed for "${title}". Please retry.`);
                return;
            }
            // Cascade: unlink orphaned kits when curriculum is deleted
            if (kind === 'curriculum') {
                // Use ref to get the latest savedLessons (avoids stale closure from pre-delete render)
                const orphanedKits = savedLessonsRef.current.filter(l => l.curriculumId === id);
                if (orphanedKits.length > 0) {
                    const results = await Promise.allSettled(
                        orphanedKits.map(kit =>
                            history.saveLessonDb({ ...kit, curriculumId: undefined, lastModified: Date.now() })
                        )
                    );
                    const failed = results.filter(r => r.status === 'rejected').length;
                    if (failed > 0) {
                        useToast.getState().warning(`Deleted "${title}", but ${failed}/${orphanedKits.length} linked kits failed to unlink.`);
                    } else {
                        useToast.getState().success(`Deleted "${title}" and unlinked ${orphanedKits.length} kit(s).`);
                    }
                    return;
                }
            }
            if (result.pendingSync) {
                useToast.getState().warning(`Deleted "${title}" locally. Cloud sync pending.`);
            } else {
                useToast.getState().success(`Deleted "${title}".`);
            }
        } catch (err: any) {
            console.error('[RecordsPage] executeDelete error:', err);
            useToast.getState().error(`Delete failed. ${err?.message || 'Unexpected error'}`);
        }
    };

    // --- Textbook Tree (for Lesson Kits index) ---
    const textbookTree = useMemo(() => {
        const tree: { name: string; level: string; curriculumIds: Set<string>; units: Map<number, CurriculumLesson[]> }[] = [];
        savedCurricula.forEach(sc => {
            const name = sc.curriculum?.seriesName
                || sc.textbookTitle?.replace(/\s*Student(?:'|\u2019)?s?\s*Book/gi, '').trim()
                || sc.textbookTitle;
            if (!name || !sc.curriculum?.lessons?.length) return;
            const units = new Map<number, CurriculumLesson[]>();
            // Check if ANY lesson has unitNumber
            const hasUnits = sc.curriculum.lessons.some(l => l.unitNumber != null);
            sc.curriculum.lessons.forEach((l, i) => {
                // If no lessons have unitNumber, group by lesson number as the "unit"
                const u = hasUnits ? (l.unitNumber ?? -1) : (l.lessonNumber ?? i + 1);
                if (u === -1) return; // skip lessons that somehow have no unit when others do
                if (!units.has(u)) units.set(u, []);
                units.get(u)!.push(l);
            });
            const existing = tree.find(t => t.name === name);
            if (existing) {
                existing.curriculumIds.add(sc.id);
                units.forEach((lessons, u) => {
                    if (!existing.units.has(u)) existing.units.set(u, []);
                    existing.units.get(u)!.push(...lessons);
                });
            } else {
                tree.push({ name, level: sc.targetLevel, curriculumIds: new Set([sc.id]), units });
            }
        });
        return tree;
    }, [savedCurricula]);

    const textbookLevelTree = useMemo<TextbookLevelTreeNode[]>(() => {
        const tree = new Map<string, Map<string, { levelLabel: string; curriculumIds: Set<string>; units: Map<number, CurriculumLesson[]> }>>();

        // Normalize series name to group editions under one family
        // e.g. 'Trailblazer 1' → 'Trailblazer', 'Trailblazer Starter' → 'Trailblazer'
        const normalizeSeriesFamily = (name: string): string => {
            return name
                .replace(/\s+(?:Starter|Plus|Advanced|Beginner|Elementary|Intermediate)$/i, '')
                .replace(/\s+\d+$/i, '')
                .trim() || name;
        };

        const ensureLevelNode = (textbookName: string, levelKey: string, levelLabel: string) => {
            if (!tree.has(textbookName)) {
                tree.set(textbookName, new Map());
            }
            const levelMap = tree.get(textbookName)!;
            if (!levelMap.has(levelKey)) {
                levelMap.set(levelKey, {
                    levelLabel,
                    curriculumIds: new Set<string>(),
                    units: new Map<number, CurriculumLesson[]>(),
                });
            }
            return levelMap.get(levelKey)!;
        };

        const getLevelLabel = (levelKey?: string, fallbackLevel?: string) => {
            const key = (levelKey || '').trim();
            if (!key) return fallbackLevel || 'Unknown';
            const registry = findTextbookLevelEntry(key)?.displayName;
            const custom = getCustomTextbookLevelLabel(key);
            return registry || custom || fallbackLevel || key;
        };

        savedCurricula.forEach((sc) => {
            const rawName = sc.curriculum?.seriesName
                || sc.textbookTitle?.replace(/\s*Student(?:'|\u2019)?s?\s*Book/gi, '').trim()
                || sc.textbookTitle
                || 'Unknown Textbook';
            const textbookName = normalizeSeriesFamily(rawName);
            const levelKey = sc.params?.textbookLevelKey || `legacy:${sc.targetLevel || 'unknown'}`;
            const levelLabel = getLevelLabel(sc.params?.textbookLevelKey, sc.targetLevel);
            const enrichedLabel = rawName !== textbookName ? `${rawName} (${levelLabel})` : levelLabel;
            const levelNode = ensureLevelNode(textbookName, levelKey, enrichedLabel);
            levelNode.curriculumIds.add(sc.id);

            const lessons = sc.curriculum?.lessons || [];
            const hasUnits = lessons.some((lesson) => lesson.unitNumber != null);
            lessons.forEach((lesson, index) => {
                const unit = hasUnits ? (lesson.unitNumber ?? -1) : (lesson.lessonNumber ?? index + 1);
                if (unit === -1) return;
                if (!levelNode.units.has(unit)) levelNode.units.set(unit, []);
                levelNode.units.get(unit)!.push(lesson);
            });
        });

        const curriculumById = new Map<string, SavedCurriculum>(savedCurricula.map((record) => [record.id, record]));
        savedLessons.forEach((lesson) => {
            const levelKey = lesson.content?.textbookLevelKey;
            if (!levelKey) return;
            const matchedCurriculum = lesson.curriculumId ? curriculumById.get(lesson.curriculumId) : null;
            const rawName = matchedCurriculum?.curriculum?.seriesName
                || matchedCurriculum?.textbookTitle?.replace(/\s*Student(?:'|\u2019)?s?\s*Book/gi, '').trim()
                || matchedCurriculum?.textbookTitle
                || 'Standalone';
            const textbookName = rawName === 'Standalone' ? rawName : normalizeSeriesFamily(rawName);
            const levelLabel = getLevelLabel(levelKey, lesson.level);
            const levelNode = ensureLevelNode(textbookName, levelKey, levelLabel);
            if (lesson.curriculumId) {
                levelNode.curriculumIds.add(lesson.curriculumId);
            }
        });

        return Array.from(tree.entries())
            .map(([name, levelMap]) => ({
                name,
                levels: Array.from(levelMap.entries())
                    .map(([levelKey, node]) => ({
                        levelKey,
                        levelLabel: node.levelLabel,
                        curriculumIds: node.curriculumIds,
                        units: node.units,
                    }))
                    .sort((a, b) => a.levelLabel.localeCompare(b.levelLabel)),
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [savedCurricula, savedLessons]);

    const selectedTextbookNode = useMemo(
        () => textbookLevelTree.find((node) => node.name === selectedTextbook) || null,
        [selectedTextbook, textbookLevelTree],
    );

    const selectedLevelNode = useMemo(
        () => selectedTextbookNode?.levels.find((levelNode) => levelNode.levelKey === selectedLevelKey) || null,
        [selectedLevelKey, selectedTextbookNode],
    );

    // --- Ungrouped kits (no curriculum metadata) ---
    const ungroupedKits = useMemo(() =>
        history.filteredKits.filter(lk => !lk.curriculumId),
        [history.filteredKits]);

    // --- Lessons filtered by tree selection (metadata-based) ---
    const treeFilteredKits = useMemo(() => {
        if (!selectedTextbook) return null;
        // Standalone: flat list — bypass level/unit drill-down
        if (selectedTextbook === 'Standalone' && selectedTextbookNode) {
            const allCurrIds = new Set<string>();
            selectedTextbookNode.levels.forEach(lvl => lvl.curriculumIds.forEach(id => allCurrIds.add(id)));
            return history.filteredKits.filter(lk =>
                lk.curriculumId && allCurrIds.has(lk.curriculumId)
            );
        }
        if (!selectedLevelNode) return null;
        if (selectedUnit === null) {
            // Level selected but no unit — show all kits for this level
            return history.filteredKits.filter(lk =>
                lk.curriculumId && selectedLevelNode.curriculumIds.has(lk.curriculumId)
            );
        }
        return history.filteredKits.filter(lk =>
            lk.curriculumId && selectedLevelNode.curriculumIds.has(lk.curriculumId) && lk.unitNumber === selectedUnit
        );
    }, [selectedTextbook, selectedTextbookNode, selectedLevelNode, selectedUnit, history.filteredKits]);

    const displayedCurriculaBase = history.filteredCurricula;
    const displayedCurricula = useMemo(() => {
        if (curQuality === 'all') return displayedCurriculaBase;
        return displayedCurriculaBase.filter((item) => (
            assessESLCurriculumQuality(item.curriculum, item.params).status === curQuality
        ));
    }, [curQuality, displayedCurriculaBase]);
    const displayedKitsBase = treeFilteredKits ?? (textbookLevelTree.length > 0 ? ungroupedKits : history.filteredKits);
    const governanceSourceKits = savedLessons;
    const governanceRows = useMemo(() => {
        return governanceSourceKits
            .map((lesson) => {
                const review = history.teacherReviewMap[lesson.id];
                const signal = getLessonRiskSignal(lesson, review);
                return {
                    lesson,
                    review,
                    riskScore: signal.riskScore,
                    unresolved: signal.unresolved,
                    reasons: signal.reasons,
                };
            })
            .sort((a, b) => {
                if (b.riskScore !== a.riskScore) return b.riskScore - a.riskScore;
                return b.lesson.timestamp - a.lesson.timestamp;
            });
    }, [governanceSourceKits, history.teacherReviewMap]);
    const governanceMap = useMemo(
        () => new Map(governanceRows.map((item) => [item.lesson.id, item])),
        [governanceRows],
    );
    const governanceStats = useMemo(() => {
        const backlog = governanceRows.filter((item) => item.unresolved).length;
        const highRisk = governanceRows.filter((item) => item.unresolved && item.riskScore >= 45).length;
        const reviewedReady = governanceRows.filter((item) => item.review?.accepted).length;
        const nextPriority = governanceRows.find((item) => item.unresolved) ?? null;
        return {
            total: governanceRows.length,
            backlog,
            highRisk,
            reviewedReady,
            nextPriority,
        };
    }, [governanceRows]);

    const displayedKits = riskViewOnly
        ? governanceRows.filter((item) => item.unresolved).map((item) => item.lesson)
        : displayedKitsBase;
    const showKitCards = selectedUnit !== null || textbookLevelTree.length === 0 || (!selectedTextbook && ungroupedKits.length > 0) || selectedTextbook === 'Standalone';
    const reviewTargetLesson = useMemo(
        () => [...savedLessons, ...displayedKits].find((item) => item.id === reviewLessonId) ?? null,
        [savedLessons, displayedKits, reviewLessonId],
    );

    const calibrationStats = useMemo(() => {
        const lessonMap = new Map<string, SavedLesson>();
        [...savedLessons, ...displayedKitsBase].forEach((lesson) => lessonMap.set(lesson.id, lesson));

        const reviews = Object.values(history.teacherReviewMap as Record<string, TeacherReview>) as TeacherReview[];
        const scored = reviews
            .map((review) => {
                const lesson = lessonMap.get(review.recordId);
                const modelScore = lesson?.content?.scoreReport?.overallScore;
                const finalScore = review.finalScore;
                return {
                    review,
                    lesson,
                    modelScore: typeof modelScore === 'number' ? modelScore : null,
                    finalScore: typeof finalScore === 'number' ? finalScore : null,
                };
            })
            .filter((item) => item.lesson);

        const deltaSamples = scored.filter((item) => item.modelScore !== null && item.finalScore !== null);
        const avgDelta = deltaSamples.length > 0
            ? deltaSamples.reduce((sum, item) => sum + ((item.finalScore as number) - (item.modelScore as number)), 0) / deltaSamples.length
            : null;

        const needsFixCount = scored.filter((item) => !item.review.accepted).length;
        const needsFixRate = scored.length > 0 ? (needsFixCount / scored.length) * 100 : 0;

        const byLevel = new Map<string, { count: number; avgDelta: number }>();
        deltaSamples.forEach((item) => {
            const level = item.lesson?.content?.textbookLevelKey || 'unknown';
            const prev = byLevel.get(level) || { count: 0, avgDelta: 0 };
            const nextCount = prev.count + 1;
            const nextAvg = ((prev.avgDelta * prev.count) + ((item.finalScore as number) - (item.modelScore as number))) / nextCount;
            byLevel.set(level, { count: nextCount, avgDelta: nextAvg });
        });

        const byWeek = new Map<string, { count: number; avgDelta: number }>();
        deltaSamples.forEach((item) => {
            const raw = item.review.createdAt;
            const date = raw ? new Date(raw) : new Date();
            const weekStart = new Date(date);
            const day = weekStart.getDay();
            const diff = day === 0 ? -6 : 1 - day;
            weekStart.setDate(weekStart.getDate() + diff);
            weekStart.setHours(0, 0, 0, 0);
            const key = weekStart.toISOString().slice(0, 10);

            const prev = byWeek.get(key) || { count: 0, avgDelta: 0 };
            const nextCount = prev.count + 1;
            const nextAvg = ((prev.avgDelta * prev.count) + ((item.finalScore as number) - (item.modelScore as number))) / nextCount;
            byWeek.set(key, { count: nextCount, avgDelta: nextAvg });
        });

        return {
            totalReviews: scored.length,
            avgDelta,
            needsFixRate,
            levelRows: Array.from(byLevel.entries())
                .map(([level, val]) => ({ level, ...val }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 4),
            weekRows: Array.from(byWeek.entries())
                .map(([week, val]) => ({ week, ...val }))
                .sort((a, b) => b.week.localeCompare(a.week))
                .slice(0, 4),
        };
    }, [history.teacherReviewMap, savedLessons, displayedKitsBase]);

    const openReviewModal = (lesson: SavedLesson) => {
        const current = history.teacherReviewMap[lesson.id];
        setReviewLessonId(lesson.id);
        setReviewAccepted(current?.accepted ?? lesson.content?.scoreReport?.reviewerStatus === 'ready_to_teach');
        setReviewFinalScore(current?.finalScore != null ? String(current.finalScore) : (lesson.content?.scoreReport?.overallScore != null ? String(lesson.content.scoreReport.overallScore) : ''));
        setReviewComment(current?.comment ?? '');
        setReviewEditedSections(current?.editedSections ?? []);
    };

    const closeReviewModal = () => {
        setReviewLessonId(null);
        setReviewComment('');
        setReviewEditedSections([]);
        setReviewFinalScore('');
        setReviewAccepted(true);
    };

    const toggleEditedSection = (label: string) => {
        setReviewEditedSections((prev) => (
            prev.includes(label)
                ? prev.filter((item) => item !== label)
                : [...prev, label]
        ));
    };

    const handleQuickFix = (lesson: SavedLesson) => {
        handleLoadRecord(lesson);
        const firstFix = lesson.content?.scoreReport?.actionableFixes?.[0];
        if (firstFix) {
            useToast.getState().info(`Quick fix suggestion: ${firstFix}`);
        } else {
            useToast.getState().info('Opened kit for quick revision.');
        }
    };

    const submitTeacherReview = async () => {
        if (!reviewTargetLesson) return;
        const parsedFinalScore = reviewFinalScore.trim() === '' ? undefined : Number(reviewFinalScore);
        if (parsedFinalScore !== undefined && (Number.isNaN(parsedFinalScore) || parsedFinalScore < 0 || parsedFinalScore > 100)) {
            useToast.getState().error('Final score must be between 0 and 100.');
            return;
        }
        const modelScore = reviewTargetLesson.content?.scoreReport?.overallScore;
        const textbookLevelKey = reviewTargetLesson.content?.textbookLevelKey;

        const result = await history.handleTeacherReview(
            reviewTargetLesson.id,
            reviewAccepted,
            {
                editedSections: reviewEditedSections,
                comment: reviewComment.trim() || undefined,
                finalScore: parsedFinalScore,
                modelScore: typeof modelScore === 'number' ? modelScore : undefined,
                textbookLevelKey: textbookLevelKey || undefined,
            },
        );
        if (!result.ok) {
            useToast.getState().error('Teacher review save failed. Please retry.');
            return;
        }
        useToast.getState().success('Teacher review saved.');
        closeReviewModal();
    };

    const handleLoadCurriculum = (saved: SavedCurriculum) => {
        setLoadedCurriculum({ curriculum: saved.curriculum, params: saved.params });
        onGoToCurriculum();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleLoadRecord = (record: SavedLesson) => {
        if (history.editingLessonId === record.id) return;
        setActiveLessonId(record.id);
        setState({ isLoading: false, generatedContent: record.content, error: null });
        onGoToCreate();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Select All button count
    const allVisibleSelected = displayedKitsBase.length > 0 && displayedKitsBase.every(l => selectedKitIds.has(l.id));

    return (
        <div className="animate-fade-in-up">
            <RecordsTabSwitcher
                tabs={[
                    { key: 'curricula', label: lang === 'zh' ? '教材大纲' : 'Curricula', icon: <BookOpen className="w-4 h-4" />, count: savedCurricula.length },
                    { key: 'kits', label: lang === 'zh' ? '教学套件' : 'Lesson Kits', icon: <Layers className="w-4 h-4" />, count: riskViewOnly ? governanceStats.backlog : history.filteredKits.length },
                ]}
                activeTab={recordsTab}
                onTabChange={(key) => setRecordsTab(key as typeof recordsTab)}
                accentColor="violet"
            />

            {recordsTab === 'curricula' && (
                <div className="space-y-6">
                    <FilterBar
                        search={curSearch} onSearchChange={setCurSearch}
                        level={curLevel} onLevelChange={setCurLevel}
                        dateRange={curDate} onDateRangeChange={setCurDate}
                        sort={curSort} onSortChange={setCurSort}
                        extraFilters={
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 dark:border-white/10 rounded-xl">
                                    <Hash className="w-3.5 h-3.5 text-slate-400" />
                                    <select value={curLessonRange} onChange={(e) => setCurLessonRange(e.target.value)} className="bg-transparent text-sm text-slate-700 dark:text-slate-200 dark:bg-transparent outline-none font-medium cursor-pointer">
                                        <option value="all">All Counts</option>
                                        <option value="1-10">1-10</option>
                                        <option value="11-20">11-20</option>
                                        <option value="21-40">21-40</option>
                                        <option value="40+">40+</option>
                                    </select>
                                </div>
                                <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 dark:border-white/10 rounded-xl">
                                    <FileCheck className="w-3.5 h-3.5 text-slate-400" />
                                    <select value={curQuality} onChange={(e) => setCurQuality(e.target.value as 'all' | 'ok' | 'needs_review')} className="bg-transparent text-sm text-slate-700 dark:text-slate-200 dark:bg-transparent outline-none font-medium cursor-pointer">
                                        <option value="all">All Quality</option>
                                        <option value="needs_review">Needs Review</option>
                                        <option value="ok">Ready</option>
                                    </select>
                                </div>
                            </div>
                        }
                    />

                    {displayedCurricula.length === 0 ? (
                        <EmptyState
                            icon={BookOpen}
                            iconSize={48}
                            iconClassName="text-slate-300 w-12 h-12 bg-transparent dark:bg-transparent"
                            title={t('rec.noCurricula')}
                            titleClassName="text-lg font-medium text-slate-900 dark:text-slate-100"
                            description={t('rec.noCurriculaHint')}
                            descriptionClassName="text-slate-500"
                            className="bg-white dark:bg-slate-900/50"
                            actionLabel={t('rec.goDesign')}
                            onAction={onGoToCurriculum}
                            actionClassName="bg-violet-600 hover:bg-violet-700 text-white shadow-violet-600/20"
                        />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {displayedCurricula.map((sc) => (
                                <RecordCard
                                    key={sc.id}
                                    title={sc.textbookTitle}
                                    description={sc.description || ''}
                                    timestamp={sc.timestamp}
                                    tags={[
                                        { icon: <GraduationCap size={16} />, label: sc.targetLevel },
                                        { icon: <BookOpen size={16} />, label: `${sc.totalLessons} Lessons` }
                                    ]}
                                    active={false}
                                    onOpen={() => handleLoadCurriculum(sc)}
                                    openLabel={t('rec.openCurriculum')}
                                    onDelete={() => executeDelete('curriculum', sc.id, sc.textbookTitle)}
                                    customActions={(
                                        <button
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                setIsExportingCur(sc.id);
                                                try {
                                                    const { default: JSZip } = await import('jszip');
                                                    const zip = new JSZip();
                                                    let md = `# ${sc.textbookTitle}\n\n**Level:** ${sc.targetLevel}\n**Total Lessons:** ${sc.totalLessons}\n\n## Overview\n\n${sc.curriculum.overview || ''}\n\n`;
                                                    sc.curriculum.lessons.forEach((l, i) => {
                                                        md += `## Lesson ${i + 1}: ${l.title}\n\n- **Topic:** ${l.topic}\n- **Description:** ${l.description}\n- **Grammar Focus:** ${l.grammarFocus}\n- **Objectives:** ${l.objectives.join('; ')}\n- **Vocabulary:** ${l.suggestedVocabulary.join(', ')}\n- **Activities:** ${l.suggestedActivities.join('; ')}\n\n`;
                                                    });
                                                    zip.file('Curriculum_Overview.md', md);
                                                    zip.file('curriculum_data.json', JSON.stringify({ curriculum: sc.curriculum, params: sc.params }, null, 2));
                                                    const blob = await zip.generateAsync({ type: 'blob' });
                                                    const { downloadBlob } = await import('@shared/utils/download');
                                                    downloadBlob(blob, `ESL_Curriculum_${sc.textbookTitle.replace(/[^a-z0-9]/gi, '_')}.zip`);
                                                } catch (err) { console.error('Export failed', err); }
                                                finally { setIsExportingCur(null); }
                                            }}
                                            disabled={isExportingCur === sc.id}
                                            className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-500/10 rounded-lg transition-colors flex items-center justify-center cursor-pointer relative"
                                            title="Export"
                                        >
                                            <Download className={`w-4 h-4 ${isExportingCur === sc.id ? "animate-pulse" : ""}`} />
                                        </button>
                                    )}
                                />
                            ))}
                        </div>
                    )}

                </div>
            )}

            {recordsTab === 'kits' && (
                <div className="space-y-6">
                    <FilterBar
                        search={kitSearch} onSearchChange={setKitSearch}
                        level={kitLevel} onLevelChange={setKitLevel}
                        dateRange={kitDate} onDateRangeChange={setKitDate}
                        sort={kitSort} onSortChange={setKitSort}
                    />


                    {/* --- Textbook Tree Index --- */}
                    {textbookLevelTree.length > 0 && (
                        <div className="space-y-3">
                            {/* Breadcrumb */}
                            <div className="flex items-center gap-1.5 text-sm flex-wrap">
                                <button
                                    onClick={() => { setSelectedTextbook(null); setSelectedLevelKey(null); setSelectedUnit(null); }}
                                    className={`font-semibold transition-colors ${!selectedTextbook ? 'text-violet-600' : 'text-slate-400 hover:text-violet-600 cursor-pointer'}`}
                                >
                                    <Library size={14} className="inline mr-1" />
                                    {lang === 'zh' ? '全部教材' : 'All Textbooks'}
                                </button>
                                {selectedTextbook && (
                                    <>
                                        <ChevronRight size={14} className="text-slate-300" />
                                        <button
                                            onClick={() => { setSelectedLevelKey(null); setSelectedUnit(null); }}
                                            className={`font-semibold transition-colors ${!selectedLevelKey ? 'text-violet-600' : 'text-slate-400 hover:text-violet-600 cursor-pointer'}`}
                                        >
                                            {selectedTextbook}
                                        </button>
                                    </>
                                )}
                                {selectedLevelKey && selectedLevelNode && (
                                    <>
                                        <ChevronRight size={14} className="text-slate-300" />
                                        <button
                                            onClick={() => setSelectedUnit(null)}
                                            className={`font-semibold transition-colors ${selectedUnit === null ? 'text-violet-600' : 'text-slate-400 hover:text-violet-600 cursor-pointer'}`}
                                        >
                                            {selectedLevelNode.levelLabel}
                                        </button>
                                    </>
                                )}
                                {selectedUnit !== null && (
                                    <>
                                        <ChevronRight size={14} className="text-slate-300" />
                                        <span className="font-semibold text-violet-600">Unit {selectedUnit}</span>
                                    </>
                                )}
                            </div>

                            {/* Level 0: Textbook cards */}
                            {!selectedTextbook && (
                                <div className="flex flex-wrap gap-3">
                                    {textbookLevelTree.map(tb => {
                                        const levelCount = tb.levels.length;
                                        let unitCount = 0;
                                        let lessonCount = 0;
                                        tb.levels.forEach(lvl => {
                                            unitCount += lvl.units.size;
                                            lvl.units.forEach(ls => lessonCount += ls.length);
                                        });
                                        return (
                                            <button
                                                key={tb.name}
                                                onClick={() => { setSelectedTextbook(tb.name); setSelectedLevelKey(null); setSelectedUnit(null); }}
                                                className="flex items-center gap-3 px-5 py-3.5 bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-500/10 dark:to-indigo-500/10 border border-violet-200 dark:border-violet-500/20 rounded-2xl hover:shadow-md hover:border-violet-300 transition-all group cursor-pointer text-left"
                                            >
                                                <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center">
                                                    <BookOpen size={20} className="text-violet-500" />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-sm text-slate-800 dark:text-slate-100 group-hover:text-violet-700">{tb.name}</div>
                                                    <div className="text-xs text-slate-400 mt-0.5">
                                                        {tb.name === 'Standalone' ? (() => {
                                                            const allCids = new Set<string>();
                                                            tb.levels.forEach(lvl => lvl.curriculumIds.forEach(id => allCids.add(id)));
                                                            const kitCount = history.filteredKits.filter(lk => lk.curriculumId && allCids.has(lk.curriculumId)).length;
                                                            return `${kitCount} ${lang === 'zh' ? '课件' : kitCount === 1 ? 'kit' : 'kits'}`;
                                                        })() : `${levelCount} ${lang === 'zh' ? '级别' : levelCount === 1 ? 'level' : 'levels'} · ${unitCount} ${lang === 'zh' ? '单元' : 'units'} · ${lessonCount} ${lang === 'zh' ? '课时' : 'lessons'}`}
                                                    </div>
                                                </div>
                                                <ChevronRight size={16} className="text-slate-300 group-hover:text-violet-400 ml-auto" />
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Level 1: Level pills (within selected textbook) */}
                            {selectedTextbook && selectedTextbook !== 'Standalone' && !selectedLevelKey && selectedTextbookNode && (
                                <div className="flex flex-wrap gap-2">
                                    {selectedTextbookNode.levels.map(lvl => {
                                        const unitCount = lvl.units.size;
                                        let lessonCount = 0;
                                        lvl.units.forEach(ls => lessonCount += ls.length);
                                        const generatedCount = history.filteredKits.filter(lk =>
                                            lk.curriculumId && lvl.curriculumIds.has(lk.curriculumId)
                                        ).length;
                                        return (
                                            <button
                                                key={lvl.levelKey}
                                                onClick={() => { setSelectedLevelKey(lvl.levelKey); setSelectedUnit(null); }}
                                                className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-violet-300 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-all text-left group cursor-pointer"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <GraduationCap size={14} className="text-indigo-500" />
                                                    <span className="font-bold text-sm text-slate-700 dark:text-slate-200 group-hover:text-violet-600">
                                                        {lvl.levelLabel}
                                                    </span>
                                                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${generatedCount > 0 ? 'text-emerald-600 bg-emerald-100 dark:bg-emerald-500/20' : 'text-slate-400 bg-slate-100 dark:bg-slate-700'}`}>
                                                        {generatedCount} {lang === 'zh' ? '卡片' : 'kits'}
                                                    </span>
                                                </div>
                                                <div className="text-[11px] text-slate-400 mt-1">
                                                    {unitCount} {lang === 'zh' ? '个单元' : 'units'} · {lessonCount} {lang === 'zh' ? '课时' : 'lessons'}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Level 2: Unit pills (within selected level) */}
                            {selectedTextbook && selectedLevelKey && selectedLevelNode && selectedUnit === null && (() => {
                                const sortedUnits = [...selectedLevelNode.units.entries()].sort(([a], [b]) => a - b);
                                return (
                                    <div className="flex flex-wrap gap-2">
                                        {sortedUnits.map(([unitNum, lessons]) => {
                                            const generatedCount = history.filteredKits.filter(lk =>
                                                lk.curriculumId && selectedLevelNode.curriculumIds.has(lk.curriculumId) && lk.unitNumber === unitNum
                                            ).length;
                                            return (
                                                <button
                                                    key={unitNum}
                                                    onClick={() => setSelectedUnit(unitNum)}
                                                    className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-violet-300 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-all text-left group cursor-pointer"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <FolderOpen size={14} className="text-amber-500" />
                                                        <span className="font-bold text-sm text-slate-700 dark:text-slate-200 group-hover:text-violet-600">
                                                            Unit {unitNum}
                                                        </span>
                                                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${generatedCount > 0 ? 'text-emerald-600 bg-emerald-100 dark:bg-emerald-500/20' : 'text-slate-400 bg-slate-100 dark:bg-slate-700'}`}>
                                                            {generatedCount}
                                                        </span>
                                                    </div>
                                                    <div className="text-[11px] text-slate-400 mt-1 truncate max-w-[200px]">
                                                        {lessons.map(l => l.title).join(', ')}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {/* Cards show when: unit selected, no tree exists, or ungrouped kits with no textbook selected */}
                    {showKitCards && displayedKits.length === 0 ? (
                        <EmptyState
                            icon={Layers}
                            iconSize={48}
                            iconClassName="text-slate-300 w-12 h-12 bg-transparent dark:bg-transparent"
                            title={riskViewOnly
                                ? 'No kits need review right now'
                                : (selectedTextbook ? (lang === 'zh' ? '该分类下暂无课程卡片' : 'No kits in this selection') : t('rec.noKits'))}
                            titleClassName="text-lg font-medium text-slate-900 dark:text-slate-100"
                            description={riskViewOnly
                                ? 'All lesson kits are currently reviewed/ready based on quality and teacher status.'
                                : (selectedTextbook ? (lang === 'zh' ? '尝试选择其他单元或返回查看全部' : 'Try another unit or go back to view all') : t('rec.noKitsHint'))}
                            descriptionClassName="text-slate-500"
                            className="bg-white dark:bg-slate-900/50"
                            actionLabel={riskViewOnly ? 'Show All Kits' : (selectedTextbook ? (lang === 'zh' ? '返回全部' : 'View All') : t('rec.goCreate'))}
                            onAction={riskViewOnly ? () => setRiskViewOnly(false) : (selectedTextbook ? () => { setSelectedTextbook(null); setSelectedUnit(null); } : onGoToCreate)}
                            actionClassName="bg-violet-600 hover:bg-violet-700 text-white shadow-violet-600/20"
                        />
                    ) : showKitCards ? (
                        <>
                            {!selectedTextbook && textbookLevelTree.length > 0 && (
                                <div className="flex items-center gap-2 mt-2 mb-1">
                                    <FileText size={16} className="text-slate-400" />
                                    <span className="text-sm font-semibold text-slate-500">
                                        {lang === 'zh' ? '独立课件' : 'Standalone Kits'}
                                    </span>
                                    <span className="text-xs text-slate-400">({ungroupedKits.length})</span>
                                </div>
                            )}
                            {/* Select All / Deselect All button */}
                            {displayedKitsBase.length > 0 && (
                                <div className="flex items-center gap-2 mb-3">
                                    <button
                                        onClick={handleSelectAllVisible}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-indigo-300 hover:text-indigo-600"
                                    >
                                        {allVisibleSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                                        {allVisibleSelected ? (lang === 'zh' ? '取消全选' : 'Deselect All') : (lang === 'zh' ? '全选' : 'Select All')}
                                        <span className="text-slate-400 font-normal ml-1">({displayedKitsBase.length})</span>
                                    </button>
                                </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {displayedKits.map((lesson) => (
                                    <div key={lesson.id} className="relative">
                                        {expandedRiskId === lesson.id && governanceMap.get(lesson.id)?.unresolved && (
                                            <div className="absolute top-10 right-3 z-20 bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-500/30 rounded-xl shadow-lg p-3 w-64 space-y-2" onClick={(e) => e.stopPropagation()}>
                                                <div className="text-xs font-bold text-amber-800 dark:text-amber-300 mb-1">Risk Factors</div>
                                                <ul className="space-y-1">
                                                    {governanceMap.get(lesson.id)?.reasons.map((reason, i) => (
                                                        <li key={i} className="flex items-start gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                                                            <AlertTriangle size={12} className="text-amber-500 mt-0.5 flex-shrink-0" />
                                                            {getRiskReasonLabel(reason)}
                                                        </li>
                                                    ))}
                                                </ul>
                                                {lesson.content?.scoreReport?.actionableFixes?.[0] && (
                                                    <div className="text-[11px] bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 rounded-lg px-2 py-1.5 mt-1">
                                                        <span className="font-semibold">Suggestion:</span> {lesson.content.scoreReport.actionableFixes[0]}
                                                    </div>
                                                )}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleQuickFix(lesson); setExpandedRiskId(null); }}
                                                    className="w-full text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 rounded-lg px-3 py-1.5 transition-colors flex items-center justify-center gap-1.5"
                                                >
                                                    <Wrench size={12} /> Quick Fix
                                                </button>
                                            </div>
                                        )}

                                        <RecordCard
                                            topLeftSlot={
                                                <button
                                                    onClick={(e) => toggleKitSelection(lesson.id, e)}
                                                    className={`p-0.5 rounded-md transition-all ${selectedKitIds.has(lesson.id) ? 'text-violet-600' : 'text-slate-300 hover:text-slate-500'}`}
                                                    title={lang === 'zh' ? '选择' : 'Select'}
                                                >
                                                    {selectedKitIds.has(lesson.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                                                </button>
                                            }
                                            topRightSlot={governanceMap.get(lesson.id)?.unresolved ? (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setExpandedRiskId(prev => prev === lesson.id ? null : lesson.id); }}
                                                    className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] font-semibold border border-amber-200 hover:bg-amber-200 transition-colors cursor-pointer"
                                                    title="Click to view risk details"
                                                >
                                                    {`Risk ${governanceMap.get(lesson.id)?.riskScore}`}
                                                </button>
                                            ) : undefined}
                                            title={lesson.topic}
                                            description={lesson.description || ''}
                                            timestamp={lesson.timestamp}
                                            tags={[
                                                { icon: <GraduationCap size={16} />, label: lesson.level },
                                                ...(lesson.content?.structuredLessonPlan?.lessonDetails?.type
                                                    ? [{ icon: <Sparkles size={16} />, label: lesson.content.structuredLessonPlan.lessonDetails.type }]
                                                    : [{ icon: <Sparkles size={16} />, label: 'Lesson Kit' }]),
                                                ...(lesson.content?.structuredLessonPlan?.stages?.length
                                                    ? [{ icon: <Layers size={16} />, label: `${lesson.content.structuredLessonPlan.stages.length} stages` }]
                                                    : []),
                                                ...(history.teacherReviewMap[lesson.id]
                                                    ? [{ icon: <FileCheck size={16} />, label: history.teacherReviewMap[lesson.id].accepted ? 'Reviewed: Ready' : 'Reviewed: Needs Fix' }]
                                                    : []),
                                            ]}
                                            active={activeLessonId === lesson.id}
                                            onOpen={() => handleLoadRecord(lesson)}
                                            openLabel={activeLessonId === lesson.id ? t('rec.currentlyEditing') : t('rec.openKit')}

                                            onRename={(newName) => history.handleRenameLesson(lesson.id, newName)}
                                            onDelete={() => executeDelete('lesson', lesson.id, lesson.topic)}
                                            customActions={(
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDownloadZip(lesson, setIsExporting);
                                                    }}
                                                    disabled={isExporting === lesson.id}
                                                    className={`p-2 rounded-lg transition-colors ${isExporting === lesson.id ? 'text-slate-300' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30'}`}
                                                    title="Download/Export"
                                                >
                                                    <Download size={16} className={isExporting === lesson.id ? "animate-pulse" : ""} />
                                                </button>
                                            )}
                                        />
                                    </div>
                                ))}
                            </div>


                            {/* Delete Confirmation Modal */}
                            {showDeleteConfirm && (
                                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => !isDeletingBatch && setShowDeleteConfirm(false)}>
                                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                                                <Trash2 className="w-5 h-5 text-red-600" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-800 dark:text-slate-200">{lang === 'zh' ? '确认删除' : 'Confirm Delete'}</h3>
                                                <p className="text-sm text-slate-500">{lang === 'zh' ? `将永久删除 ${selectedKitIds.size} 个 Lesson Kit` : `Permanently delete ${selectedKitIds.size} lesson kit(s)`}</p>
                                            </div>
                                        </div>
                                        <div className="flex justify-end gap-3">
                                            <button
                                                onClick={() => setShowDeleteConfirm(false)}
                                                disabled={isDeletingBatch}
                                                className="px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50"
                                            >
                                                {lang === 'zh' ? '取消' : 'Cancel'}
                                            </button>
                                            <button
                                                onClick={handleBatchDelete}
                                                disabled={isDeletingBatch}
                                                className="px-4 py-2 text-sm font-bold text-white bg-red-500 rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                                            >
                                                {isDeletingBatch ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                                {isDeletingBatch ? (lang === 'zh' ? '删除中…' : 'Deleting…') : (lang === 'zh' ? '确认删除' : 'Delete')}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Floating batch action bar */}
                            {selectedKitIds.size > 0 && (
                                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl px-5 py-3 flex items-center gap-4 animate-fade-in-up whitespace-nowrap">
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                        {selectedKitIds.size} {lang === 'zh' ? '个已选' : 'selected'}
                                    </span>
                                    {!showAssignPicker ? (
                                        <>
                                            <button
                                                onClick={() => setShowAssignPicker(true)}
                                                disabled={textbookLevelTree.length === 0}
                                                className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50"
                                            >
                                                <FolderPlus size={16} />
                                                {lang === 'zh' ? '添加到课本单元' : 'Assign to Unit'}
                                            </button>
                                            <button
                                                onClick={() => setShowDeleteConfirm(true)}
                                                className="flex items-center gap-1.5 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-bold rounded-xl transition-colors"
                                            >
                                                <Trash2 size={16} />
                                                {lang === 'zh' ? '批量删除' : 'Delete'}
                                            </button>
                                            <button onClick={() => setSelectedKitIds(new Set())} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg" title="Clear">
                                                <X size={16} />
                                            </button>
                                        </>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <select
                                                value={assignTextbook}
                                                onChange={(e) => { setAssignTextbook(e.target.value); setAssignUnit(null); }}
                                                className="text-sm border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-800 dark:text-slate-200"
                                            >
                                                <option value="">{lang === 'zh' ? '选择课本' : 'Select Textbook'}</option>
                                                {textbookLevelTree.map(tb => <option key={tb.name} value={tb.name}>{tb.name}</option>)}
                                            </select>
                                            {assignTextbook && assignTextbook !== 'Standalone' && (() => {
                                                const tb = textbookLevelTree.find(t => t.name === assignTextbook);
                                                if (!tb) return null;
                                                const allUnits = new Set<number>();
                                                tb.levels.forEach(lvl => lvl.units.forEach((_, u) => allUnits.add(u)));
                                                const units = [...allUnits].sort((a, b) => a - b);
                                                return (
                                                    <select
                                                        value={assignUnit ?? ''}
                                                        onChange={(e) => setAssignUnit(Number(e.target.value))}
                                                        className="text-sm border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-800 dark:text-slate-200"
                                                    >
                                                        <option value="">{lang === 'zh' ? '选择单元' : 'Select Unit'}</option>
                                                        {units.map(u => <option key={u} value={u}>Unit {u}</option>)}
                                                    </select>
                                                );
                                            })()}
                                            <button
                                                onClick={handleBatchAssign}
                                                disabled={!assignTextbook || (assignTextbook !== 'Standalone' && assignUnit === null)}
                                                className="px-4 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
                                            >
                                                {lang === 'zh' ? '确认' : 'Confirm'}
                                            </button>
                                            <button onClick={() => { setShowAssignPicker(false); setAssignTextbook(''); setAssignUnit(null); }} className="p-1.5 text-slate-400 hover:text-slate-600">
                                                <X size={14} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    ) : null}
                    {/* Image Migration Utility */}
                    <div className="mt-8">
                        <ImageMigrationButton />
                    </div>
                </div>
            )}

            <Modal isOpen={Boolean(reviewTargetLesson)} onClose={closeReviewModal} maxWidth="max-w-lg">
                <div className="p-5 space-y-4">
                    <div className="text-lg font-bold text-slate-800 dark:text-slate-100">
                        Teacher Review
                    </div>
                    <div className="text-sm text-slate-500">
                        {reviewTargetLesson?.topic}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="radio"
                                checked={reviewAccepted}
                                onChange={() => setReviewAccepted(true)}
                            />
                            Ready to Teach
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="radio"
                                checked={!reviewAccepted}
                                onChange={() => setReviewAccepted(false)}
                            />
                            Needs Fix
                        </label>
                    </div>
                    <div>
                        <label className="text-xs text-slate-500 uppercase tracking-wide">Final Score (0-100)</label>
                        <input
                            type="number"
                            min={0}
                            max={100}
                            value={reviewFinalScore}
                            onChange={(e) => setReviewFinalScore(e.target.value)}
                            className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                        />
                    </div>
                    {reviewTargetLesson?.content?.scoreReport?.dimensionScores?.length ? (
                        <div>
                            <label className="text-xs text-slate-500 uppercase tracking-wide">Edited Dimensions</label>
                            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                                {reviewTargetLesson.content.scoreReport.dimensionScores.map((dim) => (
                                    <label key={dim.key} className="flex items-center gap-2 text-sm">
                                        <input
                                            type="checkbox"
                                            checked={reviewEditedSections.includes(dim.label)}
                                            onChange={() => toggleEditedSection(dim.label)}
                                        />
                                        {dim.label}
                                    </label>
                                ))}
                            </div>
                        </div>
                    ) : null}
                    <div>
                        <label className="text-xs text-slate-500 uppercase tracking-wide">Teacher Comment</label>
                        <textarea
                            value={reviewComment}
                            onChange={(e) => setReviewComment(e.target.value)}
                            rows={3}
                            className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none"
                            placeholder="What should be improved for classroom delivery?"
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <button
                            onClick={closeReviewModal}
                            className="px-3 py-2 text-sm rounded-lg border border-slate-200"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={submitTeacherReview}
                            className="px-3 py-2 text-sm rounded-lg bg-violet-600 text-white hover:bg-violet-700"
                        >
                            Save Review
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
