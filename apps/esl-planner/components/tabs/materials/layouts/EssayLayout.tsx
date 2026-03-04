import React from 'react';
import { Loader2, Sparkles, Trash2, Plus, ChevronUp, ChevronDown, Image as LucideImage, FileText } from 'lucide-react';
import { AutoResizeTextarea } from '../../../common/AutoResizeTextarea';
import { WorksheetLayoutProps } from './types';

export const EssayLayout = ({
    section,
    wsIdx,
    sIdx,
    actions,
    generatingWsImageKey,
}: WorksheetLayoutProps) => {
    const { handleWorksheetItemChange, handleGenerateWorksheetImage, moveWorksheetItem, removeWorksheetItem, addWorksheetItem } = actions;

    return (
        <div className="space-y-10">
            {section.items.map((item, idx) => {
                const lineCount = Math.ceil((item.wordCount || 50) / 10);
                return (
                    <div
                        key={idx}
                        className="bg-white dark:bg-slate-900/80 dark:backdrop-blur-xl border border-slate-100 dark:border-white/5 rounded-[2.5rem] p-6 shadow-xs group/essay relative flex flex-col gap-6"
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
                                    className="flex-1 text-base font-bold text-slate-800 bg-transparent border-none focus:bg-indigo-50/30 p-1 rounded outline-none"
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
                                        LINE {li + 1}
                                    </span>
                                </div>
                            ))}
                            <div className="no-print absolute bottom-4 right-8 opacity-10 flex flex-col items-end pointer-events-none">
                                <FileText className="w-12 h-12 text-slate-400 mb-2" />
                                <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">
                                    {lineCount} Lines provided (1 per 10 words)
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
};
