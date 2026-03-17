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

export const CreatePage: React.FC<CreatePageProps> = () => {
    const { state, setState } = useSessionStore();
    const { activeLessonId, setActiveLessonId, prefilledValues, setPrefilledValues } = useAppStore();
    const history = useLessonHistory();
    const onSaveLesson = history.handleSaveLesson;

    const { t, lang } = useLanguage();
    const { startRAG, checkBackends } = useNotebookLMRAG();
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
    ) => {
        const stages = getProgressStages(sourceMode);
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
            let groundingSources: Array<{ id?: string; title?: string; url?: string; status?: string; type?: string }> | undefined;
            let knowledgeNotebookId: string | undefined = sourceMode === 'notebook' ? (levelEntry?.notebookId || undefined) : undefined;
            let groundingStatus: GroundingStatus = 'unverified';

            if (sourceMode === 'notebook' && levelEntry?.notebookId) {
                try {
                    updateProgress(1, 24, lang === 'zh' ? '正在连接 NotebookLM...' : 'Connecting to NotebookLM...', stages);
                    const backends = await checkBackends();
                    if (!backends.local) {
                        const fbTitle = lang === 'zh' ? '本地 NotebookLM 未连接' : 'Local NotebookLM unavailable';
                        const fbDetail = lang === 'zh'
                            ? `主线级别绑定 notebook "${levelEntry.notebookId}"，需使用本地 dev:nlm。是否改用 fallback 无笔记模式继续生成？`
                            : `Notebook "${levelEntry.notebookId}" requires local dev:nlm. Switch to fallback mode?`;
                        const choice = await askFallbackConfirm(fbTitle, fbDetail);
                        if (choice === 'cancel') throw new Error('AbortError');
                        qualityIssues.push(`Fallback: ${fbTitle} - ${fbDetail}`);
                        updateProgress(2, 40, lang === 'zh' ? 'NotebookLM 不可用，改用 fallback...' : 'NotebookLM unavailable, switching to fallback...', stages);
                        throw new Error('LOCAL_NOTEBOOK_BACKEND_UNAVAILABLE');
                    }

                    const backend = 'local';
                    updateProgress(
                        2,
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
                    validUrls = rag.validUrls;
                    groundingSources = rag.sources;
                    knowledgeNotebookId = rag.notebookId || levelEntry.notebookId || undefined;
                    const hasNoUsableSourceMarker = /NO_USABLE_SOURCE/i.test(factSheet || '');
                    if (hasNoUsableSourceMarker) {
                        factSheet = undefined;
                    }

                    if (factSheet) {
                        const quality = rag.factSheets.get(0)?.quality;
                        groundingStatus = quality === 'good' ? 'verified' : 'mixed';
                        updateProgress(2, 62, lang === 'zh' ? 'NotebookLM 资料命中，正在生成课件...' : 'Notebook sources grounded, generating lesson kit...', stages);
                    } else {
                        groundingStatus = 'unverified';
                        const fbTitle = lang === 'zh' ? '未提取到笔记事实表' : 'No notebook fact sheet extracted';
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
                        const fbTitle = lang === 'zh' ? 'NotebookLM 调用失败' : 'NotebookLM request failed';
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
                factSheet,
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
                },
            );

            // Fix A: Save generation context for Phase 2
            lessonContent._generationContext = {
                level,
                topic,
                lessonTitle,
                duration,
                studentCount,
                slideCount,
                factSheet,
                validUrls,
                textbookLevelKey: normalizedLevelKey,
                assessmentPackPrompt: assessmentPack ? buildAssessmentPackPrompt(assessmentPack) : undefined,
                sourceMode,
            };

            const finalizeStage = sourceMode === 'direct' ? 3 : 4;
            updateProgress(finalizeStage, 96, lang === 'zh' ? '正在整理结构化结果...' : 'Finalizing structured output...', stages);
            setState({ isLoading: false, generatedContent: lessonContent, error: null });
            updateProgress(finalizeStage, 100, lang === 'zh' ? '教案已生成，请审阅后一键生成配套内容。' : 'Lesson plan ready — review and generate supporting content.', stages);
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

    return (
        <>
            {!state.generatedContent && (
                <InputSection
                    onGenerate={handleGenerate}
                    isLoading={state.isLoading}
                    initialValues={prefilledValues}
                    onStop={handleStopGeneration}
                    generationProgress={generationProgress}
                    pendingFallback={pendingFallback}
                    onFallbackChoice={handleFallbackChoice}
                />
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
                        // Update local state so UI re-renders (critical for Phase 2 → tab unlock)
                        setState(prev => ({ ...prev, generatedContent: c }));
                        onSaveLesson(c);
                    }} />
                </div>
            )}
        </>
    );
};

