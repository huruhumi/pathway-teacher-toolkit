import React from 'react';

export interface BodyContainerProps {
    children: React.ReactNode;
    className?: string;
}

/**
 * Shared body container — white rounded card with consistent padding.
 * Used as the main content wrapper below HeroBanner in every sub-project.
 */
export const BodyContainer: React.FC<BodyContainerProps> = ({ children, className = '' }) => {
    return (
        <div
            className={`bg-white dark:bg-slate-900/80 dark:backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-2xl dark:ring-1 dark:ring-white/5 p-6 md:p-8 ${className}`}
        >
            {children}
        </div>
    );
};
