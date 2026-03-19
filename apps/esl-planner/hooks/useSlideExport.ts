/**
 * Hook for exporting ESL lesson slides to NotebookLM as slide decks.
 *
 * Connects to the local nlm-proxy (localhost:3099) via SSE, spawns the
 * Python export worker, and streams real-time progress.
 */

import { useState, useCallback, useRef } from 'react';
import type { Slide } from '../types';

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

const INITIAL: ExportProgress = {
    status: 'idle',
    progress: 0,
    message: '',
};

/** Map ESL Slide[] to HandbookPage[] format for the Python export worker */
function slidesToHandbookPages(slides: Slide[]): any[] {
    return slides.map((slide, i) => ({
        title: slide.title || `Slide ${i + 1}`,
        section: `Slide ${i + 1}`,
        pageType: 'Slide',
        contentPrompt: slide.content || '',
        visualPrompt: slide.visual || '',
        layoutDescription: slide.layoutDesign || '',
    }));
}

export function useSlideExport() {
    const [exportState, setExportState] = useState<ExportProgress>(INITIAL);
    const abortRef = useRef<AbortController | null>(null);

    /** Check if the local proxy is reachable */
    const isProxyAvailable = useCallback(async (): Promise<boolean> => {
        try {
            const resp = await fetch(PROXY_URL, {
                method: 'OPTIONS',
                signal: AbortSignal.timeout(2000),
            });
            return resp.ok || resp.status === 204;
        } catch {
            return false;
        }
    }, []);

    /** Start the export pipeline */
    const startExport = useCallback(async (
        title: string,
        slides: Slide[],
        stylePrompt: string,
        factSheet?: string | null,
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
            const handbookPages = slidesToHandbookPages(slides);
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
                    structurePlan: null,
                    language: 'en',
                    mode: 'school',
                    versionPref: 'detailed',
                    roadmapJson: null,
                }),
                signal: controller.signal,
            });

            console.log('[Export] Proxy responded:', resp.status, resp.statusText);

            if (!resp.ok) {
                const err = await resp.text();
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
                setExportState({
                    status: 'error',
                    progress: 0,
                    message: err.message || '导出失败',
                    error: err.message,
                });
            }
        }
    }, []);

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
