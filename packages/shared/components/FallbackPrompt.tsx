import React from 'react';
import { AlertTriangle, ArrowRight, XCircle } from 'lucide-react';

export interface FallbackPromptProps {
    title: string;
    detail: string;
    onContinue: () => void;
    onCancel: () => void;
    continueLabel?: string;
    cancelLabel?: string;
}

/**
 * Inline fallback confirmation prompt shown beneath the progress bar
 * when NotebookLM or RAG encounters a recoverable error.
 */
export const FallbackPrompt: React.FC<FallbackPromptProps> = ({
    title,
    detail,
    onContinue,
    onCancel,
    continueLabel = 'Continue with Fallback',
    cancelLabel = 'Stop Generation',
}) => {
    return (
        <div className="mt-3 animate-fade-in-up rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-sm">
            <div className="flex items-start gap-3">
                <AlertTriangle size={20} className="mt-0.5 flex-shrink-0 text-amber-600" />
                <div className="flex-1 min-w-0">
                    <div className="font-semibold text-amber-800 text-sm">{title}</div>
                    <div className="mt-1 text-xs text-amber-700/90 leading-relaxed">{detail}</div>
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                        <button
                            type="button"
                            onClick={onContinue}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 transition-colors"
                        >
                            <ArrowRight size={14} />
                            {continueLabel}
                        </button>
                        <button
                            type="button"
                            onClick={onCancel}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 shadow-sm hover:bg-amber-50 transition-colors"
                        >
                            <XCircle size={14} />
                            {cancelLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
