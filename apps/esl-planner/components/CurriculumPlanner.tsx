import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';

import {
    Upload, FileText, BookOpen, Users, GraduationCap,
    ArrowRight, Loader2, Sparkles, Clock, ListOrdered,
    Edit3, Target, MessageSquare, X, ChevronDown, ChevronUp, Save, ArrowLeft,
    Rocket, Square, CheckCircle2, AlertCircle, ExternalLink
} from 'lucide-react';
import { CEFRLevel, ESLCurriculum, CurriculumLesson, CurriculumParams, SavedLesson, SavedCurriculum } from '../types';
import { generateESLCurriculum } from '../services/curriculumService';
import { safeStorage } from '@shared/safeStorage';
import { extractPdfText as extractPdfTextShared } from '@shared/utils/pdf';
import { useLanguage } from '../i18n/LanguageContext';
import { formatLessonDisplayName } from '../utils/curriculumMapper';
import { GenerationProgress } from '@shared/components/GenerationProgress';
import { FallbackPrompt } from '@shared/components/FallbackPrompt';
import { CurriculumReviewPanel } from './CurriculumReviewPanel';
import { useAutoSave } from '@shared/hooks/useAutoSave';
import { useFallbackConfirm } from '@shared/hooks/useFallbackConfirm';
import {
    listSelectableTextbookLevels,
    groupTextbookLevelOptionViews,
    buildTextbookLevelOptionViews,
    findTextbookLevelEntry,
    type TextbookLevelGroupView,
    type TextbookLevelOptionView,
} from '@shared/config/eslAssessmentRegistry';
import { useNotebookLMRAG } from '@pathway/notebooklm';
import {
    OTHER_TEXTBOOK_ID,
    getCustomTextbookLevelLabel,
    isCustomTextbookLevelKey,
    listCustomTextbookLevelOptions,
} from '../utils/customTextbookLevels';
import { getCitationTooltip } from '../utils/citationTooltip';

interface CurriculumPlannerProps {
    onGenerateKit: (lesson: CurriculumLesson, params: CurriculumParams, curriculum?: ESLCurriculum, curriculumId?: string) => void;
    onSaveCurriculum?: (curriculum: ESLCurriculum, params: CurriculumParams) => void | Promise<unknown>;
    loadedCurriculum?: { curriculum: ESLCurriculum; params: CurriculumParams } | null;
    savedLessons?: SavedLesson[];
    savedCurricula?: SavedCurriculum[];
    onBatchGenerate?: (lessons: CurriculumLesson[], params: CurriculumParams, curriculum?: ESLCurriculum) => void;
    onCancelBatch?: () => void;
    batchStatus?: Record<number, 'idle' | 'generating' | 'done' | 'error'>;
    batchLessonMap?: Record<number, string>;
    batchRunning?: boolean;
    batchProgress?: { done: number; total: number; errors: number };
    onOpenKit?: (savedLessonId: string) => void;
}

const STORAGE_KEY = 'esl-planner-curriculum';
type CurriculumGenerationProgress = {
    stage: number;
    percent: number;
    statusText: string;
};
type GenerationSourceMode = 'notebook' | 'direct';
type GroundingBanner = {
    kind: 'connected' | 'fallback' | 'custom';
    title: string;
    detail: string;
};

