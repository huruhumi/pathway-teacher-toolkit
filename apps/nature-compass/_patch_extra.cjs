const fs = require('fs');
const path = require('path');

const base = 'd:/Vibe Coding Projects/Pathway Academy Toolkit/apps/nature-compass';

// Update translations.ts
let trans = fs.readFileSync(`${base}/i18n/translations.ts`, 'utf8');

const missingTrans = `
    // Extra TabRoadmap
    'road.workshopDetails': { en: 'Workshop Details', zh: '工坊概览' },
    'road.introContext': { en: 'Introduction / Context', zh: '背景介绍 / 语境' },
    'road.teacherInstructions': { en: 'Teacher Instructions', zh: '教师执行指令' },
    'road.generateStep': { en: 'Generate Next Step', zh: '生成下一步' },
    'road.addPhaseBtn': { en: 'Add Roadmap Phase', zh: '添加教学阶段' },
    
    // Extra InputSection
    'input.weatherLabel': { en: 'Weather Forecast', zh: '天气预报' },
    'input.seasonLabel': { en: 'Season', zh: '季节' },
    'input.focusLabel': { en: 'Activity Focus (Multi-select)', zh: '活动重点（多选）' },
    'input.ageLabel': { en: 'Target Age Group', zh: '目标年龄段' },
    'input.studentsLabel': { en: 'Number of Students', zh: '学生人数' },
    'input.durationLabel': { en: 'Duration (Minutes)', zh: '时长（分钟）' },
    'input.cefrLabel': { en: 'CEFR Level', zh: 'CEFR 语言等级' },
    'input.handbookLabel': { en: 'Handbook Pages', zh: '手册页数' },
    'input.cefrPlaceholder': { en: 'A2 (Elementary)', zh: 'A2 (初级)' },

    // Seasons
    'season.Spring': { en: 'Spring', zh: '春季' },
    'season.Summer': { en: 'Summer', zh: '夏季' },
    'season.Autumn': { en: 'Autumn', zh: '秋季' },
    'season.Winter': { en: 'Winter', zh: '冬季' },

    // Activity Focus
    'focus.Biology & Ecology': { en: 'Biology & Ecology', zh: '生物与生态' },
    'focus.Earth & Space': { en: 'Earth & Space', zh: '地球与空间' },
    'focus.Physics & Forces': { en: 'Physics & Forces', zh: '物理与力学' },
    'focus.Chemistry & Matter': { en: 'Chemistry & Matter', zh: '化学与物质' },
    'focus.Engineering & Design': { en: 'Engineering & Design', zh: '工程与设计' },
    'focus.Math & Logic': { en: 'Math & Logic', zh: '数学与逻辑' },
    'focus.Visual Arts': { en: 'Visual Arts', zh: '视觉艺术' },
    'focus.Music & Sound': { en: 'Music & Sound', zh: '音乐与声音' },
    'focus.Theater & Drama': { en: 'Theater & Drama', zh: '戏剧与表演' },
    'focus.Social Science': { en: 'Social Science', zh: '社会科学' },
    'focus.Economy & Trade': { en: 'Economy & Trade', zh: '经济与贸易' },
`;

if (!trans.includes('road.workshopDetails')) {
    trans = trans.replace(/\} as const;/, missingTrans + '} as const;');
    fs.writeFileSync(`${base}/i18n/translations.ts`, trans);
}


// Patch TabRoadmap.tsx
let roadmap = fs.readFileSync(`${base}/components/tabs/TabRoadmap.tsx`, 'utf8');
roadmap = roadmap.replace(/Workshop Details\s*<\/h3>/g, "{t('road.workshopDetails')}</h3>");
roadmap = roadmap.replace(/>Theme<\/label>/g, ">{t('road.theme')}</label>");
roadmap = roadmap.replace(/>Activity Type<\/label>/g, ">{t('road.activityType')}</label>");
roadmap = roadmap.replace(/>Target Audience<\/label>/g, ">{t('road.targetAudience')}</label>");
roadmap = roadmap.replace(/>Location<\/label>/g, ">{t('road.location')}</label>");
roadmap = roadmap.replace(/>Introduction \/ Context<\/label>/g, ">{t('road.introContext')}</label>");
roadmap = roadmap.replace(/>Learning Goals<\/label>/g, ">{t('road.learningGoals')}</label>");
roadmap = roadmap.replace(/> Add Goal\s*<\/button>/g, "> {t('road.addGoal')}</button>");
roadmap = roadmap.replace(/>Time<\/label>/g, ">{t('road.time')}</label>");
roadmap = roadmap.replace(/>Phase<\/label>/g, ">{t('road.phase')}</label>");
roadmap = roadmap.replace(/>Activity Name<\/label>/g, ">{t('road.activityName')}</label>");
roadmap = roadmap.replace(/>Description<\/label>/g, ">{t('road.description')}</label>");
// Type/Location inside map
roadmap = roadmap.replace(/mb-1">Type<\/label>/g, "mb-1\">{t('road.type')}</label>");
roadmap = roadmap.replace(/mb-1">Location<\/label>/g, "mb-1\">{t('road.location')}</label>");
roadmap = roadmap.replace(/>Objective<\/label>/g, ">{t('road.objective')}</label>");
roadmap = roadmap.replace(/Background Knowledge\s*<\/label>/g, "{t('road.backgroundInfo')}</label>");
roadmap = roadmap.replace(/Add Info\s*<\/button>/g, "{t('road.addBgInfo')}</button>");
roadmap = roadmap.replace(/Teaching Tips & Methodology\s*<\/label>/g, "{t('road.teachingTips')}</label>");
roadmap = roadmap.replace(/Add Tip\s*<\/button>/g, "{t('road.addTip')}</button>");
roadmap = roadmap.replace(/Teacher Instructions\s*<\/label>/g, "{t('road.teacherInstructions')}</label>");
roadmap = roadmap.replace(/Generate Next Step\s*<\/button>/g, "{t('road.generateStep')}</button>");
roadmap = roadmap.replace(/Add Roadmap Phase\s*<\/button>/g, "{t('road.addPhaseBtn')}</button>");

