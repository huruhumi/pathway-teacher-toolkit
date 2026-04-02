import React, { useState, useMemo } from 'react';
import { RecordCard } from '@shared/components/RecordCard';
import { EmptyState } from '@shared/components/EmptyState';
import { FilterBar, FilterSelect } from '@shared/components/FilterBar';
import { RecordsTabSwitcher } from '@shared/components/RecordsTabSwitcher';
import { Modal } from '@shared/components/ui/Modal';
import { downloadBlob } from '@shared/utils/download';
import { useToast } from '@shared/stores/useToast';
import type { SaveResult } from '@shared/types';
import { SavedLessonPlan, SavedCurriculum } from '../types';
import {
    Filter, ArrowUpDown, BookOpen, Languages,
    MapPin, Users, GraduationCap, FileText, Compass, School, Heart, ShieldAlert, ShieldCheck, Archive, RotateCcw, Loader2
} from 'lucide-react';
import { AGE_RANGES } from '../constants';
import { useLanguage } from '../i18n/LanguageContext';
import { assessNatureCurriculumQuality, assessNatureLessonPlanQuality } from '@shared/config/recordQuality';

interface SavedProjectsPageProps {
    savedPlans: SavedLessonPlan[];
    savedCurricula: SavedCurriculum[];
    onLoad: (plan: SavedLessonPlan) => void;
    onDelete: (id: string) => void;
    onRename: (id: string, newName: string) => void;
    onDeleteCurriculum: (id: string) => void;
    onRenameCurriculum: (id: string, newName: string) => void;
    onLoadCurriculum: (saved: SavedCurriculum) => void;
    onDeleteMultiplePlans?: (ids: string[]) => void;
    onDeleteMultipleCurricula?: (ids: string[]) => void;
    onListDeletedPlans: () => Promise<SavedLessonPlan[]>;
    onListDeletedCurricula: () => Promise<SavedCurriculum[]>;
    onRestorePlan: (id: string) => Promise<SaveResult>;
    onRestoreCurriculum: (id: string) => Promise<SaveResult>;
    onPurgePlan: (id: string) => Promise<SaveResult>;
    onPurgeCurriculum: (id: string) => Promise<SaveResult>;
}

const ENGLISH_LEVELS = [
    "Zero Foundation",
    "Elementary (A1)", "Pre-Intermediate (A2)",
    "Intermediate (B1)", "Upper-Intermediate (B2)",
    "Advanced (C1)", "Proficient (C2)"
];

const LESSON_COUNT_RANGES = [
    { label: '1-3 Lessons', min: 1, max: 3 },
    { label: '4-6 Lessons', min: 4, max: 6 },
    { label: '7-9 Lessons', min: 7, max: 9 },
    { label: '10+ Lessons', min: 10, max: 99 },
];

type DeletedMetaLike = {
    __deletedMeta?: {
        deletedAt?: number;
        purgeAt?: number;
    };
};

function getDeletedMeta(record: DeletedMetaLike): { deletedAt: number; purgeAt: number | null } {
    const deletedAt = Number(record?.__deletedMeta?.deletedAt || 0);
    const purgeAt = Number(record?.__deletedMeta?.purgeAt || 0);
    return {
        deletedAt: Number.isFinite(deletedAt) && deletedAt > 0 ? deletedAt : Date.now(),
        purgeAt: Number.isFinite(purgeAt) && purgeAt > 0 ? purgeAt : null,
    };
}

