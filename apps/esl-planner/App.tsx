import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CEFRLevel, GeneratedContent, AppState, SavedLesson, Worksheet, StructuredLessonPlan, Game, ReadingCompanionContent, Slide, CurriculumLesson, CurriculumParams, ESLCurriculum, SavedCurriculum } from './types';
import { generateLessonPlan, generateWorksheet } from './services/geminiService';
import { InputSection } from './components/InputSection';
import { OutputDisplay } from './components/OutputDisplay';
import { CurriculumPlanner } from './components/CurriculumPlanner';
import { mapLessonToESLInput, MappedESLInput } from './utils/curriculumMapper';
import { Sparkles, Brain, Layout, History, Trash2, Edit3, ArrowLeft, Calendar, BookOpen, Check, X, Download, Loader2, FileArchive, Search, Filter, SortAsc, Hash, GraduationCap, Clock } from 'lucide-react';
import JSZip from 'jszip';

const INDIGO_COLOR = '#4f46e5';

// --- Date range helpers ---
const isToday = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    return d.toDateString() === now.toDateString();
};
const isThisWeek = (ts: number) => {
    const now = new Date();
    const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    return ts >= weekAgo.getTime();
};
const isThisMonth = (ts: number) => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return ts >= monthStart.getTime();
};

// --- Shared filter bar component ---
interface FilterBarProps {
    search: string;
    onSearchChange: (v: string) => void;
    level: string;
    onLevelChange: (v: string) => void;
    dateRange: string;
    onDateRangeChange: (v: string) => void;
    sort: string;
    onSortChange: (v: string) => void;
    extraFilters?: React.ReactNode;
}

const FilterBar: React.FC<FilterBarProps> = ({ search, onSearchChange, level, onLevelChange, dateRange, onDateRangeChange, sort, onSortChange, extraFilters }) => (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6">
        <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                    type="text"
                    placeholder="搜索标题/主题..."
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition-all"
                />
            </div>
            <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
                    <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                    <select value={level} onChange={(e) => onLevelChange(e.target.value)} className="bg-transparent text-sm text-slate-700 outline-none font-medium cursor-pointer">
                        <option>All Levels</option>
                        {Object.values(CEFRLevel).map(lvl => (<option key={lvl} value={lvl}>{lvl}</option>))}
                    </select>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <select value={dateRange} onChange={(e) => onDateRangeChange(e.target.value)} className="bg-transparent text-sm text-slate-700 outline-none font-medium cursor-pointer">
                        <option value="all">All Time</option>
                        <option value="today">Today</option>
                        <option value="week">This Week</option>
                        <option value="month">This Month</option>
                    </select>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
                    <SortAsc className="w-3.5 h-3.5 text-slate-400" />
                    <select value={sort} onChange={(e) => onSortChange(e.target.value)} className="bg-transparent text-sm text-slate-700 outline-none font-medium cursor-pointer">
                        <option value="newest">Newest</option>
                        <option value="oldest">Oldest</option>
                        <option value="az">A-Z</option>
                        <option value="za">Z-A</option>
                    </select>
                </div>
                {extraFilters}
            </div>
        </div>
    </div>
);

