import React from 'react';

export interface PageLayoutProps {
    children: React.ReactNode;
    /** Extra classes on <main> */
    className?: string;
}

/**
 * Shared page layout wrapper — sits below AppHeader, provides unified
 * max-width, horizontal padding, and vertical spacing for HeroBanner + BodyContainer.
 */
export const PageLayout: React.FC<PageLayoutProps> = ({ children, className = '' }) => {
    return (
        <main className={`max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6 ${className}`}>
            {children}
        </main>
    );
};
