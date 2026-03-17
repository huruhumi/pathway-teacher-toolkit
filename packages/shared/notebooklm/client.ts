/**
 * NotebookLM client — orchestrates research, import, and query operations.
 *
 * IMPORTANT: This module is for BACKEND USE ONLY. It requires NotebookLM 
 * cookies that must never be exposed to the frontend.
 * 
 * In the current MCP-based workflow, these operations are proxied through
 * the NotebookLM MCP server. This client provides typed wrappers and
 * retry logic on top of those MCP calls.
 */

import type { NLMSource, NLMResearchResult, NLMTaskStatus, NLMRAGRequest, FactSheet } from './types';
import { buildFactSheet, truncateFactSheet, evaluateFactSheetQuality } from './factSheet';

/** Global rate limiter: min 3 seconds between NotebookLM calls */
let lastCallTimestamp = 0;
const MIN_CALL_INTERVAL_MS = 3000;

async function rateLimitedDelay(): Promise<void> {
    const now = Date.now();
    const elapsed = now - lastCallTimestamp;
    if (elapsed < MIN_CALL_INTERVAL_MS) {
        await new Promise(resolve => setTimeout(resolve, MIN_CALL_INTERVAL_MS - elapsed));
    }
    lastCallTimestamp = Date.now();
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a new NotebookLM notebook, or return existing ID if provided.
 */
export async function ensureNotebook(
    createFn: (title: string) => Promise<string>,
    title: string,
    existingId?: string
): Promise<string> {
    if (existingId) return existingId;
    await rateLimitedDelay();
    return createFn(title);
}

/**
 * Run research, poll until complete, and import sources.
 * Returns the imported source list.
 * 
 * @param researchFn - Function to start research (returns taskId)
 * @param pollFn - Function to poll research status
 * @param importFn - Function to import discovered sources
 * @param notebookId - Target notebook
 * @param query - Search query
 * @param mode - 'fast' or 'deep'
 */
export async function researchAndImport(
    researchFn: (notebookId: string, query: string, mode: string) => Promise<string>,
    pollFn: (notebookId: string, taskId: string) => Promise<NLMTaskStatus>,
    importFn: (notebookId: string, taskId: string) => Promise<NLMSource[]>,
    notebookId: string,
    query: string,
    mode: 'fast' | 'deep' = 'fast'
): Promise<NLMResearchResult> {
    await rateLimitedDelay();
    const taskId = await researchFn(notebookId, query, mode);

    // Poll until complete (max 5 minutes for deep, 1 minute for fast)
    const maxWaitMs = mode === 'deep' ? 300000 : 60000;
    const pollIntervalMs = mode === 'deep' ? 15000 : 5000;
    const startTime = Date.now();

    let status: NLMTaskStatus = { status: 'pending' };
    while (Date.now() - startTime < maxWaitMs) {
        await sleep(pollIntervalMs);
        await rateLimitedDelay();
        status = await pollFn(notebookId, taskId);
        if (status.status === 'completed') break;
        if (status.status === 'failed') {
            throw new Error(`NotebookLM research failed: ${status.error || 'Unknown error'}`);
        }
    }

    if (status.status !== 'completed') {
        throw new Error(`NotebookLM research timed out after ${maxWaitMs / 1000}s`);
    }

    // Import all discovered sources
    await rateLimitedDelay();
    const sources = await importFn(notebookId, taskId);

    return { notebookId, taskId, sources };
}

/**
 * Query a NotebookLM notebook and build a quality-gated Fact Sheet.
 * If quality is insufficient and retryWithDeep is true, upgrades to deep mode.
 */
export async function generateFactSheet(
    queryFn: (notebookId: string, prompt: string) => Promise<string>,
    notebookId: string,
    prompt: string,
    sourceTitles: string[],
    maxChars: number = 20000
): Promise<FactSheet> {
    await rateLimitedDelay();
    const rawContent = await queryFn(notebookId, prompt);
    const factSheet = buildFactSheet(rawContent, sourceTitles);
    factSheet.content = truncateFactSheet(factSheet.content, maxChars);
    return factSheet;
}

/**
 * Generate a batch of Fact Sheets for multiple lessons, rate-limited and sequential.
 * This prevents NotebookLM rate limit issues during batch generation.
 */
export async function generateFactSheetBatch(
    queryFn: (notebookId: string, prompt: string) => Promise<string>,
    notebookId: string,
    prompts: string[],
    sourceTitles: string[],
    maxChars: number = 8000,
    onProgress?: (done: number, total: number) => void
): Promise<FactSheet[]> {
    const results: FactSheet[] = [];

    for (let i = 0; i < prompts.length; i++) {
        const factSheet = await generateFactSheet(queryFn, notebookId, prompts[i], sourceTitles, maxChars);
        results.push(factSheet);
        onProgress?.(i + 1, prompts.length);
        // Extra breathing room between batch items
        if (i < prompts.length - 1) {
            await sleep(2000);
        }
    }

    return results;
}
