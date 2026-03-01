import React, { useState, useEffect, useRef } from 'react';
import { Save, Check as CheckIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Sparkles, MapPin, CloudRain, BookOpen, Users,
    GraduationCap, ArrowRight, Loader2, Compass,
    Wind, Trees, Search, FileText, Edit3, Upload, X
} from 'lucide-react';
import { suggestLocations, generateCurriculum, generateCurriculumCN } from '../services/geminiService';
import { Curriculum, CurriculumLesson, CurriculumParams } from '../types';
import { AGE_RANGES, CEFR_LEVELS } from '../constants';
import { useLanguage } from '../i18n/LanguageContext';
import { safeStorage } from '@shared/safeStorage';

const ENGLISH_LEVELS = [
    "Zero Foundation",
    "Elementary (A1)",
    "Pre-Intermediate (A2)",
    "Intermediate (B1)",
    "Upper-Intermediate (B2)",
    "Advanced (C1)",
    "Proficient (C2)"
];

import { BatchItemStatus } from '../hooks/useBatchGenerate';

interface CurriculumPlannerProps {
    onGenerateKit: (lesson: CurriculumLesson, params: CurriculumParams, language: 'en' | 'zh') => void;
    onSave?: (curriculum: Curriculum, params: CurriculumParams, language: 'en' | 'zh') => void;
    externalCurriculum?: { curriculum: Curriculum; params: CurriculumParams; language?: 'en' | 'zh' } | null;
    // Batch generate
    batchStatus?: Record<number, BatchItemStatus>;
    batchLessonMap?: Record<number, string>;
    batchRunning?: boolean;
    batchProgress?: { done: number; total: number; errors: number };
    onBatchGenerate?: (lessons: CurriculumLesson[], params: CurriculumParams, language: 'en' | 'zh') => void;
    onCancelBatch?: () => void;
    onOpenPlan?: (savedId: string) => void;
    onResetBatch?: () => void;
}

const STORAGE_KEY = 'nature-compass-curriculum';

