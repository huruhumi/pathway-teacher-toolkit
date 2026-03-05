import React, { useState, useMemo } from "react";
import {
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
import { AssignModal } from '../../AssignModal';
import * as edu from '@shared/services/educationService';
import { useAuthStore } from '@shared/stores/useAuthStore';
import {
  generateWorksheet,
  generateLessonImage,
  generateReadingPassage,
} from "../../../services/geminiService";
import {
  MatchingLayout,
  MultipleChoiceLayout,
  ErrorCorrectionLayout,
  EssayLayout,
  StandardLayout,
  WorksheetLayoutActions,
} from "./layouts";

export interface WorksheetsTabProps {
  worksheets: Worksheet[];
  setWorksheets: (ws: Worksheet[]) => void;
  editablePlan: StructuredLessonPlan | null;
}

const INDIGO_COLOR = "#4f46e5";


export const WorksheetsTab: React.FC<WorksheetsTabProps> = ({
  worksheets,
  setWorksheets,
  editablePlan,
}) => {
  const { t } = useLanguage();
  const [regeneratingSectionId, setRegeneratingSectionId] = useState<
    string | null
  >(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Assigning state
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignError, setAssignError] = useState('');
  const [assignSuccess, setAssignSuccess] = useState('');

  const teacherId = useAuthStore(s => s.user?.id);
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
  const actions: WorksheetLayoutActions = {
    handleWorksheetItemChange,
    handleGenerateWorksheetImage,
    moveWorksheetItem,
    removeWorksheetItem,
    addWorksheetItem,
    handleGeneratePassage,
  };

  const handleAssign = async (classId: string, dueDate: string) => {
    if (!teacherId || !editablePlan || worksheets.length === 0) return; // Ensure there's at least one worksheet to assign
    setIsAssigning(true);
    setAssignError('');
    setAssignSuccess('');

    try {
      // For assignment, we'll use the first worksheet in the array as the primary content
      const dataToAssign = worksheets[0];

      const assignment = await edu.upsertAssignment({
        teacher_id: teacherId,
        title: dataToAssign.title || editablePlan.classInformation.topic || 'Worksheet',
        description: dataToAssign.instructions || `A ${editablePlan.classInformation.level || ''} level worksheet about ${editablePlan.classInformation.topic || 'English'}.`,
        class_id: classId,
        type: 'worksheet',
        content: dataToAssign, // JSON payload of the first worksheet
        due_date: dueDate || null
      } as any);

      if (assignment) {
        // Determine class students
        const clsStudents = await edu.fetchClassStudents(classId);
        const sids = clsStudents.map(cs => cs.student_id);
        await edu.createSubmissionsForClass(assignment.id, sids);

        setAssignSuccess(t('assign.success') as string);
        setTimeout(() => {
          setIsAssignOpen(false);
          setAssignSuccess('');
        }, 2000);
      } else {
        setAssignError(t('assign.error') as string);
      }
    } catch (e: any) {
      console.error("Assignment failed:", e);
      setAssignError(e.message || t('assign.error'));
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
        <h3 className="text-lg font-bold text-slate-800">Custom Worksheets</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setIsAssignOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-medium rounded-xl hover:shadow-lg transition-transform hover:-translate-y-0.5"
            title={t('assign.title') as string}
          >
            ✨ {t('assign.confirm') as string}
          </button>
          {/* Assuming handleOpenPrint is defined elsewhere or will be added */}
          {/* <button onClick={handleOpenPrint}>Print</button> */}
        </div>
      </div>

      <div className="bg-indigo-50/50 p-5 rounded-3xl border border-indigo-100 no-print">
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
                className="text-2xl font-black text-indigo-900 text-center bg-transparent border-none outline-none focus:ring-2 focus:ring-indigo-100 rounded-lg px-4 w-full"
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
              {ws.sections?.map((sec, sIdx) => {
                const layoutProps = {
                  section: sec,
                  wsIdx,
                  sIdx,
                  worksheets,
                  setWorksheets,
                  actions,
                  generatingWsImageKey,
                  isGeneratingPassageId,
                };
                return (
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
                            className="flex-1 text-lg font-black text-indigo-800 bg-transparent border-none outline-none focus:ring-2 focus:ring-indigo-100 rounded-lg px-2"
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
                          <div className="bg-indigo-50/30 border-l-4 border-indigo-400 p-5 rounded-r-2xl shadow-sm space-y-4 mb-8 relative group/passage">
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
                                className="text-xl font-black text-indigo-900 bg-transparent border-none outline-none w-full"
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
                                className="w-full text-base text-slate-700 leading-[1.6] bg-transparent border-none outline-none italic whitespace-pre-wrap"
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
                        <MatchingLayout {...layoutProps} />
                      ) : sec.layout === "multiple-choice" ? (
                        <MultipleChoiceLayout {...layoutProps} />
                      ) : sec.layout === "error-correction" ? (
                        <ErrorCorrectionLayout {...layoutProps} />
                      ) : sec.layout === "essay" ? (
                        <EssayLayout {...layoutProps} />
                      ) : (
                        <StandardLayout {...layoutProps} />
                      )}
                    </div>
                  </div>
                );
              })}
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

      <AssignModal
        isOpen={isAssignOpen}
        onClose={() => setIsAssignOpen(false)}
        onAssign={handleAssign}
        assignmentType="worksheet"
        isSaving={isAssigning}
      />

      {assignSuccess && (
        <div className="fixed bottom-6 right-6 bg-emerald-50 text-emerald-600 border border-emerald-200 px-6 py-3 rounded-xl shadow-lg z-50 flex items-center gap-2 animate-in slide-in-from-bottom">
          <Check className="w-4 h-4" /> {assignSuccess}
        </div>
      )}
      {assignError && (
        <div className="fixed bottom-6 right-6 bg-red-50 text-red-600 border border-red-200 px-6 py-3 rounded-xl shadow-lg z-50 flex items-center gap-2 animate-in slide-in-from-bottom">
          <AlertCircle className="w-4 h-4" /> {assignError}
        </div>
      )}
    </div>
  );
};
