import { create } from 'zustand';

export interface Toast {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    duration?: number;
}

interface ToastStore {
    toasts: Toast[];
    addToast: (toast: Omit<Toast, 'id'>) => void;
    removeToast: (id: string) => void;
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
    warning: (message: string) => void;
}

let _counter = 0;

export const useToast = create<ToastStore>((set) => ({
    toasts: [],
    addToast: (toast) => {
        const id = `toast-${++_counter}`;
        const duration = toast.duration ?? (toast.type === 'error' ? 5000 : 3000);
        set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
        setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), duration);
    },
    removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    success: (message) => {
        const id = `toast-${++_counter}`;
        set((s) => ({ toasts: [...s.toasts, { id, message, type: 'success' }] }));
        setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3000);
    },
    error: (message) => {
        const id = `toast-${++_counter}`;
        set((s) => ({ toasts: [...s.toasts, { id, message, type: 'error' }] }));
        setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 5000);
    },
    info: (message) => {
        const id = `toast-${++_counter}`;
        set((s) => ({ toasts: [...s.toasts, { id, message, type: 'info' }] }));
        setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3000);
    },
    warning: (message) => {
        const id = `toast-${++_counter}`;
        set((s) => ({ toasts: [...s.toasts, { id, message, type: 'warning' }] }));
        setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000);
    },
}));
