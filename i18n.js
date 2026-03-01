/**
 * Pathway Academy Toolkit — Landing Page i18n
 * Lightweight translation system for static HTML.
 */
(function () {
    const STORAGE_KEY = 'pathway_uiLang';

    const translations = {
        'badge': {
            en: '✨ Global Learning, Elevated',
            zh: '✨ 全球化学习，卓越赋能',
        },
        'hero.title.before': {
            en: 'Empowering Educators with',
            zh: '以 AI 驱动精准赋能教育者',
        },
        'hero.highlight': {
            en: 'AI-Driven Precision',
            zh: '',
        },
        'hero.desc': {
            en: 'Welcome to the Teacher Toolkit. Explore our holistic suite of pedagogical tools designed for modern, immersive learning experiences.',
            zh: '欢迎使用教师工具箱。探索我们为现代沉浸式学习体验打造的全方位教学工具套件。',
        },
        'hero.cta': {
            en: 'Explore Tools',
            zh: '探索工具',
        },
        'status': {
            en: 'TOOLKIT ACTIVE',
            zh: '工具箱已激活',
        },

        // Tool Cards
        'tool.esl.title': {
            en: 'ESL Smart Planner',
            zh: 'ESL 智能备课',
        },
        'tool.esl.desc': {
            en: 'Holistic lesson planning suite designed specifically for English language educators.',
            zh: '专为英语教育者打造的全方位课程规划套件。',
        },
        'tool.esl.btn': {
            en: 'Launch Planner',
            zh: '启动规划器',
        },
        'tool.essay.title': {
            en: 'Essay Correction Lab',
            zh: '作文批改实验室',
        },
        'tool.essay.desc': {
            en: 'Advanced AI grading and feedback system for professional English essay assessment.',
            zh: '专业英语作文 AI 评分与深度反馈系统。',
        },
        'tool.essay.btn': {
            en: 'Open Lab',
            zh: '打开实验室',
        },
        'tool.nature.title': {
            en: 'Nature Compass',
            zh: '自然指南针',
        },
        'tool.nature.desc': {
            en: 'STEAM curriculum planner & lesson kit generator for immersive outdoor learning experiences.',
            zh: 'STEAM 课程规划与课件生成器，打造沉浸式户外学习体验。',
        },
        'tool.nature.btn': {
            en: 'Design Lessons',
            zh: '设计课程',
        },
        'tool.ops.title': {
            en: 'Rednote Ops',
            zh: '小红书运营',
        },
        'tool.ops.desc': {
            en: 'Internal tools for social media operations and academy growth management.',
            zh: '社交媒体运营与学院增长管理内部工具。',
        },
        'tool.ops.btn': {
            en: 'Manage Ops',
            zh: '管理运营',
        },

        // Footer
        'footer': {
            en: '© 2026 Pathway Academy. Global Learning, Elevated.',
            zh: '© 2026 Pathway Academy. 全球化学习，卓越赋能。',
        },

        // Lang toggle
        'lang.label': {
            en: 'EN',
            zh: '中文',
        },
    };

    function getLang() {
        try {
            return localStorage.getItem(STORAGE_KEY) || 'en';
        } catch {
            return 'en';
        }
    }

    function setLang(lang) {
        try {
            localStorage.setItem(STORAGE_KEY, lang);
        } catch { }
    }

    function applyTranslations(lang) {
        document.querySelectorAll('[data-i18n]').forEach(function (el) {
            var key = el.getAttribute('data-i18n');
            if (translations[key] && key in translations && lang in translations[key]) {
                el.textContent = translations[key][lang];
            }
        });
        // Update html lang attribute
        document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
        // Update toggle button state
        var toggleBtn = document.getElementById('lang-toggle');
        if (toggleBtn) {
            toggleBtn.textContent = lang === 'en' ? '中文' : 'EN';
            toggleBtn.setAttribute('data-current-lang', lang);
        }
    }

    function toggleLanguage() {
        var current = getLang();
        var next = current === 'en' ? 'zh' : 'en';
        setLang(next);
        applyTranslations(next);
    }

    // Expose globally for the toggle button
    window.pathwayI18n = {
        toggle: toggleLanguage,
        apply: applyTranslations,
        getLang: getLang,
    };

    // Auto-apply on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            applyTranslations(getLang());
        });
    } else {
        applyTranslations(getLang());
    }
})();
