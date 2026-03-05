import React from 'react';

export interface PageLayoutProps {
    children: React.ReactNode;
    /** Extra classes on <main> */
    className?: string;
    /** Override default max-width. Pass a CSS value like '1152px' or '72rem'. Default: 56rem (≈ max-w-4xl) */
    maxWidth?: string;
}

/**
 * Shared page layout wrapper — sits below AppHeader, provides unified
 * max-width, horizontal padding, and vertical spacing for HeroBanner + BodyContainer.
 */
export const PageLayout: React.FC<PageLayoutProps> = ({ children, className = '', maxWidth }) => {
    return (
        <main
            className={`mx-auto px-4 sm:px-6 py-6 space-y-6 ${maxWidth ? '' : 'max-w-4xl'} ${className}`}
            style={maxWidth ? { maxWidth } : undefined}
        >
            {children}
        </main>
    );
};
