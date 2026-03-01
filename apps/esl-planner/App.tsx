import React, { useState, useEffect, useRef } from 'react';
import { CEFRLevel, AppState, SavedLesson, CurriculumLesson, CurriculumParams, ESLCurriculum, SavedCurriculum } from './types';
import { generateLessonPlan } from './services/geminiService';
import { InputSection } from './components/InputSection';
import { OutputDisplay } from './components/OutputDisplay';
import { CurriculumPlanner } from './components/CurriculumPlanner';
import { mapLessonToESLInput, MappedESLInput } from './utils/curriculumMapper';
import { Sparkles, Brain, Layout, History, Trash2, Edit3, ArrowLeft, Calendar, BookOpen, Check, X, Download, Loader2, Search, Hash, Clock, GraduationCap } from 'lucide-react';
import { RecordCard } from '@shared/components/RecordCard';
import { FilterBar } from './components/FilterBar';
import { ErrorModal } from './components/ErrorModal';
import { handleDownloadZip } from './utils/exportUtils';
import { useLessonHistory } from './hooks/useLessonHistory';
import { useBatchGenerate } from './hooks/useBatchGenerate';
import { AppHeader } from '@shared/components/AppHeader';
import { HeroBanner } from '@shared/components/HeroBanner';
import { PageLayout } from '@shared/components/PageLayout';
import { BodyContainer } from '@shared/components/BodyContainer';
import { HeaderToggles } from '@shared/components/HeaderToggles';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext';

const INDIGO_COLOR = '#4f46e5';



