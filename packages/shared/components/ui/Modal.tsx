import React, { useEffect, useState } from 'react';

export interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    maxWidth?: string;
    className?: string;
    disableBackdropClick?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    children,
    maxWidth = 'max-w-md',
    className = '',
    disableBackdropClick = false,
}) => {
    const [renderIfOpen, setRenderIfOpen] = useState(isOpen);

    useEffect(() => {
        if (isOpen) {
            setRenderIfOpen(true);
            document.body.style.overflow = 'hidden';
        } else {
            // allows closing animation to play before unmounting (if we configure exit animations)
            const timeout = setTimeout(() => {
                setRenderIfOpen(false);
                document.body.style.overflow = '';
            }, 300);
            return () => clearTimeout(timeout);
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    if (!renderIfOpen) return null;

    return (
        <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4`}>
            {/* Backdrop */}
            <div
                className={`absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
                onClick={() => !disableBackdropClick && onClose()}
            ></div>

            {/* Modal Content */}
            <div
                className={`relative bg-white rounded-2xl shadow-2xl w-full ${maxWidth} flex flex-col overflow-hidden transform transition-all duration-300 ${isOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4'} max-h-[90vh] ${className}`}
                onClick={(e) => e.stopPropagation()}
            >
                {children}
            </div>
        </div>
    );
};
