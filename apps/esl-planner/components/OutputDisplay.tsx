import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  GeneratedContent,
  Slide,
  StructuredLessonPlan,
  Flashcard,
  ReadingCompanionContent,
  WebResource,
  ReadingPlanDay,
  ReadingTask,
  Game,
  Worksheet,
  WorksheetItem,
  WorksheetSection,
  LessonStage,
  PhonicsContent,
  CEFRLevel,
  AssignmentSheet,
  GenerationContext,
} from "../types";
import { generateSupportingContent, regenerateSlides } from "../services/gemini/supportingContent";
import {
  BookOpen,
  Presentation,
  Gamepad2,
  GraduationCap,
  Copy,
  Check,
  Download,
  Palette,
  Sparkles,
  Loader2,
  Image as ImageIcon,
  Plus,
  Trash2,
  Layers,
  GripVertical,
  FileText,
  Globe,
  Lightbulb,
  CheckSquare,
  Save,
  X,
  Bot,
  FileQuestion,
  CircleStop,
  AlertCircle,
  Wrench,
  ChevronUp,
  ArrowUp,
  ChevronDown,
  RefreshCw,
  FileCheck,
  ExternalLink,
  Edit2,
  Filter,
  Columns,
  List,
  BookOpen as ReadingIcon,
  Image as LucideImage,
  Music,
  FileCheck as AnswerKeyIcon,
  Info,
  PencilLine,
  Printer,
  ClipboardList,
  Rocket,
} from "lucide-react";
import {
  generateSingleFlashcard,
  generateSingleGrammarPoint,
  generateSinglePhonicsPoint,
  generateSingleDecodableText,
  generateSingleObjective,
  generateSingleMaterial,
  generateSingleVocabItem,
  generateSingleAnticipatedProblem,
  generateSingleStage,
  generateVocabDefinition,
} from "../services/itemGenerators";
import {
  generateReadingTask,
  generateWebResource,
  generateTrivia,
  generateWorksheet,
  generateNewCompanionDay,
  generateSingleGame,
  generateReadingPassage,
} from "../services/worksheetService";
import { translateLessonKit } from "../services/curriculumService";
import { generateLessonImage } from "../services/lessonKitService";
import { useExportUtils } from "../hooks/useExportUtils";
import { useSlideExport } from "../hooks/useSlideExport";
import { useAutoSave } from "@shared/hooks/useAutoSave";
import { LessonPlanTab } from "./tabs/LessonPlanTab";
import { SlidesTab } from "./tabs/SlidesTab";
import { ActivitiesTab } from "./tabs/ActivitiesTab";
import { CompanionTab } from "./tabs/CompanionTab";
import { AssignmentTab } from "./tabs/AssignmentTab";
import { AutoResizeTextarea } from "./common/AutoResizeTextarea";
import { FlashcardsTab } from "./tabs/materials/FlashcardsTab";
import { GrammarTab } from "./tabs/materials/GrammarTab";
import { WhiteboardTab } from "./tabs/materials/WhiteboardTab";
import { PhonicsTab } from "./tabs/materials/PhonicsTab";
import { WorksheetsTab } from "./tabs/materials/WorksheetsTab";

interface OutputDisplayProps {
  content: GeneratedContent;
  onSave: (content: GeneratedContent) => void | Promise<unknown>;
}

const ASPECT_RATIOS = [
  { label: "Square (1:1)", value: "1:1" },
  { label: "Landscape (4:3)", value: "4:3" },
  { label: "Portrait (3:4)", value: "3:4" },
  { label: "Wide (16:9)", value: "16:9" },
  { label: "Tall (9:16)", value: "9:16" },
];

const INDIGO_COLOR = "#4f46e5";

// Component for Correction Legend
const CorrectionLegend = () => (
  <div className="bg-white dark:bg-slate-900/80 border-2 border-indigo-100 rounded-2xl p-4 shadow-sm viewer-correction-legend">
    <h5 className="text-[10px] font-black text-indigo-900 uppercase tracking-widest mb-3 flex items-center gap-2">
      <Info className="w-3 h-3 text-indigo-500" />
      Proofreading Marks Reference / 修改符号参�?    </h5>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 bg-indigo-50 rounded flex items-center justify-center font-bold text-indigo-600">
          ^
        </span>
        <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400">
          Insert / 插入
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 bg-indigo-50 rounded flex items-center justify-center font-bold text-indigo-600">
          /
        </span>
        <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400">
          Delete / 删除
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 bg-indigo-50 rounded flex items-center justify-center font-bold text-indigo-600">
          �?        </span>
        <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400">
          Replace / 替换
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 bg-indigo-50 rounded flex items-center justify-center font-bold text-indigo-600">
          ~
        </span>
        <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400">
          Spelling / 拼写
        </span>
      </div>
    </div>
  </div>
);

