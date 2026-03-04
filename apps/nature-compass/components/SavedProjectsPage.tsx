import React, { useState, useMemo } from 'react';
import { RecordCard } from '@shared/components/RecordCard';
import { EmptyState } from '@shared/components/EmptyState';
import { FilterBar, FilterSelect } from '@shared/components/FilterBar';
import { RecordsTabSwitcher } from '@shared/components/RecordsTabSwitcher';
import { SavedLessonPlan, SavedCurriculum } from '../types';
import {
    Filter, ArrowUpDown, BookOpen, Languages,
    MapPin, Users, GraduationCap, FileText, Compass
} from 'lucide-react';
import { AGE_RANGES } from '../constants';
import { useLanguage } from '../i18n/LanguageContext';

interface SavedProjectsPageProps {
    savedPlans: SavedLessonPlan[];
    savedCurricula: SavedCurriculum[];
    onLoad: (plan: SavedLessonPlan) => void;
    onDelete: (id: string) => void;
    onRename: (id: string, newName: string) => void;
    onDeleteCurriculum: (id: string) => void;
    onRenameCurriculum: (id: string, newName: string) => void;
    onLoadCurriculum: (saved: SavedCurriculum) => void;
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

export const SavedProjectsPage: React.FC<SavedProjectsPageProps> = ({
    savedPlans, savedCurricula, onLoad, onDelete, onRename,
    onDeleteCurriculum, onRenameCurriculum, onLoadCurriculum,
}) => {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<'curricula' | 'kits'>('curricula');

    // --- Curricula filter state ---
    const [cSearch, setCSearch] = useState('');
    const [cCity, setCCity] = useState('all');
    const [cAge, setCAge] = useState('all');
    const [cLevel, setCLevel] = useState('all');
    const [cCount, setCCount] = useState('all');
    const [cSort, setCSort] = useState('newest');
    const [cLang, setCLang] = useState<'all' | 'en' | 'zh'>('all');

    // --- Lesson Kit filter state ---
    const [kSearch, setKSearch] = useState('');
    const [kLevel, setKLevel] = useState('All Levels');
    const [kActivity, setKActivity] = useState('all');
    const [kSort, setKSort] = useState('Newest First');
    const [kLang, setKLang] = useState<'all' | 'en' | 'zh'>('all');

    // === Dynamic options ===
    const uniqueCities = useMemo(() =>
        Array.from(new Set(savedCurricula.map(c => c.params.city))).sort(),
        [savedCurricula]
    );
    const uniqueActivities = useMemo(() =>
        Array.from(new Set(savedPlans.map(p => p.plan.basicInfo?.activityType).filter(Boolean))).sort(),
        [savedPlans]
    );

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
                return true;
            })
            .sort((a, b) => {
                if (cSort === 'newest') return b.timestamp - a.timestamp;
                if (cSort === 'oldest') return a.timestamp - b.timestamp;
                if (cSort === 'lessons-asc') return a.curriculum.lessons.length - b.curriculum.lessons.length;
                if (cSort === 'lessons-desc') return b.curriculum.lessons.length - a.curriculum.lessons.length;
                return 0;
            });
    }, [savedCurricula, cSearch, cCity, cAge, cLevel, cCount, cSort, cLang]);

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
                if (kLevel !== 'All Levels') {
                    const audience = (p.plan.basicInfo?.targetAudience || '').toLowerCase();
                    if (kLevel === 'Beginner' && !/(beginner|a1|a2)/.test(audience)) return false;
                    if (kLevel === 'Intermediate' && !/(intermediate|b1|b2)/.test(audience)) return false;
                    if (kLevel === 'Advanced' && !/(advanced|c1|c2)/.test(audience)) return false;
                }
                if (kActivity !== 'all' && p.plan.basicInfo?.activityType !== kActivity) return false;
                if (kLang !== 'all' && (p.language || 'en') !== kLang) return false;
                return true;
            })
            .sort((a, b) => kSort === 'Newest First' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp);
    }, [savedPlans, kSearch, kLevel, kActivity, kSort, kLang]);

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
                    { key: 'curricula', label: t('nav.curriculum' as any) || 'Curricula', icon: <FileText size={16} />, count: savedCurricula.length },
                    { key: 'kits', label: t('nav.lessonKit' as any) || 'Lesson Kits', icon: <BookOpen size={16} />, count: savedPlans.length },
                ]}
                activeTab={activeTab}
                onTabChange={(key) => setActiveTab(key as 'curricula' | 'kits')}
                accentColor="emerald"
            />

            {/* ===== CURRICULA TAB ===== */}
            {activeTab === 'curricula' && (
                <div className="space-y-6">
                    <FilterBar
                        search={cSearch}
                        onSearchChange={setCSearch}
                        searchPlaceholder="Search by theme, lesson title, overview..."
                        filters={
                            <>
                                <FilterSelect value={cCity} onChange={setCCity} icon={MapPin}>
                                    <option value="all">All Cities</option>
                                    {uniqueCities.map(city => <option key={city} value={city}>{city}</option>)}
                                </FilterSelect>
                                <FilterSelect value={cAge} onChange={setCAge} icon={Users}>
                                    <option value="all">All Ages</option>
                                    {AGE_RANGES.map(age => {
                                        const short = age.split(' ')[0];
                                        return <option key={age} value={short}>{t(`age.${age} ` as any)}</option>;
                                    })}
                                </FilterSelect>
                                <FilterSelect value={cLevel} onChange={setCLevel} icon={GraduationCap}>
                                    <option value="all">All Levels</option>
                                    {ENGLISH_LEVELS.map(lv => <option key={lv} value={lv}>{t(`level.${lv} ` as any)}</option>)}
                                </FilterSelect>
                                <FilterSelect value={cCount} onChange={setCCount} icon={BookOpen}>
                                    <option value="all">Any Lesson Count</option>
                                    {LESSON_COUNT_RANGES.map(r => <option key={r.label} value={r.label}>{r.label}</option>)}
                                </FilterSelect>
                                <FilterSelect value={cSort} onChange={setCSort} icon={ArrowUpDown}>
                                    <option value="newest">Newest First</option>
                                    <option value="oldest">Oldest First</option>
                                    <option value="lessons-desc">Lessons ↓</option>
                                    <option value="lessons-asc">Lessons ↑</option>
                                </FilterSelect>
                                <FilterSelect value={cLang} onChange={(v) => setCLang(v as any)} icon={Languages}>
                                    <option value="all">All Languages</option>
                                    <option value="en">🇬🇧 English</option>
                                    <option value="zh">🇨🇳 中文</option>
                                </FilterSelect>
                            </>
                        }
                    />

                    {filteredCurricula.length === 0 ? (
                        <EmptyState
                            icon={FileText}
                            title="No curricula found"
                            description={savedCurricula.length > 0 ? 'Try adjusting your filters.' : 'Generate and save a curriculum to see it here.'}
                        />
                    ) : (
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
                                        { icon: <BookOpen size={11} />, label: `${item.curriculum.lessons.length} lessons`, accent: true },
                                        { icon: null, label: item.language === 'zh' ? '🇨🇳 中文' : '🇬🇧 EN', className: item.language === 'zh' ? 'bg-red-50 text-red-600 font-bold' : 'bg-blue-50 text-blue-600 font-bold' },
                                    ]}
                                    timestamp={item.timestamp}
                                    openLabel="Open Curriculum"
                                    onOpen={() => onLoadCurriculum(item)}
                                    onDelete={() => onDeleteCurriculum(item.id)}
                                    onExport={() => {
                                        const blob = new Blob([JSON.stringify({ curriculum: item.curriculum, params: item.params }, null, 2)], { type: 'application/json' });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `${item.name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim()} - Curriculum.json`;
                                        a.click();
                                    }}
                                    onRename={(newName) => onRenameCurriculum(item.id, newName)}
                                    accentColor="emerald"
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ===== LESSON KITS TAB ===== */}
            {activeTab === 'kits' && (
                <div className="space-y-6">
                    <FilterBar
                        search={kSearch}
                        onSearchChange={setKSearch}
                        searchPlaceholder="Search by topic or title..."
                        filters={
                            <>
                                <FilterSelect value={kLevel} onChange={setKLevel} icon={Filter}>
                                    <option>All Levels</option>
                                    <option>Beginner</option>
                                    <option>Intermediate</option>
                                    <option>Advanced</option>
                                </FilterSelect>
                                {uniqueActivities.length > 0 && (
                                    <FilterSelect value={kActivity} onChange={setKActivity} icon={Compass}>
                                        <option value="all">All Activities</option>
                                        {uniqueActivities.map(act => <option key={act} value={act}>{act}</option>)}
                                    </FilterSelect>
                                )}
                                <FilterSelect value={kSort} onChange={setKSort} icon={ArrowUpDown}>
                                    <option>Newest First</option>
                                    <option>Oldest First</option>
                                </FilterSelect>
                                <FilterSelect value={kLang} onChange={(v) => setKLang(v as any)} icon={Languages}>
                                    <option value="all">All Languages</option>
                                    <option value="en">🇬🇧 English</option>
                                    <option value="zh">🇨🇳 中文</option>
                                </FilterSelect>
                            </>
                        }
                    />

                    {filteredPlans.length === 0 ? (
                        <EmptyState
                            icon={BookOpen}
                            iconSize={48}
                            iconClassName="text-slate-300 w-12 h-12 bg-transparent dark:bg-transparent"
                            title="No lesson kits found"
                            description={savedPlans.length > 0 ? 'Try adjusting your filters.' : 'Generate and save a lesson kit to see it here.'}
                        />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredPlans.map(item => (
                                <RecordCard
                                    key={item.id}
                                    title={item.name}
                                    description={item.plan.missionBriefing?.title || item.plan.basicInfo?.theme || ''}
                                    tags={[
                                        { icon: <GraduationCap size={11} />, label: getLevelLabel(item.plan.basicInfo?.targetAudience || '') },
                                        ...(item.plan.basicInfo?.activityType ? [{ icon: <Compass size={11} />, label: item.plan.basicInfo.activityType }] : []),
                                        { icon: <BookOpen size={11} />, label: `${item.plan.roadmap?.length || 0} activities`, accent: true },
                                        { icon: null, label: item.language === 'zh' ? '🇨🇳 中文' : '🇬🇧 EN', className: item.language === 'zh' ? 'bg-red-50 text-red-600 font-bold' : 'bg-blue-50 text-blue-600 font-bold' },
                                    ]}
                                    timestamp={item.timestamp}
                                    openLabel="Open Kit"
                                    onOpen={() => onLoad(item)}
                                    onDelete={() => onDelete(item.id)}
                                    onExport={() => {
                                        const blob = new Blob([JSON.stringify(item.plan, null, 2)], { type: 'application/json' });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `${item.name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim()} - LessonKit.json`;
                                        a.click();
                                    }}
                                    onRename={(newName) => onRename(item.id, newName)}
                                    accentColor="emerald"
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};