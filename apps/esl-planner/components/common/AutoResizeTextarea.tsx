import React, { useEffect, useRef } from 'react';

export interface AutoResizeTextareaProps {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    className?: string;
    placeholder?: string;
    minRows?: number;
    maxHeight?: string;
}

export const AutoResizeTextarea: React.FC<AutoResizeTextareaProps> = ({
    value,
    onChange,
    className,
    placeholder,
    minRows = 1,
    maxHeight
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
    }, [value, maxHeight]);

    return (
        <textarea
            ref={textareaRef}
            value={value}
            onChange={onChange}
            className={`${className} resize-none box-border block`}
            rows={minRows}
            placeholder={placeholder}
        />
    );
};
