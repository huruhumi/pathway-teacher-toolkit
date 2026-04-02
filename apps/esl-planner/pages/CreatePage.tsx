import React, { useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { ReviewPanel } from '../components/ReviewPanel';
import { InputSection } from '../components/InputSection';
import { OutputDisplay } from '../components/OutputDisplay';
import { ErrorModal } from '../components/ErrorModal';
import { generateLessonPlan } from '../services/lessonKitService';
import { useLanguage } from '../i18n/LanguageContext';
import type { CEFRLevel, GeneratedContent, CustomStageInput } from '../types';
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
import { extractVideoEvidenceWithDirectGemini } from '../services/videoEvidenceGemini';

export interface CreatePageProps {
    isActive?: boolean;
}

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
    customStages?: CustomStageInput[];
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

type VideoTranscriptEvidenceReview = {
    inputUrls: string[];
    reason: string;
    factSheet: string;
    evidenceUrls: string[];
    sources: GroundingSourceItem[];
};

type VideoEvidenceMode = 'none' | 'transcript_verified' | 'manual_verified' | 'fallback_web_unverified';
type VideoReviewAction = 'normal' | 'force_fallback_search';
type VideoUrlEvidencePreview = {
    inputUrl: string;
    status: 'ready' | 'unavailable';
    sourceUrl?: string;
    charCount?: number;
    reason?: string;
    excerpt?: string;
};

const URL_REGEX = /https?:\/\/[^\s<>"'`]+/gi;
const YOUTUBE_URL_REGEX = /(?:youtube\.com\/watch\?v=|youtu\.be\/)/i;
const TRAILING_URL_PUNCTUATION_REGEX = /[)\],.;!?'"\]}>\u3001\u3002\uFF0C\uFF1B\uFF1A\uFF01\uFF1F]+$/g;
const URL_SEPARATOR_REGEX = /[\s\u3001\u3002\uFF0C\uFF1B\uFF1A\uFF01\uFF1F]+/;

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

const parseVideoUrlEvidencePreview = (
    factSheet: string,
    inputUrls: string[],
): VideoUrlEvidencePreview[] => {
    if (!factSheet || !/VIDEO_URL_ONLY_MODE=TRUE/i.test(factSheet)) return [];

    const sourceSnippetByUrl = new Map<string, { excerpt: string; charCount?: number }>();
    const sourceSnippetByVideoId = new Map<string, { excerpt: string; charCount?: number; sourceUrl: string }>();
    const sourceBlocks = factSheet.match(/\[Source\s+\d+\][\s\S]*?(?=\n\[Source\s+\d+\]|\s*$)/g) || [];
    for (const block of sourceBlocks) {
        const urlMatch = block.match(/^\s*URL:\s*(.+)$/m);
        const charCountMatch = block.match(/^\s*char_count:\s*(\d+)\s*$/m);
        const excerptMatch = block.match(/excerpt:\s*([\s\S]*)$/m);
        const sourceUrl = (urlMatch?.[1] || '').trim();
        const excerpt = (excerptMatch?.[1] || '').trim();
        const charCount = Number(charCountMatch?.[1] || 0) || undefined;
        if (!sourceUrl || !excerpt) continue;
        sourceSnippetByUrl.set(normalizeUrlForCompare(sourceUrl), { excerpt, charCount });
        const sourceVideoId = extractYouTubeVideoId(sourceUrl);
        if (sourceVideoId) {
            sourceSnippetByVideoId.set(sourceVideoId, { excerpt, charCount, sourceUrl });
        }
    }

    const previewByInputUrl = new Map<string, VideoUrlEvidencePreview>();
    const lines = factSheet.split(/\r?\n/);
    for (const line of lines) {
        const readyMatch = line.match(/^\s*-\s*READY\s*\|\s*input=(.+?)\s*\|\s*source=(.+?)\s*\|\s*char_count=(\d+)\s*$/i);
        if (readyMatch) {
            const inputUrl = readyMatch[1].trim();
            const sourceUrl = readyMatch[2].trim();
            const charCount = Number(readyMatch[3]) || undefined;
            const sourceByUrl = sourceSnippetByUrl.get(normalizeUrlForCompare(sourceUrl));
            const sourceById = extractYouTubeVideoId(sourceUrl)
                ? sourceSnippetByVideoId.get(extractYouTubeVideoId(sourceUrl) as string)
                : undefined;
            previewByInputUrl.set(inputUrl, {
                inputUrl,
                status: 'ready',
                sourceUrl,
                charCount,
                excerpt: sourceByUrl?.excerpt || sourceById?.excerpt,
            });
            continue;
        }

        const unavailableMatch = line.match(/^\s*-\s*VIDEO_SOURCE_UNAVAILABLE\s*\|\s*input=(.+?)\s*\|\s*reason=(.+)\s*$/i);
        if (unavailableMatch) {
            const inputUrl = unavailableMatch[1].trim();
            previewByInputUrl.set(inputUrl, {
                inputUrl,
                status: 'unavailable',
                reason: unavailableMatch[2].trim(),
            });
        }
    }

    return inputUrls.map((inputUrl) => {
        const fromLine = previewByInputUrl.get(inputUrl);
        if (fromLine) return fromLine;

        const videoId = extractYouTubeVideoId(inputUrl);
        if (videoId && sourceSnippetByVideoId.has(videoId)) {
            const matched = sourceSnippetByVideoId.get(videoId)!;
            return {
                inputUrl,
                status: 'ready',
                sourceUrl: matched.sourceUrl,
                charCount: matched.charCount,
                excerpt: matched.excerpt,
            };
        }

        return {
            inputUrl,
            status: 'unavailable',
            reason: 'No strict transcript evidence found for this URL.',
        };
    });
};

export const CreatePage: React.FC<CreatePageProps> = ({ isActive = true }) => {
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
                ? ['Validate input', 'Analyze provided materials', 'Generate lesson kit', 'Finalize output']
                : ['Validate input', 'Analyze provided materials', 'Generate lesson kit', 'Finalize output'];
        }
        return lang === 'zh'
            ? ['Validate input', 'Connect NotebookLM', 'Analyze notebook sources', 'Generate lesson kit', 'Finalize output']
            : ['Validate input', 'Connect NotebookLM', 'Analyze notebook sources', 'Generate lesson kit', 'Finalize output'];
    };

    const [generationProgress, setGenerationProgress] = useState<LessonKitGenerationProgress>({
        stage: 0,
        percent: 0,
        statusText: lang === 'zh' ? 'Preparing...' : 'Preparing...',
        stages: getProgressStages('notebook'),
    });

    const [videoGroundingSummary, setVideoGroundingSummary] = useState<VideoGroundingSummary | null>(null);
    const [videoTranscriptRequest, setVideoTranscriptRequest] = useState<VideoTranscriptRequest | null>(null);
    const [videoTranscriptEvidenceReview, setVideoTranscriptEvidenceReview] = useState<VideoTranscriptEvidenceReview | null>(null);
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
        setVideoTranscriptEvidenceReview(null);
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setState(prev => ({ ...prev, isLoading: false, error: 'Generation cancelled by user.' }));
        updateProgress(0, 0, lang === 'zh' ? 'Generation cancelled.' : 'Generation cancelled.');
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
        customStages?: CustomStageInput[],
        manualEvidenceInput?: string,
        manualEvidenceUrls?: string[],
        manualEvidenceSources?: GroundingSourceItem[],
        manualEvidenceKind: 'manual' | 'fallback_web' = 'manual',
        videoReviewAction: VideoReviewAction = 'normal',
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
            customStages,
        });
        setVideoTranscriptRequest(null);
        setVideoTranscriptEvidenceReview(null);
        setVideoFallbackEvidenceReview(null);
        if (!manualEvidenceInput?.trim()) {
            setVideoGroundingSummary(null);
            setManualVideoEvidence('');
        }
        setState(prev => ({ ...prev, isLoading: true, error: null, generatedContent: null }));
        updateProgress(
            0,
            10,
            lang === 'zh' ? 'Validating inputs and preparing task...' : 'Validating inputs and preparing task...',
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
            let videoEvidenceMode: VideoEvidenceMode = 'none';
            const normalizedManualEvidence = manualEvidenceInput?.trim();

            if (videoUrls.length > 0) {
                const requireManualVideoEvidence = (reason: string) => {
                    setVideoTranscriptRequest({ urls: videoUrls, reason });
                    setVideoTranscriptEvidenceReview(null);
                    setVideoFallbackEvidenceReview(null);
                    setVideoGroundingSummary({
                        status: 'unavailable',
                        message: 'Transcript evidence could not be extracted. Paste transcript/key points to continue.',
                        urlCount: videoUrls.length,
                    });
                    setState(prev => ({ ...prev, isLoading: false, generatedContent: null, error: null }));
                    updateProgress(
                        0,
                        0,
                        lang === 'zh' ? 'Waiting for manual transcript/key points...' : 'Waiting for manual transcript/key points...',
                        stages,
                    );
                };

                const requestTranscriptEvidenceReview = (
                    reason: string,
                    transcriptFactSheet: string,
                    transcriptEvidenceUrls: string[],
                    transcriptSources: GroundingSourceItem[],
                ) => {
                    setVideoTranscriptRequest(null);
                    setVideoFallbackEvidenceReview(null);
                    setManualVideoEvidence(transcriptFactSheet);
                    setVideoTranscriptEvidenceReview({
                        inputUrls: videoUrls,
                        reason,
                        factSheet: transcriptFactSheet,
                        evidenceUrls: transcriptEvidenceUrls,
                        sources: transcriptSources,
                    });
                    setVideoGroundingSummary({
                        status: 'review',
                        message: 'Transcript evidence extracted. Please review before generation.',
                        urlCount: videoUrls.length,
                        evidenceUrlCount: transcriptEvidenceUrls.length,
                    });
                    setState(prev => ({ ...prev, isLoading: false, generatedContent: null, error: null }));
                    updateProgress(
                        0,
                        0,
                        'Waiting for transcript evidence review...',
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
                    setVideoTranscriptEvidenceReview(null);
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
                        message: 'Fallback web evidence was found. Please confirm lyrics/key points before generation.',
                        urlCount: videoUrls.length,
                        evidenceUrlCount: fallbackEvidenceUrls.length,
                    });
                    setState(prev => ({ ...prev, isLoading: false, generatedContent: null, error: null }));
                    updateProgress(
                        0,
                        0,
                        lang === 'zh' ? 'Waiting for evidence confirmation...' : 'Waiting for evidence confirmation...',
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
                            ? 'Transcript unavailable. Searching public lyric/transcript evidence...'
                            : 'Transcript unavailable. Searching public lyric/transcript evidence...',
                        urlCount: videoUrls.length,
                    });
                    updateProgress(
                        sourceMode === 'direct' ? 1 : 2,
                        sourceMode === 'direct' ? 56 : 58,
                        lang === 'zh' ? 'Finding verifiable fallback evidence...' : 'Finding verifiable fallback evidence...',
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
                    const hasConfidenceInfo = /confidence/i.test(fallbackFactSheet);
                    const hasCoverageForInputUrls = videoUrls.every((url) => fallbackFactSheet.includes(url));
                    const noUsableFallback = (
                        !fallbackFactSheet
                        || /NO_FALLBACK_EVIDENCE|NO_USABLE_SOURCE|VIDEO_SOURCE_UNAVAILABLE/i.test(fallbackFactSheet)
                        || fallbackEvidenceUrls.length === 0
                        || !hasConfidenceInfo
                        || !hasCoverageForInputUrls
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

                const tryDirectGeminiVideoEvidence = async (
                    reason: string,
                ): Promise<boolean> => {
                    setVideoGroundingSummary({
                        status: 'processing',
                        message: 'Using direct Gemini URL analysis for your video links...',
                        urlCount: videoUrls.length,
                    });
                    updateProgress(
                        sourceMode === 'direct' ? 1 : 2,
                        sourceMode === 'direct' ? 54 : 57,
                        'Running direct Gemini URL evidence extraction...',
                        stages,
                    );

                    const direct = await extractVideoEvidenceWithDirectGemini(videoUrls, lessonTitle, level);
                    if (direct.error) {
                        qualityIssues.push(`Direct Gemini URL evidence warning: ${direct.error}`);
                    }

                    const factSheet = (direct.factSheet || '').trim();
                    const evidenceUrls = mergeUnique([], direct.evidenceUrls || []);
                    const looksDirectMode = /DIRECT_GEMINI_URL_MODE=TRUE/i.test(factSheet);
                    const readyMatches = factSheet.match(/^\s*-\s*READY\s*\|\s*input=/gim) || [];
                    const readyCount = readyMatches.length;
                    const usableEvidenceUrls = evidenceUrls.length > 0 ? evidenceUrls : (readyCount > 0 ? videoUrls : []);
                    const noUsable = (
                        !factSheet
                        || /NO_USABLE_SOURCE/i.test(factSheet)
                        || readyCount === 0
                        || !looksDirectMode
                    );

                    if (noUsable) return false;

                    const directSources: GroundingSourceItem[] = usableEvidenceUrls.map((url) => ({
                        url,
                        title: url,
                        status: 'ready',
                        type: 'web',
                    }));
                    requestFallbackEvidenceReview(reason, factSheet, usableEvidenceUrls, directSources);
                    return true;
                };

                if (!normalizedManualEvidence) {
                    requireManualVideoEvidence(
                        'Video URL detected. Automatic transcript/evidence extraction is disabled. Paste transcript/lyrics/key points manually to continue.',
                    );
                    return;
                }

                if (normalizedManualEvidence) {
                    videoEvidenceMode = manualEvidenceKind === 'fallback_web' ? 'fallback_web_unverified' : 'manual_verified';
                    videoFactSheet = manualEvidenceKind === 'fallback_web'
                        ? `[Fallback Web Evidence - User Confirmed]
${normalizedManualEvidence}`
                        : `[Manual Transcript / Key Points]
${normalizedManualEvidence}`;
                    const evidenceUrls = mergeUnique(videoUrls, manualEvidenceUrls || []);
                    validUrls = mergeUnique(validUrls, evidenceUrls);
                    groundingSources = mergeGroundingSources(groundingSources, manualEvidenceSources || []);
                    if (manualEvidenceKind === 'fallback_web') {
                        qualityIssues.push('Video content used fallback web evidence. Specific song title/lyrics should be teacher-verified.');
                    }
                    setVideoGroundingSummary({
                        status: 'grounded',
                        message: manualEvidenceKind === 'fallback_web'
                            ? 'Fallback evidence confirmed. Continuing generation.'
                            : 'Using your manual transcript/key points for generation.',
                        urlCount: videoUrls.length,
                        evidenceUrlCount: evidenceUrls.length,
                    });
                } else {
                    if (videoReviewAction === 'force_fallback_search') {
                        const backends = await checkBackends();
                        const directReady = await tryDirectGeminiVideoEvidence(
                            'Transcript review marked as incorrect. Direct Gemini URL analysis needs your confirmation.',
                        );
                        if (directReady) return;
                        const videoBackend = backends.cloud ? 'cloud' : (backends.local ? 'local' : null);
                        if (!videoBackend) {
                            requireManualVideoEvidence('No NotebookLM backend available for fallback evidence extraction.');
                            return;
                        }
                        const fallbackReady = await tryAutoWebFallbackEvidence(
                            videoBackend,
                            'Transcript review marked as incorrect. Searching fallback evidence for verification.',
                        );
                        if (fallbackReady) return;
                        requireManualVideoEvidence('No usable fallback evidence was found. Paste transcript/key points manually.');
                        return;
                    }

                    setVideoGroundingSummary({
                        status: 'processing',
                        message: 'Video URLs detected. Extracting evidence...',
                        urlCount: videoUrls.length,
                    });
                    updateProgress(
                        sourceMode === 'direct' ? 1 : 2,
                        sourceMode === 'direct' ? 52 : 55,
                        lang === 'zh' ? 'Analyzing referenced video URLs...' : 'Analyzing referenced video URLs...',
                        stages,
                    );

                    const backends = await checkBackends();
                    const videoBackend = backends.local ? 'local' : null;
                    if (!videoBackend) {
                        const directReady = await tryDirectGeminiVideoEvidence(
                            'Local NotebookLM backend unavailable. Direct Gemini URL analysis needs your confirmation.',
                        );
                        if (directReady) return;
                        if (backends.cloud) {
                            const fallbackReady = await tryAutoWebFallbackEvidence(
                                'cloud',
                                'Local NotebookLM backend unavailable; switched to cloud fallback evidence search for your confirmation.',
                            );
                            if (fallbackReady) return;
                        }
                        requireManualVideoEvidence('Local NotebookLM backend unavailable. Run `notebooklm auth check --test`; if token fetch fails, fix network/proxy then start `npm run dev:nlm`.');
                        return;
                    }

                    const videoRag = await startRAG(
                        `Video evidence for lesson "${lessonTitle}" (${level})`,
                        [
                            `Analyze ONLY these video URLs and extract transcript/key-point evidence from the imported video sources:
${videoUrls.map((url, idx) => `${idx + 1}. ${url}`).join('\n')}

Output requirements:
- Return only transcript-backed evidence from these URLs.
- Include VIDEO_SOURCE_UNAVAILABLE for any URL without usable transcript/fulltext.
- Never invent lyrics or exact lines.`,
                        ],
                        videoBackend,
                        {
                            tolerateErrors: true,
                            allowEmptyFactSheets: true,
                            action: 'video-url-only',
                            videoUrls,
                        },
                    );

                    const rawVideoFactSheet = videoRag.factSheets.get(0)?.content;
                    const strictVideoMode = /VIDEO_URL_ONLY_MODE=TRUE/i.test(rawVideoFactSheet || '');
                    const unavailable = /VIDEO_SOURCE_UNAVAILABLE|NO_USABLE_SOURCE/i.test(rawVideoFactSheet || '');
                    const transcriptEvidenceUrls = mergeUnique(
                        [],
                        (videoRag.validUrls || []).filter((url) => isUrlFromInputVideos(url, videoUrls)),
                    );
                    const transcriptSources = (videoRag.sources || []).filter(
                        (source) => !source.url || isUrlFromInputVideos(source.url, videoUrls),
                    );
                    const hasInputCoverage = videoUrls.every((url) =>
                        transcriptEvidenceUrls.some((evidenceUrl) => isUrlFromInputVideos(evidenceUrl, [url]))
                    );

                    if (rawVideoFactSheet && strictVideoMode && !unavailable && hasInputCoverage) {
                        if ((videoRag.validUrls || []).some((url) => !isUrlFromInputVideos(url, videoUrls))) {
                            qualityIssues.push('Transcript extraction returned non-input URLs. Ignored in strict input-video mode.');
                        }
                        requestTranscriptEvidenceReview(
                            'Auto transcript evidence extracted from your input URLs. Please verify correctness before continuing.',
                            rawVideoFactSheet,
                            transcriptEvidenceUrls.length > 0 ? transcriptEvidenceUrls : videoUrls,
                            transcriptSources,
                        );
                        return;
                    } else {
                        if (!strictVideoMode) {
                            qualityIssues.push('Transcript extraction did not return strict NotebookLM video-url-only evidence format.');
                        }
                        if (!hasInputCoverage) {
                            qualityIssues.push('Transcript extraction result did not cover all input video URLs.');
                        }
                        const directReady = await tryDirectGeminiVideoEvidence(
                            'Strict transcript extraction failed. Direct Gemini URL analysis needs your confirmation.',
                        );
                        if (directReady) return;
                        const fallbackReady = await tryAutoWebFallbackEvidence(
                            backends.cloud ? 'cloud' : 'local',
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
                    updateProgress(1, 24, lang === 'zh' ? 'Connecting to NotebookLM...' : 'Connecting to NotebookLM...', stages);
                    const backends = await checkBackends();
                    if (!backends.local) {
                        let retryBackends = backends;
                        // eslint-disable-next-line no-constant-condition
                        while (true) {
                            const fbTitle = lang === 'zh' ? 'Local NotebookLM unavailable' : 'Local NotebookLM unavailable';
                            const fbDetail = lang === 'zh'
                                ? `Notebook "${levelEntry.notebookId}" requires local dev:nlm. Switch to fallback mode?`
                                : `Notebook "${levelEntry.notebookId}" requires local dev:nlm. Switch to fallback mode?`;
                            const choice = await askFallbackConfirm(fbTitle, fbDetail);
                            if (choice === 'cancel') throw new Error('AbortError');
                            if (choice === 'retry') {
                                updateProgress(1, 28, lang === 'zh' ? 'Retrying NLM proxy connection...' : 'Retrying NLM proxy connection...', stages);
                                retryBackends = await checkBackends();
                                if (retryBackends.local) break; // proxy is back, continue normal flow
                                continue; // still down, show prompt again
                            }
                            // choice === 'continue' → fallback
                            qualityIssues.push(`Fallback: ${fbTitle} - ${fbDetail}`);
                            updateProgress(2, 40, lang === 'zh' ? 'NotebookLM unavailable, switching to fallback...' : 'NotebookLM unavailable, switching to fallback...', stages);
                            throw new Error('LOCAL_NOTEBOOK_BACKEND_UNAVAILABLE');
                        }
                    }

                    const backend = 'local';

                    // Ensure resource guide exists in notebook before RAG query
                    updateProgress(
                        2,
                        35,
                        lang === 'zh' ? 'Checking resource guide...' : 'Checking resource guide...',
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
                            ? `Connected to ${backend}, analyzing notebook sources...`
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
                        updateProgress(2, 62, lang === 'zh' ? 'Notebook sources grounded, generating lesson kit...' : 'Notebook sources grounded, generating lesson kit...', stages);
                    } else {
                        groundingStatus = 'unverified';
                        const fbTitle = lang === 'zh' ? 'No notebook fact sheet extracted' : 'No notebook fact sheet extracted';
                        const fbDetail = lang === 'zh'
                            ? `Connected to notebook "${knowledgeNotebookId || levelEntry.notebookId}", but no usable fact sheet was returned (${rag.sources.length} source(s), ${rag.validUrls.length} URL). Continue with fallback?`
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
                        const fbTitle = lang === 'zh' ? 'NotebookLM request failed' : 'NotebookLM request failed';
                        const fbDetail = lang === 'zh'
                            ? `Notebook request failed: ${ragError?.message || 'Unknown error'}. Continue with level standard?`
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
                    lang === 'zh' ? 'Analyzing uploaded or typed materials...' : 'Analyzing uploaded or typed materials...',
                    stages,
                );
            }

            const mergedFactSheet = [
                factSheet,
                videoFactSheet ? `[Video Content Evidence]\n${videoFactSheet}` : undefined,
            ].filter(Boolean).join('\n\n---\n\n') || undefined;

            const generationStage = sourceMode === 'direct' ? 2 : 3;
            updateProgress(generationStage, 78, lang === 'zh' ? 'Generating lesson kit content...' : 'Generating lesson kit content...', stages);

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
                    videoEvidenceMode,
                    customStages,
                },
            );

            // Fix A: Save generation context for Phase 2
            lessonContent.ageGroup = ageGroup;
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
            updateProgress(finalizeStage, 96, lang === 'zh' ? 'Finalizing structured output...' : 'Finalizing structured output...', stages);
            // Preserve the user's custom prompt for display/copy
            if (text?.trim()) lessonContent.inputPrompt = text.trim();
            setState({ isLoading: false, generatedContent: lessonContent, error: null });
            setManualVideoEvidence('');
            updateProgress(finalizeStage, 100, lang === 'zh' ? 'Lesson plan ready - review and generate supporting content.' : 'Lesson plan ready - review and generate supporting content.', stages);
        } catch (error: any) {
            if (error.name === 'AbortError' || error.message === 'AbortError' || error.message === 'Operation aborted') {
                updateProgress(0, 0, lang === 'zh' ? 'Generation aborted' : 'Generation aborted', stages);
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
                ? ` (${videoGroundingSummary.urlCount} input URL(s), ${videoGroundingSummary.evidenceUrlCount} evidence URL(s))`
                : ` (${videoGroundingSummary.urlCount} input URL(s), ${videoGroundingSummary.evidenceUrlCount} evidence URL(s))`)
            : (lang === 'zh'
                ? ` (${videoGroundingSummary.urlCount} video URL(s))`
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
            req.customStages,
            manualVideoEvidence.trim(),
            undefined,
            undefined,
            'manual',
        );
    };

    const handleConfirmTranscriptEvidenceSubmit = async () => {
        if (!pendingGenerationRequest || !videoTranscriptEvidenceReview || !manualVideoEvidence.trim()) return;
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
            req.customStages,
            manualVideoEvidence.trim(),
            videoTranscriptEvidenceReview.evidenceUrls,
            videoTranscriptEvidenceReview.sources,
            'manual',
            'normal',
        );
    };

    const handleTranscriptEvidenceSearchFallback = async () => {
        if (!pendingGenerationRequest || !videoTranscriptEvidenceReview) return;
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
            req.customStages,
            undefined,
            undefined,
            undefined,
            'manual',
            'force_fallback_search',
        );
    };

    const handleCancelTranscriptEvidenceReview = () => {
        if (!videoTranscriptEvidenceReview) return;
        setVideoTranscriptEvidenceReview(null);
        setManualVideoEvidence('');
        setVideoGroundingSummary({
            status: 'unavailable',
            message: 'Transcript review canceled. Generation stopped.',
            urlCount: videoTranscriptEvidenceReview.inputUrls.length,
        });
        setState(prev => ({ ...prev, isLoading: false }));
        updateProgress(0, 0, 'Generation canceled at transcript review.');
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
            req.customStages,
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
                ? 'Fallback evidence was rejected. Paste manual transcript/key points to continue.'
                : 'Fallback evidence was rejected. Paste manual transcript/key points to continue.',
        });
        setVideoGroundingSummary({
            status: 'unavailable',
            message: lang === 'zh'
                ? 'Fallback evidence rejected. Manual transcript/key points required.'
                : 'Fallback evidence rejected. Manual transcript/key points required.',
            urlCount: videoFallbackEvidenceReview.inputUrls.length,
        });
        setVideoFallbackEvidenceReview(null);
        setManualVideoEvidence('');
    };

    const renderVideoTranscriptEvidenceReviewPanel = () => {
        if (!videoTranscriptEvidenceReview || state.generatedContent) return null;
        const previewItems = parseVideoUrlEvidencePreview(
            manualVideoEvidence || videoTranscriptEvidenceReview.factSheet,
            videoTranscriptEvidenceReview.inputUrls,
        );
        return (
            <div className="mb-4 rounded-lg border border-sky-300 bg-sky-50 p-4">
                <p className="text-sm font-semibold text-sky-900">
                    Transcript evidence review required before generation
                </p>
                <p className="mt-1 text-xs text-sky-800">{videoTranscriptEvidenceReview.reason}</p>
                <p className="mt-2 text-xs text-sky-800">
                    Input video URL(s):
                </p>
                <ul className="mt-1 list-disc pl-5 text-xs text-sky-900">
                    {videoTranscriptEvidenceReview.inputUrls.map((url) => (
                        <li key={url} className="break-all">{url}</li>
                    ))}
                </ul>
                <p className="mt-2 text-xs text-sky-800">
                    Extracted evidence URL(s):
                </p>
                <ul className="mt-1 max-h-24 list-disc overflow-auto pl-5 text-xs text-sky-900">
                    {videoTranscriptEvidenceReview.evidenceUrls.map((url) => (
                        <li key={url} className="break-all">{url}</li>
                    ))}
                </ul>
                {previewItems.length > 0 && (
                    <div className="mt-3 rounded-md border border-sky-200 bg-white/80 p-3">
                        <p className="text-xs font-semibold text-sky-900">
                            URL-by-URL extracted evidence preview
                        </p>
                        <div className="mt-2 space-y-2">
                            {previewItems.map((item) => (
                                <div key={item.inputUrl} className="rounded-md border border-sky-100 bg-sky-50/40 p-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <a
                                            href={item.inputUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="max-w-full break-all text-xs font-medium text-sky-900 underline"
                                        >
                                            {item.inputUrl}
                                        </a>
                                        <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${item.status === 'ready' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                            {item.status === 'ready' ? 'READY' : 'UNAVAILABLE'}
                                        </span>
                                    </div>
                                    {item.sourceUrl && (
                                        <p className="mt-1 break-all text-[11px] text-slate-700">
                                            source: {item.sourceUrl}
                                            {typeof item.charCount === 'number' ? ` (char_count=${item.charCount})` : ''}
                                        </p>
                                    )}
                                    {item.reason && (
                                        <p className="mt-1 break-all text-[11px] text-rose-700">
                                            reason: {item.reason}
                                        </p>
                                    )}
                                    {item.excerpt && (
                                        <div className="mt-1 rounded border border-slate-200 bg-white p-2 text-[11px] leading-5 text-slate-800">
                                            {item.excerpt}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                <textarea
                    value={manualVideoEvidence}
                    onChange={(event) => setManualVideoEvidence(event.target.value)}
                    placeholder="Review extracted transcript/key points. Edit if needed before continue."
                    className="mt-3 w-full rounded-md border border-sky-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                    rows={8}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={handleConfirmTranscriptEvidenceSubmit}
                        disabled={state.isLoading || !manualVideoEvidence.trim()}
                        className="rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Confirm and continue
                    </button>
                    <button
                        type="button"
                        onClick={handleTranscriptEvidenceSearchFallback}
                        disabled={state.isLoading}
                        className="rounded-md border border-sky-400 px-3 py-2 text-sm font-medium text-sky-900 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        This is wrong - find evidence URL
                    </button>
                    <button
                        type="button"
                        onClick={handleCancelTranscriptEvidenceReview}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        );
    };

    const renderVideoFallbackEvidenceReviewPanel = () => {
        if (!videoFallbackEvidenceReview || state.generatedContent) return null;
        return (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">
                    {lang === 'zh'
                        ? 'Fallback lyric/transcript evidence found. Confirm before generation'
                        : 'Fallback lyric/transcript evidence found. Confirm before generation'}
                </p>
                <p className="mt-1 text-xs text-amber-800">{videoFallbackEvidenceReview.reason}</p>
                <p className="mt-2 text-xs text-amber-800">
                    {lang === 'zh' ? 'Input video URL(s):' : 'Input video URL(s):'}
                </p>
                <ul className="mt-1 list-disc pl-5 text-xs text-amber-900">
                    {videoFallbackEvidenceReview.inputUrls.map((url) => (
                        <li key={url} className="break-all">{url}</li>
                    ))}
                </ul>
                <p className="mt-2 text-xs text-amber-800">
                    {lang === 'zh' ? 'Auto-found evidence URL(s) for review:' : 'Auto-found evidence URL(s) for review:'}
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
                        ? 'Review/edit extracted lyrics or key points before continuing...'
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
                        {lang === 'zh' ? 'Confirm evidence and continue' : 'Confirm evidence and continue'}
                    </button>
                    <button
                        type="button"
                        onClick={handleRejectFallbackEvidence}
                        className="rounded-md border border-amber-400 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100"
                    >
                        {lang === 'zh' ? 'Reject fallback evidence' : 'Reject fallback evidence'}
                    </button>
                </div>
            </div>
        );
    };

    const renderVideoTranscriptRequestPanel = () => {
        if (!videoTranscriptRequest || videoFallbackEvidenceReview || videoTranscriptEvidenceReview || state.generatedContent) return null;
        return (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">
                    {lang === 'zh'
                        ? 'Manual transcript/key points required to continue'
                        : 'Manual transcript/key points required to continue'}
                </p>
                <p className="mt-1 text-xs text-amber-800">
                    {videoTranscriptRequest.reason}
                </p>
                <p className="mt-2 text-xs text-amber-800">
                    {lang === 'zh' ? 'Accepted input URL(s) only:' : 'Accepted input URL(s) only:'}
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
                        ? 'Paste transcript, or provide key lines/TPR cues/vocabulary points...'
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
                        {lang === 'zh' ? 'Continue with manual evidence' : 'Continue with manual evidence'}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setVideoTranscriptRequest(null);
                            setManualVideoEvidence('');
                        }}
                        className="rounded-md border border-amber-400 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100"
                    >
                        {lang === 'zh' ? 'Cancel' : 'Cancel'}
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
                    {renderVideoTranscriptEvidenceReviewPanel()}
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

                    <OutputDisplay key={activeLessonId || 'new'} content={state.generatedContent} autoSaveEnabled={isActive} onSave={(c) => {
                        // Update local state so UI re-renders (critical for Phase 2 -> tab unlock)
                        setState(prev => ({ ...prev, generatedContent: c }));
                        onSaveLesson(c);
                    }} />
                </div>
            )}
        </>
    );
};


