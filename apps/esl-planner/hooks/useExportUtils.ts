import { useCallback } from 'react';
import { jsPDF } from 'jspdf';
import { StructuredLessonPlan, Slide, Flashcard, Game, ReadingCompanionContent, Worksheet, PhonicsContent, AssignmentSheet } from '../types';
import { wrapViewerHtml } from './viewerShell';
import { downloadBlob } from '@shared/utils/download';

const INDIGO_COLOR = '#4f46e5';

// Cached base64 logo for embedding in popup viewer HTML
let _logoBase64Cache: string | null = null;
function getLogoBase64(): string {
    if (_logoBase64Cache) return _logoBase64Cache;
    try {
        // Extract from already-loaded <img id="pathway-logo"> in the DOM
        const img = document.getElementById('pathway-logo') as HTMLImageElement | null;
        if (img && img.naturalWidth > 0) {
            const size = 160;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d')!;
            const scale = Math.min(size / img.naturalWidth, size / img.naturalHeight);
            const w = img.naturalWidth * scale;
            const h = img.naturalHeight * scale;
            ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
            _logoBase64Cache = canvas.toDataURL('image/png');
            return _logoBase64Cache;
        }
    } catch {
        // ignore
    }
    return '';
}

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
    assignmentSheet?: AssignmentSheet;
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
        viewLang,
        assignmentSheet
    } = props;

    const openViewer = (tabId: string, subTabId?: string) => {
        const win = window.open('', '_blank');
        if (!win) return;

        const logoDataUri = getLogoBase64();
        const logoImgTag = logoDataUri ? `<img src="${logoDataUri}" class="viewer-title-logo" alt="" />` : '';
        let contentHtml = '';
        let title = 'Lesson Kit Viewer';

        if (tabId === 'plan' && editablePlan) {
            title = `Lesson Plan: ${editablePlan.classInformation.topic}`;
            // Split stages into step rows (mirroring editor logic)
            const splitSteps = (text: string): string[] => {
                const parts = text.split(/(?=\d+\.\s)/).map(s => s.replace(/^\d+\.\s*/, '').trim()).filter(Boolean);
                return parts.length > 0 ? parts : [text];
            };
            const splitInteractions = (text: string): string[] =>
                text.split(/[,;]/).map(s => s.trim()).filter(Boolean);

            contentHtml = `
            <!-- Lesson Details Card -->
            <div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm mb-5">
                <h3 class="text-base font-bold text-gray-800 mb-3 flex items-center gap-2 print-section-header">
                    ${logoImgTag} Lesson Details
                </h3>
                <!-- Topic — own row -->
                <div class="mb-4">
                    <div class="text-[10px] font-black text-gray-400 uppercase mb-0.5">TOPIC</div>
                    <div class="font-semibold text-gray-800">${editablePlan.classInformation.topic}</div>
                </div>
                <!-- Level / Students / Date -->
                <div class="grid grid-cols-3 gap-4 mb-4">
                    <div>
                        <div class="text-[10px] font-black text-gray-400 uppercase mb-0.5">LEVEL</div>
                        <div class="font-semibold text-gray-800">${editablePlan.classInformation.level}</div>
                    </div>
                    <div>
                        <div class="text-[10px] font-black text-gray-400 uppercase mb-0.5">STUDENTS</div>
                        <div class="font-semibold text-gray-800">${editablePlan.classInformation.students}</div>
                    </div>
                    <div>
                        <div class="text-[10px] font-black text-gray-400 uppercase mb-0.5">DATE</div>
                        <div class="font-semibold text-gray-800">${editablePlan.classInformation.date}</div>
                    </div>
                </div>
                <!-- Lesson Aim -->
                <div class="mb-4">
                    <div class="text-[10px] font-black text-gray-400 uppercase mb-0.5">LESSON AIM</div>
                    <div class="text-gray-700 italic">${editablePlan.lessonDetails.aim}</div>
                </div>
                <!-- Learning Objectives -->
                <div>
                    <div class="text-[10px] font-black text-gray-400 uppercase mb-2">LEARNING OBJECTIVES</div>
                    <div class="space-y-1.5">
                        ${editablePlan.lessonDetails.objectives.map(o => `
                            <div class="flex items-start gap-2 print-row">
                                <span class="text-violet-500 mt-0.5">●</span>
                                <span class="text-sm text-gray-700">${o}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>

            <!-- Vocab & Grammar side-by-side -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                <!-- Vocabulary -->
                <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div class="bg-gray-50 px-4 py-3 border-b border-gray-100">
                        <h4 class="font-bold text-gray-800 text-sm flex items-center gap-2">
                            <span class="text-teal-500">📖</span> Target Vocabulary
                        </h4>
                    </div>
                    <div class="divide-y divide-gray-100">
                        ${editablePlan.lessonDetails.targetVocab.map(v => `
                            <div class="p-3 print-row">
                                <div class="font-bold text-sm text-gray-800">${v.word}</div>
                                <div class="text-xs text-gray-500">${v.definition}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <!-- Grammar & Sentences -->
                <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div class="bg-gray-50 px-4 py-3 border-b border-gray-100">
                        <h4 class="font-bold text-gray-800 text-sm flex items-center gap-2">
                            <span class="text-indigo-500">📚</span> Grammar & Sentences
                        </h4>
                    </div>
                    <div class="divide-y divide-gray-100">
                        ${editablePlan.lessonDetails.grammarSentences.map(s => `
                            <div class="flex gap-2 items-start p-3 print-row">
                                <span class="text-indigo-400 mt-0.5">●</span>
                                <span class="text-sm text-gray-700">${s}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>

            <!-- Materials & Equipment -->
            <div class="bg-white rounded-xl border border-gray-200 p-4 shadow-sm mb-5">
                <h4 class="font-bold text-gray-800 text-sm flex items-center gap-2 mb-3 print-section-header">
                    <span class="text-violet-500">📋</span> Materials & Equipment
                </h4>
                <div class="space-y-1.5">
                    ${editablePlan.lessonDetails.materials.map(m => `
                        <div class="flex items-start gap-2">
                            <span class="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 flex-shrink-0"></span>
                            <span class="text-sm text-gray-700">${m}</span>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Anticipated Problems & Solutions -->
            <div class="bg-amber-50 rounded-xl p-4 border border-amber-100 mb-5">
                <div class="text-xs font-bold text-amber-600 uppercase flex items-center gap-1 mb-3 print-section-header">
                    ⚠ Anticipated Problems & Solutions
                </div>
                <div class="space-y-3">
                    ${editablePlan.lessonDetails.anticipatedProblems.map(p => `
                        <div style="break-inside: avoid;" class="bg-white rounded-lg border border-amber-200 p-3">
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <div class="text-[10px] font-bold text-amber-500 uppercase mb-1">Problem</div>
                                    <div class="text-sm text-amber-900">${p.problem}</div>
                                </div>
                                <div>
                                    <div class="text-[10px] font-bold text-emerald-500 uppercase mb-1">Solution</div>
                                    <div class="text-sm text-emerald-900">${p.solution}</div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                    ${editablePlan.lessonDetails.anticipatedProblems.length === 0 ? '<p class="text-gray-400 italic text-sm">None anticipated.</p>' : ''}
                </div>
            </div>

            <!-- Teaching Stages (card-based, matching editor) -->
            <div class="space-y-4">
                ${editablePlan.stages.map((stage, i) => {
                const teacherSteps = splitSteps(stage.teacherActivity);
                const studentSteps = splitSteps(stage.studentActivity);
                const interactionParts = splitInteractions(stage.interaction);
                const maxLen = Math.max(teacherSteps.length, studentSteps.length);
                return `
                    <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-4">
                        <!-- Stage Header -->
                        <div class="p-3 bg-gray-50 border-b border-gray-100 print-section-header">
                            <div class="flex flex-wrap items-center gap-3">
                                <span class="text-sm font-bold text-violet-700 bg-violet-50 border border-violet-100 rounded px-2 py-1">${stage.timing}</span>
                                <span class="font-bold text-gray-800 uppercase tracking-wide">${stage.stage}</span>
                            </div>
                            <div class="text-sm italic text-gray-500 mt-1">${stage.stageAim}</div>
                        </div>
                        <!-- Stage Steps -->
                        <div class="p-4">
                            <!-- Column headers -->
                            <div class="grid grid-cols-[1.5rem_4.5rem_1fr_1fr] gap-x-2 mb-2 items-center">
                                <div></div>
                                <div class="text-[10px] font-black text-blue-400 uppercase tracking-widest text-center">MODE</div>
                                <div class="text-[10px] font-black text-violet-400 uppercase tracking-widest text-center">TEACHER SCRIPT</div>
                                <div class="text-[10px] font-black text-emerald-500 uppercase tracking-widest text-center">STUDENT ACTIVITY</div>
                            </div>
                            ${Array.from({ length: maxLen }).map((_, si) => `
                                <div class="grid grid-cols-[1.5rem_4.5rem_1fr_1fr] gap-x-2 mb-1.5 items-start print-row">
                                    <span class="w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-[11px] font-bold flex items-center justify-center">${si + 1}</span>
                                    <div class="text-[10px] font-semibold text-blue-600 bg-blue-50 rounded-lg px-2 py-1.5 text-center">${interactionParts[si] ?? interactionParts[interactionParts.length - 1] ?? ''}</div>
                                    <div class="text-sm text-violet-900 bg-violet-50/30 rounded-lg px-2.5 py-1.5 leading-relaxed">${teacherSteps[si] || ''}</div>
                                    <div class="text-sm text-emerald-900 bg-emerald-50/30 rounded-lg px-2.5 py-1.5 leading-relaxed">${studentSteps[si] || ''}</div>
                                </div>
                            `).join('')}

                            ${(stage.backgroundKnowledge && stage.backgroundKnowledge.length > 0) ? `
                            <div style="break-inside: avoid;" class="mt-3 bg-blue-50 rounded-lg p-2.5 border border-blue-100">
                                <div class="text-xs font-bold text-blue-500 uppercase mb-2 flex items-center gap-1">📖 Background Knowledge</div>
                                <div class="space-y-1">
                                    ${stage.backgroundKnowledge.map(info => `
                                        <div class="flex items-start gap-2">
                                            <span class="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2 flex-shrink-0"></span>
                                            <span class="text-sm text-blue-900">${info}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>` : ''}

                            ${(stage.teachingTips && stage.teachingTips.length > 0) ? `
                            <div style="break-inside: avoid;" class="mt-3 bg-purple-50 rounded-lg p-2.5 border border-purple-100">
                                <div class="text-xs font-bold text-purple-500 uppercase mb-2 flex items-center gap-1">💡 Teaching Tips</div>
                                <div class="space-y-1">
                                    ${stage.teachingTips.map(tip => `
                                        <div class="flex items-start gap-2">
                                            <span class="w-1.5 h-1.5 rounded-full bg-purple-400 mt-2 flex-shrink-0"></span>
                                            <span class="text-sm text-purple-900">${tip}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>` : ''}

                            ${stage.fillerActivity ? `
                            <div style="break-inside: avoid;" class="mt-3 bg-amber-50 rounded-lg p-2.5 border border-amber-100">
                                <div class="text-xs font-bold text-amber-600 uppercase mb-2 flex items-center gap-1">⚡ Filler Activity</div>
                                <div class="text-sm text-amber-900">${stage.fillerActivity}</div>
                            </div>` : ''}
                        </div>
                    </div>`;
            }).join('')}
            </div>
        `;
        } else if (tabId === 'slides') {
            title = `Slides: ${editablePlan?.classInformation.topic || 'Lesson'}`;
            contentHtml = `
            <div class="flex items-center gap-3 mb-8 border-b-4 border-indigo-500 pb-4">${logoImgTag}<h1 class="text-3xl font-bold text-indigo-900">PPT Outline</h1></div>
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
            <div class="flex items-center gap-3 mb-8">${logoImgTag}<h1 class="text-3xl font-bold text-indigo-900">Classroom Games & Activities</h1></div>
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
            title = `Learning Companion: ${editablePlan?.classInformation.topic || 'Lesson'}`;

            // Generate HTML for a single card
            const renderCard = (d: any, isTitle: boolean = false) => {
                if (isTitle) {
                    return `
                        <div class="bg-orange-50 border-2 border-orange-200 rounded-xl p-6 flex flex-col justify-center items-center text-center shadow-sm print:shadow-none h-full w-full box-border">
                            <img src="${logoDataUri}" alt="Pathway Academy" style="width:80px; height:80px; object-fit:contain; margin-bottom:16px;" />
                            <h1 class="text-3xl font-black text-orange-900 mb-4 uppercase tracking-tight">7-Day Learning Companion</h1>
                            <p class="text-base font-bold text-orange-700 bg-white px-6 py-2 rounded-full shadow-sm print:shadow-none border border-orange-100 truncate w-full max-w-[90%]">${editablePlan?.classInformation.topic || 'Lesson Overview'}</p>
                        </div>
                    `;
                }

                return `
                    <div style="background:#fff; border:1px solid #cbd5e1; border-radius:14px; overflow:hidden; display:flex; flex-direction:column; height:100%; width:100%; box-sizing:border-box;">
                        <!-- Header -->
                        <div style="background:#f8fafc; padding:10px 16px; border-bottom:1px solid #e2e8f0; display:flex; align-items:center; gap:12px; flex-shrink:0;">
                            <div style="padding:5px 14px; background:#fff; border-radius:8px; color:#7c3aed; font-weight:700; font-size:16px; border:1px solid #e2e8f0; white-space:nowrap;">
                                Day ${d.day}
                            </div>
                            <div style="min-width:0; flex:1;">
                                <div style="font-size:17px; font-weight:700; color:#1e293b; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; line-height:1.3;">${d.focus || ''}</div>
                                <div style="font-size:13px; font-weight:500; color:#64748b; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-top:2px; line-height:1.2;">${d.focus_cn || ''}</div>
                            </div>
                        </div>

                        <!-- Body: 2 columns -->
                        <div style="padding:12px; display:flex; flex-direction:row; gap:12px; flex:1; min-height:0;">
                            <!-- LEFT COLUMN: Step-by-Step -->
                            <div style="flex:1; display:flex; flex-direction:column; min-height:0; min-width:0;">
                                <!-- Step-by-Step Tasks -->
                                <div style="flex:1; min-height:0; overflow:hidden; display:flex; flex-direction:column;">
                                    <div style="display:flex; align-items:center; gap:6px; padding-bottom:6px; margin-bottom:6px; border-bottom:1px solid #f1f5f9; flex-shrink:0;">
                                        <div style="background:#d1fae5; color:#059669; padding:4px; border-radius:6px; display:flex; align-items:center; justify-content:center;">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                                        </div>
                                        <span style="font-size:12px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">Step-by-Step Tasks</span>
                                    </div>
                                    <div style="flex:1; overflow:hidden;">
                                        ${(d.tasks && d.tasks.length > 0) ? d.tasks.map((task: any) => `
                                            <div style="display:flex; gap:8px; align-items:flex-start; padding:6px 8px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:5px;">
                                                <div style="width:16px; height:16px; flex-shrink:0; border-radius:3px; border:1.5px solid #94a3b8; margin-top:2px; background:#fff; display:flex; align-items:center; justify-content:center;">
                                                    ${task.isCompleted ? '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
                                                </div>
                                                <div style="flex:1; min-width:0;">
                                                    <div style="font-size:14px; font-weight:500; line-height:1.4; color:${task.isCompleted ? '#94a3b8' : '#334155'}; ${task.isCompleted ? 'text-decoration:line-through;' : ''}">${task.text}</div>
                                                    <div style="font-size:12px; line-height:1.3; margin-top:2px; color:${task.isCompleted ? '#cbd5e1' : '#64748b'};">${task.text_cn || ''}</div>
                                                </div>
                                            </div>
                                        `).join('') : '<p style="font-size:13px; color:#94a3b8; font-style:italic;">No tasks defined.</p>'}
                                    </div>
                                </div>
                            </div>

                            <!-- RIGHT COLUMN: Trivia + Resources -->
                            <div style="flex:1; display:flex; flex-direction:column; gap:10px; min-height:0; min-width:0;">
                                <!-- Trivia -->
                                <div style="background:#f5f3ff; padding:10px 12px; border-radius:10px; border:1px solid #ede9fe; flex:1; min-height:0; overflow:hidden; display:flex; flex-direction:column;">
                                    <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px; flex-shrink:0;">
                                        <div style="background:#ede9fe; color:#7c3aed; padding:4px; border-radius:6px; display:flex; align-items:center; justify-content:center;">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 10 14.5V17h4v-2.5c0-.663-.1-1.304-.293-1.893"/></svg>
                                        </div>
                                        <span style="font-size:12px; font-weight:700; color:#6d28d9; text-transform:uppercase; letter-spacing:0.05em;">Daily Trivia</span>
                                    </div>
                                    <div style="flex:1; overflow:hidden;">
                                        ${d.trivia ? `
                                            <p style="font-size:14px; font-weight:700; color:#4c1d95; line-height:1.5;">${d.trivia.en}</p>
                                            <p style="font-size:12px; color:#7c3aed; font-style:italic; margin-top:4px; line-height:1.4;">${d.trivia.cn}</p>
                                        ` : '<p style="font-size:13px; color:#94a3b8; font-style:italic;">No trivia generated.</p>'}
                                    </div>
                                </div>

                                <!-- Resources -->
                                <div style="background:#eef2ff; padding:10px 12px; border-radius:10px; border:1px solid #e0e7ff; flex:1; min-height:0; overflow:hidden; display:flex; flex-direction:column;">
                                    <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px; flex-shrink:0;">
                                        <div style="background:#e0e7ff; color:#4f46e5; padding:4px; border-radius:6px; display:flex; align-items:center; justify-content:center;">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                                        </div>
                                        <span style="font-size:12px; font-weight:700; color:#4338ca; text-transform:uppercase; letter-spacing:0.05em;">Explore More</span>
                                    </div>
                                    <div style="flex:1; overflow:hidden;">
                                        ${(d.resources || []).length > 0 ? (d.resources || []).map((r: any) => `
                                            <div style="display:flex; align-items:flex-start; gap:8px; padding:6px 10px; border-radius:8px; border:1px solid #e0e7ff80; background:#fff8; margin-bottom:5px; overflow:hidden;">
                                                <div style="margin-top:2px; background:#fff; padding:4px; border-radius:5px; box-shadow:0 1px 2px rgba(0,0,0,0.05); flex-shrink:0;">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#818cf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                                                </div>
                                                <div style="min-width:0; display:flex; flex-direction:column; justify-content:center; overflow:hidden;">
                                                    <span style="font-size:13px; font-weight:600; color:#312e81; line-height:1.3; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${r.title || r.title_cn}</span>
                                                    <span style="font-size:10px; color:#64748b; line-height:1.4; margin-top:2px;">${r.description_cn || r.description || ''}</span>
                                                </div>
                                            </div>
                                        `).join('') : '<p style="font-size:13px; color:#94a3b8; font-style:italic;">No external resources added.</p>'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            };

            const pages = [
                // Page 1: Cover + Day 1
                [{ isTitle: true }, editableReadingCompanion.days[0]],
                // Page 2: Day 2 + Day 3
                [editableReadingCompanion.days[1], editableReadingCompanion.days[2]],
                // Page 3: Day 4 + Day 5
                [editableReadingCompanion.days[3], editableReadingCompanion.days[4]],
                // Page 4: Day 6 + Day 7
                [editableReadingCompanion.days[5], editableReadingCompanion.days[6]],
            ];

            contentHtml = `
            <style>
                @media print {
                    @page { size: A4 portrait; margin: 0; }
                    body { 
                        -webkit-print-color-adjust: exact; 
                        print-color-adjust: exact; 
                        margin: 0 !important; 
                        padding: 0 !important; 
                        background: white; 
                    }
                    .viewer-container {
                        max-width: none !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }
                    .print-page {
                        height: 100vh !important;
                        width: 100vw !important;
                        padding: 8mm !important; 
                        page-break-after: always;
                        box-sizing: border-box;
                        overflow: hidden !important;
                    }
                    .print-page:last-child {
                        page-break-after: auto;
                    }
                }
                
                @media screen {
                    body {
                        background: #f1f5f9;
                        padding: 20px !important;
                    }
                    .viewer-container {
                        max-width: none !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }
                    .print-page {
                        width: 210mm;
                        height: 297mm;
                        padding: 8mm;
                        margin: 0 auto 20px;
                        background: white;
                        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
                        box-sizing: border-box;
                        overflow: hidden !important;
                    }
                }
            </style>
            
            ${pages.map((pageCards, pageIdx) => `
                <div class="print-page" style="display:flex; flex-direction:column; gap:8px;">
                    ${pageCards.filter(Boolean).map((c: any) => `
                        <div style="flex:1; min-height:0; overflow:hidden;">
                            ${renderCard(c, !!c.isTitle)}
                        </div>
                    `).join('')}
                </div>
            `).join('')}
        `;
        } else if (tabId === 'materials') {
            if (subTabId === 'flashcards') {
                title = `Flashcards: ${editablePlan?.classInformation.topic || 'Lesson'}`;
                contentHtml = `
                <div class="flex items-center gap-3 mb-8">${logoImgTag}<h1 class="text-3xl font-bold text-indigo-900">Teaching Flashcards</h1></div>
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
                        } else if (sec.layout === 'tracing') {
                            secContent = `
                                <div class="grid grid-cols-1 gap-8">
                                    ${sec.items.map((item, iIdx) => `
                                        <div class="space-y-2">
                                            <div class="text-sm text-gray-500 font-bold">${iIdx + 1}.</div>
                                            <div style="font-size:2rem; font-weight:700; letter-spacing:0.15em; text-align:center; color:transparent; -webkit-text-stroke:1.5px #c4b5a0; font-family:'Inter',sans-serif;">
                                                ${item.question}
                                            </div>
                                            <div style="position:relative; height:50px; border-top:1px dashed #93c5fd80; margin-top:8px;">
                                                <div style="position:absolute; top:33%; left:0; right:0; border-top:1px dashed #fca5a580;"></div>
                                                <div style="position:absolute; top:66%; left:0; right:0; border-top:2px solid #60a5fa99;"></div>
                                                <div style="position:absolute; bottom:0; left:0; right:0; border-top:1px dashed #93c5fd80;"></div>
                                            </div>
                                        </div>
                                    `).join('')}
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
                                <div class="flex items-center gap-3 mb-2">${logoImgTag}<h1 class="text-4xl font-black text-indigo-900">${ws.title}</h1></div>
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
                <div class="flex items-center gap-3 mb-8">${logoImgTag}<h1 class="text-3xl font-bold text-indigo-900">Lesson Infographic Handout</h1></div>
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
                <div class="flex items-center gap-3 mb-8">${logoImgTag}<h1 class="text-3xl font-bold text-indigo-900">Whiteboard Design Reference</h1></div>
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
                <div class="flex items-center gap-3 mb-8">${logoImgTag}<h1 class="text-3xl font-bold text-indigo-900">Phonics & Decodable Practice</h1></div>
                
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
        } else if (tabId === 'assignment' && assignmentSheet) {
            title = `课后作业单: ${editablePlan?.classInformation.topic || '课程'}`;
            const starDisplay = (score: number) => '★'.repeat(score) + '☆'.repeat(5 - score);
            const studentNameDisplay = assignmentSheet.studentName || '____________________';
            contentHtml = `
            <style>
                @media print {
                    @page { size: A4 portrait; margin: 10mm; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0 !important; padding: 0 !important; font-size: 12px; }
                    .viewer-container { max-width: none !important; padding: 0 !important; }
                }
            </style>
            <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #4f46e5; padding-bottom:10px; margin-bottom:10px;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <img src="${logoDataUri}" alt="Pathway Academy" style="width:48px; height:48px; object-fit:contain;" />
                    <div>
                        <h1 style="font-size:22px; font-weight:900; color:#1e1b4b; margin:0;">课后作业单</h1>
                        <div style="font-size:12px; color:#64748b; margin-top:2px;">Pathway Academy · After-Class Assignment Sheet</div>
                    </div>
                </div>
                <div style="text-align:right; font-size:12px; color:#475569;">
                    <div style="font-size:15px; font-weight:800; color:#4f46e5; margin-bottom:2px;">👤 ${studentNameDisplay}</div>
                    <div><strong>日期:</strong> ${editablePlan?.classInformation.date || '__________'}</div>
                    <div><strong>级别:</strong> ${editablePlan?.classInformation.level || '______'}</div>
                </div>
            </div>
            <div style="background:#eef2ff; border-radius:8px; padding:8px 14px; margin-bottom:12px; font-size:15px; font-weight:700; color:#312e81;">
                📚 课程主题: ${editablePlan?.classInformation.topic || '______'}
            </div>
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:10px 14px; margin-bottom:12px;">
                <h3 style="font-size:13px; font-weight:900; color:#4f46e5; margin:0 0 6px; text-transform:uppercase; letter-spacing:0.05em;">📖 本课内容总结</h3>
                <div style="font-size:12px; color:#334155; line-height:1.6; white-space:pre-wrap;">${assignmentSheet.lessonSummary || '（未填写）'}</div>
                ${assignmentSheet.keyPoints.length > 0 ? `
                    <div style="margin-top:8px; padding-top:8px; border-top:1px solid #e2e8f0;">
                        <div style="font-size:10px; font-weight:900; color:#94a3b8; text-transform:uppercase; margin-bottom:4px;">学习重点</div>
                        ${assignmentSheet.keyPoints.map(kp => `
                            <div style="font-size:12px; color:#1e293b; padding:3px 0; display:flex; gap:6px; white-space:pre-wrap;"><span style="color:#4f46e5; flex-shrink:0;">•</span> <span>${kp}</span></div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
            <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:10px; padding:10px 14px; margin-bottom:12px;">
                <h3 style="font-size:13px; font-weight:900; color:#d97706; margin:0 0 6px; text-transform:uppercase; letter-spacing:0.05em;">📝 作业清单</h3>
                ${assignmentSheet.assignments.map((a, i) => `
                    <div style="display:flex; gap:8px; align-items:flex-start; padding:6px 0; border-bottom:1px solid #fef3c7;">
                        <span style="width:22px; height:22px; border-radius:50%; background:#fbbf24; color:#fff; font-size:11px; font-weight:900; display:flex; align-items:center; justify-content:center; flex-shrink:0;">${i + 1}</span>
                        <div>
                            <div style="font-size:13px; font-weight:700; color:#1e293b;">${a.title} ${a.isFixed ? '<span style="font-size:9px; background:#fef3c7; color:#d97706; padding:1px 6px; border-radius:4px; font-weight:700;">固定</span>' : ''}</div>
                            ${a.description ? `<div style="font-size:11px; color:#64748b; margin-top:1px;">${a.description}</div>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
            <div style="background:#f5f3ff; border:1px solid #ddd6fe; border-radius:10px; padding:10px 14px;">
                <h3 style="font-size:13px; font-weight:900; color:#7c3aed; margin:0 0 8px; text-transform:uppercase; letter-spacing:0.05em;">⭐ 课堂表现反馈</h3>
                <div style="display:grid; grid-template-columns:repeat(5, 1fr); gap:6px; margin-bottom:10px;">
                    ${assignmentSheet.feedback.ratings.map(r => `
                        <div style="text-align:center; background:#fff; border:1px solid #ede9fe; border-radius:8px; padding:6px 4px;">
                            <div style="font-size:11px; font-weight:700; color:#4c1d95;">${r.dimension}</div>
                            <div style="font-size:9px; color:#a78bfa; margin-bottom:3px;">${r.dimension_en}</div>
                            <div style="font-size:14px; color:#eab308; letter-spacing:2px;">${starDisplay(r.score)}</div>
                        </div>
                    `).join('')}
                </div>
                ${assignmentSheet.showComment ? `
                <div style="background:#fff; border:1px solid #ede9fe; border-radius:8px; padding:8px 12px; min-height:${assignmentSheet.feedback.overallComment ? '40px' : '80px'};">
                    <div style="font-size:10px; font-weight:900; color:#a78bfa; text-transform:uppercase; margin-bottom:4px;">老师寄语</div>
                    <div style="font-size:12px; color:#334155; line-height:1.6; white-space:pre-wrap;">${assignmentSheet.feedback.overallComment || ''}</div>
                </div>
                ` : ''}
            </div>
            <div style="position:fixed; bottom:10mm; left:15mm; right:15mm; padding-top:8px; border-top:1px solid #e2e8f0; font-size:10px; color:#94a3b8;">
                <span>Pathway Academy · 课后作业单</span>
            </div>
            `;
        }

        const fullHtml = wrapViewerHtml(title, contentHtml, logoDataUri);

        win.document.write(fullHtml);
        win.document.close();
    };

    const triggerDownloadMd = (content: string, filename: string) => {
        const blob = new Blob([content], { type: 'text/markdown' });
        downloadBlob(blob, filename.endsWith('.md') ? filename : `${filename}.md`);
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
        const { default: JSZip } = await import('jszip');
        const zip = new JSZip();
        const topic = editablePlan?.classInformation.topic || 'Lesson';
        const safeTopic = topic.replace(/\s+/g, '_');

        const questionsMd = formatWorksheetQuestions(worksheets, topic);
        const answersMd = formatWorksheetAnswers(worksheets, topic);

        zip.file("Worksheet_Questions.md", questionsMd);
        zip.file("Worksheet_Answer_Key.md", answersMd);

        const blob = await zip.generateAsync({ type: "blob" });
        downloadBlob(blob, `Worksheets_${safeTopic}.zip`);
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

    const handleDownloadFlashcardPDF = (index: number) => {
        const card = localFlashcards[index];
        const imgData = flashcardImages?.[index];
        const doc = new jsPDF({
            orientation: "landscape",
            unit: "mm",
            format: [148, 105], // A6 Landscape
        });

        // Front Side (Image)
        if (imgData) {
            doc.addImage(imgData, "PNG", 10, 10, 128, 85);
            doc.addPage();
        }

        // Back Side (Explanation)
        doc.setFontSize(28);
        doc.setTextColor(79, 70, 229); // indigo-600
        doc.text(card.word, 148 / 2, 40, { align: "center" } as any);

        doc.setFontSize(14);
        doc.setTextColor(107, 114, 128); // slate-500
        doc.setFont("helvetica", "italic");
        const splitText = doc.splitTextToSize(card.definition, 120);
        doc.text(splitText, 148 / 2, 60, { align: "center" } as any);

        doc.save(
            `Flashcard_${card.word.replace(/\s+/g, "_")}_${editablePlan?.classInformation.topic.replace(/\s+/g, "_") || "Lesson"}.pdf`,
        );
    };

    const handleDownloadAllFlashcards = async () => {
        const W = 210; // A4 portrait width mm
        const H = 297; // A4 portrait height mm
        const IMG = 120; // 1:1 image size mm
        const M = (H - 2 * IMG) / 4; // equal margin ≈ 14.25mm

        const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

        // Process pairs of flashcards
        for (let p = 0; p < localFlashcards.length; p += 2) {
            if (p > 0) doc.addPage();

            const card1 = localFlashcards[p];
            const card2 = p + 1 < localFlashcards.length ? localFlashcards[p + 1] : null;
            const img1 = flashcardImages?.[p];
            const img2 = p + 1 < localFlashcards.length ? flashcardImages?.[p + 1] : undefined;

            // --- Page 1: Two images ---
            const imgX = (W - IMG) / 2; // center horizontally
            const y1 = M; // top image
            const y2 = M + IMG + 2 * M; // bottom image (M + IMG + M + M)

            // Image 1
            if (img1 && (img1.startsWith('data:') || img1.startsWith('http'))) {
                doc.addImage(img1, "PNG", imgX, y1, IMG, IMG);
            } else {
                doc.setDrawColor(220, 220, 230);
                doc.setLineWidth(0.4);
                doc.rect(imgX, y1, IMG, IMG);
                doc.setFontSize(18);
                doc.setTextColor(200, 200, 200);
                doc.text("No Image", W / 2, y1 + IMG / 2, { align: "center" } as any);
            }

            // Image 2
            if (card2) {
                if (img2 && (img2.startsWith('data:') || img2.startsWith('http'))) {
                    doc.addImage(img2, "PNG", imgX, y2, IMG, IMG);
                } else {
                    doc.setDrawColor(220, 220, 230);
                    doc.setLineWidth(0.4);
                    doc.rect(imgX, y2, IMG, IMG);
                    doc.setFontSize(18);
                    doc.setTextColor(200, 200, 200);
                    doc.text("No Image", W / 2, y2 + IMG / 2, { align: "center" } as any);
                }
            }

            // Dashed cut line at center
            doc.setDrawColor(200, 200, 210);
            doc.setLineWidth(0.3);
            doc.setLineDashPattern([3, 3], 0);
            doc.line(10, H / 2, W - 10, H / 2);
            // Scissors icon hint
            doc.setFontSize(7);
            doc.setTextColor(180, 180, 190);
            doc.text("✂", 6, H / 2 + 0.5);
            doc.setLineDashPattern([], 0);

            // --- Page 2: Two text cards ---
            doc.addPage();

            // Text card helper
            const renderTextCard = (card: typeof card1, cy: number) => {
                // Word — large bold
                doc.setFontSize(72);
                doc.setTextColor(79, 70, 229);
                doc.setFont("helvetica", "bold");
                doc.text(card.word, W / 2, cy - 10, { align: "center" } as any);

                // Divider
                doc.setDrawColor(200, 200, 220);
                doc.setLineWidth(0.4);
                doc.setLineDashPattern([], 0);
                doc.line(W * 0.2, cy + 4, W * 0.8, cy + 4);

                // Definition
                doc.setFontSize(22);
                doc.setTextColor(107, 114, 128);
                doc.setFont("helvetica", "italic");
                const splitDef = doc.splitTextToSize(card.definition, W * 0.75);
                doc.text(splitDef, W / 2, cy + 18, { align: "center" } as any);
            };

            // Card 1 text — centered in top half
            renderTextCard(card1, y1 + IMG / 2);

            // Card 2 text — centered in bottom half
            if (card2) renderTextCard(card2, y2 + IMG / 2);

            // Dashed cut line at center (same as image page)
            doc.setDrawColor(200, 200, 210);
            doc.setLineWidth(0.3);
            doc.setLineDashPattern([3, 3], 0);
            doc.line(10, H / 2, W - 10, H / 2);
            doc.setFontSize(7);
            doc.setTextColor(180, 180, 190);
            doc.text("✂", 6, H / 2 + 0.5);
            doc.setLineDashPattern([], 0);
        }

        doc.save(`Flashcards_${editablePlan?.classInformation.topic.replace(/\s+/g, "_") || "Lesson"}.pdf`);
    };

    /** Download all flashcard images as a 2×3 grid PDF, 8.5cm cards with borders, A4 portrait */
    const handleDownloadFlashcardImageGrid = () => {
        const W = 210; // A4 portrait mm
        const H = 297;
        const CARD = 80; // 8cm inner border
        const OUTER = 85; // 8.5cm dashed outer border (cut guide)
        const COLS = 2;
        const ROWS = 3;
        const PER_PAGE = COLS * ROWS;
        const gapX = (W - COLS * OUTER) / (COLS + 1);
        const gapY = (H - ROWS * OUTER) / (ROWS + 1);

        const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

        localFlashcards.forEach((card, i) => {
            if (i > 0 && i % PER_PAGE === 0) doc.addPage();
            const slot = i % PER_PAGE;
            const col = slot % COLS;
            const row = Math.floor(slot / COLS);
            // Center of this card slot
            const cx = gapX + OUTER / 2 + col * (OUTER + gapX);
            const cy = gapY + OUTER / 2 + row * (OUTER + gapY);

            // Dashed outer border (cut guide)
            doc.setDrawColor(200, 200, 210);
            doc.setLineWidth(0.3);
            doc.setLineDashPattern([2, 2], 0);
            doc.rect(cx - OUTER / 2, cy - OUTER / 2, OUTER, OUTER);

            // Solid inner border
            doc.setDrawColor(180, 180, 200);
            doc.setLineWidth(0.6);
            doc.setLineDashPattern([], 0);
            doc.rect(cx - CARD / 2, cy - CARD / 2, CARD, CARD);

            const x = cx - CARD / 2;
            const y = cy - CARD / 2;

            const imgData = flashcardImages?.[i];
            if (imgData && (imgData.startsWith('data:') || imgData.startsWith('http'))) {
                const pad = 3;
                doc.addImage(imgData, "PNG", x + pad, y + pad, CARD - pad * 2, CARD - pad * 2);
            } else {
                doc.setFontSize(12);
                doc.setTextColor(200, 200, 200);
                doc.text("No Image", x + CARD / 2, y + CARD / 2, { align: "center" } as any);
            }
        });

        doc.save(`Flashcard_Images_${editablePlan?.classInformation.topic.replace(/\s+/g, "_") || "Lesson"}.pdf`);
    };

    /** Download all flashcard text (word + definition) as a 2×3 grid PDF, 8.5cm cards with borders, A4 portrait */
    const handleDownloadFlashcardTextGrid = () => {
        const W = 210;
        const H = 297;
        const CARD = 80;
        const OUTER = 85;
        const COLS = 2;
        const ROWS = 3;
        const PER_PAGE = COLS * ROWS;
        const gapX = (W - COLS * OUTER) / (COLS + 1);
        const gapY = (H - ROWS * OUTER) / (ROWS + 1);

        const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

        localFlashcards.forEach((card, i) => {
            if (i > 0 && i % PER_PAGE === 0) doc.addPage();
            const slot = i % PER_PAGE;
            const col = slot % COLS;
            const row = Math.floor(slot / COLS);
            const cx = gapX + OUTER / 2 + col * (OUTER + gapX);
            const cy = gapY + OUTER / 2 + row * (OUTER + gapY);

            // Dashed outer border (cut guide)
            doc.setDrawColor(200, 200, 210);
            doc.setLineWidth(0.3);
            doc.setLineDashPattern([2, 2], 0);
            doc.rect(cx - OUTER / 2, cy - OUTER / 2, OUTER, OUTER);

            // Solid inner border
            doc.setDrawColor(180, 180, 200);
            doc.setLineWidth(0.6);
            doc.setLineDashPattern([], 0);
            doc.rect(cx - CARD / 2, cy - CARD / 2, CARD, CARD);

            const x = cx - CARD / 2;
            const y = cy - CARD / 2;

            // Word — auto-shrink to fit card width
            let wordFontSize = 32;
            doc.setFont("helvetica", "bold");
            doc.setTextColor(79, 70, 229);
            while (wordFontSize > 14) {
                doc.setFontSize(wordFontSize);
                const tw = doc.getTextWidth(card.word);
                if (tw <= CARD - 10) break;
                wordFontSize -= 2;
            }
            doc.text(card.word, x + CARD / 2, y + CARD * 0.38, { align: "center" } as any);

            // Divider
            doc.setDrawColor(200, 200, 220);
            doc.setLineWidth(0.3);
            doc.setLineDashPattern([], 0);
            doc.line(x + 10, y + CARD * 0.45, x + CARD - 10, y + CARD * 0.45);

            // Definition — auto-shrink to fit remaining card area
            let defFontSize = 12;
            doc.setFont("helvetica", "italic");
            doc.setTextColor(107, 114, 128);
            const maxDefHeight = CARD * 0.45; // available space below divider
            let splitDef: string[];
            while (defFontSize > 7) {
                doc.setFontSize(defFontSize);
                splitDef = doc.splitTextToSize(card.definition, CARD - 14);
                const lineH = defFontSize * 0.5;
                if (splitDef.length * lineH <= maxDefHeight) break;
                defFontSize -= 1;
            }
            doc.setFontSize(defFontSize);
            splitDef = doc.splitTextToSize(card.definition, CARD - 14);
            doc.text(splitDef!, x + CARD / 2, y + CARD * 0.55, { align: "center" } as any);
        });

        doc.save(`Flashcard_Text_${editablePlan?.classInformation.topic.replace(/\s+/g, "_") || "Lesson"}.pdf`);
    };

    return {
        openViewer,
        triggerDownloadMd,
        handleDownloadPlanMd,
        handleDownloadSlidesMd,
        handleDownloadWorksheetsMd,
        handleDownloadCompanionMd,
        handleDownloadGamesMd,
        handleDownloadFlashcardPDF,
        handleDownloadAllFlashcards,
        handleDownloadFlashcardImageGrid,
        handleDownloadFlashcardTextGrid,
    };
};
