import React from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '../../stores/useToast';
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';

const ICONS = {
    success: CheckCircle2,
    error: AlertCircle,
    info: Info,
    warning: AlertTriangle,
};

const COLORS = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    error: 'bg-rose-50 border-rose-200 text-rose-800',
    info: 'bg-sky-50 border-sky-200 text-sky-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
};

const ICON_COLORS = {
    success: 'text-emerald-500',
    error: 'text-rose-500',
    info: 'text-sky-500',
    warning: 'text-amber-500',
};

const ToastContainer: React.FC = () => {
    const { toasts, removeToast } = useToast();

    if (toasts.length === 0) return null;

    return createPortal(
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm print:hidden">
            {toasts.map((toast) => {
                const Icon = ICONS[toast.type];
                return (
                    <div
                        key={toast.id}
                        className={`flex items-start gap-3 p-4 rounded-xl border shadow-lg backdrop-blur-sm animate-in slide-in-from-right-5 fade-in duration-200 ${COLORS[toast.type]}`}
                    >
                        <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${ICON_COLORS[toast.type]}`} />
                        <p className="text-sm font-medium flex-1 leading-relaxed">{toast.message}</p>
                        <button
                            onClick={() => removeToast(toast.id)}
                            className="flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                );
            })}
        </div>,
        document.body
    );
};

export default ToastContainer;
