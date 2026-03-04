import React, { TextareaHTMLAttributes } from 'react';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    error?: string;
    containerClassName?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ className = '', label, error, containerClassName = '', id, ...props }, ref) => {
        const defaultId = id || (label ? `textarea-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);

        return (
            <div className={`${containerClassName}`}>
                {label && (
                    <label htmlFor={defaultId} className="input-label">
                        {label}
                    </label>
                )}
                <textarea
                    id={defaultId}
                    ref={ref}
                    className={`input-field ${error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''} ${className}`.trim()}
                    {...props}
                />
                {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
            </div>
        );
    }
);

Textarea.displayName = 'Textarea';