const AppContent: React.FC = () => {
    const { t, lang, setLang } = useLanguage();
    const [state, setState] = useState<AppState>({
        isLoading: false,
        generatedContent: null,
        error: null,
    });

    const [viewMode, setViewMode] = useState<'curriculum' | 'create' | 'history'>('curriculum');
    const [isExporting, setIsExporting] = useState<string | null>(null);
    const [prefilledValues, setPrefilledValues] = useState<MappedESLInput | null>(null);
    const [loadedCurriculum, setLoadedCurriculum] = useState<{ curriculum: ESLCurriculum; params: CurriculumParams } | null>(null);

    // --- Extracted hooks ---
    const history = useLessonHistory();
    const {
        activeLessonId, setActiveLessonId, savedLessons, setSavedLessons,
        savedCurricula, filteredCurricula, filteredKits,
        curSearch, setCurSearch, curLevel, setCurLevel, curDate, setCurDate, curSort, setCurSort, curLessonRange, setCurLessonRange,
        kitSearch, setKitSearch, kitLevel, setKitLevel, kitDate, setKitDate, kitSort, setKitSort,
        recordsTab, setRecordsTab,
        editingLessonId, editTitle, setEditTitle, startEditing, saveTitle, cancelEditing,
        handleSaveLesson, handleSaveCurriculum, handleDeleteCurriculum, handleDeleteRecord, handleRenameLesson,
    } = history;

    // Mutable ref for batch to always see latest savedLessons
    const savedLessonsRef = useRef(savedLessons);
    useEffect(() => { savedLessonsRef.current = savedLessons; }, [savedLessons]);

    const { batchStatus, batchLessonMap, batchRunning, batchProgress, handleBatchGenerate, handleCancelBatch } = useBatchGenerate(savedLessonsRef, setSavedLessons);

    // --- Top-level handlers (touch App state) ---

    const handleGenerate = async (
        text: string, files: File[], level: CEFRLevel, topic: string,
        slideCount: number, duration: string, studentCount: string, lessonTitle: string
    ) => {
        setState(prev => ({ ...prev, isLoading: true, error: null, generatedContent: null }));
        setActiveLessonId(null);
        try {
            const lessonContent = await generateLessonPlan(text, files, level, topic, slideCount, duration, studentCount, lessonTitle);
            setState({ isLoading: false, generatedContent: lessonContent, error: null });
            setViewMode('create');
        } catch (error: any) {
            console.error(error);
            let errorMessage = "Failed to generate lesson plan.";
            if (error.message) {
                if (error.message.includes('API key')) errorMessage = "Invalid API Key.";
                else if (error.message.includes('fetch') || error.message.includes('network')) errorMessage = "Network Error.";
                else if (error.message.includes('SAFE') || error.message.includes('Safety')) errorMessage = "Generation blocked by Safety Filters.";
                else errorMessage = error.message;
            }
            setState({ isLoading: false, generatedContent: null, error: errorMessage });
        }
    };

    const handleLoadCurriculum = (saved: SavedCurriculum) => {
        setLoadedCurriculum({ curriculum: saved.curriculum, params: saved.params });
        setViewMode('curriculum');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleLoadRecord = (record: SavedLesson) => {
        if (history.editingLessonId === record.id) return;
        setActiveLessonId(record.id);
        setState({ isLoading: false, generatedContent: record.content, error: null });
        setViewMode('create');
    };

    const handleGenerateLessonKit = (lesson: CurriculumLesson, params: CurriculumParams) => {
        const mapped = mapLessonToESLInput(lesson, params);
        setPrefilledValues(mapped);
        setState(prev => ({ ...prev, generatedContent: null, error: null }));
        setActiveLessonId(null);
        setViewMode('create');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleOpenKit = (savedLessonId: string) => {
        const record = savedLessons.find(l => l.id === savedLessonId);
        if (record) {
            setActiveLessonId(record.id);
            setState({ isLoading: false, generatedContent: record.content, error: null });
            setViewMode('create');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };


    const NAV_TABS: { key: string; label: string; icon: React.ReactNode; badge?: number }[] = [
        { key: 'curriculum', label: t('nav.curriculum'), icon: <BookOpen className="w-4 h-4" /> },
        { key: 'create', label: t('nav.planner'), icon: <Sparkles className="w-4 h-4" /> },
        { key: 'history', label: t('nav.records'), icon: <History className="w-4 h-4" />, badge: savedLessons.length + savedCurricula.length },
    ];

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-300 font-sans">
            <AppHeader
                appName="ESL Smart Planner"
                logoIcon={<Brain className="w-5 h-5" />}
                brand={{
                    logoBg: 'bg-gradient-to-br from-violet-600 to-purple-600',
                    logoText: 'text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-purple-600',
                    activeBg: 'bg-violet-100',
                    activeText: 'text-violet-700',
                    badgeBg: 'bg-violet-200',
                    badgeText: 'text-violet-700',
                }}
                tabs={NAV_TABS}
                activeTab={viewMode}
                onTabChange={(key) => setViewMode(key as typeof viewMode)}
                onLogoClick={() => { setViewMode('curriculum'); setState(p => ({ ...p, generatedContent: null })); setActiveLessonId(null); setPrefilledValues(null); setLoadedCurriculum(null); }}
                rightContent={<HeaderToggles lang={lang} onLangChange={setLang} />}
            />

            <PageLayout>
                <HeroBanner
                    title={lang === 'zh' ? 'AI 智能备课引擎' : 'Transform Teaching Materials in Seconds'}
                    description={lang === 'zh'
                        ? '上传教材 PDF、图片或粘贴文本，AI 自动生成结构化教案、互动课件和课堂游戏，适配任意 CEFR 等级。'
                        : 'Upload textbook pages, images, or paste text to generate comprehensive lesson plans, slides, and interactive games tailored to any CEFR level.'}
                    gradient="from-violet-600 via-purple-600 to-fuchsia-600"
                    tags={[
                        { label: lang === 'zh' ? '结构化教案' : 'Structured Plans' },
                        { label: lang === 'zh' ? '互动游戏' : 'Interactive Games' },
                        { label: lang === 'zh' ? '自然拼读' : 'Phonics Materials' },
                    ]}
                />
                <BodyContainer>
                    {viewMode === 'curriculum' && (
                        <div className="animate-fade-in-up">
                            <CurriculumPlanner
                                onGenerateKit={handleGenerateLessonKit}
                                onSaveCurriculum={handleSaveCurriculum}
                                loadedCurriculum={loadedCurriculum}
                                onBatchGenerate={handleBatchGenerate}
                                onCancelBatch={handleCancelBatch}
                                batchStatus={batchStatus}
                                batchLessonMap={batchLessonMap}
                                batchRunning={batchRunning}
                                batchProgress={batchProgress}
                                onOpenKit={handleOpenKit}
                            />
                        </div>
                    )}

                    {viewMode === 'create' && (
                        <>
                            {!state.generatedContent && (
                                <InputSection onGenerate={handleGenerate} isLoading={state.isLoading} initialValues={prefilledValues} />
                            )}
                            {state.error && <ErrorModal message={state.error} onClose={() => setState(prev => ({ ...prev, error: null }))} />}
                            {state.generatedContent && (
                                <div className="animate-fade-in-up">
                                    <div className="mb-4">
                                        <button onClick={() => { setState(prev => ({ ...prev, generatedContent: null })); setActiveLessonId(null); setPrefilledValues(null); }} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors mb-4 text-sm md:text-base">
                                            <ArrowLeft className="w-4 h-4" /> {t('plan.backToGenerator')}
                                        </button>
                                        <OutputDisplay key={activeLessonId || 'new'} content={state.generatedContent} onSave={(c) => handleSaveLesson(c)} />
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {viewMode === 'history' && (
                        <div className="animate-fade-in-up">

                            {/* Sub-tab toggle */}
                            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl mb-6 w-fit">
                                <button
                                    onClick={() => setRecordsTab('curricula')}
                                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-all ${recordsTab === 'curricula' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    <BookOpen className="w-4 h-4" />
                                    {t('rec.curricula')}
                                    {savedCurricula.length > 0 && <span className="text-[10px] bg-violet-100 text-violet-600 rounded-full px-1.5 py-0.5 font-bold">{savedCurricula.length}</span>}
                                </button>
                                <button
                                    onClick={() => setRecordsTab('kits')}
                                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-all ${recordsTab === 'kits' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    <Sparkles className="w-4 h-4" />
                                    {t('rec.lessonKits')}
                                    {savedLessons.length > 0 && <span className="text-[10px] bg-violet-100 text-violet-600 rounded-full px-1.5 py-0.5 font-bold">{savedLessons.length}</span>}
                                </button>
                            </div>

                            {/* ===== CURRICULA SECTION ===== */}
                            {recordsTab === 'curricula' && (
                                <>
                                    <FilterBar
                                        search={curSearch} onSearchChange={setCurSearch}
                                        level={curLevel} onLevelChange={setCurLevel}
                                        dateRange={curDate} onDateRangeChange={setCurDate}
                                        sort={curSort} onSortChange={setCurSort}
                                        extraFilters={
                                            <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
                                                <Hash className="w-3.5 h-3.5 text-slate-400" />
                                                <select value={curLessonRange} onChange={(e) => setCurLessonRange(e.target.value)} className="bg-transparent text-sm text-slate-700 outline-none font-medium cursor-pointer">
                                                    <option value="all">{t('rec.allCounts')}</option>
                                                    <option value="1-10">{t('rec.range1_10')}</option>
                                                    <option value="11-20">{t('rec.range11_20')}</option>
                                                    <option value="21-40">{t('rec.range21_40')}</option>
                                                    <option value="40+">{t('rec.range40plus')}</option>
                                                </select>
                                            </div>
                                        }
                                    />
                                    {filteredCurricula.length === 0 ? (
                                        <div className="text-center py-12 md:py-20 bg-white rounded-xl border border-dashed border-slate-300">
                                            {savedCurricula.length === 0 ? (
                                                <>
                                                    <BookOpen className="w-12 h-12 md:w-16 md:h-16 text-slate-300 mx-auto mb-4" />
                                                    <h3 className="text-base md:text-lg font-medium text-slate-600">{t('rec.noCurricula')}</h3>
                                                    <p className="text-sm text-slate-400">{t('rec.noCurriculaHint')}</p>
                                                    <button onClick={() => setViewMode('curriculum')} className="mt-4 text-violet-600 font-medium hover:underline">{t('rec.goDesign')}</button>
                                                </>
                                            ) : (
                                                <>
                                                    <Search className="w-12 h-12 md:w-16 md:h-16 text-slate-300 mx-auto mb-4" />
                                                    <h3 className="text-base md:text-lg font-medium text-slate-600">{t('rec.noResults')}</h3>
                                                    <button onClick={() => { setCurSearch(''); setCurLevel('All Levels'); setCurDate('all'); setCurLessonRange('all'); }} className="mt-4 text-violet-600 font-medium hover:underline">{t('rec.clearFilters')}</button>
                                                </>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                            {filteredCurricula.map(cur => (
                                                <RecordCard
                                                    key={cur.id}
                                                    title={cur.textbookTitle}
                                                    tags={[
                                                        { icon: <GraduationCap size={11} />, label: cur.targetLevel },
                                                        { icon: <Clock size={11} />, label: `${cur.params.duration} min` },
                                                        { icon: <Hash size={11} />, label: `${cur.totalLessons} ${t('rec.lessons')}`, accent: true },
                                                    ]}
                                                    timestamp={cur.timestamp}
                                                    openLabel={t('rec.openCurriculum')}
                                                    onOpen={() => handleLoadCurriculum(cur)}
                                                    onDelete={() => handleDeleteCurriculum(cur.id)}
                                                    accentColor="violet"
                                                />
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}

                            {/* ===== LESSON KITS SECTION ===== */}
                            {recordsTab === 'kits' && (
                                <>
                                    <FilterBar
                                        search={kitSearch} onSearchChange={setKitSearch}
                                        level={kitLevel} onLevelChange={setKitLevel}
                                        dateRange={kitDate} onDateRangeChange={setKitDate}
                                        sort={kitSort} onSortChange={setKitSort}
                                    />
                                    {filteredKits.length === 0 ? (
                                        <div className="text-center py-12 md:py-20 bg-white rounded-xl border border-dashed border-slate-300">
                                            {savedLessons.length === 0 ? (
                                                <>
                                                    <History className="w-12 h-12 md:w-16 md:h-16 text-slate-300 mx-auto mb-4" />
                                                    <h3 className="text-base md:text-lg font-medium text-slate-600">{t('rec.noKits')}</h3>
                                                    <p className="text-sm text-slate-400">{t('rec.noKitsHint')}</p>
                                                    <button onClick={() => setViewMode('create')} className="mt-4 text-violet-600 font-medium hover:underline">{t('rec.goCreate')}</button>
                                                </>
                                            ) : (
                                                <>
                                                    <Search className="w-12 h-12 md:w-16 md:h-16 text-slate-300 mx-auto mb-4" />
                                                    <h3 className="text-base md:text-lg font-medium text-slate-600">{t('rec.noResults')}</h3>
                                                    <button onClick={() => { setKitSearch(''); setKitLevel('All Levels'); setKitDate('all'); }} className="mt-4 text-violet-600 font-medium hover:underline">{t('rec.clearFilters')}</button>
                                                </>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                            {filteredKits.map(lesson => (
                                                <RecordCard
                                                    key={lesson.id}
                                                    title={lesson.topic}
                                                    tags={[
                                                        { icon: <GraduationCap size={11} />, label: lesson.level },
                                                        { icon: <BookOpen size={11} />, label: `${lesson.content.slides?.length || 0} Slides` },
                                                        { icon: <Sparkles size={11} />, label: `${lesson.content.games?.length || 0} Games`, accent: true },
                                                    ]}
                                                    timestamp={lesson.timestamp}
                                                    openLabel={activeLessonId === lesson.id ? t('rec.currentlyEditing') : t('rec.openKit')}
                                                    onOpen={() => handleLoadRecord(lesson)}
                                                    onDelete={() => handleDeleteRecord(lesson.id)}
                                                    onExport={() => handleDownloadZip(lesson, setIsExporting)}
                                                    exporting={isExporting === lesson.id}
                                                    onRename={(newName) => handleRenameLesson(lesson.id, newName)}
                                                    accentColor="violet"
                                                    active={activeLessonId === lesson.id}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </BodyContainer>
            </PageLayout>

            <footer className="bg-white dark:bg-slate-950/50 border-t border-slate-200 dark:border-white/5 mt-12 py-8">
                <div className="max-w-5xl mx-auto px-4 text-center text-slate-500 text-xs md:text-sm">
                    <p>{t('footer')}</p>
                </div>
            </footer>
        </div >
    );
};

const App: React.FC = () => (
    <LanguageProvider>
        <AppContent />
    </LanguageProvider>
);

export default App;
