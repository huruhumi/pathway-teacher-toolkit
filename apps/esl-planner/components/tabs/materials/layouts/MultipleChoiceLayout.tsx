import React from 'react';
import { Loader2, Sparkles, Trash2, Plus, ChevronUp, ChevronDown, Image as LucideImage } from 'lucide-react';
import { AutoResizeTextarea } from '../../../common/AutoResizeTextarea';
import { WorksheetLayoutProps } from './types';

export const MultipleChoiceLayout = ({
    section,
    wsIdx,
    sIdx,
    actions,
    generatingWsImageKey,
}: WorksheetLayoutProps) => {
    const { handleWorksheetItemChange, handleGenerateWorksheetImage, moveWorksheetItem, removeWorksheetItem, addWorksheetItem } = actions;

    return (
        <div className="grid grid-cols-1 gap-8">
            {section.items.map((item, itemIdx) => (
                <div
                    key={itemIdx}
                    className="bg-white dark:bg-slate-900/80/40 border border-slate-100 dark:border-white/5 rounded-[2rem] p-5 shadow-sm group/mc relative"
                >
                    <div className="flex justify-between items-start gap-4 mb-5">
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
                                    className="flex-1 text-base font-bold text-slate-800 dark:text-slate-200 bg-transparent border-none focus:bg-indigo-50/30 p-1 rounded outline-none"
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
                                className="w-32 h-24 bg-slate-50 rounded-2xl overflow-hidden border border-slate-100 dark:border-white/5 flex flex-col items-center justify-center relative shrink-0 cursor-pointer group/wsimg no-print"
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
                                className={`flex items-center gap-3 p-3 rounded-2xl border-2 cursor-pointer transition-all ${item.answer === opt && opt !== "" ? "bg-indigo-50 border-indigo-400 ring-1 ring-indigo-200" : "bg-slate-50/50 border-transparent hover:border-slate-200"}`}
                            >
                                <div
                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border-2 transition-all ${item.answer === opt && opt !== "" ? "bg-indigo-600 text-white border-indigo-600 shadow-md" : "bg-white dark:bg-slate-900/80 text-slate-400 border-slate-100 dark:border-white/5"}`}
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
                                    className="flex-1 bg-transparent border-none text-sm font-bold text-slate-700 dark:text-slate-400 outline-none"
                                    placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            ))}
            <button
                onClick={() => addWorksheetItem(wsIdx, sIdx)}
                className="w-full py-3 border-2 border-dashed border-slate-100 dark:border-white/5 rounded-2xl text-slate-300 hover:text-indigo-400 hover:border-indigo-100 hover:bg-indigo-50/20 transition-all flex items-center justify-center gap-2 text-xs font-bold no-print"
            >
                <Plus className="w-4 h-4" /> Add MC Question
            </button>
        </div>
    );
};