export const SavedProjectsPage: React.FC<SavedProjectsPageProps> = ({
    savedPlans, savedCurricula, onLoad, onDelete, onRename,
    onDeleteCurriculum, onRenameCurriculum, onLoadCurriculum,
    onDeleteMultiplePlans, onDeleteMultipleCurricula,
    onListDeletedPlans, onListDeletedCurricula,
    onRestorePlan, onRestoreCurriculum,
    onPurgePlan, onPurgeCurriculum,
}) => {
    const { t } = useLanguage();
    const toast = useToast();
    const [activeTab, setActiveTab] = useState<'curricula' | 'kits'>('curricula');

    // --- Curricula filter state ---
    const [cSearch, setCSearch] = useState('');
    const [cCity, setCCity] = useState('all');
    const [cAge, setCAge] = useState('all');
    const [cLevel, setCLevel] = useState('all');
    const [cCount, setCCount] = useState('all');
    const [cSort, setCSort] = useState('newest');
    const [cLang, setCLang] = useState<'all' | 'en' | 'zh'>('all');
    const [cQuality, setCQuality] = useState<'all' | 'ok' | 'needs_review'>('all');

    // --- Lesson Kit filter state ---
    const [kSearch, setKSearch] = useState('');
    const [kCity, setKCity] = useState('all');
    const [kLevel, setKLevel] = useState('All Levels');
    const [kActivity, setKActivity] = useState('all');
    const [kSort, setKSort] = useState('Newest First');
    const [kLang, setKLang] = useState<'all' | 'en' | 'zh'>('all');
    const [kMode, setKMode] = useState<'all' | 'school' | 'family'>('all');
    const [kQuality, setKQuality] = useState<'all' | 'ok' | 'needs_review'>('all');

    // --- Multi-select state ---
    const [selectedCurriculaIds, setSelectedCurriculaIds] = useState<Set<string>>(new Set());
    const [selectedPlanIds, setSelectedPlanIds] = useState<Set<string>>(new Set());
    const [showRecycleBin, setShowRecycleBin] = useState(false);
    const [isRecycleLoading, setIsRecycleLoading] = useState(false);
    const [deletedPlans, setDeletedPlans] = useState<SavedLessonPlan[]>([]);
    const [deletedCurricula, setDeletedCurricula] = useState<SavedCurriculum[]>([]);
    const [recycleActionKey, setRecycleActionKey] = useState<string | null>(null);

    const toggleCurriculumSelect = (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setSelectedCurriculaIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };
    const togglePlanSelect = (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setSelectedPlanIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };
    const selectAllCurricula = () => {
        if (selectedCurriculaIds.size === filteredCurricula.length) {
            setSelectedCurriculaIds(new Set());
        } else {
            setSelectedCurriculaIds(new Set(filteredCurricula.map(c => c.id)));
        }
    };
    const selectAllPlans = () => {
        if (selectedPlanIds.size === filteredPlans.length) {
            setSelectedPlanIds(new Set());
        } else {
            setSelectedPlanIds(new Set(filteredPlans.map(p => p.id)));
        }
    };
    const handleBatchDeleteCurricula = () => {
        if (selectedCurriculaIds.size === 0) return;
        if (!window.confirm(t('saved.confirmBatchDelete') || `Delete ${selectedCurriculaIds.size} selected items?`)) return;
        if (onDeleteMultipleCurricula) {
            onDeleteMultipleCurricula(Array.from(selectedCurriculaIds));
        } else {
            selectedCurriculaIds.forEach(id => onDeleteCurriculum(id));
        }
        setSelectedCurriculaIds(new Set());
    };
    const handleBatchDeletePlans = () => {
        if (selectedPlanIds.size === 0) return;
        if (!window.confirm(t('saved.confirmBatchDelete') || `Delete ${selectedPlanIds.size} selected items?`)) return;
        if (onDeleteMultiplePlans) {
            onDeleteMultiplePlans(Array.from(selectedPlanIds));
        } else {
            selectedPlanIds.forEach(id => onDelete(id));
        }
        setSelectedPlanIds(new Set());
    };

    const loadRecycleBin = async () => {
        setIsRecycleLoading(true);
        try {
            const [plans, curricula] = await Promise.all([
                onListDeletedPlans(),
                onListDeletedCurricula(),
            ]);
            setDeletedPlans(plans);
            setDeletedCurricula(curricula);
        } catch (err: any) {
            toast.error(`Failed to load recycle bin. ${err?.message || 'Unexpected error'}`);
        } finally {
            setIsRecycleLoading(false);
        }
    };

    const openRecycleBin = async () => {
        setShowRecycleBin(true);
        await loadRecycleBin();
    };

    const restoreDeleted = async (kind: 'plan' | 'curriculum', id: string, name: string) => {
        const actionKey = `${kind}:${id}`;
        setRecycleActionKey(actionKey);
        try {
            const result = kind === 'plan'
                ? await onRestorePlan(id)
                : await onRestoreCurriculum(id);
            if (!result.ok) {
                toast.error(`Restore failed for "${name}". Please retry.`);
                return;
            }
            toast.success(`Restored "${name}".`);
            await loadRecycleBin();
        } finally {
            setRecycleActionKey(null);
        }
    };

    const purgeDeleted = async (kind: 'plan' | 'curriculum', id: string, name: string) => {
        const firstConfirmed = window.confirm(`Permanently delete "${name}"? This cannot be undone.`);
        if (!firstConfirmed) return;
        const secondConfirmed = window.confirm(`Please confirm again: permanently remove "${name}" now?`);
        if (!secondConfirmed) return;

        const actionKey = `${kind}:${id}`;
        setRecycleActionKey(actionKey);
        try {
            const result = kind === 'plan'
                ? await onPurgePlan(id)
                : await onPurgeCurriculum(id);
            if (!result.ok) {
                toast.error(`Permanent delete failed for "${name}". Please retry.`);
                return;
            }
            toast.success(`Permanently deleted "${name}".`);
            await loadRecycleBin();
        } finally {
            setRecycleActionKey(null);
        }
    };

    // === Dynamic options ===
    const uniqueCities = useMemo(() =>
        Array.from(new Set(savedCurricula.map(c => c.params.city))).sort(),
        [savedCurricula]
    );
    const uniqueActivities = useMemo(() =>
        Array.from(new Set(savedPlans.map(p => p.plan.basicInfo?.activityType).filter(Boolean))).sort(),
        [savedPlans]
    );
    const uniqueKitCities = useMemo(() =>
        Array.from(new Set(savedPlans.map(p => p.plan.basicInfo?.location).filter(Boolean))).sort(),
        [savedPlans]
    );
    const curriculumQualityMap = useMemo(() => {
        const map = new Map<string, ReturnType<typeof assessNatureCurriculumQuality>>();
        savedCurricula.forEach((item) => {
            map.set(item.id, assessNatureCurriculumQuality(item.curriculum as any, item.params as any));
        });
        return map;
    }, [savedCurricula]);
    const planQualityMap = useMemo(() => {
        const map = new Map<string, ReturnType<typeof assessNatureLessonPlanQuality>>();
        savedPlans.forEach((item) => {
            map.set(item.id, assessNatureLessonPlanQuality(item.plan as any));
        });
        return map;
    }, [savedPlans]);

    // === Curricula filtering ===
    const filteredCurricula = useMemo(() => {
        return savedCurricula
            .filter(c => {
                if (cSearch) {
                    const s = cSearch.toLowerCase();
                    const inMeta = c.name.toLowerCase().includes(s)
                        || c.curriculum.theme.toLowerCase().includes(s)
                        || c.curriculum.overview.toLowerCase().includes(s);
                    const inLessons = c.curriculum.lessons.some(l => l.title.toLowerCase().includes(s));
                    if (!inMeta && !inLessons) return false;
                }
                if (cCity !== 'all' && c.params.city !== cCity) return false;
                if (cAge !== 'all' && !c.params.ageGroup.startsWith(cAge)) return false;
                if (cLevel !== 'all' && c.params.englishLevel !== cLevel) return false;
                if (cCount !== 'all') {
                    const range = LESSON_COUNT_RANGES.find(r => r.label === cCount);
                    if (range) {
                        const len = c.curriculum.lessons.length;
                        if (len < range.min || len > range.max) return false;
                    }
                }
                if (cLang !== 'all' && (c.language || 'en') !== cLang) return false;
                if (cQuality !== 'all') {
                    const quality = curriculumQualityMap.get(c.id)?.status || 'unknown';
                    if (quality !== cQuality) return false;
                }
                return true;
            })
            .sort((a, b) => {
                if (cSort === 'newest') return b.timestamp - a.timestamp;
                if (cSort === 'oldest') return a.timestamp - b.timestamp;
                if (cSort === 'lessons-asc') return a.curriculum.lessons.length - b.curriculum.lessons.length;
                if (cSort === 'lessons-desc') return b.curriculum.lessons.length - a.curriculum.lessons.length;
                return 0;
            });
    }, [savedCurricula, cSearch, cCity, cAge, cLevel, cCount, cSort, cLang, cQuality, curriculumQualityMap]);

    // === Lesson Kits filtering ===
    const filteredPlans = useMemo(() => {
        return savedPlans
            .filter(p => {
                if (kSearch) {
                    const s = kSearch.toLowerCase();
                    const inName = p.name.toLowerCase().includes(s);
                    const inTheme = p.plan.basicInfo?.theme?.toLowerCase().includes(s);
                    const inMission = p.plan.missionBriefing?.title?.toLowerCase().includes(s);
                    if (!inName && !inTheme && !inMission) return false;
                }
                if (kCity !== 'all' && p.plan.basicInfo?.location !== kCity) return false;
                if (kLevel !== 'All Levels') {
                    const audience = (p.plan.basicInfo?.targetAudience || '').toLowerCase();
                    if (kLevel === 'Beginner' && !/(beginner|a1|a2)/.test(audience)) return false;
                    if (kLevel === 'Intermediate' && !/(intermediate|b1|b2)/.test(audience)) return false;
                    if (kLevel === 'Advanced' && !/(advanced|c1|c2)/.test(audience)) return false;
                }
                if (kActivity !== 'all' && p.plan.basicInfo?.activityType !== kActivity) return false;
                if (kLang !== 'all' && (p.language || 'en') !== kLang) return false;
                if (kMode !== 'all') {
                    const planMode = p.mode || 'school';
                    if (planMode !== kMode) return false;
                }
                if (kQuality !== 'all') {
                    const quality = planQualityMap.get(p.id)?.status || 'unknown';
                    if (quality !== kQuality) return false;
                }
                return true;
            })
            .sort((a, b) => kSort === 'Newest First' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp);
    }, [savedPlans, kSearch, kCity, kLevel, kActivity, kSort, kLang, kMode, kQuality, planQualityMap]);

    // === Helpers ===
    const getLevelLabel = (audience: string) => {
        const lower = (audience || '').toLowerCase();
        if (/(beginner|a1|a2)/.test(lower)) return 'Beginner';
        if (/(intermediate|b1|b2)/.test(lower)) return 'Intermediate';
        if (/(advanced|c1|c2)/.test(lower)) return 'Advanced';
        return 'General';
    };

    return (
        <div className="animate-fade-in-up">
            {/* Tab Switcher */}
            <RecordsTabSwitcher
                tabs={[
                    { key: 'curricula', label: t('nav.curriculum') || 'Curricula', icon: <FileText size={16} />, count: savedCurricula.length },
                    { key: 'kits', label: t('nav.lessonKit') || 'Lesson Kits', icon: <BookOpen size={16} />, count: savedPlans.length },
                ]}
                activeTab={activeTab}
                onTabChange={(key) => setActiveTab(key as 'curricula' | 'kits')}
                accentColor="emerald"
            />
            <div className="mt-3 flex justify-end">
                <button
                    type="button"
                    onClick={() => { void openRecycleBin(); }}
                    className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                >
                    <Archive className="w-4 h-4" />
                    Recycle Bin
                </button>
            </div>

            {/* ===== CURRICULA TAB ===== */}
            {activeTab === 'curricula' && (
                <div className="space-y-6">
                    <FilterBar
                        search={cSearch}
                        onSearchChange={setCSearch}
                        searchPlaceholder={t('saved.search')}
                        filters={
                            <>
                                <FilterSelect value={cCity} onChange={setCCity} icon={MapPin}>
                                    <option value="all">{t('saved.allCities')}</option>
                                    {uniqueCities.map(city => <option key={city} value={city}>{city}</option>)}
                                </FilterSelect>
                                <FilterSelect value={cAge} onChange={setCAge} icon={Users}>
                                    <option value="all">{t('saved.allAges')}</option>
                                    {AGE_RANGES.map(age => {
                                        const short = age.split(' ')[0];
                                        return <option key={age} value={short}>{t(`age.${age} `)}</option>;
                                    })}
                                </FilterSelect>
                                <FilterSelect value={cLevel} onChange={setCLevel} icon={GraduationCap}>
                                    <option value="all">{t('saved.allLevels')}</option>
                                    {ENGLISH_LEVELS.map(lv => <option key={lv} value={lv}>{t(`level.${lv} `)}</option>)}
                                </FilterSelect>
                                <FilterSelect value={cCount} onChange={setCCount} icon={BookOpen}>
                                    <option value="all">{t('saved.anyCount')}</option>
                                    {LESSON_COUNT_RANGES.map(r => <option key={r.label} value={r.label}>{r.label}</option>)}
                                </FilterSelect>
                                <FilterSelect value={cSort} onChange={setCSort} icon={ArrowUpDown}>
                                    <option value="newest">{t('saved.newestFirst')}</option>
                                    <option value="oldest">{t('saved.oldestFirst')}</option>
                                    <option value="lessons-desc">{t('saved.lessonsDesc')}</option>
                                    <option value="lessons-asc">{t('saved.lessonsAsc')}</option>
                                </FilterSelect>
                                <FilterSelect value={cQuality} onChange={(v) => setCQuality(v as 'all' | 'ok' | 'needs_review')} icon={ShieldAlert}>
                                    <option value="all">All Quality</option>
                                    <option value="needs_review">Needs Review</option>
                                    <option value="ok">Ready</option>
                                </FilterSelect>
                                <FilterSelect value={cLang} onChange={(v) => setCLang(v as 'all' | 'en' | 'zh')} icon={Languages}>
                                    <option value="all">{t('saved.allLangs')}</option>
                                    <option value="en">{t('saved.english')}</option>
                                    <option value="zh">{t('saved.chinese')}</option>
                                </FilterSelect>
                            </>
                        }
                    />

                    {filteredCurricula.length === 0 ? (
                        <EmptyState
                            icon={FileText}
                            title={t('saved.noCurricula')}
                            description={savedCurricula.length > 0 ? t('saved.adjustFilters') : t('saved.generateFirst')}
                        />
                    ) : (
                        <>
                            {/* Batch action bar */}
                            <div className="flex items-center gap-3 mb-3">
                                <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600 dark:text-slate-400 select-none" onClick={(e) => e.stopPropagation()}>
                                    <input
                                        type="checkbox"
                                        checked={selectedCurriculaIds.size === filteredCurricula.length && filteredCurricula.length > 0}
                                        onChange={selectAllCurricula}
                                        className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                    />
                                    {t('saved.selectAll') || 'Select All'}
                                </label>
                                {selectedCurriculaIds.size > 0 && (
                                    <button
                                        onClick={handleBatchDeleteCurricula}
                                        className="px-3 py-1 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-full transition-colors"
                                    >
                                        {t('saved.deleteSelected') || `Delete Selected (${selectedCurriculaIds.size})`}
                                    </button>
                                )}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredCurricula.map(item => (
                                    <RecordCard
                                        key={item.id}
                                        title={item.name}
                                        description={item.curriculum.overview}
                                        tags={[
                                            { icon: <MapPin size={11} />, label: item.params.city },
                                            { icon: <Users size={11} />, label: item.params.ageGroup.split(' ')[0] },
                                            { icon: <GraduationCap size={11} />, label: item.params.englishLevel.split(' ')[0] },
                                            { icon: <BookOpen size={11} />, label: `${item.curriculum.lessons.length} ${t('saved.lessons')}`, accent: true },
                                            ...(curriculumQualityMap.get(item.id)?.status === 'needs_review'
                                                ? [{ icon: <ShieldAlert size={11} />, label: 'Needs Review', className: 'bg-amber-50 text-amber-700 font-bold' }]
                                                : [{ icon: <ShieldCheck size={11} />, label: 'Ready', className: 'bg-emerald-50 text-emerald-700 font-bold' }]),
                                            { icon: <Languages size={11} />, label: item.language === 'zh' ? '中文' : 'EN', className: item.language === 'zh' ? 'bg-red-50 text-red-600 font-bold' : 'bg-blue-50 text-blue-600 font-bold' },
                                        ]}
                                        timestamp={item.timestamp}
                                        openLabel={t('saved.openCurriculum')}
                                        onOpen={() => onLoadCurriculum(item)}
                                        onDelete={() => onDeleteCurriculum(item.id)}
                                        onExport={() => {
                                            const blob = new Blob([JSON.stringify({ curriculum: item.curriculum, params: item.params }, null, 2)], { type: 'application/json' });
                                            downloadBlob(blob, `${item.name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim()} - Curriculum.json`);
                                        }}
                                        onRename={(newName) => onRenameCurriculum(item.id, newName)}
                                        accentColor="emerald"
                                        topLeftSlot={
                                            <input
                                                type="checkbox"
                                                checked={selectedCurriculaIds.has(item.id)}
                                                onChange={() => toggleCurriculumSelect(item.id)}
                                                onClick={(e) => e.stopPropagation()}
                                                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                            />
                                        }
                                    />
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ===== LESSON KITS TAB ===== */}
            {activeTab === 'kits' && (
                <div className="space-y-6">
                    <FilterBar
                        search={kSearch}
                        onSearchChange={setKSearch}
                        searchPlaceholder={t('saved.searchKits')}
                        filters={
                            <>
                                {uniqueKitCities.length > 0 && (
                                    <FilterSelect value={kCity} onChange={setKCity} icon={MapPin}>
                                        <option value="all">{t('saved.allCities')}</option>
                                        {uniqueKitCities.map(city => <option key={city} value={city}>{city}</option>)}
                                    </FilterSelect>
                                )}
                                <FilterSelect value={kLevel} onChange={setKLevel} icon={Filter}>
                                    <option>{t('saved.allLevels')}</option>
                                    <option>{t('saved.beginner')}</option>
                                    <option>{t('saved.intermediate')}</option>
                                    <option>{t('saved.advanced')}</option>
                                </FilterSelect>
                                {uniqueActivities.length > 0 && (
                                    <FilterSelect value={kActivity} onChange={setKActivity} icon={Compass}>
                                        <option value="all">{t('saved.allActivities')}</option>
                                        {uniqueActivities.map(act => <option key={act} value={act}>{act}</option>)}
                                    </FilterSelect>
                                )}
                                <FilterSelect value={kSort} onChange={setKSort} icon={ArrowUpDown}>
                                    <option>{t('saved.newestFirst')}</option>
                                    <option>{t('saved.oldestFirst')}</option>
                                </FilterSelect>
                                <FilterSelect value={kLang} onChange={(v) => setKLang(v as 'all' | 'en' | 'zh')} icon={Languages}>
                                    <option value="all">{t('saved.allLangs')}</option>
                                    <option value="en">{t('saved.english')}</option>
                                    <option value="zh">{t('saved.chinese')}</option>
                                </FilterSelect>
                                <FilterSelect value={kMode} onChange={(v) => setKMode(v as 'all' | 'school' | 'family')} icon={Users}>
                                    <option value="all">{t('saved.allModes')}</option>
                                    <option value="school">{t('saved.modeSchool')}</option>
                                    <option value="family">{t('saved.modeFamily')}</option>
                                </FilterSelect>
                                <FilterSelect value={kQuality} onChange={(v) => setKQuality(v as 'all' | 'ok' | 'needs_review')} icon={ShieldAlert}>
                                    <option value="all">All Quality</option>
                                    <option value="needs_review">Needs Review</option>
                                    <option value="ok">Ready</option>
                                </FilterSelect>
                            </>
                        }
                    />

                    {filteredPlans.length === 0 ? (
                        <EmptyState
                            icon={BookOpen}
                            iconSize={48}
                            iconClassName="text-slate-300 w-12 h-12 bg-transparent dark:bg-transparent"
                            title={t('saved.noKits')}
                            description={savedPlans.length > 0 ? t('saved.adjustFilters') : t('saved.generateKitFirst')}
                        />
                    ) : (
                        <>
                            {/* Batch action bar */}
                            <div className="flex items-center gap-3 mb-3">
                                <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600 dark:text-slate-400 select-none" onClick={(e) => e.stopPropagation()}>
                                    <input
                                        type="checkbox"
                                        checked={selectedPlanIds.size === filteredPlans.length && filteredPlans.length > 0}
                                        onChange={selectAllPlans}
                                        className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                    />
                                    {t('saved.selectAll') || 'Select All'}
                                </label>
                                {selectedPlanIds.size > 0 && (
                                    <button
                                        onClick={handleBatchDeletePlans}
                                        className="px-3 py-1 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-full transition-colors"
                                    >
                                        {t('saved.deleteSelected') || `Delete Selected (${selectedPlanIds.size})`}
                                    </button>
                                )}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredPlans.map(item => (
                                    <RecordCard
                                        key={item.id}
                                        title={item.name}
                                        tags={[
                                            { icon: <GraduationCap size={11} />, label: getLevelLabel(item.plan.basicInfo?.targetAudience || '') },
                                            ...(item.plan.basicInfo?.location ? [{ icon: <MapPin size={11} />, label: item.plan.basicInfo.location }] : []),
                                            ...(item.plan.basicInfo?.activityType ? [{ icon: <Compass size={11} />, label: item.plan.basicInfo.activityType }] : []),
                                            ...(planQualityMap.get(item.id)?.status === 'needs_review'
                                                ? [{ icon: <ShieldAlert size={11} />, label: 'Needs Review', className: 'bg-amber-50 text-amber-700 font-bold' }]
                                                : [{ icon: <ShieldCheck size={11} />, label: 'Ready', className: 'bg-emerald-50 text-emerald-700 font-bold' }]),
                                            { icon: <BookOpen size={11} />, label: `${item.plan.roadmap?.length || 0} ${item.language === 'zh' ? '个活动' : 'activities'}`, accent: true },
                                            { icon: <Languages size={11} />, label: item.language === 'zh' ? '中文' : 'EN', className: item.language === 'zh' ? 'bg-red-50 text-red-600 font-bold' : 'bg-blue-50 text-blue-600 font-bold' },
                                            { icon: item.mode === 'family' ? <Heart size={11} /> : <School size={11} />, label: item.mode === 'family' ? (item.language === 'zh' ? '亲子' : 'Family') : (item.language === 'zh' ? '学校' : 'School'), className: item.mode === 'family' ? 'bg-pink-50 text-pink-600 font-bold' : 'bg-slate-50 text-slate-600 font-bold' },
                                        ]}
                                        timestamp={item.timestamp}
                                        openLabel={t('saved.openKit')}
                                        onOpen={() => onLoad(item)}
                                        onDelete={() => onDelete(item.id)}
                                        onExport={() => {
                                            const blob = new Blob([JSON.stringify(item.plan, null, 2)], { type: 'application/json' });
                                            downloadBlob(blob, `${item.name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim()} - LessonKit.json`);
                                        }}
                                        onRename={(newName) => onRename(item.id, newName)}
                                        accentColor="emerald"
                                        topLeftSlot={
                                            <input
                                                type="checkbox"
                                                checked={selectedPlanIds.has(item.id)}
                                                onChange={() => togglePlanSelect(item.id)}
                                                onClick={(e) => e.stopPropagation()}
                                                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                            />
                                        }
                                    />
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}

            <Modal isOpen={showRecycleBin} onClose={() => setShowRecycleBin(false)} maxWidth="max-w-3xl">
                <div className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Recycle Bin (30 days)</h3>
                            <p className="text-sm text-slate-500">Restore deleted records or permanently delete with double confirmation.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => { void loadRecycleBin(); }}
                            disabled={isRecycleLoading}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                            {isRecycleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                            Refresh
                        </button>
                    </div>

                    {isRecycleLoading ? (
                        <div className="py-10 flex items-center justify-center text-slate-500">
                            <Loader2 className="w-5 h-5 animate-spin mr-2" />
                            Loading...
                        </div>
                    ) : (deletedCurricula.length + deletedPlans.length) === 0 ? (
                        <div className="py-12 text-center text-slate-500">Recycle bin is empty.</div>
                    ) : (
                        <div className="space-y-4 max-h-[70vh] overflow-auto pr-1">
                            <section className="space-y-2">
                                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                    Curricula ({deletedCurricula.length})
                                </h4>
                                {deletedCurricula.map((item) => {
                                    const meta = getDeletedMeta(item as DeletedMetaLike);
                                    const actionKey = `curriculum:${item.id}`;
                                    return (
                                        <div key={`recycle-cur-${item.id}`} className="rounded-xl border border-slate-200 bg-white p-3 flex items-center justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="font-medium text-slate-800 truncate">{item.name}</div>
                                                <div className="text-xs text-slate-500">
                                                    Deleted: {new Date(meta.deletedAt).toLocaleString()}
                                                    {meta.purgeAt ? ` · Purge: ${new Date(meta.purgeAt).toLocaleString()}` : ''}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <button
                                                    type="button"
                                                    disabled={recycleActionKey === actionKey}
                                                    onClick={() => { void restoreDeleted('curriculum', item.id, item.name || 'Untitled Curriculum'); }}
                                                    className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                                                >
                                                    Restore
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={recycleActionKey === actionKey}
                                                    onClick={() => { void purgeDeleted('curriculum', item.id, item.name || 'Untitled Curriculum'); }}
                                                    className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                                                >
                                                    Delete Forever
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </section>

                            <section className="space-y-2">
                                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                    Lesson Kits ({deletedPlans.length})
                                </h4>
                                {deletedPlans.map((item) => {
                                    const meta = getDeletedMeta(item as DeletedMetaLike);
                                    const actionKey = `plan:${item.id}`;
                                    return (
                                        <div key={`recycle-plan-${item.id}`} className="rounded-xl border border-slate-200 bg-white p-3 flex items-center justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="font-medium text-slate-800 truncate">{item.name}</div>
                                                <div className="text-xs text-slate-500">
                                                    Deleted: {new Date(meta.deletedAt).toLocaleString()}
                                                    {meta.purgeAt ? ` · Purge: ${new Date(meta.purgeAt).toLocaleString()}` : ''}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <button
                                                    type="button"
                                                    disabled={recycleActionKey === actionKey}
                                                    onClick={() => { void restoreDeleted('plan', item.id, item.name || 'Untitled Plan'); }}
                                                    className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                                                >
                                                    Restore
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={recycleActionKey === actionKey}
                                                    onClick={() => { void purgeDeleted('plan', item.id, item.name || 'Untitled Plan'); }}
                                                    className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                                                >
                                                    Delete Forever
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </section>
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
};
