import React from 'react';

interface AppFooterProps {
    appName: string;
}

const AppFooter: React.FC<AppFooterProps> = ({ appName }) => {
    return (
        <footer className="bg-white dark:bg-slate-950/50 border-t border-slate-200 dark:border-white/5 py-6 print:hidden">
            <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-400 text-xs">
                <p>&copy; {new Date().getFullYear()} {appName} &middot; Pathway Academy Toolkit</p>
                <p>Powered by Google Gemini</p>
            </div>
        </footer>
    );
};

export default AppFooter;
