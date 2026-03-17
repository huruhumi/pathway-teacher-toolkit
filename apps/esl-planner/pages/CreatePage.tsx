import React, { useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { ReviewPanel } from '../components/ReviewPanel';
import { InputSection } from '../components/InputSection';
import { OutputDisplay } from '../components/OutputDisplay';
import { ErrorModal } from '../components/ErrorModal';
import { generateLessonPlan } from '../services/lessonKitService';
import { useLanguage } from '../i18n/LanguageContext';
import type { CEFRLevel, GeneratedContent } from '../types';
import {
    findAssessmentPackById,
    findTextbookLevelEntry,
    buildAssessmentPackPrompt,
} from '@shared/config/eslAssessmentRegistry';
import type { GroundingStatus } from '@shared/types/quality';
import { useNotebookLMRAG } from '@pathway/notebooklm';
import { useFallbackConfirm } from '@shared/hooks/useFallbackConfirm';
import { isCustomTextbookLevelKey } from '../utils/customTextbookLevels';
import { useAppStore, useSessionStore } from '../stores/appStore';
import { useLessonHistory } from '../hooks/useLessonHistory';

export interface CreatePageProps { }

type GenerationSourceMode = 'notebook' | 'direct';

type LessonKitGenerationProgress = {
    stage: number;
    percent: number;
    statusText: string;
    stages: string[];
};

type GroundingSourceItem = { id?: string; title?: string; url?: string; status?: string; type?: string };

type VideoGroundingSummary = {
    status: 'processing' | 'grounded' | 'unavailable' | 'review';
    message: string;
    urlCount: number;
    evidenceUrlCount?: number;
};

type PendingGenerationRequest = {
    text: string;
    files: File[];
    level: CEFRLevel;
    topic: string;
    slideCount: number;
    duration: string;
    studentCount: string;
    lessonTitle: string;
    textbookLevelKey: string;
    sourceMode: GenerationSourceMode;
    ageGroup?: string;
};

type VideoTranscriptRequest = {
    urls: string[];
    reason: string;
};

type VideoFallbackEvidenceReview = {
    inputUrls: string[];
    reason: string;
    factSheet: string;
    evidenceUrls: string[];
    sources: GroundingSourceItem[];
};

const URL_REGEX = /https?:\/\/[^\s)]+/gi;
const YOUTUBE_URL_REGEX = /(?:youtube\.com\/watch\?v=|youtu\.be\/)/i;
const TRAILING_URL_PUNCTUATION_REGEX = /[)\],.;!?，。；！？、]+$/g;
const URL_SEPARATOR_REGEX = /[\s，。；！？、]/;

const cleanExtractedUrl = (raw: string): string => {
    const trimmed = raw.trim();
    const cutAtSeparator = trimmed.split(URL_SEPARATOR_REGEX)[0] || '';
    return cutAtSeparator.replace(TRAILING_URL_PUNCTUATION_REGEX, '');
};

const isValidYouTubeUrl = (raw: string): boolean => {
    try {
        const parsed = new URL(raw);
        const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
        return host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com');
    } catch {
        return false;
    }
};

const extractYouTubeUrls = (text: string): string[] => {
    const matches = text.match(URL_REGEX) || [];
    const deduped = new Set<string>();
    for (const raw of matches) {
        const cleaned = cleanExtractedUrl(raw);
        if (!cleaned) continue;
        if (YOUTUBE_URL_REGEX.test(cleaned) && isValidYouTubeUrl(cleaned)) {
            deduped.add(cleaned);
        }
    }
    return [...deduped];
};

const mergeUnique = (base: string[] = [], incoming: string[] = []): string[] => {
    return [...new Set([...(base || []), ...(incoming || [])])];
};

const extractYouTubeVideoId = (rawUrl: string): string | null => {
    try {
        const url = new URL(rawUrl);
        const host = url.hostname.replace(/^www\./, '').toLowerCase();
        if (host === 'youtu.be') {
            return url.pathname.replace('/', '').trim() || null;
        }
        if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
            const id = url.searchParams.get('v');
            return id?.trim() || null;
        }
    } catch {
        return null;
    }
    return null;
};

const normalizeUrlForCompare = (rawUrl: string): string => {
    try {
        const parsed = new URL(rawUrl);
        parsed.hash = '';
        const normalizedHost = parsed.hostname.toLowerCase();
        const normalizedPath = parsed.pathname.replace(/\/+$/, '');
        return `${normalizedHost}${normalizedPath}${parsed.search}`;
    } catch {
        return rawUrl.trim().toLowerCase();
    }
};

const isUrlFromInputVideos = (candidateUrl: string, inputUrls: string[]): boolean => {
    const inputIdSet = new Set(inputUrls.map(extractYouTubeVideoId).filter(Boolean) as string[]);
    const candidateId = extractYouTubeVideoId(candidateUrl);
    if (candidateId && inputIdSet.has(candidateId)) return true;

    const inputNormalized = new Set(inputUrls.map(normalizeUrlForCompare));
    return inputNormalized.has(normalizeUrlForCompare(candidateUrl));
};

