import React from 'react';
import { Loader2, Trash2, Plus, ChevronUp, ChevronDown, Image as ImageIcon } from 'lucide-react';
import { AutoResizeTextarea } from '../../../common/AutoResizeTextarea';
import { WorksheetLayoutProps } from './types';

export const StandardLayout = ({
    section,
    wsIdx,
    sIdx,
    actions,
    generatingWsImageKey,
}: WorksheetLayoutProps) => {
    const { handleWorksheetItemChange, handleGenerateWorksheetImage, moveWorksheetItem, removeWorksheetItem, addWorksheetItem } = actions;

    return (
        <div className="grid grid-cols-1 gap-6">
            {section.items.map((item, itemIdx) => (
                <div
                    key={itemIdx}
                    className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs relative group/item"
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
                        <div className="w-32 h-24 bg-slate-50 rounded-xl overflow-hidden border border-slate-100 relative group/img cursor-pointer cursor-pointer">
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
                                        className="text-[8px] font-black text-indigo-400 hover:underline uppercase mt-1 relative z-10"
                                    >
                                        {generatingWsImageKey ===
                                            `${wsIdx}-${sIdx}-${itemIdx}`
                                            ? "..."
                                            : "Gen"}
                                    </button>
                                    {/* Invisible full-overlay catching clicks if the user misses the button but hits the box */}
                                    <div
                                        className="absolute inset-0 z-0"
                                        onClick={() =>
                                            handleGenerateWorksheetImage(
                                                wsIdx,
                                                sIdx,
                                                itemIdx,
                                                item.visualPrompt || item.question,
                                            )
                                        }
                                    />
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
    );
};
