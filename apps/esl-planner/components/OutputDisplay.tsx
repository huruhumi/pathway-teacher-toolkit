import React, { useState, useEffect, useRef, useMemo } from "react";
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
} from "../types";
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
} from "lucide-react";
import {
  generateLessonImage,
  generateReadingTask,
  generateWebResource,
  generateTrivia,
  generateWorksheet,
  generateNewCompanionDay,
  generateSingleGame,
  generateSingleFlashcard,
  generateSingleGrammarPoint,
  generateSinglePhonicsPoint,
  generateSingleDecodableText,
  generateSingleObjective,
  generateSingleMaterial,
  generateSingleVocabItem,
  generateSingleAnticipatedProblem,
  generateSingleStage,
  generateReadingPassage,
  translateLessonKit,
} from "../services/geminiService";
import JSZip from "jszip";
import { jsPDF } from "jspdf";
import { useExportUtils } from "../hooks/useExportUtils";
import { useAutoSave } from "@shared/hooks/useAutoSave";
import { useDocxExport } from "../hooks/useDocxExport";
import { usePptxExport } from "../hooks/usePptxExport";
import { LessonPlanTab } from "./tabs/LessonPlanTab";
import { SlidesTab } from "./tabs/SlidesTab";
import { ActivitiesTab } from "./tabs/ActivitiesTab";
import { CompanionTab } from "./tabs/CompanionTab";
import { AutoResizeTextarea } from "./common/AutoResizeTextarea";
import { FlashcardsTab } from "./tabs/materials/FlashcardsTab";
import { GrammarTab } from "./tabs/materials/GrammarTab";
import { WhiteboardTab } from "./tabs/materials/WhiteboardTab";
import { PhonicsTab } from "./tabs/materials/PhonicsTab";
import { WorksheetsTab } from "./tabs/materials/WorksheetsTab";

interface OutputDisplayProps {
  content: GeneratedContent;
  onSave: (content: GeneratedContent) => void;
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
  <div className="bg-white border-2 border-indigo-100 rounded-2xl p-4 shadow-sm viewer-correction-legend">
    <h5 className="text-[10px] font-black text-indigo-900 uppercase tracking-widest mb-3 flex items-center gap-2">
      <Info className="w-3 h-3 text-indigo-500" />
      Proofreading Marks Reference / 修改符号参考
    </h5>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 bg-indigo-50 rounded flex items-center justify-center font-bold text-indigo-600">
          ^
        </span>
        <span className="text-[10px] font-medium text-gray-600">
          Insert / 插入
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 bg-indigo-50 rounded flex items-center justify-center font-bold text-indigo-600">
          /
        </span>
        <span className="text-[10px] font-medium text-gray-600">
          Delete / 删除
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 bg-indigo-50 rounded flex items-center justify-center font-bold text-indigo-600">
          ○
        </span>
        <span className="text-[10px] font-medium text-gray-600">
          Replace / 替换
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 bg-indigo-50 rounded flex items-center justify-center font-bold text-indigo-600">
          ~
        </span>
        <span className="text-[10px] font-medium text-gray-600">
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
    "plan" | "slides" | "materials" | "games" | "companion"
  >("plan");
  const [isSaving, setIsSaving] = useState(false);
  const [materialTab, setMaterialTab] = useState<
    "flashcards" | "worksheets" | "grammar" | "phonics" | "whiteboard"
  >("flashcards");

