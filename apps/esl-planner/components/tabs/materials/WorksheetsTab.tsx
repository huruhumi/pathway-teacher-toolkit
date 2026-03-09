import React, { useMemo } from "react";
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
  RotateCcw,
  RefreshCw,
  BookOpen,
  X,
  Layers,
  AlertCircle,
  FileCheck as AnswerKeyIcon,
  Wand2,
  Check,
} from "lucide-react";
import { Worksheet, StructuredLessonPlan, CEFRLevel } from "../../../types";
import { useLanguage } from "../../../i18n/LanguageContext";
import { AssignModal } from "../../AssignModal";
import { AutoResizeTextarea } from "../../common/AutoResizeTextarea";
import {
  MatchingLayout,
  MultipleChoiceLayout,
  ErrorCorrectionLayout,
  EssayLayout,
  StandardLayout,
} from "./layouts";
import { useWorksheetHandlers } from "./useWorksheetHandlers";
import { WORKSHEET_SKILLS, QUESTION_TYPES, ARTICLE_TYPES } from "./worksheetConstants";

export interface WorksheetsTabProps {
  worksheets: Worksheet[];
  setWorksheets: (ws: Worksheet[]) => void;
  editablePlan: StructuredLessonPlan | null;
}

const INDIGO_COLOR = "#4f46e5";

export const WorksheetsTab: React.FC<WorksheetsTabProps> = React.memo(({
  worksheets,
  setWorksheets,
  editablePlan,
}) => {
  const { t } = useLanguage();
  const {
    regeneratingSectionId,
    selectedId, setSelectedId,
    isAssignOpen, setIsAssignOpen,
    isAssigning, assignError, assignSuccess,
    isGeneratingPassageId,
    generatingWsImageKey,
    isQuickGenerating,
    quickGenConfig, setQuickGenConfig,
    handleWorksheetItemChange,
    addWorksheetItem, removeWorksheetItem, moveWorksheetItem,
    addWorksheetSection, removeWorksheetSection,
    handleWorksheetSectionLayoutChange,
    handleRegenerateWorksheetSection,
    handleQuickGenerateSection,
    handleAssign,
    actions,
  } = useWorksheetHandlers({ worksheets, setWorksheets, editablePlan });

  const skills = WORKSHEET_SKILLS;
  const questionTypes = QUESTION_TYPES;
  const articleTypes = ARTICLE_TYPES;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Custom Worksheets</h3>
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
                className="w-full bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                aria-label="Select Focus Skill"
                title="Select Focus Skill"
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
                className="w-full bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                aria-label="Select Article Type"
                title="Select Article Type"
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
                className="w-full bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                aria-label="Select CEFR Level"
                title="Select CEFR Level"
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
                className="w-full bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                aria-label="Select Question Type"
                title="Select Question Type"
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
                className="w-full bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                min="1"
                max="20"
                aria-label="Number of Questions"
                title="Number of Questions"
                placeholder="Count"
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
                className="w-full bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
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
            <div className="text-center border-b border-dashed border-slate-200 dark:border-white/10 pb-12">
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
                          className="text-[10px] font-bold bg-slate-50 border border-slate-100 dark:border-white/5 rounded p-1 text-slate-500"
                          aria-label="Select Section Layout"
                          title="Select Section Layout"
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
                          title="Remove Section"
                          aria-label="Remove Section"
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
                                className="w-full text-base text-slate-700 dark:text-slate-400 leading-[1.6] bg-transparent border-none outline-none italic whitespace-pre-wrap"
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
                              className="absolute -top-2 -right-2 p-1.5 bg-white dark:bg-slate-900/80 border border-slate-100 dark:border-white/5 rounded-full text-slate-300 hover:text-red-500 shadow-xs opacity-0 group-hover/passage:opacity-100 transition-all no-print"
                              title="Remove Passage"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                      {!sec.passage && !sec.passageTitle && (
                        <button
                          onClick={() => actions.handleGeneratePassage(wsIdx, sIdx)}
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
                      className="bg-white dark:bg-slate-900/80/60 p-5 rounded-2xl border border-indigo-50"
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
});
