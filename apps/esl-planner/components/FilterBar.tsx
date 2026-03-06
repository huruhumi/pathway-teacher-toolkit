import React from 'react';
import { GraduationCap, Calendar, SortAsc } from 'lucide-react';
import { CEFRLevel } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { FilterBar as SharedFilterBar, FilterSelect } from '@shared/components/FilterBar';

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
        <SharedFilterBar
            search={search}
            onSearchChange={onSearchChange}
            searchPlaceholder="Search title / topic..."
            filters={
                <>
                    <FilterSelect value={level} onChange={onLevelChange} icon={GraduationCap} aria-label="Select Level">
                        <option value="All Levels">All Levels</option>
                        {Object.values(CEFRLevel).map(lvl => (<option key={lvl} value={lvl}>{t(`cefr.${lvl}` as any)}</option>))}
                    </FilterSelect>
                    <FilterSelect value={dateRange} onChange={onDateRangeChange} icon={Calendar}>
                        <option value="all">All Time</option>
                        <option value="today">Today</option>
                        <option value="week">This Week</option>
                        <option value="month">This Month</option>
                    </FilterSelect>
                    <FilterSelect value={sort} onChange={onSortChange} icon={SortAsc}>
                        <option value="newest">Newest</option>
                        <option value="oldest">Oldest</option>
                        <option value="az">A-Z</option>
                        <option value="za">Z-A</option>
                    </FilterSelect>
                    {extraFilters}
                </>
            }
        />
    );
};