export const OutputDisplay: React.FC<OutputDisplayProps> = ({
  content,
  onSave,
}) => {
  const viewLang = "en";

  const [activeTab, setActiveTab] = useState<
    "plan" | "slides" | "materials" | "games" | "companion" | "assignment"
  >("plan");
  const [isSaving, setIsSaving] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const [materialTab, setMaterialTab] = useState<
    "flashcards" | "worksheets" | "grammar" | "phonics" | "whiteboard"
  >("flashcards");

  const [editableSlides, setEditableSlides] = useState<Slide[]>(
    content.slides || [],
  );
  // Strip HTML tags from stage text fields (for existing saved data with <br/> etc.)
  const sanitizePlan = (plan: StructuredLessonPlan | null): StructuredLessonPlan | null => {
    if (!plan) return null;
    const strip = (s: string) => s.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s{2,}/g, ' ').trim();
    return {
      ...plan,
      stages: plan.stages.map(stage => ({
        ...stage,
        teacherActivity: strip(stage.teacherActivity || ''),
        studentActivity: strip(stage.studentActivity || ''),
        stageAim: strip(stage.stageAim || ''),
        stage: strip(stage.stage || ''),
      }))
    };
  };

  const [editablePlan, setEditablePlan] = useState<StructuredLessonPlan | null>(
    sanitizePlan(content.structuredLessonPlan || null),
  );

  // --- NotebookLM Export ---
  const { exportState, startExport, cancelExport, resetExport } = useSlideExport();
  const handleExportSlides = useCallback(() => {
    const title = editablePlan?.classInformation?.topic || content.structuredLessonPlan?.classInformation?.topic || 'ESL Lesson';
    startExport(title, editableSlides, content.notebookLMPrompt || '');
  }, [editableSlides, content.notebookLMPrompt, editablePlan, content.structuredLessonPlan, startExport]);

  // --- Regenerate Slides Only ---
  const [isRegenerating, setIsRegenerating] = useState(false);
  const handleRegenerateSlides = useCallback(async () => {
    if (!editablePlan) return;
    setIsRegenerating(true);
    try {
      // Build fallback context if _generationContext is missing (old lesson kits)
      const ctx: GenerationContext = content._generationContext || {
        level: (editablePlan.classInformation.level || 'A1') as CEFRLevel,
        topic: editablePlan.classInformation.topic || '',
        lessonTitle: editablePlan.classInformation.topic || 'ESL Lesson',
        ageGroup: content.ageGroup || undefined,
        duration: '40',
        studentCount: editablePlan.classInformation.students || '20',
        slideCount: editableSlides.length || 15,
        sourceMode: 'direct',
      };
      const inputPrompt = (content as any).inputPrompt as string | undefined;
      const result = await regenerateSlides(editablePlan, ctx, inputPrompt, ctx.factSheet);
      setEditableSlides(result.slides || []);
      // Update content with new slides + prompt, then save
      const updated = { ...content, slides: result.slides, notebookLMPrompt: result.notebookLMPrompt };
      await onSave(updated);
      alert('Slides Regenerated Successfully');
    } catch (err: any) {
      console.error('Slide regeneration failed:', err);
      alert(`Slide regeneration failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsRegenerating(false);
    }
  }, [editablePlan, editableSlides, content, onSave]);
  const [editableReadingCompanion, setEditableReadingCompanion] =
    useState<ReadingCompanionContent>(content.readingCompanion);
  const [editableGames, setEditableGames] = useState<Game[]>(
    content.games || [],
  );
  const [worksheets, setWorksheets] = useState<Worksheet[]>(
    content.worksheets || [],
  );

  // Migration logic for decodableText -> decodableTexts and adding Prompts
  const initialPhonics = useMemo(() => {
    const raw = content.phonics;
    if (!raw)
      return { keyPoints: [], decodableTexts: [], decodableTextPrompts: [] };
    const texts =
      raw.decodableTexts ||
      (raw.decodableText ? [raw.decodableText] : []);
    const prompts = raw.decodableTextPrompts || texts.map(() => "");
    return { ...raw, decodableTexts: texts, decodableTextPrompts: prompts };
  }, [content.phonics]);

  const [phonicsContent, setPhonicsContent] =
    useState<PhonicsContent>(initialPhonics);
  const [grammarInfographicUrl, setGrammarInfographicUrl] = useState<
    string | undefined
  >(content.grammarInfographicUrl);
  const [blackboardImageUrl, setBlackboardImageUrl] = useState<
    string | undefined
  >(content.blackboardImageUrl);
  const [customGrammarPrompt, setCustomGrammarPrompt] = useState("");
  const [customWhiteboardPrompt, setCustomWhiteboardPrompt] = useState("");
  const [isGeneratingGrammar, setIsGeneratingGrammar] = useState(false);
  const [isGeneratingWhiteboard, setIsGeneratingWhiteboard] = useState(false);
  const [isGeneratingSingleGrammar, setIsGeneratingSingleGrammar] =
    useState(false);
  const [isGeneratingPhonicsPoint, setIsGeneratingPhonicsPoint] =
    useState(false);
  const [isGeneratingDecodableText, setIsGeneratingDecodableText] =
    useState(false);

  const [localFlashcards, setLocalFlashcards] = useState<Flashcard[]>(
    content.flashcards || [],
  );
  const [flashcardImages, setFlashcardImages] = useState<
    Record<number, string>
  >(content.flashcardImages || {});
  const [gameImageUrls, setGameImageUrls] = useState<
    Record<number, string>
  >(content.gameImageUrls || {});
  const [generatingCardIndex, setGeneratingCardIndex] = useState<number | null>(
    null,
  );
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const stopGeneratingRef = useRef(false);
  const [imageStyle, setImageStyle] = useState<'cartoon' | 'realistic'>('cartoon');
  const [customStylePrompt, setCustomStylePrompt] = useState('');
  const [isGeneratingSupporting, setIsGeneratingSupporting] = useState(false);
  const [supportingError, setSupportingError] = useState<string | null>(null);
  const supportingAbortRef = useRef<AbortController | null>(null);

  /** Phase 2: Generate supporting content from finalized lesson plan */
  const handleGenerateSupporting = useCallback(async () => {
    if (!editablePlan || !content._generationContext) {
      setSupportingError('Missing generation context. Please regenerate the lesson plan.');
      return;
    }
    setIsGeneratingSupporting(true);
    setSupportingError(null);
    supportingAbortRef.current = new AbortController();

    try {
      const merged = await generateSupportingContent(
        editablePlan,
        content._generationContext,
        content,
        supportingAbortRef.current.signal,
      );

      // Update all editable states with the new content
      setEditableSlides(merged.slides || []);
      setEditableGames(merged.games || []);
      setEditableReadingCompanion(merged.readingCompanion || { days: [], webResources: [] });
      setLocalFlashcards(merged.flashcards || []);
      if (merged.phonics) {
        setPhonicsContent(merged.phonics);
      }

      // Persist via parent callback
      await onSave(merged);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('Phase 2 generation failed:', err);
      setSupportingError(err.message || 'Generation failed. Please try again.');
    } finally {
      setIsGeneratingSupporting(false);
      supportingAbortRef.current = null;
    }
  }, [editablePlan, content, onSave]);

  const buildDefaultAssignment = (plan: StructuredLessonPlan | null): AssignmentSheet => {
    const existing = content.assignmentSheet;
    if (existing) return existing;
    const kp: string[] = [];
    if (plan) {
      // 课程简介：topic + 所有 objectives
      const introSummary = String(content.summary?.objectives || '').trim();
      const objLines = introSummary || (plan.lessonDetails.objectives || []).map((o, i) => `${i + 1}. ${o}`).join('\n');
      kp.push(`【课程简介】${plan.classInformation.topic}${objLines ? '\n' + objLines : ''}`);
      // 词汇：全部展示
      if (plan.lessonDetails.targetVocab?.length > 0)
        kp.push(`【本课词汇】${plan.lessonDetails.targetVocab.map(v => v.word).join('、')}`);
      // 语法/句型：全部展示，每条换行
      if (plan.lessonDetails.grammarSentences?.length > 0)
        kp.push(`【语法/句型】\n${plan.lessonDetails.grammarSentences.join('\n')}`);
      // Phonics：全部 keyPoints 展示，每条换行
      const phonicsKp = content.phonics?.keyPoints;
      if (phonicsKp && phonicsKp.length > 0)
        kp.push(`【Phonics】\n${phonicsKp.join('\n')}`);
    }
    return {
      studentName: '',
      lessonSummary: plan ? `本课学习主题：${plan.classInformation.topic}` : '',
      keyPoints: kp.slice(0, 5),
      assignments: [
        { title: '7-Day Learning Companion', description: '完成每日学习任务（详见 Companion 手册）', isFixed: true },
        { title: '复习本课词汇', description: '朗读并拼写所有目标词汇各3遍' },
      ],
      feedback: {
        ratings: [
          { dimension: '课堂参与度', dimension_en: 'Participation', score: 0 },
          { dimension: '词汇掌握', dimension_en: 'Vocabulary', score: 0 },
          { dimension: '语法运用', dimension_en: 'Grammar', score: 0 },
          { dimension: '发音表现', dimension_en: 'Pronunciation', score: 0 },
          { dimension: '学习态度', dimension_en: 'Attitude', score: 0 },
        ],
        overallComment: '',
      },
      showComment: true,
    };
  };
  const [assignmentSheet, setAssignmentSheet] = useState<AssignmentSheet>(() => buildDefaultAssignment(editablePlan));
  const [cardConfigs, setCardConfigs] = useState<
    Record<number, { ratio: string; isEditing: boolean }>
  >({});
  const [isAddingFlashcard, setIsAddingFlashcard] = useState(false);

  const [decodableTextImages, setDecodableTextImages] = useState<
    Record<number, string>
  >(content.decodableTextImages || {});
  const [generatingDtImageIndex, setGeneratingDtImageIndex] = useState<
    number | null
  >(null);

  useEffect(() => {
    setEditableSlides(content.slides || []);
    const plan = content.structuredLessonPlan || null;
    if (plan) {
      const today = new Date().toISOString().slice(0, 10);
      plan.classInformation = { ...plan.classInformation, date: today };
    }
    setEditablePlan(plan);
    setEditableReadingCompanion(content.readingCompanion);
    setLocalFlashcards(content.flashcards || []);
    setEditableGames(
      (content.games || []).map((g) => ({ ...g, isCompleted: false })),
    );
    setWorksheets(content.worksheets || []);
    setGrammarInfographicUrl(content.grammarInfographicUrl);
    setBlackboardImageUrl(content.blackboardImageUrl);

    const rawPhonics = content.phonics || {
      keyPoints: [],
      decodableTexts: [],
      decodableTextPrompts: [],
    };
    const texts =
      rawPhonics.decodableTexts ||
      (rawPhonics.decodableText
        ? [rawPhonics.decodableText]
        : []);
    const prompts = rawPhonics.decodableTextPrompts || texts.map(() => "");
    setPhonicsContent({
      ...rawPhonics,
      decodableTexts: texts,
      decodableTextPrompts: prompts,
    });
  }, [content]);
  // --- VIEWER & EXPORT LOGIC ---
  const {
    openViewer,
    triggerDownloadMd,
    handleDownloadFlashcardPDF,
    handleDownloadAllFlashcards,
    handleDownloadFlashcardImageGrid,
    handleDownloadFlashcardTextGrid,
  } = useExportUtils({
    editablePlan,
    editableSlides,
    localFlashcards,
    editableGames,
    editableReadingCompanion,
    worksheets,
    grammarInfographicUrl,
    blackboardImageUrl,
    phonicsContent,
    flashcardImages,
    decodableTextImages,
    viewLang,
    assignmentSheet,
  });
  const getCurrentContentObject = (): GeneratedContent => ({
    ...content,
    structuredLessonPlan: editablePlan!,
    slides: editableSlides,
    flashcards: localFlashcards,
    games: editableGames,
    readingCompanion: editableReadingCompanion,
    worksheets: worksheets,
    grammarInfographicUrl: grammarInfographicUrl,
    blackboardImageUrl: blackboardImageUrl,
    phonics: phonicsContent,
    flashcardImages: flashcardImages,
    decodableTextImages: decodableTextImages,
    gameImageUrls: gameImageUrls,
    assignmentSheet: assignmentSheet,
  });

  const { saveStatus, lastSaved, saveNow } = useAutoSave({
    getCurrentContentObject,
    onSave,
    editablePlan,
  });

  const handlePlanInfoChange = (
    section: keyof StructuredLessonPlan,
    field: string,
    value: string,
  ) => {
    if (!editablePlan) return;
    setEditablePlan({
      ...editablePlan,
      [section]: {
        ...editablePlan[section as keyof StructuredLessonPlan],
        [field]: value,
      },
    } as StructuredLessonPlan);
  };

  const handleArrayChange = (
    field: "objectives" | "materials" | "grammarSentences",
    index: number,
    value: string,
  ) => {
    if (!editablePlan) return;
    const newArray = [...(editablePlan.lessonDetails[field] as string[])];
    newArray[index] = value;
    setEditablePlan({
      ...editablePlan,
      lessonDetails: { ...editablePlan.lessonDetails, [field]: newArray },
    });
  };

  const deleteArrayItem = (
    field: "objectives" | "materials" | "grammarSentences",
    index: number,
  ) => {
    if (!editablePlan) return;
    const newArray = [...(editablePlan.lessonDetails[field] as string[])];
    newArray.splice(index, 1);
    setEditablePlan({
      ...editablePlan,
      lessonDetails: { ...editablePlan.lessonDetails, [field]: newArray },
    });
  };

  const deleteMaterialEntry = (index: number) => {
    if (!editablePlan) return;
    const newArray = [...editablePlan.lessonDetails.materials];
    newArray.splice(index, 1);
    setEditablePlan({
      ...editablePlan,
      lessonDetails: { ...editablePlan.lessonDetails, materials: newArray },
    });
  };

  const moveArrayItem = (
    field: "objectives" | "materials" | "grammarSentences",
    index: number,
    direction: "up" | "down",
  ) => {
    if (!editablePlan) return;
    const newArray = [...(editablePlan.lessonDetails[field] as string[])];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newArray.length) return;
    [newArray[index], newArray[targetIndex]] = [
      newArray[targetIndex],
      newArray[index],
    ];
    setEditablePlan({
      ...editablePlan,
      lessonDetails: { ...editablePlan.lessonDetails, [field]: newArray },
    });
  };

  const handleFlashcardChange = (
    index: number,
    field: keyof Flashcard,
    value: string,
  ) => {
    const updated = [...localFlashcards];
    updated[index] = { ...updated[index], [field]: value };
    setLocalFlashcards(updated);
  };

  const addFlashcard = () => {
    const blankCard: Flashcard = {
      word: "",
      definition: "",
      visualPrompt: "",
      type: "vocabulary",
    };
    setLocalFlashcards([...localFlashcards, blankCard]);
  };

  const handleGenerateDefinition = async (index: number) => {
    const word = localFlashcards[index]?.word?.trim();
    if (!word || !editablePlan) return;
    try {
      const level = editablePlan.classInformation.level as CEFRLevel;
      const definition = await generateVocabDefinition(word, level);
      if (definition) {
        const updated = [...localFlashcards];
        updated[index] = { ...updated[index], definition };
        setLocalFlashcards(updated);
      }
    } catch (e) {
      console.error('Failed to generate definition', e);
    }
  };

  const removeFlashcard = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const newCards = localFlashcards.filter((_, i) => i !== index);
    setLocalFlashcards(newCards);
    // Rebuild image mapping: remove deleted index, shift keys above it down by 1
    setFlashcardImages((prev) => {
      const rebuilt: Record<number, string> = {};
      for (const [key, val] of Object.entries(prev) as [string, string][]) {
        const k = Number(key);
        if (k < index) rebuilt[k] = val;
        else if (k > index) rebuilt[k - 1] = val;
        // k === index is the deleted card's image, skip it
      }
      return rebuilt;
    });
  };

  // --- Flashcard Helper Functions ---
  const getCardConfig = (index: number) =>
    cardConfigs[index] || { ratio: "1:1", isEditing: false };
  const updateCardConfig = (
    index: number,
    updates: Partial<{ ratio: string; isEditing: boolean }>,
  ) => {
    setCardConfigs((prev) => ({
      ...prev,
      [index]: { ...getCardConfig(index), ...updates },
    }));
  };

  const handleGenerateFlashcardImage = async (
    index: number,
    prompt: string,
  ) => {
    if (generatingCardIndex !== null) return;
    setGeneratingCardIndex(index);
    try {
      const config = getCardConfig(index);
      // Enhanced prompt context for ESL materials — style-aware
      const rawPrompt = prompt.trim() || localFlashcards[index].word;
      // Strip cartoon-style keywords when generating realistic images
      const safePrompt = imageStyle === 'realistic'
        ? rawPrompt.replace(/\b(cartoon|vector|illustrated|2d|flat|anime|pixar|animated|drawing|sketch)\b/gi, '').replace(/\s{2,}/g, ' ').trim()
        : rawPrompt;
      const basePrompt = imageStyle === 'cartoon'
        ? `Simple, clean educational illustration showing the action or meaning of "${safePrompt}". Show only the subject clearly performing the action described. Plain white background, 2D flat vector style, clean lines, centered composition. No text, no banners, no ribbons, no decorative borders, no confetti, no ornamental elements. Use Pathway Academy palette (hot pink #E84C8A, sky blue #2E9FD9, golden yellow #F5C518, deep navy #1A2B58) for clothing and accessories. Keep natural colors realistic (skin tones, food, animals, plants).`
        : `Real photograph clearly showing the action or meaning of "${safePrompt}". Clean white studio background, DSLR camera, natural lighting, sharp focus, centered. No decorative elements, no text, no watermarks, no banners. NOT a 3D render, NOT a cartoon.`;
      const enhancedPrompt = customStylePrompt.trim() ? `${basePrompt} Additional style: ${customStylePrompt.trim()}` : basePrompt;
      console.log('[FlashcardGen] imageStyle:', imageStyle, '| prompt:', enhancedPrompt.substring(0, 80));
      const imageUrl = await generateLessonImage(enhancedPrompt, config.ratio);
      setFlashcardImages((prev) => ({ ...prev, [index]: imageUrl }));
      updateCardConfig(index, { isEditing: false });
      // Force immediate save so images survive refresh
      setTimeout(() => saveNow(), 100);
    } catch (error) {
      console.error("Flashcard generation error", error);
    } finally {
      setGeneratingCardIndex(null);
    }
  };

  const handleGenerateAllImages = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isGeneratingAll) return;
    setIsGeneratingAll(true);
    stopGeneratingRef.current = false;

    for (let i = 0; i < localFlashcards.length; i++) {
      if (stopGeneratingRef.current) break;
      if (flashcardImages[i] && (flashcardImages[i].startsWith('data:') || flashcardImages[i].startsWith('http'))) continue;

      await handleGenerateFlashcardImage(i, localFlashcards[i].visualPrompt);
    }

    setIsGeneratingAll(false);
  };

  const handleStopGenerating = (e: React.MouseEvent) => {
    e.stopPropagation();
    stopGeneratingRef.current = true;
    setIsGeneratingAll(false);
  };

  const handleDownloadFlashcard = (index: number) => {
    const imageUrl = flashcardImages[index];
    if (!imageUrl) return;
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = `flashcard_${localFlashcards[index].word.replace(/\s+/g, "_")}_front.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadFlashcardText = (index: number) => {
    const card = localFlashcards[index];
    const content = `Word: ${card.word}\nDefinition: ${card.definition}`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `flashcard_${card.word.replace(/\s+/g, "_")}_back.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };



  const handleGenerateDtImage = async (index: number) => {
    if (generatingDtImageIndex !== null) return;
    setGeneratingDtImageIndex(index);
    try {
      const promptText =
        phonicsContent.decodableTextPrompts[index] ||
        phonicsContent.decodableTexts[index];
      const safePrompt = promptText.trim().substring(0, 300);
      const dtBasePrompt = imageStyle === 'cartoon'
        ? `A four-panel comic strip reflecting the plot of the story: ${safePrompt}. Unified 2D flat vector style. Use Pathway Academy brand palette (hot pink #E84C8A, sky blue #2E9FD9, golden yellow #F5C518, deep navy #1A2B58) as the primary color scheme for character outfits, speech bubbles, panel borders, and background elements. Keep skin tones and inherently natural-colored objects realistic. Consistent character design, clean lines, professional children's book illustration.`
        : `A four-panel photographic storyboard reflecting the plot: ${safePrompt}. Real photography style, DSLR camera quality, cinematic lighting, detailed and vivid. NOT 3D rendered, NOT cartoon. High-quality editorial children's book photography.`;
      const enhancedPrompt = customStylePrompt.trim() ? `${dtBasePrompt} Additional style: ${customStylePrompt.trim()}` : dtBasePrompt;
      const imageUrl = await generateLessonImage(enhancedPrompt, "3:4");
      setDecodableTextImages((prev) => ({ ...prev, [index]: imageUrl }));
    } catch (error) {
      console.error("Failed to generate decodable text image", error);
    } finally {
      setGeneratingDtImageIndex(null);
    }
  };

  const handleGenerateGrammarInfographic = async () => {
    if (!editablePlan || isGeneratingGrammar) return;
    setIsGeneratingGrammar(true);
    try {
      const grammarText =
        editablePlan.lessonDetails.grammarSentences.join(". ");
      const vocabText = editablePlan.lessonDetails.targetVocab
        .map((v) => `${v.word}`)
        .join(", ");

      const infographicStyle = imageStyle === 'cartoon'
        ? 'Unified 2D flat vector illustration style. Use Pathway Academy brand palette (hot pink #E84C8A, sky blue #2E9FD9, golden yellow #F5C518, deep navy #1A2B58) as the primary color scheme for headers, icons, arrows, labels, clothing, and decorative elements. Keep inherently natural colors realistic (skin tones, food, animals). Clean lines, consistent icon style, playful but professional.'
        : 'Photorealistic style with studio photography of real objects, clean white background, professional editorial layout, high-contrast.';
      let prompt = `Create a high-quality educational infographic handout for ESL students (CEFR Level ${editablePlan.classInformation.level}). 
        Topic: ${editablePlan.classInformation.topic}. 
        Include visual representations for these Grammar Points: ${grammarText}.
        Include visual representations for this Target Vocabulary: ${vocabText}.
        Style: ${infographicStyle}${customStylePrompt.trim() ? ` Additional style: ${customStylePrompt.trim()}.` : ''} Combine these elements into a single cohesive handout. No complex sentences, focus on clear icons and simple labels.`;

      if (customGrammarPrompt.trim()) {
        prompt += ` Specifically incorporate these instructions: ${customGrammarPrompt.trim()}`;
      }

      const imageUrl = await generateLessonImage(prompt, "3:4");
      setGrammarInfographicUrl(imageUrl);
    } catch (e: unknown) {
      console.error("Infographic generation failed", e);
    } finally {
      setIsGeneratingGrammar(false);
    }
  };

  const handleGenerateWhiteboardDesign = async () => {
    if (!editablePlan || isGeneratingWhiteboard) return;
    setIsGeneratingWhiteboard(true);
    try {
      const topic = editablePlan.classInformation.topic;
      const grammarText =
        editablePlan.lessonDetails.grammarSentences.join(". ");
      const vocabText = editablePlan.lessonDetails.targetVocab
        .map((v) => v.word)
        .join(", ");

      const wbStyle = imageStyle === 'cartoon'
        ? 'Unified 2D flat vector illustration style. Use Pathway Academy brand palette (hot pink #E84C8A, sky blue #2E9FD9, golden yellow #F5C518, deep navy #1A2B58) as the primary color scheme for section dividers, title boxes, icons, markers, clothing, and decorative elements. Keep inherently natural colors realistic (skin tones, food, animals). Clean whiteboard aesthetic, playful icons, consistent visual language.'
        : 'Clean whiteboard aesthetic with high-contrast black and colored marker colors on a clean white background, photorealistic educational illustrations. Rich in images and text.';
      let prompt = `Create a professional classroom whiteboard layout design for an ESL English lesson. 
        Topic: ${topic}. 
        Content context: Grammar (${grammarText}), Vocabulary (${vocabText}).
        Requirement: Combine illustrations and text, clear structured layout with sections like 'Vocabulary', 'Grammar', and 'Conversation'. 
        Style: ${wbStyle}${customStylePrompt.trim() ? ` Additional style: ${customStylePrompt.trim()}.` : ''} Rich in images and text, with a clear logical structure.`;

      if (customWhiteboardPrompt.trim()) {
        prompt += ` Extra instructions: ${customWhiteboardPrompt.trim()}`;
      }

      const imageUrl = await generateLessonImage(prompt, "16:9");
      setBlackboardImageUrl(imageUrl);
    } catch (e: unknown) {
      console.error("Whiteboard generation failed", e);
    } finally {
      setIsGeneratingWhiteboard(false);
    }
  };

  const handleGenerateSingleGrammar = async () => {
    if (!editablePlan || isGeneratingSingleGrammar) return;
    setIsGeneratingSingleGrammar(true);
    try {
      const newSentence = await generateSingleGrammarPoint(
        editablePlan.classInformation.level as CEFRLevel,
        editablePlan.classInformation.topic,
        editablePlan.lessonDetails.grammarSentences,
      );
      if (newSentence) {
        const newArray = [
          ...editablePlan.lessonDetails.grammarSentences,
          newSentence,
        ];
        setEditablePlan({
          ...editablePlan,
          lessonDetails: {
            ...editablePlan.lessonDetails,
            grammarSentences: newArray,
          },
        });
      }
    } catch (e: unknown) {
      console.error("Failed to generate grammar point", e);
    } finally {
      setIsGeneratingSingleGrammar(false);
    }
  };

  const handleAddPhonicsPoint = async () => {
    if (!editablePlan || isGeneratingPhonicsPoint) return;
    setIsGeneratingPhonicsPoint(true);
    try {
      const vocab = editablePlan.lessonDetails.targetVocab.map((v) => v.word);
      const newPoint = await generateSinglePhonicsPoint(
        editablePlan.classInformation.level as CEFRLevel,
        editablePlan.classInformation.topic,
        phonicsContent.keyPoints,
        vocab,
      );
      if (newPoint) {
        setPhonicsContent({
          ...phonicsContent,
          keyPoints: [...phonicsContent.keyPoints, newPoint],
        });
      }
    } catch (e: unknown) {
      console.error("Failed to generate phonics point", e);
      setPhonicsContent({
        ...phonicsContent,
        keyPoints: [...phonicsContent.keyPoints, "New point"],
      });
    } finally {
      setIsGeneratingPhonicsPoint(false);
    }
  };

  const handleAddDecodableText = async () => {
    if (!editablePlan || isGeneratingDecodableText) return;
    setIsGeneratingDecodableText(true);
    try {
      const vocab = editablePlan.lessonDetails.targetVocab.map((v) => v.word);
      const result = await generateSingleDecodableText(
        editablePlan.classInformation.level as CEFRLevel,
        editablePlan.classInformation.topic,
        phonicsContent.keyPoints,
        vocab,
      );
      if (result) {
        setPhonicsContent({
          ...phonicsContent,
          decodableTexts: [...phonicsContent.decodableTexts, result.text],
          decodableTextPrompts: [
            ...phonicsContent.decodableTextPrompts,
            result.visualPrompt,
          ],
        });
      }
    } catch (e: unknown) {
      console.error("Failed to generate decodable text", e);
      setPhonicsContent({
        ...phonicsContent,
        decodableTexts: [
          ...phonicsContent.decodableTexts,
          "New decodable story...",
        ],
        decodableTextPrompts: [
          ...phonicsContent.decodableTextPrompts,
          "Simple illustration prompt",
        ],
      });
    } finally {
      setIsGeneratingDecodableText(false);
    }
  };

  const handleDownloadGrammarInfographic = () => {
    if (!grammarInfographicUrl) return;
    const link = document.createElement("a");
    link.href = grammarInfographicUrl;
    link.download = `Lesson_Infographic_${editablePlan?.classInformation.topic.replace(/\s+/g, "_") || "Lesson"}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadWhiteboardDesign = () => {
    if (!blackboardImageUrl) return;
    const link = document.createElement("a");
    link.href = blackboardImageUrl;
    link.download = `Whiteboard_Design_${editablePlan?.classInformation.topic.replace(/\s+/g, "_") || "Lesson"}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const tabs = [
    { id: "plan", label: "Lesson Plan", icon: GraduationCap },
    { id: "slides", label: "Slides Outline", icon: Presentation },
    { id: "materials", label: "Materials", icon: Layers },
    { id: "games", label: "Activities", icon: Gamepad2 },
    { id: "companion", label: "Companion", icon: BookOpen },
    { id: "assignment", label: "课后作业", icon: ClipboardList },
  ];
  const isPlanOnly = content.generationPhase === 'plan_only';
  const groundingBanner = useMemo(() => {
    const issues = content.qualityGate?.issues || [];
    const fallbackIssue = issues.find((issue) =>
      /fallback|notebooklm|notebook|rag|unavailable|no usable fact sheet|needs_review/i.test(issue),
    );
    const notebookId = content.knowledgeNotebookId;
    const sourceCount = content.groundingSources?.length || 0;
    const urlCount = (content.groundingSources || []).filter((s) => Boolean(s.url)).length;

    if (content.groundingStatus === "verified" && notebookId) {
      return {
        kind: "connected" as const,
        title: "NotebookLM connected",
        detail: `Grounded with notebook ${notebookId} (${sourceCount} source, ${urlCount} URL).`,
      };
    }

    if (fallbackIssue || content.groundingStatus === "unverified") {
      return {
        kind: "fallback" as const,
        title: "Fallback mode (manual review required)",
        detail: fallbackIssue || "Notebook grounding was unavailable for this generation.",
      };
    }

    if (notebookId) {
      return {
        kind: "connected" as const,
        title: "NotebookLM partially grounded",
        detail: `Notebook ${notebookId} was used (${sourceCount} source, ${urlCount} URL), but teacher review is recommended.`,
      };
    }

    return null;
  }, [content.groundingStatus, content.knowledgeNotebookId, content.qualityGate?.issues]);

  return (
    <div className="overflow-hidden flex flex-col">
      {/* Unified Sticky Header - Always Stacked */}
      <div className="flex flex-col gap-3 sticky top-6 z-40 bg-white dark:bg-slate-900/80/90 backdrop-blur-xl p-3 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm mx-4 mt-4 no-print">
        {/* Tabs Group */}
        <div className="flex flex-nowrap overflow-x-auto pb-1 gap-2 items-center hide-scrollbar w-full">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                // Fix E: Disable non-plan tabs in plan_only mode
                if (isPlanOnly && tab.id !== 'plan') return;
                setActiveTab(tab.id as typeof activeTab);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-bold transition-all whitespace-nowrap flex-shrink-0
                ${isPlanOnly && tab.id !== 'plan'
                  ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed opacity-50'
                  : activeTab === tab.id
                    ? "bg-brand text-white shadow-md shadow-brand/30 translate-y-[-1px]"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 hover:text-slate-900"}`}
              title={isPlanOnly && tab.id !== 'plan' ? '⏳ Generate supporting content first' : undefined}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {groundingBanner && (
          <div className={`rounded-xl border px-3 py-2 text-xs ${groundingBanner.kind === "connected"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-amber-200 bg-amber-50 text-amber-700"
            }`}>
            <div className="font-bold">{groundingBanner.title}</div>
            <div className="mt-0.5 opacity-90">{groundingBanner.detail}</div>
          </div>
        )}

        {content.groundingSources && content.groundingSources.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
            <div className="font-bold mb-1">Grounding Sources ({content.groundingSources.length})</div>
            <div className="max-h-24 overflow-auto space-y-1">
              {content.groundingSources.slice(0, 8).map((source, index) => (
                <div key={`${source.id || source.title || index}`} className="flex items-center gap-2">
                  <span className="text-slate-500">{index + 1}.</span>
                  <span className="truncate">{source.title || source.id || "Untitled source"}</span>
                  {source.url && (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-600 hover:underline flex-shrink-0"
                    >
                      link
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {content.groundingCoverage && content.groundingCoverage.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
            <div className="font-bold mb-1">Coverage By Section</div>
            <div className="space-y-1">
              {content.groundingCoverage.map((item) => (
                <div key={item.section} className="flex items-start gap-2">
                  <span className="font-semibold text-slate-900">{item.section}</span>
                  <span className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] uppercase">
                    {item.evidenceType}
                  </span>
                  <span className="text-slate-600">{item.note}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions Group */}
        <div className="no-print flex items-center justify-end gap-3 w-full pt-3 border-t border-slate-100 dark:border-white/5">
          {content.scoreReport ? (
            <div className={`mr-auto px-3 py-1.5 rounded-full text-xs font-bold border ${content.scoreReport.reviewerStatus === "ready_to_teach"
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-amber-50 text-amber-700 border-amber-200"
              }`}>
              {`Quality ${content.scoreReport.overallScore}/100 · ${content.scoreReport.reviewerStatus === "ready_to_teach" ? "Ready" : "Needs Review"}`}
            </div>
          ) : isPlanOnly ? (
            <div className="mr-auto px-3 py-1.5 rounded-full text-xs font-bold border border-indigo-200 bg-indigo-50 text-indigo-700">
              ⏳ Quality score pending — generate supporting content first
            </div>
          ) : null}
          <button
            onClick={() => openViewer(activeTab as string, activeTab === 'materials' ? materialTab : undefined)}
            disabled={isPlanOnly && activeTab !== 'plan'}
            className={`flex items-center justify-center gap-2 px-5 py-2 bg-slate-100 text-slate-700 dark:text-slate-400 rounded-full hover:bg-slate-200 transition-colors whitespace-nowrap text-sm font-bold ${isPlanOnly && activeTab !== 'plan' ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Printer className="w-4 h-4" />
            <span className="hidden md:inline">Print View</span>
          </button>
          <button
            onClick={saveNow}
            disabled={saveStatus === "saving" || saveStatus === "saved"}
            className={`flex items-center justify-center gap-2 px-5 py-2 text-white rounded-full transition-all text-sm font-bold whitespace-nowrap ${saveStatus === "saved"
              ? "bg-emerald-500 hover:bg-emerald-500 cursor-default disabled:opacity-100 shadow-md"
              : "bg-slate-900 hover:bg-slate-800 hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:translate-y-0"
              }`}
          >
            {saveStatus === "saving" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saveStatus === "saved" ? (
              <Check className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span className="hidden md:inline">
              {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved" : "Save"}
            </span>
          </button>
        </div>
      </div>

      {/* Input Prompt Display — copyable for reuse */}
      {content.inputPrompt && (
        <div className="mx-4 mt-3 no-print">
          <details className="group">
            <summary className="cursor-pointer text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 hover:text-slate-700 dark:hover:text-slate-200 transition-colors select-none">
              <FileText className="w-3.5 h-3.5" />
              Custom Prompt Used
              <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-2 relative">
              <pre className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-3 pr-10 whitespace-pre-wrap max-h-40 overflow-auto font-mono leading-relaxed">
                {content.inputPrompt}
              </pre>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(content.inputPrompt || '');
                  const btn = document.getElementById('copy-prompt-btn');
                  if (btn) { btn.textContent = '✓'; setTimeout(() => { btn.textContent = ''; }, 1500); }
                }}
                id="copy-prompt-btn"
                className="absolute top-2 right-2 p-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 transition-colors"
                title="Copy to clipboard"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </details>
        </div>
      )}

      {/* Phase 2: Generate Supporting Content Banner */}
      {isPlanOnly && (
        <div className="mx-4 mt-3 p-4 rounded-2xl border-2 border-dashed border-indigo-300 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 no-print">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex-1">
              <h4 className="font-bold text-indigo-900 dark:text-indigo-300 text-sm flex items-center gap-2">
                <Rocket className="w-4 h-4" />
                教案已就绪 — 一键生成配套内容
              </h4>
              <p className="text-xs text-indigo-700/70 dark:text-indigo-400/70 mt-1">
                请先审阅并修改教案，确认无误后点击按钮生成幻灯片、活动卡、闪卡、Companion 等全部配套内容。
              </p>
              {supportingError && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {supportingError}
                </p>
              )}
            </div>
            <button
              onClick={handleGenerateSupporting}
              disabled={isGeneratingSupporting}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full font-bold text-sm shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:hover:translate-y-0 whitespace-nowrap"
            >
              {isGeneratingSupporting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> 生成中...</>
              ) : (
                <><Rocket className="w-4 h-4" /> 🚀 生成配套内容</>
              )}
            </button>
          </div>
        </div>
      )}

      <div className="p-4 md:p-5 flex-1 bg-slate-50/30 min-h-[500px]">
        {activeTab === "plan" && editablePlan && (
          <LessonPlanTab
            editablePlan={editablePlan}
            setEditablePlan={setEditablePlan as any}
            sentenceCitations={content.sentenceCitations}
          />
        )}

        {activeTab === "slides" && (
          <SlidesTab
            editableSlides={editableSlides}
            setEditableSlides={setEditableSlides as any}
            notebookLMPrompt={content.notebookLMPrompt}
            onExportSlides={handleExportSlides}
            exportState={exportState}
            onCancelExport={cancelExport}
            onRegenerateSlides={handleRegenerateSlides}
            isRegenerating={isRegenerating}
          />
        )}

        {activeTab === "materials" && (
          <div className="space-y-6">
            <div className="flex border-b border-slate-200 dark:border-white/10 mb-6 overflow-x-auto no-print scrollbar-hide">
              {[
                { id: "flashcards", label: "Flashcards", icon: ImageIcon },
                { id: "worksheets", label: "Worksheets", icon: FileText },
                { id: "grammar", label: "Infographic", icon: Palette },
                { id: "phonics", label: "Phonics", icon: Music },
                { id: "whiteboard", label: "Whiteboard", icon: PencilLine },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setMaterialTab(tab.id as typeof materialTab)}
                  className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${materialTab === tab.id ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-600"}`}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Image Style Selector */}
            <div className="flex items-center gap-3 mb-4 no-print">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Image Style</span>
              <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-white/10">
                <button
                  onClick={() => setImageStyle('cartoon')}
                  className={`px-3 py-1.5 text-xs font-bold transition-all ${imageStyle === 'cartoon' ? 'bg-brand text-white' : 'bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-700'}`}
                >
                  🎨 Cartoon
                </button>
                <button
                  onClick={() => setImageStyle('realistic')}
                  className={`px-3 py-1.5 text-xs font-bold transition-all ${imageStyle === 'realistic' ? 'bg-brand text-white' : 'bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-700'}`}
                >
                  📷 Realistic
                </button>
              </div>
              <span className="text-[10px] text-slate-400">
                {imageStyle === 'cartoon' ? 'Unified vector style with brand colors' : 'Photorealistic images'}
              </span>
            </div>
            <div className="flex items-center gap-2 mb-4 no-print">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide shrink-0">Style Hint</span>
              <input
                value={customStylePrompt}
                onChange={(e) => setCustomStylePrompt(e.target.value)}
                placeholder="e.g. Disney Pixar style, anime style, watercolor..."
                className="flex-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition-all placeholder:text-slate-300"
                title="Custom style hint for image generation"
              />
              {customStylePrompt && (
                <button onClick={() => setCustomStylePrompt('')} className="text-slate-300 hover:text-red-500 transition-colors" title="Clear style hint">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              )}
            </div>

            {materialTab === "flashcards" && (
              <FlashcardsTab
                localFlashcards={localFlashcards}
                flashcardImages={flashcardImages}
                isGeneratingAll={isGeneratingAll}
                isAddingFlashcard={isAddingFlashcard}
                generatingCardIndex={generatingCardIndex}
                handleDownloadAllFlashcards={handleDownloadAllFlashcards}
                handleDownloadFlashcardImageGrid={handleDownloadFlashcardImageGrid}
                handleDownloadFlashcardTextGrid={handleDownloadFlashcardTextGrid}
                handleStopGenerating={handleStopGenerating}
                handleGenerateAllImages={handleGenerateAllImages}
                addFlashcard={addFlashcard}
                handleGenerateFlashcardImage={handleGenerateFlashcardImage}
                handleDownloadFlashcard={handleDownloadFlashcard}
                handleDownloadFlashcardText={handleDownloadFlashcardText}
                handleDownloadFlashcardPDF={handleDownloadFlashcardPDF}
                removeFlashcard={removeFlashcard}
                handleFlashcardChange={handleFlashcardChange}
                onGenerateDefinition={handleGenerateDefinition}
              />
            )}

            {materialTab === "worksheets" && (
              <WorksheetsTab
                worksheets={worksheets}
                setWorksheets={setWorksheets}
                editablePlan={editablePlan}
              />
            )}

            {materialTab === "grammar" && (
              <GrammarTab
                grammarInfographicUrl={grammarInfographicUrl}
                customGrammarPrompt={customGrammarPrompt}
                isGeneratingGrammar={isGeneratingGrammar}
                isGeneratingSingleGrammar={isGeneratingSingleGrammar}
                editablePlan={editablePlan}
                setCustomGrammarPrompt={setCustomGrammarPrompt}
                handleDownloadGrammarInfographic={
                  handleDownloadGrammarInfographic
                }
                handleGenerateGrammarInfographic={
                  handleGenerateGrammarInfographic
                }
                handleGenerateSingleGrammar={handleGenerateSingleGrammar}
                handleArrayChange={handleArrayChange}
                deleteArrayItem={deleteArrayItem}
              />
            )}

            {materialTab === "whiteboard" && (
              <WhiteboardTab
                blackboardImageUrl={blackboardImageUrl}
                customWhiteboardPrompt={customWhiteboardPrompt}
                isGeneratingWhiteboard={isGeneratingWhiteboard}
                setCustomWhiteboardPrompt={setCustomWhiteboardPrompt}
                handleDownloadWhiteboardDesign={handleDownloadWhiteboardDesign}
                handleGenerateWhiteboardDesign={handleGenerateWhiteboardDesign}
              />
            )}

            {materialTab === "phonics" && (
              <PhonicsTab
                phonicsContent={phonicsContent}
                setPhonicsContent={setPhonicsContent}
                editablePlan={editablePlan}
                isGeneratingPhonicsPoint={isGeneratingPhonicsPoint}
                isGeneratingDecodableText={isGeneratingDecodableText}
                decodableTextImages={decodableTextImages}
                generatingDtImageIndex={generatingDtImageIndex}
                handleAddPhonicsPoint={handleAddPhonicsPoint}
                handleAddDecodableText={handleAddDecodableText}
                handleGenerateDtImage={handleGenerateDtImage}
              />
            )}
          </div>
        )}

        {activeTab === "games" && (
          <ActivitiesTab
            editableGames={editableGames}
            setEditableGames={setEditableGames as any}
            editablePlan={editablePlan}
            gameImages={gameImageUrls}
            onGameImagesChange={setGameImageUrls}
          />
        )}

        {activeTab === "companion" && (
          <CompanionTab
            editableReadingCompanion={editableReadingCompanion}
            setEditableReadingCompanion={setEditableReadingCompanion as any}
            editablePlan={editablePlan}
            ageGroup={content.ageGroup || content._generationContext?.ageGroup}
            sentenceCitations={content.sentenceCitations}
          />
        )}

        {activeTab === "assignment" && (
          <AssignmentTab
            assignmentSheet={assignmentSheet}
            setAssignmentSheet={setAssignmentSheet}
            editablePlan={editablePlan}
            phonicsKeyPoints={content.phonics?.keyPoints}
          />
        )}
      </div>
      {/* Scroll to top */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-50 p-3 rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 hover:shadow-xl hover:-translate-y-0.5 transition-all no-print"
          title="回到顶部"
        >
          <ArrowUp size={20} />
        </button>
      )}
    </div>
  );
};
