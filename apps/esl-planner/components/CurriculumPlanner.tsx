import React, { useState, useRef, useEffect } from 'react';

import {
    Upload, FileText, BookOpen, Users, GraduationCap,
    ArrowRight, Loader2, Sparkles, Clock, ListOrdered,
    Edit3, Target, MessageSquare, X, ChevronDown, ChevronUp, Save, ArrowLeft,
    Rocket, Square, CheckCircle2, AlertCircle, ExternalLink
} from 'lucide-react';
import { CEFRLevel, ESLCurriculum, CurriculumLesson, CurriculumParams } from '../types';
import { generateESLCurriculum } from '../services/geminiService';
import { safeStorage } from '@shared/safeStorage';
import { useLanguage } from '../i18n/LanguageContext';

interface CurriculumPlannerProps {
    onGenerateKit: (lesson: CurriculumLesson, params: CurriculumParams) => void;
    onSaveCurriculum?: (curriculum: ESLCurriculum, params: CurriculumParams) => void;
    loadedCurriculum?: { curriculum: ESLCurriculum; params: CurriculumParams } | null;
    onBatchGenerate?: (lessons: CurriculumLesson[], params: CurriculumParams) => void;
    onCancelBatch?: () => void;
    batchStatus?: Record<number, 'idle' | 'generating' | 'done' | 'error'>;
    batchLessonMap?: Record<number, string>;
    batchRunning?: boolean;
    batchProgress?: { done: number; total: number; errors: number };
    onOpenKit?: (savedLessonId: string) => void;
}

const STORAGE_KEY = 'esl-planner-curriculum';