const App: React.FC = () => {
    const [state, setState] = useState<AppState>({
        isLoading: false,
        generatedContent: null,
        error: null,
    });

    const [savedLessons, setSavedLessons] = useState<SavedLesson[]>([]);
    const [savedCurricula, setSavedCurricula] = useState<SavedCurriculum[]>([]);
    const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'curriculum' | 'create' | 'history'>('curriculum');
    const [isExporting, setIsExporting] = useState<string | null>(null);

    // Pre-fill values for InputSection (from curriculum)
    const [prefilledValues, setPrefilledValues] = useState<MappedESLInput | null>(null);
    // Loaded curriculum for restoring from Records
    const [loadedCurriculum, setLoadedCurriculum] = useState<{ curriculum: ESLCurriculum; params: CurriculumParams } | null>(null);

    // Records sub-tab
    const [recordsTab, setRecordsTab] = useState<'curricula' | 'kits'>('curricula');

    // --- Batch generation state ---
    const [batchStatus, setBatchStatus] = useState<Record<number, 'idle' | 'generating' | 'done' | 'error'>>({});
    const [batchLessonMap, setBatchLessonMap] = useState<Record<number, string>>({});
    const [batchRunning, setBatchRunning] = useState(false);
    const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0, errors: 0 });
    const batchCancelRef = useRef(false);
    // Keep a mutable ref for savedLessons so the batch loop always sees latest
    const savedLessonsRef = useRef(savedLessons);
    useEffect(() => { savedLessonsRef.current = savedLessons; }, [savedLessons]);

    // Modal Component for Errors
    const ErrorModal = ({ message, onClose }: { message: string, onClose: () => void }) => (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-xl shadow-sm max-w-md w-full overflow-hidden transform animate-scale-in">
                <div className="bg-red-50 p-6 flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                        <X className="w-10 h-10 text-red-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Generation Failed</h3>
                    <p className="text-gray-600 text-sm leading-relaxed">We encountered an error while creating your lesson materials.</p>
                </div>
                <div className="p-6">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 text-center">Error Detail</p>
                        <p className="text-slate-700 text-sm font-medium text-center break-words">{message}</p>
                    </div>
                    <button onClick={onClose} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg active:scale-95">
                        I Understand
                    </button>
                </div>
            </div>
        </div>
    );

    // --- Curricula filter state ---
    const [curSearch, setCurSearch] = useState('');
    const [curLevel, setCurLevel] = useState('All Levels');
    const [curDate, setCurDate] = useState('all');
    const [curSort, setCurSort] = useState('newest');
    const [curLessonRange, setCurLessonRange] = useState('all');

    // --- Kits filter state ---
    const [kitSearch, setKitSearch] = useState('');
    const [kitLevel, setKitLevel] = useState('All Levels');
    const [kitDate, setKitDate] = useState('all');
    const [kitSort, setKitSort] = useState('newest');

    // Title Editing State
    const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');

    // Load saved data on mount
    useEffect(() => {
        try {
            const lessons = localStorage.getItem('esl_smart_planner_history');
            if (lessons) setSavedLessons(JSON.parse(lessons));
        } catch (e) { console.error("Failed to load history", e); }
        try {
            const curricula = localStorage.getItem('esl_planner_curricula');
            if (curricula) setSavedCurricula(JSON.parse(curricula));
        } catch (e) { console.error("Failed to load curricula", e); }
    }, []);

    // --- Filtered Curricula ---
    const filteredCurricula = useMemo(() => {
        let result = [...savedCurricula];
        if (curSearch.trim()) {
            const q = curSearch.toLowerCase();
            result = result.filter(c => c.textbookTitle.toLowerCase().includes(q) || c.targetLevel.toLowerCase().includes(q));
        }
        if (curLevel !== 'All Levels') result = result.filter(c => c.targetLevel === curLevel);
        if (curDate === 'today') result = result.filter(c => isToday(c.timestamp));
        else if (curDate === 'week') result = result.filter(c => isThisWeek(c.timestamp));
        else if (curDate === 'month') result = result.filter(c => isThisMonth(c.timestamp));
        if (curLessonRange !== 'all') {
            result = result.filter(c => {
                const n = c.totalLessons;
                if (curLessonRange === '1-10') return n >= 1 && n <= 10;
                if (curLessonRange === '11-20') return n >= 11 && n <= 20;
                if (curLessonRange === '21-40') return n >= 21 && n <= 40;
                if (curLessonRange === '40+') return n > 40;
                return true;
            });
        }
        result.sort((a, b) => {
            if (curSort === 'newest') return b.timestamp - a.timestamp;
            if (curSort === 'oldest') return a.timestamp - b.timestamp;
            if (curSort === 'az') return a.textbookTitle.localeCompare(b.textbookTitle);
            if (curSort === 'za') return b.textbookTitle.localeCompare(a.textbookTitle);
            return 0;
        });
        return result;
    }, [savedCurricula, curSearch, curLevel, curDate, curSort, curLessonRange]);

    // --- Filtered Kits ---
    const filteredKits = useMemo(() => {
        let result = [...savedLessons];
        if (kitSearch.trim()) {
            const q = kitSearch.toLowerCase();
            result = result.filter(l => l.topic.toLowerCase().includes(q));
        }
        if (kitLevel !== 'All Levels') result = result.filter(l => l.level === kitLevel);
        if (kitDate === 'today') result = result.filter(l => isToday(l.timestamp));
        else if (kitDate === 'week') result = result.filter(l => isThisWeek(l.timestamp));
        else if (kitDate === 'month') result = result.filter(l => isThisMonth(l.timestamp));
        result.sort((a, b) => {
            if (kitSort === 'newest') return b.timestamp - a.timestamp;
            if (kitSort === 'oldest') return a.timestamp - b.timestamp;
            if (kitSort === 'az') return a.topic.localeCompare(b.topic);
            if (kitSort === 'za') return b.topic.localeCompare(a.topic);
            return 0;
        });
        return result;
    }, [savedLessons, kitSearch, kitLevel, kitDate, kitSort]);

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

    const handleSaveLesson = (content: GeneratedContent) => {
        let updatedHistory = [...savedLessons];
        if (activeLessonId) {
            updatedHistory = updatedHistory.map(lesson => {
                if (lesson.id === activeLessonId) {
                    return { ...lesson, lastModified: Date.now(), topic: content.structuredLessonPlan.classInformation.topic || lesson.topic, level: content.structuredLessonPlan.classInformation.level, content };
                }
                return lesson;
            });
        } else {
            const id = Date.now().toString();
            const newRecord: SavedLesson = { id, timestamp: Date.now(), lastModified: Date.now(), topic: content.structuredLessonPlan.classInformation.topic || 'Untitled Lesson', level: content.structuredLessonPlan.classInformation.level, content };
            updatedHistory = [newRecord, ...updatedHistory];
            setActiveLessonId(id);
        }
        setSavedLessons(updatedHistory);
        localStorage.setItem('esl_smart_planner_history', JSON.stringify(updatedHistory));
    };

    // --- Curriculum save handler ---
    const handleSaveCurriculum = (curriculum: ESLCurriculum, params: CurriculumParams) => {
        // Check if already saved (same textbook title + lesson count)
        const exists = savedCurricula.find(c => c.textbookTitle === curriculum.textbookTitle && c.totalLessons === curriculum.totalLessons);
        let updated: SavedCurriculum[];
        if (exists) {
            updated = savedCurricula.map(c => c.id === exists.id ? { ...c, lastModified: Date.now(), curriculum, params } : c);
        } else {
            const newRecord: SavedCurriculum = {
                id: Date.now().toString(),
                timestamp: Date.now(),
                lastModified: Date.now(),
                textbookTitle: curriculum.textbookTitle,
                targetLevel: curriculum.targetLevel,
                totalLessons: curriculum.totalLessons,
                curriculum,
                params,
            };
            updated = [newRecord, ...savedCurricula];
        }
        setSavedCurricula(updated);
        localStorage.setItem('esl_planner_curricula', JSON.stringify(updated));
    };

    const handleDeleteCurriculum = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const updated = savedCurricula.filter(c => c.id !== id);
        setSavedCurricula(updated);
        localStorage.setItem('esl_planner_curricula', JSON.stringify(updated));
    };

    const handleLoadCurriculum = (saved: SavedCurriculum) => {
        setLoadedCurriculum({ curriculum: saved.curriculum, params: saved.params });
        setViewMode('curriculum');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDeleteRecord = (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const updated = savedLessons.filter(l => l.id !== id);
        if (activeLessonId === id) setActiveLessonId(null);
        setSavedLessons(updated);
        localStorage.setItem('esl_smart_planner_history', JSON.stringify(updated));
    };

    const handleLoadRecord = (record: SavedLesson) => {
        if (editingLessonId === record.id) return;
        setActiveLessonId(record.id);
        setState({ isLoading: false, generatedContent: record.content, error: null });
        setViewMode('create');
    };

    const startEditing = (lesson: SavedLesson, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingLessonId(lesson.id);
        setEditTitle(lesson.topic);
    };

    const saveTitle = (id: string, e?: React.MouseEvent | React.KeyboardEvent) => {
        if (e) e.stopPropagation();
        if (!editTitle.trim()) return;
        const updated = savedLessons.map(l => {
            if (l.id === id) {
                return { ...l, topic: editTitle, lastModified: Date.now(), content: { ...l.content, structuredLessonPlan: { ...l.content.structuredLessonPlan, classInformation: { ...l.content.structuredLessonPlan.classInformation, topic: editTitle } } } };
            }
            return l;
        });
        setSavedLessons(updated);
        localStorage.setItem('esl_smart_planner_history', JSON.stringify(updated));
        setEditingLessonId(null);
    };

    const cancelEditing = (e: React.MouseEvent) => { e.stopPropagation(); setEditingLessonId(null); };

    // --- Curriculum handler ---
    const handleGenerateLessonKit = (lesson: CurriculumLesson, params: CurriculumParams) => {
        const mapped = mapLessonToESLInput(lesson, params);
        setPrefilledValues(mapped);
        setState(prev => ({ ...prev, generatedContent: null, error: null }));
        setActiveLessonId(null);
        setViewMode('create');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // --- Batch generate all kits ---
    const handleBatchGenerate = async (lessons: CurriculumLesson[], params: CurriculumParams) => {
        batchCancelRef.current = false;
        setBatchRunning(true);
        setBatchProgress({ done: 0, total: lessons.length, errors: 0 });
        let doneCount = 0;
        let errorCount = 0;

        for (let i = 0; i < lessons.length; i++) {
            if (batchCancelRef.current) break;

            // Skip already generated
            if (batchStatus[i] === 'done') {
                doneCount++;
                setBatchProgress(p => ({ ...p, done: doneCount }));
                continue;
            }

            setBatchStatus(prev => ({ ...prev, [i]: 'generating' }));
            try {
                const mapped = mapLessonToESLInput(lessons[i], params);
                const content = await generateLessonPlan(
                    mapped.text, [], mapped.level, mapped.topic,
                    mapped.slideCount, mapped.duration, mapped.studentCount, mapped.lessonTitle
                );

                // Auto-save to Records
                const id = Date.now().toString();
                const newRecord: SavedLesson = {
                    id,
                    timestamp: Date.now(),
                    lastModified: Date.now(),
                    topic: content.structuredLessonPlan.classInformation.topic || lessons[i].title,
                    level: content.structuredLessonPlan.classInformation.level,
                    content,
                };
                const updatedLessons = [newRecord, ...savedLessonsRef.current];
                setSavedLessons(updatedLessons);
                localStorage.setItem('esl_smart_planner_history', JSON.stringify(updatedLessons));

                setBatchStatus(prev => ({ ...prev, [i]: 'done' }));
                setBatchLessonMap(prev => ({ ...prev, [i]: id }));
                doneCount++;
            } catch (err: any) {
                console.error(`Batch generate lesson ${i + 1} failed:`, err);
                setBatchStatus(prev => ({ ...prev, [i]: 'error' }));
                errorCount++;
            }
            setBatchProgress({ done: doneCount, total: lessons.length, errors: errorCount });
        }
        setBatchRunning(false);
    };

    const handleCancelBatch = () => { batchCancelRef.current = true; };

    const handleOpenKit = (savedLessonId: string) => {
        const record = savedLessons.find(l => l.id === savedLessonId);
        if (record) {
            setActiveLessonId(record.id);
            setState({ isLoading: false, generatedContent: record.content, error: null });
            setViewMode('create');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    // --- EXPORT UTILITIES ---
    const formatLessonPlanMd = (plan: StructuredLessonPlan) => {
        let md = `# Lesson Plan: ${plan.classInformation.topic}\n\n`;
        md += `## 📋 Class Information\n- **Level:** ${plan.classInformation.level}\n- **Date:** ${plan.classInformation.date}\n- **Topic:** ${plan.classInformation.topic}\n- **Students:** ${plan.classInformation.students}\n\n`;
        md += `## 🎯 Objectives\n`;
        plan.lessonDetails.objectives.forEach(obj => md += `- ${obj}\n`);
        md += `\n## 🛠️ Materials & Equipment\n`;
        plan.lessonDetails.materials.forEach(mat => md += `- ${mat}\n`);
        md += `\n## 📚 Target Vocabulary\n`;
        plan.lessonDetails.targetVocab.forEach(v => md += `- **${v.word}**: ${v.definition}\n`);
        md += `\n## 📝 Grammar & Target Sentences\n`;
        plan.lessonDetails.grammarSentences.forEach(s => md += `- ${s}\n`);
        md += `\n## ⚠️ Anticipated Problems & Solutions\n`;
        plan.lessonDetails.anticipatedProblems.forEach(p => md += `### Problem: ${p.problem}\n**Solution:** ${p.solution}\n\n`);
        md += `## 🏃 Teaching Stages\n\n| Stage | Timing | Interaction | Aim |\n| :--- | :--- | :--- | :--- |\n`;
        plan.stages.forEach(s => md += `| ${s.stage} | ${s.timing} | ${s.interaction} | ${s.stageAim} |\n`);
        md += `\n\n`;
        plan.stages.forEach(s => { md += `### Stage: ${s.stage} (${s.timing})\n**Teacher Activity:**\n${s.teacherActivity}\n\n**Student Activity:**\n${s.studentActivity}\n\n---\n\n`; });
        return md;
    };
    const formatSlidesMd = (slides: Slide[]) => {
        let md = `# PPT Presentation Outline\n\n`;
        slides.forEach((s, i) => { md += `## Slide ${i + 1}: ${s.title}\n### 📄 Content\n${s.content}\n\n### 👁️ Visual\n${s.visual}\n\n### 🎤 Layout Design\n${s.layoutDesign}\n\n---\n\n`; });
        return md;
    };
    const formatGamesMd = (games: Game[]) => {
        let md = `# Classroom Games & Activities\n\n`;
        games.forEach(g => { md += `## 🎮 ${g.name}\n- **Type:** ${g.type}\n- **Interaction:** ${g.interactionType}\n- **Materials Needed:** ${g.materials.join(', ') || 'None'}\n\n### Instructions\n${g.instructions}\n\n---\n\n`; });
        return md;
    };
    const formatCompanionMd = (companion: ReadingCompanionContent) => {
        let md = `# 📅 Post-Class Review Plan\n\n`;
        companion.days.forEach(day => {
            md += `## Day ${day.day}: ${day.focus} (${day.focus_cn})\n### 🏋️ Main Activity\n${day.activity} (${day.activity_cn})\n\n### ✅ Tasks\n`;
            day.tasks?.forEach(t => md += `- [ ] ${t.text} (${t.text_cn})\n`);
            if (day.trivia) md += `\n### 💡 Day Trivia Fact\n- **EN:** ${day.trivia.en}\n- **CN:** ${day.trivia.cn}\n`;
            md += `\n### 🔗 Resources\n`;
            day.resources?.forEach(r => md += `- [${r.title}](${r.url}) - ${r.description}\n`);
            md += `\n---\n\n`;
        });
        return md;
    };
    const formatWorksheetQuestionsMd = (worksheets: Worksheet[]) => {
        let md = `# 📝 Review Worksheets (Questions)\n\n`;
        worksheets.forEach(ws => {
            md += `## ${ws.title}\n*${ws.instructions}*\n\n`;
            ws.sections?.forEach((sec, sIdx) => {
                md += `### Section ${sIdx + 1}: ${sec.title}\n`;
                if (sec.description) md += `*${sec.description}*\n\n`;
                if (sec.passage) md += `> ${sec.passage}\n\n`;
                if (sec.layout === 'matching') {
                    md += `| Column A | Column B |\n| :--- | :--- |\n`;
                    sec.items.forEach(item => md += `| ${item.question} | [ ] |\n`);
                } else {
                    sec.items.forEach((item, i) => {
                        md += `${i + 1}. ${item.question}\n`;
                        if (item.options?.length) { md += `\n`; item.options.forEach((opt, oi) => md += `   ${String.fromCharCode(65 + oi)}) ${opt}\n`); }
                        md += `\n`;
                    });
                }
                md += `\n---\n\n`;
            });
        });
        return md;
    };
    const formatWorksheetAnswersMd = (worksheets: Worksheet[]) => {
        let md = `# ✅ Worksheet Answer Key\n\n`;
        worksheets.forEach(ws => {
            md += `## ${ws.title} - Answers\n\n`;
            ws.sections?.forEach((sec, sIdx) => {
                md += `### Section ${sIdx + 1}: ${sec.title}\n`;
                sec.items.forEach((item, i) => {
                    const optIdx = item.options?.indexOf(item.answer) ?? -1;
                    const optPrefix = optIdx !== -1 ? `${String.fromCharCode(65 + optIdx)}) ` : "";
                    md += `${i + 1}. **${optPrefix}${item.answer}**\n`;
                });
                md += `\n`;
            });
            md += `---\n\n`;
        });
        return md;
    };

    const handleDownloadZip = async (lesson: SavedLesson, e: React.MouseEvent) => {
        e.stopPropagation();
        setIsExporting(lesson.id);
        try {
            const zip = new JSZip();
            const content = lesson.content;
            const topic = (content.structuredLessonPlan.classInformation.topic || lesson.topic).replace(/[^a-z0-9]/gi, '_').toLowerCase();
            zip.file("1_Lesson_Plan.md", formatLessonPlanMd(content.structuredLessonPlan));
            zip.file("2_Slides_Outline.md", formatSlidesMd(content.slides));
            zip.file("3_Classroom_Games.md", formatGamesMd(content.games));
            zip.file("4_Review_Companion.md", formatCompanionMd(content.readingCompanion));
            if (content.worksheets) {
                zip.file("5a_Worksheet_Questions.md", formatWorksheetQuestionsMd(content.worksheets));
                zip.file("5b_Worksheet_Answer_Key.md", formatWorksheetAnswersMd(content.worksheets));
            }
            let flashcardsMd = `# Teaching Flashcards\n\n`;
            content.flashcards.forEach(c => { flashcardsMd += `## ${c.word}\n- **Definition:** ${c.definition}\n- **Visual Prompt:** ${c.visualPrompt}\n\n`; });
            zip.file("6_Flashcards_List.md", flashcardsMd);
            zip.file("NotebookLM_Slide_Prompt.txt", content.notebookLMPrompt);
            const blob = await zip.generateAsync({ type: "blob" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `ESL_Kit_${topic}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Export failed", err);
            alert("Export failed. Please try again.");
        } finally {
            setIsExporting(null);
        }
    };

    const NAV_TABS: { key: typeof viewMode; label: string; icon: React.ReactNode }[] = [
        { key: 'curriculum', label: 'Curriculum', icon: <BookOpen className="w-4 h-4" /> },
        { key: 'create', label: 'Planner', icon: <Sparkles className="w-4 h-4" /> },
        { key: 'history', label: 'Records', icon: <History className="w-4 h-4" /> },
    ];

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
            <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center gap-2 md:gap-3 cursor-pointer overflow-hidden" onClick={() => { setViewMode('curriculum'); setState(p => ({ ...p, generatedContent: null })); setActiveLessonId(null); setPrefilledValues(null); setLoadedCurriculum(null); }}>
                            <div className="bg-gradient-to-br from-violet-600 to-purple-600 p-1.5 md:p-2 rounded-xl text-white flex-shrink-0">
                                <Brain className="w-5 h-5 md:w-6 md:h-6" />
                            </div>
                            <div className="flex flex-col justify-center">
                                <h1 className="text-lg md:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-violet-600 to-purple-600 truncate">ESL Smart Planner</h1>
                                <p className="text-[10px] md:text-xs text-slate-500 hidden sm:block">AI-Powered Curriculum Assistant</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 md:gap-2">
                            {NAV_TABS.map(tab => (
                                <button key={tab.key} onClick={() => setViewMode(tab.key)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 rounded-xl font-medium transition-colors text-sm md:text-base
                                        ${viewMode === tab.key ? 'bg-violet-100 text-violet-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}>
                                    {tab.icon}
                                    <span className="hidden sm:inline">{tab.label}</span>
                                    {tab.key === 'history' && (savedLessons.length + savedCurricula.length > 0) && (
                                        <span className="ml-1 text-[10px] bg-violet-200 text-violet-700 rounded-full px-1.5 py-0.5 font-bold">
                                            {savedLessons.length + savedCurricula.length}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
                {/* Curriculum Tab */}
                {viewMode === 'curriculum' && (
                    <div className="animate-fade-in-up">
                        <div className="mb-8 bg-gradient-to-r from-violet-500 to-purple-600 rounded-xl p-6 md:p-8 text-white shadow-lg relative overflow-hidden">
                            <div className="relative z-10 max-w-2xl">
                                <h2 className="text-2xl md:text-3xl font-bold mb-3 md:mb-4">📖 Curriculum Designer</h2>
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
                                📖 Curricula
                                {savedCurricula.length > 0 && <span className="text-[10px] bg-violet-100 text-violet-600 rounded-full px-1.5 py-0.5 font-bold">{savedCurricula.length}</span>}
                            </button>
                            <button
                                onClick={() => setRecordsTab('kits')}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-all ${recordsTab === 'kits' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <Sparkles className="w-4 h-4" />
                                📋 Lesson Kits
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
                                                                onClick={(e) => handleDownloadZip(lesson, e)}
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