export const CurriculumPlanner: React.FC<CurriculumPlannerProps> = ({
    onGenerateKit, onSaveCurriculum, loadedCurriculum,
    savedLessons = [], savedCurricula = [],
    onBatchGenerate, onCancelBatch, batchStatus = {}, batchLessonMap = {},
    batchRunning = false, batchProgress = { done: 0, total: 0, errors: 0 }, onOpenKit
}) => {
    // PDF state
    const { t, lang } = useLanguage();
    const { startRAG, checkBackends, ensureResourceGuide, readResourceGuide } = useNotebookLMRAG();
    const { pendingFallback, askFallbackConfirm, handleFallbackChoice, resetFallback } = useFallbackConfirm();
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [pdfText, setPdfText] = useState('');
    const [pdfPageCount, setPdfPageCount] = useState(0);
    const [extracting, setExtracting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Config state
    const [lessonCount, setLessonCount] = useState(40);
    const [level, setLevel] = useState<CEFRLevel>(CEFRLevel.Beginner);
    const [duration, setDuration] = useState('90');
    const [studentCount, setStudentCount] = useState('6');
    const [slideCount, setSlideCount] = useState(20);
    const [customInstructions, setCustomInstructions] = useState('');
    const [sourceMode, setSourceMode] = useState<GenerationSourceMode>('notebook');
    const [textbookLevelKey, setTextbookLevelKey] = useState('');
    const [textbookId, setTextbookId] = useState('');
    const textbookLevels = listSelectableTextbookLevels();
    const textbookGroupsBase = useMemo(() => groupTextbookLevelOptionViews(textbookLevels), [textbookLevels]);
    const textbookOptionsBase = useMemo(() => buildTextbookLevelOptionViews(textbookLevels), [textbookLevels]);
    const customLevelOptions = useMemo<TextbookLevelOptionView[]>(
        () =>
            listCustomTextbookLevelOptions().map((item) => ({
                levelKey: item.levelKey,
                status: 'ready',
                textbookId: OTHER_TEXTBOOK_ID,
                textbookName: lang === 'zh' ? 'Other（其他教材）' : 'Other',
                volumeLabel: item.label,
                levelLabel: item.label,
                levelDisplayName: item.label,
            })),
        [lang],
    );
    const textbookGroups = useMemo<TextbookLevelGroupView[]>(
        () => [
            ...textbookGroupsBase,
            {
                textbookId: OTHER_TEXTBOOK_ID,
                textbookName: lang === 'zh' ? 'Other（其他教材）' : 'Other',
                options: customLevelOptions,
            },
        ],
        [customLevelOptions, lang, textbookGroupsBase],
    );
    const textbookOptions = useMemo<TextbookLevelOptionView[]>(
        () => [...textbookOptionsBase, ...customLevelOptions],
        [customLevelOptions, textbookOptionsBase],
    );
    const activeTextbookGroup = useMemo(
        () => textbookGroups.find((group) => group.textbookId === textbookId) || null,
        [textbookGroups, textbookId],
    );

    // Result state
    const [loading, setLoading] = useState(false);
    const [curriculum, setCurriculum] = useState<ESLCurriculum | null>(null);
    const [savedParams, setSavedParams] = useState<CurriculumParams | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [expandedLessons, setExpandedLessons] = useState<Set<number>>(new Set());
    const [isSaved, setIsSaved] = useState(false);
    const [groundingBanner, setGroundingBanner] = useState<GroundingBanner | null>(null);
    const progressStages = useMemo(
        () => (lang === 'zh'
            ? ['校验参数', '连接 NotebookLM', '分析笔记资料', '提炼教学锚点', '生成课程大纲', '整理结构结果']
            : ['Validate input', 'Connect NotebookLM', 'Analyze notebook sources', 'Extract teaching anchors', 'Generate curriculum', 'Finalize structured output']),
        [lang],
    );
    const [generationProgress, setGenerationProgress] = useState<CurriculumGenerationProgress>({
        stage: 0,
        percent: 0,
        statusText: lang === 'zh' ? '准备开始...' : 'Preparing...',
    });
    const updateGenerationProgress = useCallback((stage: number, percent: number, statusText?: string) => {
        const fallbackStages = sourceMode === 'direct'
            ? (lang === 'zh'
                ? ['校验参数', '分析上传/输入资料', '提炼教学锚点', '生成课程大纲', '整理结构结果']
                : ['Validate input', 'Analyze provided materials', 'Extract teaching anchors', 'Generate curriculum', 'Finalize structured output'])
            : progressStages;
        const fallback = fallbackStages[Math.max(0, Math.min(stage, fallbackStages.length - 1))] || '';
        setGenerationProgress({
            stage,
            percent,
            statusText: statusText || fallback,
        });
    }, [lang, progressStages, sourceMode]);
    const resolvedTextbookLevelKey = savedParams?.textbookLevelKey || textbookLevelKey || '';
    const missingTextbookLevelKey = !resolvedTextbookLevelKey;
    const displaySeriesName = useMemo(() => {
        if (!curriculum) return '';
        const cleanedTitle = (curriculum.textbookTitle || '')
            .replace(/\s*Student(?:'|\u2019)?s?\s*Book/gi, '')
            .trim();
        return (curriculum.seriesName || cleanedTitle || curriculum.textbookTitle || '').trim();
    }, [curriculum]);
    const displayTextbookLevel = useMemo(() => {
        if (!curriculum) return '';
        const levelFromRegistry = textbookLevels.find((item) => item.levelKey === resolvedTextbookLevelKey)?.displayName;
        const customLevel = getCustomTextbookLevelLabel(resolvedTextbookLevelKey);
        return (levelFromRegistry || customLevel || curriculum.targetLevel || '').trim();
    }, [curriculum, textbookLevels, resolvedTextbookLevelKey]);
    const getCurriculumCitationTitle = useCallback((section: string, text: string) => {
        return getCitationTooltip(curriculum?.sentenceCitations, section, text);
    }, [curriculum?.sentenceCitations]);

    // Restore from localStorage
    useEffect(() => {
        const saved = safeStorage.get<{ curriculum?: ESLCurriculum; params?: CurriculumParams }>(STORAGE_KEY, {});
        if (saved.curriculum) setCurriculum(saved.curriculum);
        if (saved.params) {
            setSavedParams(saved.params);
            setLessonCount(saved.params.lessonCount || 6);
            setLevel(saved.params.level || CEFRLevel.A1);
            setDuration(saved.params.duration || '90');
            setStudentCount(saved.params.studentCount || '12');
            setSlideCount(saved.params.slideCount || 15);
            setCustomInstructions(saved.params.customInstructions || '');
            setSourceMode(saved.params.sourceMode || 'notebook');
            setTextbookLevelKey(saved.params.textbookLevelKey || '');
        }
    }, []);

    useEffect(() => {
        if (!textbookGroups.length) return;
        if (!textbookId) {
            setTextbookId(textbookGroups[0].textbookId);
            return;
        }
        const valid = textbookGroups.some((group) => group.textbookId === textbookId);
        if (!valid) {
            setTextbookId(textbookGroups[0].textbookId);
        }
    }, [textbookGroups, textbookId]);

    useEffect(() => {
        const key = savedParams?.textbookLevelKey || textbookLevelKey;
        if (!key) return;
        if (isCustomTextbookLevelKey(key)) {
            if (textbookId !== OTHER_TEXTBOOK_ID) setTextbookId(OTHER_TEXTBOOK_ID);
            return;
        }
        const selected = textbookOptions.find((item) => item.levelKey === key);
        if (selected && selected.textbookId !== textbookId) {
            setTextbookId(selected.textbookId);
        }
    }, [savedParams?.textbookLevelKey, textbookLevelKey, textbookId, textbookOptions]);

    useEffect(() => {
        if (!activeTextbookGroup?.options?.length) return;
        const currentKey = savedParams?.textbookLevelKey || textbookLevelKey;
        const stillValid = activeTextbookGroup.options.some((item) => item.levelKey === currentKey);
        if (!stillValid) {
            const nextKey = activeTextbookGroup.options[0].levelKey;
            setTextbookLevelKey(nextKey);
            setSavedParams((prev) => (prev ? { ...prev, textbookLevelKey: nextKey } : prev));
        }
    }, [activeTextbookGroup, savedParams, textbookLevelKey]);

    // Load curriculum from Records
    useEffect(() => {
        if (loadedCurriculum) {
            setCurriculum(loadedCurriculum.curriculum);
            setSavedParams(loadedCurriculum.params);
            setLessonCount(loadedCurriculum.params.lessonCount);
            setLevel(loadedCurriculum.params.level);
            setDuration(loadedCurriculum.params.duration);
            setStudentCount(loadedCurriculum.params.studentCount);
            setSlideCount(loadedCurriculum.params.slideCount);
            setCustomInstructions(loadedCurriculum.params.customInstructions || '');
            setSourceMode(loadedCurriculum.params.sourceMode || 'notebook');
            setTextbookLevelKey(loadedCurriculum.params.textbookLevelKey || '');
            setIsSaved(true);
        }
    }, [loadedCurriculum]);

    // Auto-save to localStorage
    useEffect(() => {
        if (curriculum) {
            safeStorage.set(STORAGE_KEY, {
                curriculum,
                params: savedParams,
                timestamp: Date.now(),
            });
        }
    }, [curriculum, savedParams]);

    // Auto-save curriculum to Records (debounced)
    const autoSaveGetParams = useCallback((): CurriculumParams => ({
        lessonCount, level, duration, studentCount, slideCount, customInstructions, textbookLevelKey, sourceMode
    }), [lessonCount, level, duration, studentCount, slideCount, customInstructions, textbookLevelKey, sourceMode]);

    const getCurriculumContent = useCallback(() => {
        return { curriculum: curriculum!, params: savedParams || autoSaveGetParams() };
    }, [curriculum, savedParams, autoSaveGetParams]);

    const { saveStatus: curriculumSaveStatus } = useAutoSave({
        getCurrentContentObject: getCurriculumContent,
        onSave: (data: { curriculum: ESLCurriculum; params: CurriculumParams }) => {
            onSaveCurriculum?.(data.curriculum, data.params);
        },
        editablePlan: (onSaveCurriculum && curriculum && isSaved) ? curriculum : null,
        debounceMs: 5000,
    });

    // PDF text extraction using shared utility
    const extractPdfTextLocal = async (file: File) => {
        setExtracting(true);
        try {
            const { text, pageCount } = await extractPdfTextShared(file);
            setPdfPageCount(pageCount);
            setPdfText(text);
        } catch (err: any) {
            console.error('PDF extraction failed:', err);
            setErrorMsg(`PDF parsing failed: ${err.message || 'Unknown error'}`);
        } finally {
            setExtracting(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type === 'application/pdf') {
            setPdfFile(file);
            setPdfText('');
            setPdfPageCount(0);
            extractPdfTextLocal(file);
        }
    };

    const removePdf = () => {
        setPdfFile(null);
        setPdfText('');
        setPdfPageCount(0);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const getCurrentParams = (): CurriculumParams => ({
        lessonCount,
        level,
        duration,
        studentCount,
        slideCount,
        customInstructions,
        textbookLevelKey,
        sourceMode,
    });

    const handleResultTextbookLevelChange = (nextLevelKey: string) => {
        setTextbookLevelKey(nextLevelKey);
        setSavedParams((prev) => {
            if (prev) {
                return { ...prev, textbookLevelKey: nextLevelKey };
            }
            return {
                lessonCount,
                level,
                duration,
                studentCount,
                slideCount,
                customInstructions,
                textbookLevelKey: nextLevelKey,
                sourceMode,
            };
        });
        if (nextLevelKey && errorMsg) {
            setErrorMsg(null);
        }
    };

    const handleTextbookChange = (nextTextbookId: string) => {
        setTextbookId(nextTextbookId);
        const nextGroup = textbookGroups.find((group) => group.textbookId === nextTextbookId);
        const fallbackLevelKey = nextGroup?.options?.[0]?.levelKey || '';
        const stillValid = textbookOptions.some(
            (item) => item.levelKey === textbookLevelKey && item.textbookId === nextTextbookId,
        );
        if (!stillValid) setTextbookLevelKey(fallbackLevelKey);
    };

    const handleResultTextbookChange = (nextTextbookId: string) => {
        setTextbookId(nextTextbookId);
        const nextGroup = textbookGroups.find((group) => group.textbookId === nextTextbookId);
        const fallbackLevelKey = nextGroup?.options?.[0]?.levelKey || '';
        const stillValid = textbookOptions.some(
            (item) => item.levelKey === resolvedTextbookLevelKey && item.textbookId === nextTextbookId,
        );
        if (!stillValid) {
            handleResultTextbookLevelChange(fallbackLevelKey);
        }
    };

    const handleStopGenerate = () => {
        resetFallback();
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setLoading(false);
        setErrorMsg('Generation cancelled.');
        updateGenerationProgress(0, 0, lang === 'zh' ? '已取消生成。' : 'Generation cancelled.');
    };

    const handleGenerate = async () => {
        setLoading(true);
        setErrorMsg(null);
        setCurriculum(null);
        setGroundingBanner(null);
        abortControllerRef.current = new AbortController();
        updateGenerationProgress(0, 8, lang === 'zh' ? '正在校验参数并准备任务...' : 'Validating inputs and preparing task...');
        try {
            const params = getCurrentParams();
            const normalizedLevelKey = textbookLevelKey?.trim() || '';
            if (!normalizedLevelKey) {
                throw new Error(lang === 'zh' ? '请先选择级别（Level）。' : 'Please select Level before generating.');
            }
            const selectedTextbookName = textbookGroups.find((group) => group.textbookId === textbookId)?.textbookName || textbookId || 'Unknown';
            const sourceText = (pdfText || '').trim()
                ? pdfText
                : [
                    'No PDF textbook content was uploaded.',
                    'Generate a practical curriculum framework using the selected textbook and level as the primary anchor.',
                    `Selected Textbook: ${selectedTextbookName}`,
                    `Selected Level Key: ${normalizedLevelKey}`,
                    customInstructions ? `Teacher Instructions: ${customInstructions}` : '',
                ].filter(Boolean).join('\n');
            const customLevelLabel = getCustomTextbookLevelLabel(normalizedLevelKey);
            const levelEntry = normalizedLevelKey && !isCustomTextbookLevelKey(normalizedLevelKey)
                ? findTextbookLevelEntry(normalizedLevelKey)
                : undefined;
            if (normalizedLevelKey && !customLevelLabel && !levelEntry) {
                throw new Error(`Unknown textbook-level standard "${normalizedLevelKey}". Please re-select and try again.`);
            }

            let groundingFactSheet: string | undefined;
            let groundingUrls: string[] | undefined;
            let knowledgeNotebookId: string | undefined = sourceMode === 'notebook' ? (levelEntry?.notebookId || undefined) : undefined;
            let groundingSources: Array<{ id?: string; title?: string; url?: string; status?: string; type?: string }> | undefined;

            if (sourceMode === 'notebook' && levelEntry && !levelEntry.notebookId) {
                const fbTitle = lang === 'zh' ? '未配置 Notebook 映射' : 'Notebook mapping missing';
                const fbDetail = lang === 'zh'
                    ? `当前主线级别 ${levelEntry.displayName} 没有关联 notebookId，是否按级别标准降级生成？`
                    : `Mainline level ${levelEntry.displayName} has no notebookId mapping. Continue with level-only mode?`;
                const choice = await askFallbackConfirm(fbTitle, fbDetail);
                if (choice === 'cancel') throw new Error('AbortError');
                setGroundingBanner({ kind: 'fallback', title: fbTitle, detail: fbDetail });
            } else if (sourceMode === 'notebook' && levelEntry?.notebookId) {
                updateGenerationProgress(1, 20, lang === 'zh' ? '正在连接 NotebookLM...' : 'Connecting to NotebookLM...');
                try {
                    const backends = await checkBackends();
                    if (!backends.local) {
                        const fbTitle = lang === 'zh' ? '本地 NotebookLM 未连接' : 'Local NotebookLM unavailable';
                        const fbDetail = lang === 'zh'
                            ? `主线级别 ${levelEntry.displayName} 绑定 notebook ${levelEntry.notebookId}，需使用本地 dev:nlm 才能命中该笔记。请先运行 npm run dev:nlm。是否改用 fallback 无笔记模式继续生成？`
                            : `Mainline level ${levelEntry.displayName} is bound to notebook ${levelEntry.notebookId}. Local dev:nlm is required. Switch to fallback mode?`;
                        const choice = await askFallbackConfirm(fbTitle, fbDetail);
                        if (choice === 'cancel') throw new Error('AbortError');
                        setGroundingBanner({ kind: 'fallback', title: fbTitle, detail: fbDetail });
                        throw new Error('LOCAL_NOTEBOOK_BACKEND_UNAVAILABLE');
                    }
                    const backend = 'local';

                    // Ensure resource guide exists in notebook before RAG query
                    updateGenerationProgress(
                        2,
                        25,
                        lang === 'zh' ? '正在检查资源调用指南...' : 'Checking resource guide...',
                    );
                    const guideResult = await ensureResourceGuide(levelEntry.notebookId!, {
                        level: params.level,
                        duration: params.duration,
                        studentCount: params.studentCount,
                        lessonCount: params.lessonCount,
                        customInstructions: params.customInstructions,
                    });
                    if (guideResult.status === 'created') {
                        console.log('[curriculum] Resource guide created:', guideResult.sourceId);
                    } else if (guideResult.status === 'error') {
                        console.warn('[curriculum] Resource guide failed (non-blocking):', guideResult.error);
                    }

                    updateGenerationProgress(
                        3,
                        38,
                        lang === 'zh'
                            ? '正在读取资源调用指南全文...'
                            : 'Reading Resource Guide for curriculum grounding...',
                    );

                    // --- Two-Layer Grounding: Curriculum uses Resource Guide directly ---
                    // The Resource Guide is a structured index pre-generated from all PDF sources.
                    // Reading it directly is more reliable than NLM search for curriculum scope/sequence.
                    const guideRead = await readResourceGuide(levelEntry.notebookId!);
                    knowledgeNotebookId = levelEntry.notebookId || undefined;

                    if (guideRead.status === 'ok' && guideRead.content) {
                        groundingFactSheet = guideRead.content;
                        console.log(`[curriculum] Resource Guide loaded: ${guideRead.content.length} chars`);
                        setGroundingBanner({
                            kind: 'connected',
                            title: lang === 'zh' ? '资源调用指南已加载' : 'Resource Guide loaded',
                            detail: lang === 'zh'
                                ? `已从 notebook ${knowledgeNotebookId} 直接读取资源调用指南（${guideRead.content.length} 字符），用于课程大纲 grounding。`
                                : `Loaded Resource Guide (${guideRead.content.length} chars) from notebook ${knowledgeNotebookId} for curriculum grounding.`,
                        });
                    } else {
                        console.warn('[curriculum] Resource Guide not available, falling back to NLM query');
                        // Fallback: try NLM query if Resource Guide is missing
                        const rag = await startRAG(
                            `Curriculum grounding for ${levelEntry.displayName}.`,
                            [
                                `Using ONLY the notebook sources, provide a comprehensive curriculum fact sheet for "${levelEntry.displayName}" with:
- Textbook title, total units, unit structure (Trail 1 + Trail 2)
- For each unit: vocabulary lists, grammar points, phonics targets, reading texts (separately for Trail 1 and Trail 2)
- Review lesson schedule
If sources are missing, include the marker: NO_USABLE_SOURCE.`,
                            ],
                            backend,
                            {
                                notebookId: levelEntry.notebookId || undefined,
                                tolerateErrors: true,
                                allowEmptyFactSheets: true,
                            },
                        );

                        groundingFactSheet = rag.factSheets.get(0)?.content;
                        groundingUrls = rag.validUrls;
                        groundingSources = rag.sources;
                        knowledgeNotebookId = rag.notebookId || levelEntry.notebookId || undefined;
                        const hasNoUsableSourceMarker = /NO_USABLE_SOURCE/i.test(groundingFactSheet || '');
                        if (hasNoUsableSourceMarker) {
                            groundingFactSheet = undefined;
                        }

                        if (groundingFactSheet) {
                            setGroundingBanner({
                                kind: 'connected',
                                title: lang === 'zh' ? 'NotebookLM 查询已命中' : 'NotebookLM query matched',
                                detail: lang === 'zh'
                                    ? `通过 NLM 查询获取了 grounding 数据（Resource Guide 不可用作为回退）。`
                                    : `Grounding data retrieved via NLM query (Resource Guide unavailable, used as fallback).`,
                            });
                        } else {
                            const fbTitle = lang === 'zh' ? '未提取到笔记事实表' : 'No notebook fact sheet extracted';
                            const fbDetail = lang === 'zh'
                                ? `已连接 notebook ${knowledgeNotebookId || levelEntry.notebookId}，但 Resource Guide 和 NLM 查询均未返回可用数据。是否使用 fallback 模式？`
                                : `Connected to notebook ${knowledgeNotebookId || levelEntry.notebookId}, but neither Resource Guide nor NLM query returned usable data. Continue with fallback?`;
                            const choice = await askFallbackConfirm(fbTitle, fbDetail);
                            if (choice === 'cancel') throw new Error('AbortError');
                            setGroundingBanner({ kind: 'fallback', title: fbTitle, detail: fbDetail });
                        }
                    }

                    updateGenerationProgress(
                        3,
                        60,
                        lang === 'zh'
                            ? '已提炼教材笔记关键点，正在构建教学锚点...'
                            : 'Notebook insights extracted, building teaching anchors...',
                    );
                } catch (ragError: any) {
                    if (ragError.message === 'AbortError') throw ragError;
                    // Curriculum generation remains available even when RAG is unavailable.
                    if (!String(ragError?.message || '').includes('LOCAL_NOTEBOOK_BACKEND_UNAVAILABLE')) {
                        const fbTitle = lang === 'zh' ? 'NotebookLM 调用失败' : 'NotebookLM request failed';
                        const fbDetail = lang === 'zh'
                            ? `级别 ${levelEntry.displayName} notebook 调用失败：${ragError?.message || '未知错误'}。是否使用级别标准继续生成？`
                            : `Notebook request failed for ${levelEntry.displayName}: ${ragError?.message || 'Unknown error'}. Continue with level standard?`;
                        const choice = await askFallbackConfirm(fbTitle, fbDetail);
                        if (choice === 'cancel') throw new Error('AbortError');
                        setGroundingBanner({ kind: 'fallback', title: fbTitle, detail: fbDetail });
                    }
                    updateGenerationProgress(
                        3,
                        56,
                        lang === 'zh'
                            ? 'NotebookLM 暂不可用，改用级别标准继续生成。'
                            : 'NotebookLM unavailable, continuing with level standard.',
                    );
                }
            } else if (sourceMode === 'notebook') {
                updateGenerationProgress(
                    2,
                    40,
                    lang === 'zh'
                        ? '当前级别未配置 NotebookLM 笔记，按级别标准继续。'
                        : 'No NotebookLM notebook configured for this level, continuing with level standard.',
                );
                if (isCustomTextbookLevelKey(normalizedLevelKey)) {
                    setGroundingBanner({
                        kind: 'custom',
                        title: lang === 'zh' ? 'Other 教材模式：未绑定主线 Notebook' : 'Other textbook mode: no mainline Notebook binding',
                        detail: lang === 'zh'
                            ? '当前选择的是 Other 级别，将按输入内容与级别标准生成，建议教师复核。'
                            : 'Current selection uses Other level; generation relies on provided content + level standard, teacher review recommended.',
                    });
                }
            }

            if (sourceMode === 'direct') {
                knowledgeNotebookId = undefined;
                setGroundingBanner({
                    kind: 'custom',
                    title: lang === 'zh' ? '普通模式已启用' : 'Direct mode enabled',
                    detail: lang === 'zh'
                        ? '本次生成不会连接 NotebookLM，将直接分析你上传或输入的资料。'
                        : 'This run will skip NotebookLM and directly analyze uploaded or typed materials.',
                });
                updateGenerationProgress(
                    2,
                    44,
                    lang === 'zh'
                        ? '正在分析上传/输入资料...'
                        : 'Analyzing uploaded or typed materials...',
                );
            }
            const generationStage = sourceMode === 'direct' ? 3 : 4;
            const finalizeStage = sourceMode === 'direct' ? 4 : 5;
            updateGenerationProgress(generationStage, 78, lang === 'zh' ? '正在生成课程大纲...' : 'Generating curriculum outline...');
            const result = await generateESLCurriculum(
                sourceText,
                params,
                abortControllerRef.current.signal,
                {
                    textbookLevelLabel: levelEntry?.displayName || customLevelLabel,
                    notebookId: knowledgeNotebookId,
                    groundingFactSheet,
                    groundingUrls,
                    groundingSources,
                },
            );
            updateGenerationProgress(finalizeStage, 95, lang === 'zh' ? '正在整理结构化输出...' : 'Finalizing structured output...');
            setCurriculum(result);
            setSavedParams(params);
            updateGenerationProgress(finalizeStage, 100, lang === 'zh' ? '生成完成。' : 'Generation complete.');
        } catch (error: any) {
            if (error.name === 'AbortError' || error.message === 'AbortError' || error.message === 'Operation aborted') {
                updateGenerationProgress(0, 0, lang === 'zh' ? '已中断生成' : 'Generation aborted');
                return;
            }
            setErrorMsg(error.message || t('cp.generateFailed'));
        } finally {
            setLoading(false);
            abortControllerRef.current = null;
        }
    };

    const handleNewCurriculum = () => {
        setCurriculum(null);
        setSavedParams(null);
        setExpandedLessons(new Set());
        safeStorage.remove(STORAGE_KEY);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const toggleLesson = (index: number) => {
        setExpandedLessons(prev => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });
    };

    const triggerGenerateKit = (lesson: CurriculumLesson) => {
        const params = savedParams || getCurrentParams();
        onGenerateKit(lesson, params, curriculum || undefined, matchedCurriculumId || undefined);
    };

    const triggerBatchGenerate = () => {
        if (!curriculum || !onBatchGenerate) return;
        const params = savedParams || getCurrentParams();
        onBatchGenerate(curriculum.lessons, params, curriculum);
    };

    const matchedCurriculumId = useMemo(() => {
        if (!curriculum) return undefined;
        const matched = savedCurricula.find(
            (sc) =>
                sc.textbookTitle === curriculum.textbookTitle &&
                sc.totalLessons === curriculum.totalLessons
        );
        return matched?.id;
    }, [curriculum, savedCurricula]);

    const generatedLessonIndices = useMemo(() => {
        const indices = new Set<number>();
        if (!curriculum) return indices;

        const normalize = (text?: string) => (text || '').trim().toLowerCase();

        curriculum.lessons.forEach((lesson, index) => {
            const isGenerated = savedLessons.some((record) => {
                if (matchedCurriculumId && record.curriculumId === matchedCurriculumId) {
                    if (typeof record.lessonIndex === 'number') return record.lessonIndex === index;
                    return normalize(record.topic) === normalize(lesson.topic);
                }

                if (!record.curriculumId && typeof record.lessonIndex === 'number') {
                    return (
                        record.lessonIndex === index &&
                        normalize(record.topic) === normalize(lesson.topic)
                    );
                }

                return false;
            });

            if (isGenerated) {
                indices.add(index);
            }
        });

        return indices;
    }, [curriculum, matchedCurriculumId, savedLessons]);

    return (
        <div className="space-y-8">
            {/* Config Panel — only when no curriculum */}
            {!curriculum && (
                <>
                    <div className="space-y-6">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-6 flex items-center gap-2">
                            <BookOpen size={22} className="text-violet-600" />
                            {t('cp.title')}
                        </h2>

                        {/* PDF Upload */}
                        <div className="mb-6">
                            <label className="flex items-center gap-2 text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                <FileText size={16} /> {t('cp.uploadPdf')}
                            </label>
                            {!pdfFile ? (
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-violet-400 hover:bg-violet-50/30 transition-all group"
                                >
                                    <Upload className="w-10 h-10 text-slate-400 group-hover:text-violet-500 mb-3" />
                                    <p className="text-sm text-slate-500 text-center">
                                        <span className="font-semibold text-violet-600">{t('cp.clickUpload')}</span> {t('cp.pdfFile')}<br />
                                        <span className="text-xs text-slate-400">{t('cp.pdfSupport')}</span>
                                    </p>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        accept=".pdf,application/pdf"
                                        className="hidden"
                                        aria-label="Upload PDF file"
                                    />
                                </div>
                            ) : (
                                <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-violet-100 p-2 rounded-lg">
                                            <FileText className="w-5 h-5 text-violet-600" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{pdfFile.name}</p>
                                            <p className="text-xs text-slate-500">
                                                {extracting ? (
                                                    <span className="flex items-center gap-1 text-violet-600">
                                                        <Loader2 size={12} className="animate-spin" /> {t('cp.extracting')}
                                                    </span>
                                                ) : (
                                                    <>{pdfPageCount} {t('cp.pdfPages')} · {(pdfText.length / 1000).toFixed(1)}K {t('cp.pdfChars')}</>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={removePdf}
                                        className="text-slate-400 hover:text-red-500 p-1.5 rounded-full hover:bg-red-50 transition-all"
                                        title="Remove PDF"
                                        aria-label="Remove PDF"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Settings Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {/* Lesson Count */}
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-500 uppercase tracking-wider">
                                    <ListOrdered size={16} /> {t('cp.numLessons')}
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    max={20}
                                    value={lessonCount}
                                    onChange={(e) => setLessonCount(parseInt(e.target.value) || 6)}
                                    className="w-full bg-slate-50 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
                                    aria-label="Number of lessons"
                                />
                            </div>

                            {/* Target Level */}
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-500 uppercase tracking-wider">
                                    <GraduationCap size={16} /> {t('cp.targetLevel')}
                                </label>
                                <select
                                    value={level}
                                    onChange={(e) => setLevel(e.target.value as CEFRLevel)}
                                    className="w-full bg-slate-50 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
                                    aria-label="Target CEFR level"
                                >
                                    {Object.values(CEFRLevel).map(lvl => (
                                        <option key={lvl} value={lvl}>{t(`cefr.${lvl}`)}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Textbook */}
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-500 uppercase tracking-wider">
                                    <BookOpen size={16} /> {lang === 'zh' ? '教材名称' : 'Textbook'}
                                </label>
                                <select
                                    value={textbookId}
                                    onChange={(e) => handleTextbookChange(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
                                    aria-label="Textbook name"
                                >
                                    {textbookGroups.map((group) => (
                                        <option key={group.textbookId} value={group.textbookId}>
                                            {group.textbookName}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Textbook Level Standard */}
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-500 uppercase tracking-wider">
                                    <Target size={16} /> {lang === 'zh' ? '级别' : 'Level'}
                                </label>
                                <select
                                    value={textbookLevelKey}
                                    onChange={(e) => setTextbookLevelKey(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
                                    aria-label="Textbook level"
                                >
                                    {(activeTextbookGroup?.options || []).map((item) => (
                                        <option key={item.levelKey} value={item.levelKey}>
                                            {item.textbookId === OTHER_TEXTBOOK_ID ? item.levelDisplayName : `${item.levelDisplayName} (${item.status})`}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Source Mode */}
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-500 uppercase tracking-wider">
                                    <FileText size={16} /> {t('cp.sourceMode')}
                                </label>
                                <select
                                    value={sourceMode}
                                    onChange={(e) => setSourceMode(e.target.value as GenerationSourceMode)}
                                    className="w-full bg-slate-50 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
                                    aria-label="Source mode"
                                >
                                    <option value="notebook">{t('cp.modeNotebook')}</option>
                                    <option value="direct">{t('cp.modeDirect')}</option>
                                </select>
                            </div>

                            {/* Duration */}
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-500 uppercase tracking-wider">
                                    <Clock size={16} /> {t('cp.duration')}
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g., 90"
                                    value={duration}
                                    onChange={(e) => setDuration(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
                                />
                            </div>

                            {/* Student Count */}
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-500 uppercase tracking-wider">
                                    <Users size={16} /> {t('cp.students')}
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    value={studentCount}
                                    onChange={(e) => setStudentCount(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
                                    aria-label="Number of students"
                                />
                            </div>

                            {/* Slides Per Lesson */}
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-500 uppercase tracking-wider">
                                    <Sparkles size={16} /> {t('cp.slidesPerLesson')}
                                </label>
                                <select
                                    value={slideCount}
                                    onChange={(e) => setSlideCount(Number(e.target.value))}
                                    className="w-full bg-slate-50 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
                                    aria-label="Slides per lesson"
                                >
                                    {[5, 8, 10, 12, 15, 20, 25, 30].map(n => (
                                        <option key={n} value={n}>{n} {t('input.slidesUnit')}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Custom Instructions */}
                            <div className="space-y-2 md:col-span-2 lg:col-span-3">
                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-500 uppercase tracking-wider">
                                    <MessageSquare size={16} /> {t('cp.customInstructions')}
                                </label>
                                <textarea
                                    placeholder={t('cp.customPlaceholder')}
                                    value={customInstructions}
                                    onChange={(e) => setCustomInstructions(e.target.value)}
                                    rows={2}
                                    className="w-full bg-slate-50 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all resize-none"
                                />
                            </div>

                            {/* Generate / Stop Button */}
                            <div className="md:col-span-2 lg:col-span-3 pt-2">
                                {loading ? (
                                    <>
                                        <button
                                            onClick={handleStopGenerate}
                                            className="w-full rounded-xl py-4 font-bold text-lg flex items-center justify-center gap-3 transition-all shadow-md bg-gradient-to-r from-red-500 to-rose-500 text-white hover:shadow-lg hover:-translate-y-0.5"
                                        >
                                            <Square size={18} /> {t('cp.stop') || 'Stop'}
                                        </button>
                                        <GenerationProgress
                                            statusText={generationProgress.statusText || (lang === 'zh' ? '正在分析教材并生成大纲...' : 'Analyzing textbook and generating outline...')}
                                            progress={generationProgress.percent}
                                            stages={sourceMode === 'direct'
                                                ? (lang === 'zh'
                                                    ? ['校验参数', '分析上传/输入资料', '提炼教学锚点', '生成课程大纲', '整理结构结果']
                                                    : ['Validate input', 'Analyze provided materials', 'Extract teaching anchors', 'Generate curriculum', 'Finalize structured output'])
                                                : progressStages}
                                            currentStage={generationProgress.stage}
                                            theme="violet"
                                        />
                                        {pendingFallback && (
                                            <FallbackPrompt
                                                title={pendingFallback.title}
                                                detail={pendingFallback.detail}
                                                onContinue={() => handleFallbackChoice('continue')}
                                                onCancel={() => handleFallbackChoice('cancel')}
                                                continueLabel={lang === 'zh' ? '继续 Fallback 生成' : 'Continue with Fallback'}
                                                cancelLabel={lang === 'zh' ? '停止生成' : 'Stop Generation'}
                                            />
                                        )}
                                    </>
                                ) : (
                                    <button
                                        onClick={handleGenerate}
                                        disabled={!textbookLevelKey}
                                        className={`w-full rounded-xl py-4 font-bold text-lg flex items-center justify-center gap-3 transition-all shadow-md
                    ${(!textbookLevelKey)
                                                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                                : 'bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:shadow-lg hover:-translate-y-0.5'
                                            }`}
                                    >
                                        {t('cp.generate')} <ArrowRight size={20} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Error */}
                    {errorMsg && (
                        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-center">
                            {errorMsg}
                        </div>
                    )}
                </>
            )}

            {/* Results */}
            {curriculum && (
                <div className="space-y-6">
                    {/* Action buttons — unified row */}
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-slate-500 font-medium">
                                {curriculum.totalLessons} lessons · {curriculum.targetLevel}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            {/* Batch generate button */}
                            {onBatchGenerate && (
                                batchRunning ? (
                                    <button
                                        onClick={onCancelBatch}
                                        className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl text-sm font-semibold hover:bg-red-100 transition-all"
                                    >
                                        <Square size={15} />
                                        {t('cp.cancel')}
                                    </button>
                                ) : (
                                    <button
                                        onClick={triggerBatchGenerate}
                                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl text-sm font-semibold hover:from-violet-700 hover:to-purple-700 transition-all shadow-sm"
                                    >
                                        <Rocket size={15} />
                                        {t('cp.generateAll')}
                                    </button>
                                )
                            )}
                            {onSaveCurriculum && (
                                <button
                                    onClick={async () => {
                                        const result = await onSaveCurriculum(curriculum, savedParams || getCurrentParams()) as { ok?: boolean } | void;
                                        if (result && typeof result === 'object' && 'ok' in result && result.ok === false) {
                                            setIsSaved(false);
                                            return;
                                        }
                                        setIsSaved(true);
                                    }}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${isSaved
                                        ? 'bg-green-50 border border-green-200 text-green-600'
                                        : 'bg-violet-600 text-white hover:bg-violet-700 shadow-sm'
                                        }`}
                                >
                                    <Save size={15} />
                                    {isSaved ? t('cp.savedCheck') : t('cp.saveCurriculum')}
                                </button>
                            )}
                            <button
                                onClick={handleNewCurriculum}
                                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 rounded-xl text-sm font-semibold hover:bg-slate-50 hover:border-slate-300 transition-all"
                            >
                                <ArrowLeft size={15} />
                                {t('cp.newCurriculum')}
                            </button>
                        </div>
                    </div>

                    <div className={`rounded-xl border p-4 ${missingTextbookLevelKey
                        ? 'border-amber-200 bg-amber-50'
                        : 'border-violet-200 bg-violet-50'
                        }`}>
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="text-sm">
                                <div className={`font-semibold ${missingTextbookLevelKey ? 'text-amber-800' : 'text-violet-700'}`}>
                                    {missingTextbookLevelKey
                                        ? (lang === 'zh' ? '请先选择级别（Level）后再生成。' : 'Please select Level before generating.')
                                        : (lang === 'zh' ? '级别已设置' : 'Level is set.')}
                                </div>
                                <div className={`text-xs mt-1 ${missingTextbookLevelKey ? 'text-amber-700/80' : 'text-violet-600/80'}`}>
                                    {missingTextbookLevelKey
                                        ? (lang === 'zh' ? '非主线教材请先选择 Textbook = Other，再选择对应级别。' : 'For non-mainline textbooks, choose Textbook = Other, then choose its level.')
                                        : (lang === 'zh' ? '你可以在这里修改级别，后续生成会立即使用。' : 'You can change the level here and subsequent generation will use it immediately.')}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <select
                                    value={textbookId}
                                    onChange={(e) => handleResultTextbookChange(e.target.value)}
                                    className="min-w-[180px] bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                                    aria-label="Result textbook"
                                >
                                    {textbookGroups.map((group) => (
                                        <option key={group.textbookId} value={group.textbookId}>
                                            {group.textbookName}
                                        </option>
                                    ))}
                                </select>
                                <select
                                    value={resolvedTextbookLevelKey}
                                    onChange={(e) => handleResultTextbookLevelChange(e.target.value)}
                                    className="min-w-[240px] bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                                    aria-label="Result textbook level"
                                >
                                    {(activeTextbookGroup?.options || []).map((item) => (
                                        <option key={item.levelKey} value={item.levelKey}>
                                            {item.textbookId === OTHER_TEXTBOOK_ID ? item.levelDisplayName : `${item.levelDisplayName} (${item.status})`}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {groundingBanner && (
                        <div className={`rounded-xl border p-4 ${groundingBanner.kind === 'connected'
                            ? 'border-emerald-200 bg-emerald-50'
                            : groundingBanner.kind === 'fallback'
                                ? 'border-amber-200 bg-amber-50'
                                : 'border-slate-200 bg-slate-50'
                            }`}>
                            <div className="flex items-start gap-2">
                                {groundingBanner.kind === 'connected'
                                    ? <CheckCircle2 size={16} className="mt-0.5 text-emerald-600" />
                                    : <AlertCircle size={16} className="mt-0.5 text-amber-600" />}
                                <div className="text-sm">
                                    <div className={`font-semibold ${groundingBanner.kind === 'connected' ? 'text-emerald-700' : 'text-amber-700'
                                        }`}>
                                        {groundingBanner.title}
                                    </div>
                                    <div className={`text-xs mt-1 ${groundingBanner.kind === 'connected' ? 'text-emerald-700/80' : 'text-amber-700/90'
                                        }`}>
                                        {groundingBanner.detail}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Curriculum-level Review */}
                    <CurriculumReviewPanel
                        curriculum={curriculum}
                        onScrollToLesson={(index) => {
                            setExpandedLessons(prev => new Set(prev).add(index));
                            setTimeout(() => {
                                const card = document.querySelector(`[data-lesson-index="${index}"]`);
                                if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }, 100);
                        }}
                    />

                    {/* Overview */}
                    <div className="space-y-4">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-200 mb-2">
                            {displaySeriesName || curriculum.textbookTitle}
                        </h2>
                        <p
                            className="text-slate-600 dark:text-slate-400 leading-relaxed"
                            title={getCurriculumCitationTitle('curriculum.overview', curriculum.overview)}
                        >
                            {curriculum.overview}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-500">
                            <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg font-medium flex items-center gap-1.5">
                                <FileText size={14} />
                                {displaySeriesName || curriculum.textbookTitle}
                                {displayTextbookLevel ? ` - ${displayTextbookLevel}` : ''}
                            </span>
                            <span className="px-3 py-1 bg-violet-50 text-violet-700 rounded-lg font-medium flex items-center gap-1.5"><BookOpen size={14} /> {curriculum.totalLessons} {t('cp.lessonsUnit')}</span>
                            <span className="px-3 py-1 bg-violet-50 text-violet-700 rounded-lg font-medium flex items-center gap-1.5"><GraduationCap size={14} /> {curriculum.targetLevel}</span>
                            {savedParams && (
                                <>
                                    <span className="px-3 py-1 bg-slate-100 rounded-lg flex items-center gap-1.5"><Clock size={14} /> {savedParams.duration} min</span>
                                    <span className="px-3 py-1 bg-slate-100 rounded-lg flex items-center gap-1.5"><Users size={14} /> {savedParams.studentCount} {t('cp.studentsUnit')}</span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Lesson Cards */}
                    {curriculum.lessons.map((lesson, index) => {
                        const isExpanded = expandedLessons.has(index);
                        return (
                            <div
                                key={index}
                                data-lesson-index={index}
                                className="rounded-xl border border-slate-100 dark:border-white/5 overflow-hidden animate-fade-in-up"
                                style={{ animationDelay: `${index * 80}ms` }}
                            >
                                {/* Header — always visible */}
                                <div
                                    className="p-5 cursor-pointer hover:bg-slate-50/50 transition-colors"
                                    onClick={() => toggleLesson(index)}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <span className="text-xs font-bold text-white bg-gradient-to-br from-violet-600 to-purple-600 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0">
                                                {String(lesson.lessonNumber || index + 1).padStart(2, '0')}
                                            </span>
                                            <div className="min-w-0">
                                                {(() => {
                                                    const displayName = formatLessonDisplayName(lesson, curriculum);
                                                    return (
                                                        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-200 truncate" title={displayName}>
                                                            {displayName}
                                                        </h3>
                                                    );
                                                })()}
                                                <p className="text-sm text-slate-500 truncate">{lesson.topic}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 ml-2">
                                            {/* Batch status badge — visible even when collapsed */}
                                            {(() => {
                                                const st = batchStatus[index];
                                                if (st === 'generating') return <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-[11px] font-semibold whitespace-nowrap"><Loader2 size={12} className="animate-spin" />{lang === 'zh' ? '生成中' : 'Generating'}</span>;
                                                if (st === 'done') return <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[11px] font-semibold whitespace-nowrap"><CheckCircle2 size={12} />{lang === 'zh' ? '已完成' : 'Done'}</span>;
                                                if (st === 'error') return <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-[11px] font-semibold whitespace-nowrap"><AlertCircle size={12} />{lang === 'zh' ? '失败' : 'Failed'}</span>;
                                                if (generatedLessonIndices.has(index)) return <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[11px] font-semibold whitespace-nowrap"><CheckCircle2 size={12} />{lang === 'zh' ? '已生成' : 'Generated'}</span>;
                                                return null;
                                            })()}
                                            <span className="hidden sm:inline text-xs flex-shrink-0 text-slate-400 bg-slate-100 px-2 py-1 rounded-md max-w-[120px] truncate" title={lesson.textbookReference}>
                                                {(() => {
                                                    const ref = lesson.textbookReference || '';
                                                    const match = ref.match(/page(s)?\s*\d+(-\d+)?/i);
                                                    if (match) return match[0];
                                                    return ref.split('(')[0].trim();
                                                })()}
                                            </span>
                                            {isExpanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                                        </div>
                                    </div>
                                    {!isExpanded && (
                                        <p
                                            className="text-sm text-slate-500 mt-2 line-clamp-2"
                                            title={getCurriculumCitationTitle(`lessons.${index}.description`, lesson.description)}
                                        >
                                            {lesson.description}
                                        </p>
                                    )}
                                </div>

                                {/* Expanded content */}
                                {isExpanded && (
                                    <div className="px-5 pb-5 space-y-4 border-t border-slate-100 dark:border-white/5 pt-4">
                                        <p
                                            className="text-slate-600 dark:text-slate-400 leading-relaxed"
                                            title={getCurriculumCitationTitle(`lessons.${index}.description`, lesson.description)}
                                        >
                                            {lesson.description}
                                        </p>

                                        {/* Detail Grid */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                            {/* Objectives */}
                                            <div>
                                                <span className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
                                                    <Target size={12} /> {t('cp.learningObjectives')}
                                                </span>
                                                <ul className="mt-1 space-y-1 text-slate-700 dark:text-slate-400">
                                                    {lesson.objectives.map((obj, i) => (
                                                        <li key={i} className="flex items-start gap-1.5">
                                                            <span className="text-violet-500 mt-0.5">•</span>
                                                            <span title={getCurriculumCitationTitle(`lessons.${index}.objectives.${i}`, obj)}>{obj}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>

                                            {/* Grammar Focus */}
                                            <div>
                                                <span className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
                                                    <GraduationCap size={12} /> {t('cp.grammarFocus')}
                                                </span>
                                                <p
                                                    className="font-medium text-slate-700 dark:text-slate-400 mt-1"
                                                    title={getCurriculumCitationTitle(`lessons.${index}.grammarFocus`, lesson.grammarFocus)}
                                                >
                                                    {lesson.grammarFocus}
                                                </p>

                                                <span className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1 mt-3">
                                                    <Sparkles size={12} /> {t('cp.suggestedActivities')}
                                                </span>
                                                <ul className="mt-1 space-y-1 text-slate-700 dark:text-slate-400">
                                                    {lesson.suggestedActivities.map((act, i) => (
                                                        <li key={i} className="flex items-start gap-1.5">
                                                            <span className="text-purple-500 mt-0.5">▸</span>
                                                            <span title={getCurriculumCitationTitle(`lessons.${index}.suggestedActivities.${i}`, act)}>{act}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>

                                        {/* Vocabulary Tags */}
                                        {lesson.suggestedVocabulary.length > 0 && (
                                            <div className="flex flex-wrap gap-2 pt-2">
                                                {lesson.suggestedVocabulary.map((word, i) => (
                                                    <span key={i} className="px-2.5 py-1 bg-violet-50 text-violet-700 text-xs font-semibold rounded-lg">
                                                        {word}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {/* Generate Kit Button — status-aware */}
                                        {(() => {
                                            const lessonIdx = curriculum.lessons.indexOf(lesson);
                                            const status = batchStatus[lessonIdx];
                                            const kitId = batchLessonMap[lessonIdx];
                                            const hasGeneratedRecord = generatedLessonIndices.has(lessonIdx);

                                            if (status === 'generating') {
                                                return (
                                                    <div className="w-full mt-2 bg-violet-50 border border-violet-200 text-violet-600 rounded-xl py-3 font-semibold flex items-center justify-center gap-2">
                                                        <Loader2 size={18} className="animate-spin" /> {t('cp.generating')}
                                                    </div>
                                                );
                                            }
                                            if (status === 'done' && kitId) {
                                                return (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onOpenKit?.(kitId); }}
                                                        className="w-full mt-2 bg-green-50 border border-green-200 text-green-700 rounded-xl py-3 font-semibold hover:bg-green-100 transition-all flex items-center justify-center gap-2"
                                                    >
                                                        <CheckCircle2 size={18} /> {t('cp.openKit')}
                                                        <ExternalLink size={14} />
                                                    </button>
                                                );
                                            }
                                            if (status === 'error') {
                                                return (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            triggerGenerateKit(lesson);
                                                        }}
                                                        className="w-full mt-2 bg-red-50 border border-red-200 text-red-600 rounded-xl py-3 font-semibold hover:bg-red-100 transition-all flex items-center justify-center gap-2"
                                                    >
                                                        <AlertCircle size={18} /> {t('cp.failedRetry')}
                                                    </button>
                                                );
                                            }
                                            // idle / default
                                            return (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        triggerGenerateKit(lesson);
                                                    }}
                                                    className="w-full mt-2 bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 text-violet-700 rounded-xl py-3 font-semibold hover:from-violet-100 hover:to-purple-100 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <FileText size={18} />
                                                    {t(hasGeneratedRecord ? 'cp.regenerateKit' : 'cp.generateKit')}
                                                    <ArrowRight size={16} />
                                                </button>
                                            );
                                        })()}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {curriculum && errorMsg && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-center">
                    {errorMsg}
                </div>
            )}

            {/* Batch progress bar — sticky floating */}
            {(batchRunning || (batchProgress.done > 0 && batchProgress.done < batchProgress.total)) && curriculum && (
                <div className="sticky bottom-4 z-30 mt-6 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm rounded-xl border border-violet-200 dark:border-violet-500/30 p-4 shadow-lg shadow-violet-500/10">
                    <div className="flex items-center justify-between text-sm mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                            {batchRunning && <Loader2 size={16} className="animate-spin text-violet-600 flex-shrink-0" />}
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                                {batchRunning ? t('cp.batchGenerating') : t('cp.batchPaused')}
                            </span>
                        </div>
                        <span className="text-slate-500 flex-shrink-0">
                            {batchProgress.done}/{batchProgress.total} {t('cp.completed')}
                            {batchProgress.errors > 0 && <span className="text-red-500 ml-2">· {batchProgress.errors} {t('cp.failed')}</span>}
                        </span>
                    </div>
                    {/* Current lesson name */}
                    {batchRunning && curriculum.lessons && (() => {
                        const currentIdx = curriculum.lessons.findIndex((_, i) => batchStatus[i] === 'generating');
                        if (currentIdx >= 0) {
                            const currentLesson = curriculum.lessons[currentIdx];
                            const displayName = formatLessonDisplayName(currentLesson, curriculum);
                            return (
                                <div className="text-xs text-violet-600 dark:text-violet-400 mb-2 truncate">
                                    {lang === 'zh' ? '当前' : 'Current'}: <span className="font-medium">{displayName}</span>
                                    <span className="text-slate-400 ml-1">({currentIdx + 1}/{curriculum.lessons.length})</span>
                                </div>
                            );
                        }
                        return null;
                    })()}
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-violet-500 to-purple-500"
                            style={{ width: `${batchProgress.total > 0 ? (batchProgress.done / batchProgress.total) * 100 : 0}%` }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
