import { CurriculumLesson, CurriculumParams, LessonInput } from '../types';
import { ACTIVITY_FOCUS_OPTIONS, CEFR_LEVELS, AGE_RANGES } from '../constants';

/** Map STEAM Designer english levels to CEFR levels */
function mapEnglishLevel(steamLevel: string): string {
    const mapping: Record<string, string> = {
        'Zero Foundation (零基础)': 'Pre-A1 (Absolute Beginner)',
        'Elementary (A1)': 'A1 (Beginner)',
        'Pre-Intermediate (A2)': 'A2 (Elementary)',
        'Intermediate (B1)': 'B1 (Intermediate)',
        'Upper-Intermediate (B2)': 'B2 (Upper Intermediate)',
        'Advanced (C1)': 'B2 (Upper Intermediate)',
        'Proficient (C2)': 'B2 (Upper Intermediate)',
    };
    return mapping[steamLevel] || CEFR_LEVELS[1]; // default A1
}

/** Parse steam_focus text to extract matching activityFocus IDs */
function parseActivityFocus(steamFocus: string): string[] {
    const text = steamFocus.toLowerCase();
    const matched: string[] = [];

    const keywords: Record<string, string[]> = {
        biology: ['biology', 'ecology', 'plant', 'animal', 'insect', 'nature', 'life', 'living',
            '生物', '生态', '植物', '动物', '昆虫', '自然', '生命', '观察'],
        physics: ['physics', 'force', 'motion', 'energy', 'light', 'sound', 'gravity',
            '物理', '力', '运动', '能量', '光', '声音', '重力', '摩擦'],
        chemistry: ['chemistry', 'chemical', 'reaction', 'matter', 'substance', 'molecule',
            '化学', '化合', '反应', '物质', '分子', '实验'],
        engineering: ['engineering', 'design', 'build', 'construct', 'structure', 'bridge', 'technology', 'tech',
            '工程', '设计', '建造', '构建', '结构', '桥', '技术', '搭建', '制作'],
        earth: ['earth', 'geology', 'rock', 'soil', 'weather', 'climate', 'space', 'water cycle',
            '地球', '地质', '岩石', '土壤', '天气', '气候', '太空', '水循环', '地理'],
        math: ['math', 'measurement', 'geometry', 'calculation', 'pattern', 'numbers', 'data',
            '数学', '测量', '几何', '计算', '规律', '数字', '数据', '统计'],
        art: ['art', 'visual', 'paint', 'draw', 'color', 'creative', 'aesthetic',
            '艺术', '美术', '绘画', '画', '颜色', '创意', '审美', '手工'],
        music: ['music', 'sound', 'rhythm', 'melody',
            '音乐', '声音', '节奏', '旋律', '歌'],
    };

    for (const [focusId, terms] of Object.entries(keywords)) {
        if (terms.some(t => text.includes(t))) {
            matched.push(focusId);
        }
    }

    return matched.length > 0 ? matched : ['biology']; // default fallback
}

/** Parse duration string like "180 minutes" to number */
function parseDuration(durationStr: string): number {
    const match = durationStr.match(/(\d+)/);
    return match ? parseInt(match[1]) : 180;
}

/**
 * Map a STEAM CurriculumLesson + its parent CurriculumParams
 * into a Nature Compass LessonInput, ready for generateLessonPlan.
 */
export function mapLessonToInput(
    lesson: CurriculumLesson,
    params: CurriculumParams
): LessonInput {
    return {
        theme: lesson.title,
        topicIntroduction: lesson.description,
        activityFocus: parseActivityFocus(lesson.steam_focus),
        weather: 'Sunny', // default — user can change
        season: 'Spring', // default — user can change
        studentAge: params.ageGroup || AGE_RANGES[0],
        studentCount: 12,
        duration: parseDuration(params.duration),
        cefrLevel: mapEnglishLevel(params.englishLevel),
        handbookPages: 15,
        uploadedFiles: [],
    };
}
