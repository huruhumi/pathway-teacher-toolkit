import React, { useState } from 'react';
import { Sparkles, BookOpen, History, Search, Hash, Clock, GraduationCap, Download, Layers } from 'lucide-react';
import { RecordCard } from '@shared/components/RecordCard';
import { FilterBar } from '../components/FilterBar';
import { EmptyState } from '@shared/components/EmptyState';
import { handleDownloadZip } from '../utils/exportUtils';
import { useLanguage } from '../i18n/LanguageContext';
import JSZip from 'jszip';
import type { SavedLesson, SavedCurriculum } from '../types';

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
            <div className="flex gap-4 p-1.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-white/5 mx-auto max-w-sm mb-6">
                <button
                    onClick={() => setRecordsTab('curricula')}
                    className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${recordsTab === 'curricula' ? 'bg-violet-50 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                    <BookOpen className="w-4 h-4" />
                    {lang === 'zh' ? `教材大纲 (${savedCurricula.length})` : `Curricula (${savedCurricula.length})`}
                </button>
                <button
                    onClick={() => setRecordsTab('kits')}
                    className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${recordsTab === 'kits' ? 'bg-violet-50 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                    <Layers className="w-4 h-4" />
                    {lang === 'zh' ? `教学套件 (${savedLessons.length})` : `Lesson Kits (${savedLessons.length})`}
                </button>
            </div>

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

                    {history.filteredKits.length === 0 ? (
                        <EmptyState
                            icon={Layers}
                            iconSize={48}
                            iconClassName="text-slate-300 w-12 h-12 bg-transparent dark:bg-transparent"
                            title={t('rec.noKits')}
                            titleClassName="text-lg font-medium text-slate-900 dark:text-slate-100"
                            description={t('rec.noKitsHint')}
                            descriptionClassName="text-slate-500"
                            className="bg-white/50 dark:bg-slate-900/50"
                            actionLabel={t('rec.goCreate')}
                            onAction={onGoToCreate}
                            actionClassName="bg-violet-600 hover:bg-violet-700 text-white shadow-violet-600/20"
                        />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {history.filteredKits.map((lesson) => (
                                <RecordCard
                                    key={lesson.id}
                                    title={lesson.topic}
                                    description={lesson.description || ''}
                                    timestamp={lesson.timestamp}
                                    tags={[
                                        { icon: <GraduationCap size={16} />, label: lesson.level },
                                        { icon: <Sparkles size={16} />, label: 'Lesson Kit' }
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
                    )}
                </div>
            )}
        </div>
    );
};
