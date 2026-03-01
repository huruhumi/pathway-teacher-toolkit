import React from 'react';
import { Search, GraduationCap, Calendar, SortAsc } from 'lucide-react';
import { CEFRLevel } from '../types';
import { useLanguage } from '../i18n/LanguageContext';

export interface FilterBarProps {
    search: string;
    onSearchChange: (v: string) => void;
    level: string;
    onLevelChange: (v: string) => void;
    dateRange: string;
    onDateRangeChange: (v: string) => void;
    sort: string;
    onSortChange: (v: string) => void;
    extraFilters?: React.ReactNode;
}

export const FilterBar: React.FC<FilterBarProps> = ({ search, onSearchChange, level, onLevelChange, dateRange, onDateRangeChange, sort, onSortChange, extraFilters }) => {
    const { t } = useLanguage();
    return (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6">
            <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search title / topic..."
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition-all"
                    />
                </div>
                <div className="flex flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
                        <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                        <select value={level} onChange={(e) => onLevelChange(e.target.value)} className="bg-transparent text-sm text-slate-700 outline-none font-medium cursor-pointer">
                            <option>All Levels</option>
                            {Object.values(CEFRLevel).map(lvl => (<option key={lvl} value={lvl}>{t(`cefr.${lvl}` as any)}</option>))}
                        </select>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <select value={dateRange} onChange={(e) => onDateRangeChange(e.target.value)} className="bg-transparent text-sm text-slate-700 outline-none font-medium cursor-pointer">
                            <option value="all">All Time</option>
                            <option value="today">Today</option>
                            <option value="week">This Week</option>
                            <option value="month">This Month</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
                        <SortAsc className="w-3.5 h-3.5 text-slate-400" />
                        <select value={sort} onChange={(e) => onSortChange(e.target.value)} className="bg-transparent text-sm text-slate-700 outline-none font-medium cursor-pointer">
                            <option value="newest">Newest</option>
                            <option value="oldest">Oldest</option>
                            <option value="az">A-Z</option>
                            <option value="za">Z-A</option>
                        </select>
                    </div>
                    {extraFilters}
                </div>
            </div>
        </div>
    );
};
