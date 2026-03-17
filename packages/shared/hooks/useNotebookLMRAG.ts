/**
 * Hook for triggering NotebookLM RAG research workflow.
 *
 * Supports two backends:
 * - "local": local proxy at localhost:3099 (deep/multi-pass)
 * - "cloud": Supabase Edge Function (single-pass)
 */

import { useCallback, useRef, useState } from 'react';
import { isSupabaseEnabled, supabase } from '@shared/services/supabaseClient';

export type RAGBackend = 'local' | 'cloud';
export type RAGStatus = 'idle' | 'researching' | 'generating' | 'done' | 'error';

export interface FactSheet {
    content: string;
    citationCount: number;
    quality: 'good' | 'low' | 'insufficient';
    sourceRefs: string[];
}

export interface RAGProgress {
    status: RAGStatus;
    message: string;
    progress: number;
    factSheets: Map<number, FactSheet>;
    validUrls: string[];
    sources: Array<{ id?: string; title?: string; url?: string; status?: string; type?: string }>;
    error?: string;
    notebookId?: string;
}

export interface StartRAGOptions {
    notebookId?: string;
    tolerateErrors?: boolean;
    allowEmptyFactSheets?: boolean;
}

const LOCAL_PROXY_URL = 'http://localhost:3099';

const INITIAL_PROGRESS: RAGProgress = {
    status: 'idle',
    message: '',
    progress: 0,
    factSheets: new Map(),
    validUrls: [],
    sources: [],
};

async function callCloud(payload: Record<string, unknown>): Promise<any> {
    if (!supabase) throw new Error('Supabase is not configured.');

    const { data, error } = await supabase.functions.invoke('nlm-research', {
        body: payload,
    });

    if (error) throw new Error(`Edge Function: ${error.message}`);
    if (data?.error) throw new Error(`Cloud RAG: ${data.error}`);
    return data;
}

async function callLocal(payload: Record<string, unknown>): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15 * 60 * 1000);

    try {
        const response = await fetch(LOCAL_PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });

        const data = await response.json();
        if (!response.ok) {
            const err = new Error(data.error || response.statusText) as Error & { notebookId?: string };
            err.notebookId = data.notebookId || '';
            throw err;
        }

        return data;
    } finally {
        clearTimeout(timeoutId);
    }
}

async function isLocalProxyRunning(): Promise<boolean> {
    try {
        const response = await fetch(LOCAL_PROXY_URL, {
            method: 'OPTIONS',
            signal: AbortSignal.timeout(1000),
        });
        return response.ok || response.status === 204;
    } catch {
        return false;
    }
}

function toFactSheetMap(factSheets: FactSheet[] = []): Map<number, FactSheet> {
    const factSheetMap = new Map<number, FactSheet>();
    factSheets.forEach((factSheet, index) => factSheetMap.set(index, factSheet));
    return factSheetMap;
}

function toValidUrls(sources: Array<{ url?: string }> = []): string[] {
    return sources.map((source) => source.url).filter((url): url is string => Boolean(url));
}