// No background info empty states
roadmap = roadmap.replace(/>No background info added.<\/div>/g, ">{t('fc.noImage') || 'No info'}</div>"); // Quick fix, or add specific key if needed. Let's just use raw translated text:
roadmap = roadmap.replace(/>No background info added.<\/div>/g, ">无背景知识。</div>");
roadmap = roadmap.replace(/>No teaching tips added.<\/div>/g, ">无教学建议。</div>");

fs.writeFileSync(`${base}/components/tabs/TabRoadmap.tsx`, roadmap);


// Patch InputSection.tsx
let inputsec = fs.readFileSync(`${base}/components/InputSection.tsx`, 'utf8');

if (!inputsec.includes('useLanguage')) {
    inputsec = inputsec.replace(
        /import \{ generateRandomTheme \} from '\.\.\/services\/geminiService';/,
        "import { generateRandomTheme } from '../services/geminiService';\nimport { useLanguage, TranslationKey } from '../i18n/LanguageContext';"
    );
    inputsec = inputsec.replace(
        /const fileInputRef = useRef<HTMLInputElement>\(null\);/,
        "const { t } = useLanguage();\n  const fileInputRef = useRef<HTMLInputElement>(null);"
    );
}

inputsec = inputsec.replace(/Weather Forecast\s*<\/label>/g, "{t('input.weatherLabel')}</label>");
inputsec = inputsec.replace(/Sunny\s*<\/button>/g, "{t('input.sunny')}</button>");
inputsec = inputsec.replace(/Rainy\/Indoor\s*<\/button>/g, "{t('input.rainy')}</button>");
inputsec = inputsec.replace(/Season\s*<\/label>/g, "{t('input.seasonLabel')}</label>");
// Season map rendering
inputsec = inputsec.replace(/>\s*\{s\}\s*<\/button>/g, ">{t(`season.${s}` as TranslationKey)}</button>");

inputsec = inputsec.replace(/Activity Focus \(Multi-select\)\s*<\/label>/g, "{t('input.focusLabel')}</label>");
// Focus map rendering
inputsec = inputsec.replace(/>\s*\{opt.label\}\s*<\/button>/g, "> {t(`focus.${opt.label}` as TranslationKey) || opt.label}\n              </button>");

inputsec = inputsec.replace(/Target Age Group\s*<\/label>/g, "{t('input.ageLabel')}</label>");
inputsec = inputsec.replace(/Number of Students\s*<\/label>/g, "{t('input.studentsLabel')}</label>");
inputsec = inputsec.replace(/Duration \(Minutes\)\s*<\/label>/g, "{t('input.durationLabel')}</label>");
inputsec = inputsec.replace(/CEFR Level\s*<\/label>/g, "{t('input.cefrLabel')}</label>");
inputsec = inputsec.replace(/Handbook Pages\s*<\/label>/g, "{t('input.handbookLabel')}</label>");
inputsec = inputsec.replace(/>\s*Generate Lesson Kit\s*<\/button>/g, ">{t('input.generate')}</button>");
inputsec = inputsec.replace(/>\s*Stop Generating\s*<\/button>/g, ">{t('input.stop')}</button>");
inputsec = inputsec.replace(/>\s*Upload Materials\s*<\/span>/g, ">{t('input.upload')}</span>");
inputsec = inputsec.replace(/>\s*Drop images or PDF here, or click to browse\s*<\/p>/g, ">{t('input.uploadDesc')}</p>");

fs.writeFileSync(`${base}/components/InputSection.tsx`, inputsec);

console.log('Fixed translations!');
