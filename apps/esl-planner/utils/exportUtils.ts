import JSZip from 'jszip';
import React from 'react';
import { SavedLesson } from '../types';
import {
    formatLessonPlanMd,
    formatSlidesMd,
    formatGamesMd,
    formatCompanionMd,
    formatWorksheetQuestionsMd,
    formatWorksheetAnswersMd
} from './formatters';

export const handleDownloadZip = async (
    lesson: SavedLesson,
    setIsExporting: (id: string | null) => void,
    e: React.MouseEvent
) => {
    e.stopPropagation();
    setIsExporting(lesson.id);
    try {
        const zip = new JSZip();
        const content = lesson.content;
        const topic = (content.structuredLessonPlan.classInformation.topic || lesson.topic).replace(/[^a-z0-9]/gi, '_').toLowerCase();

        zip.file("1_Lesson_Plan.md", formatLessonPlanMd(content.structuredLessonPlan));
        zip.file("2_Slides_Outline.md", formatSlidesMd(content.slides));
        zip.file("3_Classroom_Games.md", formatGamesMd(content.games));
        zip.file("4_Review_Companion.md", formatCompanionMd(content.readingCompanion));

        if (content.worksheets) {
            zip.file("5a_Worksheet_Questions.md", formatWorksheetQuestionsMd(content.worksheets));
            zip.file("5b_Worksheet_Answer_Key.md", formatWorksheetAnswersMd(content.worksheets));
        }

        let flashcardsMd = `# Teaching Flashcards\n\n`;
        content.flashcards.forEach(c => {
            flashcardsMd += `## ${c.word}\n- **Definition:** ${c.definition}\n- **Visual Prompt:** ${c.visualPrompt}\n\n`;
        });

        zip.file("6_Flashcards_List.md", flashcardsMd);
        zip.file("NotebookLM_Slide_Prompt.txt", content.notebookLMPrompt);

        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `ESL_Kit_${topic}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (err) {
        console.error("Export failed", err);
        alert("Export failed. Please try again.");
    } finally {
        setIsExporting(null);
    }
};