export const CurriculumPlanner: React.FC<CurriculumPlannerProps> = ({
    onGenerateKit, onSave, externalCurriculum,
    batchStatus = {}, batchLessonMap = {}, batchRunning = false, batchProgress,
    onBatchGenerate, onCancelBatch, onOpenPlan, onResetBatch,
}) => {
    // Config state
    const [ageGroup, setAgeGroup] = useState(AGE_RANGES[0]);
    const [englishLevel, setEnglishLevel] = useState(ENGLISH_LEVELS[0]);
    const [lessonCount, setLessonCount] = useState(4);
    const [duration, setDuration] = useState("180 minutes");
    const [city, setCity] = useState("");
    const [suggestedLocations, setSuggestedLocations] = useState<string[]>([]);
    const [selectedLocation, setSelectedLocation] = useState("");
    const [customLocation, setCustomLocation] = useState("");
    const [loadingLocations, setLoadingLocations] = useState(false);
    const [customTheme, setCustomTheme] = useState("");

    // PDF state
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [pdfText, setPdfText] = useState('');
    const [pdfPageCount, setPdfPageCount] = useState(0);
    const [extracting, setExtracting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Result state
    const [loading, setLoading] = useState(false);
    const [curriculumEN, setCurriculumEN] = useState<Curriculum | null>(null);
    const [curriculumCN, setCurriculumCN] = useState<Curriculum | null>(null);
    const [activeLanguage, setActiveLanguage] = useState<'en' | 'zh'>('en');
    const { t, setLang } = useLanguage();

    const [savedParams, setSavedParams] = useState<CurriculumParams | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [isSavedEN, setIsSavedEN] = useState(false);
    const [isSavedCN, setIsSavedCN] = useState(false);

    const effectiveCity = city.trim() || "Wuhan";
    const curriculum = activeLanguage === 'zh' ? curriculumCN : curriculumEN;
    const isSaved = activeLanguage === 'zh' ? isSavedCN : isSavedEN;
    const setIsSaved = activeLanguage === 'zh' ? setIsSavedCN : setIsSavedEN;

    // Sync activeLanguage to global context
    useEffect(() => {
        setLang(activeLanguage);
    }, [activeLanguage, setLang]);

    // Load from external curriculum (e.g., from Saved page)
    useEffect(() => {
        if (externalCurriculum) {
            const lang = externalCurriculum.language || 'en';
            if (lang === 'zh') {
                setCurriculumCN(externalCurriculum.curriculum);
            } else {
                setCurriculumEN(externalCurriculum.curriculum);
            }
            setSavedParams(externalCurriculum.params);
            setActiveLanguage(lang);
            // Pre-fill config from params
            if (externalCurriculum.params.city) setCity(externalCurriculum.params.city);
            if (externalCurriculum.params.ageGroup) setAgeGroup(externalCurriculum.params.ageGroup);
            if (externalCurriculum.params.lessonCount) setLessonCount(externalCurriculum.params.lessonCount);
            if (externalCurriculum.params.duration) setDuration(externalCurriculum.params.duration);
            if (externalCurriculum.params.customTheme) setCustomTheme(externalCurriculum.params.customTheme);
        }
    }, [externalCurriculum]);

    // Persist to localStorage
    useEffect(() => {
        if (curriculumEN || curriculumCN) {
            safeStorage.set(STORAGE_KEY, {
                en: curriculumEN,
                cn: curriculumCN,
                lang: activeLanguage,
                params: savedParams || getCurrentParams(),
            });
        }
    }, [curriculumEN, curriculumCN, activeLanguage]);

    // Load from localStorage
    useEffect(() => {
        if (externalCurriculum) return;
        const data = safeStorage.get<{ en?: Curriculum; cn?: Curriculum; lang?: 'en' | 'zh'; params?: CurriculumParams }>(STORAGE_KEY, {});
        if (data.en) setCurriculumEN(data.en);
        if (data.cn) setCurriculumCN(data.cn);
        if (data.lang) setActiveLanguage(data.lang);
        if (data.params) {
            setSavedParams(data.params);
            if (data.params.city) setCity(data.params.city);
            if (data.params.ageGroup) setAgeGroup(data.params.ageGroup);
            if (data.params.lessonCount) setLessonCount(data.params.lessonCount);
            if (data.params.duration) setDuration(data.params.duration);
            if (data.params.customTheme) setCustomTheme(data.params.customTheme);
        }
    }, []);

    const handleConfirmCity = async () => {
        setLoadingLocations(true);
        try {
            const locations = await suggestLocations(effectiveCity);
            setSuggestedLocations(locations);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingLocations(false);
        }
    };

    // PDF text extraction using pdf.js
    const extractPdfText = async (file: File) => {
        setExtracting(true);
        try {
            // @ts-ignore - loaded from CDN
            const pdfjsLib = await import(/* @vite-ignore */ 'https://esm.sh/pdfjs-dist@4.10.38');
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

    const handleGenerate = async () => {
        setLoading(true);
        setErrorMsg(null);
        setCurriculumEN(null);
        setCurriculumCN(null);
        setIsSavedEN(false);
        setIsSavedCN(false);

        const params = getCurrentParams();
        setSavedParams(params);
        const textForAI = pdfText || undefined;

        try {
            const [enResult, cnResult] = await Promise.allSettled([
                generateCurriculum(params.ageGroup, params.englishLevel, params.lessonCount, params.duration, params.preferredLocation, params.customTheme, params.city, textForAI),
                generateCurriculumCN(params.ageGroup, params.lessonCount, params.duration, params.preferredLocation, params.customTheme, params.city, textForAI),
            ]);

            if (enResult.status === 'fulfilled') setCurriculumEN(enResult.value);
            if (cnResult.status === 'fulfilled') setCurriculumCN(cnResult.value);

            if (enResult.status === 'rejected' && cnResult.status === 'rejected') {
                setErrorMsg(`Both generations failed. EN: ${enResult.reason}. CN: ${cnResult.reason}`);
            }
        } catch (e: any) {
            setErrorMsg(e.message || 'Generation failed');
        } finally {
            setLoading(false);
        }
    };

    const handleNewCurriculum = () => {
        setCurriculumEN(null);
        setCurriculumCN(null);
        setSavedParams(null);
        safeStorage.remove(STORAGE_KEY);
        setIsSavedEN(false);
        setIsSavedCN(false);
        setActiveLanguage('en');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const getCurrentParams = (): CurriculumParams => ({
        city: effectiveCity,
        ageGroup,
        englishLevel,
        lessonCount,
        duration,
        preferredLocation: [selectedLocation, customLocation.trim()].filter(Boolean).join(", "),
        customTheme,
    });

    return (
        <div className="space-y-8">
            {/* Config Panel — only visible when no curriculum generated */}
            {!curriculum && (
                <>
                    <div className="card md:p-8">
                        <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                            <Compass size={22} className="text-teal-600" />
                            {t('cp.title')}
                        </h2>

                        {/* PDF Upload */}
                        <div className="mb-6">
                            <label className="input-label flex items-center gap-2 uppercase tracking-wider text-slate-500 mb-2">
                                <FileText size={16} /> {t('cp.uploadPdf')}
                            </label>
                            {!pdfFile ? (
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center cursor-pointer hover:border-teal-400 hover:bg-teal-50/30 transition-all group"
                                >
                                    <Upload className="w-10 h-10 text-slate-400 group-hover:text-teal-500 mx-auto mb-3" />
                                    <p className="text-sm text-slate-500">
                                        <span className="font-semibold text-teal-600">{t('cp.clickUpload')}</span> {t('cp.pdfFile')}<br />
                                        <span className="text-xs text-slate-400">{t('cp.pdfSupport')}</span>
                                    </p>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        accept=".pdf"
                                        onChange={handleFileChange}
                                        className="hidden"
                                    />
                                </div>
                            ) : (
                                <div className="flex items-center justify-between bg-teal-50 border border-teal-200 rounded-xl px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <FileText size={20} className="text-teal-600" />
                                        <div>
                                            <p className="text-sm font-medium text-slate-700">{pdfFile.name}</p>
                                            <p className="text-xs text-slate-500">
                                                {extracting ? (
                                                    <span className="flex items-center gap-1 text-teal-600">
                                                        <Loader2 size={12} className="animate-spin" /> {t('cp.extracting')}
                                                    </span>
                                                ) : (
                                                    <>{pdfPageCount} {t('cp.pagesExtracted')} · {(pdfText.length / 1000).toFixed(1)}K chars</>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    <button onClick={removePdf} className="p-1.5 hover:bg-teal-100 rounded-lg transition-colors">
                                        <X size={16} className="text-slate-400" />
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {/* Age Group */}
                            <div className="space-y-2">
                                <label className="input-label flex items-center gap-2 uppercase tracking-wider text-slate-500">
                                    <Users size={16} /> {t('cp.ageGroup')}
                                </label>
                                <select
                                    value={ageGroup}
                                    onChange={(e) => setAgeGroup(e.target.value)}
                                    className="input-field py-3"
                                >
                                    {AGE_RANGES.map(age => <option key={age} value={age}>{t(`age.${age}` as any)}</option>)}
                                </select>
                            </div>

                            {/* English Level */}
                            <div className="space-y-2">
                                <label className="input-label flex items-center gap-2 uppercase tracking-wider text-slate-500">
                                    <GraduationCap size={16} /> {t('cp.englishLevel')}
                                </label>
                                <select
                                    value={englishLevel}
                                    onChange={(e) => setEnglishLevel(e.target.value)}
                                    className="input-field py-3"
                                >
                                    {ENGLISH_LEVELS.map(lvl => <option key={lvl} value={lvl}>{t(`level.${lvl}` as any)}</option>)}
                                </select>
                            </div>

                            {/* Lesson Count */}
                            <div className="space-y-2">
                                <label className="input-label flex items-center gap-2 uppercase tracking-wider text-slate-500">
                                    <BookOpen size={16} /> {t('cp.numLessons')}
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    max={12}
                                    value={lessonCount}
                                    onChange={(e) => setLessonCount(parseInt(e.target.value) || 4)}
                                    className="input-field py-3"
                                />
                            </div>

                            {/* Duration */}
                            <div className="space-y-2">
                                <label className="input-label flex items-center gap-2 uppercase tracking-wider text-slate-500">
                                    <Wind size={16} /> {t('cp.duration')}
                                </label>
                                <input
                                    type="text"
                                    placeholder={t('cp.durationPlaceholder')}
                                    value={duration}
                                    onChange={(e) => setDuration(e.target.value)}
                                    className="input-field py-3"
                                />
                            </div>

                            {/* City */}
                            <div className="space-y-2 md:col-span-2">
                                <label className="input-label flex items-center gap-2 uppercase tracking-wider text-slate-500">
                                    <MapPin size={16} /> {t('cp.city')}
                                </label>
                                <div className="flex gap-3">
                                    <input
                                        type="text"
                                        placeholder={t('cp.cityPlaceholder')}
                                        value={city}
                                        onChange={(e) => setCity(e.target.value)}
                                        className="input-field flex-1 py-3"
                                    />
                                    <button
                                        onClick={handleConfirmCity}
                                        disabled={loadingLocations}
                                        className="btn btn-primary px-6 py-3"
                                    >
                                        {loadingLocations ? (
                                            <Loader2 size={18} className="animate-spin" />
                                        ) : (
                                            <><Search size={18} /> {t('cp.confirm')}</>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Suggested Locations */}
                            {suggestedLocations.length > 0 && (
                                <div className="space-y-2 md:col-span-2">
                                    <label className="input-label flex items-center gap-2 uppercase tracking-wider text-slate-500">
                                        <Compass size={16} /> {t('cp.suggestedLocations')} ({effectiveCity})
                                    </label>
                                    <select
                                        value={selectedLocation}
                                        onChange={(e) => setSelectedLocation(e.target.value)}
                                        className="input-field py-3"
                                    >
                                        <option value="">{t('cp.noPreference')}</option>
                                        {suggestedLocations.map((loc, i) => (
                                            <option key={i} value={loc}>{loc}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Custom Location */}
                            <div className="space-y-2 md:col-span-2">
                                <label className="input-label flex items-center gap-2 uppercase tracking-wider text-slate-500">
                                    <Edit3 size={16} /> {t('cp.customLocation')}
                                </label>
                                <input
                                    type="text"
                                    placeholder={t('cp.locationPlaceholder')}
                                    value={customLocation}
                                    onChange={(e) => setCustomLocation(e.target.value)}
                                    className="input-field py-3"
                                />
                            </div>

                            {/* Custom Theme */}
                            <div className="space-y-2 md:col-span-2">
                                <label className="input-label flex items-center gap-2 uppercase tracking-wider text-slate-500">
                                    <Sparkles size={16} /> {t('cp.customTheme')}
                                </label>
                                <input
                                    type="text"
                                    placeholder={t('cp.themePlaceholder')}
                                    value={customTheme}
                                    onChange={(e) => setCustomTheme(e.target.value)}
                                    className="input-field py-3"
                                />
                            </div>

                            {/* Generate Button */}
                            <div className="md:col-span-2 pt-2">
                                <button
                                    onClick={handleGenerate}
                                    disabled={loading}
                                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl py-4 font-bold text-lg flex items-center justify-center gap-3 hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? (
                                        <Loader2 className="animate-spin" size={22} />
                                    ) : (
                                        <>{pdfText ? t('cp.generateFromPdf') : t('cp.generate')} <ArrowRight size={20} /></>
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
            {(curriculumEN || curriculumCN) && (
                <div className="space-y-6">
                    {/* Language toggle + Action buttons */}
                    <div className="flex items-center justify-between">
                        <div className="flex bg-slate-100 rounded-xl p-1">
                            <button
                                onClick={() => setActiveLanguage('en')}
                                disabled={!curriculumEN}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeLanguage === 'en'
                                    ? 'bg-white text-emerald-700 shadow-sm'
                                    : curriculumEN
                                        ? 'text-slate-500 hover:text-slate-700'
                                        : 'text-slate-300 cursor-not-allowed'
                                    }`}
                            >
                                🇬🇧 English
                            </button>
                            <button
                                onClick={() => setActiveLanguage('zh')}
                                disabled={!curriculumCN}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeLanguage === 'zh'
                                    ? 'bg-white text-emerald-700 shadow-sm'
                                    : curriculumCN
                                        ? 'text-slate-500 hover:text-slate-700'
                                        : 'text-slate-300 cursor-not-allowed'
                                    }`}
                            >
                                🇨🇳 中文
                            </button>
                        </div>
                        <div className="flex gap-3">
                            {onSave && (
                                <button
                                    onClick={() => {
                                        onSave(curriculum, savedParams || getCurrentParams(), activeLanguage);
                                        setIsSaved(true);
                                    }}
                                    disabled={isSaved}
                                    className={`btn ${isSaved
                                        ? 'bg-emerald-50 text-emerald-600 cursor-default border border-emerald-200'
                                        : 'btn-primary'
                                        }`}
                                >
                                    {isSaved ? <><CheckIcon size={16} /> {t('cp.saved')}</> : <><Save size={16} /> {t('cp.save')}</>}
                                </button>
                            )}
                            <button
                                onClick={handleNewCurriculum}
                                className="btn btn-outline"
                            >
                                <Edit3 size={16} />
                                {t('cp.new')}
                            </button>
                        </div>
                    </div>

                    {/* Batch Generate */}
                    {onBatchGenerate && curriculum && (
                        <div className="flex items-center gap-3 flex-wrap">
                            {batchRunning ? (
                                <>
                                    <button
                                        onClick={onCancelBatch}
                                        className="btn bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
                                    >
                                        <Loader2 size={16} className="animate-spin" />
                                        {t('cp.batchStop')}
                                    </button>
                                    {batchProgress && (
                                        <span className="text-sm text-slate-500 font-medium">
                                            {batchProgress.done}/{batchProgress.total} {t('cp.batchProgress')}
                                            {batchProgress.errors > 0 && <span className="text-red-400 ml-1">({batchProgress.errors} errors)</span>}
                                        </span>
                                    )}
                                </>
                            ) : (
                                <button
                                    onClick={() => onBatchGenerate(curriculum.lessons, savedParams || getCurrentParams(), activeLanguage)}
                                    className="btn bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 shadow-sm"
                                >
                                    <Sparkles size={16} />
                                    {t('cp.batchGenerate')}
                                </button>
                            )}
                        </div>
                    )}

                    {/* Overview */}
                    <div className="card">
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">{curriculum.theme}</h2>
                        <p className="text-slate-600 leading-relaxed">{curriculum.overview}</p>
                        <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-500">
                            <span className="px-3 py-1 bg-slate-100 rounded-lg flex items-center gap-1.5"><MapPin size={14} /> {savedParams?.city || effectiveCity}</span>
                            <span className="px-3 py-1 bg-slate-100 rounded-lg flex items-center gap-1.5"><Users size={14} /> {savedParams?.ageGroup || ageGroup}</span>
                            <span className="px-3 py-1 bg-slate-100 rounded-lg flex items-center gap-1.5"><BookOpen size={14} /> {curriculum.lessons.length} {t('saved.lessons')}</span>
                        </div>
                    </div>

                    {/* Lesson Cards */}
                    {curriculum.lessons.map((lesson, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="card space-y-4"
                        >
                            {/* Header */}
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-bold text-white bg-emerald-600 w-8 h-8 rounded-lg flex items-center justify-center">
                                        {String(index + 1).padStart(2, '0')}
                                    </span>
                                    <h3 className="text-xl font-bold text-slate-900">{lesson.title}</h3>
                                </div>
                            </div>

                            <p className="text-slate-600 leading-relaxed">{lesson.description}</p>

                            {/* Detail Grid */}
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
                                        <Sparkles size={12} /> {t('cp.steamFocus')}
                                    </span>
                                    <div className="font-medium text-slate-700 mt-1 space-y-1">
                                        {lesson.steam_focus.split(/(?=[STEAM]:)/).filter(Boolean).map((seg, i) => (
                                            <p key={i}>{seg.trim().replace(/\*\*/g, '')}</p>
                                        ))}
                                    </div>
                                </div>
                                {activeLanguage === 'en' && lesson.esl_focus && (
                                    <div>
                                        <span className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
                                            <GraduationCap size={12} /> {t('cp.eslFocus')}
                                        </span>
                                        <div className="font-medium text-slate-700 mt-1 space-y-1">
                                            {lesson.esl_focus.split(/(?<=\.)\s+/).filter(Boolean).map((seg, i) => (
                                                <p key={i}>{seg.trim().replace(/\*\*/g, '')}</p>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div>
                                    <span className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
                                        <MapPin size={12} /> {t('cp.location')}
                                    </span>
                                    <p className="font-medium text-slate-700 mt-1">{lesson.location}</p>
                                </div>
                            </div>

                            {/* Activities */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                                <div className="flex items-start gap-2">
                                    <Trees size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <span className="text-xs font-bold text-slate-400 uppercase">{t('cp.outdoor')}</span>
                                        <div className="text-sm text-slate-600 mt-1 space-y-1.5">
                                            {lesson.outdoor_activity.split(/(?=\d+\.\s)/).filter(Boolean).map((step, i) => (
                                                <p key={i}>{step.trim().replace(/\*\*/g, '')}</p>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <CloudRain size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <span className="text-xs font-bold text-slate-400 uppercase">{t('cp.indoor')}</span>
                                        <div className="text-sm text-slate-600 mt-1 space-y-1.5">
                                            {lesson.indoor_alternative.split(/(?=\d+\.\s)/).filter(Boolean).map((step, i) => (
                                                <p key={i}>{step.trim().replace(/\*\*/g, '')}</p>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Vocab Tags — EN only */}
                            {activeLanguage === 'en' && lesson.english_vocabulary.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {lesson.english_vocabulary.map((word, i) => (
                                        <span key={i} className="px-2 py-1 bg-slate-100 text-slate-500 text-xs font-mono rounded uppercase tracking-wider">
                                            {word}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Generate Kit / Status Button */}
                            {batchStatus[index] === 'generating' ? (
                                <button disabled className="btn btn-secondary w-full mt-2 py-3 opacity-60 cursor-not-allowed animate-pulse">
                                    <Loader2 size={18} className="animate-spin" />
                                    {t('cp.batchGenerating')}
                                </button>
                            ) : batchStatus[index] === 'done' && batchLessonMap[index] ? (
                                <button
                                    onClick={() => onOpenPlan?.(batchLessonMap[index])}
                                    className="btn w-full mt-2 py-3 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                                >
                                    <CheckIcon size={18} />
                                    {t('cp.openKit')}
                                    <ArrowRight size={16} />
                                </button>
                            ) : batchStatus[index] === 'error' ? (
                                <button
                                    onClick={() => onGenerateKit(lesson, savedParams || getCurrentParams(), activeLanguage)}
                                    className="btn w-full mt-2 py-3 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
                                >
                                    <FileText size={18} />
                                    {t('cp.retryKit')}
                                    <ArrowRight size={16} />
                                </button>
                            ) : (
                                <button
                                    onClick={() => onGenerateKit(lesson, savedParams || getCurrentParams(), activeLanguage)}
                                    className="btn btn-secondary w-full mt-2 py-3"
                                >
                                    <FileText size={18} />
                                    {t('cp.genKit')}
                                    <ArrowRight size={16} />
                                </button>
                            )}
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
};
