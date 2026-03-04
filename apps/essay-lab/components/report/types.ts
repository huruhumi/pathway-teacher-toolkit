import { CorrectionReport, Grade, GradeItem, GrammarError, IdiomSuggestion, VocabularyUpgrade, WordBankItem, TopicExtension } from '../../types';

export interface ReportState {
    editableReport: CorrectionReport;
    generating: string | null;
    showGolden: boolean;
    showHighlights: boolean;
    quizState: { [key: number]: string | null };
    quizResult: { [key: number]: boolean };
    readOnly: boolean;
    orderedMatches: { id: number; start: number; end: number; text: string; error: GrammarError }[];
    isGrammarResolved: boolean;
}

export interface ReportActions {
    updateField: (field: keyof CorrectionReport, value: any) => void;
    updateNestedField: (parent: string, field: string, value: any) => void;
    updateArrayItem: (field: keyof CorrectionReport, index: number, itemUpdate: any) => void;
    addArrayItem: (field: keyof CorrectionReport, newItem: any) => void;
    removeArrayItem: (field: keyof CorrectionReport, index: number) => void;
    handleAIAdd: (type: any) => Promise<void>;

    setShowGolden: (v: boolean) => void;
    setShowHighlights: (v: boolean) => void;
    setQuizState: (v: any) => void;
    setQuizResult: (v: any) => void;

    handleOpenPreview: (e: React.MouseEvent) => void;
    handleClosePreview: (e: React.MouseEvent) => void;
    handleQuizAnswer: (index: number, option: string) => void;

    renderParagraphs: (text: string, enableHighlights?: boolean, isLined?: boolean) => React.ReactNode;
    renderWithHighlights: (text: string, colorClass: string) => React.ReactNode;

    onReset: () => void;
}

export interface ReportSectionProps {
    state: ReportState;
    actions: ReportActions;
    t: (key: string) => string;
    lang: string;
}
