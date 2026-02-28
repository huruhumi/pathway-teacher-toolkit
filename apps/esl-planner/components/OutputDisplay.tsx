import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GeneratedContent, Slide, StructuredLessonPlan, Flashcard, ReadingCompanionContent, WebResource, ReadingPlanDay, ReadingTask, Game, Worksheet, WorksheetItem, WorksheetSection, LessonStage, PhonicsContent, CEFRLevel } from '../types';
import { BookOpen, Presentation, Gamepad2, GraduationCap, Copy, Check, Download, Palette, Sparkles, Loader2, Image as ImageIcon, Plus, Trash2, Layers, GripVertical, FileText, Globe, Lightbulb, CheckSquare, Save, X, Bot, FileQuestion, CircleStop, AlertCircle, Wrench, ChevronUp, ChevronDown, RefreshCw, FileCheck, ExternalLink, Edit2, Filter, Columns, List, BookOpen as ReadingIcon, Image as LucideImage, Music, FileCheck as AnswerKeyIcon, Info, PencilLine } from 'lucide-react';
import { generateLessonImage, generateReadingTask, generateWebResource, generateTrivia, generateWorksheet, generateNewCompanionDay, generateSingleGame, generateSingleFlashcard, generateSingleGrammarPoint, generateSinglePhonicsPoint, generateSingleDecodableText, generateSingleObjective, generateSingleMaterial, generateSingleVocabItem, generateSingleAnticipatedProblem, generateSingleStage, generateReadingPassage, translateLessonKit } from '../services/geminiService';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import { useExportUtils } from '../hooks/useExportUtils';
import { useAutoSave } from '../hooks/useAutoSave';
import { useDocxExport } from '../hooks/useDocxExport';
import { usePptxExport } from '../hooks/usePptxExport';
import { LessonPlanTab } from './tabs/LessonPlanTab';
import { SlidesTab } from './tabs/SlidesTab';
import { ActivitiesTab } from './tabs/ActivitiesTab';
import { CompanionTab } from './tabs/CompanionTab';

interface OutputDisplayProps {
    content: GeneratedContent;
    onSave: (content: GeneratedContent) => void;
}

const ASPECT_RATIOS = [
    { label: 'Square (1:1)', value: '1:1' },
    { label: 'Landscape (4:3)', value: '4:3' },
    { label: 'Portrait (3:4)', value: '3:4' },
    { label: 'Wide (16:9)', value: '16:9' },
    { label: 'Tall (9:16)', value: '9:16' },
];

const INDIGO_COLOR = '#4f46e5';

interface AutoResizeTextareaProps {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    className?: string;
    placeholder?: string;
    minRows?: number;
    maxHeight?: string;
}

const AutoResizeTextarea: React.FC<AutoResizeTextareaProps> = ({
    value,
    onChange,
    className,
    placeholder,
    minRows = 1,
    maxHeight
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            const scrollHeight = textareaRef.current.scrollHeight;

            if (maxHeight && scrollHeight > parseInt(maxHeight)) {
                textareaRef.current.style.height = maxHeight;
                textareaRef.current.style.overflowY = 'auto';
            } else {
                textareaRef.current.style.height = `${scrollHeight}px`;
                textareaRef.current.style.overflowY = 'hidden';
            }
        }
    }, [value, maxHeight]);

    return (
        <textarea
            ref={textareaRef}
            value={value}
            onChange={onChange}
            className={`${className} resize-none box-border block`}
            rows={minRows}
            placeholder={placeholder}
        />
    );
};

// Component for Correction Legend
const CorrectionLegend = () => (
    <div className="bg-white border-2 border-indigo-100 rounded-2xl p-4 shadow-sm viewer-correction-legend">
        <h5 className="text-[10px] font-black text-indigo-900 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Info className="w-3 h-3 text-indigo-500" />
            Proofreading Marks Reference / 修改符号参考
        </h5>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
                <span className="w-6 h-6 bg-indigo-50 rounded flex items-center justify-center font-bold text-indigo-600">^</span>
                <span className="text-[10px] font-medium text-gray-600">Insert / 插入</span>
            </div>
            <div className="flex items-center gap-2">
                <span className="w-6 h-6 bg-indigo-50 rounded flex items-center justify-center font-bold text-indigo-600">/</span>
                <span className="text-[10px] font-medium text-gray-600">Delete / 删除</span>
            </div>
            <div className="flex items-center gap-2">
                <span className="w-6 h-6 bg-indigo-50 rounded flex items-center justify-center font-bold text-indigo-600">○</span>
                <span className="text-[10px] font-medium text-gray-600">Replace / 替换</span>
            </div>
            <div className="flex items-center gap-2">
                <span className="w-6 h-6 bg-indigo-50 rounded flex items-center justify-center font-bold text-indigo-600">~</span>
                <span className="text-[10px] font-medium text-gray-600">Spelling / 拼写</span>
            </div>
        </div>
    </div>
);

