import React from 'react';
import { Sparkles, PartyPopper } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

interface EmptyStateProps {
    type: 'all-clear' | 'no-assignments';
}

export const EmptyState: React.FC<EmptyStateProps> = ({ type }) => {
    const { lang } = useLanguage();

    const isAllClear = type === 'all-clear';

    return (
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-white/50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
            <div className="relative mb-6">
                <div className="absolute inset-0 bg-sky-200 dark:bg-sky-900 rounded-full blur-2xl opacity-50 animate-pulse"></div>
                <div className="w-24 h-24 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-lg relative z-10">
                    {isAllClear ? (
                        <PartyPopper size={48} className="text-emerald-500 animate-bounce" />
                    ) : (
                        <Sparkles size={48} className="text-sky-500" />
                    )}
                </div>
            </div>

            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
                {isAllClear
                    ? (lang === 'zh' ? '太棒啦！全搞定啦' : 'Awesome! All Clear!')
                    : (lang === 'zh' ? '目前没有任务哦' : 'No Tasks Yet')}
            </h3>
            <p className="text-sm text-slate-500 max-w-xs text-center">
                {isAllClear
                    ? (lang === 'zh' ? '你已经完成了所有的学习任务，去好好玩耍或者读一本喜欢的书吧！' : 'You have completed all your tasks. Go play or read a book!')
                    : (lang === 'zh' ? '老师还没有布置新的任务，享受这片宁静吧。' : 'Teachers have not assigned new tasks yet. Enjoy the quiet time.')}
            </p>
        </div>
    );
};
