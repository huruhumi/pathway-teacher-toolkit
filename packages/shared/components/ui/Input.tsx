import React, { InputHTMLAttributes } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    containerClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className = '', label, error, containerClassName = '', id, ...props }, ref) => {
        const defaultId = id || (label ? `input-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);

        return (
            <div className={`${containerClassName}`}>
                {label && (
                    <label htmlFor={defaultId} className="input-label">
                        {label}
                    </label>
                )}
                <input
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

Input.displayName = 'Input';
