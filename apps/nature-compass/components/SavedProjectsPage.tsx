import React, { useState, useMemo } from 'react';
import { RecordCard } from '@shared/components/RecordCard';
import { SavedLessonPlan, SavedCurriculum } from '../types';
import {
    Search, Filter, ArrowUpDown, Calendar, BookOpen, Clock,
    Trash2, Edit2, Download, ArrowRight, Check, X, Languages,
    Microscope, Palette, Calculator, Utensils, Hammer, Globe,
    Coins, Music, Compass, Theater, FileText, MapPin, Users, GraduationCap
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
    // --- Tab state ---
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

    // --- Renaming ---
    const [editingId, setEditingId] = useState<string | null>(null);
    const [tempName, setTempName] = useState('');

    // Language toggle per card
    const [cardLanguages, setCardLanguages] = useState<Record<string, 'en' | 'zh'>>({});
    const toggleLanguage = (id: string) => {
        setCardLanguages(prev => ({ ...prev, [id]: prev[id] === 'zh' ? 'en' : 'zh' }));
    };

    const startEditing = (id: string, currentName: string) => {
        setEditingId(id);
        setTempName(currentName);
    };
    const cancelEditing = () => { setEditingId(null); setTempName(''); };

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
                // Search: name, theme, overview, lesson titles
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
    const getLevelBadge = (audience: string) => {
        const lower = (audience || '').toLowerCase();
        if (/(beginner|a1|a2)/.test(lower)) return <span className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700">Beginner</span>;
        if (/(intermediate|b1|b2)/.test(lower)) return <span className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700">Intermediate</span>;
        if (/(advanced|c1|c2)/.test(lower)) return <span className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700">Advanced</span>;
        return <span className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600">General</span>;
    };

    const getCategoryIcon = (type: string) => {
        const t = (type || '').toLowerCase();
        if (t.includes('science') || t.includes('bio')) return Microscope;
        if (t.includes('art') || t.includes('paint')) return Palette;
        if (t.includes('math') || t.includes('data')) return Calculator;
        if (t.includes('cook') || t.includes('food')) return Utensils;
        if (t.includes('theater') || t.includes('drama')) return Theater;
        if (t.includes('engineer') || t.includes('build')) return Hammer;
        if (t.includes('music') || t.includes('song')) return Music;
        if (t.includes('social') || t.includes('history')) return Globe;
        if (t.includes('econom')) return Coins;
        return Compass;
    };

    const getStats = (plan: any) => ({
        visuals: plan.visualReferences?.length || 0,
        activities: plan.roadmap?.length || 0,
    });

    // --- Editable title component ---
    const EditableTitle = ({ id, name, onSaveEdit, translated }: {
        id: string; name: string; onSaveEdit: (id: string, newName: string) => void; translated?: string;
    }) => {
        if (editingId === id) {
            return (
                <div className="flex items-center gap-2 mb-3">
                    <input
                        autoFocus
                        className="text-base font-bold text-slate-800 border-b-2 border-emerald-500 outline-none bg-transparent w-full"
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') { onSaveEdit(id, tempName.trim()); setEditingId(null); }
                            if (e.key === 'Escape') cancelEditing();
                        }}
                        onClick={(e) => e.stopPropagation()}
                    />
                    <button onClick={(e) => { e.stopPropagation(); onSaveEdit(id, tempName.trim()); setEditingId(null); }} className="text-emerald-600 hover:bg-emerald-50 p-1 rounded"><Check size={18} /></button>
                    <button onClick={(e) => { e.stopPropagation(); cancelEditing(); }} className="text-slate-400 hover:bg-slate-100 p-1 rounded"><X size={18} /></button>
                </div>
            );
        }
        return (
            <h3
                className="text-base font-bold text-slate-800 mb-2 line-clamp-2 leading-tight group-hover:text-emerald-800 transition-colors cursor-pointer"
                onClick={(e) => { e.stopPropagation(); startEditing(id, name); }}
                title="Click to rename"
            >
                {cardLanguages[id] === 'zh' && translated ? translated : name}
            </h3>
        );
    };

    // --- Select wrapper ---
    const FilterSelect = ({ value, onChange, children, icon: Icon }: {
        value: string; onChange: (v: string) => void; children: React.ReactNode; icon?: React.ElementType;
    }) => (
        <div className="relative">
            <select
                className="appearance-none bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-white/5 rounded-lg pl-4 pr-10 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 focus:border-emerald-500 outline-none cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 min-w-[140px]"
                value={value}
                onChange={(e) => onChange(e.target.value)}
            >
                {children}
            </select>
            {Icon && <Icon className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />}
        </div>
    );

    const totalCount = savedCurricula.length + savedPlans.length;

    return (
        <div className="animate-fade-in space-y-8">

            {/* Tab Switcher */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-6 w-fit">
                <button
                    onClick={() => setActiveTab('curricula')}
                    className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'curricula'
                        ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    <FileText size={16} />
                    Curricula
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">{savedCurricula.length}</span>
                </button>
                <button
                    onClick={() => setActiveTab('kits')}
                    className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'kits'
                        ? 'bg-white text-emerald-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    <BookOpen size={16} />
                    Lesson Kits
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">{savedPlans.length}</span>
                </button>
            </div>

            {/* ===== CURRICULA TAB ===== */}
            {activeTab === 'curricula' && (
                <>
                    {/* Filters */}
                    <div className="mb-8">
                        <div className="flex flex-col gap-4">
                            {/* Row 1: Search */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Search by theme, lesson title, overview..."
                                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm transition-all focus:bg-white"
                                    value={cSearch}
                                    onChange={(e) => setCSearch(e.target.value)}
                                />
                            </div>
                            {/* Row 2: Filters */}
                            <div className="flex flex-wrap gap-3">
                                <FilterSelect value={cCity} onChange={setCCity} icon={MapPin}>
                                    <option value="all">All Cities</option>
                                    {uniqueCities.map(city => <option key={city} value={city}>{city}</option>)}
                                </FilterSelect>
                                <FilterSelect value={cAge} onChange={setCAge} icon={Users}>
                                    <option value="all">All Ages</option>
                                    {AGE_RANGES.map(age => {
                                        const short = age.split(' ')[0]; // "6-9"
                                        return <option key={age} value={short}>{t(`age.${age}` as any)}</option>;
                                    })}
                                </FilterSelect>
                                <FilterSelect value={cLevel} onChange={setCLevel} icon={GraduationCap}>
                                    <option value="all">All Levels</option>
                                    {ENGLISH_LEVELS.map(lv => <option key={lv} value={lv}>{t(`level.${lv}` as any)}</option>)}
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
                            </div>
                        </div>
                    </div>

                    {/* Curriculum Grid */}
                    {filteredCurricula.length === 0 ? (
                        <div className="text-center py-20 bg-white dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-300 dark:border-white/5">
                            <div className="mx-auto w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-400">
                                <FileText size={32} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-700">No curricula found</h3>
                            <p className="text-slate-500">
                                {savedCurricula.length > 0 ? 'Try adjusting your filters.' : 'Generate and save a curriculum to see it here.'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                </>
            )}

            {/* ===== LESSON KITS TAB ===== */}
            {activeTab === 'kits' && (
                <>
                    {/* Filters */}
                    <div className="mb-8">
                        <div className="flex flex-col gap-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Search by topic or title..."
                                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm transition-all focus:bg-white"
                                    value={kSearch}
                                    onChange={(e) => setKSearch(e.target.value)}
                                />
                            </div>
                            <div className="flex flex-wrap gap-3">
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
                            </div>
                        </div>
                    </div>

                    {/* Grid */}
                    {filteredPlans.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
                            <div className="mx-auto w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-400">
                                <BookOpen size={32} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-700">No lesson kits found</h3>
                            <p className="text-slate-500">
                                {savedPlans.length > 0 ? 'Try adjusting your filters.' : 'Generate and save a lesson kit to see it here.'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {filteredPlans.map(item => {
                                const stats = getStats(item.plan);
                                const CategoryIcon = getCategoryIcon(item.plan.basicInfo?.activityType || '');

                                return (
                                    <div
                                        key={item.id}
                                        className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-lg hover:border-emerald-100 transition-all group flex flex-col overflow-hidden"
                                    >
                                        <div className="p-4 flex-1 flex gap-4">
                                            <div className="flex-1">
                                                <div className="flex justify-between items-start mb-3">
                                                    {getLevelBadge(item.plan.basicInfo?.targetAudience || '')}
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const blob = new Blob([JSON.stringify(item.plan, null, 2)], { type: 'application/json' });
                                                                const url = URL.createObjectURL(blob);
                                                                const a = document.createElement('a');
                                                                a.href = url;
                                                                a.download = `${item.name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim()} - Data.json`;
                                                                a.click();
                                                            }}
                                                            className="text-slate-300 hover:text-emerald-600 transition-colors"
                                                            title="Download JSON"
                                                        >
                                                            <Download size={18} />
                                                        </button>
                                                        {item.plan?.translatedPlan && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); toggleLanguage(item.id); }}
                                                                className={`ml-1 px-2 py-1 rounded transition-colors text-xs font-bold flex items-center gap-1 border ${cardLanguages[item.id] === 'zh'
                                                                    ? 'bg-blue-50 text-blue-600 border-blue-200'
                                                                    : 'bg-white text-slate-400 border-slate-200 hover:text-blue-500 hover:border-blue-300'
                                                                    }`}
                                                                title="Toggle Language (EN / 中)"
                                                            >
                                                                <Languages size={14} />
                                                                {cardLanguages[item.id] === 'zh' ? '中' : 'EN'}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                <EditableTitle
                                                    id={item.id}
                                                    name={item.name}
                                                    onSaveEdit={onRename}
                                                    translated={item.plan?.translatedPlan?.basicInfo?.theme}
                                                />

                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2 text-sm text-slate-500">
                                                        <Clock size={16} className="text-slate-400" />
                                                        <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-sm text-slate-500">
                                                        <BookOpen size={16} className="text-slate-400" />
                                                        <span>{stats.visuals} Visuals, {stats.activities} Activities</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="w-24 flex items-center justify-center opacity-80">
                                                {item.coverImage ? (
                                                    <img src={item.coverImage} className="w-16 h-16 object-cover rounded-2xl group-hover:scale-105 transition-all duration-300 shadow-sm" alt="Cover" />
                                                ) : (
                                                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-emerald-600/20 group-hover:text-emerald-600/40 group-hover:bg-emerald-50 transition-all border border-slate-100 group-hover:scale-105 duration-300">
                                                        <CategoryIcon size={32} strokeWidth={1.5} />
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                                            <button
                                                onClick={() => onLoad(item)}
                                                className="text-sm font-bold text-emerald-600 hover:text-emerald-800 flex items-center gap-1.5 transition-all"
                                            >
                                                Open Kit
                                                <ArrowRight size={16} />
                                            </button>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); startEditing(item.id, item.name); }}
                                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                    title="Rename"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};