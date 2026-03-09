import React, { useState, useEffect, useRef } from 'react';
import {
    Sparkles, MapPin, BookOpen, Users,
    GraduationCap, ArrowRight, Loader2, Compass,
    Wind, Search, FileText, Upload, X, Plus, School, Heart
} from 'lucide-react';
import { suggestLocations, generateCurriculum, generateCurriculumCN } from '../services/geminiService';
import { Curriculum, CurriculumParams } from '../types';
import { AGE_RANGES, CEFR_LEVELS } from '../constants';
import { useLanguage } from '../i18n/LanguageContext';
import { handleError } from '@shared/services/logger';
import { safeStorage } from '@shared/safeStorage';
import { extractPdfText as extractPdfTextShared } from '@shared/utils/pdf';
import { GenerationButton } from '@shared/components/GenerationButton';

const ENGLISH_LEVELS = [
    "Zero Foundation",
    "Elementary (A1)",
    "Pre-Intermediate (A2)",
    "Intermediate (B1)",
    "Upper-Intermediate (B2)",
    "Advanced (C1)",
    "Proficient (C2)"
];

interface CurriculumPlannerProps {
    onCurriculumGenerated: (data: {
        curriculumEN: Curriculum | null;
        curriculumCN: Curriculum | null;
        params: CurriculumParams;
        activeLanguage: 'en' | 'zh';
    }) => void;
    externalCurriculum?: { curriculum: Curriculum; params: CurriculumParams; language?: 'en' | 'zh' } | null;
}

const STORAGE_KEY = 'nature-compass-curriculum';

