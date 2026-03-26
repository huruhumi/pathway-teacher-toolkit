import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle, Compass, FileText, Heart, Loader2, MapPin, Plus, School, Search, Sparkles, Users, Wind, X, XCircle, Zap } from 'lucide-react';
import { suggestLocations, generateCurriculum, generateCurriculumCN } from '../services/curriculumService';
import { Curriculum, CurriculumParams, FactSheetResult } from '../types';
import { AGE_RANGES } from '../constants';
import { useLanguage } from '../i18n/LanguageContext';
import { handleError } from '@shared/services/logger';
import { safeStorage } from '@shared/safeStorage';
import { extractPdfText as extractPdfTextShared } from '@shared/utils/pdf';
import { GenerationButton } from '@shared/components/GenerationButton';
import { generateCurriculumGroundingFactSheet } from '../services/groundingService';

const ENGLISH_LEVELS = [
    'Zero Foundation',
    'Elementary (A1)',
    'Pre-Intermediate (A2)',
    'Intermediate (B1)',
    'Upper-Intermediate (B2)',
    'Advanced (C1)',
    'Proficient (C2)',
];

type GroundingStatus = 'idle' | 'researching' | 'done' | 'error';
type GroundingProgress = { status: GroundingStatus; message: string; progress: number };
const INITIAL_GROUNDING_PROGRESS: GroundingProgress = { status: 'idle', message: '', progress: 0 };
const STORAGE_KEY = 'nature-compass-curriculum';

interface CurriculumPlannerProps {
    onCurriculumGenerated: (data: {
        curriculumEN: Curriculum | null;
        curriculumCN: Curriculum | null;
        params: CurriculumParams;
        activeLanguage: 'en' | 'zh';
        sharedFactSheet?: FactSheetResult;
    }) => void;
    externalCurriculum?: {
        curriculum: Curriculum;
        params: CurriculumParams;
        language?: 'en' | 'zh';
        pairedCurriculum?: Curriculum;
    } | null;
}

