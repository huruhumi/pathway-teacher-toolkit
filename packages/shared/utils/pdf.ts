/**
 * Extract text from a PDF file using pdf.js (loaded from CDN).
 * Returns the full text and page count.
 * Consolidates identical implementations from esl-planner and nature-compass CurriculumPlanner.
 */
export async function extractPdfText(file: File): Promise<{ text: string; pageCount: number }> {
    // @ts-ignore - loaded from CDN
    const pdfjsLib = await import(/* @vite-ignore */ 'https://esm.sh/pdfjs-dist@4.10.38');
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map((item: any) => item.str).join(' ');
        fullText += `\n--- Page ${i} ---\n${pageText}`;
    }

    return { text: fullText.trim(), pageCount: pdf.numPages };
}