export const CurriculumPlanner: React.FC<CurriculumPlannerProps> = ({
    onGenerateKit, onSaveCurriculum, loadedCurriculum,
    onBatchGenerate, onCancelBatch, batchStatus = {}, batchLessonMap = {},
    batchRunning = false, batchProgress = { done: 0, total: 0, errors: 0 }, onOpenKit
}) => {
    // PDF state
    const { t } = useLanguage();
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [pdfText, setPdfText] = useState('');
    const [pdfPageCount, setPdfPageCount] = useState(0);
    const [extracting, setExtracting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Config state
    const [lessonCount, setLessonCount] = useState(40);
    const [level, setLevel] = useState<CEFRLevel>(CEFRLevel.Beginner);
    const [duration, setDuration] = useState('90');
    const [studentCount, setStudentCount] = useState('6');
    const [slideCount, setSlideCount] = useState(20);
    const [customInstructions, setCustomInstructions] = useState('');

    // Result state
    const [loading, setLoading] = useState(false);
    const [curriculum, setCurriculum] = useState<ESLCurriculum | null>(null);
    const [savedParams, setSavedParams] = useState<CurriculumParams | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [expandedLessons, setExpandedLessons] = useState<Set<number>>(new Set());
    const [isSaved, setIsSaved] = useState(false);

    // Restore from localStorage
    useEffect(() => {
        const saved = safeStorage.get<{ curriculum?: ESLCurriculum; params?: CurriculumParams }>(STORAGE_KEY, {});
        if (saved.curriculum) setCurriculum(saved.curriculum);
        if (saved.params) {
            setSavedParams(saved.params);
            setLessonCount(saved.params.lessonCount || 6);
            setLevel(saved.params.level || CEFRLevel.A1);
            setDuration(saved.params.duration || '90');
            setStudentCount(saved.params.studentCount || '12');
            setSlideCount(saved.params.slideCount || 15);
            setCustomInstructions(saved.params.customInstructions || '');
        }
    }, []);

    // Load curriculum from Records
    useEffect(() => {
        if (loadedCurriculum) {
            setCurriculum(loadedCurriculum.curriculum);
            setSavedParams(loadedCurriculum.params);
            setLessonCount(loadedCurriculum.params.lessonCount);
            setLevel(loadedCurriculum.params.level);
            setDuration(loadedCurriculum.params.duration);
            setStudentCount(loadedCurriculum.params.studentCount);
            setSlideCount(loadedCurriculum.params.slideCount);
            setCustomInstructions(loadedCurriculum.params.customInstructions || '');
            setIsSaved(true);
        }
    }, [loadedCurriculum]);

    // Auto-save to localStorage
    useEffect(() => {
        if (curriculum) {
            safeStorage.set(STORAGE_KEY, {
                curriculum,
                params: savedParams,
                timestamp: Date.now(),
            });
        }
    }, [curriculum, savedParams]);

    // PDF text extraction using pdf.js
    const extractPdfText = async (file: File) => {
        setExtracting(true);
        try {
            // @ts-ignore - loaded from CDN
            const pdfjsLib = await import(/* @vite-ignore */ 'https://esm.sh/pdfjs-dist@4.10.38');

            // Point to CDN-hosted worker
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';

            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            setPdfPageCount(pdf.numPages);

            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                const pageText = content.items.map((item: any) => item.str).join(' ');
                fullText += `\n--- Page ${i} ---\n${pageText}`;
            }

            setPdfText(fullText.trim());
        } catch (err: any) {
            console.error('PDF extraction failed:', err);
            setErrorMsg(`PDF parsing failed: ${err.message || 'Unknown error'}`);
        } finally {
            setExtracting(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type === 'application/pdf') {
            setPdfFile(file);
            setPdfText('');
            setPdfPageCount(0);
            extractPdfText(file);
        }
    };

    const removePdf = () => {
        setPdfFile(null);
        setPdfText('');
        setPdfPageCount(0);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const getCurrentParams = (): CurriculumParams => ({
        lessonCount,
        level,
        duration,
        studentCount,
        slideCount,
        customInstructions,
    });

    const handleGenerate = async () => {
        if (!pdfText) {
            setErrorMsg(t('cp.uploadFirst'));
            return;
        }
        setLoading(true);
        setErrorMsg(null);
        setCurriculum(null);
        try {
            const params = getCurrentParams();
            const result = await generateESLCurriculum(pdfText, params);
            setCurriculum(result);
            setSavedParams(params);
        } catch (error: any) {
            setErrorMsg(error.message || t('cp.generateFailed'));
        } finally {
            setLoading(false);
        }
    };

    const handleNewCurriculum = () => {
        setCurriculum(null);
        setSavedParams(null);
        setExpandedLessons(new Set());
        safeStorage.remove(STORAGE_KEY);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const toggleLesson = (index: number) => {
        setExpandedLessons(prev => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });
    };

    return (
        <div className="space-y-8">
            {/* Config Panel — only when no curriculum */}
            {!curriculum && (
                <>
                    <div className="space-y-6">
                        <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <BookOpen size={22} className="text-violet-600" />
                            {t('cp.title')}
                        </h2>

                        {/* PDF Upload */}
                        <div className="mb-6">
                            <label className="flex items-center gap-2 text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                <FileText size={16} /> {t('cp.uploadPdf')}
                            </label>
                            {!pdfFile ? (
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-violet-400 hover:bg-violet-50/30 transition-all group"
                                >
                                    <Upload className="w-10 h-10 text-slate-400 group-hover:text-violet-500 mb-3" />
                                    <p className="text-sm text-slate-500 text-center">
                                        <span className="font-semibold text-violet-600">{t('cp.clickUpload')}</span> {t('cp.pdfFile')}<br />
                                        <span className="text-xs text-slate-400">{t('cp.pdfSupport')}</span>
                                    </p>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        accept=".pdf,application/pdf"
                                        className="hidden"
                                    />
                                </div>
                            ) : (
                                <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-violet-100 p-2 rounded-lg">
                                            <FileText className="w-5 h-5 text-violet-600" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-800 text-sm">{pdfFile.name}</p>
                                            <p className="text-xs text-slate-500">
                                                {extracting ? (
                                                    <span className="flex items-center gap-1 text-violet-600">
                                                        <Loader2 size={12} className="animate-spin" /> {t('cp.extracting')}
                                                    </span>
                                                ) : (
                                                    <>{pdfPageCount} {t('cp.pdfPages')} · {(pdfText.length / 1000).toFixed(1)}K {t('cp.pdfChars')}</>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={removePdf}
                                        className="text-slate-400 hover:text-red-500 p-1.5 rounded-full hover:bg-red-50 transition-all"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Settings Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {/* Lesson Count */}
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-500 uppercase tracking-wider">
                                    <ListOrdered size={16} /> {t('cp.numLessons')}
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    max={20}
                                    value={lessonCount}
                                    onChange={(e) => setLessonCount(parseInt(e.target.value) || 6)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
                                />
                            </div>

                            {/* Target Level */}
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-500 uppercase tracking-wider">
                                    <GraduationCap size={16} /> {t('cp.targetLevel')}
                                </label>
                                <select
                                    value={level}
                                    onChange={(e) => setLevel(e.target.value as CEFRLevel)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
                                >
                                    {Object.values(CEFRLevel).map(lvl => (
                                        <option key={lvl} value={lvl}>{t(`cefr.${lvl}` as any)}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Duration */}
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-500 uppercase tracking-wider">
                                    <Clock size={16} /> {t('cp.duration')}
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g., 90"
                                    value={duration}
                                    onChange={(e) => setDuration(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
                                />
                            </div>

                            {/* Student Count */}
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-500 uppercase tracking-wider">
                                    <Users size={16} /> {t('cp.students')}
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    value={studentCount}
                                    onChange={(e) => setStudentCount(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
                                />
                            </div>

                            {/* Slides Per Lesson */}
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-500 uppercase tracking-wider">
                                    <Sparkles size={16} /> {t('cp.slidesPerLesson')}
                                </label>
                                <select
                                    value={slideCount}
                                    onChange={(e) => setSlideCount(Number(e.target.value))}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
                                >
                                    {[5, 8, 10, 12, 15, 20, 25, 30].map(n => (
                                        <option key={n} value={n}>{n} {t('input.slidesUnit')}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Custom Instructions */}
                            <div className="space-y-2 md:col-span-2 lg:col-span-3">
                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-500 uppercase tracking-wider">
                                    <MessageSquare size={16} /> {t('cp.customInstructions')}
                                </label>
                                <textarea
                                    placeholder={t('cp.customPlaceholder')}
                                    value={customInstructions}
                                    onChange={(e) => setCustomInstructions(e.target.value)}
                                    rows={2}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all resize-none"
                                />
                            </div>

                            {/* Generate Button */}
                            <div className="md:col-span-2 lg:col-span-3 pt-2">
                                <button
                                    onClick={handleGenerate}
                                    disabled={loading || !pdfText}
                                    className={`w-full rounded-xl py-4 font-bold text-lg flex items-center justify-center gap-3 transition-all shadow-md
                    ${loading || !pdfText
                                            ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                            : 'bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:shadow-lg hover:-translate-y-0.5'
                                        }`}
                                >
                                    {loading ? (
                                        <><Loader2 className="animate-spin" size={22} /> {t('cp.analyzing')}</>
                                    ) : (
                                        <>{t('cp.generate')} <ArrowRight size={20} /></>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Error */}
                    {errorMsg && (
                        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-center">
                            {errorMsg}
                        </div>
                    )}
                </>
            )}

            {/* Results */}
            {curriculum && (
                <div className="space-y-6">
                    {/* Action buttons — unified row */}
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-slate-500 font-medium">
                                {curriculum.totalLessons} lessons · {curriculum.targetLevel}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            {/* Batch generate button */}
                            {onBatchGenerate && (
                                batchRunning ? (
                                    <button
                                        onClick={onCancelBatch}
                                        className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl text-sm font-semibold hover:bg-red-100 transition-all"
                                    >
                                        <Square size={15} />
                                        {t('cp.cancel')}
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => onBatchGenerate(curriculum.lessons, savedParams || getCurrentParams())}
                                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl text-sm font-semibold hover:from-violet-700 hover:to-purple-700 transition-all shadow-sm"
                                    >
                                        <Rocket size={15} />
                                        {t('cp.generateAll')}
                                    </button>
                                )
                            )}
                            {onSaveCurriculum && (
                                <button
                                    onClick={() => {
                                        onSaveCurriculum(curriculum, savedParams || getCurrentParams());
                                        setIsSaved(true);
                                    }}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${isSaved
                                        ? 'bg-green-50 border border-green-200 text-green-600'
                                        : 'bg-violet-600 text-white hover:bg-violet-700 shadow-sm'
                                        }`}
                                >
                                    <Save size={15} />
                                    {isSaved ? t('cp.savedCheck') : t('cp.saveCurriculum')}
                                </button>
                            )}
                            <button
                                onClick={handleNewCurriculum}
                                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 hover:border-slate-300 transition-all"
                            >
                                <ArrowLeft size={15} />
                                {t('cp.newCurriculum')}
                            </button>
                        </div>
                    </div>

                    {/* Overview */}
                    <div className="space-y-4">
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">{curriculum.textbookTitle}</h2>
                        <p className="text-slate-600 leading-relaxed">{curriculum.overview}</p>
                        <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-500">
                            <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg font-medium flex items-center gap-1.5"><FileText size={14} /> {curriculum.textbookTitle}</span>
                            <span className="px-3 py-1 bg-violet-50 text-violet-700 rounded-lg font-medium flex items-center gap-1.5"><BookOpen size={14} /> {curriculum.totalLessons} {t('cp.lessonsUnit')}</span>
                            <span className="px-3 py-1 bg-violet-50 text-violet-700 rounded-lg font-medium flex items-center gap-1.5"><GraduationCap size={14} /> {curriculum.targetLevel}</span>
                            {savedParams && (
                                <>
                                    <span className="px-3 py-1 bg-slate-100 rounded-lg flex items-center gap-1.5"><Clock size={14} /> {savedParams.duration} min</span>
                                    <span className="px-3 py-1 bg-slate-100 rounded-lg flex items-center gap-1.5"><Users size={14} /> {savedParams.studentCount} {t('cp.studentsUnit')}</span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Lesson Cards */}
                    {curriculum.lessons.map((lesson, index) => {
                        const isExpanded = expandedLessons.has(index);
                        return (
                            <div
                                key={index}
                                className="rounded-xl border border-slate-100 overflow-hidden animate-fade-in-up"
                                style={{ animationDelay: `${index * 80}ms` }}
                            >
                                {/* Header — always visible */}
                                <div
                                    className="p-5 cursor-pointer hover:bg-slate-50/50 transition-colors"
                                    onClick={() => toggleLesson(index)}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <span className="text-xs font-bold text-white bg-gradient-to-br from-violet-600 to-purple-600 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0">
                                                {String(lesson.lessonNumber || index + 1).padStart(2, '0')}
                                            </span>
                                            <div className="min-w-0">
                                                <h3 className="text-lg font-bold text-slate-900 truncate">{lesson.title}</h3>
                                                <p className="text-sm text-slate-500 truncate">{lesson.topic}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 ml-2">
                                            <span className="hidden sm:inline text-xs flex-shrink-0 text-slate-400 bg-slate-100 px-2 py-1 rounded-md max-w-[120px] truncate" title={lesson.textbookReference}>
                                                {(() => {
                                                    const ref = lesson.textbookReference || '';
                                                    const match = ref.match(/page(s)?\s*\d+(-\d+)?/i);
                                                    if (match) return match[0];
                                                    return ref.split('(')[0].trim();
                                                })()}
                                            </span>
                                            {isExpanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                                        </div>
                                    </div>
                                    {!isExpanded && (
                                        <p className="text-sm text-slate-500 mt-2 line-clamp-2">{lesson.description}</p>
                                    )}
                                </div>

                                {/* Expanded content */}
                                {isExpanded && (
                                    <div className="px-5 pb-5 space-y-4 border-t border-slate-100 pt-4">
                                        <p className="text-slate-600 leading-relaxed">{lesson.description}</p>

                                        {/* Detail Grid */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                            {/* Objectives */}
                                            <div>
                                                <span className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
                                                    <Target size={12} /> {t('cp.learningObjectives')}
                                                </span>
                                                <ul className="mt-1 space-y-1 text-slate-700">
                                                    {lesson.objectives.map((obj, i) => (
                                                        <li key={i} className="flex items-start gap-1.5">
                                                            <span className="text-violet-500 mt-0.5">•</span>
                                                            <span>{obj}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>

                                            {/* Grammar Focus */}
                                            <div>
                                                <span className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
                                                    <GraduationCap size={12} /> {t('cp.grammarFocus')}
                                                </span>
                                                <p className="font-medium text-slate-700 mt-1">{lesson.grammarFocus}</p>

                                                <span className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1 mt-3">
                                                    <Sparkles size={12} /> {t('cp.suggestedActivities')}
                                                </span>
                                                <ul className="mt-1 space-y-1 text-slate-700">
                                                    {lesson.suggestedActivities.map((act, i) => (
                                                        <li key={i} className="flex items-start gap-1.5">
                                                            <span className="text-purple-500 mt-0.5">▸</span>
                                                            <span>{act}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>

                                        {/* Vocabulary Tags */}
                                        {lesson.suggestedVocabulary.length > 0 && (
                                            <div className="flex flex-wrap gap-2 pt-2">
                                                {lesson.suggestedVocabulary.map((word, i) => (
                                                    <span key={i} className="px-2.5 py-1 bg-violet-50 text-violet-700 text-xs font-semibold rounded-lg">
                                                        {word}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {/* Generate Kit Button — status-aware */}
                                        {(() => {
                                            const lessonIdx = curriculum.lessons.indexOf(lesson);
                                            const status = batchStatus[lessonIdx];
                                            const kitId = batchLessonMap[lessonIdx];

                                            if (status === 'generating') {
                                                return (
                                                    <div className="w-full mt-2 bg-violet-50 border border-violet-200 text-violet-600 rounded-xl py-3 font-semibold flex items-center justify-center gap-2">
                                                        <Loader2 size={18} className="animate-spin" /> {t('cp.generating')}
                                                    </div>
                                                );
                                            }
                                            if (status === 'done' && kitId) {
                                                return (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onOpenKit?.(kitId); }}
                                                        className="w-full mt-2 bg-green-50 border border-green-200 text-green-700 rounded-xl py-3 font-semibold hover:bg-green-100 transition-all flex items-center justify-center gap-2"
                                                    >
                                                        <CheckCircle2 size={18} /> {t('cp.openKit')}
                                                        <ExternalLink size={14} />
                                                    </button>
                                                );
                                            }
                                            if (status === 'error') {
                                                return (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onGenerateKit(lesson, savedParams || getCurrentParams());
                                                        }}
                                                        className="w-full mt-2 bg-red-50 border border-red-200 text-red-600 rounded-xl py-3 font-semibold hover:bg-red-100 transition-all flex items-center justify-center gap-2"
                                                    >
                                                        <AlertCircle size={18} /> {t('cp.failedRetry')}
                                                    </button>
                                                );
                                            }
                                            // idle / default
                                            return (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onGenerateKit(lesson, savedParams || getCurrentParams());
                                                    }}
                                                    className="w-full mt-2 bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 text-violet-700 rounded-xl py-3 font-semibold hover:from-violet-100 hover:to-purple-100 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <FileText size={18} />
                                                    {t('cp.generateKit')}
                                                    <ArrowRight size={16} />
                                                </button>
                                            );
                                        })()}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Batch progress bar */}
            {(batchRunning || (batchProgress.done > 0 && batchProgress.done < batchProgress.total)) && curriculum && (
                <div className="mt-6 bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                    <div className="flex items-center justify-between text-sm mb-2">
                        <span className="font-semibold text-slate-700">
                            {batchRunning ? t('cp.batchGenerating') : t('cp.batchPaused')}
                        </span>
                        <span className="text-slate-500">
                            {batchProgress.done}/{batchProgress.total} {t('cp.completed')}
                            {batchProgress.errors > 0 && <span className="text-red-500 ml-2">· {batchProgress.errors} {t('cp.failed')}</span>}
                        </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-violet-500 to-purple-500"
                            style={{ width: `${batchProgress.total > 0 ? (batchProgress.done / batchProgress.total) * 100 : 0}%` }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
