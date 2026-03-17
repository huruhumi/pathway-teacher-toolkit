export const OTHER_TEXTBOOK_ID = 'other';

export interface CustomTextbookLevelOption {
    levelKey: string;
    label: string;
}

const CUSTOM_LEVELS: CustomTextbookLevelOption[] = [
    { levelKey: 'other-zero-foundation', label: 'Zero Foundation' },
    { levelKey: 'other-pre-a1', label: 'Pre-A1' },
    { levelKey: 'other-a1', label: 'A1' },
    { levelKey: 'other-a2', label: 'A2' },
    { levelKey: 'other-b1', label: 'B1' },
    { levelKey: 'other-b1-plus', label: 'B1+' },
    { levelKey: 'other-b2', label: 'B2' },
    { levelKey: 'other-c1', label: 'C1' },
    { levelKey: 'other-c2', label: 'C2' },
];

export function listCustomTextbookLevelOptions(): CustomTextbookLevelOption[] {
    return CUSTOM_LEVELS;
}

export function isCustomTextbookLevelKey(levelKey?: string): boolean {
    return Boolean(levelKey && levelKey.startsWith('other-'));
}

export function getCustomTextbookLevelLabel(levelKey?: string): string | undefined {
    if (!levelKey) return undefined;
    return CUSTOM_LEVELS.find((item) => item.levelKey === levelKey)?.label;
}
