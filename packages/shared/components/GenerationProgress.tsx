import React from 'react';

export interface GenerationProgressProps {
    /** Status text displayed below the bar, e.g. "Analyzing textbook..." */
    statusText: string;
    /** Color theme for the gradient bar */
    theme?: 'violet' | 'indigo' | 'red' | 'emerald';
}

const themeColors: Record<string, { bar: string; text: string }> = {
    violet: { bar: 'from-violet-500 via-purple-400 to-violet-500', text: 'text-violet-500' },
    indigo: { bar: 'from-indigo-500 via-blue-400 to-indigo-500', text: 'text-indigo-500' },
    red: { bar: 'from-red-500 via-rose-400 to-red-500', text: 'text-rose-500' },
    emerald: { bar: 'from-emerald-500 via-teal-400 to-emerald-500', text: 'text-emerald-500' },
};

export const GenerationProgress: React.FC<GenerationProgressProps> = ({
    statusText,
    theme = 'violet',
}) => {
    const colors = themeColors[theme] || themeColors.violet;

    return (
        <div className="mt-3 space-y-2 animate-fade-in-up">
            {/* Progress bar track */}
            <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full bg-gradient-to-r ${colors.bar}`}
                    style={{
                        width: '40%',
                        animation: 'shimmer-slide 1.5s ease-in-out infinite',
                    }}
                />
            </div>
            {/* Status text */}
            <div className="flex items-center justify-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full bg-current ${colors.text} animate-pulse`} />
                <span className={`text-xs font-medium ${colors.text} animate-pulse`}>
                    {statusText}
                </span>
            </div>
        </div>
    );
};
