import { BrandData } from '../../data/brandData';
import { SavedNote } from '../../types';
import { LogoPosition, LogoSize } from '../../utils/imageProcessor';

export interface ContentGeneratorState {
    topic: string;
    style: string;
    isGenerating: boolean;
    generatedContent: any | null;
    copiedField: string | null;
    editingNoteId: string | null;
    showCustomPrompt: boolean;
    customPrompt: string;
    showSaveModal: boolean;
    publishDate: string;
    calendarMonth: Date;
    previewMode: 'web' | 'mobile';
    selectedFramework: string;
    contentHistory: any[];
    imageCount: number;
    imageStyle: string;
    imageState: {
        isGenerating: boolean;
        images: string[];
        prompts: string[];
        generatingIndices: number[];
        refreshingResource: Record<number, boolean>;
    };
    addLogoIndices: number[];
    logoSize: LogoSize;
    logoPosition: LogoPosition;
    brandData: BrandData;
    currentPlan: any[];
    savedNotes: SavedNote[];
    PROMPT_FRAMEWORKS: { id: string; label: string; desc: string; instruction: string }[];
}

export interface ContentGeneratorActions {
    setTopic: (v: string) => void;
    setStyle: (v: string) => void;
    setIsGenerating: (v: boolean) => void;
    setGeneratedContent: (v: any) => void;
    setCopiedField: (v: string | null) => void;
    setEditingNoteId: (v: string | null) => void;
    setShowCustomPrompt: (v: boolean) => void;
    setCustomPrompt: (v: string) => void;
    setShowSaveModal: (v: boolean) => void;
    setPublishDate: (v: string) => void;
    setCalendarMonth: (v: Date) => void;
    setPreviewMode: (v: 'web' | 'mobile') => void;
    setSelectedFramework: (v: string) => void;
    setContentHistory: (v: any[] | ((prev: any[]) => any[])) => void;
    setImageCount: (v: number) => void;
    setImageStyle: (v: string) => void;
    setAddLogoIndices: (v: number[] | ((prev: number[]) => number[])) => void;
    setLogoSize: (v: LogoSize) => void;
    setLogoPosition: (v: LogoPosition) => void;

    // Image state setters
    setIsGeneratingImages: (v: boolean) => void;
    setGeneratedImages: (v: string[] | ((prev: string[]) => string[])) => void;
    setEditablePrompts: (v: string[] | ((prev: string[]) => string[])) => void;
    setGeneratingImageIndices: (v: number[] | ((prev: number[]) => number[])) => void;
    setIsRefreshingResource: (v: Record<number, boolean> | ((prev: Record<number, boolean>) => Record<number, boolean>)) => void;

    // Event Handlers
    handleQuickSelect: (v: string) => void;
    handleSaveToCalendar: () => void;
    handleGenerate: () => void;
    handleGenerateCustom: () => void;
    handleGenerateImages: () => void;
    handleGenerateSingleImage: (idx: number) => void;
    handleRefreshResourceImage: (idx: number) => void;
    copyToClipboard: (text: string, field: string) => void;

    // Calendar Utils
    handlePrevMonth: () => void;
    handleNextMonth: () => void;
    isDateOccupied: (dateStr: string) => boolean;
    getFirstDayOfMonth: (date: Date) => number;
    getDaysInMonth: (date: Date) => number;
}

export interface ContentGeneratorChildProps {
    state: ContentGeneratorState;
    actions: ContentGeneratorActions;
}