export const CurriculumPlanner: React.FC<CurriculumPlannerProps> = ({ onCurriculumGenerated, externalCurriculum }) => {
    const { t } = useLanguage();
    const safeText = (key: string, fallback: string) => {
        const value = t(key as any);
        return !value || value === key ? fallback : value;
    };
    const [ageGroup, setAgeGroup] = useState(AGE_RANGES[0]);
    const [englishLevel, setEnglishLevel] = useState(ENGLISH_LEVELS[0]);
    const [lessonCount, setLessonCount] = useState(4);
    const [duration, setDuration] = useState('180');
    const [mode, setMode] = useState<'school' | 'family'>('school');
    const [familyEslEnabled, setFamilyEslEnabled] = useState(true);
    const [city, setCity] = useState('');
    const [customTheme, setCustomTheme] = useState('');
    const [customDescription, setCustomDescription] = useState('');
    const [suggestedLocations, setSuggestedLocations] = useState<string[]>([]);
    const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
    const [customLocation, setCustomLocation] = useState('');
    const [loadingLocations, setLoadingLocations] = useState(false);
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [pdfText, setPdfText] = useState('');
    const [extractingPdf, setExtractingPdf] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [ragMode, setRagMode] = useState<'off' | 'cloud'>('off');
    const [groundingProgress, setGroundingProgress] = useState<GroundingProgress>(INITIAL_GROUNDING_PROGRESS);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const abortRef = useRef<AbortController | null>(null);

    const effectiveCity = city.trim() || 'Wuhan';

    useEffect(() => {
        if (!externalCurriculum) return;
        const lang = externalCurriculum.language || 'en';
        const params = externalCurriculum.params;
        setAgeGroup(params.ageGroup || AGE_RANGES[0]);
        setEnglishLevel(params.englishLevel || ENGLISH_LEVELS[0]);
        setLessonCount(params.lessonCount || 4);
        setDuration(params.duration || '180');
        setMode(params.mode || 'school');
        setFamilyEslEnabled(params.familyEslEnabled ?? true);
        setCity(params.city || '');
        setCustomTheme(params.customTheme || '');
        setCustomDescription(params.customDescription || '');
        if (params.preferredLocation) {
            const locations = params.preferredLocation.split(',').map((s) => s.trim()).filter(Boolean);
            setSelectedLocations(locations);
            setSuggestedLocations(locations);
        }
        onCurriculumGenerated({
            curriculumEN: lang === 'en' ? externalCurriculum.curriculum : (externalCurriculum.pairedCurriculum || null),
            curriculumCN: lang === 'zh' ? externalCurriculum.curriculum : (externalCurriculum.pairedCurriculum || null),
            params,
            activeLanguage: lang,
        });
    }, [externalCurriculum, onCurriculumGenerated]);

    useEffect(() => {
        if (externalCurriculum) return;
        const data = safeStorage.get<{ en?: Curriculum; cn?: Curriculum; lang?: 'en' | 'zh'; params?: CurriculumParams }>(STORAGE_KEY, {});
        if (!data.params || (!data.en && !data.cn)) return;
        const params = data.params;
        setAgeGroup(params.ageGroup || AGE_RANGES[0]);
        setEnglishLevel(params.englishLevel || ENGLISH_LEVELS[0]);
        setLessonCount(params.lessonCount || 4);
        setDuration(params.duration || '180');
        setMode(params.mode || 'school');
        setFamilyEslEnabled(params.familyEslEnabled ?? true);
        setCity(params.city || '');
        setCustomTheme(params.customTheme || '');
        setCustomDescription(params.customDescription || '');
        if (params.preferredLocation) {
            const locations = params.preferredLocation.split(',').map((s) => s.trim()).filter(Boolean);
            setSelectedLocations(locations);
            setSuggestedLocations(locations);
        }
        onCurriculumGenerated({ curriculumEN: data.en || null, curriculumCN: data.cn || null, params, activeLanguage: data.lang || 'en' });
    }, [externalCurriculum, onCurriculumGenerated]);

    const getCurrentParams = (): CurriculumParams => ({
        mode,
        familyEslEnabled,
        city: effectiveCity,
        ageGroup,
        englishLevel,
        lessonCount,
        duration,
        preferredLocation: [...selectedLocations, customLocation.trim()].filter(Boolean).join(', '),
        customTheme,
        customDescription: customDescription.trim() || undefined,
    });

    const handleConfirmCity = async () => {
        setLoadingLocations(true);
        try {
            const locations = await suggestLocations(effectiveCity, customTheme.trim() || undefined);
            setSuggestedLocations(locations);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingLocations(false);
        }
    };

    const handleGenerate = async () => {
        const ac = new AbortController();
        abortRef.current = ac;
        setLoading(true);
        setErrorMsg(null);
        setGroundingProgress(INITIAL_GROUNDING_PROGRESS);
        const params = getCurrentParams();

        try {
            const [enResult, cnResult] = await Promise.allSettled([
                generateCurriculum(params.ageGroup, params.englishLevel, params.lessonCount, params.duration, params.preferredLocation, params.customTheme, params.city, pdfText || undefined, params.mode, params.familyEslEnabled, params.customDescription),
                generateCurriculumCN(params.ageGroup, params.lessonCount, params.duration, params.preferredLocation, params.customTheme, params.city, pdfText || undefined, params.mode, params.familyEslEnabled, params.customDescription),
            ]);

            const curriculumEN = enResult.status === 'fulfilled' ? enResult.value : null;
            const curriculumCN = cnResult.status === 'fulfilled' ? cnResult.value : null;
            if (!curriculumEN && !curriculumCN) {
                setErrorMsg(`Both generations failed. EN: ${String(enResult.status === 'rejected' ? enResult.reason : '')} CN: ${String(cnResult.status === 'rejected' ? cnResult.reason : '')}`);
                return;
            }

            let sharedFactSheet: FactSheetResult | undefined;
            if (ragMode === 'cloud') {
                const lessonTitles = (curriculumEN || curriculumCN)?.lessons?.map((lesson) => lesson.title).filter(Boolean) ?? [];
                setGroundingProgress({ status: 'researching', message: '正在通过 Google Grounding 生成课程共享 Fact Sheet...', progress: 0.35 });
                try {
                    sharedFactSheet = await generateCurriculumGroundingFactSheet(params, lessonTitles, ac.signal);
                    const meta = sharedFactSheet.freshnessMeta;
                    setGroundingProgress({ status: 'done', message: `共享底稿完成：有效窗口 ${meta.effectiveWindow}，风险 ${meta.riskLevel}。`, progress: 1 });
                } catch (groundingErr: any) {
                    if (ac.signal.aborted) throw groundingErr;
                    console.warn('[CurriculumPlanner] Grounding failed, continue without shared fact sheet.', groundingErr);
                    setGroundingProgress({ status: 'error', message: 'Grounding 失败，已降级为继续生成课程（无共享底稿）。', progress: 1 });
                }
            }

            const activeLanguage: 'en' | 'zh' = curriculumEN ? 'en' : 'zh';
            safeStorage.set(STORAGE_KEY, { en: curriculumEN, cn: curriculumCN, lang: activeLanguage, params });
            onCurriculumGenerated({ curriculumEN, curriculumCN, params, activeLanguage, sharedFactSheet });
        } catch (e: unknown) {
            if (ac.signal.aborted) return;
            setErrorMsg(handleError(e, 'Generation failed', 'CurriculumPlanner'));
        } finally {
            setLoading(false);
            abortRef.current = null;
        }
    };

    const handleCancel = () => {
        abortRef.current?.abort();
        abortRef.current = null;
        setLoading(false);
        setGroundingProgress(INITIAL_GROUNDING_PROGRESS);
    };

    const handleAddCustomLocation = () => {
        const loc = customLocation.trim();
        if (!loc) return;
        if (!selectedLocations.includes(loc)) setSelectedLocations((prev) => [...prev, loc]);
        if (!suggestedLocations.includes(loc)) setSuggestedLocations((prev) => [...prev, loc]);
        setCustomLocation('');
    };

    const handlePdfChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || file.type !== 'application/pdf') return;
        setPdfFile(file);
        setExtractingPdf(true);
        try {
            const { text } = await extractPdfTextShared(file);
            setPdfText(text);
        } catch (err) {
            console.error(err);
            setErrorMsg('PDF parsing failed.');
        } finally {
            setExtractingPdf(false);
        }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-200 mb-2 flex items-center gap-2">
                <Compass size={22} className="text-teal-600" />
                {t('cp.title')}
            </h2>

            <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-5 space-y-4 bg-white dark:bg-slate-900/50">
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => { setMode('school'); setFamilyEslEnabled(false); }} className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border ${mode === 'school' ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-500'}`}><School size={16} />{t('input.modeSchool' as any) || 'School / Camp'}</button>
                    <button onClick={() => setMode('family')} className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border ${mode === 'family' ? 'border-pink-500 bg-pink-50 text-pink-800' : 'border-slate-200 text-slate-500'}`}><Heart size={16} />{t('input.modeFamily' as any) || 'Family Weekend'}</button>
                </div>
                {mode === 'family' && (
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                        <input type="checkbox" checked={familyEslEnabled} onChange={(e) => setFamilyEslEnabled(e.target.checked)} />
                        {t('input.familyEslOn' as any) || 'English Exploration'}
                    </label>
                )}

                <div className="space-y-2">
                    <label className="input-label flex items-center gap-2 uppercase tracking-wider text-slate-500"><Sparkles size={16} /> {t('cp.customTheme')}</label>
                    <input type="text" value={customTheme} onChange={(e) => setCustomTheme(e.target.value)} placeholder={t('cp.themePlaceholder')} className="input-field py-3" />
                    <textarea value={customDescription} onChange={(e) => setCustomDescription(e.target.value)} rows={2} placeholder={safeText('cp.descriptionPlaceholder', '可选：补充教学目标、重点关注方向、特殊要求。')} className="input-field py-2.5 text-sm resize-none" />
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                        <label className="input-label flex items-center gap-2 uppercase tracking-wider text-slate-500"><Users size={16} /> {t('cp.ageGroup')}</label>
                        <select value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)} className="input-field py-3 h-[46px]">{AGE_RANGES.map((age) => <option key={age} value={age}>{t(`age.${age}`)}</option>)}</select>
                    </div>
                    <div>
                        <label className="input-label uppercase tracking-wider text-slate-500">Level</label>
                        <select value={englishLevel} onChange={(e) => setEnglishLevel(e.target.value)} className="input-field py-3 h-[46px]">{ENGLISH_LEVELS.map((lvl) => <option key={lvl} value={lvl}>{t(`level.${lvl}`)}</option>)}</select>
                    </div>
                    <div>
                        <label className="input-label uppercase tracking-wider text-slate-500">Lessons</label>
                        <input type="number" min={1} max={12} value={lessonCount} onChange={(e) => setLessonCount(parseInt(e.target.value, 10) || 4)} className="input-field py-3 h-[46px]" />
                    </div>
                    <div>
                        <label className="input-label flex items-center gap-2 uppercase tracking-wider text-slate-500"><Wind size={16} /> {t('cp.duration')}</label>
                        <input type="text" value={duration} onChange={(e) => setDuration(e.target.value)} className="input-field py-3 h-[46px]" />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="input-label flex items-center gap-2 uppercase tracking-wider text-slate-500"><MapPin size={16} /> {t('cp.city')}</label>
                    <div className="flex gap-2">
                        <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className="input-field flex-1 py-3" placeholder={t('cp.cityPlaceholder') as string} />
                        <button onClick={handleConfirmCity} disabled={loadingLocations} className="btn btn-primary px-5 py-3">{loadingLocations ? <Loader2 size={16} className="animate-spin" /> : <><Search size={16} /> {t('cp.confirm')}</>}</button>
                    </div>
                </div>

                {suggestedLocations.length > 0 && (
                    <div className="space-y-2">
                        <label className="input-label uppercase tracking-wider text-slate-500">Suggested Locations</label>
                        <div className="flex flex-wrap gap-2">
                            {suggestedLocations.map((loc) => (
                                <button key={loc} onClick={() => setSelectedLocations((prev) => prev.includes(loc) ? prev.filter((l) => l !== loc) : [...prev, loc])} className={`px-3 py-1.5 rounded-full text-sm border ${selectedLocations.includes(loc) ? 'bg-teal-600 border-teal-600 text-white' : 'bg-white border-slate-200 text-slate-600'}`}>{loc}</button>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input type="text" value={customLocation} onChange={(e) => setCustomLocation(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleAddCustomLocation(); }} placeholder={t('cp.locationPlaceholder')} className="input-field flex-1 py-2.5" />
                            <button onClick={handleAddCustomLocation} className="px-3 rounded-xl border border-teal-200 text-teal-600"><Plus size={18} /></button>
                        </div>
                    </div>
                )}

                <div className="space-y-2">
                    <label className="input-label flex items-center gap-2 uppercase tracking-wider text-slate-500"><FileText size={16} /> {t('cp.uploadPdf')}</label>
                    {!pdfFile ? (
                        <button onClick={() => fileInputRef.current?.click()} className="w-full p-3 rounded-xl border border-dashed border-slate-300 text-slate-500">Upload PDF (optional)</button>
                    ) : (
                        <div className="flex items-center justify-between p-3 rounded-xl border border-teal-200 bg-teal-50 text-sm text-slate-700">
                            <span>{pdfFile.name} {extractingPdf ? '(parsing...)' : ''}</span>
                            <button onClick={() => { setPdfFile(null); setPdfText(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}><X size={16} /></button>
                        </div>
                    )}
                    <input ref={fileInputRef} type="file" accept=".pdf" onChange={handlePdfChange} className="hidden" />
                </div>

                <div className="space-y-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-sm font-semibold text-slate-700 flex items-center gap-2"><Zap size={14} className="text-indigo-600" /> AI 资料研究模式</div>
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => setRagMode('off')} className={`px-3 py-2 text-xs rounded-lg border ${ragMode === 'off' ? 'bg-slate-600 text-white border-slate-600' : 'bg-white border-slate-200 text-slate-500'}`}><XCircle size={14} className="inline mr-1" />关闭</button>
                        <button onClick={() => setRagMode('cloud')} className={`px-3 py-2 text-xs rounded-lg border ${ragMode === 'cloud' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200 text-slate-500'}`}><Zap size={14} className="inline mr-1" />快速检索</button>
                    </div>
                    {groundingProgress.status !== 'idle' && (
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${groundingProgress.status === 'done' ? 'bg-emerald-50 border-emerald-200' : groundingProgress.status === 'error' ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
                            {groundingProgress.status === 'done' ? <CheckCircle size={16} className="text-emerald-600" /> : groundingProgress.status === 'error' ? <XCircle size={16} className="text-red-500" /> : <Loader2 size={16} className="animate-spin text-blue-600" />}
                            <div className="flex-1">
                                <div className="text-xs">{groundingProgress.message}</div>
                                <div className="mt-1 h-1.5 bg-black/10 rounded-full overflow-hidden"><div className={`h-full ${groundingProgress.status === 'done' ? 'bg-emerald-500' : groundingProgress.status === 'error' ? 'bg-red-400' : 'bg-blue-500'}`} style={{ width: `${groundingProgress.progress * 100}%` }} /></div>
                            </div>
                        </div>
                    )}
                </div>

                <GenerationButton loading={loading} onClick={handleGenerate} onCancel={handleCancel} defaultText={pdfText ? t('cp.generateFromPdf') : t('cp.generate')} theme="emerald" />
            </div>

            {errorMsg && <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-center">{errorMsg}</div>}
        </div>
    );
};
