import React, { useState, useMemo } from "react";
import {
  Download,
  ExternalLink,
  Sparkles,
  Loader2,
  GripVertical,
  Trash2,
  Plus,
  ArrowUp,
  ArrowDown,
  FileText,
  Image as ImageIcon,
  Copy,
  FileIcon,
  MessageSquare,
  Settings2,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  FileCheck as AnswerKeyIcon,
  BookOpen,
  Layers,
  X,
  Image as LucideImage,
  Check,
  Info,
  PencilLine,
  AlertCircle,
} from "lucide-react";
import {
  Worksheet,
  WorksheetSection,
  WorksheetItem,
  StructuredLessonPlan,
  CEFRLevel,
} from "../../../types";
import { AutoResizeTextarea } from "../../common/AutoResizeTextarea";
import { useLanguage } from '../../../i18n/LanguageContext';
import {
  generateWorksheet,
  generateLessonImage,
  generateReadingPassage,
} from "../../../services/geminiService";

export interface WorksheetsTabProps {
  worksheets: Worksheet[];
  setWorksheets: (ws: Worksheet[]) => void;
  editablePlan: StructuredLessonPlan | null;
  openViewer: (tab: string, subTab: string) => void;
  handleDownloadWorksheetsMd: () => void;
}

const INDIGO_COLOR = "#4f46e5";

// Component for Correction Legend
const CorrectionLegend = () => (
  <div className="bg-white dark:bg-slate-900/80 dark:backdrop-blur-xl border-2 border-indigo-100 dark:border-indigo-900/30 rounded-2xl p-4 shadow-sm viewer-correction-legend">
    <h5 className="text-[10px] font-black text-indigo-900 uppercase tracking-widest mb-3 flex items-center gap-2">
      <Info className="w-3 h-3 text-indigo-500" />
      Proofreading Marks Reference / 修改符号参�?    </h5>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 bg-indigo-50 rounded flex items-center justify-center font-bold text-indigo-600">
          ^
        </span>
        <span className="text-[10px] font-medium text-slate-600">
          Insert / 插入
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 bg-indigo-50 rounded flex items-center justify-center font-bold text-indigo-600">
          /
        </span>
        <span className="text-[10px] font-medium text-slate-600">
          Delete / 删除
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 bg-indigo-50 rounded flex items-center justify-center font-bold text-indigo-600">
          �?        </span>
        <span className="text-[10px] font-medium text-slate-600">
          Replace / 替换
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 bg-indigo-50 rounded flex items-center justify-center font-bold text-indigo-600">
          ~
        </span>
        <span className="text-[10px] font-medium text-slate-600">
          Spelling / 拼写
        </span>
      </div>
    </div>
  </div>
);

