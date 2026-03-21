import React, { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { Library as LibraryIcon, BookOpen } from 'lucide-react';

const BooksPage = React.lazy(() => import('./BooksPage'));
const ReadingLogsPage = React.lazy(() => import('./ReadingLogsPage'));

type SubTab = 'books' | 'reading';

const LibraryPage: React.FC = () => {
    const { lang } = useLanguage();
    const zh = lang === 'zh';
    const [sub, setSub] = useState<SubTab>('books');

    const tabs: { key: SubTab; label: string; icon: React.ReactNode }[] = [
        { key: 'books', label: zh ? '借阅管理' : 'Books', icon: <LibraryIcon size={15} /> },
        { key: 'reading', label: zh ? '阅读日志' : 'Reading Logs', icon: <BookOpen size={15} /> },
    ];

    return (
        <div>
            {/* Sub-tab bar */}
            <div className="flex gap-1 mb-5 bg-slate-100 dark:bg-slate-800/60 rounded-xl p-1 w-fit">
                {tabs.map(t => (
                    <button
                        key={t.key}
                        onClick={() => setSub(t.key)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${sub === t.key
                                ? 'bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-300 shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                            }`}
                    >
                        {t.icon}{t.label}
                    </button>
                ))}
            </div>

            <React.Suspense fallback={<div className="flex justify-center py-12"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-600" /></div>}>
                {sub === 'books' && <BooksPage />}
                {sub === 'reading' && <ReadingLogsPage />}
            </React.Suspense>
        </div>
    );
};

export default LibraryPage;
