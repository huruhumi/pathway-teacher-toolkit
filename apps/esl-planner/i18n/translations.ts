export const translations = {
    // Nav tabs
    'nav.curriculum': { en: 'Curriculum', zh: 'Curriculum' },
    'nav.planner': { en: 'Planner', zh: 'Planner' },
    'nav.records': { en: 'Records', zh: 'Records' },
    'app.subtitle': { en: 'AI-Powered Curriculum Assistant', zh: 'AI-Powered Curriculum Assistant' },

    // Curriculum tab hero
    'cur.title': { en: 'Curriculum Designer', zh: 'Curriculum Designer' },
    'cur.desc': { en: 'Upload a PDF textbook — AI auto-splits it into a structured curriculum by lesson count. Click any lesson to generate a full Lesson Kit.', zh: '上传PDF教材，AI自动按课时数拆分为结构化课程大纲。点击任意课时即可一键生成完整Lesson Kit。' },

    // Planner tab hero
    'plan.title': { en: 'Transform Teaching Materials in Seconds', zh: 'Transform Teaching Materials in Seconds' },
    'plan.desc': { en: 'Upload textbook pages, images, or paste text to generate comprehensive lesson plans, slides, and interactive games tailored to any CEFR level.', zh: 'Upload textbook pages, images, or paste text to generate comprehensive lesson plans, slides, and interactive games tailored to any CEFR level.' },
    'plan.structuredPlans': { en: 'Structured Plans', zh: 'Structured Plans' },
    'plan.interactiveGames': { en: 'Interactive Games', zh: 'Interactive Games' },
    'plan.backToGenerator': { en: 'Back to Generator', zh: 'Back to Generator' },

    // Records tab
    'rec.title': { en: 'Saved Records', zh: 'Saved Records' },
    'rec.desc': { en: 'Manage saved curriculum outlines and Lesson Kits.', zh: '管理已保存的课程大纲和Lesson Kit。' },
    'rec.curricula': { en: 'Curricula', zh: 'Curricula' },
    'rec.lessonKits': { en: 'Lesson Kits', zh: 'Lesson Kits' },
    'rec.noCurricula': { en: 'No saved curricula yet', zh: '还没有保存的课程大纲' },
    'rec.noCurriculaHint': { en: 'Generate and save a curriculum on the Curriculum page to see it here.', zh: '在 Curriculum 页面生成并保存课程大纲后即可在此查看。' },
    'rec.goDesign': { en: 'Design a Curriculum →', zh: '去设计课程 →' },
    'rec.noResults': { en: 'No matching results', zh: '没有匹配的结果' },
    'rec.clearFilters': { en: 'Clear All Filters', zh: '清除所有筛选' },
    'rec.allCounts': { en: 'All Counts', zh: 'All Counts' },
    'rec.lessons': { en: 'lessons', zh: '课时' },
    'rec.openCurriculum': { en: 'Open Curriculum', zh: '打开课程大纲' },
    'rec.noKits': { en: 'No saved Lesson Kits yet', zh: '还没有保存的 Lesson Kit' },
    'rec.noKitsHint': { en: 'Generate and save a Lesson Kit to see it here.', zh: '生成并保存一个 Lesson Kit 后即可在此查看。' },
    'rec.goCreate': { en: 'Create Lesson Kit →', zh: '去创建 Lesson Kit →' },
    'rec.currentlyEditing': { en: 'Currently Editing', zh: 'Currently Editing' },
    'rec.openKit': { en: 'Open Kit', zh: 'Open Kit' },

    // Footer
    'footer': { en: `© ${new Date().getFullYear()} ESL Smart Planner. Built with Google Gemini.`, zh: `© ${new Date().getFullYear()} ESL Smart Planner. Built with Google Gemini.` },

    // FilterBar
    'filter.search': { en: 'Search...', zh: 'Search...' },
    'filter.allLevels': { en: 'All Levels', zh: 'All Levels' },
    'filter.allDates': { en: 'All Dates', zh: 'All Dates' },
    'filter.last7': { en: 'Last 7 days', zh: 'Last 7 days' },
    'filter.last30': { en: 'Last 30 days', zh: 'Last 30 days' },
    'filter.newest': { en: 'Newest first', zh: 'Newest first' },
    'filter.oldest': { en: 'Oldest first', zh: 'Oldest first' },
} as const;

export type TranslationKey = keyof typeof translations;