export const WorksheetsTab: React.FC<WorksheetsTabProps> = ({
  worksheets,
  setWorksheets,
  editablePlan,
  openViewer,
  handleDownloadWorksheetsMd,
}) => {
  const { t } = useLanguage();
  const [regeneratingSectionId, setRegeneratingSectionId] = useState<
    string | null
  >(null);
  const [isGeneratingPassageId, setIsGeneratingPassageId] = useState<
    string | null
  >(null);

  // Worksheet Image Generation State
  const [generatingWsImageKey, setGeneratingWsImageKey] = useState<
    string | null
  >(null);

  // New Section Generator State
  const [isQuickGenerating, setIsQuickGenerating] = useState(false);
  const [quickGenConfig, setQuickGenConfig] = useState({
    skill: "Vocabulary",
    type: "Random",
    level: editablePlan?.classInformation.level || CEFRLevel.A1,
    articleType: "",
    description: "",
    count: 5,
  });

  const skills = [
    "Random",
    "Vocabulary",
    "Grammar",
    "Phonics",
    "Reading",
    "Listening",
    "Speaking",
    "Writing",
    "Pronunciation",
    "Critical Thinking",
    "Idioms & Slang",
    "Presentation Skills",
    "Culture & Etiquette",
    "Problem Solving",
    "Social English",
  ];

  const questionTypes = [
    "Random",
    "Multiple Choice",
    "Fill in the blanks",
    "Cloze Test",
    "Error Correction",
    "Matching",
    "Open Question",
    "True/False",
    "Sentence Unscramble",
    "Error Correction",
    "Picture Description",
    "Translation",
    "Essay",
    "Categorization",
    "Synonyms/Antonyms",
  ];

  const articleTypes = [
    "",
    "Random",
    "Short Story",
    "News Article",
    "Dialogue/Conversation",
    "Informational Text",
    "Email/Letter",
    "Opinion Piece",
    "Scientific Report",
    "Instructions/Manual",
    "Advertisement",
  ];

  const handleWorksheetItemChange = (
    wsIdx: number,
    sIdx: number,
    itemIdx: number,
    field: keyof WorksheetItem,
    value: any,
  ) => {
    const newWorksheets = [...worksheets];
    const ws = { ...newWorksheets[wsIdx] };
    if (!ws.sections) return;
    const section = { ...ws.sections[sIdx] };
    const items = [...section.items];
    items[itemIdx] = { ...items[itemIdx], [field]: value };
    section.items = items;
    ws.sections[sIdx] = section;
    newWorksheets[wsIdx] = ws;
    setWorksheets(newWorksheets);
  };

  const addWorksheetItem = (wsIdx: number, sIdx: number) => {
    const newWorksheets = [...worksheets];
    const ws = { ...newWorksheets[wsIdx] };
    if (!ws.sections) return;
    const section = { ...ws.sections[sIdx] };
    const newItem: WorksheetItem = {
      question: "New Question",
      answer: "",
      visualPrompt: "",
    };
    if (section.layout === "multiple-choice") {
      newItem.options = ["Option A", "Option B", "Option C", "Option D"];
    }
    if (section.layout === "essay") {
      newItem.wordCount = 50;
    }
    section.items = [...section.items, newItem];
    ws.sections[sIdx] = section;
    newWorksheets[wsIdx] = ws;
    setWorksheets(newWorksheets);
  };

  const removeWorksheetItem = (
    wsIdx: number,
    sIdx: number,
    itemIdx: number,
  ) => {
    const newWorksheets = [...worksheets];
    const ws = { ...newWorksheets[wsIdx] };
    if (!ws.sections) return;
    const section = { ...ws.sections[sIdx] };
    section.items = section.items.filter((_, i) => i !== itemIdx);
    ws.sections[sIdx] = section;
    newWorksheets[wsIdx] = ws;
    setWorksheets(newWorksheets);
  };

  const moveWorksheetItem = (
    wsIdx: number,
    sIdx: number,
    itemIdx: number,
    direction: "up" | "down",
  ) => {
    const newWorksheets = [...worksheets];
    const ws = { ...newWorksheets[wsIdx] };
    if (!ws.sections) return;
    const section = { ...ws.sections[sIdx] };
    const items = [...section.items];
    const targetIdx = direction === "up" ? itemIdx - 1 : itemIdx + 1;
    if (targetIdx < 0 || targetIdx >= items.length) return;
    [items[itemIdx], items[targetIdx]] = [items[targetIdx], items[itemIdx]];
    section.items = items;
    ws.sections[sIdx] = section;
    newWorksheets[wsIdx] = ws;
    setWorksheets(newWorksheets);
  };

  const addWorksheetSection = (wsIdx: number) => {
    const newWorksheets = [...worksheets];
    const ws = { ...newWorksheets[wsIdx] };
    const newSection: WorksheetSection = {
      title: "New Section",
      description: "Section instructions...",
      layout: "standard",
      items: [{ question: "Question 1", answer: "", visualPrompt: "" }],
    };
    ws.sections = [...(ws.sections || []), newSection];
    newWorksheets[wsIdx] = ws;
    setWorksheets(newWorksheets);
  };

  const removeWorksheetSection = (wsIdx: number, sIdx: number) => {
    const newWorksheets = [...worksheets];
    const ws = { ...newWorksheets[wsIdx] };
    if (ws.sections) {
      ws.sections = ws.sections.filter((_, i) => i !== sIdx);
      newWorksheets[wsIdx] = ws;
      setWorksheets(newWorksheets);
    }
  };

  const handleWorksheetSectionLayoutChange = (
    wsIdx: number,
    sIdx: number,
    layout: any,
  ) => {
    const newWorksheets = [...worksheets];
    const ws = { ...newWorksheets[wsIdx] };
    if (ws.sections) {
      const section = ws.sections[sIdx];
      section.layout = layout;
      // If switching to multiple choice and options don't exist, init them
      if (layout === "multiple-choice") {
        section.items = section.items.map((item) => ({
          ...item,
          options: item.options || [
            "Choice 1",
            "Choice 2",
            "Choice 3",
            "Choice 4",
          ],
        }));
      }
      if (layout === "essay") {
        section.items = section.items.map((item) => ({
          ...item,
          wordCount: item.wordCount || 50,
        }));
      }
      newWorksheets[wsIdx] = ws;
      setWorksheets(newWorksheets);
    }
  };

  const handleRegenerateWorksheetSection = async (
    wsIdx: number,
    sIdx: number,
  ) => {
    if (!editablePlan || regeneratingSectionId) return;
    const ws = worksheets[wsIdx];
    if (!ws.sections) return;
    const section = ws.sections[sIdx];

    setRegeneratingSectionId(`${wsIdx}-${sIdx}`);
    try {
      let skill = "Mixed";
      if (section.title.toLowerCase().includes("vocabulary"))
        skill = "Vocabulary";
      else if (section.title.toLowerCase().includes("grammar"))
        skill = "Grammar";
      else if (section.title.toLowerCase().includes("reading"))
        skill = "Reading Comprehension";
      else if (section.title.toLowerCase().includes("listening"))
        skill = "Listening Comprehension";

      const typeStr =
        section.layout === "multiple-choice"
          ? "Multiple Choice"
          : section.layout === "matching"
            ? "Matching"
            : "Mixed";

      const newWs = await generateWorksheet(
        editablePlan.classInformation.level as CEFRLevel,
        editablePlan.classInformation.topic,
        [{ skill, type: typeStr, count: section.items.length || 5 }],
      );

      if (newWs.sections && newWs.sections.length > 0) {
        const newWorksheets = [...worksheets];
        const targetWs = { ...newWorksheets[wsIdx] };
        if (targetWs.sections) {
          targetWs.sections[sIdx] = newWs.sections[0];
          newWorksheets[wsIdx] = targetWs;
          setWorksheets(newWorksheets);
        }
      }
    } catch (e) {
      console.error("Regeneration failed", e);
    } finally {
      setRegeneratingSectionId(null);
    }
  };

  const handleQuickGenerateSection = async () => {
    if (!editablePlan || isQuickGenerating) return;
    setIsQuickGenerating(true);
    try {
      // Enforce Multiple Choice layout for Cloze Test
      const config = { ...quickGenConfig };

      // AUTO-FORCE Essay Layout for Picture Description
      if (config.type === "Picture Description") {
        config.type = "Picture Description";
        // Layout handled by result in geminiService
      }

      const newWs = await generateWorksheet(
        quickGenConfig.level as CEFRLevel,
        editablePlan.classInformation.topic,
        [{ ...config }],
      );

      if (newWs.sections && newWs.sections.length > 0) {
        const newWorksheets = [...worksheets];
        // If no worksheets exist, create a shell
        if (newWorksheets.length === 0) {
          newWorksheets.push({
            title: "Generated Worksheet",
            type: "Review",
            instructions: "Please complete the following exercises.",
            sections: [newWs.sections[0]],
          });
        } else {
          // Append to first worksheet
          const ws = { ...newWorksheets[0] };
          ws.sections = [...(ws.sections || []), newWs.sections[0]];
          newWorksheets[0] = ws;
        }
        setWorksheets(newWorksheets);
      }
    } catch (e) {
      console.error("Quick Gen failed", e);
    } finally {
      setIsQuickGenerating(false);
    }
  };
  const handleGenerateWorksheetImage = async (
    wsIdx: number,
    sIdx: number,
    itemIdx: number,
    promptText: string,
  ) => {
    const key = `${wsIdx}-${sIdx}-${itemIdx}`;
    if (generatingWsImageKey) return;
    setGeneratingWsImageKey(key);
    try {
      // Descriptive prompt prefix to help model avoid safety blocks or vague failures
      const safePrompt = promptText.trim() || "educational illustration";
      const enhancedPrompt = `A simple, clear educational illustration of "${safePrompt}" for an English student's worksheet. Clean white background, no text, professional line-art or 2D vector style.`;
      const imageUrl = await generateLessonImage(enhancedPrompt, "4:3"); // Optimized for worksheets
      handleWorksheetItemChange(wsIdx, sIdx, itemIdx, "imageUrl", imageUrl);
    } catch (e) {
      console.error("Worksheet image generation failed", e);
    } finally {
      setGeneratingWsImageKey(null);
    }
  };
  const handleGeneratePassage = async (wsIdx: number, sIdx: number) => {
    if (!editablePlan || isGeneratingPassageId) return;
    setIsGeneratingPassageId(`${wsIdx}-${sIdx}`);
    try {
      const vocab = editablePlan.lessonDetails.targetVocab.map((v) => v.word);
      const result = await generateReadingPassage(
        editablePlan.classInformation.level,
        editablePlan.classInformation.topic,
        vocab,
      );
      const newWorksheets = [...worksheets];
      if (newWorksheets[wsIdx].sections) {
        newWorksheets[wsIdx].sections[sIdx].passage = result.text;
        newWorksheets[wsIdx].sections[sIdx].passageTitle = result.title;
      }
      setWorksheets(newWorksheets);
    } catch (e) {
      console.error("Passage generation failed", e);
    } finally {
      setIsGeneratingPassageId(null);
    }
  };
  /**
   * Layout components for worksheets
   * Implementation of Deluxe Visual Cards (Scheme 1) with Shuffled Column B
   */
  const MatchingLayout = ({
    section,
    wsIdx,
    sIdx,
  }: {
    section: WorksheetSection;
    wsIdx: number;
    sIdx: number;
  }) => {
    // Generate stable shuffled indices for Column B
    const shuffledIndices = useMemo(() => {
      const indices = Array.from({ length: section.items.length }, (_, i) => i);
      // Simple deterministic shuffle based on worksheet items length
      // This ensures the shuffle doesn't change every time the user types a letter
      let seed = section.items.length + sIdx;
      return indices.sort(() => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280 - 0.5;
      });
    }, [section.items.length, sIdx]);

    return (
      <div className="space-y-10 py-6">
        <div className="flex flex-col gap-8">
          {section.items.map((_, idx) => {
            const itemA = section.items[idx];
            const shuffledIdx = shuffledIndices[idx];
            const itemB = section.items[shuffledIdx];

            return (
              <div
                key={idx}
                className="flex flex-col md:flex-row gap-6 md:gap-0 items-stretch md:items-center relative"
              >
                {/* Column A Card (Terms/Questions) */}
                <div className="flex-1 flex items-center group relative z-10">
                  <div className="flex-1 flex gap-4 items-center bg-white dark:bg-slate-900/60 border-2 border-indigo-100 dark:border-indigo-900/30 p-6 rounded-[1.5rem] shadow-sm hover:border-indigo-300 transition-all min-h-[120px]">
                    <span className="text-xl font-black text-indigo-200 w-8">
                      {idx + 1}.
                    </span>
                    <AutoResizeTextarea
                      value={itemA.question}
                      onChange={(e) =>
                        handleWorksheetItemChange(
                          wsIdx,
                          sIdx,
                          idx,
                          "question",
                          e.target.value,
                        )
                      }
                      className="flex-1 text-lg font-bold text-indigo-900 bg-transparent border-none outline-none focus:bg-indigo-50/20 p-1 rounded"
                      placeholder="Term or phrase..."
                    />
                  </div>
                  {/* Anchor Point A */}
                  <div className="hidden md:flex w-16 h-px bg-indigo-100 items-center justify-end">
                    <div className="w-4 h-4 rounded-full border-2 border-indigo-400 bg-white shadow-xs"></div>
                  </div>
                </div>

                {/* Visual Connection Space (Visible on Print) - Increased to w-48 */}
                <div className="hidden md:block w-48 shrink-0"></div>

                {/* Column B Card (Images/Definitions) - Shuffled View */}
                <div className="flex-1 flex items-center group relative z-10">
                  {/* Anchor Point B */}
                  <div className="hidden md:flex w-16 h-px bg-indigo-100 items-center justify-start">
                    <div className="w-4 h-4 rounded-full border-2 border-indigo-400 bg-white shadow-xs"></div>
                  </div>
                  <div className="flex-1 flex gap-4 items-center bg-white border-2 border-slate-100 p-5 rounded-[1.5rem] shadow-sm hover:border-indigo-300 transition-all min-h-[120px] relative">
                    <span className="text-xl font-black text-slate-200 w-8">
                      {String.fromCharCode(65 + idx)}.
                    </span>

                    <div className="flex-1 flex items-center gap-6">
                      {/* Larger Image Area - Referring to shuffled content */}
                      <div
                        className="w-32 h-24 bg-slate-50 rounded-2xl overflow-hidden border border-slate-100 flex items-center justify-center relative shrink-0 cursor-pointer group/gen"
                        onClick={() =>
                          handleGenerateWorksheetImage(
                            wsIdx,
                            sIdx,
                            shuffledIdx,
                            itemB.answer || itemB.question,
                          )
                        }
                      >
                        {itemB.imageUrl ? (
                          <img
                            src={itemB.imageUrl}
                            className="w-full h-full object-cover"
                            alt="match visual"
                          />
                        ) : (
                          <ImageIcon className="w-8 h-8 text-slate-200" />
                        )}
                        <div className="absolute inset-0 bg-indigo-600/80 flex items-center justify-center opacity-0 group-hover/gen:opacity-100 transition-opacity no-print">
                          {generatingWsImageKey ===
                            `${wsIdx}-${sIdx}-${shuffledIdx}` ? (
                            <Loader2 className="w-6 h-6 text-white animate-spin" />
                          ) : (
                            <Sparkles className="w-6 h-6 text-white" />
                          )}
                        </div>
                      </div>

                      <AutoResizeTextarea
                        value={itemB.answer}
                        onChange={(e) =>
                          handleWorksheetItemChange(
                            wsIdx,
                            sIdx,
                            shuffledIdx,
                            "answer",
                            e.target.value,
                          )
                        }
                        className="flex-1 text-base font-semibold text-slate-700 bg-transparent border-none outline-none focus:bg-indigo-50/20 p-1 rounded"
                        placeholder="Match description..."
                      />
                    </div>

                    <div className="absolute -right-2 -top-2 flex flex-col gap-1 no-print opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() =>
                          removeWorksheetItem(wsIdx, sIdx, shuffledIdx)
                        }
                        className="p-1.5 text-red-400 hover:text-red-600 bg-white rounded-full shadow-md border border-slate-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={() => addWorksheetItem(wsIdx, sIdx)}
          className="w-full py-6 border-2 border-dashed border-indigo-100 rounded-[2rem] text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 text-sm font-black uppercase tracking-widest no-print"
        >
          <Plus className="w-5 h-5" /> Add Matching Row
        </button>
      </div>
    );
  };

  const MultipleChoiceLayout = ({
    section,
    wsIdx,
    sIdx,
  }: {
    section: WorksheetSection;
    wsIdx: number;
    sIdx: number;
  }) => (
    <div className="grid grid-cols-1 gap-8">
      {section.items.map((item, itemIdx) => (
        <div
          key={itemIdx}
          className="bg-white/40 border border-slate-100 rounded-[2rem] p-6 shadow-sm group/mc relative"
        >
          <div className="flex justify-between items-start gap-4 mb-6">
            <div className="flex-1 flex gap-4">
              <div className="flex gap-3 flex-1">
                <span className="font-black text-indigo-300 mt-1">
                  Q{itemIdx + 1}.
                </span>
                <AutoResizeTextarea
                  value={item.question}
                  onChange={(e) =>
                    handleWorksheetItemChange(
                      wsIdx,
                      sIdx,
                      itemIdx,
                      "question",
                      e.target.value,
                    )
                  }
                  className="flex-1 text-lg font-bold text-slate-800 bg-transparent border-none focus:bg-indigo-50/30 p-1 rounded outline-none"
                  placeholder="Multiple choice question..."
                />
              </div>
              {/* Visual AID / GEN Box for MC items */}
              <div
                onClick={() =>
                  handleGenerateWorksheetImage(
                    wsIdx,
                    sIdx,
                    itemIdx,
                    item.visualPrompt || item.question,
                  )
                }
                className="w-32 h-24 bg-slate-50 rounded-2xl overflow-hidden border border-slate-100 flex flex-col items-center justify-center relative shrink-0 cursor-pointer group/wsimg no-print"
              >
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    className="w-full h-full object-cover"
                    alt="visual aid"
                  />
                ) : (
                  <>
                    <LucideImage className="w-8 h-8 text-slate-200 mb-1" />
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                      GEN
                    </span>
                  </>
                )}
                <div className="absolute inset-0 bg-indigo-600/80 flex items-center justify-center opacity-0 group-hover/wsimg:opacity-100 transition-opacity">
                  {generatingWsImageKey === `${wsIdx}-${sIdx}-${itemIdx}` ? (
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  ) : (
                    <Sparkles className="w-6 h-6 text-white" />
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 no-print group-hover/mc:opacity-100 transition-opacity opacity-0">
              <button
                onClick={() => moveWorksheetItem(wsIdx, sIdx, itemIdx, "up")}
                className="p-1 text-slate-400 hover:text-indigo-600"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                onClick={() => moveWorksheetItem(wsIdx, sIdx, itemIdx, "down")}
                className="p-1 text-slate-400 hover:text-indigo-600"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
              <button
                onClick={() => removeWorksheetItem(wsIdx, sIdx, itemIdx)}
                className="p-1 text-slate-400 hover:text-red-500"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Arranged in a single row layout on larger screens (4 columns) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 ml-7 viewer-mc-grid">
            {(item.options || ["", "", "", ""]).map((opt, optIdx) => (
              <div
                key={optIdx}
                onClick={() =>
                  handleWorksheetItemChange(wsIdx, sIdx, itemIdx, "answer", opt)
                }
                className={`flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${item.answer === opt && opt !== "" ? "bg-indigo-50 border-indigo-400 ring-1 ring-indigo-200" : "bg-slate-50/50 border-transparent hover:border-slate-200"}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border-2 transition-all ${item.answer === opt && opt !== "" ? "bg-indigo-600 text-white border-indigo-600 shadow-md" : "bg-white text-slate-400 border-slate-100"}`}
                >
                  {String.fromCharCode(65 + optIdx)}
                </div>
                <input
                  value={opt}
                  onChange={(e) => {
                    e.stopPropagation();
                    const newOpts = [...(item.options || ["", "", "", ""])];
                    newOpts[optIdx] = e.target.value;
                    handleWorksheetItemChange(
                      wsIdx,
                      sIdx,
                      itemIdx,
                      "options",
                      newOpts,
                    );
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 bg-transparent border-none text-sm font-bold text-slate-700 outline-none"
                  placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
      <button
        onClick={() => addWorksheetItem(wsIdx, sIdx)}
        className="w-full py-3 border-2 border-dashed border-slate-100 rounded-2xl text-slate-300 hover:text-indigo-400 hover:border-indigo-100 hover:bg-indigo-50/20 transition-all flex items-center justify-center gap-2 text-xs font-bold no-print"
      >
        <Plus className="w-4 h-4" /> Add MC Question
      </button>
    </div>
  );

  const ErrorCorrectionLayout = ({
    section,
    wsIdx,
    sIdx,
  }: {
    section: WorksheetSection;
    wsIdx: number;
    sIdx: number;
  }) => (
    <div className="space-y-10">
      <div className="bg-white dark:bg-slate-900/80 dark:backdrop-blur-xl border-2 border-indigo-50 dark:border-white/5 rounded-[2.5rem] p-8 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h5 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
            Correction Passage Content / 短文改错内容
          </h5>
          <div className="flex items-center gap-2 no-print">
            <button
              onClick={() => handleGeneratePassage(wsIdx, sIdx)}
              disabled={isGeneratingPassageId === `${wsIdx}-${sIdx}`}
              className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-1"
            >
              {isGeneratingPassageId === `${wsIdx}-${sIdx}` ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
              Regen Passage
            </button>
          </div>
        </div>
        <AutoResizeTextarea
          value={section.passageTitle || ""}
          onChange={(e) => {
            const newWs = [...worksheets];
            if (newWs[wsIdx].sections)
              newWs[wsIdx].sections[sIdx].passageTitle = e.target.value;
            setWorksheets(newWs);
          }}
          placeholder="Passage Title..."
          className="text-2xl font-black text-indigo-900 bg-transparent border-none outline-none w-full mb-6 text-center"
        />
        <AutoResizeTextarea
          value={section.passage || ""}
          onChange={(e) => {
            const newWs = [...worksheets];
            if (newWs[wsIdx].sections) {
              const newSections = [...(newWs[wsIdx].sections || [])];
              newSections[sIdx] = {
                ...newSections[sIdx],
                passage: e.target.value,
              };
              newWs[wsIdx].sections = newSections;
            }
            setWorksheets(newWs);
          }}
          placeholder="Enter passage text with errors..."
          className="w-full text-xl font-medium text-slate-800 leading-[3.5] bg-transparent border-none outline-none italic whitespace-pre-wrap"
          minRows={5}
        />
        <div className="mt-8 pt-8 border-t border-indigo-50">
          <CorrectionLegend />
        </div>
      </div>

      <div className="space-y-4">
        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
          Error Key / 错误对照
        </h5>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {section.items.map((item, itemIdx) => (
            <div
              key={itemIdx}
              className="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs flex gap-4 items-center group/err"
            >
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-red-400">
                    WRONG:
                  </span>
                  <input
                    value={item.question}
                    onChange={(e) =>
                      handleWorksheetItemChange(
                        wsIdx,
                        sIdx,
                        itemIdx,
                        "question",
                        e.target.value,
                      )
                    }
                    placeholder="Incorrect text..."
                    className="flex-1 bg-transparent border-none outline-none text-sm font-bold text-red-700"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-green-400">
                    CORRECT:
                  </span>
                  <input
                    value={item.answer}
                    onChange={(e) =>
                      handleWorksheetItemChange(
                        wsIdx,
                        sIdx,
                        itemIdx,
                        "answer",
                        e.target.value,
                      )
                    }
                    placeholder="Correct version..."
                    className="flex-1 bg-transparent border-none outline-none text-sm font-bold text-green-700"
                  />
                </div>
              </div>
              <button
                onClick={() => removeWorksheetItem(wsIdx, sIdx, itemIdx)}
                className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover/err:opacity-100 transition-opacity no-print"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button
            onClick={() => addWorksheetItem(wsIdx, sIdx)}
            className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-100 rounded-2xl p-4 text-slate-400 hover:border-indigo-200 hover:text-indigo-400 transition-all no-print"
          >
            <Plus className="w-4 h-4" />
            <span className="text-xs font-bold uppercase">Add Error Entry</span>
          </button>
        </div>
      </div>
    </div>
  );

  const EssayLayout = ({
    section,
    wsIdx,
    sIdx,
  }: {
    section: WorksheetSection;
    wsIdx: number;
    sIdx: number;
  }) => (
    <div className="space-y-10">
      {section.items.map((item, idx) => {
        const lineCount = Math.ceil((item.wordCount || 50) / 10);
        return (
          <div
            key={idx}
            className="bg-white dark:bg-slate-900/80 dark:backdrop-blur-xl border border-slate-100 dark:border-white/5 rounded-[2.5rem] p-8 shadow-xs group/essay relative flex flex-col gap-6"
          >
            <div className="flex justify-between items-start gap-4 no-print">
              <div className="flex gap-3 flex-1">
                <span className="font-black text-indigo-300 mt-1">
                  {idx + 1}.
                </span>
                <AutoResizeTextarea
                  value={item.question}
                  onChange={(e) =>
                    handleWorksheetItemChange(
                      wsIdx,
                      sIdx,
                      idx,
                      "question",
                      e.target.value,
                    )
                  }
                  className="flex-1 text-lg font-bold text-slate-800 bg-transparent border-none focus:bg-indigo-50/30 p-1 rounded outline-none"
                  placeholder="Writing prompt or essay question..."
                />
              </div>
              <div className="flex items-center gap-4 group/controls">
                <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100">
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest whitespace-nowrap">
                    Words:
                  </span>
                  <input
                    type="number"
                    value={item.wordCount || 50}
                    onChange={(e) =>
                      handleWorksheetItemChange(
                        wsIdx,
                        sIdx,
                        idx,
                        "wordCount",
                        parseInt(e.target.value) || 0,
                      )
                    }
                    className="w-12 bg-transparent text-sm font-black text-indigo-700 outline-none border-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover/essay:opacity-100 transition-opacity">
                  <button
                    onClick={() => moveWorksheetItem(wsIdx, sIdx, idx, "up")}
                    className="p-1 text-slate-400 hover:text-indigo-600"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => moveWorksheetItem(wsIdx, sIdx, idx, "down")}
                    className="p-1 text-slate-400 hover:text-indigo-600"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => removeWorksheetItem(wsIdx, sIdx, idx)}
                    className="p-1 text-red-400 hover:text-red-600 bg-white rounded shadow-xs"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="hidden print:flex justify-between items-center font-bold text-slate-800 text-lg mb-2">
              <div className="flex-1">
                <span className="text-indigo-400 mr-2">{idx + 1}.</span>{" "}
                {item.question}
              </div>
              {item.wordCount && (
                <span className="bg-indigo-600 text-white px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest shrink-0">
                  Goal: {item.wordCount} words
                </span>
              )}
            </div>

            <div className="flex flex-col items-center gap-4">
              {item.imageUrl ? (
                <div className="relative group/wsimg max-w-2xl w-full">
                  <img
                    src={item.imageUrl}
                    className="w-full h-auto rounded-[2rem] border-4 border-indigo-50 shadow-md"
                    alt="prompt illustration"
                  />
                  <div className="absolute inset-0 bg-indigo-600/60 rounded-[2rem] flex items-center justify-center opacity-0 group-hover/wsimg:opacity-100 transition-opacity no-print">
                    <button
                      onClick={() =>
                        handleGenerateWorksheetImage(
                          wsIdx,
                          sIdx,
                          idx,
                          item.visualPrompt || item.question,
                        )
                      }
                      className="bg-white text-indigo-600 px-6 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg"
                    >
                      <Sparkles className="w-4 h-4" /> Regenerate Visual
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() =>
                    handleGenerateWorksheetImage(
                      wsIdx,
                      sIdx,
                      idx,
                      item.visualPrompt || item.question,
                    )
                  }
                  className="w-full max-w-xl h-48 bg-slate-50/50 border-4 border-dashed border-slate-100 rounded-[2rem] flex flex-col items-center justify-center cursor-pointer hover:bg-indigo-50 transition-all no-print"
                >
                  {generatingWsImageKey === `${wsIdx}-${sIdx}-${idx}` ? (
                    <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
                  ) : (
                    <>
                      <LucideImage className="w-12 h-12 text-slate-200 mb-3" />
                      <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                        GENERATE ILLUSTRATION
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="no-print bg-slate-50/50 px-4 py-2 rounded-xl flex items-center gap-3">
              <span className="text-[9px] font-black text-indigo-300 uppercase tracking-widest">
                Visual Prompt:
              </span>
              <input
                value={item.visualPrompt || ""}
                onChange={(e) =>
                  handleWorksheetItemChange(
                    wsIdx,
                    sIdx,
                    idx,
                    "visualPrompt",
                    e.target.value,
                  )
                }
                placeholder="Customize visual prompt for AI..."
                className="flex-1 bg-transparent border-none text-xs text-slate-500 italic outline-none"
              />
            </div>

            <div className="bg-white/30 rounded-2xl p-8 space-y-4 viewer-writing-area">
              {Array.from({ length: lineCount }).map((_, li) => (
                <div
                  key={li}
                  className="border-b-2 border-slate-100 h-12 w-full flex items-end"
                >
                  <span className="hidden print:block text-[8px] text-slate-200 font-bold opacity-30 select-none mr-2">
                    LINE ${li + 1}
                  </span>
                </div>
              ))}
              <div className="no-print absolute bottom-4 right-8 opacity-10 flex flex-col items-end pointer-events-none">
                <FileText className="w-12 h-12 text-slate-400 mb-2" />
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">
                  ${lineCount} Lines provided (1 per 10 words)
                </span>
              </div>
            </div>
          </div>
        );
      })}
      <button
        onClick={() => addWorksheetItem(wsIdx, sIdx)}
        className="w-full py-4 border-2 border-dashed border-indigo-100 rounded-3xl text-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 text-sm font-bold no-print"
      >
        <Plus className="w-5 h-5" /> Add Writing Prompt
      </button>
    </div>
  );
  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
        <h3 className="text-xl font-bold text-slate-800">Custom Worksheets</h3>
        <div className="flex gap-2">
          <button
            onClick={() => openViewer("materials", "worksheets")}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-sm font-bold"
          >
            <ExternalLink className="w-4 h-4" /> Print Mode
          </button>
          <button
            onClick={handleDownloadWorksheetsMd}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all text-sm font-bold"
          >
            <Download className="w-4 h-4" /> Download MD
          </button>
        </div>
      </div>

      <div className="bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100 no-print">
        <h4 className="text-sm font-black text-indigo-900 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          Quick Generate Section
        </h4>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Focus
              </label>
              <select
                value={quickGenConfig.skill}
                onChange={(e) =>
                  setQuickGenConfig({
                    ...quickGenConfig,
                    skill: e.target.value,
                  })
                }
                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                {skills.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Article Type
              </label>
              <select
                value={quickGenConfig.articleType}
                onChange={(e) =>
                  setQuickGenConfig({
                    ...quickGenConfig,
                    articleType: e.target.value,
                  })
                }
                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                {articleTypes.map((at) => (
                  <option key={at} value={at}>
                    {at || "None"}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Level
              </label>
              <select
                value={quickGenConfig.level}
                onChange={(e) =>
                  setQuickGenConfig({
                    ...quickGenConfig,
                    level: e.target.value as CEFRLevel,
                  })
                }
                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                {Object.values(CEFRLevel).map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {t(`cefr.${lvl}` as any)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Type
              </label>
              <select
                value={quickGenConfig.type}
                onChange={(e) =>
                  setQuickGenConfig({ ...quickGenConfig, type: e.target.value })
                }
                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                {questionTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Count
              </label>
              <input
                type="number"
                value={quickGenConfig.count}
                onChange={(e) =>
                  setQuickGenConfig({
                    ...quickGenConfig,
                    count: Number(e.target.value),
                  })
                }
                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                min="1"
                max="20"
              />
            </div>
          </div>
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Prompt
              </label>
              <input
                value={quickGenConfig.description}
                onChange={(e) =>
                  setQuickGenConfig({
                    ...quickGenConfig,
                    description: e.target.value,
                  })
                }
                placeholder="Customize content (e.g. 'about space exploration', 'focus on present perfect')..."
                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div className="flex items-end lg:w-48">
              <button
                onClick={handleQuickGenerateSection}
                disabled={isQuickGenerating}
                className="w-full h-[46px] bg-indigo-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-md disabled:opacity-50"
              >
                {isQuickGenerating ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Plus className="w-5 h-5" />
                )}
                Add Section
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-16">
        {worksheets.map((ws, wsIdx) => (
          <div key={wsIdx} className="space-y-12">
            <div className="text-center border-b border-dashed border-slate-200 pb-12">
              <AutoResizeTextarea
                value={ws.title}
                onChange={(e) => {
                  const newWs = [...worksheets];
                  newWs[wsIdx].title = e.target.value;
                  setWorksheets(newWs);
                }}
                className="text-3xl font-black text-indigo-900 text-center bg-transparent border-none outline-none focus:ring-2 focus:ring-indigo-100 rounded-lg px-4 w-full"
                minRows={1}
              />
              <AutoResizeTextarea
                value={ws.instructions}
                onChange={(e) => {
                  const newWs = [...worksheets];
                  newWs[wsIdx].instructions = e.target.value;
                  setWorksheets(newWs);
                }}
                className="block w-full text-center text-slate-500 italic mt-2 bg-transparent border-none outline-none"
                minRows={1}
              />
            </div>

            <div className="space-y-16">
              {ws.sections?.map((sec, sIdx) => (
                <div key={sIdx} className="space-y-6 relative group/sec">
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-black text-xs shrink-0">
                          {sIdx + 1}
                        </span>
                        <AutoResizeTextarea
                          value={sec.title}
                          onChange={(e) => {
                            const newWs = [...worksheets];
                            if (newWs[wsIdx].sections)
                              newWs[wsIdx].sections[sIdx].title =
                                e.target.value;
                            setWorksheets(newWs);
                          }}
                          className="flex-1 text-xl font-black text-indigo-800 bg-transparent border-none outline-none focus:ring-2 focus:ring-indigo-100 rounded-lg px-2"
                          minRows={1}
                        />
                      </div>
                      <AutoResizeTextarea
                        value={sec.description || ""}
                        onChange={(e) => {
                          const newWs = [...worksheets];
                          if (newWs[wsIdx].sections)
                            newWs[wsIdx].sections[sIdx].description =
                              e.target.value;
                          setWorksheets(newWs);
                        }}
                        placeholder="Section instructions..."
                        className="text-xs text-slate-400 font-medium ml-11 bg-transparent border-none outline-none italic w-full"
                        minRows={1}
                      />
                    </div>
                    <div className="flex gap-1 no-print">
                      <select
                        value={sec.layout}
                        onChange={(e) =>
                          handleWorksheetSectionLayoutChange(
                            wsIdx,
                            sIdx,
                            e.target.value,
                          )
                        }
                        className="text-[10px] font-bold bg-slate-50 border border-slate-100 rounded p-1 text-slate-500"
                      >
                        <option value="standard">Standard</option>
                        <option value="matching">Matching</option>
                        <option value="multiple-choice">Multiple Choice</option>
                        <option value="error-correction">
                          Error Correction
                        </option>
                        <option value="essay">Essay / Writing</option>
                      </select>
                      <button
                        onClick={() =>
                          handleRegenerateWorksheetSection(wsIdx, sIdx)
                        }
                        className="p-1.5 text-indigo-400 hover:text-indigo-600"
                        title="Regenerate Section"
                      >
                        {regeneratingSectionId === `${wsIdx}-${sIdx}` ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => removeWorksheetSection(wsIdx, sIdx)}
                        className="p-1.5 text-red-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="pl-11 space-y-8">
                    {(sec.passage !== undefined || sec.passageTitle) &&
                      sec.layout !== "error-correction" && (
                        <div className="bg-indigo-50/30 border-l-4 border-indigo-400 p-6 rounded-r-2xl shadow-sm space-y-4 mb-8 relative group/passage">
                          <div className="space-y-3">
                            <AutoResizeTextarea
                              value={sec.passageTitle || ""}
                              onChange={(e) => {
                                const newWs = [...worksheets];
                                if (newWs[wsIdx].sections)
                                  newWs[wsIdx].sections[sIdx].passageTitle =
                                    e.target.value;
                                setWorksheets(newWs);
                              }}
                              placeholder="Passage Title (e.g. 'Tom and Anna Meet')..."
                              className="text-2xl font-black text-indigo-900 bg-transparent border-none outline-none w-full"
                              minRows={1}
                            />
                            <AutoResizeTextarea
                              value={sec.passage || ""}
                              onChange={(e) => {
                                const newWs = [...worksheets];
                                if (newWs[wsIdx].sections) {
                                  newWs[wsIdx].sections[sIdx].passage =
                                    e.target.value;
                                }
                                setWorksheets(newWs);
                              }}
                              placeholder="Enter reading passage content..."
                              className="w-full text-lg text-slate-700 leading-[1.8] bg-transparent border-none outline-none italic whitespace-pre-wrap"
                              minRows={3}
                            />
                          </div>
                          <button
                            onClick={() => {
                              const newWs = [...worksheets];
                              if (newWs[wsIdx].sections) {
                                newWs[wsIdx].sections[sIdx].passage = undefined;
                                newWs[wsIdx].sections[sIdx].passageTitle =
                                  undefined;
                              }
                              setWorksheets(newWs);
                            }}
                            className="absolute -top-2 -right-2 p-1.5 bg-white border border-slate-100 rounded-full text-slate-300 hover:text-red-500 shadow-xs opacity-0 group-hover/passage:opacity-100 transition-all no-print"
                            title="Remove Passage"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                    {!sec.passage && !sec.passageTitle && (
                      <button
                        onClick={() => handleGeneratePassage(wsIdx, sIdx)}
                        disabled={isGeneratingPassageId === `${wsIdx}-${sIdx}`}
                        className="mb-6 text-[10px] font-black text-indigo-400 hover:text-indigo-600 uppercase tracking-widest flex items-center gap-1 no-print transition-colors"
                      >
                        {isGeneratingPassageId === `${wsIdx}-${sIdx}` ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <BookOpen className="w-3 h-3" />
                        )}
                        {isGeneratingPassageId === `${wsIdx}-${sIdx}`
                          ? "Generating Passage..."
                          : "Add Reading Passage"}
                      </button>
                    )}

                    {sec.layout === "matching" ? (
                      <MatchingLayout section={sec} wsIdx={wsIdx} sIdx={sIdx} />
                    ) : sec.layout === "multiple-choice" ? (
                      <MultipleChoiceLayout
                        section={sec}
                        wsIdx={wsIdx}
                        sIdx={sIdx}
                      />
                    ) : sec.layout === "error-correction" ? (
                      <ErrorCorrectionLayout
                        section={sec}
                        wsIdx={wsIdx}
                        sIdx={sIdx}
                      />
                    ) : sec.layout === "essay" ? (
                      <EssayLayout section={sec} wsIdx={wsIdx} sIdx={sIdx} />
                    ) : (
                      <div className="grid grid-cols-1 gap-6">
                        {sec.items.map((item, itemIdx) => (
                          <div
                            key={itemIdx}
                            className="bg-white border border-slate-100 rounded-2xl p-6 shadow-xs relative group/item"
                          >
                            <div className="flex gap-4">
                              <div className="flex-1 space-y-4">
                                <div className="flex gap-3">
                                  <span className="font-bold text-indigo-300">
                                    Q{itemIdx + 1}.
                                  </span>
                                  <AutoResizeTextarea
                                    value={item.question}
                                    onChange={(e) =>
                                      handleWorksheetItemChange(
                                        wsIdx,
                                        sIdx,
                                        itemIdx,
                                        "question",
                                        e.target.value,
                                      )
                                    }
                                    className="flex-1 text-base font-semibold text-slate-800 bg-transparent border-none outline-none focus:bg-indigo-50/20 p-1 rounded"
                                  />
                                </div>
                                <div className="flex gap-3 items-center">
                                  <span className="text-[10px] font-black text-green-500 uppercase tracking-widest ml-7">
                                    Answer:
                                  </span>
                                  <input
                                    value={item.answer}
                                    onChange={(e) =>
                                      handleWorksheetItemChange(
                                        wsIdx,
                                        sIdx,
                                        itemIdx,
                                        "answer",
                                        e.target.value,
                                      )
                                    }
                                    className="flex-1 text-xs font-bold text-green-700 bg-green-50/30 border border-green-100/30 rounded p-1.5 focus:bg-white transition-all outline-none"
                                  />
                                </div>
                              </div>
                              <div className="w-32 h-24 bg-slate-50 rounded-xl overflow-hidden border border-slate-100 relative group/img cursor-pointer">
                                {item.imageUrl ? (
                                  <img
                                    src={item.imageUrl}
                                    className="w-full h-full object-cover"
                                    alt="visual aid"
                                  />
                                ) : (
                                  <div className="w-full h-full flex flex-col items-center justify-center">
                                    <ImageIcon className="w-6 h-6 text-slate-200" />
                                    <button
                                      onClick={() =>
                                        handleGenerateWorksheetImage(
                                          wsIdx,
                                          sIdx,
                                          itemIdx,
                                          item.visualPrompt || item.question,
                                        )
                                      }
                                      className="text-[8px] font-black text-indigo-400 hover:underline uppercase mt-1"
                                    >
                                      {generatingWsImageKey ===
                                        `${wsIdx}-${sIdx}-${itemIdx}`
                                        ? "..."
                                        : "Gen"}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="absolute -right-2 top-2 flex flex-col gap-1 no-print opacity-0 group-hover/item:opacity-100 transition-opacity">
                              <button
                                onClick={() =>
                                  moveWorksheetItem(wsIdx, sIdx, itemIdx, "up")
                                }
                                className="p-1 bg-white border border-slate-100 rounded text-slate-400 hover:text-indigo-600 shadow-xs"
                              >
                                <ChevronUp className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() =>
                                  moveWorksheetItem(
                                    wsIdx,
                                    sIdx,
                                    itemIdx,
                                    "down",
                                  )
                                }
                                className="p-1 bg-white border border-slate-100 rounded text-slate-400 hover:text-indigo-600 shadow-xs"
                              >
                                <ChevronDown className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() =>
                                  removeWorksheetItem(wsIdx, sIdx, itemIdx)
                                }
                                className="p-1 bg-white border border-slate-100 rounded text-red-400 hover:text-red-600 shadow-xs"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                        <button
                          onClick={() => addWorksheetItem(wsIdx, sIdx)}
                          className="w-full py-3 border-2 border-dashed border-slate-100 rounded-2xl text-slate-300 hover:text-indigo-400 hover:border-indigo-100 hover:bg-indigo-50/20 transition-all flex items-center justify-center gap-2 text-xs font-bold no-print"
                        >
                          <Plus className="w-4 h-4" /> Add Item
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <button
                onClick={() => addWorksheetSection(wsIdx)}
                className="w-full py-6 border-2 border-dashed border-indigo-100 rounded-3xl text-indigo-300 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-all flex flex-col items-center justify-center gap-2 font-bold no-print"
              >
                <Layers className="w-8 h-8 opacity-40" />
                <span>Add New Worksheet Section</span>
              </button>
            </div>

            {/* Worksheet Answer Key Section */}
            <div className="mt-12 p-8 bg-indigo-50/20 rounded-3xl border-2 border-dashed border-indigo-100/50 no-print">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-indigo-600 p-2 rounded-xl text-white">
                  <AnswerKeyIcon className="w-5 h-5" />
                </div>
                <h4 className="text-lg font-black text-indigo-900 uppercase tracking-widest">
                  Worksheet Answer Key / 答案
                </h4>
              </div>

              <div className="space-y-6">
                {ws.sections?.map((sec, sIdx) => {
                  // Deterministic labels for matching sections to maintain UI consistency
                  let matchingLabels: string[] = [];
                  if (sec.layout === "matching") {
                    const indices = Array.from(
                      { length: sec.items.length },
                      (_, i) => i,
                    );
                    let seed = sec.items.length + sIdx;
                    const shuffled = indices.sort(() => {
                      seed = (seed * 9301 + 49297) % 233280;
                      return seed / 233280 - 0.5;
                    });
                    // Map original index to its label in the UI
                    matchingLabels = sec.items.map((_, originalIdx) => {
                      const labelIdx = shuffled.indexOf(originalIdx);
                      return labelIdx !== -1
                        ? String.fromCharCode(65 + labelIdx)
                        : "?";
                    });
                  }

                  return (
                    <div
                      key={sIdx}
                      className="bg-white/60 p-5 rounded-2xl border border-indigo-50"
                    >
                      <h5 className="font-bold text-indigo-800 mb-4 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-black">
                          {sIdx + 1}
                        </span>
                        {sec.title}
                      </h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pl-8">
                        {sec.items.map((item, iIdx) => {
                          let answerDisplay: React.ReactNode = item.answer;

                          // If matching, show the derived label (A, B, C...)
                          if (sec.layout === "matching") {
                            answerDisplay = matchingLabels[iIdx];
                          }
                          // If multiple choice, try to find the label index if it exists in options
                          else if (
                            sec.layout === "multiple-choice" &&
                            item.options
                          ) {
                            const optIdx = item.options.indexOf(item.answer);
                            if (optIdx !== -1) {
                              answerDisplay = String.fromCharCode(65 + optIdx);
                            }
                          }

                          return (
                            <div key={iIdx} className="text-sm flex gap-2">
                              <span className="font-bold text-slate-400">
                                Q{iIdx + 1}:
                              </span>
                              <span className="font-bold text-green-700">
                                {answerDisplay || (
                                  <span className="text-slate-300 italic font-normal">
                                    No answer set
                                  </span>
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {(!ws.sections || ws.sections.length === 0) && (
                  <p className="text-center text-slate-400 italic py-4">
                    Add sections to see the answer key here.
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
