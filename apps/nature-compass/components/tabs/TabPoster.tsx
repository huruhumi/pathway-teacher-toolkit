import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Camera,
    Image as ImageIcon,
    MessageSquare,
    Download,
    Loader2,
    RefreshCw,
    ImagePlus,
    Trash2,
    Send,
    ChevronLeft,
    ChevronRight,
    Plus,
    Type,
    Sparkles,
} from 'lucide-react';
import * as htmlToImage from 'html-to-image';
import { useLessonStore } from '../../stores/useLessonStore';
import {
    extractSteamHighlights,
    generateSocialMediaCopy,
    generateThemePalette,
    type SteamCopyStyleOption,
    type SteamHighlight,
} from '../../services/gemini/poster';
import { generatePosterBgPrompt, generateImage, generateImageWithRef } from '../../services/imageService';
import { PosterTemplate } from './PosterTemplate';
import { ContentIntroTemplate } from './ContentIntroTemplate';
import { InnerPagesTemplate } from './InnerPagesTemplate';
import { AllPagesTemplate } from './AllPagesTemplate';
import { SteamPosterTemplate } from './SteamPosterTemplate';
import { sanitizeFilename } from '../../utils/fileHelpers';
import { useLanguage } from '../../i18n/LanguageContext';
import { useSessionStore } from '../../stores/appStore';

const OUTDOOR_HINTS = [
    'outdoor', 'park', 'garden', 'lake', 'river', 'wetland', 'forest', 'trail',
    '\u6237\u5916', '\u516c\u56ed', '\u82b1\u56ed', '\u6e56', '\u6c5f', '\u6cb3', '\u6e7f\u5730', '\u68ee\u6797', '\u6b65\u9053', '\u8425\u5730',
];
const INDOOR_HINTS = [
    'indoor', 'classroom', 'lab', 'studio', 'museum',
    '\u5ba4\u5185', '\u6559\u5ba4', '\u5b9e\u9a8c\u5ba4', '\u573a\u9986', '\u9986\u5185',
];
const IMAGES_PER_PAGE = 2;

const FULL_BLEED_SCENE_RULE = 'Render a direct immersive scene background that fills the entire canvas edge-to-edge. Never render a photo print, framed card, hanging sheet, clip, tape, pinboard, poster-within-poster, irregular cutout silhouette, or sticker-like island composition.';
const DARK_BASE_RULE = 'Use a deep dark base tone for the whole background (navy/charcoal). The lower area should be a dark, mostly solid field with only subtle texture. Avoid large light-gray/white empty areas.';
const DEFAULT_STEAM_HOOKS_TEXT = '🔹 动手能力｜🔹 团队协作｜🔹 表达分享｜🔹 STEAM综合素养\n孩子们在玩中学，自然开口说英语，在合作中成长！';
const DEFAULT_STEAM_HIGHLIGHTS_TITLE = '活动亮点';

const detectOutdoorContext = (location?: string, activityType?: string): boolean => {
    const text = `${location || ''} ${activityType || ''}`.toLowerCase();
    if (!text.trim()) return false;
    if (OUTDOOR_HINTS.some((k) => text.includes(k))) return true;
    if (INDOOR_HINTS.some((k) => text.includes(k))) return false;
    return false;
};

const parseDurationMinutes = (value: string): number | null => {
    const matched = String(value || '').match(/\d+/);
    if (!matched) return null;
    const parsed = Number.parseInt(matched[0], 10);
    return Number.isFinite(parsed) ? parsed : null;
};

const formatZhDate = (date: Date): string => `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;

const buildSteamHighlightVisualBrief = (
    highlights: Array<{ label?: string; desc?: string }>,
    fallbackActivities: string[] = [],
) => {
    const normalized = (highlights || [])
        .map((h) => ({
            label: (h?.label || '').trim(),
            desc: (h?.desc || '').trim(),
        }))
        .filter((h) => h.label || h.desc)
        .slice(0, 4);

    if (normalized.length > 0) {
        return normalized.map((h, i) => `${i + 1}. ${h.label || 'Activity focus'}${h.desc ? ` - ${h.desc}` : ''}`).join(' ');
    }
    if (fallbackActivities.length > 0) {
        return fallbackActivities.slice(0, 4).map((a, i) => `${i + 1}. ${a}`).join(' ');
    }
    return '';
};

const STRICT_CN_STEAM_HOOKS_TEXT = '🔹 动手能力｜🔹 团队协作｜🔹 表达分享｜🔹 STEAM综合素养\n孩子们在玩中学学中玩，自然开口说英语！';
const STRICT_CN_STEAM_HIGHLIGHTS_TITLE = '活动亮点';
const STRICT_CN_DEFAULT_SUBTITLE = '自然指针 · 专属研学手册';
const hasCjkText = (value?: string): boolean => /[\u4e00-\u9fff]/.test(String(value || ''));
const ensureChinese = (value: string | undefined, fallback: string): string => {
    const text = String(value || '').trim();
    if (!text) return fallback;
    return hasCjkText(text) ? text : fallback;
};
const ensureChineseDuration = (value: string | undefined, fallback: string): string => {
    const text = String(value || '').trim();
    if (!text) return fallback;
    if (hasCjkText(text)) return text;
    const m = text.match(/(\d+)/);
    if (!m) return fallback;
    return `${m[1]} 分钟`;
};
const strictZhDateText = (date: Date): string => `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
const STRICT_CN_HIGHLIGHT_FALLBACKS: Array<{ label: string; desc: string }> = [
    { label: '词汇启蒙', desc: '围绕主题词进行观察、表达与互动。' },
    { label: '科学探索', desc: '通过动手实验理解现象与原因。' },
    { label: '创意艺术', desc: '用绘画或手工完成主题创作。' },
    { label: '实践任务', desc: '在任务中完成合作与表达输出。' },
];