export function useNotebookLMRAG() {
    const [ragProgress, setRagProgress] = useState<RAGProgress>(INITIAL_PROGRESS);
    const cancelRef = useRef(false);

    const isRAGAvailable = useCallback((): boolean => isSupabaseEnabled(), []);

    const checkBackends = useCallback(async (): Promise<{ local: boolean; cloud: boolean }> => {
        const [local, cloud] = await Promise.all([
            isLocalProxyRunning(),
            Promise.resolve(isSupabaseEnabled()),
        ]);
        return { local, cloud };
    }, []);

    const startRAG = useCallback(async (
        topic: string,
        lessonPrompts: string[],
        backend: RAGBackend = 'cloud',
        options: StartRAGOptions = {},
    ): Promise<RAGProgress> => {
        cancelRef.current = false;

        const {
            notebookId,
            tolerateErrors = false,
            allowEmptyFactSheets = false,
        } = options;

        setRagProgress({
            status: 'researching',
            message: backend === 'local'
                ? 'Running deep research...'
                : 'Running quick research...',
            progress: 0.1,
            factSheets: new Map(),
            validUrls: [],
            sources: [],
            notebookId,
        });

        try {
            const callFn = backend === 'local' ? callLocal : callCloud;
            const canResume = Boolean(notebookId);
            const payload = canResume
                ? { action: 'notebook-query', notebookId, lessonPrompts }
                : { action: 'full-pipeline', topic, lessonPrompts };

            const result = await callFn(payload);

            if (cancelRef.current) throw new DOMException('Cancelled', 'AbortError');

            const factSheetMap = toFactSheetMap(result.factSheets || []);
            const validUrls = toValidUrls(result.sources || []);
            const sources = Array.isArray(result.sources) ? result.sources : [];
            const resolvedNotebookId = result.notebookId || (canResume ? notebookId : undefined);

            if (!allowEmptyFactSheets && factSheetMap.size === 0) {
                throw new Error('No fact sheets were generated for this request.');
            }

            const finalProgress: RAGProgress = {
                status: 'done',
                message: `Research complete: ${factSheetMap.size} fact sheet(s), ${validUrls.length} source URL(s).`,
                progress: 1,
                factSheets: factSheetMap,
                validUrls,
                sources,
                notebookId: resolvedNotebookId,
            };

            setRagProgress(finalProgress);
            return finalProgress;
        } catch (error: any) {
            if (error?.name === 'AbortError') {
                const cancelledProgress: RAGProgress = {
                    ...INITIAL_PROGRESS,
                    message: 'Research cancelled.',
                };
                setRagProgress(cancelledProgress);
                return cancelledProgress;
            }

            const errorMessage = error?.message || 'Unknown RAG error';
            const resolvedNotebookId = error?.notebookId || (notebookId ? notebookId : undefined);

            if (tolerateErrors) {
                const degradedProgress: RAGProgress = {
                    status: 'done',
                    message: `Research unavailable, continuing with unverified grounding. ${errorMessage}`,
                    progress: 1,
                    factSheets: new Map(),
                    validUrls: [],
                    sources: [],
                    error: errorMessage,
                    notebookId: resolvedNotebookId,
                };
                setRagProgress(degradedProgress);
                return degradedProgress;
            }

            const errorProgress: RAGProgress = {
                status: 'error',
                message: `Research failed: ${errorMessage}`,
                progress: 0.1,
                factSheets: new Map(),
                validUrls: [],
                sources: [],
                error: errorMessage,
                notebookId: resolvedNotebookId,
            };
            setRagProgress(errorProgress);
            return errorProgress;
        }
    }, []);

    const resumeRAG = useCallback(async (
        notebookId: string,
        lessonPrompts: string[],
    ): Promise<RAGProgress> => {
        setRagProgress({
            status: 'researching',
            message: 'Resuming existing notebook research...',
            progress: 0.3,
            factSheets: new Map(),
            validUrls: [],
            sources: [],
            notebookId,
        });

        try {
            const result = await callLocal({
                action: 'resume',
                notebookId,
                lessonPrompts,
            });

            const factSheetMap = toFactSheetMap(result.factSheets || []);
            const validUrls = toValidUrls(result.sources || []);
            const sources = Array.isArray(result.sources) ? result.sources : [];

            const finalProgress: RAGProgress = {
                status: 'done',
                message: `Resume complete: ${factSheetMap.size} fact sheet(s), ${validUrls.length} source URL(s).`,
                progress: 1,
                factSheets: factSheetMap,
                validUrls,
                sources,
                notebookId,
            };
            setRagProgress(finalProgress);
            return finalProgress;
        } catch (error: any) {
            const errorProgress: RAGProgress = {
                status: 'error',
                message: `Resume failed: ${error?.message || 'Unknown error'}`,
                progress: 0.3,
                factSheets: new Map(),
                validUrls: [],
                sources: [],
                error: error?.message,
                notebookId,
            };
            setRagProgress(errorProgress);
            return errorProgress;
        }
    }, []);

    const cancelRAG = useCallback(() => {
        cancelRef.current = true;
    }, []);

    const resetRAG = useCallback(() => {
        setRagProgress(INITIAL_PROGRESS);
    }, []);

    /** Ensure a "📚 资源调用指南" source exists in the notebook. */
    const ensureResourceGuide = useCallback(async (
        notebookId: string,
        userInput?: { level?: string; duration?: string; studentCount?: string; lessonCount?: number; customInstructions?: string },
    ): Promise<{ status: string; sourceId?: string; error?: string }> => {
        try {
            const result = await callLocal({
                action: 'ensure-resource-guide',
                notebookId,
                userInput,
            });
            return result;
        } catch (error: any) {
            console.warn('[ensureResourceGuide] Failed:', error?.message);
            return { status: 'error', error: error?.message || 'Unknown error' };
        }
    }, []);

    return {
        ragProgress,
        startRAG,
        resumeRAG,
        cancelRAG,
        resetRAG,
        ensureResourceGuide,
        isRAGAvailable,
        checkBackends,
    };
}
