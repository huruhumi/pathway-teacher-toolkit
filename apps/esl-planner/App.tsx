import React, { useState, useEffect, useMemo } from 'react';
import { CEFRLevel, GeneratedContent, AppState, SavedLesson, Worksheet, StructuredLessonPlan, Game, ReadingCompanionContent, Slide } from './types';
import { generateLessonPlan, generateWorksheet } from './services/geminiService';
import { InputSection } from './components/InputSection';
import { OutputDisplay } from './components/OutputDisplay';
import { Sparkles, Brain, Layout, History, Trash2, Edit3, ArrowLeft, Calendar, BookOpen, Check, X, Download, Loader2, FileArchive, Search, Filter, SortAsc } from 'lucide-react';
import JSZip from 'jszip';

const INDIGO_COLOR = '#4f46e5';

const App: React.FC = () => {
    const [state, setState] = useState<AppState>({
        isLoading: false,
        generatedContent: null,
        cnContent: null,
        error: null,
    });

    const [savedLessons, setSavedLessons] = useState<SavedLesson[]>([]);
    const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'create' | 'history'>('create');
    const [isExporting, setIsExporting] = useState<string | null>(null);

    // Modal Component for Errors
    const ErrorModal = ({ message, onClose }: { message: string, onClose: () => void }) => (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transform animate-scale-in">
                <div className="bg-red-50 p-6 flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                        <X className="w-10 h-10 text-red-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Generation Failed</h3>
                    <p className="text-gray-600 text-sm leading-relaxed">
                        We encountered an error while creating your lesson materials.
                    </p>
                </div>
                <div className="p-6">
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 text-center">Error Detail</p>
                        <p className="text-gray-700 text-sm font-medium text-center break-words">{message}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-all shadow-lg active:scale-95"
                    >
                        I Understand
                    </button>
                </div>
            </div>
        </div>
    );

    // Filtering & Sorting State
    const [searchQuery, setSearchQuery] = useState('');
    const [filterLevel, setFilterLevel] = useState<string>('All Levels');
    const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'az' | 'za'>('newest');

    // Title Editing State
    const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');

    // Load saved lessons on mount
    useEffect(() => {
        const saved = localStorage.getItem('esl_smart_planner_history');
        if (saved) {
            try {
                setSavedLessons(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to load history", e);
            }
        }
    }, []);

    // Filtered and Sorted Lessons
    const filteredLessons = useMemo(() => {
        let result = [...savedLessons];

        // Search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(l => l.topic.toLowerCase().includes(query));
        }

        // Level filter
        if (filterLevel !== 'All Levels') {
            result = result.filter(l => l.level === filterLevel);
        }

        // Sorting
        result.sort((a, b) => {
            switch (sortBy) {
                case 'newest': return b.timestamp - a.timestamp;
                case 'oldest': return a.timestamp - b.timestamp;
                case 'az': return a.topic.localeCompare(b.topic);
                case 'za': return b.topic.localeCompare(a.topic);
                default: return 0;
            }
        });

        return result;
    }, [savedLessons, searchQuery, filterLevel, sortBy]);

    const handleGenerate = async (
        text: string,
        files: File[],
        level: CEFRLevel,
        topic: string,
        slideCount: number,
        duration: string,
        studentCount: string,
        lessonTitle: string
    ) => {
        setState(prev => ({ ...prev, isLoading: true, error: null, generatedContent: null, cnContent: null }));
        setActiveLessonId(null);
        try {
            const lessonContent = await generateLessonPlan(text, files, level, topic, slideCount, duration, studentCount, lessonTitle);
            setState({
                isLoading: false,
                generatedContent: lessonContent,
                cnContent: null,
                error: null
            });
            setViewMode('create');
        } catch (error: any) {
            console.error(error);
            let errorMessage = "Failed to generate lesson plan.";

            // Extract specific error reason if available
            if (error.message) {
                if (error.message.includes('API key')) {
                    errorMessage = "Invalid API Key. Please check your .env.local configuration.";
                } else if (error.message.includes('fetch') || error.message.includes('network')) {
                    errorMessage = "Network Error. Please check your internet connection and try again.";
                } else if (error.message.includes('SAFE') || error.message.includes('Safety')) {
                    errorMessage = "Generation blocked by Safety Filters. Please try a different topic or context.";
                } else {
                    errorMessage = error.message;
                }
            }

            setState({
                isLoading: false,
                generatedContent: null,
                cnContent: null,
                error: errorMessage
            });
        }
    };

    const handleSaveLesson = (content: GeneratedContent, cnContent?: GeneratedContent) => {
        let updatedHistory = [...savedLessons];

        if (activeLessonId) {
            updatedHistory = updatedHistory.map(lesson => {
                if (lesson.id === activeLessonId) {
                    return {
                        ...lesson,
                        lastModified: Date.now(),
                        topic: content.structuredLessonPlan.classInformation.topic || lesson.topic,
                        level: content.structuredLessonPlan.classInformation.level,
                        content,
                        cnContent
                    };
                }
                return lesson;
            });
        } else {
            const id = Date.now().toString();
            const newRecord: SavedLesson = {
                id,
                timestamp: Date.now(),
                lastModified: Date.now(),
                topic: content.structuredLessonPlan.classInformation.topic || 'Untitled Lesson',
                level: content.structuredLessonPlan.classInformation.level,
                content,
                cnContent
            };
            updatedHistory = [newRecord, ...updatedHistory];
            setActiveLessonId(id);
        }

        setSavedLessons(updatedHistory);
        localStorage.setItem('esl_smart_planner_history', JSON.stringify(updatedHistory));
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
        setState({
            isLoading: false,
            generatedContent: record.content,
            cnContent: record.cnContent,
            error: null
        });
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
                return {
                    ...l,
                    topic: editTitle,
                    lastModified: Date.now(),
                    content: {
                        ...l.content,
                        structuredLessonPlan: {
                            ...l.content.structuredLessonPlan,
                            classInformation: {
                                ...l.content.structuredLessonPlan.classInformation,
                                topic: editTitle
                            }
                        }
                    }
                };
            }
            return l;
        });
        setSavedLessons(updated);
        localStorage.setItem('esl_smart_planner_history', JSON.stringify(updated));
        setEditingLessonId(null);
    };

    const cancelEditing = (e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingLessonId(null);
    };

    // --- EXPORT UTILITIES ---

    const formatLessonPlanMd = (plan: StructuredLessonPlan) => {
        let md = `# Lesson Plan: ${plan.classInformation.topic}\n\n`;
        md += `## 📋 Class Information\n`;
        md += `- **Level:** ${plan.classInformation.level}\n`;
        md += `- **Date:** ${plan.classInformation.date}\n`;
        md += `- **Topic:** ${plan.classInformation.topic}\n`;
        md += `- **Students:** ${plan.classInformation.students}\n\n`;

        md += `## 🎯 Objectives\n`;
        plan.lessonDetails.objectives.forEach(obj => md += `- ${obj}\n`);
        md += `\n`;

        md += `## 🛠️ Materials & Equipment\n`;
        plan.lessonDetails.materials.forEach(mat => md += `- ${mat}\n`);
        md += `\n`;

        md += `## 📚 Target Vocabulary\n`;
        plan.lessonDetails.targetVocab.forEach(v => md += `- **${v.word}**: ${v.definition}\n`);
        md += `\n`;

        md += `## 📝 Grammar & Target Sentences\n`;
        plan.lessonDetails.grammarSentences.forEach(s => md += `- ${s}\n`);
        md += `\n`;

        md += `## ⚠️ Anticipated Problems & Solutions\n`;
        plan.lessonDetails.anticipatedProblems.forEach(p => md += `### Problem: ${p.problem}\n**Solution:** ${p.solution}\n\n`);

        md += `## 🏃 Teaching Stages\n\n`;
        md += `| Stage | Timing | Interaction | Aim |\n`;
        md += `| :--- | :--- | :--- | :--- |\n`;
        plan.stages.forEach(s => md += `| ${s.stage} | ${s.timing} | ${s.interaction} | ${s.stageAim} |\n`);
        md += `\n\n`;

        plan.stages.forEach(s => {
            md += `### Stage: ${s.stage} (${s.timing})\n`;
            md += `**Teacher Activity:**\n${s.teacherActivity}\n\n`;
            md += `**Student Activity:**\n${s.studentActivity}\n\n`;
            md += `---\n\n`;
        });

        return md;
    };

    const formatSlidesMd = (slides: Slide[]) => {
        let md = `# PPT Presentation Outline\n\n`;
        slides.forEach((s, i) => {
            md += `## Slide ${i + 1}: ${s.title}\n`;
            md += `### 📄 Content\n${s.content}\n\n`;
            md += `### 👁️ Visual\n${s.visual}\n\n`;
            md += `### 🎤 Layout Design\n${s.layoutDesign}\n\n`;
            md += `---\n\n`;
        });
        return md;
    };

    const formatGamesMd = (games: Game[]) => {
        let md = `# Classroom Games & Activities\n\n`;
        games.forEach(g => {
            md += `## 🎮 ${g.name}\n`;
            md += `- **Type:** ${g.type}\n`;
            md += `- **Interaction:** ${g.interactionType}\n`;
            md += `- **Materials Needed:** ${g.materials.join(', ') || 'None'}\n\n`;
            md += `### Instructions\n${g.instructions}\n\n`;
            md += `---\n\n`;
        });
        return md;
    };

    const formatCompanionMd = (companion: ReadingCompanionContent) => {
        let md = `# 📅 Post-Class Review Plan\n\n`;
        companion.days.forEach(day => {
            md += `## Day ${day.day}: ${day.focus} (${day.focus_cn})\n`;
            md += `### 🏋️ Main Activity\n${day.activity} (${day.activity_cn})\n\n`;
            md += `### ✅ Tasks\n`;
            day.tasks?.forEach(t => md += `- [ ] ${t.text} (${t.text_cn})\n`);
            if (day.trivia) {
                md += `\n### 💡 Day Trivia Fact\n- **EN:** ${day.trivia.en}\n- **CN:** ${day.trivia.cn}\n`;
            }
            md += `\n`;
            md += `### 🔗 Resources\n`;
            day.resources?.forEach(r => md += `- [${r.title}](${r.url}) - ${r.description}\n`);
            md += `\n---\n\n`;
        });

        return md;
    };

    const formatWorksheetQuestionsMd = (worksheets: Worksheet[]) => {
        let md = `# <span style="color: ${INDIGO_COLOR};">**📝 Review Worksheets (Questions)**</span>\n\n`;
        worksheets.forEach(ws => {
            md += `## <span style="color: ${INDIGO_COLOR};">**${ws.title}**</span>\n`;
            md += `*${ws.instructions}*\n\n`;
            ws.sections?.forEach((sec, sIdx) => {
                md += `### <span style="color: ${INDIGO_COLOR}; font-weight: bold;">Section ${sIdx + 1}: ${sec.title}</span>\n`;
                if (sec.description) md += `<p style="color: #6b7280; font-style: italic;">${sec.description}</p>\n\n`;
                if (sec.passage) md += `<div style="background-color: #f9fafb; border-left: 4px solid ${INDIGO_COLOR}; padding: 15px; margin-bottom: 20px;">\n\n> ${sec.passage}\n\n</div>\n\n`;

                if (sec.layout === 'matching') {
                    md += `| Column A | Column B |\n`;
                    md += `| :--- | :--- |\n`;
                    sec.items.forEach(item => {
                        md += `| ${item.question} | [ ] |\n`;
                    });
                } else {
                    sec.items.forEach((item, i) => {
                        md += `${i + 1}. ${item.question}\n`;
                        if (item.options && item.options.length > 0) {
                            md += `\n`;
                            item.options.forEach((opt, oi) => {
                                md += `   ${String.fromCharCode(65 + oi)}) ${opt}\n`;
                            });
                        }
                        md += `\n`;
                    });
                }
                md += `\n---\n\n`;
            });
        });
        return md;
    };

    const formatWorksheetAnswersMd = (worksheets: Worksheet[]) => {
        let md = `# <span style="color: ${INDIGO_COLOR};">**✅ Worksheet Answer Key**</span>\n\n`;
        worksheets.forEach(ws => {
            md += `## <span style="color: ${INDIGO_COLOR};">**${ws.title} - Answers**</span>\n\n`;
            ws.sections?.forEach((sec, sIdx) => {
                md += `### <span style="color: ${INDIGO_COLOR}; font-weight: bold;">Section ${sIdx + 1}: ${sec.title}</span>\n`;
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
            content.flashcards.forEach(c => {
                flashcardsMd += `## ${c.word}\n`;
                flashcardsMd += `- **Definition:** ${c.definition}\n`;
                flashcardsMd += `- **Visual Prompt:** ${c.visualPrompt}\n\n`;
            });
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

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
            <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center gap-2 md:gap-3 cursor-pointer overflow-hidden" onClick={() => { setViewMode('create'); setState(p => ({ ...p, generatedContent: null })); setActiveLessonId(null); }}>
                            <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-1.5 md:p-2 rounded-lg text-white flex-shrink-0">
                                <Brain className="w-5 h-5 md:w-6 md:h-6" />
                            </div>
                            <div className="flex flex-col justify-center">
                                <h1 className="text-lg md:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 truncate">
                                    ESL Smart Planner
                                </h1>
                                <p className="text-[10px] md:text-xs text-gray-500 hidden sm:block">AI-Powered Curriculum Assistant</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 md:gap-4">
                            <button
                                onClick={() => setViewMode(viewMode === 'history' ? 'create' : 'history')}
                                className={`flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-lg font-medium transition-colors text-sm md:text-base ${viewMode === 'history' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}
                            >
                                {viewMode === 'history' ? <ArrowLeft className="w-4 h-4" /> : <History className="w-4 h-4" />}
                                <span className="hidden sm:inline">{viewMode === 'history' ? 'Back to Planner' : 'My Records'}</span>
                                <span className="sm:hidden">{viewMode === 'history' ? 'Back' : 'Records'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
                {viewMode === 'history' ? (
                    <div className="animate-fade-in-up">
                        <div className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-2">Saved Lesson Kits</h2>
                                <p className="text-sm md:text-base text-gray-500">Access and manage your previously generated teaching materials.</p>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-400 font-medium">
                                <Calendar className="w-4 h-4" />
                                <span>{savedLessons.length} total records</span>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 space-y-4">
                            <div className="flex flex-col md:flex-row gap-4">
                                <div className="flex-1 relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search by topic..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                                    />
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                                        <Filter className="w-4 h-4 text-gray-400" />
                                        <select
                                            value={filterLevel}
                                            onChange={(e) => setFilterLevel(e.target.value)}
                                            className="bg-transparent text-sm text-gray-700 outline-none font-medium cursor-pointer"
                                        >
                                            <option>All Levels</option>
                                            {Object.values(CEFRLevel).map(lvl => (
                                                <option key={lvl} value={lvl}>{lvl}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                                        <SortAsc className="w-4 h-4 text-gray-400" />
                                        <select
                                            value={sortBy}
                                            onChange={(e) => setSortBy(e.target.value as any)}
                                            className="bg-transparent text-sm text-gray-700 outline-none font-medium cursor-pointer"
                                        >
                                            <option value="newest">Newest First</option>
                                            <option value="oldest">Oldest First</option>
                                            <option value="az">A - Z</option>
                                            <option value="za">Z - A</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {filteredLessons.length === 0 ? (
                            <div className="text-center py-12 md:py-20 bg-white rounded-xl border border-dashed border-gray-300">
                                {savedLessons.length === 0 ? (
                                    <>
                                        <History className="w-12 h-12 md:w-16 md:h-16 text-gray-300 mx-auto mb-4" />
                                        <h3 className="text-base md:text-lg font-medium text-gray-600">No saved records found</h3>
                                        <p className="text-sm text-gray-400">Generate a lesson kit and save it to see it here.</p>
                                        <button onClick={() => setViewMode('create')} className="mt-4 text-indigo-600 font-medium hover:underline">Create New Lesson</button>
                                    </>
                                ) : (
                                    <>
                                        <Search className="w-12 h-12 md:w-16 md:h-16 text-gray-300 mx-auto mb-4" />
                                        <h3 className="text-base md:text-lg font-medium text-gray-600">No matches found</h3>
                                        <p className="text-sm text-gray-400">Adjust your search or filter criteria.</p>
                                        <button onClick={() => { setSearchQuery(''); setFilterLevel('All Levels'); }} className="mt-4 text-indigo-600 font-medium hover:underline">Clear All Filters</button>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                                {filteredLessons.map(lesson => (
                                    <div
                                        key={lesson.id}
                                        onClick={() => handleLoadRecord(lesson)}
                                        className={`bg-white rounded-xl border shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col h-full relative ${activeLessonId === lesson.id ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-gray-200 hover:border-indigo-300'}`}
                                    >
                                        <div className="p-4 md:p-5 flex-1">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className={`px-2 py-1 rounded text-[10px] md:text-xs font-bold uppercase tracking-wide
                                            ${lesson.level.includes('Beginner') || lesson.level === 'A1' ? 'bg-green-100 text-green-700' :
                                                        lesson.level === 'A2' || lesson.level === 'B1' ? 'bg-blue-100 text-blue-700' :
                                                            'bg-purple-100 text-purple-700'
                                                    }`}
                                                >
                                                    {lesson.level}
                                                </span>
                                                <div className="flex gap-1 relative z-50">
                                                    <button
                                                        onClick={(e) => handleDownloadZip(lesson, e)}
                                                        disabled={isExporting === lesson.id}
                                                        title="Download All as Zip"
                                                        className="text-gray-400 hover:text-indigo-600 p-1.5 rounded-full hover:bg-indigo-50 transition-all no-print"
                                                    >
                                                        {isExporting === lesson.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                                    </button>
                                                    <button onClick={(e) => handleDeleteRecord(lesson.id, e)} className="text-red-500 bg-red-50 hover:bg-red-100 hover:text-red-600 p-1.5 rounded-full transition-all" title="Delete Lesson Record">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>

                                            {editingLessonId === lesson.id ? (
                                                <div className="mb-2 flex items-center gap-1 relative z-20" onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                        value={editTitle}
                                                        onChange={(e) => setEditTitle(e.target.value)}
                                                        className="flex-1 border border-indigo-300 rounded px-2 py-1 text-base md:text-lg font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-0"
                                                        autoFocus
                                                        onClick={(e) => e.stopPropagation()}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') saveTitle(lesson.id, e);
                                                            if (e.key === 'Escape') cancelEditing(e as any);
                                                        }}
                                                    />
                                                    <button onClick={(e) => saveTitle(lesson.id, e)} className="p-1.5 text-green-600 bg-green-50 hover:bg-green-100 rounded shadow-sm"><Check className="w-4 h-4" /></button>
                                                    <button onClick={cancelEditing} className="p-1.5 text-red-500 bg-red-50 hover:bg-red-100 rounded shadow-sm"><X className="w-4 h-4" /></button>
                                                </div>
                                            ) : (
                                                <div className="group/title relative pr-6">
                                                    <h3 className="text-base md:text-lg font-bold text-gray-800 mb-2 line-clamp-2" title={lesson.topic}>{lesson.topic}</h3>
                                                    <button
                                                        onClick={(e) => startEditing(lesson, e)}
                                                        className="absolute top-0 right-0 opacity-100 lg:opacity-0 lg:group-hover/title:opacity-100 text-gray-400 hover:text-indigo-600 p-1 transition-opacity z-10"
                                                        title="Rename Lesson"
                                                    >
                                                        <Edit3 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            )}

                                            <div className="space-y-2 text-xs md:text-sm text-gray-500">
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                                    <span>{new Date(lesson.timestamp).toLocaleDateString()}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <BookOpen className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                                    <span>{lesson.content.slides?.length || 0} Slides, {lesson.content.games?.length || 0} Games</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-gray-50 px-4 py-2 md:px-5 md:py-3 border-t border-gray-100 flex justify-between items-center text-xs md:text-sm font-medium text-indigo-600 group-hover:bg-indigo-50/50 transition-colors">
                                            <span>{activeLessonId === lesson.id ? 'Currently Editing' : 'Open Kit'}</span>
                                            <Edit3 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        {!state.generatedContent && !state.isLoading && (
                            <div className="mb-8 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-6 md:p-8 text-white shadow-lg relative overflow-hidden">
                                <div className="relative z-10 max-w-2xl">
                                    <h2 className="text-2xl md:text-3xl font-bold mb-3 md:mb-4">Transform Teaching Materials in Seconds</h2>
                                    <p className="text-indigo-100 mb-6 text-sm md:text-lg">
                                        Upload textbook pages, images, or paste text to generate comprehensive lesson plans, slides, and interactive games tailored to any CEFR level.
                                    </p>
                                    <div className="flex flex-wrap gap-3 md:gap-4">
                                        <div className="flex items-center gap-2 bg-white/20 px-3 py-1.5 md:px-4 md:py-2 rounded-lg backdrop-blur-sm text-xs md:text-base">
                                            <Layout className="w-4 h-4 md:w-5 md:h-5" />
                                            <span className="font-medium">Structured Plans</span>
                                        </div>
                                        <div className="flex items-center gap-2 bg-white/20 px-3 py-1.5 md:px-4 md:py-2 rounded-lg backdrop-blur-sm text-xs md:text-base">
                                            <Sparkles className="w-4 h-4 md:w-5 md:h-5" />
                                            <span className="font-medium">Interactive Games</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 md:w-64 md:h-64 bg-white/10 rounded-full blur-3xl"></div>
                                <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-24 h-24 md:w-40 md:h-40 bg-white/10 rounded-full blur-2xl"></div>
                            </div>
                        )}

                        {!state.generatedContent && (
                            <InputSection onGenerate={handleGenerate} isLoading={state.isLoading} />
                        )}

                        {state.error && (
                            <ErrorModal
                                message={state.error}
                                onClose={() => setState(prev => ({ ...prev, error: null }))}
                            />
                        )}

                        {state.generatedContent && (
                            <div className="animate-fade-in-up">
                                <div className="mb-4">
                                    <button onClick={() => { setState(prev => ({ ...prev, generatedContent: null })); setActiveLessonId(null); }} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 transition-colors mb-4 text-sm md:text-base">
                                        <ArrowLeft className="w-4 h-4" /> Back to Generator
                                    </button>
                                    <OutputDisplay key={activeLessonId || 'new'} content={state.generatedContent} cnContent={state.cnContent || undefined} onSave={(c, cn) => handleSaveLesson(c, cn)} />
                                </div>
                            </div>
                        )}
                    </>
                )}
            </main>

            <footer className="bg-white border-t border-gray-200 mt-12 py-8">
                <div className="max-w-7xl mx-auto px-4 text-center text-gray-500 text-xs md:text-sm">
                    <p>&copy; {new Date().getFullYear()} ESL Smart Planner. Built with Google Gemini.</p>
                </div>
            </footer>
        </div>
    );
};

export default App;
