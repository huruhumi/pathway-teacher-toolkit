import React from 'react';

export interface EmptyStateProps {
    /** The lucide-react (or other) icon component to display */
    icon: React.ElementType;
    iconSize?: number;
    iconClassName?: string;

    /** The main heading text */
    title: React.ReactNode;
    titleClassName?: string;

    /** The secondary descriptive text */
    description: React.ReactNode;
    descriptionClassName?: string;

    /** The main container class, useful for overriding padding, borders, or backgrounds */
    className?: string;

    /** Optional call to action button text */
    actionLabel?: string;

    /** Optional call to action button click handler */
    onAction?: () => void;

    /** Optional call to action button class name */
    actionClassName?: string;
}

/**
 * A shared component for displaying empty states (e.g., no search results, no saved items).
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
    icon: Icon,
    iconSize = 32,
    iconClassName = "text-slate-400 dark:text-slate-500",
    title,
    titleClassName = "text-lg font-bold text-slate-700 dark:text-slate-200",
    description,
    descriptionClassName = "text-slate-500 dark:text-slate-400",
    className = "",
    actionLabel,
    onAction,
    actionClassName = "bg-violet-600 hover:bg-violet-700 text-white shadow-violet-600/20"
}) => {
    return (
        <div className={`text-center py-20 bg-white dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-300 dark:border-white/5 ${className}`}>
            <div className={`mx-auto w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 ${iconClassName}`}>
                <Icon size={iconSize} />
            </div>
            <h3 className={`mb-1 ${titleClassName}`}>{title}</h3>
            <p className={`mb-6 ${descriptionClassName}`}>{description}</p>

            {actionLabel && onAction && (
                <button
                    onClick={onAction}
                    className={`px-6 py-2.5 font-medium rounded-xl transition-colors shadow-sm ${actionClassName}`}
                >
                    {actionLabel}
                </button>
            )}
        </div>
    );
};
