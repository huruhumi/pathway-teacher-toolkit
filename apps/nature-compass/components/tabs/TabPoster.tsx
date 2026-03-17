import React, { useEffect, useRef, useState } from 'react';
import { Camera, Image as ImageIcon, MessageSquare, Download, Loader2, RefreshCw, LayoutTemplate, ImagePlus, Trash2, Send, ChevronLeft, ChevronRight, Plus, Type } from 'lucide-react';
import { useLessonStore } from '../../stores/useLessonStore';
import { generateSocialMediaCopy, generateThemePalette } from '../../services/gemini/poster';
import { generatePosterBgPrompt, generateImage, generateImageWithRef } from '../../services/imageService';
import { PosterTemplate } from './PosterTemplate';
import { ContentIntroTemplate } from './ContentIntroTemplate';
import { InnerPagesTemplate } from './InnerPagesTemplate';
import { AllPagesTemplate } from './AllPagesTemplate';
import * as htmlToImage from 'html-to-image';
import { sanitizeFilename } from '../../utils/fileHelpers';
import { useLanguage } from '../../i18n/LanguageContext';
import { useSessionStore } from '../../stores/appStore';

export const TabPoster: React.FC = () => {
    const { t } = useLanguage();
    const store = useLessonStore();
    const structuredKnowledge = useSessionStore((s) => s.lessonPlan?.structuredKnowledge);
    const factSheet = useSessionStore((s) => s.lessonPlan?.factSheet);
    const posterRef = useRef<HTMLDivElement>(null);
    const [posterComment, setPosterComment] = useState('');
    const [refImage, setRefImage] = useState<string | null>(null);
    const [posterTitle, setPosterTitle] = useState(() => sessionStorage.getItem('nc_posterTitle') || '');
    const [posterSubText, setPosterSubText] = useState(() => sessionStorage.getItem('nc_posterSubText') || 'Nature Compass 自然指针 · 专属研学手册');
    const refInputRef = useRef<HTMLInputElement>(null);
    const [showcasePageIndex, setShowcasePageIndex] = useState(0);

    // Pagination: each showcase page shows 2 images
    const IMAGES_PER_PAGE = 2;
    const showcasePages = Math.max(1, Math.ceil(store.showcaseImages.length / IMAGES_PER_PAGE));
    const currentPageImages = store.showcaseImages.slice(
        showcasePageIndex * IMAGES_PER_PAGE,
        showcasePageIndex * IMAGES_PER_PAGE + IMAGES_PER_PAGE
    );

    // Auto-generate theme palette on first visit if theme exists and no palette yet
    useEffect(() => {
        if (store.basicInfo.theme && !store.themePalette) {
            generateThemePalette(store.basicInfo.theme, store.basicInfo.location)
                .then(p => store.setThemePalette(p))
                .catch(console.error);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleGenerateCopy = async () => {
        if (!store.basicInfo.theme) return;
        store.setLoadingPosterCopy(true);
        try {
            const copy = await generateSocialMediaCopy(
                store.posterPlatform,
                store.basicInfo.theme,
                store.basicInfo.learningGoals,
                store.posterLanguage
            );
            store.setPosterCopy(copy);
        } catch (e) {
            console.error(e);
        } finally {
            store.setLoadingPosterCopy(false);
        }
    };

    const handleGenerateImage = async (commentOverride?: string) => {
        if (!store.basicInfo.theme) return;
        store.setLoadingPosterImage(true);
        try {
            const comment = (commentOverride ?? posterComment).trim();
            const aspect = store.posterPlatform === 'xhs' ? '3:4' : '1:1';
            const stylePrompt = store.artStyles[0] || "Minimalist, flat vector illustration, elegant colors";

            // Build brand color instruction for image generation
            const p = store.themePalette;
            const paletteInstruction = [
                `COLOR PALETTE (must be visible in the illustration):`,
                `Brand colors to incorporate: Navy #1A2B58, Fuchsia #E91E63, Golden #FFC107, Sky Blue #87CEEB, Emerald #059669.`,
                p ? `Theme tones: primary ${p.primary}, secondary ${p.secondary}, accent ${p.accent}.` : '',
                `Distribute these colors naturally — as sky tints, architectural accents, foliage highlights, decorative elements, atmospheric lighting, or shadow tones. Every color should appear somewhere in the illustration.`,
            ].filter(Boolean).join(' ');

            if (refImage) {
                // ─── PATH A: Reference image → short style-transfer prompt ───
                const refPrompt = [
                    `Transform this reference photo into a ${stylePrompt} illustration for a poster background.`,
                    `Keep the buildings, landscape, and architectural details EXACTLY as shown in the photo.`,
                    paletteInstruction,
                    `The bottom 40% must smoothly fade into deep dark tones (near-black) for text overlay.`,
                    `Do NOT add any text or typography. Full-bleed, borderless.`,
                    comment ? `Style note: ${comment}` : '',
                ].filter(Boolean).join(' ');

                store.setPosterPrompt(refPrompt);
                const imageUrl = await generateImageWithRef(refPrompt, refImage, aspect);
                store.setPosterBgImage(imageUrl);
            } else {
                // ─── PATH B: No reference → text prompt with knowledge base ───
                let archRef: string | undefined;

                if (structuredKnowledge?.length) {
                    let relevant = structuredKnowledge;
                    if (comment) {
                        const keywords = comment.toLowerCase().split(/[\s,，。、]+/).filter(w => w.length > 1);
                        const scored = structuredKnowledge.map(k => ({
                            ...k,
                            score: keywords.reduce((s, kw) =>
                                s + (k.topic.toLowerCase().includes(kw) ? 3 : 0)
                                + (k.content.toLowerCase().includes(kw) ? 1 : 0), 0)
                        }));
                        const matched = scored.filter(k => k.score > 0).sort((a, b) => b.score - a.score);
                        if (matched.length > 0) {
                            relevant = matched.slice(0, 3);
                        }
                    }

                    if (relevant === structuredKnowledge) {
                        const n = relevant.length;
                        const indices = n <= 3
                            ? relevant.map((_, i) => i)
                            : [0, Math.floor(n / 2), n - 1];
                        relevant = indices.map(i => relevant[i]);
                    }

                    archRef = relevant
                        .map(k => `• ${k.topic}: ${k.content.slice(0, 500)}`)
                        .join('\n')
                        .slice(0, 2500);
                } else if (factSheet) {
                    archRef = factSheet.slice(0, 2500);
                }

                const locationStr = store.basicInfo.location || 'Nature';
                let prompt = await generatePosterBgPrompt(store.basicInfo.theme, stylePrompt, locationStr, archRef);
                prompt += `\n\n${paletteInstruction}`;

                if (comment) {
                    prompt += `\n\nAdditional user requirements: ${comment}`;
                }
                store.setPosterPrompt(prompt);

                const imageUrl = await generateImage(prompt, aspect);
                store.setPosterBgImage(imageUrl);
            }
        } catch (e) {
            console.error(e);
        } finally {
            store.setLoadingPosterImage(false);
        }
    };

    const handleDownload = async () => {
        if (!posterRef.current || !store.posterBgImage) return;
        try {
            const dataUrl = await htmlToImage.toPng(posterRef.current, { quality: 1, pixelRatio: 3 });
            const link = document.createElement('a');
            const suffix = store.posterType === 'intro' ? '-Intro' : store.posterType === 'showcase' ? '-InnerPages' : store.posterType === 'allpages' ? '-AllPages' : '-Cover';
            link.download = `${sanitizeFilename(store.basicInfo.theme)}${suffix}.png`;
            link.href = dataUrl;
            link.click();
        } catch (err) {
            console.error('Failed to download image', err);
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []) as File[];
        if (!files.length) return;
        const isGrid = store.posterType === 'allpages';

        if (isGrid) {
            // Grid: max 1 image total
            const reader = new FileReader();
            reader.onload = (event) => {
                if (event.target?.result) store.setGridImages([event.target.result as string]);
            };
            reader.readAsDataURL(files[0]);
        } else {
            // Showcase: insert images into the current page's slots (max 2 per page)
            const pageStart = showcasePageIndex * IMAGES_PER_PAGE;
            const pageImages = store.showcaseImages.slice(pageStart, pageStart + IMAGES_PER_PAGE);
            const slotsLeft = IMAGES_PER_PAGE - pageImages.length;
            const filesToProcess = files.slice(0, slotsLeft);

            filesToProcess.forEach(file => {
                const reader = new FileReader();
                reader.onload = (event) => {
                    if (event.target?.result) {
                        store.setShowcaseImages((prev: string[]) => {
                            // Insert at the right position for this page
                            const insertAt = Math.min(pageStart + IMAGES_PER_PAGE, prev.length);
                            const next = [...prev];
                            next.splice(insertAt, 0, event.target!.result as string);
                            return next;
                        });
                    }
                };
                reader.readAsDataURL(file);
            });
        }
    };

    const handleAddShowcasePage = () => {
        // Just navigate to a new empty page — images will be uploaded there
        setShowcasePageIndex(showcasePages);
    };

    const handleDeleteShowcasePage = () => {
        const pageStart = showcasePageIndex * IMAGES_PER_PAGE;
        store.setShowcaseImages((prev: string[]) => {
            const next = [...prev];
            next.splice(pageStart, IMAGES_PER_PAGE);
            return next;
        });
        if (showcasePageIndex > 0) setShowcasePageIndex(showcasePageIndex - 1);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in p-2">

            {/* Left Column: Controls and Copy */}
            <div className="lg:col-span-5 space-y-6">

                {/* Platform Toggle */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-white/10 p-5">
                    <h3 className="font-bold mb-4 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                        <Camera size={18} className="text-emerald-500" />
                        {t('poster.platformStrategy')}
                    </h3>
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                        <button
                            onClick={() => store.setPosterPlatform('wechat')}
                            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${store.posterPlatform === 'wechat' ? 'bg-white dark:bg-slate-700 shadow text-emerald-600 dark:text-emerald-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            {t('poster.wechat')}
                        </button>
                        <button
                            onClick={() => store.setPosterPlatform('xhs')}
                            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${store.posterPlatform === 'xhs' ? 'bg-white dark:bg-slate-700 shadow text-red-500' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            {t('poster.xhs')}
                        </button>
                    </div>
                </div>

                {/* Poster Type Toggle */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-white/10 p-5 mt-6">
                    <h3 className="font-bold mb-4 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                        <LayoutTemplate size={18} className="text-emerald-500" />
                        {t('poster.typeTitle' as any) || 'Poster Type'}
                    </h3>
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                        <button
                            onClick={() => store.setPosterType('cover')}
                            className={`flex-1 py-2 px-1 text-[11px] font-medium rounded-lg transition-all whitespace-nowrap ${store.posterType === 'cover' ? 'bg-white dark:bg-slate-700 shadow text-emerald-600 dark:text-emerald-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            {t('poster.typeCover' as any) || 'Cover Poster'}
                        </button>
                        <button
                            onClick={() => store.setPosterType('intro')}
                            className={`flex-1 py-2 px-1 text-[11px] font-medium rounded-lg transition-all whitespace-nowrap ${store.posterType === 'intro' ? 'bg-white dark:bg-slate-700 shadow text-emerald-600 dark:text-emerald-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            {t('poster.typeIntro' as any) || 'Content Intro'}
                        </button>
                        <button
                            onClick={() => store.setPosterType('showcase')}
                            className={`flex-1 py-2 px-1 text-[11px] font-medium rounded-lg transition-all whitespace-nowrap ${store.posterType === 'showcase' ? 'bg-white dark:bg-slate-700 shadow text-emerald-600 dark:text-emerald-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            {t('poster.typeShowcase' as any) || 'Inner Pages'}
                        </button>
                        <button
                            onClick={() => store.setPosterType('allpages' as any)}
                            className={`flex-1 py-2 px-1 text-[11px] font-medium rounded-lg transition-all whitespace-nowrap ${store.posterType === 'allpages' ? 'bg-white dark:bg-slate-700 shadow text-emerald-600 dark:text-emerald-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            {t('poster.typeAllPages' as any) || 'All Pages Grid'}
                        </button>
                    </div>
                </div>

                {/* Social Copy Generator */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-white/10 p-5 flex flex-col min-h-[350px]">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                            <MessageSquare size={18} className="text-indigo-500" />
                            {t('poster.socialCopy')}
                        </h3>
                        <div className="flex items-center gap-2">
                            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg mr-2">
                                <button
                                    onClick={() => store.setPosterLanguage('zh')}
                                    className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${store.posterLanguage === 'zh' ? 'bg-white dark:bg-slate-700 shadow text-slate-800 dark:text-slate-200' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                >
                                    中
                                </button>
                                <button
                                    onClick={() => store.setPosterLanguage('en')}
                                    className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${store.posterLanguage === 'en' ? 'bg-white dark:bg-slate-700 shadow text-slate-800 dark:text-slate-200' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
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

            {/* Right Column: Visual Poster */}
            <div className="lg:col-span-7 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-white/5 p-6 flex flex-col items-center justify-center min-h-[500px] relative">

                {/* Poster text editing */}
                {store.posterBgImage && (
                    <div className="w-full max-w-sm mb-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-white/10 p-4 space-y-3">
                        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Type size={13} className="text-emerald-500" />
                            海报文字
                        </h4>
                        <input
                            type="text"
                            value={posterTitle || store.basicInfo.theme}
                            onChange={(e) => { setPosterTitle(e.target.value); sessionStorage.setItem('nc_posterTitle', e.target.value); }}
                            placeholder="主标题"
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        />
                        <input
                            type="text"
                            value={posterSubText}
                            onChange={(e) => { setPosterSubText(e.target.value); sessionStorage.setItem('nc_posterSubText', e.target.value); }}
                            placeholder="副标题"
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-600 dark:text-slate-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                            {t('poster.visualDesc')}
                        </p>
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

                            {store.posterType === 'cover' && (
                                <PosterTemplate
                                    ref={posterRef}
                                    platform={store.posterPlatform}
                                    bgImage={store.posterBgImage}
                                    themeText={posterTitle || store.basicInfo.theme}
                                    subText={posterSubText}
                                    palette={store.themePalette}
                                />
                            )}
                            {store.posterType === 'intro' && (
                                <ContentIntroTemplate
                                    ref={posterRef}
                                    platform={store.posterPlatform}
                                    bgImage={store.posterBgImage}
                                    themeText={posterTitle || store.basicInfo.theme}
                                    learningGoals={store.basicInfo.learningGoals}
                                    subText={posterSubText}
                                    palette={store.themePalette}
                                />
                            )}
                            {store.posterType === 'showcase' && (
                                <InnerPagesTemplate
                                    ref={posterRef}
                                    platform={store.posterPlatform}
                                    bgImage={store.posterBgImage}
                                    themeText={posterTitle || store.basicInfo.theme}
                                    images={currentPageImages}
                                    subText={posterSubText}
                                    palette={store.themePalette}
                                />
                            )}
                            {store.posterType === 'allpages' && (
                                <AllPagesTemplate
                                    ref={posterRef}
                                    platform={store.posterPlatform}
                                    bgImage={store.posterBgImage}
                                    themeText={posterTitle || store.basicInfo.theme}
                                    images={store.gridImages}
                                    subText={posterSubText}
                                    palette={store.themePalette}
                                />
                            )}

                            {/* Overlay Controls */}
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

                            {/* Showcase page navigation */}
                            {store.posterType === 'showcase' && (
                                <div className="flex items-center gap-3 bg-white dark:bg-slate-900 px-4 py-3 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 w-full mb-2">
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                            内页展示 · 第 {showcasePageIndex + 1} 页 / 共 {showcasePages} 页
                                        </p>
                                        <p className="text-xs text-slate-500">每页展示 2 张截图，可添加多页</p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => setShowcasePageIndex(Math.max(0, showcasePageIndex - 1))}
                                            disabled={showcasePageIndex === 0}
                                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
                                            title="上一页"
                                        >
                                            <ChevronLeft size={16} />
                                        </button>
                                        <span className="text-sm font-medium text-slate-600 dark:text-slate-400 min-w-[3ch] text-center">
                                            {showcasePageIndex + 1}
                                        </span>
                                        <button
                                            onClick={() => setShowcasePageIndex(Math.min(showcasePages - 1, showcasePageIndex + 1))}
                                            disabled={showcasePageIndex >= showcasePages - 1 && currentPageImages.length === 0}
                                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
                                            title="下一页"
                                        >
                                            <ChevronRight size={16} />
                                        </button>
                                        <button
                                            onClick={handleAddShowcasePage}
                                            className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors ml-1"
                                            title="添加新页"
                                        >
                                            <Plus size={16} />
                                        </button>
                                        {currentPageImages.length > 0 && (
                                            <button
                                                onClick={handleDeleteShowcasePage}
                                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-1"
                                                title="删除当前页"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Image upload for current showcase page or allpages grid */}
                            {(store.posterType === 'showcase' || store.posterType === 'allpages') && (
                                <div className="flex items-center gap-3 bg-white dark:bg-slate-900 px-4 py-3 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 w-full mb-2">
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{t('poster.uploadInner' as any) || 'Upload Pages'}</p>
                                        <p className="text-xs text-slate-500">{store.posterType === 'allpages' ? (t('poster.uploadGridDesc' as any) || 'Upload 1 grid screenshot') : `当前页已有 ${currentPageImages.length}/2 张`}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {store.posterType === 'showcase' && currentPageImages.length > 0 && (
                                            <button
                                                onClick={handleDeleteShowcasePage}
                                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                title="清除当前页图片"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                        {store.posterType === 'allpages' && store.gridImages.length > 0 && (
                                            <button
                                                onClick={() => store.setGridImages([])}
                                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                title={t('poster.clearImages' as any) || "Clear images"}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                        <label className={`cursor-pointer px-3 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors ${(store.posterType === 'allpages' ? store.gridImages.length >= 1 : currentPageImages.length >= IMAGES_PER_PAGE) ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}>
                                            <ImagePlus size={16} />
                                            Upload
                                            <input
                                                type="file"
                                                className="hidden"
                                                multiple={store.posterType === 'showcase'}
                                                accept="image/*"
                                                onChange={handleImageUpload}
                                                disabled={store.posterType === 'allpages' ? store.gridImages.length >= 1 : currentPageImages.length >= IMAGES_PER_PAGE}
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
                                <RefreshCw size={14} /> {t('poster.regenerateBg')}
                            </button>

                            {/* Reference image + Comment-driven regeneration */}
                            <div className="w-full mt-2 space-y-2">
                                {/* Reference image upload */}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => refInputRef.current?.click()}
                                        className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors border border-amber-200"
                                        title="Upload a reference photo of the actual building/scenery"
                                    >
                                        <Camera size={14} />
                                        {refImage ? '更换参考图' : '上传参考图'}
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
                                            <span className="text-xs text-amber-700 font-medium">参考图已上传</span>
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

                                {/* Comment input */}
                                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 shadow-sm">
                                    <input
                                        type="text"
                                        value={posterComment}
                                        onChange={(e) => setPosterComment(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter' && (posterComment.trim() || refImage)) handleGenerateImage(); }}
                                        placeholder={refImage ? '描述风格偏好（可选，回车生成）...' : (t('poster.commentPlaceholder' as any) || 'Describe changes for the background...')}
                                        className="flex-1 bg-transparent border-none text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none"
                                    />
                                    <button
                                        onClick={() => handleGenerateImage()}
                                        disabled={store.loadingPosterImage || (!posterComment.trim() && !refImage)}
                                        className="p-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                                        title={t('poster.regenerateWithComment' as any) || 'Regenerate with instructions'}
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
