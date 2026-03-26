/**
 * Hook for exporting handbook pages to NotebookLM as slide decks.
 * 
 * Connects to the local nlm-proxy (localhost:3099) via SSE, spawns the 
 * Python export worker, and streams real-time progress.
 */

import { useState, useCallback, useRef } from 'react';
import type { FactSheetFreshnessMeta } from '../types';

const PROXY_URL = 'http://localhost:3099';

export type ExportStatus =
    | 'idle'
    | 'connecting'
    | 'authenticating'
    | 'creating_notebook'
    | 'uploading_sources'
    | 'generating_slides'
    | 'done'
    | 'error';

export interface ExportProgress {
    status: ExportStatus;
    progress: number; // 0 - 1
    message: string;
    notebookId?: string;
    notebookUrl?: string;
    slideDecks?: Array<{
        title: string;
        status: 'queued' | 'failed';
        error?: string;
    }>;
    stats?: {
        factSheetSources: number;
        structureSources: number;
        handbookSources: number;
        slideDecksQueued: number;
        slideDecksFailed: number;
    };
    error?: string;
}

interface AuthCheckResult {
    ok?: boolean;
    needsLogin?: boolean;
    message?: string;
    details?: any;
}

const INITIAL: ExportProgress = {
    status: 'idle',
    progress: 0,
    message: '',
};

async function fetchWithTimeout(
    input: RequestInfo | URL,
    init: RequestInit = {},
    timeoutMs = 5000,
): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(input, { ...init, signal: controller.signal });
    } finally {
        clearTimeout(timeoutId);
    }
}

function isNotebookLMAuthError(text: string): boolean {
    const value = (text || '').toLowerCase();
    return (
        value.includes('authentication expired')
        || value.includes('redirected to:')
        || value.includes('accounts.google.com')
        || (value.includes('auth') && value.includes('invalid'))
    );
}

function normalizeExportErrorMessage(raw: string): string {
    if (isNotebookLMAuthError(raw)) {
        return 'NotebookLM 登录已过期，请在终端执行: notebooklm login，然后重试导出。';
    }
    return raw || '导出失败';
}

export interface HandbookPage {
    title?: string;
    section?: string;
    pageType?: string;
    contentPrompt?: string;
    teacherContentPrompt?: string;
    visualPrompt?: string;
    layoutDescription?: string;
    [key: string]: any;
}

export function useSlideExport() {
    const [exportState, setExportState] = useState<ExportProgress>(INITIAL);
    const abortRef = useRef<AbortController | null>(null);

    /** Check if the local proxy is reachable */
    const isProxyAvailable = useCallback(async (): Promise<boolean> => {
        try {
            const resp = await fetchWithTimeout(PROXY_URL, {
                method: 'OPTIONS',
            }, 2500);
            return resp.ok || resp.status === 204;
        } catch { /* continue */ }

        try {
            const resp = await fetchWithTimeout(PROXY_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'auth-check' }),
            }, 4500);
            if (resp.status >= 200 && resp.status < 500) return true;
        } catch { /* continue */ }

        try {
            const resp = await fetchWithTimeout(PROXY_URL, { method: 'GET' }, 3000);
            if (resp.status >= 200 && resp.status < 500) return true;
        } catch { /* continue */ }

        return false;
    }, []);

    /** Preflight NotebookLM auth to fail fast before export starts */
    const checkNotebookLMAuth = useCallback(async (): Promise<void> => {
        try {
            const resp = await fetchWithTimeout(PROXY_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'auth-check' }),
            }, 12000);
            if (!resp.ok) return;
            let data: AuthCheckResult | null = null;
            try {
                data = (await resp.json()) as AuthCheckResult;
            } catch {
                data = null;
            }
            if (data?.ok === false && data?.needsLogin) {
                throw new Error(data.message || 'NotebookLM 登录已过期，请在终端执行: notebooklm login，然后重试导出。');
            }
        } catch (err: any) {
            const msg = String(err?.message || '');
            if (
                msg.includes('notebooklm login')
                || msg.toLowerCase().includes('auth')
                || msg.toLowerCase().includes('authentication')
            ) {
                throw err;
            }
            // Non-auth preflight errors should not block export.
            console.warn('[Export] auth preflight skipped:', msg);
        }
    }, []);

    /** Start the export pipeline */
    const startExport = useCallback(async (
        title: string,
        handbookPages: HandbookPage[],
        stylePrompt: string,
        language: 'en' | 'zh',
        mode: 'school' | 'family',
        versionPref: 'detailed' | 'simple' | 'both',
        factSheet?: string | null,
        factSheetMeta?: FactSheetFreshnessMeta | null,
        structurePlan?: string | null,
        roadmapJson?: string | null,
    ) => {
        // Cleanup previous
        if (abortRef.current) abortRef.current.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setExportState({
            status: 'connecting',
            progress: 0,
            message: '正在连接本地代理服务器...',
        });

        try {
            setExportState({
                status: 'authenticating',
                progress: 0.04,
                message: '正在检查 NotebookLM 登录状态...',
            });
            await checkNotebookLMAuth();

            console.log('[Export] Sending POST to proxy...');
            const resp = await fetch(PROXY_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'export-slides',
                    title,
                    handbookPages,
                    stylePrompt,
                    factSheet: factSheet || null,
                    factSheetMeta: factSheetMeta || null,
                    structurePlan: structurePlan || null,
                    language,
                    mode,
                    versionPref,
                    roadmapJson: roadmapJson || null,
                }),
                signal: controller.signal,
            });

            console.log('[Export] Proxy responded:', resp.status, resp.statusText);

            if (!resp.ok) {
                const err = await resp.text();
                const friendlyErr = normalizeExportErrorMessage(err);
                throw new Error(friendlyErr);
                throw new Error(`代理服务器错误: ${err}`);
            }

            // Read SSE stream
            const reader = resp.body?.getReader();
            if (!reader) throw new Error('无法读取 SSE 流');

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    console.log('[Export] SSE stream ended');
                    break;
                }

                buffer += decoder.decode(value, { stream: true });

                // Parse SSE events
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line in buffer

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6)) as ExportProgress;
                            if (data.status === 'error') {
                                const mergedRaw = [data.error, data.message].filter(Boolean).join(' | ');
                                const friendly = normalizeExportErrorMessage(mergedRaw);
                                data.error = friendly;
                                data.message = friendly;
                            }
                            console.log('[Export] SSE data:', data.status, data.message);
                            setExportState(data);
                        } catch { /* ignore malformed JSON */ }
                    }
                }
            }
        } catch (err: any) {
            console.error('[Export] Error:', err);
            if (err.name === 'AbortError') {
                setExportState({ status: 'idle', progress: 0, message: '已取消' });
            } else {
                err.message = normalizeExportErrorMessage(err.message || '');
                setExportState({
                    status: 'error',
                    progress: 0,
                    message: err.message || '导出失败',
                    error: normalizeExportErrorMessage(err.message || ''),
                });
            }
        }
    }, [checkNotebookLMAuth]);

    /** Cancel ongoing export */
    const cancelExport = useCallback(() => {
        if (abortRef.current) {
            abortRef.current.abort();
            abortRef.current = null;
        }
        setExportState(INITIAL);
    }, []);

    /** Reset to idle */
    const resetExport = useCallback(() => {
        setExportState(INITIAL);
    }, []);

    return {
        exportState,
        startExport,
        cancelExport,
        resetExport,
        isProxyAvailable,
    };
}
