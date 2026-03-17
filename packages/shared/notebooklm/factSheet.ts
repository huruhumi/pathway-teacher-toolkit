/**
 * NotebookLM Fact Sheet generator with quality gating.
 * 
 * Generates grounded fact sheets from a NotebookLM notebook,
 * then evaluates quality by counting citation references [n].
 */

import type { FactSheet, FactSheetQuality } from './types';

/** Minimum citation count to consider a Fact Sheet "good" */
const MIN_GOOD_CITATIONS = 5;

/**
 * Evaluate the quality of a fact sheet based on citation density.
 */
export function evaluateFactSheetQuality(content: string): { quality: FactSheetQuality; citationCount: number } {
    // Count unique [n] style citations
    const citations = content.match(/\[\d+\]/g) || [];
    const uniqueCitations = new Set(citations);
    const citationCount = uniqueCitations.size;

    let quality: FactSheetQuality;
    if (citationCount >= MIN_GOOD_CITATIONS) {
        quality = 'good';
    } else if (citationCount >= 2) {
        quality = 'low';
    } else {
        quality = 'insufficient';
    }

    return { quality, citationCount };
}

/**
 * Extract source reference titles from citation markers.
 * e.g. "[来源: 盘龙城遗址简介]" → ["盘龙城遗址简介"]
 */
export function extractSourceRefs(content: string): string[] {
    const refs = content.match(/\[来源:\s*([^\]]+)\]/g) || [];
    return refs.map(r => r.replace(/\[来源:\s*/, '').replace(/\]$/, '').trim());
}

/**
 * Expand numeric citation markers [1], [2] with source titles.
 * Useful for making fact sheets meaningful when passed to Gemini.
 */
export function expandCitations(content: string, sourceTitles: string[]): string {
    return content.replace(/\[(\d+)\]/g, (match, num) => {
        const idx = parseInt(num, 10) - 1;
        if (idx >= 0 && idx < sourceTitles.length) {
            return `[来源: ${sourceTitles[idx]}]`;
        }
        return match; // keep original if no matching source
    });
}

/**
 * Build a FactSheet object from raw content and source list.
 */
export function buildFactSheet(rawContent: string, sourceTitles: string[]): FactSheet {
    const expanded = expandCitations(rawContent, sourceTitles);
    const { quality, citationCount } = evaluateFactSheetQuality(expanded);
    const sourceRefs = extractSourceRefs(expanded);

    return {
        content: expanded,
        citationCount,
        quality,
        sourceRefs,
    };
}

/**
 * Truncate a fact sheet to stay within context budget.
 * Preserves complete paragraphs up to maxChars.
 */
export function truncateFactSheet(content: string, maxChars: number = 20000): string {
    if (content.length <= maxChars) return content;

    const truncated = content.slice(0, maxChars);
    // Cut at last complete paragraph
    const lastParagraph = truncated.lastIndexOf('\n\n');
    if (lastParagraph > maxChars * 0.7) {
        return truncated.slice(0, lastParagraph) + '\n\n[... 内容已截断，完整版请参考 NotebookLM]';
    }
    return truncated + '\n\n[... 内容已截断]';
}
