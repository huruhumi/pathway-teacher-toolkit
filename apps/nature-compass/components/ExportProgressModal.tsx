import React from 'react';
import { X, ExternalLink, AlertCircle, CheckCircle2, Loader2, Upload, Sparkles, BookOpenCheck, WifiOff } from 'lucide-react';
import type { ExportProgress } from '../hooks/useSlideExport';

interface ExportProgressModalProps {
    isOpen: boolean;
    onClose: () => void;
    exportState: ExportProgress;
    onCancel: () => void;
}

const PHASES = [
    { key: 'authenticating', label: '验证认证', labelEn: 'Authenticating', icon: BookOpenCheck },
    { key: 'creating_notebook', label: '创建笔记本', labelEn: 'Creating Notebook', icon: BookOpenCheck },
    { key: 'uploading_sources', label: '上传资源', labelEn: 'Uploading Sources', icon: Upload },
    { key: 'generating_slides', label: '生成 Slides', labelEn: 'Generating Slides', icon: Sparkles },
] as const;

function getPhaseIndex(status: string): number {
    const idx = PHASES.findIndex(p => p.key === status);
    if (status === 'done') return PHASES.length;
    return idx >= 0 ? idx : -1;
}

export const ExportProgressModal: React.FC<ExportProgressModalProps> = ({
    isOpen,
    onClose,
    exportState,
    onCancel,
}) => {
    if (!isOpen) return null;

    const { status, progress, message, notebookUrl, slideDecks, stats, error } = exportState;
    const isDone = status === 'done';
    const isError = status === 'error';
    const isWorking = !isDone && !isError && status !== 'idle';
    const currentPhaseIdx = getPhaseIndex(status);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/10">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-emerald-500" />
                        导出到 NotebookLM
                    </h3>
                    <button
                        onClick={isDone || isError ? onClose : onCancel}
                        className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                        title="关闭"
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-5">
                    {/* Phase steps */}
                    <div className="space-y-3">
                        {PHASES.map((phase, i) => {
                            const Icon = phase.icon;
                            const isActive = phase.key === status;
                            const isComplete = currentPhaseIdx > i;
                            const isPending = currentPhaseIdx < i;

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
                                            <Icon className="w-4 h-4" />
                                        )}
                                    </div>
                                    <span className={`text-sm font-medium transition-colors ${isComplete ? 'text-emerald-600' :
                                            isActive ? 'text-blue-600' :
                                                isPending ? 'text-slate-400' : 'text-slate-500'
                                        }`}>
                                        {phase.label}
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
                                <span className="text-sm font-medium text-emerald-600">完成</span>
                            </div>
                        )}
                    </div>

                    {/* Progress bar */}
                    {isWorking && (
                        <div className="space-y-2">
                            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-700 ease-out"
                                    style={{ width: `${Math.max(progress * 100, 2)}%` }}
                                />
                            </div>
                            <p className="text-xs text-slate-500 text-center">{message}</p>
                        </div>
                    )}

                    {/* Error state */}
                    {isError && (
                        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl">
                            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-red-700 dark:text-red-400">导出失败</p>
                                <p className="text-xs text-red-600 dark:text-red-300 mt-1">{error || message}</p>
                            </div>
                        </div>
                    )}

                    {/* Done state */}
                    {isDone && (
                        <div className="space-y-4">
                            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{message}</p>
                                {stats && (
                                    <div className="mt-2 text-xs text-emerald-600 dark:text-emerald-300 space-y-0.5">
                                        <p>📚 知识底稿: {stats.factSheetSources} 个源</p>
                                        <p>📄 手册内容: {stats.handbookSources} 个源</p>
                                        <p>🎨 Slide Decks: {stats.slideDecksQueued} 个已提交{stats.slideDecksFailed > 0 ? `，${stats.slideDecksFailed} 个失败` : ''}</p>
                                    </div>
                                )}
                            </div>

                            {/* Slide deck status */}
                            {slideDecks && slideDecks.length > 0 && (
                                <div className="space-y-1.5">
                                    {slideDecks.map((deck, i) => (
                                        <div key={i} className="flex items-center gap-2 text-sm">
                                            {deck.status === 'queued' ? (
                                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                            ) : (
                                                <AlertCircle className="w-4 h-4 text-red-500" />
                                            )}
                                            <span className={deck.status === 'queued' ? 'text-slate-700 dark:text-slate-300' : 'text-red-600'}>
                                                {deck.title}
                                            </span>
                                            {deck.error && <span className="text-xs text-red-400">({deck.error})</span>}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Open in NotebookLM button */}
                            {notebookUrl && (
                                <a
                                    href={notebookUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-2 w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold transition-colors"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    在 NotebookLM 中打开
                                </a>
                            )}
                        </div>
                    )}

                    {/* Proxy not available state */}
                    {status === 'error' && error?.includes('代理服务器') && (
                        <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl mt-2">
                            <WifiOff className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs text-amber-700 dark:text-amber-300">
                                    请先启动本地代理服务器:
                                </p>
                                <code className="block mt-1 text-xs bg-amber-100 dark:bg-amber-800/30 px-2 py-1 rounded font-mono">
                                    node scripts/nlm-proxy.mjs
                                </code>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 dark:border-white/10 flex justify-end gap-3">
                    {isWorking && (
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                        >
                            取消
                        </button>
                    )}
                    {(isDone || isError) && (
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-white bg-slate-700 hover:bg-slate-800 rounded-xl transition-colors"
                        >
                            关闭
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
