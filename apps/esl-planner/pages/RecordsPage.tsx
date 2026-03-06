import React, { useState, useMemo } from 'react';
import { Sparkles, BookOpen, GraduationCap, Download, Layers, FileText, ChevronRight, FolderOpen, Library, Hash } from 'lucide-react';
import { RecordCard } from '@shared/components/RecordCard';
import { RecordsTabSwitcher } from '@shared/components/RecordsTabSwitcher';
import { FilterBar } from '../components/FilterBar';
import { EmptyState } from '@shared/components/EmptyState';
import { handleDownloadZip } from '../utils/exportUtils';
import { useLanguage } from '../i18n/LanguageContext';
import JSZip from 'jszip';
import type { SavedLesson, SavedCurriculum, CurriculumLesson } from '../types';

import { useLessonHistory } from '../hooks/useLessonHistory';
import { useAppStore, useSessionStore } from '../stores/appStore';

export interface RecordsPageProps {
    onGoToCurriculum: () => void;
    onGoToCreate: () => void;
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
    const [isExportingCur, setIsExportingCur] = useState<string | null>(null);
    const [selectedTextbook, setSelectedTextbook] = useState<string | null>(null);
    const [selectedUnit, setSelectedUnit] = useState<number | null>(null);

    // --- Textbook Tree (for Lesson Kits index) ---
    const textbookTree = useMemo(() => {
        const tree: { name: string; level: string; curriculumIds: Set<string>; units: Map<number, CurriculumLesson[]> }[] = [];
        savedCurricula.forEach(sc => {
            const name = sc.curriculum?.seriesName
                || sc.textbookTitle?.replace(/\s*Student'?s?\s*Book/gi, '').trim()
                || sc.textbookTitle;
            if (!name || !sc.curriculum?.lessons?.length) return;
            const units = new Map<number, CurriculumLesson[]>();
            sc.curriculum.lessons.forEach(l => {
                const u = l.unitNumber ?? 0;
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

    // --- Ungrouped kits (no curriculum metadata) ---
    const ungroupedKits = useMemo(() =>
        history.filteredKits.filter(lk => !lk.curriculumId),
        [history.filteredKits]);

    // --- Lessons filtered by tree selection (metadata-based) ---
    const treeFilteredKits = useMemo(() => {
        if (!selectedTextbook) return null;
        const tb = textbookTree.find(t => t.name === selectedTextbook);
        if (!tb) return [];
        if (selectedUnit === null) return [];
        return history.filteredKits.filter(lk =>
            lk.curriculumId && tb.curriculumIds.has(lk.curriculumId) && lk.unitNumber === selectedUnit
        );
    }, [selectedTextbook, selectedUnit, textbookTree, history.filteredKits]);

    const displayedKits = treeFilteredKits ?? (textbookTree.length > 0 ? ungroupedKits : history.filteredKits);

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

    return (
        <div className="animate-fade-in-up">
            <RecordsTabSwitcher
                tabs={[
                    { key: 'curricula', label: lang === 'zh' ? '教材大纲' : 'Curricula', icon: <BookOpen className="w-4 h-4" />, count: savedCurricula.length },
                    { key: 'kits', label: lang === 'zh' ? '教学套件' : 'Lesson Kits', icon: <Layers className="w-4 h-4" />, count: savedLessons.length },
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
                            <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
                                <Hash className="w-3.5 h-3.5 text-slate-400" />
                                <select value={curLessonRange} onChange={(e) => setCurLessonRange(e.target.value)} className="bg-transparent text-sm text-slate-700 outline-none font-medium cursor-pointer">
                                    <option value="all">All Counts</option>
                                    <option value="1-10">1-10</option>
                                    <option value="11-20">11-20</option>
                                    <option value="21-40">21-40</option>
                                    <option value="40+">40+</option>
                                </select>
                            </div>
                        }
                    />

                    {history.filteredCurricula.length === 0 ? (
                        <EmptyState
                            icon={BookOpen}
                            iconSize={48}
                            iconClassName="text-slate-300 w-12 h-12 bg-transparent dark:bg-transparent"
                            title={t('rec.noCurricula')}
                            titleClassName="text-lg font-medium text-slate-900 dark:text-slate-100"
                            description={t('rec.noCurriculaHint')}
                            descriptionClassName="text-slate-500"
                            className="bg-white/50 dark:bg-slate-900/50"
                            actionLabel={t('rec.goDesign')}
                            onAction={onGoToCurriculum}
                            actionClassName="bg-violet-600 hover:bg-violet-700 text-white shadow-violet-600/20"
                        />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {history.filteredCurricula.map((sc) => (
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
                                    onDelete={() => history.handleDeleteCurriculum(sc.id)}
                                    customActions={(
                                        <button
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                setIsExportingCur(sc.id);
                                                try {
                                                    const zip = new JSZip();
                                                    let md = `# ${sc.textbookTitle}\n\n**Level:** ${sc.targetLevel}\n**Total Lessons:** ${sc.totalLessons}\n\n## Overview\n\n${sc.curriculum.overview || ''}\n\n`;
                                                    sc.curriculum.lessons.forEach((l, i) => {
                                                        md += `## Lesson ${i + 1}: ${l.title}\n\n- **Topic:** ${l.topic}\n- **Description:** ${l.description}\n- **Grammar Focus:** ${l.grammarFocus}\n- **Objectives:** ${l.objectives.join('; ')}\n- **Vocabulary:** ${l.suggestedVocabulary.join(', ')}\n- **Activities:** ${l.suggestedActivities.join('; ')}\n\n`;
                                                    });
                                                    zip.file('Curriculum_Overview.md', md);
                                                    zip.file('curriculum_data.json', JSON.stringify({ curriculum: sc.curriculum, params: sc.params }, null, 2));
                                                    const blob = await zip.generateAsync({ type: 'blob' });
                                                    const url = URL.createObjectURL(blob);
                                                    const a = document.createElement('a');
                                                    a.href = url;
                                                    a.download = `ESL_Curriculum_${sc.textbookTitle.replace(/[^a-z0-9]/gi, '_')}.zip`;
                                                    a.click();
                                                    URL.revokeObjectURL(url);
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
                    {textbookTree.length > 0 && (
                        <div className="space-y-3">
                            {/* Breadcrumb */}
                            <div className="flex items-center gap-1.5 text-sm">
                                <button
                                    onClick={() => { setSelectedTextbook(null); setSelectedUnit(null); }}
                                    className={`font-semibold transition-colors ${!selectedTextbook ? 'text-violet-600' : 'text-slate-400 hover:text-violet-600 cursor-pointer'}`}
                                >
                                    <Library size={14} className="inline mr-1" />
                                    {lang === 'zh' ? '全部教材' : 'All Textbooks'}
                                </button>
                                {selectedTextbook && (
                                    <>
                                        <ChevronRight size={14} className="text-slate-300" />
                                        <button
                                            onClick={() => setSelectedUnit(null)}
                                            className={`font-semibold transition-colors ${selectedUnit === null ? 'text-violet-600' : 'text-slate-400 hover:text-violet-600 cursor-pointer'}`}
                                        >
                                            {selectedTextbook}
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
                                    {textbookTree.map(tb => {
                                        const unitCount = tb.units.size;
                                        let lessonCount = 0;
                                        tb.units.forEach(ls => lessonCount += ls.length);
                                        return (
                                            <button
                                                key={tb.name}
                                                onClick={() => { setSelectedTextbook(tb.name); setSelectedUnit(null); }}
                                                className="flex items-center gap-3 px-5 py-3.5 bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-500/10 dark:to-indigo-500/10 border border-violet-200 dark:border-violet-500/20 rounded-2xl hover:shadow-md hover:border-violet-300 transition-all group cursor-pointer text-left"
                                            >
                                                <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center">
                                                    <BookOpen size={20} className="text-violet-500" />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-sm text-slate-800 dark:text-slate-100 group-hover:text-violet-700">{tb.name}</div>
                                                    <div className="text-xs text-slate-400 mt-0.5">
                                                        {unitCount} {lang === 'zh' ? '单元' : unitCount === 1 ? 'unit' : 'units'} · {lessonCount} {lang === 'zh' ? '课时' : 'lessons'} · {tb.level}
                                                    </div>
                                                </div>
                                                <ChevronRight size={16} className="text-slate-300 group-hover:text-violet-400 ml-auto" />
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Level 1: Unit pills */}
                            {selectedTextbook && selectedUnit === null && (() => {
                                const tb = textbookTree.find(t => t.name === selectedTextbook);
                                if (!tb) return null;
                                const sortedUnits = [...tb.units.entries()].sort(([a], [b]) => a - b);
                                return (
                                    <div className="flex flex-wrap gap-2">
                                        {sortedUnits.map(([unitNum, lessons]) => {
                                            // Count generated kits matching this unit by metadata
                                            const generatedCount = history.filteredKits.filter(lk =>
                                                lk.curriculumId && tb.curriculumIds.has(lk.curriculumId) && lk.unitNumber === unitNum
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

                    {/* Cards show when: unit selected, no tree exists, or ungrouped kits exist with no textbook selected */}
                    {(selectedUnit !== null || textbookTree.length === 0 || (!selectedTextbook && ungroupedKits.length > 0)) && displayedKits.length === 0 ? (
                        <EmptyState
                            icon={Layers}
                            iconSize={48}
                            iconClassName="text-slate-300 w-12 h-12 bg-transparent dark:bg-transparent"
                            title={selectedTextbook ? (lang === 'zh' ? '该分类下暂无课程卡片' : 'No kits in this selection') : t('rec.noKits')}
                            titleClassName="text-lg font-medium text-slate-900 dark:text-slate-100"
                            description={selectedTextbook ? (lang === 'zh' ? '尝试选择其他单元或返回查看全部' : 'Try another unit or go back to view all') : t('rec.noKitsHint')}
                            descriptionClassName="text-slate-500"
                            className="bg-white/50 dark:bg-slate-900/50"
                            actionLabel={selectedTextbook ? (lang === 'zh' ? '返回全部' : 'View All') : t('rec.goCreate')}
                            onAction={selectedTextbook ? () => { setSelectedTextbook(null); setSelectedUnit(null); } : onGoToCreate}
                            actionClassName="bg-violet-600 hover:bg-violet-700 text-white shadow-violet-600/20"
                        />
                    ) : (selectedUnit !== null || textbookTree.length === 0 || (!selectedTextbook && ungroupedKits.length > 0)) ? (
                        <>
                            {!selectedTextbook && textbookTree.length > 0 && (
                                <div className="flex items-center gap-2 mt-2 mb-1">
                                    <FileText size={16} className="text-slate-400" />
                                    <span className="text-sm font-semibold text-slate-500">
                                        {lang === 'zh' ? '独立课件' : 'Standalone Kits'}
                                    </span>
                                    <span className="text-xs text-slate-400">({ungroupedKits.length})</span>
                                </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {displayedKits.map((lesson) => (
                                    <RecordCard
                                        key={lesson.id}
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
                                        ]}
                                        active={activeLessonId === lesson.id}
                                        onOpen={() => handleLoadRecord(lesson)}
                                        openLabel={activeLessonId === lesson.id ? t('rec.currentlyEditing') : t('rec.openKit')}

                                        onRename={(newName) => history.handleRenameLesson(lesson.id, newName)}
                                        onDelete={() => history.handleDeleteRecord(lesson.id)}
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
                                ))}
                            </div>
                        </>
                    ) : null}
                </div>
            )}
        </div>
    );
};
