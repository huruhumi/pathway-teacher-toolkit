import React, { useState, useMemo } from 'react';
import { SavedLessonPlan } from '../types';
import { Search, Filter, ArrowUpDown, Calendar, BookOpen, Clock, Trash2, Edit2, Download, ArrowRight, Check, X, Microscope, Palette, Calculator, Utensils, Hammer, Globe, Coins, Music, Compass, Theater, Languages } from 'lucide-react';

interface SavedProjectsPageProps {
    savedPlans: SavedLessonPlan[];
    onLoad: (plan: SavedLessonPlan) => void;
    onDelete: (id: string) => void;
    onRename: (id: string, newName: string) => void;
}

export const SavedProjectsPage: React.FC<SavedProjectsPageProps> = ({ savedPlans, onLoad, onDelete, onRename }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterLevel, setFilterLevel] = useState('All Levels');
    const [sortOrder, setSortOrder] = useState('Newest First');

    // Renaming state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [tempName, setTempName] = useState('');

    // Translation State per Card
    const [cardLanguages, setCardLanguages] = useState<Record<string, 'en' | 'zh'>>({});

    const toggleLanguage = (id: string) => {
        setCardLanguages(prev => ({
            ...prev,
            [id]: prev[id] === 'zh' ? 'en' : 'zh'
        }));
    };

    const filteredPlans = useMemo(() => {
        return savedPlans
            .filter(p =>
                p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.plan.basicInfo.theme.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .filter(p => {
                if (filterLevel === 'All Levels') return true;
                const audience = p.plan.basicInfo.targetAudience.toLowerCase();
                if (filterLevel === 'Beginner') return audience.includes('beginner') || audience.includes('a1') || audience.includes('a2');
                if (filterLevel === 'Intermediate') return audience.includes('intermediate') || audience.includes('b1') || audience.includes('b2');
                if (filterLevel === 'Advanced') return audience.includes('advanced') || audience.includes('c1');
                return true;
            })
            .sort((a, b) => {
                if (sortOrder === 'Newest First') return b.timestamp - a.timestamp;
                return a.timestamp - b.timestamp;
            });
    }, [savedPlans, searchTerm, filterLevel, sortOrder]);

    const getLevelBadge = (audience: string) => {
        const lower = audience.toLowerCase();
        if (lower.includes('beginner') || lower.includes('a1') || lower.includes('a2')) {
            return <span className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700">Beginner</span>;
        }
        if (lower.includes('intermediate') || lower.includes('b1') || lower.includes('b2')) {
            return <span className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700">Intermediate</span>;
        }
        if (lower.includes('advanced') || lower.includes('c1') || lower.includes('c2')) {
            return <span className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700">Advanced</span>;
        }
        return <span className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600">General</span>;
    };

    const getCategoryIcon = (type: string) => {
        const t = type.toLowerCase();
        if (t.includes('science') || t.includes('bio')) return Microscope;
        if (t.includes('art') || t.includes('paint') || t.includes('draw')) return Palette;
        if (t.includes('math') || t.includes('data')) return Calculator;
        if (t.includes('cook') || t.includes('bak') || t.includes('food')) return Utensils;
        if (t.includes('theater') || t.includes('drama') || t.includes('act')) return Theater;
        if (t.includes('engineer') || t.includes('build') || t.includes('tech')) return Hammer;
        if (t.includes('music') || t.includes('song')) return Music;
        if (t.includes('social') || t.includes('history')) return Globe;
        if (t.includes('econom')) return Coins;
        return Compass;
    };

    const getStats = (plan: any) => {
        const visuals = plan.visualReferences?.length || 0;
        const activities = plan.roadmap?.length || 0;
        return { visuals, activities };
    };

    const startEditing = (id: string, currentName: string) => {
        setEditingId(id);
        setTempName(currentName);
    };

    const saveEditing = (id: string) => {
        if (tempName.trim()) {
            onRename(id, tempName.trim());
        }
        setEditingId(null);
    };

    const cancelEditing = () => {
        setEditingId(null);
        setTempName('');
    };

    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Saved Lesson Kits</h1>
                    <p className="text-slate-500">Access and manage your previously generated teaching materials.</p>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-400 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm">
                    <Calendar size={16} />
                    <span>{savedPlans.length} total records</span>
                </div>
            </div>

            {/* Controls */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-8 flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search by topic..."
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm transition-all focus:bg-white"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-3">
                    <div className="relative">
                        <select
                            className="appearance-none bg-white border border-slate-200 rounded-lg pl-4 pr-10 py-2 text-sm font-medium text-slate-600 focus:border-emerald-500 outline-none cursor-pointer hover:bg-slate-50 min-w-[140px]"
                            value={filterLevel}
                            onChange={(e) => setFilterLevel(e.target.value)}
                        >
                            <option>All Levels</option>
                            <option>Beginner</option>
                            <option>Intermediate</option>
                            <option>Advanced</option>
                        </select>
                        <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                    </div>
                    <div className="relative">
                        <select
                            className="appearance-none bg-white border border-slate-200 rounded-lg pl-4 pr-10 py-2 text-sm font-medium text-slate-600 focus:border-emerald-500 outline-none cursor-pointer hover:bg-slate-50 min-w-[140px]"
                            value={sortOrder}
                            onChange={(e) => setSortOrder(e.target.value)}
                        >
                            <option>Newest First</option>
                            <option>Oldest First</option>
                        </select>
                        <ArrowUpDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                    </div>
                </div>
            </div>

            {/* Grid */}
            {filteredPlans.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
                    <div className="mx-auto w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-400">
                        <BookOpen size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-700">No projects found</h3>
                    <p className="text-slate-500">Try adjusting your search or filters.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {filteredPlans.map(item => {
                        const stats = getStats(item.plan);
                        const CategoryIcon = getCategoryIcon(item.plan.basicInfo.activityType);

                        return (
                            <div
                                key={item.id}
                                className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-lg hover:border-emerald-100 transition-all group flex flex-col overflow-hidden"
                            >
                                <div className="p-6 flex-1 flex gap-4">
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start mb-3">
                                            {getLevelBadge(item.plan.basicInfo.targetAudience)}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const blob = new Blob([JSON.stringify(item.plan, null, 2)], { type: 'application/json' });
                                                    const url = URL.createObjectURL(blob);
                                                    const a = document.createElement('a');
                                                    a.href = url;
                                                    const safeName = item.name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim();
                                                    a.download = `${safeName} - Data.json`;
                                                    a.click();
                                                }}
                                                className="text-slate-300 hover:text-emerald-600 transition-colors"
                                                title="Download JSON"
                                            >
                                                <Download size={18} />
                                            </button>

                                            {item.plan?.translatedPlan && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleLanguage(item.id);
                                                    }}
                                                    className={`ml-2 px-2 py-1 rounded transition-colors text-xs font-bold flex items-center gap-1 border ${cardLanguages[item.id] === 'zh'
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

                                        {/* Editable Title */}
                                        {editingId === item.id ? (
                                            <div className="flex items-center gap-2 mb-3">
                                                <input
                                                    autoFocus
                                                    className="text-xl font-bold text-slate-800 border-b-2 border-emerald-500 outline-none bg-transparent w-full"
                                                    value={tempName}
                                                    onChange={(e) => setTempName(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') saveEditing(item.id);
                                                        if (e.key === 'Escape') cancelEditing();
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                                <button onClick={(e) => { e.stopPropagation(); saveEditing(item.id); }} className="text-emerald-600 hover:bg-emerald-50 p-1 rounded"><Check size={18} /></button>
                                                <button onClick={(e) => { e.stopPropagation(); cancelEditing(); }} className="text-slate-400 hover:bg-slate-100 p-1 rounded"><X size={18} /></button>
                                            </div>
                                        ) : (
                                            <h3
                                                className="text-xl font-bold text-slate-800 mb-3 line-clamp-2 leading-tight group-hover:text-emerald-800 transition-colors cursor-pointer"
                                                title={cardLanguages[item.id] === 'zh' ? 'Translate to rename' : 'Click to rename'}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (cardLanguages[item.id] !== 'zh') {
                                                        startEditing(item.id, item.name);
                                                    }
                                                }}
                                            >
                                                {cardLanguages[item.id] === 'zh'
                                                    ? (item.plan?.translatedPlan?.basicInfo?.theme || item.name)
                                                    : item.name}
                                            </h3>
                                        )}

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

                                    {/* Category Icon Area */}
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

                                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                                    <button
                                        onClick={() => onLoad(item)}
                                        className="text-sm font-bold text-emerald-600 hover:text-emerald-800 flex items-center gap-1.5 group-hover/btn:translate-x-1 transition-all"
                                    >
                                        Open Kit
                                        <ArrowRight size={16} className="transition-transform" />
                                    </button>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); startEditing(item.id, item.name); }}
                                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                            title="Rename Project"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Delete Project"
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
        </div>
    );
};