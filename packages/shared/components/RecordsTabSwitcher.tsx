import React from 'react';

export interface RecordsTab {
    key: string;
    label: string;
    icon: React.ReactNode;
    count: number;
}

export interface RecordsTabSwitcherProps {
    tabs: RecordsTab[];
    activeTab: string;
    onTabChange: (key: string) => void;
    accentColor?: 'emerald' | 'violet' | 'indigo' | 'rose';
}

const ACCENT_MAP = {
    emerald: {
        active: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
        badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/30 dark:text-emerald-300',
    },
    violet: {
        active: 'bg-violet-50 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300',
        badge: 'bg-violet-100 text-violet-700 dark:bg-violet-500/30 dark:text-violet-300',
    },
    indigo: {
        active: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300',
        badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/30 dark:text-indigo-300',
    },
    rose: {
        active: 'bg-rose-50 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
        badge: 'bg-rose-100 text-rose-700 dark:bg-rose-500/30 dark:text-rose-300',
    },
};

export const RecordsTabSwitcher: React.FC<RecordsTabSwitcherProps> = React.memo(({
    tabs, activeTab, onTabChange, accentColor = 'emerald',
}) => {
    const colors = ACCENT_MAP[accentColor];
    return (
        <div className="flex gap-4 p-1.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-white/5 mx-auto max-w-sm mb-6">
            {tabs.map(tab => (
                <button
                    key={tab.key}
                    onClick={() => onTabChange(tab.key)}
                    className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${activeTab === tab.key
                        ? colors.active
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                >
                    {tab.icon}
                    {tab.label}
                    <span className={`text-xs font-bold rounded-full px-2 py-0.5 ${activeTab === tab.key ? colors.badge : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                        {tab.count}
                    </span>
                </button>
            ))}
        </div>
    );
});
