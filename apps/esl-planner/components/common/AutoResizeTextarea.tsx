import React, { useEffect, useRef } from 'react';

export interface AutoResizeTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    minRows?: number;
    maxHeight?: string;
}

export const AutoResizeTextarea: React.FC<AutoResizeTextareaProps> = ({
    minRows = 1,
    maxHeight,
    className,
    ...props
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            const scrollHeight = textareaRef.current.scrollHeight;

            if (maxHeight && scrollHeight > parseInt(maxHeight)) {
                textareaRef.current.style.height = maxHeight;
                textareaRef.current.style.overflowY = 'auto';
            } else {
                textareaRef.current.style.height = `${scrollHeight}px`;
                textareaRef.current.style.overflowY = 'hidden';
            }
        }
    }, [props.value, maxHeight]);

    return (
        <textarea
            ref={textareaRef}
            rows={minRows}
            className={`resize-none overflow-hidden ${className || ''}`}
            {...props}
        />
    );
};
