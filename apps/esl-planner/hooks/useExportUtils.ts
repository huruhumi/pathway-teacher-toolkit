import { useCallback } from 'react';
import JSZip from 'jszip';
import { StructuredLessonPlan, Slide, Flashcard, Game, ReadingCompanionContent, Worksheet, PhonicsContent } from '../types';

const INDIGO_COLOR = '#4f46e5';

export interface UseExportUtilsProps {
    editablePlan: StructuredLessonPlan | null;
    editableSlides: Slide[];
    localFlashcards: Flashcard[];
    editableGames: Game[];
    editableReadingCompanion: ReadingCompanionContent;
    worksheets: Worksheet[];
    grammarInfographicUrl?: string;
    blackboardImageUrl?: string;
    phonicsContent: PhonicsContent;
    flashcardImages?: Record<number, string>;
    decodableTextImages?: Record<number, string>;
    viewLang?: 'en' | 'cn';
}

export const useExportUtils = (props: UseExportUtilsProps) => {
    const {
        editablePlan,
        editableSlides,
        localFlashcards,
        editableGames,
        editableReadingCompanion,
        worksheets,
        grammarInfographicUrl,
        blackboardImageUrl,
        phonicsContent,
        flashcardImages,
        decodableTextImages,
        viewLang
    } = props;

    const openViewer = (tabId: string, subTabId?: string) => {
        const win = window.open('', '_blank');
        if (!win) return;

        let contentHtml = '';
        let title = 'Lesson Kit Viewer';

        if (tabId === 'plan' && editablePlan) {
            title = `Plan: ${editablePlan.classInformation.topic}`;
            contentHtml = `
            <div class="bg-indigo-600 text-white p-8 rounded-t-2xl mb-8">
                <h1 class="text-3xl font-bold mb-4">Lesson Plan: ${editablePlan.classInformation.topic}</h1>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-indigo-100">
                    <div><span class="block text-[10px] uppercase font-black opacity-60">Level</span> ${editablePlan.classInformation.level}</div>
                    <div><span class="block text-[10px] uppercase font-black opacity-60">Date</span> ${editablePlan.classInformation.date}</div>
                    <div><span class="block text-[10px] uppercase font-black opacity-60">Topic</span> ${editablePlan.classInformation.topic}</div>
                    <div><span class="block text-[10px] uppercase font-black opacity-60">Students</span> ${editablePlan.classInformation.students}</div>
                </div>
            </div>
            <div class="space-y-8 px-2">
                <section>
                    <h2 class="text-xl font-bold text-indigo-900 border-b-2 border-indigo-100 pb-2 mb-4">Lesson Aim & Objectives</h2>
                    <div class="mb-4">
                        <h3 class="font-bold text-indigo-800 text-sm uppercase mb-1">Main Aim</h3>
                        <p class="text-gray-700 italic">${editablePlan.lessonDetails.aim}</p>
                    </div>
                    <div>
                        <h3 class="font-bold text-indigo-800 text-sm uppercase mb-1">Learning Objectives</h3>
                        <ul class="list-disc list-inside space-y-1 text-gray-700">
                            ${editablePlan.lessonDetails.objectives.map(o => `<li>${o}</li>`).join('')}
                        </ul>
                    </div>
                </section>
                <section>
                    <h2 class="text-xl font-bold text-indigo-900 border-b-2 border-indigo-100 pb-2 mb-4">Materials & Equipment</h2>
                    <ul class="list-disc list-inside space-y-1 text-gray-700">
                        ${editablePlan.lessonDetails.materials.map(m => `<li>${m}</li>`).join('')}
                    </ul>
                </section>
                <section>
                    <h2 class="text-xl font-bold text-indigo-900 border-b-2 border-indigo-100 pb-2 mb-4">Vocab & Grammar</h2>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <h3 class="font-bold text-teal-700 mb-2">Target Vocabulary</h3>
                            <div class="space-y-3">
                                ${editablePlan.lessonDetails.targetVocab.map(v => `
                                    <div class="p-3 bg-teal-50 rounded-lg border border-teal-100">
                                        <div class="font-bold text-teal-800">${v.word}</div>
                                        <div class="text-sm text-gray-600">${v.definition}</div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        <div>
                            <h3 class="font-bold text-indigo-700 mb-2">Grammar & Sentences</h3>
                            <ul class="space-y-2">
                                ${editablePlan.lessonDetails.grammarSentences.map(s => `<li class="p-2 bg-indigo-50 rounded border border-indigo-100 text-sm text-gray-700">• ${s}</li>`).join('')}
                            </ul>
                        </div>
                    </div>
                </section>
                <section>
                    <h2 class="text-xl font-bold text-indigo-900 border-b-2 border-indigo-100 pb-2 mb-4">Anticipated Problems & Solutions</h2>
                    <div class="space-y-4">
                        ${editablePlan.lessonDetails.anticipatedProblems.map(p => `
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-red-50/30 rounded-xl border border-red-100">
                               <div>
                                    <h4 class="font-bold text-red-800 text-xs uppercase mb-1">Problem</h4>
                                    <p class="text-gray-700 text-sm">${p.problem}</p>
                                </div>
                                <div>
                                    <h4 class="font-bold text-green-800 text-xs uppercase mb-1">Solution</h4>
                                    <p class="text-gray-700 text-sm">${p.solution}</p>
                                </div>
                            </div>
                        `).join('')}
                        ${editablePlan.lessonDetails.anticipatedProblems.length === 0 ? '<p class="text-gray-400 italic text-sm">None anticipated.</p>' : ''}
                    </div>
                </section>
                <section>
                    <h2 class="text-xl font-bold text-indigo-900 border-b-2 border-indigo-100 pb-2 mb-4">Phonics Focus</h2>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        ${phonicsContent.keyPoints.map(p => `
                            <div class="p-3 bg-purple-50 rounded-lg border border-purple-100 text-sm text-gray-700">
                                ${p}
                            </div>
                        `).join('')}
                        ${phonicsContent.keyPoints.length === 0 ? '<p class="text-gray-400 italic text-sm">No phonics focus defined.</p>' : ''}
                    </div>
                </section>
                <section>
                    <h2 class="text-xl font-bold text-indigo-900 border-b-2 border-indigo-100 pb-2 mb-4">Teaching Stages</h2>
                    <div class="overflow-hidden rounded-xl border border-gray-200">
                        <table class="w-full text-sm text-left">
                            <thead class="bg-gray-100 text-gray-700 font-bold uppercase text-[10px]">
                                <tr>
                                    <th class="px-4 py-3">Stage</th>
                                    <th class="px-4 py-3">Timing</th>
                                    <th class="px-4 py-3">Int.</th>
                                    <th class="px-4 py-3 w-1/3">Teacher Activity</th>
                                    <th class="px-4 py-3 w-1/3">Student Activity</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-200">
                                ${editablePlan.stages.map(s => `
                                    <tr class="align-top">
                                        <td class="px-4 py-4 font-bold text-indigo-700">${s.stage}</td>
                                        <td class="px-4 py-4 text-gray-500 whitespace-nowrap">${s.timing}</td>
                                        <td class="px-4 py-4 text-gray-400 font-medium">${s.interaction}</td>
                                        <td class="px-4 py-4 whitespace-pre-wrap">${s.teacherActivity}</td>
                                        <td class="px-4 py-4 whitespace-pre-wrap">${s.studentActivity}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        `;
        } else if (tabId === 'slides') {
            title = `Slides: ${editablePlan?.classInformation.topic || 'Lesson'}`;
            contentHtml = `
            <h1 class="text-3xl font-bold text-indigo-900 mb-8 border-b-4 border-indigo-500 pb-4">PPT Outline</h1>
            <div class="space-y-12">
                ${editableSlides.map((s, i) => `
                    <div class="p-8 bg-white border-2 border-indigo-100 rounded-3xl shadow-sm relative overflow-hidden">
                        <div class="absolute top-0 left-0 w-2 h-full bg-indigo-500"></div>
                        <div class="text-indigo-400 font-black text-4xl mb-4 opacity-20">SLIDE ${i + 1}</div>
                        <h2 class="text-2xl font-bold text-gray-800 mb-6">${s.title}</h2>
                        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div class="space-y-4">
                                <div>
                                    <h3 class="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">Slide Content</h3>
                                    <div class="text-gray-700 whitespace-pre-wrap leading-relaxed">${s.content}</div>
                                </div>
                                ${s.visual ? `
                                    <div class="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                                        <h3 class="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Visual</h3>
                                        <div class="text-sm italic text-indigo-700">${s.visual}</div>
                                    </div>
                                ` : ''}
                            </div>
                            <div class="bg-gray-50 p-6 rounded-2xl border border-gray-200">
                                <h3 class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Layout Design</h3>
                                <div class="text-sm italic text-gray-600 leading-relaxed">${s.layoutDesign}</div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        } else if (tabId === 'games') {
            title = `Activities: ${editablePlan?.classInformation.topic || 'Lesson'}`;
            contentHtml = `
            <h1 class="text-3xl font-bold text-indigo-900 mb-8">Classroom Games & Activities</h1>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                ${editableGames.map((g, i) => `
                    <div class="bg-white border border-indigo-100 p-6 rounded-2xl shadow-sm">
                        <div class="flex justify-between items-start mb-4">
                            <h2 class="text-xl font-bold text-indigo-800">${g.name}</h2>
                            <span class="text-[10px] font-bold px-2 py-1 bg-indigo-100 text-indigo-600 rounded uppercase tracking-wider">${g.type}</span>
                        </div>
                        <div class="mb-4">
                            <h3 class="text-[10px] font-bold text-gray-400 uppercase mb-2">Instructions</h3>
                            <div class="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">${g.instructions}</div>
                        </div>
                        <div class="pt-4 border-t border-gray-50">
                            <h3 class="text-[10px] font-bold text-gray-400 uppercase mb-1">Materials Needed</h3>
                            <div class="text-xs text-gray-600">${g.materials.join(', ') || 'None'}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        } else if (tabId === 'companion') {
            title = `Review Plan: ${editablePlan?.classInformation.topic || 'Lesson'}`;
            contentHtml = `
            <h1 class="text-3xl font-bold text-orange-900 mb-8">7-Day Post-Class Review Plan</h1>
            <div class="space-y-8">
                ${editableReadingCompanion.days.map(d => `
                    <div class="bg-white border-2 border-orange-100 rounded-2xl overflow-hidden shadow-sm">
                        <div class="bg-orange-50 px-6 py-4 border-b border-orange-100 flex justify-between items-center">
                            <div>
                                <h2 class="text-xl font-bold text-orange-800">Day ${d.day}: ${d.focus}</h2>
                                <p class="text-sm italic text-orange-600">${d.focus_cn}</p>
                            </div>
                        </div>
                        <div class="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <h3 class="text-[10px] font-bold text-gray-400 uppercase mb-3 tracking-widest">Review Tasks</h3>
                                <ul class="space-y-4">
                                    ${d.tasks?.map(t => `
                                        <li class="flex gap-3 items-start">
                                            <div class="w-5 h-5 rounded border border-orange-200 mt-1 flex-shrink-0"></div>
                                            <div>
                                                <div class="text-sm font-semibold text-gray-800">${t.text}</div>
                                                <div class="text-xs text-gray-500">${t.text_cn}</div>
                                            </div>
                                        </li>
                                    `).join('')}
                                </ul>
                            </div>
                            <div class="space-y-6">
                                ${d.trivia ? `
                                    <div class="bg-yellow-50 p-4 rounded-xl border border-yellow-100">
                                        <h3 class="text-[10px] font-bold text-yellow-600 uppercase mb-2 tracking-widest">Daily Trivia Fact</h3>
                                        <p class="text-sm font-bold text-yellow-900">${d.trivia.en}</p>
                                        <p class="text-xs text-yellow-700 italic mt-1">${d.trivia.cn}</p>
                                    </div>
                                ` : ''}
                                <div>
                                    <h3 class="text-[10px] font-bold text-gray-400 uppercase mb-2 tracking-widest">Resources</h3>
                                    <div class="space-y-3">
                                        ${d.resources?.map(r => `
                                            <div class="p-3 bg-blue-50 rounded-lg border border-blue-100">
                                                <div class="text-sm font-bold text-blue-800">${r.title}</div>
                                                <div class="text-xs text-blue-600 mb-1 truncate">${r.url}</div>
                                                <div class="text-xs text-gray-500">${r.description}</div>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        } else if (tabId === 'materials') {
            if (subTabId === 'flashcards') {
                title = `Flashcards: ${editablePlan?.classInformation.topic || 'Lesson'}`;
                contentHtml = `
                <h1 class="text-3xl font-bold text-indigo-900 mb-8">Teaching Flashcards</h1>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                    ${localFlashcards.map((c, i) => `
                        <div class="flex border-2 border-indigo-100 rounded-3xl overflow-hidden h-72 shadow-sm bg-white">
                            <div class="w-1/2 flex items-center justify-center p-4 bg-gray-50">
                                ${flashcardImages[i] ? `<img src="${flashcardImages[i]}" class="max-w-full max-h-full object-contain">` : '<div class="text-gray-300 text-[10px] font-bold">IMAGE AREA</div>'}
                            </div>
                            <div class="w-1/2 bg-indigo-600 text-white p-6 flex flex-col justify-center text-center">
                                <div class="text-3xl font-bold mb-4">${c.word}</div>
                                <div class="text-sm opacity-90 italic leading-relaxed">${c.definition}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
            } else if (subTabId === 'worksheets') {
                title = `Worksheets: ${editablePlan?.classInformation.topic || 'Lesson'}`;
                contentHtml = `
                ${worksheets.map(ws => {
                    const wsHtml = ws.sections?.map((sec, sIdx) => {
                        let secContent = '';
                        if (sec.layout === 'matching') {
                            // Shuffle Column B indices for printing
                            const shuffledIndices = Array.from({ length: sec.items.length }, (_, i) => i)
                                .sort(() => Math.random() - 0.5);

                            secContent = `
                                <div class="space-y-8">
                                    ${sec.items.map((item, iIdx) => {
                                const shuffledIdx = shuffledIndices[iIdx];
                                const itemB = sec.items[shuffledIdx];
                                return `
                                            <!-- VIEWER MATCHING ROW -->
                                            <div class="flex gap-32 items-center">
                                                <div class="flex-1 flex justify-between items-center bg-gray-50/50 p-4 rounded-2xl border border-gray-100 min-h-[100px]">
                                                    <div class="font-bold text-indigo-900">${iIdx + 1}. ${item.question}</div>
                                                    <div class="w-4 h-4 rounded-full border-2 border-indigo-400 bg-white shadow-xs"></div>
                                                </div>
                                                <div class="flex-1 flex items-center gap-4 bg-gray-50/50 p-4 rounded-2xl border border-gray-100 min-h-[100px]">
                                                    <div class="w-4 h-4 rounded-full border-2 border-indigo-400 bg-white shadow-xs"></div>
                                                    <div class="flex-1 flex gap-4 items-center">
                                                        <div class="font-bold text-gray-400 mr-2">${String.fromCharCode(65 + iIdx)}.</div>
                                                        ${itemB.imageUrl ? `<img src="${itemB.imageUrl}" class="w-24 h-16 object-cover rounded-xl shadow-xs border border-white">` : ''}
                                                        <div class="flex-1 font-bold text-gray-700">${itemB.answer}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        `;
                            }).join('')}
                                </div>
                            `;
                        } else if (sec.layout === 'multiple-choice') {
                            secContent = `
                                <div class="grid grid-cols-1 gap-8">
                                    ${sec.items.map((item, iIdx) => `
                                        <div class="bg-white border border-gray-100 rounded-[2rem] p-6 shadow-xs">
                                            <div class="font-bold text-gray-800 mb-6 flex gap-3 text-lg">
                                                <span class="text-indigo-400 font-black">Q${iIdx + 1}.</span>
                                                ${item.question}
                                            </div>
                                            <!-- VIEWER FORCED 4 COLUMN GRID FOR PRINT CONSISTENCY -->
                                            <div class="grid grid-cols-4 gap-4 ml-8 viewer-mc-grid">
                                                ${(item.options || ["", "", "", ""]).map((o, oi) => `
                                                    <div class="flex items-center gap-3 p-4 rounded-2xl border-2 border-gray-50 bg-gray-50/30">
                                                        <div class="w-8 h-8 rounded-full bg-white border-2 border-gray-100 text-gray-400 flex items-center justify-center font-black text-xs shrink-0">${String.fromCharCode(65 + oi)}</div>
                                                        <div class="text-sm font-bold text-gray-700">${o}</div>
                                                    </div>
                                                `).join('')}
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            `;
                        } else if (sec.layout === 'error-correction') {
                            secContent = `
                                <div class="mb-6">
                                    <div class="bg-white border-2 border-indigo-50 rounded-[2.5rem] p-10 shadow-sm leading-[3.5] italic text-xl text-gray-800 relative viewer-error-correction-passage">
                                        ${sec.passageTitle ? `<div class="font-black text-center text-indigo-900 mb-8 not-italic border-b-2 border-indigo-100 pb-4">${sec.passageTitle}</div>` : ''}
                                        ${sec.passage}
                                    </div>
                                    <div class="mt-8">
                                        <div class="bg-white border-2 border-indigo-100 rounded-2xl p-4 shadow-sm viewer-correction-legend">
                                            <h5 class="text-[10px] font-black text-indigo-900 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="text-indigo-500"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                                                Proofreading Marks Reference / 修改符号参考
                                            </h5>
                                            <div class="grid grid-cols-4 gap-4">
                                                <div class="flex items-center gap-2"><span class="w-6 h-6 bg-indigo-50 rounded flex items-center justify-center font-bold text-indigo-600">^</span><span class="text-[10px] font-medium text-gray-600">Insert / 插入</span></div>
                                                <div class="flex items-center gap-2"><span class="w-6 h-6 bg-indigo-50 rounded flex items-center justify-center font-bold text-indigo-600">/</span><span class="text-[10px] font-medium text-gray-600">Delete / 删除</span></div>
                                                <div class="flex items-center gap-2"><span class="w-6 h-6 bg-indigo-50 rounded flex items-center justify-center font-bold text-indigo-600">○</span><span class="text-[10px] font-medium text-gray-600">Replace / 替换</span></div>
                                                <div class="flex items-center gap-2"><span class="w-6 h-6 bg-indigo-50 rounded flex items-center justify-center font-bold text-indigo-600">~</span><span class="text-[10px] font-medium text-gray-600">Spelling / 拼写</span></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            `;
                        } else if (sec.layout === 'essay') {
                            secContent = `
                                <div class="grid grid-cols-1 gap-12">
                                    ${sec.items.map((item, iIdx) => {
                                const lineCount = Math.ceil((item.wordCount || 50) / 10);
                                const linesHtml = Array.from({ length: lineCount }).map(() => `
                                            <div class="border-b-2 border-gray-100 h-12 w-full"></div>
                                        `).join('');

                                return `
                                        <div class="space-y-6">
                                            <div class="font-bold text-gray-800 text-lg flex gap-3">
                                                <span class="text-indigo-400 font-black">${iIdx + 1}.</span>
                                                ${item.question}
                                                ${item.wordCount ? `<span class="ml-auto text-indigo-500 text-sm font-black uppercase">Goal: ${item.wordCount} words</span>` : ''}
                                            </div>
                                            ${item.imageUrl ? `
                                                <div class="max-w-xl mx-auto">
                                                    <img src="${item.imageUrl}" class="w-full rounded-[2rem] border-4 border-indigo-50 shadow-sm">
                                                </div>
                                            ` : ''}
                                            <div class="bg-white/30 rounded-2xl p-8 space-y-4">
                                                ${linesHtml}
                                            </div>
                                        </div>
                                        `;
                            }).join('')}
                                </div>
                            `;
                        } else {
                            secContent = `
                                <div class="grid grid-cols-1 gap-8">
                                    ${sec.items.map((item, iIdx) => `
                                        <div class="flex gap-8">
                                            <div class="flex-1">
                                                <div class="font-bold text-gray-800 mb-4 flex gap-2">
                                                    <span class="text-indigo-300">Q${iIdx + 1}.</span>
                                                    ${item.question}
                                                </div>
                                                <div class="ml-6 border-b border-gray-200 h-12"></div>
                                            </div>
                                            ${(item.imageUrl) ? `<img src="${item.imageUrl}" class="w-48 h-36 object-cover rounded-xl border border-indigo-100 shadow-sm">` : ''}
                                        </div>
                                    `).join('')}
                                </div>
                            `;
                        }

                        return `
                            <div class="mb-12">
                                <h2 class="text-xl font-bold text-indigo-800 border-b-2 border-indigo-100 pb-2 mb-6">${sIdx + 1}. ${sec.title}</h2>
                                ${sec.passage && sec.layout !== 'error-correction' ? `
                                    <div class="bg-gray-50 p-6 rounded-2xl border-l-4 border-indigo-400 italic text-gray-700 leading-relaxed mb-8">
                                        ${sec.passageTitle ? `<div class="font-bold mb-2 not-italic text-indigo-900">${sec.passageTitle}</div>` : ''}
                                        ${sec.passage}
                                    </div>
                                ` : ''}
                                ${secContent}
                            </div>
                        `;
                    }).join('');

                    return `
                        <div class="mb-20">
                            <div class="text-center mb-12">
                                <h1 class="text-4xl font-black text-indigo-900 mb-2">${ws.title}</h1>
                                <p class="text-gray-500 italic">${ws.instructions}</p>
                            </div>
                            <div class="space-y-16">
                                ${wsHtml}
                            </div>
                            <div class="page-break mt-32 border-t-4 border-dashed border-gray-100 pt-32">
                                <h2 class="text-2xl font-bold text-indigo-900 mb-8">Answer Key: ${ws.title}</h2>
                                <div class="space-y-8">
                                    ${ws.sections?.map((sec, sIdx) => `
                                        <div class="bg-gray-50 p-6 rounded-2xl border border-gray-200">
                                            <h3 class="font-bold text-indigo-700 mb-4">${sIdx + 1}. ${sec.title}</h3>
                                            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                ${sec.items.map((item, iIdx) => `
                                                    <div class="text-sm"><span class="text-gray-400 font-bold mr-2">${iIdx + 1}.</span> <span class="font-bold text-green-700">${item.answer}</span></div>
                                                `).join('')}
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            `;
            } else if (subTabId === 'grammar') {
                title = `Infographic: ${editablePlan?.classInformation.topic || 'Lesson'}`;
                contentHtml = `
                <h1 class="text-3xl font-bold text-indigo-900 mb-8">Lesson Infographic Handout</h1>
                <div class="space-y-12">
                    ${grammarInfographicUrl ? `
                        <div class="bg-white p-4 rounded-3xl border-4 border-indigo-50 shadow-xl overflow-hidden text-center">
                            <img src="${grammarInfographicUrl}" class="w-full h-auto rounded-2xl mx-auto max-w-4xl">
                        </div>
                    ` : ''}
                    <div>
                        <h2 class="text-xl font-bold text-indigo-800 mb-6 border-b-2 border-indigo-100 pb-2">Key Learning Points</h2>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            ${editablePlan?.lessonDetails.grammarSentences.map((s, i) => `
                                <div class="flex gap-4 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                                    <div class="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-black flex-shrink-0">${i + 1}</div>
                                    <div class="text-lg text-indigo-900 font-medium italic leading-relaxed">${s}</div>
                                </div>
                            `).join('')}
                            ${editablePlan?.lessonDetails.targetVocab.map((v, i) => `
                                <div class="flex gap-4 p-4 bg-teal-50 rounded-2xl border border-teal-100">
                                    <div class="w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center font-black flex-shrink-0">${i + 1}</div>
                                    <div class="text-lg text-teal-900 font-black italic leading-relaxed">${v.word}: <span class="font-medium text-teal-700">${v.definition}</span></div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
            } else if (subTabId === 'whiteboard') {
                title = `Whiteboard Design: ${editablePlan?.classInformation.topic || 'Lesson'}`;
                contentHtml = `
                <h1 class="text-3xl font-bold text-indigo-900 mb-8">Whiteboard Design Reference</h1>
                <div class="space-y-12">
                    ${blackboardImageUrl ? `
                        <div class="bg-white p-6 rounded-[2.5rem] border-[12px] border-gray-100 shadow-2xl overflow-hidden text-center">
                            <img src="${blackboardImageUrl}" class="w-full h-auto rounded-2xl mx-auto max-w-5xl shadow-lg">
                            <p class="mt-6 text-gray-400 text-sm font-medium italic">A visual structure of your lesson as it would appear on a professional classroom whiteboard.</p>
                        </div>
                    ` : '<div class="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200 text-gray-400">No whiteboard design generated yet.</div>'}
                </div>
            `;
            } else if (subTabId === 'phonics') {
                title = `Phonics: ${editablePlan?.classInformation.topic || 'Lesson'}`;
                contentHtml = `
                <h1 class="text-3xl font-bold text-indigo-900 mb-8">Phonics & Decodable Practice</h1>
                
                <div class="grid grid-cols-2 gap-8 mb-12">
                    <div class="bg-purple-50 p-6 rounded-3xl border border-purple-100 shadow-sm">
                        <h2 class="font-bold text-purple-900 uppercase text-[10px] tracking-widest mb-4">Target Sounds</h2>
                        <div class="space-y-3">
                            ${phonicsContent.keyPoints.map((p, i) => `
                                <div class="p-4 bg-white rounded-xl border border-purple-100 font-bold text-purple-900 text-base shadow-sm">
                                    ${p}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 shadow-sm">
                        <h2 class="font-bold text-indigo-900 uppercase text-[10px] tracking-widest mb-4">Vocabulary Check</h2>
                        <div class="flex flex-wrap gap-2">
                            ${editablePlan?.lessonDetails.targetVocab.map(v => `
                                <span class="text-xs font-bold px-3 py-1.5 bg-white text-indigo-600 rounded-lg border border-indigo-100 shadow-sm">${v.word}</span>
                            `).join('') || ''}
                        </div>
                    </div>
                </div>

                <div class="space-y-16">
                    <h2 class="text-xl font-bold text-indigo-800 mb-4 uppercase text-[10px] tracking-widest opacity-40">Decodable Stories</h2>
                    ${phonicsContent.decodableTexts.map((text, i) => `
                        <div class="grid grid-cols-2 gap-8 items-stretch mb-8 page-break-inside-avoid">
                            <div class="p-8 bg-gray-50 rounded-[2rem] border border-gray-200 text-2xl leading-[2.5] font-medium text-gray-800 italic">
                                ${text}
                            </div>
                            ${decodableTextImages[i] ? `
                                <div class="rounded-[2rem] overflow-hidden shadow-lg border-8 border-gray-100 bg-gray-50 flex items-center justify-center min-h-[400px]">
                                    <img src="${decodableTextImages[i]}" class="w-full h-auto object-contain" style="max-height: 800px;">
                                </div>
                            ` : `
                                <div class="rounded-[2rem] bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center min-h-[400px]">
                                    <span class="text-gray-300 font-bold uppercase tracking-widest text-sm">Image Placeholder</span>
                                </div>
                            `}
                        </div>
                        <div class="mt-4 flex flex-wrap gap-4 pt-4 border-t border-gray-100">
                            <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5"><div class="w-3 h-3 rounded-full bg-[#10b981] inline-block mb-0.5"></div> Phonics Extension</span>
                            <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5"><div class="w-3 h-3 rounded-full bg-[#eab308] inline-block mb-0.5"></div> Sight Words</span>
                            <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5"><div class="w-3 h-3 rounded-full bg-[#8b5cf6] inline-block mb-0.5"></div> Target Words</span>
                        </div>
                        <div class="border-b border-gray-100 opacity-50 my-12"></div>
                    `).join('')}
                </div>
            `;
            }
        }

        const fullHtml = `
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
            @media print { 
                .no-print { display: none !important; } 
                body { padding: 0; } 
                .print-header { display: none; }
                .page-break { page-break-before: always; }
                /* Ensure columns stack if they are specifically top-level Phonics sections */
                .flex-col { flex-direction: column !important; }
                .md\\:flex-row { flex-direction: column !important; }
                .w-full { width: 100% !important; }
                .md\\:w-1\\/3 { width: 100% !important; }
                /* ENSURE MULTIPLE CHOICE OPTIONS STAY IN ONE ROW ON PRINT */
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

        win.document.write(fullHtml);
        win.document.close();
    };

    const triggerDownloadMd = (content: string, filename: string) => {
        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename.endsWith('.md') ? filename : `${filename}.md`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleDownloadPlanMd = () => {
        if (!editablePlan) return;
        let md = `# Lesson Plan: ${editablePlan.classInformation.topic}\n    \n    `;
        md += `## 📋 Class Information\n    `;
        md += `- **Level:** ${editablePlan.classInformation.level}\n    `;
        md += `- **Date:** ${editablePlan.classInformation.date}\n    `;
        md += `- **Topic:** ${editablePlan.classInformation.topic}\n    `;
        md += `- **Students:** ${editablePlan.classInformation.students}\n    \n    `;

        md += `## 🎯 Objectives\n    `;
        editablePlan.lessonDetails.objectives.forEach(obj => md += `- ${obj}\n    `);
        md += `\n    `;

        md += `## 🛠️ Materials & Equipment\n    `;
        editablePlan.lessonDetails.materials.forEach(mat => md += `- ${mat}\n    `);
        md += `\n    `;

        md += `## 📚 Target Vocabulary\n    `;
        editablePlan.lessonDetails.targetVocab.forEach(v => md += `- **${v.word}**: ${v.definition}\n    `);
        md += `\n    `;

        md += `## 📝 Grammar & Sentences\n    `;
        editablePlan.lessonDetails.grammarSentences.forEach(s => md += `- ${s}\n    `);
        md += `\n    `;

        md += `## 🏃 Teaching Stages\n    \n    `;
        md += `| Stage | Timing | Interaction | Aim |\n    `;
        md += `| :--- | :--- | :--- | :--- |\n    `;
        md += `| :--- | :--- | :--- | :--- |\n    `;
        editablePlan.stages.forEach(s => md += `| ${s.stage} | ${s.timing} | ${s.interaction} | ${s.stageAim} |\n    `);
        md += `\n    \n    `;

        editablePlan.stages.forEach(s => {
            md += `### Stage: ${s.stage} (${s.timing})\n    `;
            md += `**Teacher Activity:**\n    ${s.teacherActivity}\n    \n    `;
            md += `**Student Activity:**\n    ${s.studentActivity}\n    \n    `;
            md += `---\n    \n    `;
        });

        triggerDownloadMd(md, `Lesson_Plan_${editablePlan.classInformation.topic.replace(/\s+/g, '_')}`);
    };

    const handleDownloadSlidesMd = () => {
        let md = `# PPT Presentation Outline: ${editablePlan?.classInformation.topic || 'Lesson'}\n    \n    `;
        editableSlides.forEach((s, i) => {
            md += `## Slide ${i + 1}: ${s.title}\n    `;
            md += `### 📄 Content\n    ${s.content}\n    \n    `;
            md += `### 👁️ Visual\n    ${s.visual || 'None'}\n    \n    `;
            md += `### 🎤 Layout Design\n    ${s.layoutDesign}\n    \n    `;
            md += `---\n    \n    `;
        });
        triggerDownloadMd(md, `Slides_Outline_${editablePlan?.classInformation.topic.replace(/\s+/g, '_') || 'Lesson'}`);
    };

    const formatWorksheetQuestions = (wsList: Worksheet[], topic: string) => {
        let md = `# <span style="color: ${INDIGO_COLOR};">**📝 Worksheets (Questions): ${topic}**</span>\n    \n    `;
        wsList.forEach((ws, idx) => {
            md += `## <span style="color: ${INDIGO_COLOR};">**${ws.title}**</span>\n    `;
            md += `*Instructions: ${ws.instructions}*\n    \n    `;
            ws.sections?.forEach((sec, sIdx) => {
                md += `### <span style="color: ${INDIGO_COLOR}; font-weight: bold;">${sIdx + 1}. ${sec.title}</span>\n    `;
                if (sec.description) md += `<p style="color: #6b7280; font-style: italic;">${sec.description}</p>\n    \n    `;
                if (sec.passageTitle) md += `#### **${sec.passageTitle}**\n    \n    `;
                if (sec.passage) md += `<div style="background-color: #f9fafb; border-left: 4px solid ${INDIGO_COLOR}; padding: 15px; margin-bottom: 20px;">\n    \n    > ${sec.passage}\n    \n    </div>\n    \n    `;

                if (sec.layout === 'matching') {
                    md += `| Column A | Column B |\n    `;
                    md += `| :--- | :--- |\n    `;
                    sec.items.forEach(item => {
                        md += `| ${item.question} | [ ] |\n    `;
                    });
                } else if (sec.layout === 'multiple-choice') {
                    sec.items.forEach((item, i) => {
                        md += `<div style="margin-bottom: 15px;">\n    `;
                        md += `${i + 1}. ${item.question}\n    \n    `;
                        if (item.options && item.options.length > 0) {
                            item.options.forEach((opt, oi) => {
                                md += `   ${String.fromCharCode(65 + oi)}) ${opt}\n    `;
                            });
                        }
                        md += `</div>\n    `;
                    });
                } else if (sec.layout === 'essay') {
                    sec.items.forEach((item, i) => {
                        md += `#### ${i + 1}. ${item.question} ${item.wordCount ? `(Required: ${item.wordCount} words)` : ''}\n    \n    `;
                        const lineCount = Math.ceil((item.wordCount || 50) / 10);
                        const lines = Array.from({ length: lineCount }).map(() => "____________________________________________________________________").join('\n    ');
                        md += `\`\`\`\n    ${lines}\n    \`\`\`\n    \n    `;
                    });
                } else {
                    sec.items.forEach((item, i) => {
                        md += `<div style="margin-bottom: 15px;">\n    `;
                        md += `${i + 1}. ${item.question}\n    \n    `;
                        md += `____________________________________________________________________\n    `;
                        md += `</div>\n    `;
                    });
                }
                md += `\n    ---\n    \n    `;
            });
        });
        return md;
    };

    const formatWorksheetAnswers = (wsList: Worksheet[], topic: string) => {
        let md = `# <span style="color: ${INDIGO_COLOR};">**✅ Worksheets (Answer Key): ${topic}**</span>\n    \n    `;
        wsList.forEach((ws, idx) => {
            md += `## <span style="color: ${INDIGO_COLOR};">**${ws.title} - Answer Key**</span>\n    \n    `;
            ws.sections?.forEach((sec, sIdx) => {
                md += `### <span style="color: ${INDIGO_COLOR}; font-weight: bold;">${sIdx + 1}. ${sec.title}</span>\n    `;
                sec.items.forEach((item, i) => {
                    const optIdx = item.options?.indexOf(item.answer) ?? -1;
                    const optPrefix = optIdx !== -1 ? `${String.fromCharCode(65 + optIdx)}) ` : "";
                    md += `${i + 1}. **${optPrefix}${item.answer}**\n    `;
                });
                md += `\n    `;
            });
            md += `---\n    \n    `;
        });
        return md;
    };

    const handleDownloadWorksheetsMd = async () => {
        if (worksheets.length === 0) return;
        const zip = new JSZip();
        const topic = editablePlan?.classInformation.topic || 'Lesson';
        const safeTopic = topic.replace(/\s+/g, '_');

        const questionsMd = formatWorksheetQuestions(worksheets, topic);
        const answersMd = formatWorksheetAnswers(worksheets, topic);

        zip.file("Worksheet_Questions.md", questionsMd);
        zip.file("Worksheet_Answer_Key.md", answersMd);

        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Worksheets_${safeTopic}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleDownloadCompanionMd = () => {
        let md = `# Reading Companion: ${editablePlan?.classInformation.topic || 'ESL Lesson'}\n    \n    `;
        editableReadingCompanion.days.forEach(day => {
            md += `## Day ${day.day}: ${day.focus} (${day.focus_cn})\n    `;
            md += `### ✅ Tasks\n    `;
            day.tasks?.forEach(t => md += `- [ ] ${t.text} (${t.text_cn})\n    `);
            if (day.trivia) {
                md += `\n    ### 💡 Day Trivia\n    - **EN:** ${day.trivia.en}\n    - **CN:** ${day.trivia.cn}\n    `;
            }
            md += `\n    ### 🔗 Resources\n    `;
            day.resources?.forEach(r => md += `- [${r.title}](${r.url}) - ${r.description}\n    `);
            md += `\n    ---\n    \n    `;
        });

        triggerDownloadMd(md, `Reading_Companion_${editablePlan?.classInformation.topic.replace(/\s+/g, '_') || 'Lesson'}`);
    };

    const handleDownloadGamesMd = () => {
        let md = `# Classroom Games & Activities: ${editablePlan?.classInformation.topic || 'Lesson'}\n    \n    `;
        editableGames.forEach((game, i) => {
            md += `## ${i + 1}. ${game.name}\n    `;
            md += `- **Type:** ${game.type}\n    `;
            md += `- **Interaction:** ${game.interactionType}\n    `;
            md += `- **Materials:** ${game.materials.join(', ') || 'None'}\n    \n    `;
            md += `### Instructions\n    ${game.instructions}\n    \n    `;
            md += `---\n    \n    `;
        });
        triggerDownloadMd(md, `Games_Activities_${editablePlan?.classInformation.topic.replace(/\s+/g, '_') || 'Lesson'}`);
    };

    return {
        openViewer,
        triggerDownloadMd,
        handleDownloadPlanMd,
        handleDownloadSlidesMd,
        handleDownloadWorksheetsMd,
        handleDownloadCompanionMd,
        handleDownloadGamesMd
    };
};