export const CurriculumPlanner: React.FC<CurriculumPlannerProps> = ({
    onCurriculumGenerated, externalCurriculum,
}) => {
    // Config state
    const [ageGroup, setAgeGroup] = useState(AGE_RANGES[0]);
    const [englishLevel, setEnglishLevel] = useState(ENGLISH_LEVELS[0]);
    const [lessonCount, setLessonCount] = useState(4);
    const [duration, setDuration] = useState("180");
    const [mode, setMode] = useState<'school' | 'family'>('school');
    const [familyEslEnabled, setFamilyEslEnabled] = useState(true);
    const [city, setCity] = useState("");
    const [suggestedLocations, setSuggestedLocations] = useState<string[]>([]);
    const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
    const [customLocation, setCustomLocation] = useState("");
    const [loadingLocations, setLoadingLocations] = useState(false);
    const [customTheme, setCustomTheme] = useState("");

    // PDF state
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [pdfText, setPdfText] = useState('');
    const [pdfPageCount, setPdfPageCount] = useState(0);
    const [extracting, setExtracting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Generation state
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const { t, setLang } = useLanguage();

    const effectiveCity = city.trim() || "Wuhan";

    // Load from external curriculum (e.g., from Saved page)
    useEffect(() => {
        if (externalCurriculum) {
            const lang = externalCurriculum.language || 'en';
            const params = externalCurriculum.params;
            if (params.city) setCity(params.city);
            if (params.ageGroup) setAgeGroup(params.ageGroup);
            if (params.lessonCount) setLessonCount(params.lessonCount);
            if (params.duration) setDuration(params.duration);
            if (params.mode) setMode(params.mode);
            if (params.familyEslEnabled !== undefined) setFamilyEslEnabled(params.familyEslEnabled);
            if (params.customTheme) setCustomTheme(params.customTheme);
            if (params.preferredLocation) {
                const locations = params.preferredLocation.split(',').map(s => s.trim()).filter(Boolean);
                setSelectedLocations(locations);
                // Also add them to suggested so they appear as toggles if they aren't custom
                setSuggestedLocations(Array.from(new Set([...suggestedLocations, ...locations])));
            }
            onCurriculumGenerated({
                curriculumEN: lang === 'en' ? externalCurriculum.curriculum : null,
                curriculumCN: lang === 'zh' ? externalCurriculum.curriculum : null,
                params: externalCurriculum.params,
                activeLanguage: lang,
            });
        }
    }, [externalCurriculum]);

    // Restore from localStorage on mount
    useEffect(() => {
        if (externalCurriculum) return;
        const data = safeStorage.get<{ en?: Curriculum; cn?: Curriculum; lang?: 'en' | 'zh'; params?: CurriculumParams }>(STORAGE_KEY, {});
        if ((data.en || data.cn) && data.params) {
            const params = data.params;
            if (params.city) setCity(params.city);
            if (params.ageGroup) setAgeGroup(params.ageGroup);
            if (params.lessonCount) setLessonCount(params.lessonCount);
            if (params.duration) setDuration(params.duration);
            if (params.mode) setMode(params.mode);
            if (params.familyEslEnabled !== undefined) setFamilyEslEnabled(params.familyEslEnabled);
            if (params.customTheme) setCustomTheme(params.customTheme);
            if (params.preferredLocation) {
                const locations = params.preferredLocation.split(',').map(s => s.trim()).filter(Boolean);
                setSelectedLocations(locations);
                setSuggestedLocations(locations);
            }
            onCurriculumGenerated({
                curriculumEN: data.en || null,
                curriculumCN: data.cn || null,
                params: data.params,
                activeLanguage: data.lang || 'en',
            });
        }
    }, []);

    const handleConfirmCity = async () => {
        setLoadingLocations(true);
        try {
            const locations = await suggestLocations(effectiveCity, customTheme.trim() || undefined);
            setSuggestedLocations(locations);
        } catch (e: unknown) {
            console.error(e);
        } finally {
            setLoadingLocations(false);
        }
    };

    const extractPdfTextLocal = async (file: File) => {
        setExtracting(true);
        try {
            const { text, pageCount } = await extractPdfTextShared(file);
            setPdfPageCount(pageCount);
            setPdfText(text);
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
            extractPdfTextLocal(file);
        }
    };

    const removePdf = () => {
        setPdfFile(null);
        setPdfText('');
        setPdfPageCount(0);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleAddCustomLocation = () => {
        const loc = customLocation.trim();
        if (loc && !selectedLocations.includes(loc)) {
            setSelectedLocations([...selectedLocations, loc]);
            if (!suggestedLocations.includes(loc)) {
                setSuggestedLocations([...suggestedLocations, loc]);
            }
        }
        setCustomLocation("");
    };

    const toggleLocation = (loc: string) => {
        if (selectedLocations.includes(loc)) {
            setSelectedLocations(selectedLocations.filter(l => l !== loc));
        } else {
            setSelectedLocations([...selectedLocations, loc]);
        }
    };

    const getCurrentParams = (): CurriculumParams => ({
        mode,
        familyEslEnabled,
        city: effectiveCity,
        ageGroup,
        englishLevel,
        lessonCount,
        duration,
        preferredLocation: [...selectedLocations, customLocation.trim()].filter(Boolean).join(", "),
        customTheme,
    });

    const handleGenerate = async () => {
        setLoading(true);
        setErrorMsg(null);

        const params = getCurrentParams();
        const textForAI = pdfText || undefined;

        try {
            const [enResult, cnResult] = await Promise.allSettled([
                generateCurriculum(params.ageGroup, params.englishLevel, params.lessonCount, params.duration, params.preferredLocation, params.customTheme, params.city, textForAI),
                generateCurriculumCN(params.ageGroup, params.lessonCount, params.duration, params.preferredLocation, params.customTheme, params.city, textForAI),
            ]);

            const curriculumEN = enResult.status === 'fulfilled' ? enResult.value : null;
            const curriculumCN = cnResult.status === 'fulfilled' ? cnResult.value : null;

            if (enResult.status === 'rejected' && cnResult.status === 'rejected') {
                setErrorMsg(`Both generations failed. EN: ${enResult.reason}. CN: ${cnResult.reason}`);
                return;
            }

            safeStorage.set(STORAGE_KEY, { en: curriculumEN, cn: curriculumCN, lang: 'en', params });

            onCurriculumGenerated({ curriculumEN, curriculumCN, params, activeLanguage: 'en' });
        } catch (e: unknown) {
            setErrorMsg(handleError(e, 'Generation failed', 'CurriculumPlanner'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-200 mb-6 flex items-center gap-2">
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
                            <input type="file" ref={fileInputRef} accept=".pdf" onChange={handleFileChange} className="hidden" aria-label="Upload PDF Document" title="Upload PDF Document" />
                        </div>
                    ) : (
                        <div className="flex items-center justify-between bg-teal-50 border border-teal-200 rounded-xl px-4 py-3">
                            <div className="flex items-center gap-3">
                                <FileText size={20} className="text-teal-600" />
                                <div>
                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-400">{pdfFile.name}</p>
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
                            <button onClick={removePdf} className="p-1.5 hover:bg-teal-100 rounded-lg transition-colors" aria-label="Remove extracted PDF" title="Remove PDF">
                                <X size={16} className="text-slate-400" />
                            </button>
                        </div>
                    )}
                </div>

                {/* === Unified Config Block === */}
                <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-5 space-y-5 bg-white dark:bg-slate-900/50">

                    {/* Mode Toggle: School vs Family */}
                    <div>
                        <label className="input-label mb-2 block">{t('input.modeLabel' as any) || 'Mode'}</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => { setMode('school'); setFamilyEslEnabled(false); }}
                                className={`flex items-center justify-center gap-3 px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${mode === 'school'
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm'
                                    : 'border-slate-200 hover:border-emerald-200 hover:bg-slate-50 text-slate-500'
                                    }`}
                            >
                                <School size={18} className={mode === 'school' ? 'text-emerald-600' : 'text-slate-400'} />
                                {t('input.modeSchool' as any) || 'School / Camp'}
                            </button>
                            <button
                                onClick={() => setMode('family')}
                                className={`flex items-center justify-center gap-3 px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${mode === 'family'
                                    ? 'border-pink-500 bg-pink-50 text-pink-800 shadow-sm'
                                    : 'border-slate-200 hover:border-pink-200 hover:bg-slate-50 text-slate-500'
                                    }`}
                            >
                                <Heart size={18} className={mode === 'family' ? 'text-pink-500' : 'text-slate-400'} />
                                {t('input.modeFamily' as any) || 'Family Weekend'}
                            </button>
                        </div>

                        {/* Family sub-option: ESL toggle */}
                        {mode === 'family' && (
                            <div className="mt-3 flex items-center justify-center gap-4 px-4 py-3 bg-pink-50/50 border border-pink-100 rounded-xl">
                                <span className={`text-sm font-medium ${!familyEslEnabled ? 'text-pink-700' : 'text-slate-500'}`}>
                                    {t('input.familyEslOff' as any) || 'Pure Exploration'}
                                </span>
                                <button
                                    onClick={() => setFamilyEslEnabled(!familyEslEnabled)}
                                    className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none ${familyEslEnabled ? 'bg-indigo-500' : 'bg-slate-300'}`}
                                    aria-label="Toggle ESL mode"
                                >
                                    <span className={`block w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${familyEslEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                                </button>
                                <span className={`text-sm font-medium ${familyEslEnabled ? 'text-indigo-700' : 'text-slate-500'}`}>
                                    {t('input.familyEslOn' as any) || 'English Exploration'}
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="border-t border-slate-100 dark:border-slate-800 my-4"></div>

                    {/* Row 1: Theme (full width) */}
                    <div className="space-y-2">
                        <label className="input-label flex items-center gap-2 uppercase tracking-wider text-slate-500">
                            <Sparkles size={16} /> {t('cp.customTheme')}
                        </label>
                        <input type="text" placeholder={t('cp.themePlaceholder')} value={customTheme} onChange={(e) => setCustomTheme(e.target.value)} className="input-field py-3" />
                    </div>

                    {/* Row 2: Age, Level, Lessons, Duration */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                        <div className="space-y-2">
                            <label className="input-label flex items-center gap-2 uppercase tracking-wider text-slate-500">
                                <Users size={16} /> {t('cp.ageGroup')}
                            </label>
                            <select value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)} className="input-field py-3 h-[46px]" aria-label="Select Age Group" title="Age Group">
                                {AGE_RANGES.map(age => <option key={age} value={age}>{t(`age.${age}`)}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="input-label flex items-center gap-2 uppercase tracking-wider text-slate-500">
                                <GraduationCap size={16} /> {t('cp.englishLevel')}
                            </label>
                            <select value={englishLevel} onChange={(e) => setEnglishLevel(e.target.value)} className="input-field py-3 h-[46px]" aria-label="Select English Level" title="English Level">
                                {ENGLISH_LEVELS.map(lvl => <option key={lvl} value={lvl}>{t(`level.${lvl}`)}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="input-label flex items-center gap-2 uppercase tracking-wider text-slate-500">
                                <BookOpen size={16} /> {t('cp.numLessons')}
                            </label>
                            <input type="number" min={1} max={12} value={lessonCount} onChange={(e) => setLessonCount(parseInt(e.target.value) || 4)} className="input-field py-3 h-[46px]" aria-label="Number of Lessons" title="Number of Lessons" placeholder="Number of lessons" />
                        </div>
                        <div className="space-y-2">
                            <label className="input-label flex items-center gap-2 uppercase tracking-wider text-slate-500">
                                <Wind size={16} /> {t('cp.duration')}
                            </label>
                            <input type="text" placeholder={t('cp.durationPlaceholder') as string} value={duration} onChange={(e) => setDuration(e.target.value)} className="input-field py-3 h-[46px]" aria-label="Lesson Duration" title="Lesson Duration" />
                        </div>
                    </div>

                    {/* Row 3: City + Confirm */}
                    <div className="space-y-2">
                        <label className="input-label flex items-center gap-2 uppercase tracking-wider text-slate-500">
                            <MapPin size={16} /> {t('cp.city')}
                        </label>
                        <div className="flex gap-3">
                            <input type="text" placeholder={t('cp.cityPlaceholder') as string} value={city} onChange={(e) => setCity(e.target.value)} className="input-field flex-1 py-3" aria-label="City" title="City" />
                            <button onClick={handleConfirmCity} disabled={loadingLocations} className="btn btn-primary px-6 py-3">
                                {loadingLocations ? <Loader2 size={18} className="animate-spin" /> : <><Search size={18} /> {t('cp.confirm')}</>}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Location suggestions (appear after confirm) */}
                {suggestedLocations.length > 0 && (
                    <div className="space-y-3 p-4 border border-teal-100 bg-teal-50/30 rounded-xl mt-4">
                        <label className="input-label flex items-center gap-2 uppercase tracking-wider text-teal-700">
                            <Compass size={16} /> {t('cp.suggestedLocations')} ({effectiveCity})
                        </label>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {suggestedLocations.map((loc, i) => {
                                const isSelected = selectedLocations.includes(loc);
                                return (
                                    <button
                                        key={`sugg-${i}`}
                                        onClick={() => toggleLocation(loc)}
                                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${isSelected
                                            ? 'bg-teal-600 text-white shadow-md shadow-teal-200'
                                            : 'bg-white dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/10 hover:border-teal-300 hover:text-teal-700 hover:bg-teal-50'
                                            }`}
                                    >
                                        {loc}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Custom location — only show after suggestions are generated */}
                {suggestedLocations.length > 0 && <div className="space-y-2 mt-4">
                    <label className="input-label flex items-center gap-2 uppercase tracking-wider text-slate-500">
                        <MapPin size={16} /> {t('cp.customLocation')}
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder={t('cp.locationPlaceholder')}
                            value={customLocation}
                            onChange={(e) => setCustomLocation(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleAddCustomLocation(); }}
                            className="input-field flex-1 py-3"
                        />
                        <button
                            onClick={handleAddCustomLocation}
                            disabled={!customLocation.trim()}
                            className="bg-teal-50 text-teal-600 rounded-xl px-4 hover:bg-teal-100 hover:text-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-teal-200"
                            title="Add custom location"
                        >
                            <Plus size={20} />
                        </button>
                    </div>
                </div>}

                {/* Generate button */}
                <div className="pt-4">
                    <GenerationButton
                        loading={loading}
                        onClick={handleGenerate}
                        defaultText={pdfText ? t('cp.generateFromPdf') : t('cp.generate')}
                        theme="emerald"
                    />
                </div>
            </div>

            {errorMsg && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-center">
                    {errorMsg}
                </div>
            )}
        </div>
    );
};
