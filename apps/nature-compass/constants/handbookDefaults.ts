import { HandbookPageConfig, SectionMeta } from '../types';

// --- Section metadata ---

export const HANDBOOK_SECTIONS: SectionMeta[] = [
    { type: 'Cover', label: '封面', labelEn: 'Cover', icon: 'BookImage', min: 1, max: 1, default: 1, required: true },
    { type: 'Table of Contents', label: '目录', labelEn: 'Table of Contents', icon: 'List', min: 0, max: 1, default: 1 },
    { type: 'Safety', label: '安全守则', labelEn: 'Safety Rules', icon: 'ShieldAlert', min: 0, max: 2, default: 2 },
    { type: 'Prop Checklist', label: '道具清单', labelEn: 'Prop Checklist', icon: 'ClipboardCheck', min: 0, max: 2, default: 2 },
    { type: 'Phase Transition', label: '阶段转场页', labelEn: 'Phase Transition', icon: 'Sparkles', min: 0, max: 8, default: 4 },
    { type: 'Background Knowledge', label: '背景知识', labelEn: 'Background Knowledge', icon: 'Lightbulb', min: 0, max: 10, default: 5 },
    { type: 'Activity/Worksheet', label: '活动/工作表', labelEn: 'Activity Page', icon: 'PenTool', min: 1, max: 15, default: 15, required: true },
    { type: 'Reflection', label: '反思页', labelEn: 'Reflection', icon: 'MessageCircle', min: 0, max: 2, default: 2 },
    { type: 'Certificate', label: '证书', labelEn: 'Certificate', icon: 'Award', min: 1, max: 1, default: 1, required: true },
    { type: 'Back Cover', label: '封底', labelEn: 'Back Cover', icon: 'BookMarked', min: 1, max: 1, default: 1, required: true },
];

// --- Preset templates ---

type PresetSections = Partial<Record<string, number>>;

interface HandbookPreset {
    label: string;
    labelEn: string;
    description: string;
    descriptionEn: string;
    sections: PresetSections;
}

export const HANDBOOK_PRESETS: Record<string, HandbookPreset> = {
    light: {
        label: '轻量版',
        labelEn: 'Light',
        description: '快速活动，基础结构',
        descriptionEn: 'Quick activity, basic structure',
        sections: {
            'Cover': 1, 'Safety': 1, 'Background Knowledge': 2,
            'Activity/Worksheet': 3, 'Reflection': 1,
            'Certificate': 1, 'Back Cover': 1,
        },
    },
    standard: {
        label: '标准版',
        labelEn: 'Standard',
        description: '均衡内容，适合 90 分钟课程',
        descriptionEn: 'Balanced content for 90-min workshops',
        sections: {
            'Cover': 1, 'Table of Contents': 1, 'Safety': 1, 'Prop Checklist': 1,
            'Background Knowledge': 3, 'Activity/Worksheet': 5,
            'Reflection': 1, 'Certificate': 1, 'Back Cover': 1,
        },
    },
    full: {
        label: '完整版',
        labelEn: 'Full',
        description: '丰富内容，适合半日课程',
        descriptionEn: 'Rich content for half-day workshops',
        sections: {
            'Cover': 1, 'Table of Contents': 1, 'Safety': 1, 'Prop Checklist': 1,
            'Background Knowledge': 5, 'Activity/Worksheet': 8,
            'Reflection': 2, 'Certificate': 1, 'Back Cover': 1,
        },
    },
    deep: {
        label: '深度版',
        labelEn: 'Deep',
        description: '研学手册级内容，30 页完整体验',
        descriptionEn: 'Full study handbook, 30-page immersive experience',
        sections: {
            'Cover': 1, 'Table of Contents': 1, 'Safety': 2, 'Prop Checklist': 2,
            'Background Knowledge': 7, 'Activity/Worksheet': 12,
            'Reflection': 2, 'Certificate': 1, 'Back Cover': 1,
        },
    },
};

// --- Helpers ---

/** Build default HandbookPageConfig array from HANDBOOK_SECTIONS */
export function getDefaultPageConfig(): HandbookPageConfig[] {
    return HANDBOOK_SECTIONS.map(s => ({
        section: s.type,
        count: s.default,
        enabled: true,
    }));
}

/** Build HandbookPageConfig array from a preset key */
export function getPresetPageConfig(preset: string): HandbookPageConfig[] {
    const p = HANDBOOK_PRESETS[preset];
    if (!p) return getDefaultPageConfig();

    return HANDBOOK_SECTIONS.map(s => ({
        section: s.type,
        count: p.sections[s.type] ?? 0,
        enabled: (p.sections[s.type] ?? 0) > 0,
    }));
}

/** Calculate total pages from a config array */
export function getTotalPages(config: HandbookPageConfig[]): number {
    return config.filter(c => c.enabled).reduce((sum, c) => sum + c.count, 0);
}
