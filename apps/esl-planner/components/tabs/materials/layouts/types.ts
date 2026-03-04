import { Worksheet, WorksheetSection, WorksheetItem } from '../../../../types';

export interface WorksheetLayoutActions {
    handleWorksheetItemChange: (wsIdx: number, sIdx: number, itemIdx: number, field: keyof WorksheetItem, value: any) => void;
    addWorksheetItem: (wsIdx: number, sIdx: number) => void;
    removeWorksheetItem: (wsIdx: number, sIdx: number, itemIdx: number) => void;
    moveWorksheetItem: (wsIdx: number, sIdx: number, itemIdx: number, direction: 'up' | 'down') => void;
    handleGenerateWorksheetImage: (wsIdx: number, sIdx: number, itemIdx: number, promptText: string) => Promise<void>;
    handleGeneratePassage: (wsIdx: number, sIdx: number) => Promise<void>;
}

export interface WorksheetLayoutProps {
    section: WorksheetSection;
    wsIdx: number;
    sIdx: number;
    worksheets: Worksheet[];
    setWorksheets: (ws: Worksheet[]) => void;
    actions: WorksheetLayoutActions;
    generatingWsImageKey: string | null;
    isGeneratingPassageId: string | null;
}
