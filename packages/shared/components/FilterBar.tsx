import React from 'react';
import { Search } from 'lucide-react';

export interface FilterSelectProps {
    value: string;
    onChange: (value: string) => void;
    icon: React.ElementType;
    children: React.ReactNode;
    className?: string;
}

export const FilterSelect: React.FC<FilterSelectProps> = React.memo(({ value, onChange, icon: Icon, children, className = '' }) => (
    <div className={`flex items-center gap-1.5 px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-xl ${className}`}>
        <Icon size={14} className="text-slate-400" />
        <select
            value={value}
            onChange={e => onChange(e.target.value)}
            className="bg-transparent text-sm text-slate-700 dark:text-slate-200 outline-none font-medium cursor-pointer max-w-[120px] truncate"
        >
            {children}
        </select>
    </div>
));

export interface FilterBarProps {
    search: string;
    onSearchChange: (value: string) => void;
    searchPlaceholder?: string;
    filters?: React.ReactNode;
    className?: string;
}

export const FilterBar: React.FC<FilterBarProps> = React.memo(({
    search,
    onSearchChange,
    searchPlaceholder = "Search...",
    filters,
    className = ''
}) => {
    return (
        <div className={`mb-6 space-y-3 flex flex-col ${className}`}>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                    type="text"
                    placeholder={searchPlaceholder}
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition-all dark:text-slate-200"
                />
            </div>
            {filters && (
                <div className="flex flex-wrap gap-2">
                    {filters}
                </div>
            )}
        </div>
    );
});
