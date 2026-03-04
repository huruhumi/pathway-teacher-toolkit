import React, { SelectHTMLAttributes } from 'react';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    error?: string;
    containerClassName?: string;
    options?: { label: string; value: string | number }[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
    ({ className = '', label, error, containerClassName = '', options, children, id, ...props }, ref) => {
        const defaultId = id || (label ? `select-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);

        return (
            <div className={`${containerClassName}`}>
                {label && (
                    <label htmlFor={defaultId} className="input-label">
                        {label}
                    </label>
                )}
                <select
                    id={defaultId}
                    ref={ref}
                    className={`input-field ${error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''} ${className}`.trim()}
                    {...props}
                >
                    {options
                        ? options.map((opt, i) => (
                            <option key={i} value={opt.value}>
                                {opt.label}
                            </option>
                        ))
                        : children}
                </select>
                {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
            </div>
        );
    }
);

Select.displayName = 'Select';
