/**
 * Shared NotebookLM utilities.
 * 
 * Re-exports types, client functions, and fact sheet tools
 * for use across Nature Compass and ESL Planner.
 */

// Types
export type {
    NLMSource,
    NLMResearchResult,
    NLMTaskStatus,
    NLMRAGRequest,
    FactSheet,
    FactSheetQuality,
} from './types';

// Fact Sheet utilities (safe for frontend + backend)
export {
    evaluateFactSheetQuality,
    extractSourceRefs,
    expandCitations,
    buildFactSheet,
    truncateFactSheet,
} from './factSheet';

// Client operations (backend only — requires cookies)
export {
    ensureNotebook,
    researchAndImport,
    generateFactSheet,
    generateFactSheetBatch,
} from './client';

// Auth (backend only)
export {
    loadAuthConfig,
    requireAuth,
} from './auth';
export type { NLMAuthConfig } from './auth';
