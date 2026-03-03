import React from 'react';
import { Loader2, ArrowRight } from 'lucide-react';

export interface GenerationButtonProps {
    /** Whether the generation process is currently active */
    loading: boolean;
    /** Whether the button should be disabled (e.g., due to missing required fields) */
    disabled?: boolean;
    /** The handler for the button click */
    onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
    /** The default text to display when ready */
    defaultText: string | React.ReactNode;
    /** The text to display when loading (optional) */
    loadingText?: string | React.ReactNode;
    /** 
     * The primary theme color class for the gradient background. 
     * e.g., "emerald" for `from-emerald-600 to-teal-600`
     * or "indigo" for `from-indigo-600 to-violet-600`.
     */
    theme?: 'emerald' | 'indigo' | 'violet' | 'teal';
    /** Custom class names to override styles */
    className?: string;
    /** Custom icon to show next to the default text, defaults to ArrowRight */
    icon?: React.ReactNode;
}

/**
 * A shared component for the main generation action button.
 * Handles loading states, disabled styling, and branded gradients.
 */
export const GenerationButton: React.FC<GenerationButtonProps> = React.memo(({
    loading,
    disabled = false,
    onClick,
    defaultText,
    loadingText = defaultText,
    theme = 'emerald',
    className = '',
    icon = <ArrowRight size={20} />
}) => {

    const getGradientClasses = () => {
        if (loading) return 'bg-slate-400 dark:bg-slate-600'; // Or specific loading color if desired

        switch (theme) {
            case 'indigo':
                return 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500';
            case 'violet':
                return 'bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500';
            case 'teal':
                return 'bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500';
            case 'emerald':
            default:
                return 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500';
        }
    };

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled || loading}
            className={`
                w-full text-white rounded-xl py-4 font-bold text-lg 
                flex items-center justify-center gap-3 transition-all
                ${!disabled && !loading ? 'hover:shadow-lg hover:-translate-y-0.5' : ''}
                ${disabled && !loading ? 'bg-slate-400 dark:bg-slate-600 cursor-not-allowed opacity-70' : ''}
                ${!disabled && !loading ? getGradientClasses() : ''}
                ${loading ? 'bg-blue-600' : ''} 
                ${className}
            `}
        >
            {loading ? (
                <>
                    <Loader2 className="animate-spin" size={22} />
                    {loadingText}
                </>
            ) : (
                <>
                    {defaultText} {icon}
                </>
            )}
        </button>
    );
});
