/**
 * Shared viewer shell for the print-preview window.
 * Extracted from useExportUtils.openViewer to DRY the 80-line HTML wrapper.
 */

export function wrapViewerHtml(title: string, contentHtml: string, logoDataUri?: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          body { 
            font-family: 'Inter', sans-serif; 
            background-color: #fff; 
            color: #1f2937; 
            padding: 2rem; 
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .viewer-container { max-width: 64rem; margin: 0 auto; }
          .print-header { 
            position: sticky; 
            top: 0; 
            background: rgba(255,255,255,0.9); 
            backdrop-filter: blur(8px);
            margin: -2rem -2rem 2rem -2rem;
            padding: 1rem 2rem;
            border-bottom: 1px solid #eee;
            display: flex;
            justify-content: space-between;
            align-items: center;
            z-index: 100;
          }

          .viewer-title-logo { width: 36px; height: 36px; object-fit: contain; flex-shrink: 0; }
          @media print { 
            .no-print { display: none !important; } 
            body { padding: 0; } 
            .print-header { display: none; }
            .page-break { page-break-before: always; }
            .print-row { break-inside: avoid; }
            .print-section-header { break-inside: avoid; break-after: avoid; }
            p, li, .flex { orphans: 2; widows: 2; }
            .flex-col { flex-direction: column !important; }
            .md\\:flex-row { flex-direction: column !important; }
            .w-full { width: 100% !important; }
            .md\\:w-1\\/3 { width: 100% !important; }
            .viewer-mc-grid {
              display: grid !important;
              grid-template-columns: repeat(4, 1fr) !important;
              width: 100% !important;
            }
            .viewer-error-correction-passage {
              background-image: linear-gradient(#eee 1px, transparent 1px) !important;
              background-size: 100% 3.5rem !important;
              background-position: 0 3.2rem !important;
              line-height: 3.5 !important;
            }

          }
          .viewer-error-correction-passage {
            background-image: linear-gradient(#f1f5f9 1px, transparent 1px);
            background-size: 100% 3.5rem;
            background-position: 0 3.2rem;
          }
        </style>
      </head>
      <body>

        <div class="print-header no-print">
          <div class="flex items-center gap-3">
            <div class="bg-indigo-600 p-2 rounded-lg text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/><path d="M12 6v6l4 2"/></svg>
            </div>
            <span class="font-bold text-gray-800">Viewer Mode</span>
          </div>
          <button onclick="window.print()" class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-bold shadow-lg transition-all flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
            Print / Save PDF
          </button>
        </div>
        <div class="viewer-container">
          ${contentHtml}
        </div>
      </body>
    </html>
  `;
}
