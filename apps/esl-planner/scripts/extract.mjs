import fs from 'fs';
import path from 'path';

const inputPath = path.join(process.cwd(), 'components', 'OutputDisplay.tsx');
const outputPath = path.join(process.cwd(), 'hooks', 'useExportUtils.ts');

const content = fs.readFileSync(inputPath, 'utf-8');
const lines = content.split('\n');

const startIdx = lines.findIndex(l => l.includes('const openViewer = '));
const endIdx = lines.findIndex(l => l.includes("triggerDownloadMd(md, `Games_Activities_${editablePlan?.classInformation.topic.replace(/\\s+/g, '_') || 'Lesson'}`);")) + 2;

console.log('Start line:', startIdx + 1);
console.log('End line:', endIdx + 1);

const extractedCode = lines.slice(startIdx, endIdx).join('\n');

const hookTemplate = `
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

${extractedCode.split('\\n').map(l => '    ' + l).join('\\n')}

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
`;

// Ensure hooks directory exists
if (!fs.existsSync(path.join(process.cwd(), 'hooks'))) {
    fs.mkdirSync(path.join(process.cwd(), 'hooks'));
}

fs.writeFileSync(outputPath, hookTemplate.trim() + '\\n', 'utf-8');
console.log('Extracted to hooks/useExportUtils.ts');

// Now remove it from OutputDisplay.tsx
const newOutputDisplayLines = [
    ...lines.slice(0, startIdx),
    ...lines.slice(endIdx)
];

fs.writeFileSync(inputPath, newOutputDisplayLines.join('\n'), 'utf-8');
console.log('Removed from OutputDisplay.tsx');