const mergeGroundingSources = (
    base: GroundingSourceItem[] = [],
    incoming: GroundingSourceItem[] = [],
) => {
    const map = new Map<string, GroundingSourceItem>();
    for (const item of [...base, ...incoming]) {
        const key = item.url || item.id || `${item.title || ''}-${item.type || ''}`;
        if (!key) continue;
        map.set(key, item);
    }
    return [...map.values()];
};

export const CreatePage: React.FC<CreatePageProps> = () => {
    const { state, setState } = useSessionStore();
    const { activeLessonId, setActiveLessonId, prefilledValues, setPrefilledValues } = useAppStore();
    const history = useLessonHistory();
    const onSaveLesson = history.handleSaveLesson;

    const { t, lang } = useLanguage();
    const { startRAG, checkBackends, ensureResourceGuide } = useNotebookLMRAG();
    const { pendingFallback, askFallbackConfirm, handleFallbackChoice, resetFallback } = useFallbackConfirm();
    const abortControllerRef = useRef<AbortController | null>(null);

    const getProgressStages = (mode: GenerationSourceMode): string[] => {
        if (mode === 'direct') {
            return lang === 'zh'
                ? ['校验参数', '分析上传/输入资料', '生成课件', '整理结果']
                : ['Validate input', 'Analyze provided materials', 'Generate lesson kit', 'Finalize output'];
        }
        return lang === 'zh'
            ? ['校验参数', '连接 NotebookLM', '分析笔记资料', '生成课件', '整理结果']
            : ['Validate input', 'Connect NotebookLM', 'Analyze notebook sources', 'Generate lesson kit', 'Finalize output'];
    };

    const [generationProgress, setGenerationProgress] = useState<LessonKitGenerationProgress>({
        stage: 0,
        percent: 0,
        statusText: lang === 'zh' ? '准备开始...' : 'Preparing...',
        stages: getProgressStages('notebook'),
    });

    const [videoGroundingSummary, setVideoGroundingSummary] = useState<VideoGroundingSummary | null>(null);
    const [videoTranscriptRequest, setVideoTranscriptRequest] = useState<VideoTranscriptRequest | null>(null);
    const [videoFallbackEvidenceReview, setVideoFallbackEvidenceReview] = useState<VideoFallbackEvidenceReview | null>(null);
    const [manualVideoEvidence, setManualVideoEvidence] = useState('');
    const [pendingGenerationRequest, setPendingGenerationRequest] = useState<PendingGenerationRequest | null>(null);

    const updateProgress = (
        stage: number,
        percent: number,
        statusText?: string,
        stagesOverride?: string[],
    ) => {
        const activeStages = stagesOverride || generationProgress.stages;
        const fallback = activeStages[Math.max(0, Math.min(stage, activeStages.length - 1))] || '';
        setGenerationProgress({
            stage,
            percent,
            statusText: statusText || fallback,
            stages: activeStages,
        });
    };

    const handleStopGeneration = () => {
        resetFallback();
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setState(prev => ({ ...prev, isLoading: false, error: 'Generation cancelled by user.' }));
        updateProgress(0, 0, lang === 'zh' ? '已取消生成。' : 'Generation cancelled.');
    };

    const handleGenerate = async (
        text: string,
        files: File[],
        level: CEFRLevel,
        topic: string,
        slideCount: number,
        duration: string,
        studentCount: string,
        lessonTitle: string,
        textbookLevelKey: string,
        sourceMode: GenerationSourceMode,
        ageGroup?: string,
        manualEvidenceInput?: string,
        manualEvidenceUrls?: string[],
        manualEvidenceSources?: GroundingSourceItem[],
        manualEvidenceKind: 'manual' | 'fallback_web' = 'manual',
    ) => {
        const stages = getProgressStages(sourceMode);
        setPendingGenerationRequest({
            text,
            files,
            level,
            topic,
            slideCount,
            duration,
            studentCount,
            lessonTitle,
            textbookLevelKey,
            sourceMode,
            ageGroup,
        });
        setVideoTranscriptRequest(null);
        setVideoFallbackEvidenceReview(null);
        if (!manualEvidenceInput?.trim()) {
            setVideoGroundingSummary(null);
            setManualVideoEvidence('');
        }
        setState(prev => ({ ...prev, isLoading: true, error: null, generatedContent: null }));
        updateProgress(
            0,
            10,
            lang === 'zh' ? '正在校验参数并准备任务...' : 'Validating inputs and preparing task...',
            stages,
        );
        setActiveLessonId(null);
        abortControllerRef.current = new AbortController();

        try {
            const normalizedLevelKey = textbookLevelKey?.trim() || '';
            if (!normalizedLevelKey) {
                throw new Error('Please select Level before generating.');
            }

            const levelEntry = normalizedLevelKey && !isCustomTextbookLevelKey(normalizedLevelKey)
                ? findTextbookLevelEntry(normalizedLevelKey)
                : undefined;
            if (normalizedLevelKey && !isCustomTextbookLevelKey(normalizedLevelKey) && !levelEntry) {
                throw new Error(`Unknown textbook-level standard "${normalizedLevelKey}". Please re-select and try again.`);
            }

            const qualityIssues: string[] = [];
            const assessmentPack = levelEntry ? findAssessmentPackById(levelEntry.assessmentPackId) : undefined;
            if (levelEntry && !assessmentPack) {
                qualityIssues.push(`Assessment pack "${levelEntry.assessmentPackId}" is missing. Generated content requires manual review.`);
            }
            if (!levelEntry) {
                qualityIssues.push('Other textbook level selected. Generated content requires teacher review.');
            }

            let factSheet: string | undefined;
            let validUrls: string[] | undefined;
            let groundingSources: GroundingSourceItem[] | undefined;
            let knowledgeNotebookId: string | undefined = sourceMode === 'notebook' ? (levelEntry?.notebookId || undefined) : undefined;
            let groundingStatus: GroundingStatus = 'unverified';
            const videoUrls = extractYouTubeUrls(text || '');
            let videoFactSheet: string | undefined;
            const normalizedManualEvidence = manualEvidenceInput?.trim();

            if (videoUrls.length > 0) {
                const requireManualVideoEvidence = (reason: string) => {
                    setVideoTranscriptRequest({ urls: videoUrls, reason });
                    setVideoFallbackEvidenceReview(null);
                    setVideoGroundingSummary({
                        status: 'unavailable',
                        message: lang === 'zh'
                            ? '无法自动提取字幕证据，请粘贴字幕或关键要点后继续生成。'
                            : 'Transcript evidence could not be extracted. Paste transcript/key points to continue.',
                        urlCount: videoUrls.length,
                    });
                    setState(prev => ({ ...prev, isLoading: false, generatedContent: null, error: null }));
                    updateProgress(
                        0,
                        0,
                        lang === 'zh' ? '等待手动字幕/要点输入…' : 'Waiting for manual transcript/key points...',
                        stages,
                    );
                };

                const requestFallbackEvidenceReview = (
                    reason: string,
                    fallbackFactSheet: string,
                    fallbackEvidenceUrls: string[],
                    fallbackSources: GroundingSourceItem[],
                ) => {
                    setVideoTranscriptRequest(null);
                    setManualVideoEvidence(fallbackFactSheet);
                    setVideoFallbackEvidenceReview({
                        inputUrls: videoUrls,
                        reason,
                        factSheet: fallbackFactSheet,
                        evidenceUrls: fallbackEvidenceUrls,
                        sources: fallbackSources,
                    });
                    setVideoGroundingSummary({
                        status: 'review',
                        message: lang === 'zh'
                            ? '已找到回退证据，请先确认歌词/要点后再继续生成。'
                            : 'Fallback web evidence was found. Please confirm lyrics/key points before generation.',
                        urlCount: videoUrls.length,
                        evidenceUrlCount: fallbackEvidenceUrls.length,
                    });
                    setState(prev => ({ ...prev, isLoading: false, generatedContent: null, error: null }));
                    updateProgress(
                        0,
                        0,
                        lang === 'zh' ? '等待证据确认…' : 'Waiting for evidence confirmation...',
                        stages,
                    );
                };

                const tryAutoWebFallbackEvidence = async (
                    videoBackend: 'cloud' | 'local',
                    reason: string,
                ): Promise<boolean> => {
                    setVideoGroundingSummary({
                        status: 'processing',
                        message: lang === 'zh'
                            ? '字幕不可用，正在自动检索公开歌词/字幕证据...'
                            : 'Transcript unavailable. Searching public lyric/transcript evidence...',
                        urlCount: videoUrls.length,
                    });
                    updateProgress(
                        sourceMode === 'direct' ? 1 : 2,
                        sourceMode === 'direct' ? 56 : 58,
                        lang === 'zh' ? '正在检索可确认的外部证据...' : 'Finding verifiable fallback evidence...',
                        stages,
                    );

                    const fallbackRag = await startRAG(
                        `Fallback lyric/transcript evidence for lesson "${lessonTitle}" (${level})`,
                        [
                            `The following YouTube URLs were provided by teacher but transcript extraction failed:
${videoUrls.map((url, idx) => `${idx + 1}. ${url}`).join('\n')}

Find public web evidence (lyrics/transcript/pages) that likely match these exact videos.
Output one evidence sheet with these sections:
1) Match table: input URL -> matched page title + URL + confidence (high/medium/low)
2) Candidate lyric/transcript lines with short excerpts and source URL refs
3) Teachable evidence summary: key vocabulary, TPR cues, wrap-up cues
4) Unresolved items where match is uncertain

If no reliable evidence is found, include marker: NO_FALLBACK_EVIDENCE
Never invent exact lines without a cited source URL.`,
                        ],
                        videoBackend,
                        { tolerateErrors: true, allowEmptyFactSheets: true },
                    );

                    const fallbackFactSheet = fallbackRag.factSheets.get(0)?.content?.trim() || '';
                    const fallbackEvidenceUrls = mergeUnique([], fallbackRag.validUrls || []);
                    const fallbackSources = Array.isArray(fallbackRag.sources) ? fallbackRag.sources : [];
                    const noUsableFallback = (
                        !fallbackFactSheet
                        || /NO_FALLBACK_EVIDENCE|NO_USABLE_SOURCE|VIDEO_SOURCE_UNAVAILABLE/i.test(fallbackFactSheet)
                        || fallbackEvidenceUrls.length === 0
                    );

                    if (!noUsableFallback) {
                        requestFallbackEvidenceReview(reason, fallbackFactSheet, fallbackEvidenceUrls, fallbackSources);
                        return true;
                    }

                    if (fallbackRag.error) {
                        qualityIssues.push(`Fallback lyric evidence warning: ${fallbackRag.error}`);
                    }
                    return false;
                };

                if (normalizedManualEvidence) {
                    videoFactSheet = `[Manual Transcript / Key Points]\n${normalizedManualEvidence}`;
                    const evidenceUrls = mergeUnique(videoUrls, manualEvidenceUrls || []);
                    validUrls = mergeUnique(validUrls, evidenceUrls);
                    groundingSources = mergeGroundingSources(groundingSources, manualEvidenceSources || []);
                    setVideoGroundingSummary({
                        status: 'grounded',
                        message: lang === 'zh'
                            ? (manualEvidenceKind === 'fallback_web'
                                ? '已确认回退证据，继续生成。'
                                : '已使用你手动提供的字幕/要点，继续生成。')
                            : (manualEvidenceKind === 'fallback_web'
                                ? 'Fallback evidence confirmed. Continuing generation.'
                                : 'Using your manual transcript/key points for generation.'),
                        urlCount: videoUrls.length,
                        evidenceUrlCount: evidenceUrls.length,
                    });
                } else {
                    setVideoGroundingSummary({
                        status: 'processing',
                        message: lang === 'zh'
                            ? '检测到视频链接，正在尝试提取可用证据...'
                            : 'Video URLs detected. Extracting evidence...',
                        urlCount: videoUrls.length,
                    });
                    updateProgress(
                        sourceMode === 'direct' ? 1 : 2,
                        sourceMode === 'direct' ? 52 : 55,
                        lang === 'zh' ? '正在解析视频链接内容...' : 'Analyzing referenced video URLs...',
                        stages,
                    );

                    const backends = await checkBackends();
                    const videoBackend = backends.cloud ? 'cloud' : (backends.local ? 'local' : null);
                    if (!videoBackend) {
                        requireManualVideoEvidence('No NotebookLM backend available for transcript extraction.');
                        return;
                    }

                    const videoRag = await startRAG(
                        `Video evidence for lesson "${lessonTitle}" (${level})`,
                        [
                            `Analyze ONLY these video URLs and generate one concise evidence sheet for ESL teaching:
${videoUrls.map((url, idx) => `${idx + 1}. ${url}`).join('\n')}

Output requirements:
- "Video summary": 5-8 bullet points about teachable content
- "Target vocabulary candidates": 8-15 items from video content
- "TPR / classroom command ideas": 5-8 actionable commands
- "Warm-up and wrap-up ideas": 2-4 items each
- If any URL cannot be accessed or transcript is unavailable, mark: VIDEO_SOURCE_UNAVAILABLE (with URL).
Do NOT invent lyrics or exact lines when transcript evidence is missing.`,
                        ],
                        videoBackend,
                        { tolerateErrors: true, allowEmptyFactSheets: true },
                    );

                    const rawVideoFactSheet = videoRag.factSheets.get(0)?.content;
                    const unavailable = /VIDEO_SOURCE_UNAVAILABLE|NO_USABLE_SOURCE/i.test(rawVideoFactSheet || '');

                    if (rawVideoFactSheet && !unavailable) {
                        if ((videoRag.validUrls || []).some((url) => !isUrlFromInputVideos(url, videoUrls))) {
                            qualityIssues.push('Transcript extraction returned non-input URLs. Ignored in strict input-video mode.');
                        }
                        videoFactSheet = rawVideoFactSheet;
                        validUrls = mergeUnique(validUrls, videoUrls);
                        groundingSources = mergeGroundingSources(
                            groundingSources,
                            (videoRag.sources || []).filter((source) => !source.url || isUrlFromInputVideos(source.url, videoUrls)),
                        );
                        setVideoGroundingSummary({
                            status: 'grounded',
                            message: lang === 'zh'
                                ? '视频内容证据提取成功，已合并到教案生成上下文。'
                                : 'Video evidence extracted and merged into lesson generation context.',
                            urlCount: videoUrls.length,
                            evidenceUrlCount: mergeUnique(
                                [],
                                (videoRag.validUrls || []).filter((url) => isUrlFromInputVideos(url, videoUrls)),
                            ).length,
                        });
                    } else {
                        const fallbackReady = await tryAutoWebFallbackEvidence(
                            videoBackend,
                            'Transcript extraction failed; fallback web evidence needs your confirmation.',
                        );
                        if (fallbackReady) return;
                        requireManualVideoEvidence('No usable transcript-backed evidence was extracted from provided video URLs.');
                        return;
                    }

                    if (videoRag.error) {
                        qualityIssues.push(`Video URL analysis warning: ${videoRag.error}`);
                        if (!videoFactSheet) {
                            const fallbackReady = await tryAutoWebFallbackEvidence(
                                videoBackend,
                                `Video analysis failed: ${videoRag.error}. Fallback evidence needs confirmation.`,
                            );
                            if (fallbackReady) return;
                            requireManualVideoEvidence(`Video analysis failed: ${videoRag.error}`);
                            return;
                        }
                    }
                }
            }

            if (sourceMode === 'notebook' && levelEntry?.notebookId) {
                try {
                    updateProgress(1, 24, lang === 'zh' ? '正在连接 NotebookLM...' : 'Connecting to NotebookLM...', stages);
                    const backends = await checkBackends();
                    if (!backends.local) {
                        const fbTitle = lang === 'zh' ? '本地 NotebookLM 不可用' : 'Local NotebookLM unavailable';
                        const fbDetail = lang === 'zh'
                            ? `当前级别绑定 notebook "${levelEntry.notebookId}"，需要本地 dev:nlm。是否切换到 fallback 继续生成？`
                            : `Notebook "${levelEntry.notebookId}" requires local dev:nlm. Switch to fallback mode?`;
                        const choice = await askFallbackConfirm(fbTitle, fbDetail);
                        if (choice === 'cancel') throw new Error('AbortError');
                        qualityIssues.push(`Fallback: ${fbTitle} - ${fbDetail}`);
                        updateProgress(2, 40, lang === 'zh' ? 'NotebookLM 不可用，切换 fallback...' : 'NotebookLM unavailable, switching to fallback...', stages);
                        throw new Error('LOCAL_NOTEBOOK_BACKEND_UNAVAILABLE');
                    }

                    const backend = 'local';

                    // Ensure resource guide exists in notebook before RAG query
                    updateProgress(
                        2,
                        35,
                        lang === 'zh' ? '正在检查资源调用指南...' : 'Checking resource guide...',
                        stages,
                    );
                    const guideResult = await ensureResourceGuide(levelEntry.notebookId!, {
                        level,
                        duration,
                        studentCount,
                    });
                    if (guideResult.status === 'created') {
                        console.log('[create] Resource guide created:', guideResult.sourceId);
                    } else if (guideResult.status === 'error') {
                        console.warn('[create] Resource guide failed (non-blocking):', guideResult.error);
                    }

                    updateProgress(
                        3,
                        48,
                        lang === 'zh'
                            ? `已连接 ${backend}，正在分析对应笔记资料...`
                            : `Connected to ${backend}, analyzing notebook sources...`,
                        stages,
                    );

                    const rag = await startRAG(
                        `Textbook-level assessment grounding for ${levelEntry.displayName}.`,
                        [
                            `Using ONLY selected notebook sources, generate one concise fact sheet for lesson "${lessonTitle}" at level ${level}.
Return concrete source-grounded evidence (unit/section, vocabulary examples, grammar targets, classroom evidence cues).
If notebook sources are missing/insufficient, include marker: NO_USABLE_SOURCE.`,
                        ],
                        backend,
                        {
                            notebookId: levelEntry.notebookId || undefined,
                            tolerateErrors: true,
                            allowEmptyFactSheets: true,
                        },
                    );

                    factSheet = rag.factSheets.get(0)?.content;
                    if (videoUrls.length > 0) {
                        validUrls = mergeUnique(validUrls, videoUrls);
                        groundingSources = mergeGroundingSources(
                            groundingSources,
                            (rag.sources || []).filter((source) => !source.url || isUrlFromInputVideos(source.url, videoUrls)),
                        );
                    } else {
                        validUrls = mergeUnique(validUrls, rag.validUrls || []);
                        groundingSources = mergeGroundingSources(groundingSources, rag.sources || []);
                    }
                    knowledgeNotebookId = rag.notebookId || levelEntry.notebookId || undefined;
                    const hasNoUsableSourceMarker = /NO_USABLE_SOURCE/i.test(factSheet || '');
                    if (hasNoUsableSourceMarker) {
                        factSheet = undefined;
                    }

                    if (factSheet) {
                        const quality = rag.factSheets.get(0)?.quality;
                        groundingStatus = quality === 'good' ? 'verified' : 'mixed';
                        updateProgress(2, 62, lang === 'zh' ? 'NotebookLM 命中来源，正在生成课件...' : 'Notebook sources grounded, generating lesson kit...', stages);
                    } else {
                        groundingStatus = 'unverified';
                        const fbTitle = lang === 'zh' ? '未提取到 notebook 事实表' : 'No notebook fact sheet extracted';
                        const fbDetail = lang === 'zh'
                            ? `已连接 notebook "${knowledgeNotebookId || levelEntry.notebookId}"，但未返回可用事实表（来源 ${rag.sources.length} 个，URL ${rag.validUrls.length} 条）。是否继续 fallback 生成？`
                            : `Connected to notebook "${knowledgeNotebookId || levelEntry.notebookId}", but no usable fact sheet was returned (${rag.sources.length} source(s), ${rag.validUrls.length} URL). Continue with fallback?`;
                        const choice = await askFallbackConfirm(fbTitle, fbDetail);
                        if (choice === 'cancel') throw new Error('AbortError');
                        qualityIssues.push(`Fallback: ${fbTitle} - ${fbDetail}`);
                    }

                    if (rag.error) {
                        qualityIssues.push(`Fallback warning: ${rag.error}`);
                    }
                } catch (ragError: any) {
                    if (ragError.message === 'AbortError') throw ragError;
                    groundingStatus = 'unverified';
                    if (!String(ragError?.message || '').includes('LOCAL_NOTEBOOK_BACKEND_UNAVAILABLE')) {
                        const fbTitle = lang === 'zh' ? 'NotebookLM 请求失败' : 'NotebookLM request failed';
                        const fbDetail = lang === 'zh'
                            ? `Notebook 调用失败：${ragError?.message || '未知错误'}。是否改用级别标准继续生成？`
                            : `Notebook request failed: ${ragError?.message || 'Unknown error'}. Continue with level standard?`;
                        const choice = await askFallbackConfirm(fbTitle, fbDetail);
                        if (choice === 'cancel') throw new Error('AbortError');
                        qualityIssues.push(`Fallback: ${fbTitle} - ${fbDetail}`);
                    }
                }
            } else if (sourceMode === 'notebook') {
                groundingStatus = 'unverified';
                qualityIssues.push('No NotebookLM knowledge base configured for current selection; generated content requires manual review.');
            } else {
                groundingStatus = 'unverified';
                knowledgeNotebookId = undefined;
                qualityIssues.push('Direct mode: generated from uploaded/input context without NotebookLM grounding; teacher review recommended.');
                updateProgress(
                    1,
                    44,
                    lang === 'zh' ? '正在分析上传/输入资料...' : 'Analyzing uploaded or typed materials...',
                    stages,
                );
            }

            const mergedFactSheet = [
                factSheet,
                videoFactSheet ? `[Video Content Evidence]\n${videoFactSheet}` : undefined,
            ].filter(Boolean).join('\n\n---\n\n') || undefined;

            const generationStage = sourceMode === 'direct' ? 2 : 3;
            updateProgress(generationStage, 78, lang === 'zh' ? '正在生成课件内容...' : 'Generating lesson kit content...', stages);

            const lessonContent = await generateLessonPlan(
                text,
                files,
                level,
                topic,
                slideCount,
                duration,
                studentCount,
                lessonTitle,
                abortControllerRef.current.signal,
                mergedFactSheet,
                validUrls,
                {
                    textbookLevelKey: normalizedLevelKey,
                    assessmentPackId: levelEntry?.assessmentPackId,
                    knowledgeNotebookId,
                    groundingSources,
                    groundingStatus,
                    qualityIssues,
                    assessmentPackPrompt: assessmentPack ? buildAssessmentPackPrompt(assessmentPack) : undefined,
                    mode: 'plan_only', // Fix A: Phase 1 only generates lesson plan
                    ageGroup,
                },
            );

            // Fix A: Save generation context for Phase 2
            lessonContent._generationContext = {
                level,
                topic,
                lessonTitle,
                ageGroup,
                duration,
                studentCount,
                slideCount,
                factSheet: mergedFactSheet,
                validUrls,
                textbookLevelKey: normalizedLevelKey,
                assessmentPackPrompt: assessmentPack ? buildAssessmentPackPrompt(assessmentPack) : undefined,
                sourceMode,
            };

            const finalizeStage = sourceMode === 'direct' ? 3 : 4;
            updateProgress(finalizeStage, 96, lang === 'zh' ? '正在整理结构化结果...' : 'Finalizing structured output...', stages);
            // Preserve the user's custom prompt for display/copy
            if (text?.trim()) lessonContent.inputPrompt = text.trim();
            setState({ isLoading: false, generatedContent: lessonContent, error: null });
            setManualVideoEvidence('');
            updateProgress(finalizeStage, 100, lang === 'zh' ? '教案已生成，请审阅后继续生成配套内容。' : 'Lesson plan ready - review and generate supporting content.', stages);
        } catch (error: any) {
            if (error.name === 'AbortError' || error.message === 'AbortError' || error.message === 'Operation aborted') {
                updateProgress(0, 0, lang === 'zh' ? '已中断生成' : 'Generation aborted', stages);
                setState(prev => ({ ...prev, isLoading: false }));
                return;
            }
            console.error(error);
            let errorMessage = 'Failed to generate lesson plan.';
            if (error.message) {
                if (error.message.includes('API key')) errorMessage = 'Invalid API Key.';
                else if (error.message.includes('fetch') || error.message.includes('network')) errorMessage = 'Network Error.';
                else if (error.message.includes('SAFE') || error.message.includes('Safety')) errorMessage = 'Generation blocked by Safety Filters.';
                else errorMessage = error.message;
            }
            setState({ isLoading: false, generatedContent: null, error: errorMessage });
        } finally {
            abortControllerRef.current = null;
        }
    };

    const renderVideoGroundingBanner = () => {
        if (!videoGroundingSummary) return null;
        const isGrounded = videoGroundingSummary.status === 'grounded';
        const isProcessing = videoGroundingSummary.status === 'processing';
        const isReview = videoGroundingSummary.status === 'review';
        const tone = isGrounded
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : isProcessing
                ? 'bg-sky-50 border-sky-200 text-sky-800'
                : 'bg-amber-50 border-amber-200 text-amber-800';
        const hasEvidenceCount = (isGrounded || isReview) && typeof videoGroundingSummary.evidenceUrlCount === 'number';
        const suffix = hasEvidenceCount
            ? (lang === 'zh'
                ? `（输入链接 ${videoGroundingSummary.urlCount} 条，证据 URL ${videoGroundingSummary.evidenceUrlCount} 条）`
                : ` (${videoGroundingSummary.urlCount} input URL(s), ${videoGroundingSummary.evidenceUrlCount} evidence URL(s))`)
            : (lang === 'zh'
                ? `（视频链接 ${videoGroundingSummary.urlCount} 条）`
                : ` (${videoGroundingSummary.urlCount} video URL(s))`);

        return (
            <div className={`mb-4 rounded-lg border px-3 py-2 text-xs sm:text-sm ${tone}`}>
                {videoGroundingSummary.message}{suffix}
            </div>
        );
    };

    const handleManualVideoEvidenceSubmit = async () => {
        if (!pendingGenerationRequest || !manualVideoEvidence.trim()) return;
        const req = pendingGenerationRequest;
        await handleGenerate(
            req.text,
            req.files,
            req.level,
            req.topic,
            req.slideCount,
            req.duration,
            req.studentCount,
            req.lessonTitle,
            req.textbookLevelKey,
            req.sourceMode,
            req.ageGroup,
            manualVideoEvidence.trim(),
            undefined,
            undefined,
            'manual',
        );
    };

    const handleConfirmFallbackEvidenceSubmit = async () => {
        if (!pendingGenerationRequest || !videoFallbackEvidenceReview || !manualVideoEvidence.trim()) return;
        const req = pendingGenerationRequest;
        await handleGenerate(
            req.text,
            req.files,
            req.level,
            req.topic,
            req.slideCount,
            req.duration,
            req.studentCount,
            req.lessonTitle,
            req.textbookLevelKey,
            req.sourceMode,
            req.ageGroup,
            manualVideoEvidence.trim(),
            videoFallbackEvidenceReview.evidenceUrls,
            videoFallbackEvidenceReview.sources,
            'fallback_web',
        );
    };

    const handleRejectFallbackEvidence = () => {
        if (!videoFallbackEvidenceReview) return;
        setVideoTranscriptRequest({
            urls: videoFallbackEvidenceReview.inputUrls,
            reason: lang === 'zh'
                ? '你已拒绝自动回退证据，请手动粘贴字幕/要点后继续。'
                : 'Fallback evidence was rejected. Paste manual transcript/key points to continue.',
        });
        setVideoGroundingSummary({
            status: 'unavailable',
            message: lang === 'zh'
                ? '已拒绝回退证据，请手动提供字幕/要点。'
                : 'Fallback evidence rejected. Manual transcript/key points required.',
            urlCount: videoFallbackEvidenceReview.inputUrls.length,
        });
        setVideoFallbackEvidenceReview(null);
        setManualVideoEvidence('');
    };

    const renderVideoFallbackEvidenceReviewPanel = () => {
        if (!videoFallbackEvidenceReview || state.generatedContent) return null;
        return (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">
                    {lang === 'zh'
                        ? '已找到回退歌词/字幕证据，请先确认后再继续生成'
                        : 'Fallback lyric/transcript evidence found. Confirm before generation'}
                </p>
                <p className="mt-1 text-xs text-amber-800">{videoFallbackEvidenceReview.reason}</p>
                <p className="mt-2 text-xs text-amber-800">
                    {lang === 'zh' ? '输入视频 URL：' : 'Input video URL(s):'}
                </p>
                <ul className="mt-1 list-disc pl-5 text-xs text-amber-900">
                    {videoFallbackEvidenceReview.inputUrls.map((url) => (
                        <li key={url} className="break-all">{url}</li>
                    ))}
                </ul>
                <p className="mt-2 text-xs text-amber-800">
                    {lang === 'zh' ? '自动检索到的证据 URL（请核对）：' : 'Auto-found evidence URL(s) for review:'}
                </p>
                <ul className="mt-1 max-h-28 list-disc overflow-auto pl-5 text-xs text-amber-900">
                    {videoFallbackEvidenceReview.evidenceUrls.map((url) => (
                        <li key={url} className="break-all">{url}</li>
                    ))}
                </ul>
                <textarea
                    value={manualVideoEvidence}
                    onChange={(event) => setManualVideoEvidence(event.target.value)}
                    placeholder={lang === 'zh'
                        ? '请确认/修改歌词或关键要点，再继续生成...'
                        : 'Review/edit extracted lyrics or key points before continuing...'}
                    className="mt-3 w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                    rows={8}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={handleConfirmFallbackEvidenceSubmit}
                        disabled={state.isLoading || !manualVideoEvidence.trim()}
                        className="rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {lang === 'zh' ? '确认证据并继续生成' : 'Confirm evidence and continue'}
                    </button>
                    <button
                        type="button"
                        onClick={handleRejectFallbackEvidence}
                        className="rounded-md border border-amber-400 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100"
                    >
                        {lang === 'zh' ? '拒绝回退证据' : 'Reject fallback evidence'}
                    </button>
                </div>
            </div>
        );
    };

    const renderVideoTranscriptRequestPanel = () => {
        if (!videoTranscriptRequest || videoFallbackEvidenceReview || state.generatedContent) return null;
        return (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">
                    {lang === 'zh'
                        ? '需要手动提供字幕/要点后才能继续生成'
                        : 'Manual transcript/key points required to continue'}
                </p>
                <p className="mt-1 text-xs text-amber-800">
                    {videoTranscriptRequest.reason}
                </p>
                <p className="mt-2 text-xs text-amber-800">
                    {lang === 'zh' ? '仅接受以下输入 URL：' : 'Accepted input URL(s) only:'}
                </p>
                <ul className="mt-1 list-disc pl-5 text-xs text-amber-900">
                    {videoTranscriptRequest.urls.map((url) => (
                        <li key={url} className="break-all">{url}</li>
                    ))}
                </ul>
                <textarea
                    value={manualVideoEvidence}
                    onChange={(event) => setManualVideoEvidence(event.target.value)}
                    placeholder={lang === 'zh'
                        ? '请粘贴字幕，或写下关键台词/动作指令/词汇要点...'
                        : 'Paste transcript, or provide key lines/TPR cues/vocabulary points...'}
                    className="mt-3 w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                    rows={5}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={handleManualVideoEvidenceSubmit}
                        disabled={state.isLoading || !manualVideoEvidence.trim()}
                        className="rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {lang === 'zh' ? '使用手动字幕继续生成' : 'Continue with manual evidence'}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setVideoTranscriptRequest(null);
                            setManualVideoEvidence('');
                        }}
                        className="rounded-md border border-amber-400 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100"
                    >
                        {lang === 'zh' ? '取消' : 'Cancel'}
                    </button>
                </div>
            </div>
        );
    };

    return (
        <>
            {!state.generatedContent && (
                <>
                    {renderVideoGroundingBanner()}
                    {renderVideoFallbackEvidenceReviewPanel()}
                    {renderVideoTranscriptRequestPanel()}
                    <InputSection
                        onGenerate={handleGenerate}
                        isLoading={state.isLoading}
                        initialValues={prefilledValues}
                        onStop={handleStopGeneration}
                        generationProgress={generationProgress}
                        pendingFallback={pendingFallback}
                        onFallbackChoice={handleFallbackChoice}
                    />
                </>
            )}
            {state.error && (
                <ErrorModal
                    message={state.error}
                    onClose={() => setState(prev => ({ ...prev, error: null }))}
                />
            )}
            {state.generatedContent && (
                <div className="animate-fade-in-up">
                    <div className="mb-4 flex items-center justify-between">
                        <button
                            onClick={() => {
                                setState(prev => ({ ...prev, generatedContent: null }));
                                setActiveLessonId(null);
                                setPrefilledValues(null);
                            }}
                            className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors text-sm md:text-base"
                        >
                            <ArrowLeft className="w-4 h-4" /> {t('plan.backToGenerator')}
                        </button>
                    </div>
                    {renderVideoGroundingBanner()}

                    <ReviewPanel
                        content={state.generatedContent}
                        level={state.generatedContent.structuredLessonPlan?.classInformation?.level || prefilledValues?.level || 'A1'}
                        onContentUpdate={(updated) => {
                            setState(prev => ({ ...prev, generatedContent: updated }));
                        }}
                        onApprove={() => {
                            const updated: GeneratedContent = {
                                ...state.generatedContent!,
                                qualityGate: { pass: true, status: 'ok', issues: [] },
                                scoreReport: state.generatedContent!.scoreReport
                                    ? { ...state.generatedContent!.scoreReport, reviewerStatus: 'ready_to_teach' }
                                    : undefined,
                            };
                            setState(prev => ({ ...prev, generatedContent: updated }));
                            onSaveLesson(updated);
                        }}
                    />

                    <OutputDisplay key={activeLessonId || 'new'} content={state.generatedContent} onSave={(c) => {
                        // Update local state so UI re-renders (critical for Phase 2 -> tab unlock)
                        setState(prev => ({ ...prev, generatedContent: c }));
                        onSaveLesson(c);
                    }} />
                </div>
            )}
        </>
    );
};
