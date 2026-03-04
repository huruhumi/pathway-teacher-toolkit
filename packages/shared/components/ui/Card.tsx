import React, { HTMLAttributes } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
    hoverable?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
    ({ className = '', hoverable = false, children, ...props }, ref) => {
        const baseClass = 'card';
        const hoverClass = hoverable ? 'card-hover cursor-pointer' : '';
        const combinedClassName = `${baseClass} ${hoverClass} ${className}`.trim();

        return (
            <div ref={ref} className={combinedClassName} {...props}>
                {children}
            </div>
        );
    }
);

Card.displayName = 'Card';
