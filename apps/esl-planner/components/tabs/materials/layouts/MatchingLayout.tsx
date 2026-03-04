import React, { useMemo } from 'react';
import { Loader2, Sparkles, Trash2, Plus, Image as ImageIcon } from 'lucide-react';
import { AutoResizeTextarea } from '../../../common/AutoResizeTextarea';
import { WorksheetLayoutProps } from './types';

export const MatchingLayout = ({
    section,
    wsIdx,
    sIdx,
    actions,
    generatingWsImageKey,
}: WorksheetLayoutProps) => {
    const { handleWorksheetItemChange, handleGenerateWorksheetImage, removeWorksheetItem, addWorksheetItem } = actions;

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
                                <div className="flex-1 flex gap-4 items-center bg-white dark:bg-slate-900/60 border-2 border-indigo-100 dark:border-indigo-900/30 p-4 rounded-[1.5rem] shadow-sm hover:border-indigo-300 transition-all min-h-[100px]">
                                    <span className="text-lg font-black text-indigo-200 w-8">
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
                                        className="flex-1 text-base font-bold text-indigo-900 bg-transparent border-none outline-none focus:bg-indigo-50/20 p-1 rounded"
                                        placeholder="Term or phrase..."
                                    />
                                </div>
                                {/* Anchor Point A */}
                                <div className="hidden md:flex w-16 h-px bg-indigo-100 items-center justify-end">
                                    <div className="w-4 h-4 rounded-full border-2 border-indigo-400 bg-white shadow-xs"></div>
                                </div>
                            </div>

                            {/* Visual Connection Space (Visible on Print) */}
                            <div className="hidden md:block w-16 shrink-0"></div>

                            {/* Column B Card (Images/Definitions) - Shuffled View */}
                            <div className="flex-1 flex items-center group relative z-10">
                                {/* Anchor Point B */}
                                <div className="hidden md:flex w-16 h-px bg-indigo-100 items-center justify-start">
                                    <div className="w-4 h-4 rounded-full border-2 border-indigo-400 bg-white shadow-xs"></div>
                                </div>
                                <div className="flex-1 flex gap-4 items-center bg-white border-2 border-slate-100 p-4 rounded-[1.5rem] shadow-sm hover:border-indigo-300 transition-all min-h-[100px] relative">
                                    <span className="text-lg font-black text-slate-200 w-8">
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
                                            className="flex-1 text-sm font-semibold text-slate-700 bg-transparent border-none outline-none focus:bg-indigo-50/20 p-1 rounded"
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
