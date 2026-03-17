/**
 * NotebookLM shared types.
 * These types model the subset of NotebookLM responses that our RAG pipeline uses.
 */

/** Metadata for a single NotebookLM source after import */
export interface NLMSource {
    id: string;
    title: string;
    url?: string;
}

/** Result of a NotebookLM research + import cycle */
export interface NLMResearchResult {
    notebookId: string;
    taskId: string;
    sources: NLMSource[];
}

/** Quality grade for a generated Fact Sheet */
export type FactSheetQuality = 'good' | 'low' | 'insufficient';

/** A Fact Sheet extracted from NotebookLM with quality metadata */
export interface FactSheet {
    content: string;
    citationCount: number;
    quality: FactSheetQuality;
    /** Source titles referenced in the Fact Sheet */
    sourceRefs: string[];
}

/** Status of a long-running NotebookLM operation */
export interface NLMTaskStatus {
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress?: number;
    error?: string;
}

/** Configuration for a NotebookLM RAG request */
export interface NLMRAGRequest {
    /** What to research */
    query: string;
    /** Research mode: fast (~30s) or deep (~5min) */
    mode: 'fast' | 'deep';
    /** Prompt to send to NotebookLM for Fact Sheet generation */
    factSheetPrompt: string;
    /** Optional existing notebook to reuse */
    notebookId?: string;
}
