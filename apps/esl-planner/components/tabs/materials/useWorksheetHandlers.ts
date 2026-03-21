import { useState } from 'react';
import {
    Worksheet,
    WorksheetItem,
    WorksheetSection,
    StructuredLessonPlan,
    CEFRLevel,
} from '../../../types';
import {
    generateWorksheet,
    generateReadingPassage,
} from '../../../services/worksheetService';
import { generateLessonImage } from '../../../services/lessonKitService';
import { WorksheetLayoutActions } from './layouts';
import { useLanguage } from '../../../i18n/LanguageContext';
import { useAuthStore } from '@shared/stores/useAuthStore';
import { handleError } from '@shared/services/logger';
import { useToast } from '@shared/stores/useToast';
import * as edu from '@pathway/education';

interface UseWorksheetHandlersArgs {
    worksheets: Worksheet[];
    setWorksheets: (ws: Worksheet[]) => void;
    editablePlan: StructuredLessonPlan | null;
}

export function useWorksheetHandlers({
    worksheets,
    setWorksheets,
    editablePlan,
}: UseWorksheetHandlersArgs) {
    const { t } = useLanguage();
    const teacherId = useAuthStore((s) => s.user?.id);

    const [regeneratingSectionId, setRegeneratingSectionId] = useState<
        string | null
    >(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    // Assigning state
    const [isAssignOpen, setIsAssignOpen] = useState(false);
    const [isAssigning, setIsAssigning] = useState(false);
    const [assignError, setAssignError] = useState('');
    const [assignSuccess, setAssignSuccess] = useState('');

    const [isGeneratingPassageId, setIsGeneratingPassageId] = useState<
        string | null
    >(null);

    // Worksheet Image Generation State
    const [generatingWsImageKey, setGeneratingWsImageKey] = useState<
        string | null
    >(null);

    // New Section Generator State
    const [isQuickGenerating, setIsQuickGenerating] = useState(false);
    const [quickGenConfig, setQuickGenConfig] = useState({
        skill: 'Vocabulary',
        type: 'Random',
        level: editablePlan?.classInformation.level || CEFRLevel.A1,
        articleType: '',
        description: '',
        count: 5,
    });

    // ── Handlers ──

    const handleWorksheetItemChange = (
        wsIdx: number,
        sIdx: number,
        itemIdx: number,
        field: keyof WorksheetItem,
        value: any,
    ) => {
        const newWorksheets = [...worksheets];
        const ws = { ...newWorksheets[wsIdx] };
        if (!ws.sections) return;
        const section = { ...ws.sections[sIdx] };
        const items = [...section.items];
        items[itemIdx] = { ...items[itemIdx], [field]: value };
        section.items = items;
        ws.sections[sIdx] = section;
        newWorksheets[wsIdx] = ws;
        setWorksheets(newWorksheets);
    };

    const addWorksheetItem = (wsIdx: number, sIdx: number) => {
        const newWorksheets = [...worksheets];
        const ws = { ...newWorksheets[wsIdx] };
        if (!ws.sections) return;
        const section = { ...ws.sections[sIdx] };
        const newItem: WorksheetItem = {
            question: 'New Question',
            answer: '',
            visualPrompt: '',
        };
        if (section.layout === 'multiple-choice') {
            newItem.options = ['Option A', 'Option B', 'Option C', 'Option D'];
        }
        if (section.layout === 'essay') {
            newItem.wordCount = 50;
        }
        section.items = [...section.items, newItem];
        ws.sections[sIdx] = section;
        newWorksheets[wsIdx] = ws;
        setWorksheets(newWorksheets);
    };

    const removeWorksheetItem = (
        wsIdx: number,
        sIdx: number,
        itemIdx: number,
    ) => {
        const newWorksheets = [...worksheets];
        const ws = { ...newWorksheets[wsIdx] };
        if (!ws.sections) return;
        const section = { ...ws.sections[sIdx] };
        section.items = section.items.filter((_, i) => i !== itemIdx);
        ws.sections[sIdx] = section;
        newWorksheets[wsIdx] = ws;
        setWorksheets(newWorksheets);
    };

    const moveWorksheetItem = (
        wsIdx: number,
        sIdx: number,
        itemIdx: number,
        direction: 'up' | 'down',
    ) => {
        const newWorksheets = [...worksheets];
        const ws = { ...newWorksheets[wsIdx] };
        if (!ws.sections) return;
        const section = { ...ws.sections[sIdx] };
        const items = [...section.items];
        const targetIdx = direction === 'up' ? itemIdx - 1 : itemIdx + 1;
        if (targetIdx < 0 || targetIdx >= items.length) return;
        [items[itemIdx], items[targetIdx]] = [items[targetIdx], items[itemIdx]];
        section.items = items;
        ws.sections[sIdx] = section;
        newWorksheets[wsIdx] = ws;
        setWorksheets(newWorksheets);
    };

    const addWorksheetSection = (wsIdx: number) => {
        const newWorksheets = [...worksheets];
        const ws = { ...newWorksheets[wsIdx] };
        const newSection: WorksheetSection = {
            title: 'New Section',
            description: 'Section instructions...',
            layout: 'standard',
            items: [{ question: 'Question 1', answer: '', visualPrompt: '' }],
        };
        ws.sections = [...(ws.sections || []), newSection];
        newWorksheets[wsIdx] = ws;
        setWorksheets(newWorksheets);
    };

    const removeWorksheetSection = (wsIdx: number, sIdx: number) => {
        const newWorksheets = [...worksheets];
        const ws = { ...newWorksheets[wsIdx] };
        if (ws.sections) {
            ws.sections = ws.sections.filter((_, i) => i !== sIdx);
            newWorksheets[wsIdx] = ws;
            setWorksheets(newWorksheets);
        }
    };

    const handleWorksheetSectionLayoutChange = (
        wsIdx: number,
        sIdx: number,
        layout: any,
    ) => {
        const newWorksheets = [...worksheets];
        const ws = { ...newWorksheets[wsIdx] };
        if (ws.sections) {
            const section = ws.sections[sIdx];
            section.layout = layout;
            if (layout === 'multiple-choice') {
                section.items = section.items.map((item) => ({
                    ...item,
                    options: item.options || [
                        'Choice 1',
                        'Choice 2',
                        'Choice 3',
                        'Choice 4',
                    ],
                }));
            }
            if (layout === 'essay') {
                section.items = section.items.map((item) => ({
                    ...item,
                    wordCount: item.wordCount || 50,
                }));
            }
            newWorksheets[wsIdx] = ws;
            setWorksheets(newWorksheets);
        }
    };

    const handleRegenerateWorksheetSection = async (
        wsIdx: number,
        sIdx: number,
    ) => {
        if (!editablePlan || regeneratingSectionId) return;
        const ws = worksheets[wsIdx];
        if (!ws.sections) return;
        const section = ws.sections[sIdx];

        setRegeneratingSectionId(`${wsIdx}-${sIdx}`);
        try {
            let skill = 'Mixed';
            if (section.title.toLowerCase().includes('vocabulary'))
                skill = 'Vocabulary';
            else if (section.title.toLowerCase().includes('grammar'))
                skill = 'Grammar';
            else if (section.title.toLowerCase().includes('reading'))
                skill = 'Reading Comprehension';
            else if (section.title.toLowerCase().includes('listening'))
                skill = 'Listening Comprehension';

            const typeStr =
                section.layout === 'multiple-choice'
                    ? 'Multiple Choice'
                    : section.layout === 'matching'
                        ? 'Matching'
                        : 'Mixed';

            const newWs = await generateWorksheet(
                editablePlan.classInformation.level as CEFRLevel,
                editablePlan.classInformation.topic,
                [{ skill, type: typeStr, count: section.items.length || 5 }],
            );

            if (newWs.sections && newWs.sections.length > 0) {
                const newWorksheets = [...worksheets];
                const targetWs = { ...newWorksheets[wsIdx] };
                if (targetWs.sections) {
                    targetWs.sections[sIdx] = newWs.sections[0];
                    newWorksheets[wsIdx] = targetWs;
                    setWorksheets(newWorksheets);
                }
            }
        } catch (e: unknown) {
            console.error('Regeneration failed', e);
        } finally {
            setRegeneratingSectionId(null);
        }
    };

    const handleQuickGenerateSection = async () => {
        if (!editablePlan || isQuickGenerating) return;
        setIsQuickGenerating(true);
        try {
            const config = { ...quickGenConfig };

            if (config.type === 'Picture Description') {
                config.type = 'Picture Description';
            }

            const newWs = await generateWorksheet(
                quickGenConfig.level as CEFRLevel,
                editablePlan.classInformation.topic,
                [{ ...config }],
            );

            if (newWs.sections && newWs.sections.length > 0) {
                const newWorksheets = [...worksheets];
                if (newWorksheets.length === 0) {
                    newWorksheets.push({
                        title: 'Generated Worksheet',
                        type: 'Review',
                        instructions: 'Please complete the following exercises.',
                        sections: [newWs.sections[0]],
                    });
                } else {
                    const ws = { ...newWorksheets[0] };
                    ws.sections = [...(ws.sections || []), newWs.sections[0]];
                    newWorksheets[0] = ws;
                }
                setWorksheets(newWorksheets);
            }
        } catch (e: unknown) {
            console.error('Quick Gen failed', e);
        } finally {
            setIsQuickGenerating(false);
        }
    };

    const handleGenerateWorksheetImage = async (
        wsIdx: number,
        sIdx: number,
        itemIdx: number,
        promptText: string,
    ) => {
        const key = `${wsIdx}-${sIdx}-${itemIdx}`;
        if (generatingWsImageKey) return;
        setGeneratingWsImageKey(key);
        try {
            const safePrompt = promptText.trim() || 'educational illustration';
            const enhancedPrompt = `A simple, clear educational illustration of "${safePrompt}" for an English student's worksheet. Clean white background, no text, professional line-art or 2D vector style.`;
            const imageUrl = await generateLessonImage(enhancedPrompt, '4:3');
            handleWorksheetItemChange(wsIdx, sIdx, itemIdx, 'imageUrl', imageUrl);
        } catch (e: unknown) {
            console.error('Worksheet image generation failed', e);
        } finally {
            setGeneratingWsImageKey(null);
        }
    };

    const handleGeneratePassage = async (wsIdx: number, sIdx: number) => {
        if (!editablePlan || isGeneratingPassageId) return;
        setIsGeneratingPassageId(`${wsIdx}-${sIdx}`);
        try {
            const vocab = editablePlan.lessonDetails.targetVocab.map((v) => v.word);
            const result = await generateReadingPassage(
                editablePlan.classInformation.level,
                editablePlan.classInformation.topic,
                vocab,
            );
            const newWorksheets = [...worksheets];
            if (newWorksheets[wsIdx].sections) {
                newWorksheets[wsIdx].sections[sIdx].passage = result.text;
                newWorksheets[wsIdx].sections[sIdx].passageTitle = result.title;
            }
            setWorksheets(newWorksheets);
        } catch (e: unknown) {
            console.error('Passage generation failed', e);
        } finally {
            setIsGeneratingPassageId(null);
        }
    };

    const actions: WorksheetLayoutActions = {
        handleWorksheetItemChange,
        handleGenerateWorksheetImage,
        moveWorksheetItem,
        removeWorksheetItem,
        addWorksheetItem,
        handleGeneratePassage,
    };

    const handleAssign = async (classId: string, dueDate: string) => {
        if (!teacherId || !editablePlan || worksheets.length === 0) return;
        setIsAssigning(true);
        setAssignError('');
        setAssignSuccess('');

        try {
            const dataToAssign = worksheets[0];

            const assignment = await edu.upsertAssignment({
                teacher_id: teacherId,
                title:
                    dataToAssign.title ||
                    editablePlan.classInformation.topic ||
                    'Worksheet',
                description:
                    dataToAssign.instructions ||
                    `A ${editablePlan.classInformation.level || ''} level worksheet about ${editablePlan.classInformation.topic || 'English'}.`,
                class_id: classId,
                content_type: 'worksheet',
                content_data: dataToAssign,
                due_date: dueDate || null,
            } as any);

            if (assignment) {
                const clsStudents = await edu.fetchClassStudents(classId);
                const sids = clsStudents.map((cs) => cs.student_id);
                await edu.createSubmissionsForClass(assignment.id, sids);

                setIsAssignOpen(false);
                // setAssignSuccess(''); // Removed as per instruction
                // setTimeout(() => { // Removed as per instruction
                //     setIsAssignOpen(false);
                //     setAssignSuccess('');
                // }, 2000); // Removed as per instruction
                useToast.getState().success(t('assign.success') as string);
            } else {
                // setAssignError(t('assign.error') as string); // Removed as per instruction
                useToast.getState().error(t('assign.error') as string);
            }
        } catch (e: unknown) {
            console.error('Assignment failed:', e);
            // setAssignError(handleError(e, t('assign.error'), 'WorksheetsTab')); // Removed as per instruction
            useToast.getState().error(t('assign.error') as string);
        } finally {
            setIsAssigning(false);
        }
    };

    return {
        // State
        regeneratingSectionId,
        selectedId,
        setSelectedId,
        isAssignOpen,
        setIsAssignOpen,
        isAssigning,
        assignError,
        assignSuccess,
        isGeneratingPassageId,
        generatingWsImageKey,
        isQuickGenerating,
        quickGenConfig,
        setQuickGenConfig,

        // Handlers
        handleWorksheetItemChange,
        addWorksheetItem,
        removeWorksheetItem,
        moveWorksheetItem,
        addWorksheetSection,
        removeWorksheetSection,
        handleWorksheetSectionLayoutChange,
        handleRegenerateWorksheetSection,
        handleQuickGenerateSection,
        handleGenerateWorksheetImage,
        handleGeneratePassage,
        handleAssign,

        // Composed
        actions,
    };
}
