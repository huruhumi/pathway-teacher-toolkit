import React, { useState } from 'react';
import { AlertTriangle, ArrowRight, XCircle, RefreshCw } from 'lucide-react';

export interface FallbackPromptProps {
    title: string;
    detail: string;
    onContinue: () => void;
    onCancel: () => void;
    onRetry?: () => void;
    continueLabel?: string;
    cancelLabel?: string;
    retryLabel?: string;
}

const NLM_PROXY_URL = 'http://localhost:3199';

async function pingProxy(): Promise<boolean> {
    try {
        const response = await fetch(NLM_PROXY_URL, {
            method: 'OPTIONS',
            signal: AbortSignal.timeout(2000),
        });
        return response.ok || response.status === 204;
    } catch {
        return false;
    }
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
    onRetry,
    continueLabel = 'Continue with Fallback',
    cancelLabel = 'Stop Generation',
    retryLabel = 'Retry Connection',
}) => {
    const [retrying, setRetrying] = useState(false);
    const [retryResult, setRetryResult] = useState<'success' | 'fail' | null>(null);

    const handleRetry = async () => {
        setRetrying(true);
        setRetryResult(null);
        const alive = await pingProxy();
        setRetrying(false);
        if (alive) {
            setRetryResult('success');
            // Brief delay so user sees the success state, then fire retry
            setTimeout(() => onRetry?.(), 400);
        } else {
            setRetryResult('fail');
            setTimeout(() => setRetryResult(null), 3000);
        }
    };

    return (
        <div className="mt-3 animate-fade-in-up rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-sm">
            <div className="flex items-start gap-3">
                <AlertTriangle size={20} className="mt-0.5 flex-shrink-0 text-amber-600" />
                <div className="flex-1 min-w-0">
                    <div className="font-semibold text-amber-800 text-sm">{title}</div>
                    <div className="mt-1 text-xs text-amber-700/90 leading-relaxed">{detail}</div>
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                        {onRetry && (
                            <button
                                type="button"
                                onClick={handleRetry}
                                disabled={retrying}
                                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors ${retryResult === 'success'
                                    ? 'bg-emerald-600 text-white'
                                    : retryResult === 'fail'
                                        ? 'bg-red-100 text-red-700 border border-red-300'
                                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                    } disabled:opacity-60`}
                            >
                                <RefreshCw size={14} className={retrying ? 'animate-spin' : ''} />
                                {retrying
                                    ? 'Connecting...'
                                    : retryResult === 'success'
                                        ? '✓ Connected!'
                                        : retryResult === 'fail'
                                            ? 'Proxy not running'
                                            : retryLabel}
                            </button>
                        )}
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
