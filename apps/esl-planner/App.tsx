import React, { useState, useEffect, useRef } from 'react';
import { CEFRLevel, AppState, SavedLesson, CurriculumLesson, CurriculumParams, ESLCurriculum, SavedCurriculum } from './types';
import { generateLessonPlan } from './services/geminiService';
import { InputSection } from './components/InputSection';
import { OutputDisplay } from './components/OutputDisplay';
import { CurriculumPlanner } from './components/CurriculumPlanner';
import { mapLessonToESLInput, MappedESLInput } from './utils/curriculumMapper';
import { Sparkles, Brain, Layout, History, Trash2, Edit3, ArrowLeft, Calendar, BookOpen, Check, X, Download, Loader2, Search, Hash, Clock } from 'lucide-react';
import { FilterBar } from './components/FilterBar';
import { ErrorModal } from './components/ErrorModal';
import { handleDownloadZip } from './utils/exportUtils';
import { useLessonHistory } from './hooks/useLessonHistory';
import { useBatchGenerate } from './hooks/useBatchGenerate';
import { AppHeader } from '@shared/components/AppHeader';

const INDIGO_COLOR = '#4f46e5';



const App: React.FC = () => {
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
        handleSaveLesson, handleSaveCurriculum, handleDeleteCurriculum, handleDeleteRecord,
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
        { key: 'curriculum', label: 'Curriculum', icon: <BookOpen className="w-4 h-4" /> },
        { key: 'create', label: 'Planner', icon: <Sparkles className="w-4 h-4" /> },
        { key: 'history', label: 'Records', icon: <History className="w-4 h-4" />, badge: savedLessons.length + savedCurricula.length },
    ];

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
            <AppHeader
                appName="ESL Smart Planner"
                subtitle="AI-Powered Curriculum Assistant"
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
            />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
                {/* Curriculum Tab */}
                {viewMode === 'curriculum' && (
                    <div className="animate-fade-in-up">
                        <div className="mb-8 bg-gradient-to-r from-violet-500 to-purple-600 rounded-xl p-6 md:p-8 text-white shadow-lg relative overflow-hidden">
                            <div className="relative z-10 max-w-2xl">
                                <h2 className="text-2xl md:text-3xl font-bold mb-3 md:mb-4">Curriculum Designer</h2>
                                <p className="text-violet-100 text-sm md:text-lg">
                                    上传PDF教材，AI自动按课时数拆分为结构化课程大纲。点击任意课时即可一键生成完整Lesson Kit。
                                </p>
                            </div>
                            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 md:w-64 md:h-64 bg-white/10 rounded-full blur-3xl"></div>
                            <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-24 h-24 md:w-40 md:h-40 bg-white/10 rounded-full blur-2xl"></div>
                        </div>
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

                {/* Create/Planner Tab */}
                {viewMode === 'create' && (
                    <>
                        {!state.generatedContent && !state.isLoading && (
                            <div className="mb-8 bg-gradient-to-r from-violet-500 to-purple-600 rounded-xl p-6 md:p-8 text-white shadow-lg relative overflow-hidden">
                                <div className="relative z-10 max-w-2xl">
                                    <h2 className="text-2xl md:text-3xl font-bold mb-3 md:mb-4">Transform Teaching Materials in Seconds</h2>
                                    <p className="text-violet-100 mb-6 text-sm md:text-lg">Upload textbook pages, images, or paste text to generate comprehensive lesson plans, slides, and interactive games tailored to any CEFR level.</p>
                                    <div className="flex flex-wrap gap-3 md:gap-4">
                                        <div className="flex items-center gap-2 bg-white/20 px-3 py-1.5 md:px-4 md:py-2 rounded-xl backdrop-blur-sm text-xs md:text-base">
                                            <Layout className="w-4 h-4 md:w-5 md:h-5" /><span className="font-medium">Structured Plans</span>
                                        </div>
                                        <div className="flex items-center gap-2 bg-white/20 px-3 py-1.5 md:px-4 md:py-2 rounded-xl backdrop-blur-sm text-xs md:text-base">
                                            <Sparkles className="w-4 h-4 md:w-5 md:h-5" /><span className="font-medium">Interactive Games</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 md:w-64 md:h-64 bg-white/10 rounded-full blur-3xl"></div>
                                <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-24 h-24 md:w-40 md:h-40 bg-white/10 rounded-full blur-2xl"></div>
                            </div>
                        )}
                        {!state.generatedContent && (
                            <InputSection onGenerate={handleGenerate} isLoading={state.isLoading} initialValues={prefilledValues} />
                        )}
                        {state.error && <ErrorModal message={state.error} onClose={() => setState(prev => ({ ...prev, error: null }))} />}
                        {state.generatedContent && (
                            <div className="animate-fade-in-up">
                                <div className="mb-4">
                                    <button onClick={() => { setState(prev => ({ ...prev, generatedContent: null })); setActiveLessonId(null); setPrefilledValues(null); }} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors mb-4 text-sm md:text-base">
                                        <ArrowLeft className="w-4 h-4" /> Back to Generator
                                    </button>
                                    <OutputDisplay key={activeLessonId || 'new'} content={state.generatedContent} onSave={(c) => handleSaveLesson(c)} />
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* History/Records Tab */}
                {viewMode === 'history' && (
                    <div className="animate-fade-in-up">
                        <div className="mb-6 md:mb-8">
                            <h2 className="text-xl md:text-2xl font-bold text-slate-800 mb-2">Saved Records</h2>
                            <p className="text-sm md:text-base text-slate-500">管理已保存的课程大纲和Lesson Kit。</p>
                        </div>

                        {/* Sub-tab toggle */}
                        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl mb-6 w-fit">
                            <button
                                onClick={() => setRecordsTab('curricula')}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-all ${recordsTab === 'curricula' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <BookOpen className="w-4 h-4" />
                                Curricula
                                {savedCurricula.length > 0 && <span className="text-[10px] bg-violet-100 text-violet-600 rounded-full px-1.5 py-0.5 font-bold">{savedCurricula.length}</span>}
                            </button>
                            <button
                                onClick={() => setRecordsTab('kits')}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-all ${recordsTab === 'kits' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <Sparkles className="w-4 h-4" />
                                Lesson Kits
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
                                                <option value="all">All Counts</option>
                                                <option value="1-10">1-10 课时</option>
                                                <option value="11-20">11-20 课时</option>
                                                <option value="21-40">21-40 课时</option>
                                                <option value="40+">40+ 课时</option>
                                            </select>
                                        </div>
                                    }
                                />
                                {filteredCurricula.length === 0 ? (
                                    <div className="text-center py-12 md:py-20 bg-white rounded-xl border border-dashed border-slate-300">
                                        {savedCurricula.length === 0 ? (
                                            <>
                                                <BookOpen className="w-12 h-12 md:w-16 md:h-16 text-slate-300 mx-auto mb-4" />
                                                <h3 className="text-base md:text-lg font-medium text-slate-600">还没有保存的课程大纲</h3>
                                                <p className="text-sm text-slate-400">在 Curriculum 页面生成并保存课程大纲后即可在此查看。</p>
                                                <button onClick={() => setViewMode('curriculum')} className="mt-4 text-violet-600 font-medium hover:underline">去设计课程 →</button>
                                            </>
                                        ) : (
                                            <>
                                                <Search className="w-12 h-12 md:w-16 md:h-16 text-slate-300 mx-auto mb-4" />
                                                <h3 className="text-base md:text-lg font-medium text-slate-600">没有匹配的结果</h3>
                                                <button onClick={() => { setCurSearch(''); setCurLevel('All Levels'); setCurDate('all'); setCurLessonRange('all'); }} className="mt-4 text-violet-600 font-medium hover:underline">清除所有筛选</button>
                                            </>
                                        )}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                                        {filteredCurricula.map(cur => (
                                            <div
                                                key={cur.id}
                                                onClick={() => handleLoadCurriculum(cur)}
                                                className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col h-full hover:border-violet-300"
                                            >
                                                <div className="p-4 md:p-5 flex-1">
                                                    <div className="flex justify-between items-start mb-3">
                                                        <span className="px-2.5 py-1 rounded-lg text-[10px] md:text-xs font-bold uppercase tracking-wide bg-violet-100 text-violet-700">
                                                            {cur.targetLevel}
                                                        </span>
                                                        <button onClick={(e) => handleDeleteCurriculum(cur.id, e)} className="text-red-500 bg-red-50 hover:bg-red-100 p-1.5 rounded-full transition-all" title="Delete">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                    <h3 className="text-base md:text-lg font-bold text-slate-800 mb-2 line-clamp-2" title={cur.textbookTitle}>{cur.textbookTitle}</h3>
                                                    <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                                                        <span className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-md">
                                                            <Hash className="w-3 h-3" /> {cur.totalLessons} 课时
                                                        </span>
                                                        <span className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-md">
                                                            <Clock className="w-3 h-3" /> {cur.params.duration} min
                                                        </span>
                                                        <span className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-md">
                                                            <Calendar className="w-3 h-3" /> {new Date(cur.timestamp).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="bg-slate-50 px-4 py-2.5 md:px-5 md:py-3 border-t border-slate-100 flex justify-between items-center text-xs md:text-sm font-medium text-violet-600 group-hover:bg-violet-50/50 transition-colors">
                                                    <span>打开课程大纲</span>
                                                    <ArrowLeft className="w-3.5 h-3.5 md:w-4 md:h-4 rotate-180" />
                                                </div>
                                            </div>
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
                                                <h3 className="text-base md:text-lg font-medium text-slate-600">还没有保存的 Lesson Kit</h3>
                                                <p className="text-sm text-slate-400">生成并保存一个 Lesson Kit 后即可在此查看。</p>
                                                <button onClick={() => setViewMode('create')} className="mt-4 text-violet-600 font-medium hover:underline">去创建 Lesson Kit →</button>
                                            </>
                                        ) : (
                                            <>
                                                <Search className="w-12 h-12 md:w-16 md:h-16 text-slate-300 mx-auto mb-4" />
                                                <h3 className="text-base md:text-lg font-medium text-slate-600">没有匹配的结果</h3>
                                                <button onClick={() => { setKitSearch(''); setKitLevel('All Levels'); setKitDate('all'); }} className="mt-4 text-violet-600 font-medium hover:underline">清除所有筛选</button>
                                            </>
                                        )}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                                        {filteredKits.map(lesson => (
                                            <div
                                                key={lesson.id}
                                                onClick={() => handleLoadRecord(lesson)}
                                                className={`bg-white rounded-xl border shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col h-full relative ${activeLessonId === lesson.id ? 'border-violet-500 ring-1 ring-violet-500' : 'border-slate-200 hover:border-violet-300'}`}
                                            >
                                                <div className="p-4 md:p-5 flex-1">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <span className={`px-2 py-1 rounded text-[10px] md:text-xs font-bold uppercase tracking-wide
                                                            ${lesson.level.includes('Beginner') || lesson.level === 'A1' ? 'bg-green-100 text-green-700' :
                                                                lesson.level === 'A2' || lesson.level === 'B1' ? 'bg-blue-100 text-blue-700' :
                                                                    'bg-purple-100 text-purple-700'}`}
                                                        >
                                                            {lesson.level}
                                                        </span>
                                                        <div className="flex gap-1 relative z-50">
                                                            <button
                                                                onClick={(e) => handleDownloadZip(lesson, setIsExporting, e)}
                                                                disabled={isExporting === lesson.id}
                                                                title="Download All as Zip"
                                                                className="text-slate-400 hover:text-violet-600 p-1.5 rounded-full hover:bg-violet-50 transition-all"
                                                            >
                                                                {isExporting === lesson.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                                            </button>
                                                            <button onClick={(e) => handleDeleteRecord(lesson.id, e)} className="text-red-500 bg-red-50 hover:bg-red-100 p-1.5 rounded-full transition-all" title="Delete">
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {editingLessonId === lesson.id ? (
                                                        <div className="mb-2 flex items-center gap-1 relative z-20" onClick={(e) => e.stopPropagation()}>
                                                            <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                                                                className="flex-1 border border-violet-300 rounded-xl px-2 py-1 text-base md:text-lg font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500 min-w-0"
                                                                autoFocus onClick={(e) => e.stopPropagation()}
                                                                onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(lesson.id, e); if (e.key === 'Escape') cancelEditing(e as any); }} />
                                                            <button onClick={(e) => saveTitle(lesson.id, e)} className="p-1.5 text-green-600 bg-green-50 hover:bg-green-100 rounded shadow-sm"><Check className="w-4 h-4" /></button>
                                                            <button onClick={cancelEditing} className="p-1.5 text-red-500 bg-red-50 hover:bg-red-100 rounded shadow-sm"><X className="w-4 h-4" /></button>
                                                        </div>
                                                    ) : (
                                                        <div className="group/title relative pr-6">
                                                            <h3 className="text-base md:text-lg font-bold text-slate-800 mb-2 line-clamp-2" title={lesson.topic}>{lesson.topic}</h3>
                                                            <button onClick={(e) => startEditing(lesson, e)}
                                                                className="absolute top-0 right-0 opacity-100 lg:opacity-0 lg:group-hover/title:opacity-100 text-slate-400 hover:text-violet-600 p-1 transition-opacity z-10" title="Rename">
                                                                <Edit3 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    )}

                                                    <div className="space-y-2 text-xs md:text-sm text-slate-500">
                                                        <div className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5" /><span>{new Date(lesson.timestamp).toLocaleDateString()}</span></div>
                                                        <div className="flex items-center gap-2"><BookOpen className="w-3.5 h-3.5" /><span>{lesson.content.slides?.length || 0} Slides, {lesson.content.games?.length || 0} Games</span></div>
                                                    </div>
                                                </div>
                                                <div className="bg-slate-50 px-4 py-2 md:px-5 md:py-3 border-t border-slate-100 flex justify-between items-center text-xs md:text-sm font-medium text-violet-600 group-hover:bg-violet-50/50 transition-colors">
                                                    <span>{activeLessonId === lesson.id ? 'Currently Editing' : 'Open Kit'}</span>
                                                    <Edit3 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </main>

            <footer className="bg-white border-t border-slate-200 mt-12 py-8">
                <div className="max-w-7xl mx-auto px-4 text-center text-slate-500 text-xs md:text-sm">
                    <p>&copy; {new Date().getFullYear()} ESL Smart Planner. Built with Google Gemini.</p>
                </div>
            </footer>
        </div>
    );
};

export default App;