  const [editableSlides, setEditableSlides] = useState<Slide[]>(
    content.slides || [],
  );
  const [editablePlan, setEditablePlan] = useState<StructuredLessonPlan | null>(
    content.structuredLessonPlan || null,
  );
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
      ((raw as any).decodableText ? [(raw as any).decodableText] : []);
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
  const [generatingCardIndex, setGeneratingCardIndex] = useState<number | null>(
    null,
  );
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const stopGeneratingRef = useRef(false);
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
    setEditablePlan(content.structuredLessonPlan || null);
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
      ((rawPhonics as any).decodableText
        ? [(rawPhonics as any).decodableText]
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
    handleDownloadPlanMd,
    handleDownloadSlidesMd,
    handleDownloadWorksheetsMd,
    handleDownloadCompanionMd,
    handleDownloadGamesMd,
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
  });

  const { saveStatus, lastSaved, saveNow } = useAutoSave({
    getCurrentContentObject,
    onSave,
    editablePlan,
  });

  const { exportLessonPlanDocx } = useDocxExport();
  const { exportSlidesPptx } = usePptxExport();

  const handleDownloadDocx = () => {
    if (editablePlan) exportLessonPlanDocx(getCurrentContentObject());
  };

  const handleDownloadPptx = () => {
    exportSlidesPptx(
      editableSlides,
      editablePlan?.classInformation.topic || "slides",
    );
  };

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
    } as any);
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

  const addFlashcard = async () => {
    if (!editablePlan || isAddingFlashcard) return;
    setIsAddingFlashcard(true);
    try {
      const existingWords = localFlashcards.map((c) => c.word);
      const newCard = await generateSingleFlashcard(
        editablePlan.classInformation.level as CEFRLevel,
        editablePlan.classInformation.topic,
        existingWords,
      );
      setLocalFlashcards([...localFlashcards, newCard]);
    } catch (e) {
      console.error("Failed to generate flashcard", e);
      // Fallback to manual if API fails
      const manualCard: Flashcard = {
        word: "New Word",
        definition: "Definition goes here...",
        visualPrompt: "Describe image here...",
        type: "vocabulary",
      };
      setLocalFlashcards([...localFlashcards, manualCard]);
    } finally {
      setIsAddingFlashcard(false);
    }
  };

  const removeFlashcard = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const newCards = localFlashcards.filter((_, i) => i !== index);
    setLocalFlashcards(newCards);
  };

  // --- Flashcard Helper Functions ---
  const getCardConfig = (index: number) =>
    cardConfigs[index] || { ratio: "4:3", isEditing: false };
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
      // Enhanced prompt context for ESL materials
      const safePrompt = prompt.trim() || localFlashcards[index].word;
      const enhancedPrompt = `High-quality, simple educational illustration of "${safePrompt}" for a children's vocabulary flashcard. Plain white background, professional 2D vector style, bright colors, centered, no text.`;
      const imageUrl = await generateLessonImage(enhancedPrompt, config.ratio);
      setFlashcardImages((prev) => ({ ...prev, [index]: imageUrl }));
      updateCardConfig(index, { isEditing: false });
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
      if (flashcardImages[i]) continue;

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

  const handleDownloadFlashcardPDF = (index: number) => {
    const card = localFlashcards[index];
    const imgData = flashcardImages[index];
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: [148, 105], // A6 Landscape
    });

    // Front Side (Image)
    if (imgData) {
      doc.addImage(imgData, "PNG", 10, 10, 128, 85);
      doc.addPage();
    }

    // Back Side (Explanation)
    doc.setFontSize(28);
    doc.setTextColor(79, 70, 229); // indigo-600
    doc.text(card.word, 148 / 2, 40, { align: "center" } as any);

    doc.setFontSize(14);
    doc.setTextColor(107, 114, 128); // gray-500
    doc.setFont("helvetica", "italic");
    const splitText = doc.splitTextToSize(card.definition, 120);
    doc.text(splitText, 148 / 2, 60, { align: "center" } as any);

    doc.save(
      `Flashcard_${card.word.replace(/\s+/g, "_")}_${editablePlan?.classInformation.topic.replace(/\s+/g, "_") || "Lesson"}.pdf`,
    );
  };

  const handleDownloadAllFlashcards = async () => {
    const zip = new JSZip();
    const folder = zip.folder("flashcards_bundle");

    for (let i = 0; i < localFlashcards.length; i++) {
      const card = localFlashcards[i];
      const imgData = flashcardImages[i];

      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: [148, 105], // A6 Landscape
      });

      // Front Side (Image or Placeholder)
      if (imgData) {
        doc.addImage(imgData, "PNG", 10, 10, 128, 85);
      } else {
        doc.setFontSize(20);
        doc.text("Ready for Image", 148 / 2, 105 / 2, {
          align: "center",
        } as any);
      }

      doc.addPage();

      // Back Side (Explanation)
      doc.setFontSize(28);
      doc.setTextColor(79, 70, 229); // indigo-600
      doc.text(card.word, 148 / 2, 40, { align: "center" } as any);

      doc.setFontSize(14);
      doc.setTextColor(107, 114, 128); // gray-500
      doc.setFont("helvetica", "italic");
      const splitText = doc.splitTextToSize(card.definition, 120);
      doc.text(splitText, 148 / 2, 60, { align: "center" } as any);

      const pdfData = doc.output("arraybuffer");
      folder?.file(
        `${card.word.replace(/\s+/g, "_")}_${editablePlan?.classInformation.topic.replace(/\s+/g, "_") || "Lesson"}_flashcard.pdf`,
        pdfData,
      );
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Flashcards_${editablePlan?.classInformation.topic.replace(/\s+/g, "_") || "Lesson"}.zip`;
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
      const enhancedPrompt = `A four-panel comic strip (四宫格漫画) reflecting the plot of the story: ${safePrompt}. Whimsical cartoon style, detailed, soft colors, high-quality character design, professional illustration.`;
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

      let prompt = `Create a high-quality educational infographic handout for ESL students (CEFR Level ${editablePlan.classInformation.level}). 
        Topic: ${editablePlan.classInformation.topic}. 
        Include visual representations for these Grammar Points: ${grammarText}.
        Include visual representations for this Target Vocabulary: ${vocabText}.
        The style should be a professional, clean, and colorful educational infographic that combines these elements into a single cohesive handout. No complex sentences, focus on clear icons and simple labels.`;

      if (customGrammarPrompt.trim()) {
        prompt += ` Specifically incorporate these instructions: ${customGrammarPrompt.trim()}`;
      }

      const imageUrl = await generateLessonImage(prompt, "3:4");
      setGrammarInfographicUrl(imageUrl);
    } catch (e) {
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

      let prompt = `Create a professional classroom whiteboard layout design for an ESL English lesson. 
        Topic: ${topic}. 
        Content context: Grammar (${grammarText}), Vocabulary (${vocabText}).
        Requirement: Combine illustrations and text, clear structured layout with sections like 'Vocabulary', 'Grammar', and 'Conversation'. 
        Style: Clean whiteboard aesthetic with high-contrast black and colored marker colors on a clean white background, clean professional handwriting style, professional educational illustrations. Rich in images and text, with a clear logical structure.`;

      if (customWhiteboardPrompt.trim()) {
        prompt += ` Extra instructions: ${customWhiteboardPrompt.trim()}`;
      }

      const imageUrl = await generateLessonImage(prompt, "16:9");
      setBlackboardImageUrl(imageUrl);
    } catch (e) {
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
    } catch (e) {
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
    } catch (e) {
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
    } catch (e) {
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
  ];

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden flex flex-col">
      <div className="flex flex-col md:flex-row border-b border-gray-100 justify-between items-stretch md:items-center no-print">
        <div className="flex overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-4 font-medium text-sm md:text-base transition-colors whitespace-nowrap
                ${activeTab === tab.id ? "text-primary border-b-2 border-primary bg-indigo-50/50" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </div>
        <div className="p-2 md:p-0 pr-4 no-print flex items-center gap-2">
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-gray-400">
              <span
                className={`w-2 h-2 rounded-full ${saveStatus === "saved" ? "bg-green-400" : saveStatus === "saving" ? "bg-yellow-400 animate-pulse" : "bg-orange-400 animate-pulse"}`}
              />
              <span>
                {saveStatus === "saved"
                  ? lastSaved
                    ? `Saved ${lastSaved.toLocaleTimeString()}`
                    : "Saved"
                  : saveStatus === "saving"
                    ? "Saving..."
                    : "Unsaved changes"}
              </span>
            </div>
            <button
              onClick={saveNow}
              disabled={saveStatus === "saving"}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm disabled:opacity-70 text-sm font-semibold"
            >
              {saveStatus === "saving" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saveStatus === "saving" ? "Saving..." : "Save Now"}
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-8 flex-1 bg-gray-50/30 min-h-[500px]">
        {activeTab === "plan" && editablePlan && (
          <LessonPlanTab
            editablePlan={editablePlan}
            setEditablePlan={setEditablePlan as any}
            openViewer={openViewer}
            handleDownloadPlanMd={handleDownloadPlanMd}
            handleDownloadDocx={handleDownloadDocx}
          />
        )}

        {activeTab === "slides" && (
          <SlidesTab
            editableSlides={editableSlides}
            setEditableSlides={setEditableSlides as any}
            notebookLMPrompt={content.notebookLMPrompt}
            openViewer={openViewer}
            handleDownloadSlidesMd={handleDownloadSlidesMd}
            handleDownloadPptx={handleDownloadPptx}
          />
        )}

        {activeTab === "materials" && (
          <div className="space-y-6">
            <div className="flex border-b border-gray-200 mb-6 overflow-x-auto no-print scrollbar-hide">
              {[
                { id: "flashcards", label: "Flashcards", icon: ImageIcon },
                { id: "worksheets", label: "Worksheets", icon: FileText },
                { id: "grammar", label: "Infographic", icon: Palette },
                { id: "phonics", label: "Phonics", icon: Music },
                { id: "whiteboard", label: "Whiteboard", icon: PencilLine },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setMaterialTab(tab.id as any)}
                  className={`px-6 py-3 text-sm font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${materialTab === tab.id ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-400 hover:text-gray-600"}`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {materialTab === "flashcards" && (
              <FlashcardsTab
                localFlashcards={localFlashcards}
                flashcardImages={flashcardImages}
                isGeneratingAll={isGeneratingAll}
                isAddingFlashcard={isAddingFlashcard}
                generatingCardIndex={generatingCardIndex}
                handleDownloadAllFlashcards={handleDownloadAllFlashcards}
                handleStopGenerating={handleStopGenerating}
                handleGenerateAllImages={handleGenerateAllImages}
                addFlashcard={addFlashcard}
                handleGenerateFlashcardImage={handleGenerateFlashcardImage}
                handleDownloadFlashcard={handleDownloadFlashcard}
                handleDownloadFlashcardText={handleDownloadFlashcardText}
                handleDownloadFlashcardPDF={handleDownloadFlashcardPDF}
                removeFlashcard={removeFlashcard}
                handleFlashcardChange={handleFlashcardChange}
              />
            )}

            {materialTab === "worksheets" && (
              <WorksheetsTab
                worksheets={worksheets}
                setWorksheets={setWorksheets}
                editablePlan={editablePlan}
                openViewer={openViewer}
                handleDownloadWorksheetsMd={handleDownloadWorksheetsMd}
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
                openViewer={openViewer}
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
                openViewer={openViewer}
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
                openViewer={openViewer}
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
            openViewer={openViewer}
            handleDownloadGamesMd={handleDownloadGamesMd}
          />
        )}

        {activeTab === "companion" && (
          <CompanionTab
            editableReadingCompanion={editableReadingCompanion}
            setEditableReadingCompanion={setEditableReadingCompanion as any}
            editablePlan={editablePlan}
            openViewer={openViewer}
            handleDownloadCompanionMd={handleDownloadCompanionMd}
          />
        )}
      </div>
    </div>
  );
};
