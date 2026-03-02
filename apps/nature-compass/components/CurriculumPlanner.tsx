import React, { useState, useEffect, useRef } from 'react';
import {
    Sparkles, MapPin, BookOpen, Users,
    GraduationCap, ArrowRight, Loader2, Compass,
    Wind, Search, FileText, Upload, X, Plus,
} from 'lucide-react';
import { suggestLocations, generateCurriculum, generateCurriculumCN } from '../services/geminiService';
import { Curriculum, CurriculumParams } from '../types';
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
            const locations = await suggestLocations(effectiveCity);
            setSuggestedLocations(locations);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingLocations(false);
        }
    };

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
        } catch (e: any) {
            setErrorMsg(e.message || 'Generation failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8">
            <div>
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
                            <input type="file" ref={fileInputRef} accept=".pdf" onChange={handleFileChange} className="hidden" />
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
                    <div className="space-y-2">
                        <label className="input-label flex items-center gap-2 uppercase tracking-wider text-slate-500">
                            <Users size={16} /> {t('cp.ageGroup')}
                        </label>
                        <select value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)} className="input-field py-3">
                            {AGE_RANGES.map(age => <option key={age} value={age}>{t(`age.${age}` as any)}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="input-label flex items-center gap-2 uppercase tracking-wider text-slate-500">
                            <GraduationCap size={16} /> {t('cp.englishLevel')}
                        </label>
                        <select value={englishLevel} onChange={(e) => setEnglishLevel(e.target.value)} className="input-field py-3">
                            {ENGLISH_LEVELS.map(lvl => <option key={lvl} value={lvl}>{t(`level.${lvl}` as any)}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="input-label flex items-center gap-2 uppercase tracking-wider text-slate-500">
                            <BookOpen size={16} /> {t('cp.numLessons')}
                        </label>
                        <input type="number" min={1} max={12} value={lessonCount} onChange={(e) => setLessonCount(parseInt(e.target.value) || 4)} className="input-field py-3" />
                    </div>
                    <div className="space-y-2">
                        <label className="input-label flex items-center gap-2 uppercase tracking-wider text-slate-500">
                            <Wind size={16} /> {t('cp.duration')}
                        </label>
                        <input type="text" placeholder={t('cp.durationPlaceholder')} value={duration} onChange={(e) => setDuration(e.target.value)} className="input-field py-3" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                        <label className="input-label flex items-center gap-2 uppercase tracking-wider text-slate-500">
                            <MapPin size={16} /> {t('cp.city')}
                        </label>
                        <div className="flex gap-3">
                            <input type="text" placeholder={t('cp.cityPlaceholder')} value={city} onChange={(e) => setCity(e.target.value)} className="input-field flex-1 py-3" />
                            <button onClick={handleConfirmCity} disabled={loadingLocations} className="btn btn-primary px-6 py-3">
                                {loadingLocations ? <Loader2 size={18} className="animate-spin" /> : <><Search size={18} /> {t('cp.confirm')}</>}
                            </button>
                        </div>
                    </div>
                    {suggestedLocations.length > 0 && (
                        <div className="space-y-3 md:col-span-2 p-4 border border-teal-100 bg-teal-50/30 rounded-xl">
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
                                                : 'bg-white text-slate-600 border border-slate-200 hover:border-teal-300 hover:text-teal-700 hover:bg-teal-50'
                                                }`}
                                        >
                                            {loc}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    <div className="space-y-2 md:col-span-2">
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
                    </div>
                    <div className="space-y-2 md:col-span-2">
                        <label className="input-label flex items-center gap-2 uppercase tracking-wider text-slate-500">
                            <Sparkles size={16} /> {t('cp.customTheme')}
                        </label>
                        <input type="text" placeholder={t('cp.themePlaceholder')} value={customTheme} onChange={(e) => setCustomTheme(e.target.value)} className="input-field py-3" />
                    </div>
                    <div className="md:col-span-2 lg:col-span-3 pt-2">
                        <button
                            onClick={handleGenerate}
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl py-4 font-bold text-lg flex items-center justify-center gap-3 hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? <Loader2 className="animate-spin" size={22} /> : <>{pdfText ? t('cp.generateFromPdf') : t('cp.generate')} <ArrowRight size={20} /></>}
                        </button>
                    </div>
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
