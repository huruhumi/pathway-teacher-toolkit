import { useLessonStore } from '../stores/useLessonStore';

export const usePrintUtils = (activeTab: string, t: (key: string) => string) => {
    const {
        vocabList,
        generatedImages,
        basicInfo,
        missionBriefing,
        roadmap,
        durationDisplay,
        supplies,
        safetyProtocol,
        visualRefs,
        generatedVisuals,
        handbookPages,
        badgeImage
    } = useLessonStore();

    const handleDownloadFlashcard = (index: number) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const vocab = vocabList[index];
        const image = generatedImages[index];
        const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Flashcard - ${vocab.word}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;800&display=swap" rel="stylesheet">
        <style>
          @page { size: A4 landscape; margin: 0; }
          body { 
            margin: 0; 
            font-family: 'Inter', sans-serif; 
            -webkit-print-color-adjust: exact; 
          }
          .page { 
            width: 297mm; 
            height: 210mm; 
            display: flex; 
            flex-direction: column; 
            justify-content: center; 
            align-items: center; 
            page-break-after: always; 
            position: relative;
            background: white;
            padding: 20mm;
            box-sizing: border-box;
          }
          .image-container {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          img { 
            max-width: 100%; 
            max-height: 100%; 
            object-fit: contain; 
            border-radius: 4mm;
          }
          .text-container {
             text-align: center;
             display: flex;
             flex-direction: column;
             align-items: center;
             justify-content: center;
             height: 100%;
             padding: 20mm;
          }
          h1 { 
            font-size: 8rem; 
            font-weight: 800; 
            color: #1e293b; 
            margin: 0 0 1rem 0; 
            line-height: 1;
            letter-spacing: -0.02em;
          }
          p { 
            font-size: 2.5rem; 
            color: #64748b; 
            max-width: 80%;
            margin: 0;
            line-height: 1.4;
          }
          .label {
            position: absolute;
            bottom: 15mm;
            right: 15mm;
            font-size: 0.8rem;
            color: #94a3b8;
            font-weight: 500;
          }
        </style>
      </head>
      <body>
         <div class="page">
          <div class="image-container">
             ${image ? `<img src="${image}" />` : '<div style="font-size: 2rem; color: #cbd5e1; font-weight: bold; border: 2px dashed #e2e8f0; padding: 2rem; border-radius: 1rem;">No Image Generated</div>'}
          </div>
          <div class="label">Front: Image (${vocab.word})</div>
        </div>
        
        <div class="page">
          <div class="text-container">
            <h1>${vocab.word}</h1>
            <p>${vocab.definition}</p>
          </div>
          <div class="label">Back: Definition</div>
        </div>
        <script>
            window.onload = () => {
                setTimeout(() => {
                    window.print();
                }, 500);
            };
        </script>
      </body>
      </html>
    `;
        printWindow.document.write(html);
        printWindow.document.close();
    };

    const handleDownloadAllFlashcards = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const pagesHtml = vocabList.map((vocab, index) => {
            const image = generatedImages[index];
            return `
        <!-- Card ${index + 1} Front -->
        <div class="page">
          <div class="image-container">
             ${image ? `<img src="${image}" />` : '<div style="font-size: 2rem; color: #cbd5e1; font-weight: bold; border: 2px dashed #e2e8f0; padding: 2rem; border-radius: 1rem;">No Image Generated</div>'}
          </div>
          <div class="label">Front: Image (${vocab.word})</div>
        </div>
        
        <!-- Card ${index + 1} Back -->
        <div class="page">
          <div class="text-container">
            <h1>${vocab.word}</h1>
            <p>${vocab.definition}</p>
          </div>
          <div class="label">Back: Definition</div>
        </div>
        `;
        }).join('');

        const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>All Flashcards - ${basicInfo.theme}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;800&display=swap" rel="stylesheet">
        <style>
          @page { size: A4 landscape; margin: 0; }
          body { 
            margin: 0; 
            font-family: 'Inter', sans-serif; 
            -webkit-print-color-adjust: exact; 
          }
          .page { 
            width: 297mm; 
            height: 210mm; 
            display: flex; 
            flex-direction: column; 
            justify-content: center; 
            align-items: center; 
            page-break-after: always; 
            position: relative;
            background: white;
            padding: 20mm;
            box-sizing: border-box;
          }
          .image-container {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          img { 
            max-width: 100%; 
            max-height: 100%; 
            object-fit: contain; 
            border-radius: 4mm;
          }
          .text-container {
             text-align: center;
             display: flex;
             flex-direction: column;
             align-items: center;
             justify-content: center;
             height: 100%;
             padding: 20mm;
          }
          h1 { 
            font-size: 8rem; 
            font-weight: 800; 
            color: #1e293b; 
            margin: 0 0 1rem 0; 
            line-height: 1;
            letter-spacing: -0.02em;
          }
          p { 
            font-size: 2.5rem; 
            color: #64748b; 
            max-width: 80%;
            margin: 0;
            line-height: 1.4;
          }
          .label {
            position: absolute;
            bottom: 15mm;
            right: 15mm;
            font-size: 0.8rem;
            color: #94a3b8;
            font-weight: 500;
          }
          @media print {
            body { margin: 0; }
          }
        </style>
      </head>
      <body>
        ${pagesHtml}
        <script>
            window.onload = () => {
                setTimeout(() => {
                    window.print();
                }, 1000);
            };
        </script>
      </body>
      </html>
    `;

        printWindow.document.write(html);
        printWindow.document.close();
    };

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        // Common Header
        const headerHtml = `
      <div class="mb-6 p-5 bg-slate-50 rounded-xl border border-slate-100">
        <h1 class="text-2xl font-bold text-slate-900 mb-2">${missionBriefing.title}</h1>
        <p class="text-base text-slate-600 italic">${missionBriefing.narrative}</p>
      </div>
    `;

        let bodyContent = '';

        if (activeTab === 'roadmap') {
            const goalsHtml = basicInfo.learningGoals.map(g =>
                `<li class="flex items-start gap-2 mb-2"><span class="text-emerald-500 font-bold">•</span><span>${g}</span></li>`
            ).join('');

            const roadmapHtml = roadmap.map(item => {
                const stepsHtml = item.steps.map((s, i) =>
                    `<li class="flex gap-3 mb-2">
                    <span class="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold border border-slate-200">${i + 1}</span>
                    <span class="text-slate-700">${s}</span>
                </li>`
                ).join('');

                const backgroundInfoHtml = (item.backgroundInfo && item.backgroundInfo.length > 0)
                    ? `<div class="bg-blue-50 p-3 rounded-lg border border-blue-100 mb-4">
                     <h4 class="text-xs font-bold text-blue-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                        Background Info
                     </h4>
                     <ul class="text-sm text-blue-900 list-disc list-inside">
                        ${item.backgroundInfo.map(el => `<li>${el}</li>`).join('')}
                     </ul>
                   </div>`
                    : '';

                const teachingTipsHtml = (item.teachingTips && item.teachingTips.length > 0)
                    ? `<div class="bg-purple-50 p-3 rounded-lg border border-purple-100 mb-4">
                     <h4 class="text-xs font-bold text-purple-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                        Teaching Tips
                     </h4>
                     <ul class="text-sm text-purple-900 list-disc list-inside">
                        ${item.teachingTips.map(el => `<li>${el}</li>`).join('')}
                     </ul>
                   </div>`
                    : '';

                return `
                <div class="mb-8 pl-4 border-l-2 border-emerald-200 relative">
                    <div class="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-emerald-500 ring-4 ring-white"></div>
                    <div class="flex items-baseline gap-4 mb-2">
                        <span class="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded">${item.timeRange}</span>
                        <h3 class="text-lg font-bold text-slate-800">${item.phase} <span class="text-slate-300 font-light mx-2">/</span> ${item.activity}</h3>
                    </div>
                     <div class="flex gap-4 mb-3 text-sm">
                        <span class="px-2 py-1 bg-blue-50 text-blue-700 rounded border border-blue-100 font-semibold">${item.activityType || 'Activity'}</span>
                        <span class="px-2 py-1 bg-emerald-50 text-emerald-700 rounded border border-emerald-100 font-semibold">${item.location || 'Location'}</span>
                        <span class="px-2 py-1 bg-amber-50 text-amber-700 rounded border border-amber-100 italic">Goal: ${item.learningObjective || 'Standard'}</span>
                     </div>
                    <p class="text-slate-600 italic mb-4">${item.description}</p>
                    ${backgroundInfoHtml}
                    ${teachingTipsHtml}
                    <div class="bg-slate-50 p-4 rounded-lg border border-slate-100">
                        <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">${t('print.instructions')}</h4>
                        <ul class="text-sm">${stepsHtml}</ul>
                    </div>
                </div>
            `;
            }).join('');

            bodyContent = `
            <div class="mb-8">
                <h2 class="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">${t('print.workshopOverview')}</h2>
                <div class="grid grid-cols-2 gap-4 mb-6 text-sm">
                    <div class="p-3 border rounded">
                        <div class="text-slate-400 text-xs uppercase font-bold">${t('print.theme')}</div>
                        <div class="font-semibold">${basicInfo.theme}</div>
                    </div>
                    <div class="p-3 border rounded">
                        <div class="text-slate-400 text-xs uppercase font-bold">${t('print.type')}</div>
                        <div class="font-semibold">${basicInfo.activityType}</div>
                    </div>
                    <div class="p-3 border rounded">
                        <div class="text-slate-400 text-xs uppercase font-bold">${t('print.audience')}</div>
                        <div class="font-semibold">${basicInfo.targetAudience}</div>
                    </div>
                    <div class="p-3 border rounded">
                        <div class="text-slate-400 text-xs uppercase font-bold">Timing</div>
                        <div class="font-semibold">${durationDisplay}</div>
                    </div>
                </div>
                <div class="mb-6">
                    <h3 class="text-sm font-bold text-slate-500 uppercase mb-2">Learning Goals</h3>
                    <ul class="bg-white border rounded-xl p-4 text-sm">${goalsHtml}</ul>
                </div>
                <div class="mb-6">
                    <h3 class="text-sm font-bold text-slate-500 uppercase mb-2">Location</h3>
                    <div class="p-3 border rounded bg-white font-semibold text-sm">${basicInfo.location}</div>
                </div>
            </div>
            <div class="mt-8">
                 <h2 class="text-lg font-bold text-slate-800 mb-6 pb-2 border-b">Agenda & Steps</h2>
                 ${roadmapHtml}
            </div>
        `;
        } else if (activeTab === 'supplies') {
            const permanentHtml = supplies.permanent.map(i => `<li>${i}</li>`).join('');
            const consumablesHtml = supplies.consumables.map(i => `<li>${i}</li>`).join('');
            const safetyHtml = safetyProtocol.map(s => `<li class="mb-1">${s}</li>`).join('');

            bodyContent = `
            <div class="grid grid-cols-1 gap-8">
               <div class="p-5 border rounded-xl">
                   <h2 class="text-lg font-bold text-slate-800 mb-4">Supply List</h2>
                   <div class="mb-4">
                       <h3 class="font-bold text-slate-500 text-sm uppercase mb-2">Permanent Tools</h3>
                       <ul class="list-disc list-inside text-slate-700 space-y-1">${permanentHtml}</ul>
                   </div>
                   <div>
                       <h3 class="font-bold text-slate-500 text-sm uppercase mb-2">Consumables</h3>
                       <ul class="list-disc list-inside text-slate-700 space-y-1">${consumablesHtml}</ul>
                   </div>
               </div>
               <div class="p-5 border rounded-xl bg-amber-50 border-amber-100">
                   <h2 class="text-lg font-bold text-amber-900 mb-4">Safety Protocol</h2>
                   <ol class="list-decimal list-inside text-amber-800 space-y-2">${safetyHtml}</ol>
               </div>
            </div>
       `;
        } else if (activeTab === 'flashcards') {
            const cardsHtml = vocabList.map((v, idx) =>
                `<div class="border rounded p-4 text-center break-inside-avoid">
                ${generatedImages[idx] ? `<img src="${generatedImages[idx]}" style="max-width:100%; height:auto; margin-bottom: 1rem; border-radius: 0.5rem;" />` : ''}
                <h3 class="text-lg font-bold mb-2">${v.word}</h3>
                <p class="text-sm italic text-slate-600">${v.definition}</p>
             </div>`
            ).join('');

            bodyContent = `
            <div class="space-y-8">
                <div class="p-5 border rounded-xl">
                     <h2 class="text-lg font-bold text-slate-800 mb-4">Teaching Flashcards</h2>
                     <div class="grid grid-cols-3 gap-4">
                        ${cardsHtml}
                     </div>
                </div>
            </div>
         `;
        } else if (activeTab === 'visuals') {
            const visualsHtml = visualRefs.map((v, idx) =>
                `<div class="border rounded p-4 text-center break-inside-avoid">
               ${generatedVisuals[idx] ? `<img src="${generatedVisuals[idx]}" style="max-width:100%; height:auto; margin-bottom: 1rem; border-radius: 0.5rem;" />` : ''}
               <h3 class="text-lg font-bold mb-1">${v.label}</h3>
               <div class="text-xs uppercase font-bold text-slate-400 mb-2">${v.type}</div>
               <p class="text-sm text-slate-600">${v.description}</p>
            </div>`
            ).join('');

            bodyContent = `
           <div class="space-y-8">
               <div class="p-5 border rounded-xl">
                    <h2 class="text-lg font-bold text-slate-800 mb-4">Visual References</h2>
                    <div class="grid grid-cols-2 gap-4">
                       ${visualsHtml}
                    </div>
               </div>
           </div>
        `;
        } else if (activeTab === 'handbook') {
            bodyContent = `
            <div class="p-5 border rounded-xl bg-indigo-50 border-indigo-100">
                <h2 class="text-lg font-bold text-indigo-900 mb-4">Handbook Design Plan</h2>
                <p class="text-indigo-700 text-sm mb-4">Detailed breakdown of the student handbook.</p>
                <div class="space-y-6">
                  ${handbookPages.map(page => `
                    <div class="border border-indigo-200 rounded-lg p-4 bg-white break-inside-avoid">
                      <h3 class="font-bold text-lg mb-1">Page ${page.pageNumber}: ${page.title}</h3>
                      <div class="text-xs uppercase font-bold text-indigo-500 mb-2">${page.section}</div>
                      <div class="mb-3"><span class="font-semibold text-xs text-slate-500">Layout Description:</span> <div class="text-sm text-slate-700 italic mt-1">${page.layoutDescription}</div></div>
                      <div class="mb-3">
                        <span class="font-semibold text-xs text-slate-500">Visual Prompt:</span> 
                        <div class="text-xs font-mono bg-slate-50 p-2 rounded mt-1 border border-slate-100">${page.visualPrompt}</div>
                      </div>
                      <div class="mb-1">
                        <span class="font-semibold text-xs text-slate-500">Content Prompt:</span> 
                        <div class="text-xs font-mono bg-slate-50 p-2 rounded mt-1 border border-slate-100">${page.contentPrompt}</div>
                      </div>
                    </div>
                  `).join('')}
                </div>
            </div>
        `;
        } else if (activeTab === 'badge') {
            bodyContent = `
            <div class="p-5 border rounded-xl flex flex-col items-center justify-center text-center">
                <h2 class="text-xl font-bold text-slate-800 mb-4">Achievement Badge</h2>
                <div class="mb-6">
                    ${badgeImage ? `<img src="${badgeImage}" style="width: 200px; height: 200px; border-radius: 50%; border: 4px solid #f1f5f9;" />` : '<div style="width: 200px; height: 200px; border-radius: 50%; background: #f8fafc; border: 4px dashed #e2e8f0; display: flex; align-items: center; justify-content: center; color: #94a3b8;">No Badge</div>'}
                </div>
                <h3 class="text-lg font-bold text-slate-700">${basicInfo.theme}</h3>
                <p class="text-slate-500">Official Workshop Badge</p>
            </div>
        `;
        }

        const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Print View - ${activeTab}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          @page { size: auto;  margin: 10mm; }
          body { 
            font-family: 'Inter', sans-serif; 
            padding: 20px; 
            max-width: 900px; 
            margin: 0 auto; 
            color: #334155;
            -webkit-print-color-adjust: exact;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none !important; }
            .break-inside-avoid { break-inside: avoid; page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="no-print mb-8 p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-sm flex items-center justify-between">
            <span><strong>Print Mode:</strong> Press Ctrl+P (or Cmd+P) to print or save as PDF. Enable "Background graphics" for best results.</span>
            <button onclick="window.print()" class="px-4 py-2 bg-amber-600 text-white rounded font-bold shadow-sm hover:bg-amber-700">Print Now</button>
        </div>
        ${headerHtml}
        ${bodyContent}
      </body>
      </html>
    `;
        printWindow.document.write(html);
        printWindow.document.close();
    };


    return {
        handleDownloadFlashcard,
        handleDownloadAllFlashcards,
        handlePrint
    };
};