export const OutputDisplay: React.FC<OutputDisplayProps> = ({ content, onSave }) => {
    const viewLang = 'en';

    const [activeTab, setActiveTab] = useState<'plan' | 'slides' | 'materials' | 'games' | 'companion'>('plan');
    const [isSaving, setIsSaving] = useState(false);
    const [materialTab, setMaterialTab] = useState<'flashcards' | 'worksheets' | 'grammar' | 'phonics' | 'whiteboard'>('flashcards');

    const [editableSlides, setEditableSlides] = useState<Slide[]>(content.slides || []);
    const [editablePlan, setEditablePlan] = useState<StructuredLessonPlan | null>(content.structuredLessonPlan || null);
    const [editableReadingCompanion, setEditableReadingCompanion] = useState<ReadingCompanionContent>(content.readingCompanion);
    const [editableGames, setEditableGames] = useState<Game[]>(content.games || []);
    const [worksheets, setWorksheets] = useState<Worksheet[]>(content.worksheets || []);

    // Migration logic for decodableText -> decodableTexts and adding Prompts
    const initialPhonics = useMemo(() => {
        const raw = content.phonics;
        if (!raw) return { keyPoints: [], decodableTexts: [], decodableTextPrompts: [] };
        const texts = raw.decodableTexts || ((raw as any).decodableText ? [(raw as any).decodableText] : []);
        const prompts = raw.decodableTextPrompts || texts.map(() => "");
        return { ...raw, decodableTexts: texts, decodableTextPrompts: prompts };
    }, [content.phonics]);

    const [phonicsContent, setPhonicsContent] = useState<PhonicsContent>(initialPhonics);
    const [grammarInfographicUrl, setGrammarInfographicUrl] = useState<string | undefined>(content.grammarInfographicUrl);
    const [blackboardImageUrl, setBlackboardImageUrl] = useState<string | undefined>(content.blackboardImageUrl);
    const [customGrammarPrompt, setCustomGrammarPrompt] = useState('');
    const [customWhiteboardPrompt, setCustomWhiteboardPrompt] = useState('');
    const [isGeneratingGrammar, setIsGeneratingGrammar] = useState(false);
    const [isGeneratingWhiteboard, setIsGeneratingWhiteboard] = useState(false);
    const [isGeneratingSingleGrammar, setIsGeneratingSingleGrammar] = useState(false);
    const [isGeneratingPhonicsPoint, setIsGeneratingPhonicsPoint] = useState(false);
    const [isGeneratingDecodableText, setIsGeneratingDecodableText] = useState(false);

    const [localFlashcards, setLocalFlashcards] = useState<Flashcard[]>(content.flashcards || []);
    const [flashcardImages, setFlashcardImages] = useState<Record<number, string>>(content.flashcardImages || {});
    const [generatingCardIndex, setGeneratingCardIndex] = useState<number | null>(null);
    const [isGeneratingAll, setIsGeneratingAll] = useState(false);
    const stopGeneratingRef = useRef(false);
    const [cardConfigs, setCardConfigs] = useState<Record<number, { ratio: string, isEditing: boolean }>>({});
    const [isAddingFlashcard, setIsAddingFlashcard] = useState(false);

    const [decodableTextImages, setDecodableTextImages] = useState<Record<number, string>>(content.decodableTextImages || {});
    const [generatingDtImageIndex, setGeneratingDtImageIndex] = useState<number | null>(null);


    const [regeneratingSectionId, setRegeneratingSectionId] = useState<string | null>(null);
    const [isGeneratingPassageId, setIsGeneratingPassageId] = useState<string | null>(null);

    // Worksheet Image Generation State
    const [generatingWsImageKey, setGeneratingWsImageKey] = useState<string | null>(null);

    // New Section Generator State
    const [isQuickGenerating, setIsQuickGenerating] = useState(false);
    const [quickGenConfig, setQuickGenConfig] = useState({
        skill: 'Vocabulary',
        type: 'Random',
        level: content.structuredLessonPlan?.classInformation.level || CEFRLevel.A1,
        articleType: '',
        description: '',
        count: 5
    });

    const skills = [
        "Random", "Vocabulary", "Grammar", "Phonics", "Reading", "Listening", "Speaking",
        "Writing", "Pronunciation", "Critical Thinking", "Idioms & Slang",
        "Presentation Skills", "Culture & Etiquette", "Problem Solving", "Social English"
    ];

    const questionTypes = [
        "Random",
        "Multiple Choice",
        "Fill in the blanks",
        "Cloze Test",
        "Error Correction",
        "Matching",
        "Open Question",
        "True/False",
        "Sentence Unscramble",
        "Error Correction",
        "Picture Description",
        "Translation",
        "Essay",
        "Categorization",
        "Synonyms/Antonyms"
    ];

    const articleTypes = [
        "",
        "Random",
        "Short Story",
        "News Article",
        "Dialogue/Conversation",
        "Informational Text",
        "Email/Letter",
        "Opinion Piece",
        "Scientific Report",
        "Instructions/Manual",
        "Advertisement"
    ];

    useEffect(() => {
        setEditableSlides(content.slides || []);
        setEditablePlan(content.structuredLessonPlan || null);
        setEditableReadingCompanion(content.readingCompanion);
        setLocalFlashcards(content.flashcards || []);
        setEditableGames((content.games || []).map(g => ({ ...g, isCompleted: false })));
        setWorksheets(content.worksheets || []);
        setGrammarInfographicUrl(content.grammarInfographicUrl);
        setBlackboardImageUrl(content.blackboardImageUrl);

        const rawPhonics = content.phonics || { keyPoints: [], decodableTexts: [], decodableTextPrompts: [] };
        const texts = rawPhonics.decodableTexts || ((rawPhonics as any).decodableText ? [(rawPhonics as any).decodableText] : []);
        const prompts = rawPhonics.decodableTextPrompts || texts.map(() => "");
        setPhonicsContent({ ...rawPhonics, decodableTexts: texts, decodableTextPrompts: prompts });
    }, [content]);
    // --- VIEWER & EXPORT LOGIC ---
    const {
        openViewer,
        triggerDownloadMd,
        handleDownloadPlanMd,
        handleDownloadSlidesMd,
        handleDownloadWorksheetsMd,
        handleDownloadCompanionMd,
        handleDownloadGamesMd
    } = useExportUtils({
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
    });
    const getCurrentContentObject = (): GeneratedContent => ({
        ...content,
        structuredLessonPlan: editablePlan!,
        slides: editableSlides,
        flashcards: localFlashcards,
        games: editableGames,
        readingCompanion: editableReadingCompanion,
        worksheets: worksheets,
        grammarInfographicUrl: grammarInfographicUrl,
        blackboardImageUrl: blackboardImageUrl,
        phonics: phonicsContent,
        flashcardImages: flashcardImages,
        decodableTextImages: decodableTextImages
    });

    const { saveStatus, lastSaved, saveNow } = useAutoSave({
        getCurrentContentObject,
        onSave,
        dualContent: { en: content, cn: null },
        setDualContent: () => { },
        viewLang: 'en',
        editablePlan,
    });

    const { exportLessonPlanDocx } = useDocxExport();
    const { exportSlidesPptx } = usePptxExport();

    const handleDownloadDocx = () => {
        if (editablePlan) exportLessonPlanDocx(getCurrentContentObject());
    };

    const handleDownloadPptx = () => {
        exportSlidesPptx(editableSlides, editablePlan?.classInformation.topic || 'slides');
    };

    const handlePlanInfoChange = (section: keyof StructuredLessonPlan, field: string, value: string) => {
        if (!editablePlan) return;
        setEditablePlan({ ...editablePlan, [section]: { ...editablePlan[section as keyof StructuredLessonPlan], [field]: value } } as any);
    };

    const handleArrayChange = (field: 'objectives' | 'materials' | 'grammarSentences', index: number, value: string) => {
        if (!editablePlan) return;
        const newArray = [...(editablePlan.lessonDetails[field] as string[])];
        newArray[index] = value;
        setEditablePlan({ ...editablePlan, lessonDetails: { ...editablePlan.lessonDetails, [field]: newArray } });
    };

    const deleteArrayItem = (field: 'objectives' | 'materials' | 'grammarSentences', index: number) => {
        if (!editablePlan) return;
        const newArray = [...(editablePlan.lessonDetails[field] as string[])];
        newArray.splice(index, 1);
        setEditablePlan({ ...editablePlan, lessonDetails: { ...editablePlan.lessonDetails, [field]: newArray } });
    };

    const deleteMaterialEntry = (index: number) => {
        if (!editablePlan) return;
        const newArray = [...editablePlan.lessonDetails.materials];
        newArray.splice(index, 1);
        setEditablePlan({ ...editablePlan, lessonDetails: { ...editablePlan.lessonDetails, materials: newArray } });
    };

    const moveArrayItem = (field: 'objectives' | 'materials' | 'grammarSentences', index: number, direction: 'up' | 'down') => {
        if (!editablePlan) return;
        const newArray = [...(editablePlan.lessonDetails[field] as string[])];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= newArray.length) return;
        [newArray[index], newArray[targetIndex]] = [newArray[targetIndex], newArray[index]];
        setEditablePlan({ ...editablePlan, lessonDetails: { ...editablePlan.lessonDetails, [field]: newArray } });
    };





    const handleWorksheetItemChange = (wsIdx: number, sIdx: number, itemIdx: number, field: keyof WorksheetItem, value: any) => {
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
        const newItem: WorksheetItem = { question: "New Question", answer: "", visualPrompt: "" };
        if (section.layout === 'multiple-choice') {
            newItem.options = ["Option A", "Option B", "Option C", "Option D"];
        }
        if (section.layout === 'essay') {
            newItem.wordCount = 50;
        }
        section.items = [...section.items, newItem];
        ws.sections[sIdx] = section;
        newWorksheets[wsIdx] = ws;
        setWorksheets(newWorksheets);
    };

    const removeWorksheetItem = (wsIdx: number, sIdx: number, itemIdx: number) => {
        const newWorksheets = [...worksheets];
        const ws = { ...newWorksheets[wsIdx] };
        if (!ws.sections) return;
        const section = { ...ws.sections[sIdx] };
        section.items = section.items.filter((_, i) => i !== itemIdx);
        ws.sections[sIdx] = section;
        newWorksheets[wsIdx] = ws;
        setWorksheets(newWorksheets);
    };

    const moveWorksheetItem = (wsIdx: number, sIdx: number, itemIdx: number, direction: 'up' | 'down') => {
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
            title: "New Section",
            description: "Section instructions...",
            layout: 'standard',
            items: [{ question: "Question 1", answer: "", visualPrompt: "" }]
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

    const handleWorksheetSectionLayoutChange = (wsIdx: number, sIdx: number, layout: any) => {
        const newWorksheets = [...worksheets];
        const ws = { ...newWorksheets[wsIdx] };
        if (ws.sections) {
            const section = ws.sections[sIdx];
            section.layout = layout;
            // If switching to multiple choice and options don't exist, init them
            if (layout === 'multiple-choice') {
                section.items = section.items.map(item => ({
                    ...item,
                    options: item.options || ["Choice 1", "Choice 2", "Choice 3", "Choice 4"]
                }));
            }
            if (layout === 'essay') {
                section.items = section.items.map(item => ({
                    ...item,
                    wordCount: item.wordCount || 50
                }));
            }
            newWorksheets[wsIdx] = ws;
            setWorksheets(newWorksheets);
        }
    };

    const handleRegenerateWorksheetSection = async (wsIdx: number, sIdx: number) => {
        if (!editablePlan || regeneratingSectionId) return;
        const ws = worksheets[wsIdx];
        if (!ws.sections) return;
        const section = ws.sections[sIdx];

        setRegeneratingSectionId(`${wsIdx}-${sIdx}`);
        try {
            let skill = "Mixed";
            if (section.title.toLowerCase().includes("vocabulary")) skill = "Vocabulary";
            else if (section.title.toLowerCase().includes("grammar")) skill = "Grammar";
            else if (section.title.toLowerCase().includes("reading")) skill = "Reading Comprehension";
            else if (section.title.toLowerCase().includes("listening")) skill = "Listening Comprehension";

            const typeStr = section.layout === 'multiple-choice' ? 'Multiple Choice' :
                section.layout === 'matching' ? 'Matching' : 'Mixed';

            const newWs = await generateWorksheet(
                editablePlan.classInformation.level as CEFRLevel,
                editablePlan.classInformation.topic,
                [{ skill, type: typeStr, count: section.items.length || 5 }]
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
        } catch (e) {
            console.error("Regeneration failed", e);
        } finally {
            setRegeneratingSectionId(null);
        }
    };

    const handleQuickGenerateSection = async () => {
        if (!editablePlan || isQuickGenerating) return;
        setIsQuickGenerating(true);
        try {
            // Enforce Multiple Choice layout for Cloze Test
            const config = { ...quickGenConfig };

            // AUTO-FORCE Essay Layout for Picture Description
            if (config.type === 'Picture Description') {
                config.type = 'Picture Description';
                // Layout handled by result in geminiService
            }

            const newWs = await generateWorksheet(
                quickGenConfig.level as CEFRLevel,
                editablePlan.classInformation.topic,
                [{ ...config }]
            );

            if (newWs.sections && newWs.sections.length > 0) {
                const newWorksheets = [...worksheets];
                // If no worksheets exist, create a shell
                if (newWorksheets.length === 0) {
                    newWorksheets.push({
                        title: "Generated Worksheet",
                        type: "Review",
                        instructions: "Please complete the following exercises.",
                        sections: [newWs.sections[0]]
                    });
                } else {
                    // Append to first worksheet
                    const ws = { ...newWorksheets[0] };
                    ws.sections = [...(ws.sections || []), newWs.sections[0]];
                    newWorksheets[0] = ws;
                }
                setWorksheets(newWorksheets);
            }
        } catch (e) {
            console.error("Quick Gen failed", e);
        } finally {
            setIsQuickGenerating(false);
        }
    };

    const handleFlashcardChange = (index: number, field: keyof Flashcard, value: string) => {
        const updated = [...localFlashcards];
        updated[index] = { ...updated[index], [field]: value };
        setLocalFlashcards(updated);
    };

    const addFlashcard = async () => {
        if (!editablePlan || isAddingFlashcard) return;
        setIsAddingFlashcard(true);
        try {
            const existingWords = localFlashcards.map(c => c.word);
            const newCard = await generateSingleFlashcard(
                editablePlan.classInformation.level as CEFRLevel,
                editablePlan.classInformation.topic,
                existingWords
            );
            setLocalFlashcards([...localFlashcards, newCard]);
        } catch (e) {
            console.error("Failed to generate flashcard", e);
            // Fallback to manual if API fails
            const manualCard: Flashcard = {
                word: "New Word",
                definition: "Definition goes here...",
                visualPrompt: "Describe image here...",
                type: "vocabulary"
            };
            setLocalFlashcards([...localFlashcards, manualCard]);
        } finally {
            setIsAddingFlashcard(false);
        }
    };

    const removeFlashcard = (index: number, e: React.MouseEvent) => {
        e.stopPropagation();
        const newCards = localFlashcards.filter((_, i) => i !== index);
        setLocalFlashcards(newCards);
    };

    // --- Flashcard Helper Functions ---
    const getCardConfig = (index: number) => cardConfigs[index] || { ratio: '4:3', isEditing: false };
    const updateCardConfig = (index: number, updates: Partial<{ ratio: string, isEditing: boolean }>) => {
        setCardConfigs(prev => ({
            ...prev,
            [index]: { ...getCardConfig(index), ...updates }
        }));
    };

    const handleGenerateFlashcardImage = async (index: number, prompt: string) => {
        if (generatingCardIndex !== null) return;
        setGeneratingCardIndex(index);
        try {
            const config = getCardConfig(index);
            // Enhanced prompt context for ESL materials
            const safePrompt = prompt.trim() || localFlashcards[index].word;
            const enhancedPrompt = `High-quality, simple educational illustration of "${safePrompt}" for a children's vocabulary flashcard. Plain white background, professional 2D vector style, bright colors, centered, no text.`;
            const imageUrl = await generateLessonImage(enhancedPrompt, config.ratio);
            setFlashcardImages(prev => ({ ...prev, [index]: imageUrl }));
            updateCardConfig(index, { isEditing: false });
        } catch (error) {
            console.error("Flashcard generation error", error);
        } finally {
            setGeneratingCardIndex(null);
        }
    };

    const handleGenerateAllImages = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isGeneratingAll) return;
        setIsGeneratingAll(true);
        stopGeneratingRef.current = false;

        for (let i = 0; i < localFlashcards.length; i++) {
            if (stopGeneratingRef.current) break;
            if (flashcardImages[i]) continue;

            await handleGenerateFlashcardImage(i, localFlashcards[i].visualPrompt);
        }

        setIsGeneratingAll(false);
    };

    const handleStopGenerating = (e: React.MouseEvent) => {
        e.stopPropagation();
        stopGeneratingRef.current = true;
        setIsGeneratingAll(false);
    };

    const handleDownloadFlashcard = (index: number) => {
        const imageUrl = flashcardImages[index];
        if (!imageUrl) return;
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = `flashcard_${localFlashcards[index].word.replace(/\s+/g, '_')}_front.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadFlashcardText = (index: number) => {
        const card = localFlashcards[index];
        const content = `Word: ${card.word}\nDefinition: ${card.definition}`;
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `flashcard_${card.word.replace(/\s+/g, '_')}_back.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleDownloadFlashcardPDF = (index: number) => {
        const card = localFlashcards[index];
        const imgData = flashcardImages[index];
        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: [148, 105] // A6 Landscape
        });

        // Front Side (Image)
        if (imgData) {
            doc.addImage(imgData, 'PNG', 10, 10, 128, 85);
            doc.addPage();
        }

        // Back Side (Explanation)
        doc.setFontSize(28);
        doc.setTextColor(79, 70, 229); // indigo-600
        doc.text(card.word, 148 / 2, 40, { align: 'center' } as any);

        doc.setFontSize(14);
        doc.setTextColor(107, 114, 128); // gray-500
        doc.setFont('helvetica', 'italic');
        const splitText = doc.splitTextToSize(card.definition, 120);
        doc.text(splitText, 148 / 2, 60, { align: 'center' } as any);

        doc.save(`Flashcard_${card.word.replace(/\s+/g, '_')}_${editablePlan?.classInformation.topic.replace(/\s+/g, '_') || 'Lesson'}.pdf`);
    };

    const handleDownloadAllFlashcards = async () => {
        const zip = new JSZip();
        const folder = zip.folder("flashcards_bundle");

        for (let i = 0; i < localFlashcards.length; i++) {
            const card = localFlashcards[i];
            const imgData = flashcardImages[i];

            const doc = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: [148, 105] // A6 Landscape
            });

            // Front Side (Image or Placeholder)
            if (imgData) {
                doc.addImage(imgData, 'PNG', 10, 10, 128, 85);
            } else {
                doc.setFontSize(20);
                doc.text("Ready for Image", 148 / 2, 105 / 2, { align: 'center' } as any);
            }

            doc.addPage();

            // Back Side (Explanation)
            doc.setFontSize(28);
            doc.setTextColor(79, 70, 229); // indigo-600
            doc.text(card.word, 148 / 2, 40, { align: 'center' } as any);

            doc.setFontSize(14);
            doc.setTextColor(107, 114, 128); // gray-500
            doc.setFont('helvetica', 'italic');
            const splitText = doc.splitTextToSize(card.definition, 120);
            doc.text(splitText, 148 / 2, 60, { align: 'center' } as any);

            const pdfData = doc.output('arraybuffer');
            folder?.file(`${card.word.replace(/\s+/g, '_')}_${editablePlan?.classInformation.topic.replace(/\s+/g, '_') || 'Lesson'}_flashcard.pdf`, pdfData);
        }

        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Flashcards_${editablePlan?.classInformation.topic.replace(/\s+/g, '_') || 'Lesson'}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleGenerateWorksheetImage = async (wsIdx: number, sIdx: number, itemIdx: number, promptText: string) => {
        const key = `${wsIdx}-${sIdx}-${itemIdx}`;
        if (generatingWsImageKey) return;
        setGeneratingWsImageKey(key);
        try {
            // Descriptive prompt prefix to help model avoid safety blocks or vague failures
            const safePrompt = promptText.trim() || "educational illustration";
            const enhancedPrompt = `A simple, clear educational illustration of "${safePrompt}" for an English student's worksheet. Clean white background, no text, professional line-art or 2D vector style.`;
            const imageUrl = await generateLessonImage(enhancedPrompt, "4:3"); // Optimized for worksheets
            handleWorksheetItemChange(wsIdx, sIdx, itemIdx, 'imageUrl', imageUrl);
        } catch (e) {
            console.error("Worksheet image generation failed", e);
        } finally {
            setGeneratingWsImageKey(null);
        }
    };

    const handleGenerateDtImage = async (index: number) => {
        if (generatingDtImageIndex !== null) return;
        setGeneratingDtImageIndex(index);
        try {
            const promptText = phonicsContent.decodableTextPrompts[index] || phonicsContent.decodableTexts[index];
            const safePrompt = promptText.trim().substring(0, 300);
            const enhancedPrompt = `A four-panel comic strip (四宫格漫画) reflecting the plot of the story: ${safePrompt}. Whimsical cartoon style, detailed, soft colors, high-quality character design, professional illustration.`;
            const imageUrl = await generateLessonImage(enhancedPrompt, "3:4");
            setDecodableTextImages(prev => ({ ...prev, [index]: imageUrl }));
        } catch (error) {
            console.error("Failed to generate decodable text image", error);
        } finally {
            setGeneratingDtImageIndex(null);
        }
    };

    const handleGenerateGrammarInfographic = async () => {
        if (!editablePlan || isGeneratingGrammar) return;
        setIsGeneratingGrammar(true);
        try {
            const grammarText = editablePlan.lessonDetails.grammarSentences.join(". ");
            const vocabText = editablePlan.lessonDetails.targetVocab.map(v => `${v.word}`).join(", ");

            let prompt = `Create a high-quality educational infographic handout for ESL students (CEFR Level ${editablePlan.classInformation.level}). 
        Topic: ${editablePlan.classInformation.topic}. 
        Include visual representations for these Grammar Points: ${grammarText}.
        Include visual representations for this Target Vocabulary: ${vocabText}.
        The style should be a professional, clean, and colorful educational infographic that combines these elements into a single cohesive handout. No complex sentences, focus on clear icons and simple labels.`;

            if (customGrammarPrompt.trim()) {
                prompt += ` Specifically incorporate these instructions: ${customGrammarPrompt.trim()}`;
            }

            const imageUrl = await generateLessonImage(prompt, "3:4");
            setGrammarInfographicUrl(imageUrl);
        } catch (e) {
            console.error("Infographic generation failed", e);
        } finally {
            setIsGeneratingGrammar(false);
        }
    };

    const handleGenerateWhiteboardDesign = async () => {
        if (!editablePlan || isGeneratingWhiteboard) return;
        setIsGeneratingWhiteboard(true);
        try {
            const topic = editablePlan.classInformation.topic;
            const grammarText = editablePlan.lessonDetails.grammarSentences.join(". ");
            const vocabText = editablePlan.lessonDetails.targetVocab.map(v => v.word).join(", ");

            let prompt = `Create a professional classroom whiteboard layout design for an ESL English lesson. 
        Topic: ${topic}. 
        Content context: Grammar (${grammarText}), Vocabulary (${vocabText}).
        Requirement: Combine illustrations and text, clear structured layout with sections like 'Vocabulary', 'Grammar', and 'Conversation'. 
        Style: Clean whiteboard aesthetic with high-contrast black and colored marker colors on a clean white background, clean professional handwriting style, professional educational illustrations. Rich in images and text, with a clear logical structure.`;

            if (customWhiteboardPrompt.trim()) {
                prompt += ` Extra instructions: ${customWhiteboardPrompt.trim()}`;
            }

            const imageUrl = await generateLessonImage(prompt, "16:9");
            setBlackboardImageUrl(imageUrl);
        } catch (e) {
            console.error("Whiteboard generation failed", e);
        } finally {
            setIsGeneratingWhiteboard(false);
        }
    };

    const handleGenerateSingleGrammar = async () => {
        if (!editablePlan || isGeneratingSingleGrammar) return;
        setIsGeneratingSingleGrammar(true);
        try {
            const newSentence = await generateSingleGrammarPoint(
                editablePlan.classInformation.level as CEFRLevel,
                editablePlan.classInformation.topic,
                editablePlan.lessonDetails.grammarSentences
            );
            if (newSentence) {
                const newArray = [...editablePlan.lessonDetails.grammarSentences, newSentence];
                setEditablePlan({ ...editablePlan, lessonDetails: { ...editablePlan.lessonDetails, grammarSentences: newArray } });
            }
        } catch (e) {
            console.error("Failed to generate grammar point", e);
        } finally {
            setIsGeneratingSingleGrammar(false);
        }
    };

    const handleAddPhonicsPoint = async () => {
        if (!editablePlan || isGeneratingPhonicsPoint) return;
        setIsGeneratingPhonicsPoint(true);
        try {
            const vocab = editablePlan.lessonDetails.targetVocab.map(v => v.word);
            const newPoint = await generateSinglePhonicsPoint(
                editablePlan.classInformation.level as CEFRLevel,
                editablePlan.classInformation.topic,
                phonicsContent.keyPoints,
                vocab
            );
            if (newPoint) {
                setPhonicsContent({ ...phonicsContent, keyPoints: [...phonicsContent.keyPoints, newPoint] });
            }
        } catch (e) {
            console.error("Failed to generate phonics point", e);
            setPhonicsContent({ ...phonicsContent, keyPoints: [...phonicsContent.keyPoints, "New point"] });
        } finally {
            setIsGeneratingPhonicsPoint(false);
        }
    };

    const handleAddDecodableText = async () => {
        if (!editablePlan || isGeneratingDecodableText) return;
        setIsGeneratingDecodableText(true);
        try {
            const vocab = editablePlan.lessonDetails.targetVocab.map(v => v.word);
            const result = await generateSingleDecodableText(
                editablePlan.classInformation.level as CEFRLevel,
                editablePlan.classInformation.topic,
                phonicsContent.keyPoints,
                vocab
            );
            if (result) {
                setPhonicsContent({
                    ...phonicsContent,
                    decodableTexts: [...phonicsContent.decodableTexts, result.text],
                    decodableTextPrompts: [...phonicsContent.decodableTextPrompts, result.visualPrompt]
                });
            }
        } catch (e) {
            console.error("Failed to generate decodable text", e);
            setPhonicsContent({
                ...phonicsContent,
                decodableTexts: [...phonicsContent.decodableTexts, "New decodable story..."],
                decodableTextPrompts: [...phonicsContent.decodableTextPrompts, "Simple illustration prompt"]
            });
        } finally {
            setIsGeneratingDecodableText(false);
        }
    };

    const handleDownloadGrammarInfographic = () => {
        if (!grammarInfographicUrl) return;
        const link = document.createElement('a');
        link.href = grammarInfographicUrl;
        link.download = `Lesson_Infographic_${editablePlan?.classInformation.topic.replace(/\s+/g, '_') || 'Lesson'}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadWhiteboardDesign = () => {
        if (!blackboardImageUrl) return;
        const link = document.createElement('a');
        link.href = blackboardImageUrl;
        link.download = `Whiteboard_Design_${editablePlan?.classInformation.topic.replace(/\s+/g, '_') || 'Lesson'}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleGeneratePassage = async (wsIdx: number, sIdx: number) => {
        if (!editablePlan || isGeneratingPassageId) return;
        setIsGeneratingPassageId(`${wsIdx}-${sIdx}`);
        try {
            const vocab = editablePlan.lessonDetails.targetVocab.map(v => v.word);
            const result = await generateReadingPassage(
                editablePlan.classInformation.level,
                editablePlan.classInformation.topic,
                vocab
            );
            const newWorksheets = [...worksheets];
            if (newWorksheets[wsIdx].sections) {
                newWorksheets[wsIdx].sections[sIdx].passage = result.text;
                newWorksheets[wsIdx].sections[sIdx].passageTitle = result.title;
            }
            setWorksheets(newWorksheets);
        } catch (e) {
            console.error("Passage generation failed", e);
        } finally {
            setIsGeneratingPassageId(null);
        }
    };

    /**
     * Layout components for worksheets
     * Implementation of Deluxe Visual Cards (Scheme 1) with Shuffled Column B
     */
    const MatchingLayout = ({ section, wsIdx, sIdx }: { section: WorksheetSection; wsIdx: number; sIdx: number }) => {
        // Generate stable shuffled indices for Column B
        const shuffledIndices = useMemo(() => {
            const indices = Array.from({ length: section.items.length }, (_, i) => i);
            // Simple deterministic shuffle based on worksheet items length
            // This ensures the shuffle doesn't change every time the user types a letter
            let seed = section.items.length + sIdx;
            return indices.sort(() => {
                seed = (seed * 9301 + 49297) % 233280;
                return (seed / 233280) - 0.5;
            });
        }, [section.items.length, sIdx]);

        return (
            <div className="space-y-10 py-6">
                <div className="flex flex-col gap-8">
                    {section.items.map((_, idx) => {
                        const itemA = section.items[idx];
                        const shuffledIdx = shuffledIndices[idx];
                        const itemB = section.items[shuffledIdx];

                        return (
                            <div key={idx} className="flex flex-col md:flex-row gap-6 md:gap-0 items-stretch md:items-center relative">
                                {/* Column A Card (Terms/Questions) */}
                                <div className="flex-1 flex items-center group relative z-10">
                                    <div className="flex-1 flex gap-4 items-center bg-white border-2 border-indigo-100 p-6 rounded-[1.5rem] shadow-sm hover:border-indigo-300 transition-all min-h-[120px]">
                                        <span className="text-xl font-black text-indigo-200 w-8">{idx + 1}.</span>
                                        <AutoResizeTextarea
                                            value={itemA.question}
                                            onChange={(e) => handleWorksheetItemChange(wsIdx, sIdx, idx, 'question', e.target.value)}
                                            className="flex-1 text-lg font-bold text-indigo-900 bg-transparent border-none outline-none focus:bg-indigo-50/20 p-1 rounded"
                                            placeholder="Term or phrase..."
                                        />
                                    </div>
                                    {/* Anchor Point A */}
                                    <div className="hidden md:flex w-16 h-px bg-indigo-100 items-center justify-end">
                                        <div className="w-4 h-4 rounded-full border-2 border-indigo-400 bg-white shadow-xs"></div>
                                    </div>
                                </div>

                                {/* Visual Connection Space (Visible on Print) - Increased to w-48 */}
                                <div className="hidden md:block w-48 shrink-0"></div>

                                {/* Column B Card (Images/Definitions) - Shuffled View */}
                                <div className="flex-1 flex items-center group relative z-10">
                                    {/* Anchor Point B */}
                                    <div className="hidden md:flex w-16 h-px bg-indigo-100 items-center justify-start">
                                        <div className="w-4 h-4 rounded-full border-2 border-indigo-400 bg-white shadow-xs"></div>
                                    </div>
                                    <div className="flex-1 flex gap-4 items-center bg-white border-2 border-gray-100 p-5 rounded-[1.5rem] shadow-sm hover:border-indigo-300 transition-all min-h-[120px] relative">
                                        <span className="text-xl font-black text-gray-200 w-8">{String.fromCharCode(65 + idx)}.</span>

                                        <div className="flex-1 flex items-center gap-6">
                                            {/* Larger Image Area - Referring to shuffled content */}
                                            <div className="w-32 h-24 bg-gray-50 rounded-2xl overflow-hidden border border-gray-100 flex items-center justify-center relative shrink-0 cursor-pointer group/gen"
                                                onClick={() => handleGenerateWorksheetImage(wsIdx, sIdx, shuffledIdx, itemB.answer || itemB.question)}>
                                                {itemB.imageUrl ? (
                                                    <img src={itemB.imageUrl} className="w-full h-full object-cover" alt="match visual" />
                                                ) : (
                                                    <ImageIcon className="w-8 h-8 text-gray-200" />
                                                )}
                                                <div className="absolute inset-0 bg-indigo-600/80 flex items-center justify-center opacity-0 group-hover/gen:opacity-100 transition-opacity no-print">
                                                    {generatingWsImageKey === `${wsIdx}-${sIdx}-${shuffledIdx}` ? (
                                                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                                                    ) : (
                                                        <Sparkles className="w-6 h-6 text-white" />
                                                    )}
                                                </div>
                                            </div>

                                            <AutoResizeTextarea
                                                value={itemB.answer}
                                                onChange={(e) => handleWorksheetItemChange(wsIdx, sIdx, shuffledIdx, 'answer', e.target.value)}
                                                className="flex-1 text-base font-semibold text-gray-700 bg-transparent border-none outline-none focus:bg-indigo-50/20 p-1 rounded"
                                                placeholder="Match description..."
                                            />
                                        </div>

                                        <div className="absolute -right-2 -top-2 flex flex-col gap-1 no-print opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => removeWorksheetItem(wsIdx, sIdx, shuffledIdx)} className="p-1.5 text-red-400 hover:text-red-600 bg-white rounded-full shadow-md border border-gray-100">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <button
                    onClick={() => addWorksheetItem(wsIdx, sIdx)}
                    className="w-full py-6 border-2 border-dashed border-indigo-100 rounded-[2rem] text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 text-sm font-black uppercase tracking-widest no-print"
                >
                    <Plus className="w-5 h-5" /> Add Matching Row
                </button>
            </div>
        );
    };

    const MultipleChoiceLayout = ({ section, wsIdx, sIdx }: { section: WorksheetSection; wsIdx: number; sIdx: number }) => (
        <div className="grid grid-cols-1 gap-8">
            {section.items.map((item, itemIdx) => (
                <div key={itemIdx} className="bg-white/40 border border-gray-100 rounded-[2rem] p-6 shadow-sm group/mc relative">
                    <div className="flex justify-between items-start gap-4 mb-6">
                        <div className="flex-1 flex gap-4">
                            <div className="flex gap-3 flex-1">
                                <span className="font-black text-indigo-300 mt-1">Q{itemIdx + 1}.</span>
                                <AutoResizeTextarea
                                    value={item.question}
                                    onChange={(e) => handleWorksheetItemChange(wsIdx, sIdx, itemIdx, 'question', e.target.value)}
                                    className="flex-1 text-lg font-bold text-gray-800 bg-transparent border-none focus:bg-indigo-50/30 p-1 rounded outline-none"
                                    placeholder="Multiple choice question..."
                                />
                            </div>
                            {/* Visual AID / GEN Box for MC items */}
                            <div
                                onClick={() => handleGenerateWorksheetImage(wsIdx, sIdx, itemIdx, item.visualPrompt || item.question)}
                                className="w-32 h-24 bg-gray-50 rounded-2xl overflow-hidden border border-gray-100 flex flex-col items-center justify-center relative shrink-0 cursor-pointer group/wsimg no-print"
                            >
                                {item.imageUrl ? (
                                    <img src={item.imageUrl} className="w-full h-full object-cover" alt="visual aid" />
                                ) : (
                                    <>
                                        <LucideImage className="w-8 h-8 text-gray-200 mb-1" />
                                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">GEN</span>
                                    </>
                                )}
                                <div className="absolute inset-0 bg-indigo-600/80 flex items-center justify-center opacity-0 group-hover/wsimg:opacity-100 transition-opacity">
                                    {generatingWsImageKey === `${wsIdx}-${sIdx}-${itemIdx}` ? (
                                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                                    ) : (
                                        <Sparkles className="w-6 h-6 text-white" />
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 no-print group-hover/mc:opacity-100 transition-opacity opacity-0">
                            <button onClick={() => moveWorksheetItem(wsIdx, sIdx, itemIdx, 'up')} className="p-1 text-gray-400 hover:text-indigo-600"><ChevronUp className="w-4 h-4" /></button>
                            <button onClick={() => moveWorksheetItem(wsIdx, sIdx, itemIdx, 'down')} className="p-1 text-gray-400 hover:text-indigo-600"><ChevronDown className="w-4 h-4" /></button>
                            <button onClick={() => removeWorksheetItem(wsIdx, sIdx, itemIdx)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                        </div>
                    </div>

                    {/* Arranged in a single row layout on larger screens (4 columns) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 ml-7 viewer-mc-grid">
                        {(item.options || ["", "", "", ""]).map((opt, optIdx) => (
                            <div
                                key={optIdx}
                                onClick={() => handleWorksheetItemChange(wsIdx, sIdx, itemIdx, 'answer', opt)}
                                className={`flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${item.answer === opt && opt !== "" ? 'bg-indigo-50 border-indigo-400 ring-1 ring-indigo-200' : 'bg-gray-50/50 border-transparent hover:border-gray-200'}`}
                            >
                                <div
                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border-2 transition-all ${item.answer === opt && opt !== "" ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-gray-400 border-gray-100'}`}
                                >
                                    {String.fromCharCode(65 + optIdx)}
                                </div>
                                <input
                                    value={opt}
                                    onChange={(e) => {
                                        e.stopPropagation();
                                        const newOpts = [...(item.options || ["", "", "", ""])];
                                        newOpts[optIdx] = e.target.value;
                                        handleWorksheetItemChange(wsIdx, sIdx, itemIdx, 'options', newOpts);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="flex-1 bg-transparent border-none text-sm font-bold text-gray-700 outline-none"
                                    placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            ))}
            <button
                onClick={() => addWorksheetItem(wsIdx, sIdx)}
                className="w-full py-3 border-2 border-dashed border-gray-100 rounded-2xl text-gray-300 hover:text-indigo-400 hover:border-indigo-100 hover:bg-indigo-50/20 transition-all flex items-center justify-center gap-2 text-xs font-bold no-print"
            >
                <Plus className="w-4 h-4" /> Add MC Question
            </button>
        </div>
    );

    const ErrorCorrectionLayout = ({ section, wsIdx, sIdx }: { section: WorksheetSection; wsIdx: number; sIdx: number }) => (
        <div className="space-y-10">
            <div className="bg-white border-2 border-indigo-50 rounded-[2.5rem] p-8 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                    <h5 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Correction Passage Content / 短文改错内容</h5>
                    <div className="flex items-center gap-2 no-print">
                        <button
                            onClick={() => handleGeneratePassage(wsIdx, sIdx)}
                            disabled={isGeneratingPassageId === `${wsIdx}-${sIdx}`}
                            className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-1"
                        >
                            {isGeneratingPassageId === `${wsIdx}-${sIdx}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                            Regen Passage
                        </button>
                    </div>
                </div>
                <AutoResizeTextarea
                    value={section.passageTitle || ""}
                    onChange={(e) => {
                        const newWs = [...worksheets];
                        if (newWs[wsIdx].sections) newWs[wsIdx].sections[sIdx].passageTitle = e.target.value;
                        setWorksheets(newWs);
                    }}
                    placeholder="Passage Title..."
                    className="text-2xl font-black text-indigo-900 bg-transparent border-none outline-none w-full mb-6 text-center"
                />
                <AutoResizeTextarea
                    value={section.passage || ""}
                    onChange={(e) => {
                        const newWs = [...worksheets];
                        if (newWs[wsIdx].sections) {
                            const newSections = [...(newWs[wsIdx].sections || [])];
                            newSections[sIdx] = { ...newSections[sIdx], passage: e.target.value };
                            newWs[wsIdx].sections = newSections;
                        }
                        setWorksheets(newWs);
                    }}
                    placeholder="Enter passage text with errors..."
                    className="w-full text-xl font-medium text-gray-800 leading-[3.5] bg-transparent border-none outline-none italic whitespace-pre-wrap"
                    minRows={5}
                />
                <div className="mt-8 pt-8 border-t border-indigo-50">
                    <CorrectionLegend />
                </div>
            </div>

            <div className="space-y-4">
                <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Error Key / 错误对照</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {section.items.map((item, itemIdx) => (
                        <div key={itemIdx} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-xs flex gap-4 items-center group/err">
                            <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-red-400">WRONG:</span>
                                    <input
                                        value={item.question}
                                        onChange={(e) => handleWorksheetItemChange(wsIdx, sIdx, itemIdx, 'question', e.target.value)}
                                        placeholder="Incorrect text..."
                                        className="flex-1 bg-transparent border-none outline-none text-sm font-bold text-red-700"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-green-400">CORRECT:</span>
                                    <input
                                        value={item.answer}
                                        onChange={(e) => handleWorksheetItemChange(wsIdx, sIdx, itemIdx, 'answer', e.target.value)}
                                        placeholder="Correct version..."
                                        className="flex-1 bg-transparent border-none outline-none text-sm font-bold text-green-700"
                                    />
                                </div>
                            </div>
                            <button onClick={() => removeWorksheetItem(wsIdx, sIdx, itemIdx)} className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover/err:opacity-100 transition-opacity no-print">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                    <button
                        onClick={() => addWorksheetItem(wsIdx, sIdx)}
                        className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-100 rounded-2xl p-4 text-gray-400 hover:border-indigo-200 hover:text-indigo-400 transition-all no-print"
                    >
                        <Plus className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase">Add Error Entry</span>
                    </button>
                </div>
            </div>
        </div>
    );

    const EssayLayout = ({ section, wsIdx, sIdx }: { section: WorksheetSection; wsIdx: number; sIdx: number }) => (
        <div className="space-y-10">
            {section.items.map((item, idx) => {
                const lineCount = Math.ceil((item.wordCount || 50) / 10);
                return (
                    <div key={idx} className="bg-white border border-gray-100 rounded-[2.5rem] p-8 shadow-xs group/essay relative flex flex-col gap-6">
                        <div className="flex justify-between items-start gap-4 no-print">
                            <div className="flex gap-3 flex-1">
                                <span className="font-black text-indigo-300 mt-1">{idx + 1}.</span>
                                <AutoResizeTextarea
                                    value={item.question}
                                    onChange={(e) => handleWorksheetItemChange(wsIdx, sIdx, idx, 'question', e.target.value)}
                                    className="flex-1 text-lg font-bold text-gray-800 bg-transparent border-none focus:bg-indigo-50/30 p-1 rounded outline-none"
                                    placeholder="Writing prompt or essay question..."
                                />
                            </div>
                            <div className="flex items-center gap-4 group/controls">
                                <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100">
                                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest whitespace-nowrap">Words:</span>
                                    <input
                                        type="number"
                                        value={item.wordCount || 50}
                                        onChange={(e) => handleWorksheetItemChange(wsIdx, sIdx, idx, 'wordCount', parseInt(e.target.value) || 0)}
                                        className="w-12 bg-transparent text-sm font-black text-indigo-700 outline-none border-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover/essay:opacity-100 transition-opacity">
                                    <button onClick={() => moveWorksheetItem(wsIdx, sIdx, idx, 'up')} className="p-1 text-gray-400 hover:text-indigo-600"><ChevronUp className="w-4 h-4" /></button>
                                    <button onClick={() => moveWorksheetItem(wsIdx, sIdx, idx, 'down')} className="p-1 text-gray-400 hover:text-indigo-600"><ChevronDown className="w-4 h-4" /></button>
                                    <button onClick={() => removeWorksheetItem(wsIdx, sIdx, idx)} className="p-1 text-red-400 hover:text-red-600 bg-white rounded shadow-xs"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            </div>
                        </div>

                        <div className="hidden print:flex justify-between items-center font-bold text-gray-800 text-lg mb-2">
                            <div className="flex-1">
                                <span className="text-indigo-400 mr-2">{idx + 1}.</span> {item.question}
                            </div>
                            {item.wordCount && (
                                <span className="bg-indigo-600 text-white px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest shrink-0">
                                    Goal: {item.wordCount} words
                                </span>
                            )}
                        </div>

                        <div className="flex flex-col items-center gap-4">
                            {item.imageUrl ? (
                                <div className="relative group/wsimg max-w-2xl w-full">
                                    <img src={item.imageUrl} className="w-full h-auto rounded-[2rem] border-4 border-indigo-50 shadow-md" alt="prompt illustration" />
                                    <div className="absolute inset-0 bg-indigo-600/60 rounded-[2rem] flex items-center justify-center opacity-0 group-hover/wsimg:opacity-100 transition-opacity no-print">
                                        <button
                                            onClick={() => handleGenerateWorksheetImage(wsIdx, sIdx, idx, item.visualPrompt || item.question)}
                                            className="bg-white text-indigo-600 px-6 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg"
                                        >
                                            <Sparkles className="w-4 h-4" /> Regenerate Visual
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div
                                    onClick={() => handleGenerateWorksheetImage(wsIdx, sIdx, idx, item.visualPrompt || item.question)}
                                    className="w-full max-w-xl h-48 bg-gray-50/50 border-4 border-dashed border-gray-100 rounded-[2rem] flex flex-col items-center justify-center cursor-pointer hover:bg-indigo-50 transition-all no-print"
                                >
                                    {generatingWsImageKey === `${wsIdx}-${sIdx}-${idx}` ? (
                                        <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
                                    ) : (
                                        <>
                                            <LucideImage className="w-12 h-12 text-gray-200 mb-3" />
                                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">GENERATE ILLUSTRATION</span>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="no-print bg-gray-50/50 px-4 py-2 rounded-xl flex items-center gap-3">
                            <span className="text-[9px] font-black text-indigo-300 uppercase tracking-widest">Visual Prompt:</span>
                            <input
                                value={item.visualPrompt || ""}
                                onChange={(e) => handleWorksheetItemChange(wsIdx, sIdx, idx, 'visualPrompt', e.target.value)}
                                placeholder="Customize visual prompt for AI..."
                                className="flex-1 bg-transparent border-none text-xs text-gray-500 italic outline-none"
                            />
                        </div>

                        <div className="bg-white/30 rounded-2xl p-8 space-y-4 viewer-writing-area">
                            {Array.from({ length: lineCount }).map((_, li) => (
                                <div key={li} className="border-b-2 border-gray-100 h-12 w-full flex items-end">
                                    <span className="hidden print:block text-[8px] text-gray-200 font-bold opacity-30 select-none mr-2">LINE ${li + 1}</span>
                                </div>
                            ))}
                            <div className="no-print absolute bottom-4 right-8 opacity-10 flex flex-col items-end pointer-events-none">
                                <FileText className="w-12 h-12 text-gray-400 mb-2" />
                                <span className="text-[8px] font-black uppercase tracking-widest text-gray-500">${lineCount} Lines provided (1 per 10 words)</span>
                            </div>
                        </div>
                    </div>
                );
            })}
            <button
                onClick={() => addWorksheetItem(wsIdx, sIdx)}
                className="w-full py-4 border-2 border-dashed border-indigo-100 rounded-3xl text-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 text-sm font-bold no-print"
            >
                <Plus className="w-5 h-5" /> Add Writing Prompt
            </button>
        </div>
    );

    const tabs = [
        { id: 'plan', label: 'Lesson Plan', icon: GraduationCap },
        { id: 'slides', label: 'Slides Outline', icon: Presentation },
        { id: 'materials', label: 'Materials', icon: Layers },
        { id: 'games', label: 'Activities', icon: Gamepad2 },
        { id: 'companion', label: 'Companion', icon: BookOpen },
    ];

    return (
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden flex flex-col">
            <div className="flex flex-col md:flex-row border-b border-gray-100 justify-between items-stretch md:items-center no-print">
                <div className="flex overflow-x-auto scrollbar-hide">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-6 py-4 font-medium text-sm md:text-base transition-colors whitespace-nowrap
                ${activeTab === tab.id ? 'text-primary border-b-2 border-primary bg-indigo-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                        >
                            <tab.icon className="w-5 h-5" />
                            {tab.label}
                        </button>
                    ))}
                </div>
                <div className="p-2 md:p-0 pr-4 no-print flex items-center gap-2">
                    <div className="flex items-center gap-3">
                        <div className="hidden sm:flex items-center gap-2 text-xs text-gray-400">
                            <span className={`w-2 h-2 rounded-full ${saveStatus === 'saved' ? 'bg-green-400' : saveStatus === 'saving' ? 'bg-yellow-400 animate-pulse' : 'bg-orange-400 animate-pulse'}`} />
                            <span>{saveStatus === 'saved' ? (lastSaved ? `Saved ${lastSaved.toLocaleTimeString()}` : 'Saved') : saveStatus === 'saving' ? 'Saving...' : 'Unsaved changes'}</span>
                        </div>
                        <button onClick={saveNow} disabled={saveStatus === 'saving'} className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm disabled:opacity-70 text-sm font-semibold">
                            {saveStatus === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {saveStatus === 'saving' ? 'Saving...' : 'Save Now'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="p-4 md:p-8 flex-1 bg-gray-50/30 min-h-[500px]">
                {activeTab === 'plan' && editablePlan && (
                    <LessonPlanTab
                        editablePlan={editablePlan}
                        setEditablePlan={setEditablePlan as any}
                        openViewer={openViewer}
                        handleDownloadPlanMd={handleDownloadPlanMd}
                        handleDownloadDocx={handleDownloadDocx}
                    />
                )}

                {activeTab === 'slides' && (
                    <SlidesTab
                        editableSlides={editableSlides}
                        setEditableSlides={setEditableSlides as any}
                        notebookLMPrompt={content.notebookLMPrompt}
                        openViewer={openViewer}
                        handleDownloadSlidesMd={handleDownloadSlidesMd}
                        handleDownloadPptx={handleDownloadPptx}
                    />
                )}

                {activeTab === 'materials' && (
                    <div className="space-y-6">
                        <div className="flex border-b border-gray-200 mb-6 overflow-x-auto no-print scrollbar-hide">
                            {[
                                { id: 'flashcards', label: 'Flashcards', icon: ImageIcon },
                                { id: 'worksheets', label: 'Worksheets', icon: FileText },
                                { id: 'grammar', label: 'Infographic', icon: Palette },
                                { id: 'phonics', label: 'Phonics', icon: Music },
                                { id: 'whiteboard', label: 'Whiteboard', icon: PencilLine }
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setMaterialTab(tab.id as any)}
                                    className={`px-6 py-3 text-sm font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${materialTab === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                                >
                                    <tab.icon className="w-4 h-4" />
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {materialTab === 'flashcards' && (
                            <div className="space-y-6">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
                                    <h3 className="text-xl font-bold text-gray-800">Teaching Flashcards</h3>
                                    <div className="flex gap-2">
                                        <button onClick={handleDownloadAllFlashcards} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all text-sm font-bold">
                                            <Download className="w-4 h-4" /> Download All
                                        </button>
                                        <button
                                            onClick={isGeneratingAll ? handleStopGenerating : handleGenerateAllImages}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white font-bold transition-all text-sm shadow-md ${isGeneratingAll ? 'bg-red-500 hover:bg-red-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                                        >
                                            {isGeneratingAll ? <CircleStop className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                                            {isGeneratingAll ? 'Stop Generating' : 'Generate Missing Images'}
                                        </button>
                                        <button onClick={addFlashcard} disabled={isAddingFlashcard} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all text-sm font-bold disabled:opacity-50">
                                            {isAddingFlashcard ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                            Add Word
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {localFlashcards.map((card, idx) => (
                                        <div key={idx} className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm flex flex-col group relative">
                                            <div className="aspect-[4/3] bg-gray-50 flex items-center justify-center p-4 border-b border-gray-100 relative">
                                                {flashcardImages[idx] ? (
                                                    <img src={flashcardImages[idx]} className="w-full h-full object-contain" alt={card.word} />
                                                ) : (
                                                    <div className="text-center">
                                                        <ImageIcon className="w-12 h-12 text-gray-200 mx-auto mb-2" />
                                                        <button
                                                            onClick={() => handleGenerateFlashcardImage(idx, card.visualPrompt)}
                                                            disabled={generatingCardIndex === idx}
                                                            className="text-[10px] font-black uppercase tracking-widest text-indigo-500 hover:underline disabled:opacity-50"
                                                        >
                                                            {generatingCardIndex === idx ? 'Creating...' : 'Generate Image'}
                                                        </button>
                                                    </div>
                                                )}
                                                <div className="absolute top-2 right-2 flex gap-1 no-print opacity-0 group-hover:opacity-100 transition-all">
                                                    {flashcardImages[idx] && (
                                                        <button
                                                            onClick={() => handleGenerateFlashcardImage(idx, card.visualPrompt)}
                                                            disabled={generatingCardIndex === idx}
                                                            className="p-1.5 bg-white/80 hover:bg-indigo-50 hover:text-white rounded-full text-gray-400 transition-all shadow-sm"
                                                            title="Regenerate Image"
                                                        >
                                                            {generatingCardIndex === idx ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                                        </button>
                                                    )}
                                                    {flashcardImages[idx] && (
                                                        <button
                                                            onClick={() => handleDownloadFlashcard(idx)}
                                                            className="p-1.5 bg-white/80 hover:bg-indigo-50 hover:text-white rounded-full text-gray-400 transition-all shadow-sm"
                                                            title="Download Front (Image)"
                                                        >
                                                            <ImageIcon className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleDownloadFlashcardText(idx)}
                                                        className="p-1.5 bg-white/80 hover:bg-teal-500 hover:text-white rounded-full text-gray-400 transition-all shadow-sm"
                                                        title="Download Back (Explanation)"
                                                    >
                                                        <FileText className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDownloadFlashcardPDF(idx)}
                                                        className="p-1.5 bg-white/80 hover:bg-purple-500 hover:text-white rounded-full text-gray-400 transition-all shadow-sm"
                                                        title="Download Complete PDF"
                                                    >
                                                        <Download className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button onClick={(e) => removeFlashcard(idx, e)} className="p-1.5 bg-white/80 hover:bg-red-500 hover:text-white rounded-full text-gray-400 transition-all shadow-sm" title="Remove Flashcard">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="p-5 text-center flex-1 flex flex-col justify-center">
                                                <input
                                                    value={card.word}
                                                    onChange={(e) => handleFlashcardChange(idx, 'word', e.target.value)}
                                                    className="text-xl font-black text-indigo-900 bg-transparent border-none text-center outline-none focus:ring-1 focus:ring-indigo-100 rounded"
                                                />
                                                <AutoResizeTextarea
                                                    value={card.definition}
                                                    onChange={(e) => handleFlashcardChange(idx, 'definition', e.target.value)}
                                                    className="text-xs text-gray-500 italic mt-2 text-center bg-transparent border-none outline-none"
                                                    minRows={1}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {materialTab === 'worksheets' && (
                            <div className="space-y-8">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
                                    <h3 className="text-xl font-bold text-gray-800">Custom Worksheets</h3>
                                    <div className="flex gap-2">
                                        <button onClick={() => openViewer('materials', 'worksheets')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-sm font-bold">
                                            <ExternalLink className="w-4 h-4" /> Print Mode
                                        </button>
                                        <button onClick={handleDownloadWorksheetsMd} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all text-sm font-bold">
                                            <Download className="w-4 h-4" /> Download MD
                                        </button>
                                    </div>
                                </div>

                                <div className="bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100 no-print">
                                    <h4 className="text-sm font-black text-indigo-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <Sparkles className="w-4 h-4 text-indigo-500" />
                                        Quick Generate Section
                                    </h4>
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Focus</label>
                                                <select
                                                    value={quickGenConfig.skill}
                                                    onChange={(e) => setQuickGenConfig({ ...quickGenConfig, skill: e.target.value })}
                                                    className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                                >
                                                    {skills.map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Article Type</label>
                                                <select
                                                    value={quickGenConfig.articleType}
                                                    onChange={(e) => setQuickGenConfig({ ...quickGenConfig, articleType: e.target.value })}
                                                    className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                                >
                                                    {articleTypes.map(at => <option key={at} value={at}>{at || 'None'}</option>)}
                                                </select>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Level</label>
                                                <select
                                                    value={quickGenConfig.level}
                                                    onChange={(e) => setQuickGenConfig({ ...quickGenConfig, level: e.target.value as CEFRLevel })}
                                                    className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                                >
                                                    {Object.values(CEFRLevel).map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
                                                </select>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Type</label>
                                                <select
                                                    value={quickGenConfig.type}
                                                    onChange={(e) => setQuickGenConfig({ ...quickGenConfig, type: e.target.value })}
                                                    className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                                >
                                                    {questionTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                                </select>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Count</label>
                                                <input
                                                    type="number"
                                                    value={quickGenConfig.count}
                                                    onChange={(e) => setQuickGenConfig({ ...quickGenConfig, count: Number(e.target.value) })}
                                                    className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                                    min="1" max="20"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex flex-col lg:flex-row gap-4">
                                            <div className="flex-1 space-y-1">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Prompt</label>
                                                <input
                                                    value={quickGenConfig.description}
                                                    onChange={(e) => setQuickGenConfig({ ...quickGenConfig, description: e.target.value })}
                                                    placeholder="Customize content (e.g. 'about space exploration', 'focus on present perfect')..."
                                                    className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                                />
                                            </div>
                                            <div className="flex items-end lg:w-48">
                                                <button
                                                    onClick={handleQuickGenerateSection}
                                                    disabled={isQuickGenerating}
                                                    className="w-full h-[46px] bg-indigo-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-md disabled:opacity-50"
                                                >
                                                    {isQuickGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                                                    Add Section
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-16">
                                    {worksheets.map((ws, wsIdx) => (
                                        <div key={wsIdx} className="space-y-12">
                                            <div className="text-center border-b border-dashed border-gray-200 pb-12">
                                                <AutoResizeTextarea
                                                    value={ws.title}
                                                    onChange={(e) => {
                                                        const newWs = [...worksheets];
                                                        newWs[wsIdx].title = e.target.value;
                                                        setWorksheets(newWs);
                                                    }}
                                                    className="text-3xl font-black text-indigo-900 text-center bg-transparent border-none outline-none focus:ring-2 focus:ring-indigo-100 rounded-lg px-4 w-full"
                                                    minRows={1}
                                                />
                                                <AutoResizeTextarea
                                                    value={ws.instructions}
                                                    onChange={(e) => {
                                                        const newWs = [...worksheets];
                                                        newWs[wsIdx].instructions = e.target.value;
                                                        setWorksheets(newWs);
                                                    }}
                                                    className="block w-full text-center text-gray-500 italic mt-2 bg-transparent border-none outline-none"
                                                    minRows={1}
                                                />
                                            </div>

                                            <div className="space-y-16">
                                                {ws.sections?.map((sec, sIdx) => (
                                                    <div key={sIdx} className="space-y-6 relative group/sec">
                                                        <div className="flex justify-between items-center mb-6">
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-3">
                                                                    <span className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-black text-xs shrink-0">{sIdx + 1}</span>
                                                                    <AutoResizeTextarea
                                                                        value={sec.title}
                                                                        onChange={(e) => {
                                                                            const newWs = [...worksheets];
                                                                            if (newWs[wsIdx].sections) newWs[wsIdx].sections[sIdx].title = e.target.value;
                                                                            setWorksheets(newWs);
                                                                        }}
                                                                        className="flex-1 text-xl font-black text-indigo-800 bg-transparent border-none outline-none focus:ring-2 focus:ring-indigo-100 rounded-lg px-2"
                                                                        minRows={1}
                                                                    />
                                                                </div>
                                                                <AutoResizeTextarea
                                                                    value={sec.description || ""}
                                                                    onChange={(e) => {
                                                                        const newWs = [...worksheets];
                                                                        if (newWs[wsIdx].sections) newWs[wsIdx].sections[sIdx].description = e.target.value;
                                                                        setWorksheets(newWs);
                                                                    }}
                                                                    placeholder="Section instructions..."
                                                                    className="text-xs text-gray-400 font-medium ml-11 bg-transparent border-none outline-none italic w-full"
                                                                    minRows={1}
                                                                />
                                                            </div>
                                                            <div className="flex gap-1 no-print">
                                                                <select
                                                                    value={sec.layout}
                                                                    onChange={(e) => handleWorksheetSectionLayoutChange(wsIdx, sIdx, e.target.value)}
                                                                    className="text-[10px] font-bold bg-gray-50 border border-gray-100 rounded p-1 text-gray-500"
                                                                >
                                                                    <option value="standard">Standard</option>
                                                                    <option value="matching">Matching</option>
                                                                    <option value="multiple-choice">Multiple Choice</option>
                                                                    <option value="error-correction">Error Correction</option>
                                                                    <option value="essay">Essay / Writing</option>
                                                                </select>
                                                                <button onClick={() => handleRegenerateWorksheetSection(wsIdx, sIdx)} className="p-1.5 text-indigo-400 hover:text-indigo-600" title="Regenerate Section">
                                                                    {regeneratingSectionId === `${wsIdx}-${sIdx}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                                                </button>
                                                                <button onClick={() => removeWorksheetSection(wsIdx, sIdx)} className="p-1.5 text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                                                            </div>
                                                        </div>

                                                        <div className="pl-11 space-y-8">
                                                            {(sec.passage !== undefined || sec.passageTitle) && sec.layout !== 'error-correction' && (
                                                                <div className="bg-indigo-50/30 border-l-4 border-indigo-400 p-6 rounded-r-2xl shadow-sm space-y-4 mb-8 relative group/passage">
                                                                    <div className="space-y-3">
                                                                        <AutoResizeTextarea
                                                                            value={sec.passageTitle || ""}
                                                                            onChange={(e) => {
                                                                                const newWs = [...worksheets];
                                                                                if (newWs[wsIdx].sections) newWs[wsIdx].sections[sIdx].passageTitle = e.target.value;
                                                                                setWorksheets(newWs);
                                                                            }}
                                                                            placeholder="Passage Title (e.g. 'Tom and Anna Meet')..."
                                                                            className="text-2xl font-black text-indigo-900 bg-transparent border-none outline-none w-full"
                                                                            minRows={1}
                                                                        />
                                                                        <AutoResizeTextarea
                                                                            value={sec.passage || ""}
                                                                            onChange={(e) => {
                                                                                const newWs = [...worksheets];
                                                                                if (newWs[wsIdx].sections) {
                                                                                    newWs[wsIdx].sections[sIdx].passage = e.target.value;
                                                                                }
                                                                                setWorksheets(newWs);
                                                                            }}
                                                                            placeholder="Enter reading passage content..."
                                                                            className="w-full text-lg text-gray-700 leading-[1.8] bg-transparent border-none outline-none italic whitespace-pre-wrap"
                                                                            minRows={3}
                                                                        />
                                                                    </div>
                                                                    <button
                                                                        onClick={() => {
                                                                            const newWs = [...worksheets];
                                                                            if (newWs[wsIdx].sections) {
                                                                                newWs[wsIdx].sections[sIdx].passage = undefined;
                                                                                newWs[wsIdx].sections[sIdx].passageTitle = undefined;
                                                                            }
                                                                            setWorksheets(newWs);
                                                                        }}
                                                                        className="absolute -top-2 -right-2 p-1.5 bg-white border border-gray-100 rounded-full text-gray-300 hover:text-red-500 shadow-xs opacity-0 group-hover/passage:opacity-100 transition-all no-print"
                                                                        title="Remove Passage"
                                                                    >
                                                                        <X className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            )}

                                                            {!sec.passage && !sec.passageTitle && (
                                                                <button
                                                                    onClick={() => handleGeneratePassage(wsIdx, sIdx)}
                                                                    disabled={isGeneratingPassageId === `${wsIdx}-${sIdx}`}
                                                                    className="mb-6 text-[10px] font-black text-indigo-400 hover:text-indigo-600 uppercase tracking-widest flex items-center gap-1 no-print transition-colors"
                                                                >
                                                                    {isGeneratingPassageId === `${wsIdx}-${sIdx}` ? (
                                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                                    ) : (
                                                                        <BookOpen className="w-3 h-3" />
                                                                    )}
                                                                    {isGeneratingPassageId === `${wsIdx}-${sIdx}` ? 'Generating Passage...' : 'Add Reading Passage'}
                                                                </button>
                                                            )}

                                                            {sec.layout === 'matching' ? (
                                                                <MatchingLayout section={sec} wsIdx={wsIdx} sIdx={sIdx} />
                                                            ) : sec.layout === 'multiple-choice' ? (
                                                                <MultipleChoiceLayout section={sec} wsIdx={wsIdx} sIdx={sIdx} />
                                                            ) : sec.layout === 'error-correction' ? (
                                                                <ErrorCorrectionLayout section={sec} wsIdx={wsIdx} sIdx={sIdx} />
                                                            ) : sec.layout === 'essay' ? (
                                                                <EssayLayout section={sec} wsIdx={wsIdx} sIdx={sIdx} />
                                                            ) : (
                                                                <div className="grid grid-cols-1 gap-6">
                                                                    {sec.items.map((item, itemIdx) => (
                                                                        <div key={itemIdx} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs relative group/item">
                                                                            <div className="flex gap-4">
                                                                                <div className="flex-1 space-y-4">
                                                                                    <div className="flex gap-3">
                                                                                        <span className="font-bold text-indigo-300">Q{itemIdx + 1}.</span>
                                                                                        <AutoResizeTextarea
                                                                                            value={item.question}
                                                                                            onChange={(e) => handleWorksheetItemChange(wsIdx, sIdx, itemIdx, 'question', e.target.value)}
                                                                                            className="flex-1 text-base font-semibold text-gray-800 bg-transparent border-none outline-none focus:bg-indigo-50/20 p-1 rounded"
                                                                                        />
                                                                                    </div>
                                                                                    <div className="flex gap-3 items-center">
                                                                                        <span className="text-[10px] font-black text-green-500 uppercase tracking-widest ml-7">Answer:</span>
                                                                                        <input
                                                                                            value={item.answer}
                                                                                            onChange={(e) => handleWorksheetItemChange(wsIdx, sIdx, itemIdx, 'answer', e.target.value)}
                                                                                            className="flex-1 text-xs font-bold text-green-700 bg-green-50/30 border border-green-100/30 rounded p-1.5 focus:bg-white transition-all outline-none"
                                                                                        />
                                                                                    </div>
                                                                                </div>
                                                                                <div className="w-32 h-24 bg-gray-50 rounded-xl overflow-hidden border border-gray-100 relative group/img cursor-pointer">
                                                                                    {item.imageUrl ? (
                                                                                        <img src={item.imageUrl} className="w-full h-full object-cover" alt="visual aid" />
                                                                                    ) : (
                                                                                        <div className="w-full h-full flex flex-col items-center justify-center">
                                                                                            <ImageIcon className="w-6 h-6 text-gray-200" />
                                                                                            <button
                                                                                                onClick={() => handleGenerateWorksheetImage(wsIdx, sIdx, itemIdx, item.visualPrompt || item.question)}
                                                                                                className="text-[8px] font-black text-indigo-400 hover:underline uppercase mt-1"
                                                                                            >
                                                                                                {generatingWsImageKey === `${wsIdx}-${sIdx}-${itemIdx}` ? '...' : 'Gen'}
                                                                                            </button>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                            <div className="absolute -right-2 top-2 flex flex-col gap-1 no-print opacity-0 group-hover/item:opacity-100 transition-opacity">
                                                                                <button onClick={() => moveWorksheetItem(wsIdx, sIdx, itemIdx, 'up')} className="p-1 bg-white border border-gray-100 rounded text-gray-400 hover:text-indigo-600 shadow-xs"><ChevronUp className="w-3 h-3" /></button>
                                                                                <button onClick={() => moveWorksheetItem(wsIdx, sIdx, itemIdx, 'down')} className="p-1 bg-white border border-gray-100 rounded text-gray-400 hover:text-indigo-600 shadow-xs"><ChevronDown className="w-3 h-3" /></button>
                                                                                <button onClick={() => removeWorksheetItem(wsIdx, sIdx, itemIdx)} className="p-1 bg-white border border-gray-100 rounded text-red-400 hover:text-red-600 shadow-xs"><Trash2 className="w-3 h-3" /></button>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                    <button
                                                                        onClick={() => addWorksheetItem(wsIdx, sIdx)}
                                                                        className="w-full py-3 border-2 border-dashed border-gray-100 rounded-2xl text-gray-300 hover:text-indigo-400 hover:border-indigo-100 hover:bg-indigo-50/20 transition-all flex items-center justify-center gap-2 text-xs font-bold no-print"
                                                                    >
                                                                        <Plus className="w-4 h-4" /> Add Item
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                                <button
                                                    onClick={() => addWorksheetSection(wsIdx)}
                                                    className="w-full py-6 border-2 border-dashed border-indigo-100 rounded-3xl text-indigo-300 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-all flex flex-col items-center justify-center gap-2 font-bold no-print"
                                                >
                                                    <Layers className="w-8 h-8 opacity-40" />
                                                    <span>Add New Worksheet Section</span>
                                                </button>
                                            </div>

                                            {/* Worksheet Answer Key Section */}
                                            <div className="mt-12 p-8 bg-indigo-50/20 rounded-3xl border-2 border-dashed border-indigo-100/50 no-print">
                                                <div className="flex items-center gap-3 mb-6">
                                                    <div className="bg-indigo-600 p-2 rounded-xl text-white">
                                                        <AnswerKeyIcon className="w-5 h-5" />
                                                    </div>
                                                    <h4 className="text-lg font-black text-indigo-900 uppercase tracking-widest">Worksheet Answer Key / 答案</h4>
                                                </div>

                                                <div className="space-y-6">
                                                    {ws.sections?.map((sec, sIdx) => {
                                                        // Deterministic labels for matching sections to maintain UI consistency
                                                        let matchingLabels: string[] = [];
                                                        if (sec.layout === 'matching') {
                                                            const indices = Array.from({ length: sec.items.length }, (_, i) => i);
                                                            let seed = sec.items.length + sIdx;
                                                            const shuffled = indices.sort(() => {
                                                                seed = (seed * 9301 + 49297) % 233280;
                                                                return (seed / 233280) - 0.5;
                                                            });
                                                            // Map original index to its label in the UI
                                                            matchingLabels = sec.items.map((_, originalIdx) => {
                                                                const labelIdx = shuffled.indexOf(originalIdx);
                                                                return labelIdx !== -1 ? String.fromCharCode(65 + labelIdx) : "?";
                                                            });
                                                        }

                                                        return (
                                                            <div key={sIdx} className="bg-white/60 p-5 rounded-2xl border border-indigo-50">
                                                                <h5 className="font-bold text-indigo-800 mb-4 flex items-center gap-2">
                                                                    <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-black">{sIdx + 1}</span>
                                                                    {sec.title}
                                                                </h5>
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pl-8">
                                                                    {sec.items.map((item, iIdx) => {
                                                                        let answerDisplay: React.ReactNode = item.answer;

                                                                        // If matching, show the derived label (A, B, C...)
                                                                        if (sec.layout === 'matching') {
                                                                            answerDisplay = matchingLabels[iIdx];
                                                                        }
                                                                        // If multiple choice, try to find the label index if it exists in options
                                                                        else if (sec.layout === 'multiple-choice' && item.options) {
                                                                            const optIdx = item.options.indexOf(item.answer);
                                                                            if (optIdx !== -1) {
                                                                                answerDisplay = String.fromCharCode(65 + optIdx);
                                                                            }
                                                                        }

                                                                        return (
                                                                            <div key={iIdx} className="text-sm flex gap-2">
                                                                                <span className="font-bold text-gray-400">Q{iIdx + 1}:</span>
                                                                                <span className="font-bold text-green-700">
                                                                                    {answerDisplay || <span className="text-gray-300 italic font-normal">No answer set</span>}
                                                                                </span>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                    {(!ws.sections || ws.sections.length === 0) && (
                                                        <p className="text-center text-gray-400 italic py-4">Add sections to see the answer key here.</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {materialTab === 'grammar' && (
                            <div className="max-w-4xl mx-auto space-y-12 animate-fade-in">
                                <div className="flex justify-between items-center no-print">
                                    <h3 className="text-xl font-bold text-gray-800">Lesson Infographic Generator</h3>
                                    <div className="flex gap-2">
                                        {grammarInfographicUrl && (
                                            <button onClick={handleDownloadGrammarInfographic} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all text-sm font-bold">
                                                <Download className="w-4 h-4" /> Download Handout
                                            </button>
                                        )}
                                        <button onClick={() => openViewer('materials', 'grammar')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-sm font-bold">
                                            <ExternalLink className="w-4 h-4" /> Print View
                                        </button>
                                    </div>
                                </div>

                                <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-8 no-print">
                                    <div className="space-y-4">
                                        <h4 className="text-sm font-black text-indigo-900 uppercase tracking-widest flex items-center gap-2">
                                            <Bot className="w-5 h-5 text-indigo-500" />
                                            Customize Infographic Style
                                        </h4>
                                        <div className="flex gap-4">
                                            <input
                                                value={customGrammarPrompt}
                                                onChange={(e) => setCustomGrammarPrompt(e.target.value)}
                                                placeholder="e.g. Use a forest theme, make it very colorful for kids..."
                                                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                            />
                                            <button
                                                onClick={handleGenerateGrammarInfographic}
                                                disabled={isGeneratingGrammar}
                                                className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
                                            >
                                                {isGeneratingGrammar ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                                                {grammarInfographicUrl ? 'Regenerate Infographic' : 'Generate Infographic'}
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-gray-400 italic">This will integrate both Grammar Points and Target Vocabulary into a single visual handout.</p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {/* Grammar Points Section */}
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center">
                                                <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest">Key Grammar Points</h4>
                                                <button onClick={handleGenerateSingleGrammar} disabled={isGeneratingSingleGrammar} className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1">
                                                    {isGeneratingSingleGrammar ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Add Smart Point
                                                </button>
                                            </div>
                                            <div className="space-y-3">
                                                {editablePlan?.lessonDetails.grammarSentences.map((s, i) => (
                                                    <div key={i} className="flex gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-100 group">
                                                        <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-[10px] mt-1 shrink-0">{i + 1}</div>
                                                        <AutoResizeTextarea
                                                            value={s}
                                                            onChange={(e) => handleArrayChange('grammarSentences', i, e.target.value)}
                                                            className="flex-1 bg-transparent border-none outline-none text-sm text-gray-700 leading-relaxed font-medium"
                                                        />
                                                        <button onClick={() => deleteArrayItem('grammarSentences', i)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center">
                                                <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest">Target Vocabulary</h4>
                                            </div>
                                            <div className="space-y-3">
                                                {editablePlan?.lessonDetails.targetVocab.map((v, i) => (
                                                    <div key={i} className="flex gap-3 bg-teal-50/30 p-4 rounded-2xl border border-teal-100 group">
                                                        <div className="w-6 h-6 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center font-black text-[10px] mt-1 shrink-0">{i + 1}</div>
                                                        <div className="flex-1 space-y-1">
                                                            <input
                                                                value={v.word}
                                                                readOnly
                                                                className="w-full bg-transparent border-none outline-none text-sm font-black text-teal-900"
                                                            />
                                                            <input
                                                                value={v.definition}
                                                                readOnly
                                                                className="w-full bg-transparent border-none outline-none text-[11px] text-teal-600 italic"
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                                {(!editablePlan?.lessonDetails.targetVocab || editablePlan?.lessonDetails.targetVocab.length === 0) && (
                                                    <p className="text-xs text-gray-400 italic text-center py-4">No vocabulary items to illustrate yet.</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {grammarInfographicUrl && (
                                    <div className="space-y-4 animate-fade-in-up">
                                        <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest text-center">Generated Handout</h4>
                                        <div className="bg-white p-4 rounded-[2.5rem] border-[12px] border-indigo-50 shadow-2xl overflow-hidden group text-center">
                                            <img src={grammarInfographicUrl} className="w-full h-auto rounded-[1.5rem] mx-auto max-w-4xl" alt="infographic handout" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {materialTab === 'whiteboard' && (
                            <div className="max-w-5xl mx-auto space-y-12 animate-fade-in">
                                <div className="flex justify-between items-center no-print">
                                    <h3 className="text-xl font-bold text-gray-800">Whiteboard Design Reference</h3>
                                    <div className="flex gap-2">
                                        {blackboardImageUrl && (
                                            <button onClick={handleDownloadWhiteboardDesign} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all text-sm font-bold">
                                                <Download className="w-4 h-4" /> Download Design
                                            </button>
                                        )}
                                        <button onClick={() => openViewer('materials', 'whiteboard')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-sm font-bold">
                                            <ExternalLink className="w-4 h-4" /> Print View
                                        </button>
                                    </div>
                                </div>

                                <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6 no-print">
                                    <div className="flex flex-col gap-4">
                                        <h4 className="text-sm font-black text-indigo-900 uppercase tracking-widest flex items-center gap-2">
                                            <Sparkles className="w-5 h-5 text-indigo-500" />
                                            Smart Whiteboard Generation
                                        </h4>
                                        <p className="text-xs text-gray-500 leading-relaxed">Generate a classroom whiteboard reference based on your current topic and vocabulary. The design will combine text and illustrations with a clear structure.</p>
                                        <div className="flex gap-4">
                                            <input
                                                value={customWhiteboardPrompt}
                                                onChange={(e) => setCustomWhiteboardPrompt(e.target.value)}
                                                placeholder="Add extra style notes (e.g. 'Use more animal sketches', 'Make vocabulary section larger')..."
                                                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                            />
                                            <button
                                                onClick={handleGenerateWhiteboardDesign}
                                                disabled={isGeneratingWhiteboard}
                                                className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md disabled:opacity-50 flex items-center gap-2 shrink-0"
                                            >
                                                {isGeneratingWhiteboard ? <Loader2 className="w-5 h-5 animate-spin" /> : <PencilLine className="w-5 h-5" />}
                                                {blackboardImageUrl ? 'Regenerate Design' : 'Generate Design'}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {blackboardImageUrl ? (
                                    <div className="space-y-6 animate-fade-in-up">
                                        <div className="bg-white p-4 rounded-[3rem] border-[16px] border-gray-100 shadow-2xl overflow-hidden group text-center relative">
                                            <div className="absolute top-8 left-1/2 -translate-x-1/2 w-48 h-2 bg-gray-100 rounded-full blur-md no-print"></div>
                                            <img src={blackboardImageUrl} className="w-full h-auto rounded-2xl mx-auto shadow-inner" alt="whiteboard design" />
                                            <div className="absolute inset-0 flex items-center justify-center bg-white/40 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none no-print">
                                                <div className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-black uppercase tracking-widest text-xs shadow-xl scale-95 group-hover:scale-100 transition-transform">
                                                    Classroom Whiteboard View
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="py-32 bg-slate-50 border-4 border-dashed border-slate-200 rounded-[3rem] flex flex-col items-center justify-center text-slate-300 gap-4">
                                        <PencilLine className="w-16 h-16 opacity-20" />
                                        <p className="font-bold uppercase tracking-[0.2em] text-sm">Design Ready to Generate</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {materialTab === 'phonics' && (
                            <div className="space-y-12 animate-fade-in">
                                <div className="flex justify-between items-center no-print">
                                    <h3 className="text-xl font-bold text-gray-800">Phonics & Decodable Practice</h3>
                                    <button onClick={() => openViewer('materials', 'phonics')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-sm font-bold">
                                        <ExternalLink className="w-4 h-4" /> Print Preview
                                    </button>
                                </div>

                                <div className="flex flex-col space-y-12">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                                        <div className="bg-purple-50 p-6 rounded-3xl border border-purple-100 shadow-sm relative overflow-hidden">
                                            <div className="absolute -top-4 -right-4 bg-purple-200/20 w-16 h-16 rounded-full blur-xl"></div>
                                            <div className="flex justify-between items-center mb-6">
                                                <h4 className="text-[10px] font-black text-purple-900 uppercase tracking-widest">Target Sounds</h4>
                                                <button onClick={handleAddPhonicsPoint} disabled={isGeneratingPhonicsPoint} className="text-[10px] font-black text-purple-600 hover:underline uppercase no-print">
                                                    {isGeneratingPhonicsPoint ? '...' : '+ Add Point'}
                                                </button>
                                            </div>
                                            <div className="space-y-3">
                                                {phonicsContent.keyPoints.map((point, idx) => (
                                                    <div key={idx} className="bg-white p-4 rounded-xl border border-purple-200 shadow-xs flex items-center justify-between group">
                                                        <input
                                                            value={point}
                                                            onChange={(e) => {
                                                                const updated = [...phonicsContent.keyPoints];
                                                                updated[idx] = e.target.value;
                                                                setPhonicsContent({ ...phonicsContent, keyPoints: updated });
                                                            }}
                                                            className="flex-1 bg-transparent border-none outline-none text-purple-900 font-bold"
                                                        />
                                                        <button
                                                            onClick={() => {
                                                                const updated = phonicsContent.keyPoints.filter((_, i) => i !== idx);
                                                                setPhonicsContent({ ...phonicsContent, keyPoints: updated });
                                                            }}
                                                            className="text-purple-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all no-print"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                                {phonicsContent.keyPoints.length === 0 && <p className="text-xs text-purple-400 italic text-center py-4">No phonics focus defined yet.</p>}
                                            </div>
                                        </div>

                                        <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 shadow-sm relative overflow-hidden">
                                            <div className="absolute -bottom-4 -left-4 bg-indigo-200/20 w-16 h-16 rounded-full blur-xl"></div>
                                            <h4 className="text-[10px] font-black text-indigo-900 uppercase tracking-widest mb-4">Vocabulary Check</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {editablePlan?.lessonDetails.targetVocab.map((v, i) => (
                                                    <span key={i} className="text-[10px] font-bold px-2 py-1 bg-white text-indigo-600 rounded-md border border-indigo-100 shadow-xs">{v.word}</span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="w-full space-y-8">
                                        <div className="flex justify-between items-center mb-4">
                                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Decodable Stories</h4>
                                            <button onClick={handleAddDecodableText} disabled={isGeneratingDecodableText} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-md disabled:opacity-50 no-print flex items-center gap-2">
                                                {isGeneratingDecodableText ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                                Gen Story
                                            </button>
                                        </div>

                                        {phonicsContent.decodableTexts.map((text, idx) => (
                                            <div key={idx} className="space-y-6 animate-fade-in-up w-full">
                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch w-full">
                                                    <div className="w-full bg-white border-2 border-gray-100 rounded-[2rem] p-8 shadow-sm relative group flex flex-col min-h-[400px]">
                                                        <button
                                                            onClick={() => {
                                                                const newTexts = phonicsContent.decodableTexts.filter((_, i) => i !== idx);
                                                                const newPrompts = phonicsContent.decodableTextPrompts.filter((_, i) => i !== idx);
                                                                setPhonicsContent({ ...phonicsContent, decodableTexts: newTexts, decodableTextPrompts: newPrompts });
                                                            }}
                                                            className="absolute top-4 right-4 p-2 bg-gray-50 text-gray-300 hover:text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-all no-print z-10"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                        <div
                                                            className="flex-1 w-full text-2xl font-medium text-gray-800 leading-[2.5] italic whitespace-pre-wrap outline-none"
                                                            contentEditable
                                                            suppressContentEditableWarning
                                                            onBlur={(e) => {
                                                                const newTexts = [...phonicsContent.decodableTexts];
                                                                newTexts[idx] = e.currentTarget.innerHTML;
                                                                setPhonicsContent({ ...phonicsContent, decodableTexts: newTexts });
                                                            }}
                                                            dangerouslySetInnerHTML={{ __html: text }}
                                                        />
                                                        <div className="mt-6 flex flex-wrap gap-4 pt-4 border-t border-gray-100 no-print">
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[#10b981]"></div> Phonics Extension</span>
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[#eab308]"></div> Sight Words</span>
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[#8b5cf6]"></div> Target Words</span>
                                                        </div>
                                                    </div>

                                                    <div className="w-full shrink-0 h-[500px] lg:h-auto">
                                                        {decodableTextImages[idx] ? (
                                                            <div className="h-full rounded-[2.5rem] overflow-hidden shadow-xl border-8 border-white animate-fade-in group w-full flex items-center justify-center bg-gray-50">
                                                                <img src={decodableTextImages[idx]} className="max-h-full max-w-full object-contain" alt="story illustration" />
                                                            </div>
                                                        ) : (
                                                            <div className="h-full rounded-[2.5rem] bg-gray-50 border-2 border-dashed border-gray-100 flex items-center justify-center">
                                                                <ImageIcon className="w-12 h-12 text-gray-200" />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="bg-white/50 border border-gray-100 rounded-2xl p-6 flex justify-between items-center no-print">
                                                    <div className="flex-1 mr-6">
                                                        <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-2">Visual Illustration Prompt</label>
                                                        <input
                                                            value={phonicsContent.decodableTextPrompts[idx] || ""}
                                                            onChange={(e) => {
                                                                const newPrompts = [...phonicsContent.decodableTextPrompts];
                                                                newPrompts[idx] = e.target.value;
                                                                setPhonicsContent({ ...phonicsContent, decodableTexts: phonicsContent.decodableTexts, decodableTextPrompts: newPrompts });
                                                            }}
                                                            placeholder="Describe the scene for AI illustration..."
                                                            className="w-full text-sm text-gray-600 italic bg-transparent border-none outline-none focus:ring-1 focus:ring-indigo-100 rounded p-1"
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={() => handleGenerateDtImage(idx)}
                                                        disabled={generatingDtImageIndex === idx}
                                                        className="px-6 py-3 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-100 transition-all shrink-0 shadow-xs flex items-center gap-2"
                                                        title="Generate Story Illustration"
                                                    >
                                                        {generatingDtImageIndex === idx ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
                                                        <span className="text-xs font-black uppercase tracking-widest">{decodableTextImages[idx] ? 'Regenerate' : 'Generate'}</span>
                                                    </button>
                                                </div>

                                                {idx < phonicsContent.decodableTexts.length - 1 && <div className="border-b border-gray-100 opacity-50 my-16"></div>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'games' && (
                    <ActivitiesTab
                        editableGames={editableGames}
                        setEditableGames={setEditableGames as any}
                        editablePlan={editablePlan}
                        openViewer={openViewer}
                        handleDownloadGamesMd={handleDownloadGamesMd}
                    />
                )}

                {activeTab === 'companion' && (
                    <CompanionTab
                        editableReadingCompanion={editableReadingCompanion}
                        setEditableReadingCompanion={setEditableReadingCompanion as any}
                        editablePlan={editablePlan}
                        openViewer={openViewer}
                        handleDownloadCompanionMd={handleDownloadCompanionMd}
                    />
                )}
            </div>
        </div>
    );
};