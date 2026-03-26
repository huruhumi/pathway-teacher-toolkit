import React, { useEffect, useState } from 'react';
import { X, AlertCircle, CheckCircle2, Loader2, Sparkles, BookOpenCheck, Zap } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

export type CommitStatus = 'idle' | 'generating' | 'done' | 'error';

interface CommitProgressModalProps {
    isOpen: boolean;
    onClose: () => void;
    status: CommitStatus;
    error?: string;
}

const PHASES = [
    { key: 'analyzing', label: '分析修改内容', labelEn: 'Analyzing Edits', targetProgress: 20 },
    { key: 'handbook', label: '重写配套手册', labelEn: 'Regenerating Handbook', targetProgress: 60 },
    { key: 'resources', label: '生成物资清单与图片提示词', labelEn: 'Generating Resources & Prompts', targetProgress: 95 },
] as const;

export const CommitProgressModal: React.FC<CommitProgressModalProps> = ({
    isOpen,
    onClose,
    status,
    error,
}) => {
    const { lang } = useLanguage();
    const [progress, setProgress] = useState(0);
    const [activePhaseIndex, setActivePhaseIndex] = useState(0);

    useEffect(() => {
        if (!isOpen) {
            setProgress(0);
            setActivePhaseIndex(0);
            return;
        }

        if (status === 'done') {
            setProgress(100);
            setActivePhaseIndex(PHASES.length);
            return;
        }

        if (status === 'error') {
            return; // Stop progress
        }

        if (status === 'generating') {
            // Simulate progress
            // Total expected time around 20-30 seconds.
            // Let's tick every 200ms
            const interval = setInterval(() => {
                setProgress(p => {
                    const newP = p + (Math.random() * 0.5 + 0.1); // slow creep

                    if (newP >= 95) return 95; // cap at 95 until done

                    // Update phase based on simulated progress
                    const phaseIdx = PHASES.findIndex(phase => newP < phase.targetProgress);
                    if (phaseIdx !== -1 && phaseIdx !== activePhaseIndex) {
                        setActivePhaseIndex(phaseIdx);
                    } else if (newP >= 95) {
                        setActivePhaseIndex(PHASES.length - 1);
                    }

                    return newP;
                });
            }, 300);

            return () => clearInterval(interval);
        }
    }, [isOpen, status, activePhaseIndex]);

    if (!isOpen) return null;

    const isDone = status === 'done';
    const isError = status === 'error';
    const isWorking = status === 'generating';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/10">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Zap className="w-5 h-5 text-emerald-500" />
                        {lang === 'zh' ? '应用修改 (Commit)' : 'Commit Changes'}
                    </h3>
                    <button
                        onClick={isDone || isError ? onClose : () => { }}
                        disabled={isWorking}
                        className={`p-1 rounded-lg transition-colors ${isWorking ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-100 dark:hover:bg-white/10'}`}
                        title="Close"
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-5">
                    {/* Phase steps */}
                    <div className="space-y-3">
                        {PHASES.map((phase, i) => {
                            const isActive = isWorking && activePhaseIndex === i;
                            const isComplete = isDone || (isWorking && activePhaseIndex > i);
                            const isPending = isWorking && activePhaseIndex < i;

                            return (
                                <div key={phase.key} className="flex items-center gap-3">
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${isComplete ? 'bg-emerald-100 text-emerald-600' :
                                        isActive ? 'bg-blue-100 text-blue-600' :
                                            'bg-slate-100 text-slate-400'
                                        }`}>
                                        {isComplete ? (
                                            <CheckCircle2 className="w-4 h-4" />
                                        ) : isActive ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <div className="w-2 h-2 rounded-full bg-slate-300" />
                                        )}
                                    </div>
                                    <span className={`text-sm font-medium transition-colors ${isComplete ? 'text-emerald-600' :
                                        isActive ? 'text-blue-600' :
                                            isPending ? 'text-slate-400' : 'text-slate-500'
                                        }`}>
                                        {lang === 'zh' ? phase.label : phase.labelEn}
                                    </span>
                                </div>
                            );
                        })}

                        {/* Done step */}
                        {isDone && (
                            <div className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-full flex items-center justify-center bg-emerald-100 text-emerald-600">
                                    <CheckCircle2 className="w-4 h-4" />
                                </div>
                                <span className="text-sm font-medium text-emerald-600">{lang === 'zh' ? '生成完成' : 'Completed'}</span>
                            </div>
                        )}
                    </div>

                    {/* Progress bar */}
                    {isWorking && (
                        <div className="space-y-2">
                            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300 ease-out"
                                    style={{ width: `${Math.max(progress, 2)}%` }}
                                />
                            </div>
                            <p className="text-xs text-slate-500 text-center">
                                {lang === 'zh' ? 'AI 正在根据修改后的内容重新构思，一般需要等待 15-30 秒...' : 'AI is regenerating content based on your modifications (15-30s)...'}
                            </p>
                        </div>
                    )}

                    {/* Error state */}
                    {isError && (
                        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl">
                            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-red-700 dark:text-red-400">{lang === 'zh' ? '生成失败' : 'Generation Failed'}</p>
                                <p className="text-xs text-red-600 dark:text-red-300 mt-1">{error || 'An unknown error occurred.'}</p>
                            </div>
                        </div>
                    )}

                    {/* Done state */}
                    {isDone && (
                        <div className="space-y-4">
                            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                                    {lang === 'zh' ? '手册内容、物资清单及后续资产均已更新并贴合物业课件！' : 'Handbook, supplies, and other downstream assets updated to reflect your modified roadmap!'}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 dark:border-white/10 flex justify-end gap-3">
                    {(isDone || isError) && (
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-white bg-slate-700 hover:bg-slate-800 rounded-xl transition-colors"
                        >
                            {lang === 'zh' ? '完成' : 'Close'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