export const TabPoster: React.FC = () => {
    const { t } = useLanguage();
    const store = useLessonStore();
    const structuredKnowledge = useSessionStore((s) => s.lessonPlan?.structuredKnowledge);
    const factSheet = useSessionStore((s) => s.lessonPlan?.factSheet);

    const posterRef = useRef<HTMLDivElement>(null);
    const refInputRef = useRef<HTMLInputElement>(null);

    const [posterComment, setPosterComment] = useState('');
    const [refImage, setRefImage] = useState<string | null>(null);
    const [posterTitle, setPosterTitle] = useState(() => sessionStorage.getItem('nc_posterTitle') || '');
    const [posterSubText, setPosterSubText] = useState(() => sessionStorage.getItem('nc_posterSubText') || '自然指针 · 专属研学手册');
    const [showcasePageIndex, setShowcasePageIndex] = useState(0);

    const showcasePages = Math.max(1, Math.ceil(store.showcaseImages.length / IMAGES_PER_PAGE));
    const currentPageImages = store.showcaseImages.slice(
        showcasePageIndex * IMAGES_PER_PAGE,
        showcasePageIndex * IMAGES_PER_PAGE + IMAGES_PER_PAGE,
    );

    useEffect(() => {
        if (showcasePageIndex > showcasePages - 1) {
            setShowcasePageIndex(Math.max(0, showcasePages - 1));
        }
    }, [showcasePageIndex, showcasePages]);

    const isOutdoor = useMemo(
        () => detectOutdoorContext(store.basicInfo.location, store.basicInfo.activityType),
        [store.basicInfo.location, store.basicInfo.activityType],
    );

    const buildSteamInfoLine = () => {
        const location = (store.basicInfo.location || '').trim();
        if (isOutdoor && location) return `📍 活动地点：${location}`;
        return `🌿 ${store.basicInfo.theme || 'STEAM 活动'}`;
    };

    const buildDefaultTimeText = () => {
        const parsed = parseDurationMinutes(store.durationDisplay || '');
        if (parsed) return `${parsed} 分钟`;
        return store.durationDisplay || '180 分钟';
    };

    const buildDefaultDateText = () => strictZhDateText(new Date());
    const buildDefaultAgeText = () => (store.basicInfo.targetAudience || '').trim() || '3-8岁';
    const buildDefaultEnglishLine = () => '英语融合：每个环节都有关键词输入、句型跟读和开口表达任务。';

    useEffect(() => {
        if (store.posterLanguage !== 'zh') {
            store.setPosterLanguage('zh');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (store.basicInfo.theme && !store.themePalette) {
            generateThemePalette(store.basicInfo.theme, store.basicInfo.location)
                .then((palette) => store.setThemePalette(palette))
                .catch(console.error);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const buildStrictZhAgeText = () => ensureChinese((store.basicInfo.targetAudience || '').trim(), '3-8岁');
    const buildStrictZhEnglishLine = () => '英语融合：每个环节都包含关键词、句型跟读和开口表达任务。';

    const handleGenerateCopy = async () => {
        if (!store.basicInfo.theme) return;
        store.setLoadingPosterCopy(true);
        try {
            const copy = await generateSocialMediaCopy(
                store.posterPlatform,
                store.basicInfo.theme,
                store.basicInfo.learningGoals,
                'zh',
            );
            store.setPosterCopy(copy);
        } catch (error) {
            console.error(error);
        } finally {
            store.setLoadingPosterCopy(false);
        }
    };

    const handleGenerateImage = async (commentOverride?: string) => {
        if (!store.basicInfo.theme) return;
        store.setLoadingPosterImage(true);
        try {
            const comment = (commentOverride ?? posterComment).trim();
            const hasCustomOverride = comment.length > 0;
            const aspect = store.posterPlatform === 'xhs' ? '3:4' : '1:1';
            const stylePrompt = store.artStyles[0] || 'Minimalist, flat vector illustration, elegant colors';
            const locationStr = isOutdoor ? ((store.basicInfo.location || '').trim() || 'Nature') : '';

            const fallbackActivities = (store.roadmap || [])
                .map((r) => (r.activity || '').trim())
                .filter(Boolean);
            const steamHighlightBrief = buildSteamHighlightVisualBrief(store.steamHighlights, fallbackActivities);
            const steamModeInstruction = store.posterMode === 'steam' && !hasCustomOverride
                ? [
                    `Activity anchors: ${steamHighlightBrief}`,
                    'Narrative coherence: compose one unified classroom/activity moment instead of fragmented collage.',
                    isOutdoor
                        ? `Outdoor context: include subtle but recognizable cues of ${locationStr}.`
                        : 'Indoor context: focus on children, materials, and activity actions. Do not add explicit place-name signage.',
                ].filter(Boolean).join(' ')
                : '';

            const palette = store.themePalette;
            const paletteInstruction = [
                'COLOR PALETTE (must be visible in the illustration):',
                'Brand colors to incorporate: Navy #1A2B58, Fuchsia #E91E63, Golden #FFC107, Sky Blue #87CEEB, Emerald #059669.',
                palette ? `Theme tones: primary ${palette.primary}, secondary ${palette.secondary}, accent ${palette.accent}.` : '',
                'Distribute colors naturally in scene elements and atmosphere.',
            ].filter(Boolean).join(' ');

            if (refImage) {
                const prompt = [
                    `Transform this reference photo into a ${stylePrompt} illustration for a poster background.`,
                    'Keep key architectural/scene details consistent with the reference.',
                    paletteInstruction,
                    'Put main subjects in top 55-65%. Keep lower 35-45% dark and low-detail for text.',
                    FULL_BLEED_SCENE_RULE,
                    DARK_BASE_RULE,
                    'Hard negatives: binder clip, tape corner, photo frame, hanging strings, corkboard.',
                    steamModeInstruction,
                    'No text, no typography. Full-bleed borderless scene.',
                    hasCustomOverride ? `HIGHEST PRIORITY user scene: ${comment}` : '',
                ].filter(Boolean).join(' ');

                store.setPosterPrompt(prompt);
                const imageUrl = await generateImageWithRef(prompt, refImage, aspect);
                store.setPosterBgImage(imageUrl);
            } else {
                let archRef: string | undefined;
                const hasStrongCustomScene = comment.length >= 8;

                if (!hasStrongCustomScene && structuredKnowledge?.length) {
                    archRef = structuredKnowledge
                        .slice(0, 3)
                        .map((k) => `- ${k.topic}: ${k.content.slice(0, 500)}`)
                        .join('\n')
                        .slice(0, 2500);
                } else if (!hasStrongCustomScene && factSheet) {
                    archRef = factSheet.slice(0, 2500);
                }

                let prompt = await generatePosterBgPrompt(store.basicInfo.theme, stylePrompt, locationStr, archRef);
                prompt += `\n\n${paletteInstruction}`;
                prompt += '\n\nPut focal scene in upper half and keep lower half dark + low-detail for text.';
                prompt += `\n${FULL_BLEED_SCENE_RULE}`;
                prompt += `\n${DARK_BASE_RULE}`;
                prompt += '\nHard negatives: binder clip, tape corner, photo frame, hanging strings, corkboard.';
                if (steamModeInstruction) prompt += `\nDefault draft guidance: ${steamModeInstruction}`;
                if (hasCustomOverride) prompt += `\nHIGHEST PRIORITY USER SCENE: ${comment}`;

                store.setPosterPrompt(prompt);
                const imageUrl = await generateImage(prompt, aspect);
                store.setPosterBgImage(imageUrl);
            }
        } catch (error) {
            console.error(error);
        } finally {
            store.setLoadingPosterImage(false);
        }
    };

    const handleGenerateSteamText = async () => {
        if (!store.basicInfo.theme || !store.roadmap?.length) return;
        store.setLoadingSteamHighlights(true);
        try {
            const data = await extractSteamHighlights(
                store.roadmap,
                store.basicInfo.learningGoals,
                store.basicInfo.theme,
                {
                    durationText: buildDefaultTimeText(),
                    dateText: buildDefaultDateText(),
                    audienceText: buildStrictZhAgeText(),
                    language: 'zh',
                },
            );
            store.setSteamHighlights(data.highlights || []);
            store.setSteamGoal(data.goal || '');
            store.setSteamHooks(data.hooks || []);
            store.setSteamEnglishLine(data.englishLine || buildStrictZhEnglishLine());
            store.setSteamTimeText(data.timeText || buildDefaultTimeText());
            store.setSteamDateText(data.dateText || buildDefaultDateText());
            store.setSteamAgeText(data.ageText || buildStrictZhAgeText());
            store.setSteamCopyStyles(data.copyStyles || []);
            if (!store.steamHooksText?.trim()) store.setSteamHooksText(STRICT_CN_STEAM_HOOKS_TEXT);
            if (!store.steamHighlightsTitle?.trim()) store.setSteamHighlightsTitle(STRICT_CN_STEAM_HIGHLIGHTS_TITLE);
            if (!store.steamInfoLine) store.setSteamInfoLine(buildSteamInfoLine());
        } catch (error) {
            console.error(error);
        } finally {
            store.setLoadingSteamHighlights(false);
        }
    };

    const applyCopyStyle = (style: SteamCopyStyleOption) => {
        const nextTitle = ensureChinese(
            style.headline,
            ensureChinese(posterTitle, ensureChinese(store.basicInfo.theme, '自然探索活动')),
        );
        const nextSub = ensureChinese(
            style.subtitle,
            ensureChinese(posterSubText, STRICT_CN_DEFAULT_SUBTITLE),
        );
        setPosterTitle(nextTitle);
        setPosterSubText(nextSub);
        sessionStorage.setItem('nc_posterTitle', nextTitle);
        sessionStorage.setItem('nc_posterSubText', nextSub);
        if (style.englishLine) store.setSteamEnglishLine(ensureChinese(style.englishLine, buildStrictZhEnglishLine()));
    };

    const handleDownload = async () => {
        if (!posterRef.current || !store.posterBgImage) return;
        try {
            const dataUrl = await htmlToImage.toPng(posterRef.current, { quality: 1, pixelRatio: 3 });
            const suffix = store.posterMode === 'steam'
                ? '-STEAM-Poster'
                : store.posterType === 'intro'
                    ? '-Intro'
                    : store.posterType === 'showcase'
                        ? '-InnerPages'
                        : store.posterType === 'allpages'
                            ? '-AllPages'
                            : '-Cover';
            const link = document.createElement('a');
            link.download = `${sanitizeFilename(store.basicInfo.theme)}${suffix}.png`;
            link.href = dataUrl;
            link.click();
        } catch (error) {
            console.error('Failed to download image', error);
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []) as File[];
        if (!files.length) return;

        if (store.posterType === 'allpages') {
            const reader = new FileReader();
            reader.onload = (event) => {
                if (event.target?.result) {
                    store.setGridImages([event.target.result as string]);
                }
            };
            reader.readAsDataURL(files[0]);
            return;
        }

        const pageStart = showcasePageIndex * IMAGES_PER_PAGE;
        const pageImages = store.showcaseImages.slice(pageStart, pageStart + IMAGES_PER_PAGE);
        const slotsLeft = IMAGES_PER_PAGE - pageImages.length;
        const filesToProcess = files.slice(0, slotsLeft);

        filesToProcess.forEach((file) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                if (!event.target?.result) return;
                store.setShowcaseImages((prev: string[]) => {
                    const insertAt = Math.min(pageStart + IMAGES_PER_PAGE, prev.length);
                    const next = [...prev];
                    next.splice(insertAt, 0, event.target!.result as string);
                    return next;
                });
            };
            reader.readAsDataURL(file);
        });
    };

    const handleAddShowcasePage = () => {
        setShowcasePageIndex(showcasePages);
    };

    const handleDeleteShowcasePage = () => {
        const pageStart = showcasePageIndex * IMAGES_PER_PAGE;
        store.setShowcaseImages((prev: string[]) => {
            const next = [...prev];
            next.splice(pageStart, IMAGES_PER_PAGE);
            return next;
        });
        if (showcasePageIndex > 0) setShowcasePageIndex((v) => v - 1);
    };

    const effectiveSteamHighlights = useMemo<SteamHighlight[]>(() => {
        const existing = (store.steamHighlights || []).filter((h) => (h.label || '').trim() || (h.desc || '').trim());
        if (existing.length > 0) return existing.slice(0, 4);
        return (store.roadmap || []).slice(0, 4).map((r, i) => ({
            emoji: ['🎁', '🔬', '🎨', '🍓'][i] || '✨',
            label: (r.activity || `Highlight ${i + 1}`).slice(0, 18),
            desc: (r.description || '').slice(0, 30),
        }));
    }, [store.steamHighlights, store.roadmap]);

    const effectiveSteamGoal = store.steamGoal || store.basicInfo.learningGoals?.[0] || store.basicInfo.theme;
    const effectiveEnglishLine = store.steamEnglishLine || buildDefaultEnglishLine();
    const effectiveTimeText = store.steamTimeText || buildDefaultTimeText();
    const effectiveDateText = store.steamDateText || buildDefaultDateText();
    const effectiveAgeText = store.steamAgeText || buildDefaultAgeText();
    const effectiveSteamHooksText = (store.steamHooksText || '').trim() || STRICT_CN_STEAM_HOOKS_TEXT;
    const effectiveSteamHighlightsTitle = (store.steamHighlightsTitle || '').trim() || STRICT_CN_STEAM_HIGHLIGHTS_TITLE;
    const effectiveInfoLine = store.steamInfoLine || buildSteamInfoLine();

    const normalizedSteamHighlights = useMemo<SteamHighlight[]>(
        () => effectiveSteamHighlights.map((h, i) => ({
            ...h,
            label: ensureChinese(h.label, STRICT_CN_HIGHLIGHT_FALLBACKS[i]?.label || `活动亮点${i + 1}`),
            desc: ensureChinese(h.desc, STRICT_CN_HIGHLIGHT_FALLBACKS[i]?.desc || '点击“生成”自动提炼中文亮点。'),
        })),
        [effectiveSteamHighlights],
    );
    const effectiveSteamGoalZh = ensureChinese(
        effectiveSteamGoal,
        ensureChinese(store.basicInfo.learningGoals?.[0], ensureChinese(store.basicInfo.theme, '通过主题探究与实践，培养观察、表达与创造能力。')),
    );
    const effectiveEnglishLineZh = ensureChinese(effectiveEnglishLine, buildStrictZhEnglishLine());
    const effectiveTimeTextZh = ensureChineseDuration(effectiveTimeText, buildDefaultTimeText());
    const effectiveDateTextZh = ensureChinese(effectiveDateText, strictZhDateText(new Date()));
    const effectiveAgeTextZh = ensureChinese(effectiveAgeText, buildStrictZhAgeText());
    const effectiveSteamHooksTextZh = ensureChinese(effectiveSteamHooksText, STRICT_CN_STEAM_HOOKS_TEXT);
    const effectiveSteamHighlightsTitleZh = ensureChinese(effectiveSteamHighlightsTitle, STRICT_CN_STEAM_HIGHLIGHTS_TITLE);
    const effectiveInfoLineZh = ensureChinese(
        effectiveInfoLine,
        isOutdoor ? '📍 户外自然探索活动（具体地点请咨询）' : '🌿 室内STEAM主题活动',
    );
    const effectivePosterTitleZh = ensureChinese(posterTitle || store.basicInfo.theme, '自然探索活动');
    const effectivePosterSubTextZh = ensureChinese(posterSubText, STRICT_CN_DEFAULT_SUBTITLE);

    const canUploadShowcase = currentPageImages.length < IMAGES_PER_PAGE;
    const canUploadAllPages = store.gridImages.length < 1;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in p-2">
            <div className="lg:col-span-5 space-y-6">
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-white/10 p-5">
                    <h3 className="font-bold mb-4 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                        <ImageIcon size={18} className="text-emerald-500" />
                        {t('poster.platformStrategy')}
                    </h3>
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                        <button
                            onClick={() => store.setPosterPlatform('wechat')}
                            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${store.posterPlatform === 'wechat' ? 'bg-white dark:bg-slate-700 shadow text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}
                        >
                            {t('poster.wechat')}
                        </button>
                        <button
                            onClick={() => store.setPosterPlatform('xhs')}
                            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${store.posterPlatform === 'xhs' ? 'bg-white dark:bg-slate-700 shadow text-red-500' : 'text-slate-500'}`}
                        >
                            {t('poster.xhs')}
                        </button>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-white/10 p-5">
                    <h3 className="font-bold mb-4 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                        <Sparkles size={18} className="text-emerald-500" />
                        海报模式
                    </h3>
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                        <button
                            onClick={() => store.setPosterMode('handbook')}
                            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${store.posterMode === 'handbook' ? 'bg-white dark:bg-slate-700 shadow text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}
                        >
                            手册模式
                        </button>
                        <button
                            onClick={() => store.setPosterMode('steam')}
                            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${store.posterMode === 'steam' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}
                        >
                            STEAM 海报
                        </button>
                    </div>
                </div>

                {store.posterMode !== 'steam' && (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-white/10 p-5">
                        <h3 className="font-bold mb-4 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                            <Type size={18} className="text-emerald-500" />
                            Poster Type
                        </h3>
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                            {[
                                { key: 'cover', label: 'Cover' },
                                { key: 'intro', label: 'Intro' },
                                { key: 'showcase', label: 'Inner Pages' },
                                { key: 'allpages', label: 'All Pages' },
                            ].map((item) => (
                                <button
                                    key={item.key}
                                    onClick={() => store.setPosterType(item.key as any)}
                                    className={`flex-1 py-2 px-1 text-[11px] font-medium rounded-lg transition-all whitespace-nowrap ${store.posterType === item.key ? 'bg-white dark:bg-slate-700 shadow text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {store.posterMode === 'steam' && (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-indigo-100 dark:border-indigo-900/50 p-5">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                                <Sparkles size={18} className="text-indigo-500" />
                                海报内容生成
                            </h3>
                            <button
                                onClick={handleGenerateSteamText}
                                disabled={store.loadingSteamHighlights || !store.roadmap?.length}
                                className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition-colors disabled:opacity-50"
                            >
                                {store.loadingSteamHighlights ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                {store.steamHighlights.length > 0 ? '重新生成' : '生成'}
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">教学目标</label>
                                <input
                                    value={effectiveSteamGoalZh}
                                    onChange={(e) => store.setSteamGoal(e.target.value)}
                                    className="w-full bg-transparent text-sm text-slate-700 dark:text-slate-300 border-none p-0 focus:ring-0"
                                />
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">英语融合亮点</label>
                                <textarea
                                    rows={2}
                                    value={effectiveEnglishLineZh}
                                    onChange={(e) => store.setSteamEnglishLine(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-xs text-slate-700 dark:text-slate-300 resize-none"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">活动时长</label>
                                    <input
                                        value={effectiveTimeTextZh}
                                        onChange={(e) => store.setSteamTimeText(e.target.value)}
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-xs"
                                    />
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">活动日期</label>
                                    <input
                                        value={effectiveDateTextZh}
                                        onChange={(e) => store.setSteamDateText(e.target.value)}
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-xs"
                                    />
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">适合年龄</label>
                                    <input
                                        value={effectiveAgeTextZh}
                                        onChange={(e) => store.setSteamAgeText(e.target.value)}
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-xs"
                                    />
                                </div>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">家长买单话术（海报显示，无小标题）</label>
                                <textarea
                                    rows={3}
                                    value={effectiveSteamHooksTextZh}
                                    onChange={(e) => store.setSteamHooksText(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-xs text-slate-700 dark:text-slate-300 resize-none whitespace-pre-line"
                                />
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">亮点小标题（可编辑）</label>
                                <input
                                    value={effectiveSteamHighlightsTitleZh}
                                    onChange={(e) => store.setSteamHighlightsTitle(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-xs mb-2"
                                />
                                <div className="space-y-2">
                                    {normalizedSteamHighlights.map((h, i) => (
                                        <div key={i} className="flex gap-2 items-start">
                                            <span className="text-lg leading-none mt-1">{h.emoji}</span>
                                            <div className="flex-1 space-y-1">
                                                <input
                                                    value={h.label}
                                                    onChange={(e) => {
                                                        const next = [...normalizedSteamHighlights];
                                                        next[i] = { ...next[i], label: e.target.value };
                                                        store.setSteamHighlights(next);
                                                    }}
                                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs font-bold"
                                                />
                                                <textarea
                                                    rows={2}
                                                    value={h.desc}
                                                    onChange={(e) => {
                                                        const next = [...normalizedSteamHighlights];
                                                        next[i] = { ...next[i], desc: e.target.value };
                                                        store.setSteamHighlights(next);
                                                    }}
                                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-[11px] resize-none"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">底部地址 / 联系方式</label>
                                <input
                                    value={effectiveInfoLineZh}
                                    onChange={(e) => store.setSteamInfoLine(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-xs"
                                />
                            </div>

                            {(store.steamCopyStyles || []).length > 0 && (
                                <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">海报文案风格</label>
                                    <div className="space-y-2">
                                        {store.steamCopyStyles.map((style, idx) => (
                                            <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-2">
                                                <div className="flex items-center justify-between mb-1">
                                                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{style.styleName}</p>
                                                    <button
                                                        onClick={() => applyCopyStyle(style)}
                                                        className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-2 py-1 rounded"
                                                    >
                                                        应用
                                                    </button>
                                                </div>
                                                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{style.headline}</p>
                                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{style.subtitle}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-white/10 p-5 flex flex-col min-h-[320px]">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                            <MessageSquare size={18} className="text-indigo-500" />
                            {t('poster.socialCopy')}
                        </h3>
                        <div className="flex items-center gap-2">
                            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg mr-2">
                                <button
                                    onClick={() => store.setPosterLanguage('zh')}
                                    className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${store.posterLanguage === 'zh' ? 'bg-white dark:bg-slate-700 shadow text-slate-800 dark:text-slate-200' : 'text-slate-500'}`}
                                >
                                    中
                                </button>
                                <button
                                    onClick={() => store.setPosterLanguage('en')}
                                    className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${store.posterLanguage === 'en' ? 'bg-white dark:bg-slate-700 shadow text-slate-800 dark:text-slate-200' : 'text-slate-500'}`}
                                >
                                    EN
                                </button>
                            </div>
                            <button
                                onClick={handleGenerateCopy}
                                disabled={store.loadingPosterCopy || !store.basicInfo.theme}
                                className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition-colors disabled:opacity-50"
                            >
                                {store.loadingPosterCopy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                {store.posterCopy ? t('poster.regenerate') : t('poster.generate')}
                            </button>
                        </div>
                    </div>
                    <textarea
                        value={store.posterCopy}
                        onChange={(e) => store.setPosterCopy(e.target.value)}
                        placeholder={t('poster.copyPlaceholder')}
                        className="flex-1 w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-4 text-sm resize-none focus:ring-2 focus:ring-indigo-500 text-slate-700 dark:text-slate-300"
                    />
                </div>
            </div>
            <div className="lg:col-span-7 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-white/5 p-6 flex flex-col items-center justify-center min-h-[500px] relative">
                {store.posterBgImage && (
                    <div className="w-full max-w-sm mb-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-white/10 p-4 space-y-3">
                        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Type size={13} className="text-emerald-500" />
                            Poster Text
                        </h4>
                        <input
                            type="text"
                            value={effectivePosterTitleZh}
                            onChange={(e) => {
                                setPosterTitle(e.target.value);
                                sessionStorage.setItem('nc_posterTitle', e.target.value);
                            }}
                            placeholder="海报标题"
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-bold"
                        />
                        <input
                            type="text"
                            value={effectivePosterSubTextZh}
                            onChange={(e) => {
                                setPosterSubText(e.target.value);
                                sessionStorage.setItem('nc_posterSubText', e.target.value);
                            }}
                            placeholder="副标题"
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs"
                        />
                    </div>
                )}

                {!store.posterHydrated ? (
                    <div className="text-center">
                        <Loader2 size={32} className="animate-spin text-emerald-400 mx-auto mb-2" />
                        <p className="text-sm text-slate-400">Loading poster...</p>
                    </div>
                ) : !store.posterBgImage ? (
                    <div className="text-center max-w-sm">
                        <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-full shadow-md flex items-center justify-center mx-auto mb-4">
                            <ImageIcon size={32} className="text-emerald-400" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">{t('poster.visualPoster')}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{t('poster.visualDesc')}</p>
                        <button
                            onClick={() => handleGenerateImage()}
                            disabled={store.loadingPosterImage || !store.basicInfo.theme}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-6 rounded-xl shadow-[0_4px_14px_0_rgba(16,185,129,0.39)] transition-all flex items-center gap-2 mx-auto disabled:opacity-50"
                        >
                            {store.loadingPosterImage ? <Loader2 size={20} className="animate-spin" /> : <ImageIcon size={20} />}
                            {t('poster.generateImage')}
                        </button>
                    </div>
                ) : (
                    <div className="relative w-full flex flex-col items-center">
                        <div className="w-full max-w-sm relative group overflow-hidden rounded-2xl shadow-xl border border-slate-200/50 dark:border-white/10 ring-4 ring-white dark:ring-slate-900">
                            {store.loadingPosterImage && (
                                <div className="absolute inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center">
                                    <Loader2 size={40} className="text-white animate-spin" />
                                </div>
                            )}

                            {store.posterMode === 'steam' ? (
                                <SteamPosterTemplate
                                    ref={posterRef}
                                    platform={store.posterPlatform}
                                    bgImage={store.posterBgImage}
                                    title={effectivePosterTitleZh}
                                    subtitle={effectivePosterSubTextZh}
                                    highlights={normalizedSteamHighlights}
                                    goal={effectiveSteamGoalZh}
                                    englishLine={effectiveEnglishLineZh}
                                    hooks={store.steamHooks || []}
                                    timeText={effectiveTimeTextZh}
                                    dateText={effectiveDateTextZh}
                                    ageText={effectiveAgeTextZh}
                                    hooksText={effectiveSteamHooksTextZh}
                                    highlightsTitle={effectiveSteamHighlightsTitleZh}
                                    infoLine={effectiveInfoLineZh}
                                    palette={store.themePalette}
                                    overlayOpacity={0.14}
                                />
                            ) : (
                                <>
                                    {store.posterType === 'cover' && (
                                        <PosterTemplate
                                            ref={posterRef}
                                            platform={store.posterPlatform}
                                            bgImage={store.posterBgImage}
                                            themeText={effectivePosterTitleZh}
                                            subText={effectivePosterSubTextZh}
                                            palette={store.themePalette}
                                        />
                                    )}
                                    {store.posterType === 'intro' && (
                                        <ContentIntroTemplate
                                            ref={posterRef}
                                            platform={store.posterPlatform}
                                            bgImage={store.posterBgImage}
                                            themeText={effectivePosterTitleZh}
                                            learningGoals={store.basicInfo.learningGoals}
                                            subText={effectivePosterSubTextZh}
                                            palette={store.themePalette}
                                        />
                                    )}
                                    {store.posterType === 'showcase' && (
                                        <InnerPagesTemplate
                                            ref={posterRef}
                                            platform={store.posterPlatform}
                                            bgImage={store.posterBgImage}
                                            themeText={effectivePosterTitleZh}
                                            images={currentPageImages}
                                            subText={effectivePosterSubTextZh}
                                            palette={store.themePalette}
                                        />
                                    )}
                                    {store.posterType === 'allpages' && (
                                        <AllPagesTemplate
                                            ref={posterRef}
                                            platform={store.posterPlatform}
                                            bgImage={store.posterBgImage}
                                            themeText={effectivePosterTitleZh}
                                            images={store.gridImages}
                                            subText={effectivePosterSubTextZh}
                                            palette={store.themePalette}
                                        />
                                    )}
                                </>
                            )}

                            <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent flex items-end justify-center pb-6 z-40">
                                <button
                                    onClick={handleDownload}
                                    className="bg-white text-emerald-600 hover:bg-emerald-50 font-bold py-2.5 px-5 rounded-full shadow-lg flex items-center gap-2 transition-transform hover:scale-105"
                                >
                                    <Download size={18} />
                                    {t('poster.download')}
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-col items-center mt-6 gap-3 w-full max-w-md">
                            {store.posterMode !== 'steam' && store.posterType === 'showcase' && (
                                <div className="flex items-center gap-3 bg-white dark:bg-slate-900 px-4 py-3 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 w-full mb-2">
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                            Page {showcasePageIndex + 1} / {showcasePages}
                                        </p>
                                        <p className="text-xs text-slate-500">2 images per page</p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => setShowcasePageIndex((v) => Math.max(0, v - 1))}
                                            disabled={showcasePageIndex === 0}
                                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
                                            title="Previous page"
                                        >
                                            <ChevronLeft size={16} />
                                        </button>
                                        <span className="text-sm font-medium text-slate-600 dark:text-slate-400 min-w-[3ch] text-center">
                                            {showcasePageIndex + 1}
                                        </span>
                                        <button
                                            onClick={() => setShowcasePageIndex((v) => Math.min(showcasePages - 1, v + 1))}
                                            disabled={showcasePageIndex >= showcasePages - 1 && currentPageImages.length === 0}
                                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
                                            title="Next page"
                                        >
                                            <ChevronRight size={16} />
                                        </button>
                                        <button
                                            onClick={handleAddShowcasePage}
                                            className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors ml-1"
                                            title="Add page"
                                        >
                                            <Plus size={16} />
                                        </button>
                                        {currentPageImages.length > 0 && (
                                            <button
                                                onClick={handleDeleteShowcasePage}
                                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-1"
                                                title="Delete this page"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {store.posterMode !== 'steam' && (store.posterType === 'showcase' || store.posterType === 'allpages') && (
                                <div className="flex items-center gap-3 bg-white dark:bg-slate-900 px-4 py-3 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 w-full mb-2">
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{t('poster.uploadInner' as any) || 'Upload Pages'}</p>
                                        <p className="text-xs text-slate-500">
                                            {store.posterType === 'allpages'
                                                ? (t('poster.uploadGridDesc' as any) || 'Upload one grid screenshot')
                                                : `Current page: ${currentPageImages.length}/2`}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {store.posterType === 'showcase' && currentPageImages.length > 0 && (
                                            <button
                                                onClick={handleDeleteShowcasePage}
                                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Clear page images"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                        {store.posterType === 'allpages' && store.gridImages.length > 0 && (
                                            <button
                                                onClick={() => store.setGridImages([])}
                                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                title={t('poster.clearImages' as any) || 'Clear images'}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                        <label
                                            className={`cursor-pointer px-3 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors ${(store.posterType === 'allpages' ? !canUploadAllPages : !canUploadShowcase)
                                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                    : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                                }`}
                                        >
                                            <ImagePlus size={16} />
                                            Upload
                                            <input
                                                type="file"
                                                className="hidden"
                                                multiple={store.posterType === 'showcase'}
                                                accept="image/*"
                                                onChange={handleImageUpload}
                                                disabled={store.posterType === 'allpages' ? !canUploadAllPages : !canUploadShowcase}
                                            />
                                        </label>
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={() => handleGenerateImage('')}
                                disabled={store.loadingPosterImage}
                                className="text-sm text-slate-500 hover:text-emerald-600 flex items-center gap-1 font-medium transition-colors"
                            >
                                <RefreshCw size={14} /> Regenerate Background
                            </button>

                            <div className="w-full mt-2 space-y-2">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => refInputRef.current?.click()}
                                        className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors border border-amber-200"
                                        title="Upload a reference image"
                                    >
                                        <Camera size={14} />
                                        {refImage ? 'Replace Ref' : 'Upload Ref'}
                                    </button>
                                    <input
                                        ref={refInputRef}
                                        type="file"
                                        className="hidden"
                                        accept="image/*"
                                        title="Upload reference image"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            const reader = new FileReader();
                                            reader.onload = () => setRefImage(reader.result as string);
                                            reader.readAsDataURL(file);
                                            e.target.value = '';
                                        }}
                                    />
                                    {refImage && (
                                        <div className="flex items-center gap-1.5 bg-amber-50 rounded-lg px-2 py-1 border border-amber-200">
                                            <img src={refImage} alt="ref" className="w-8 h-8 rounded object-cover" />
                                            <span className="text-xs text-amber-700 font-medium">Ref uploaded</span>
                                            <button
                                                onClick={() => setRefImage(null)}
                                                className="p-0.5 text-amber-500 hover:text-red-500 transition-colors"
                                                title="Remove reference image"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 shadow-sm">
                                    <input
                                        type="text"
                                        value={posterComment}
                                        onChange={(e) => setPosterComment(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && (posterComment.trim() || refImage)) {
                                                handleGenerateImage();
                                            }
                                        }}
                                        placeholder={refImage ? 'Optional style notes (press Enter)' : 'Custom scene prompt (optional)'}
                                        className="flex-1 bg-transparent border-none text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none"
                                    />
                                    <button
                                        onClick={() => handleGenerateImage()}
                                        disabled={store.loadingPosterImage || (!posterComment.trim() && !refImage)}
                                        className="p-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                                        title="Regenerate with instructions"
                                    >
                                        <Send size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
