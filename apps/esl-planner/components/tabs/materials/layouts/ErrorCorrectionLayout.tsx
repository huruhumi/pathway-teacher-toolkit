import React from 'react';
import { Loader2, RefreshCw, Trash2, Plus, Info } from 'lucide-react';
import { AutoResizeTextarea } from '../../../common/AutoResizeTextarea';
import { WorksheetLayoutProps } from './types';

export const CorrectionLegend = () => (
    <div className="bg-white dark:bg-slate-900/80 dark:backdrop-blur-xl border-2 border-indigo-100 dark:border-indigo-900/30 rounded-2xl p-4 shadow-sm viewer-correction-legend">
        <h5 className="text-[10px] font-black text-indigo-900 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Info className="w-3 h-3 text-indigo-500" />
            Proofreading Marks Reference / 修改符号参考
        </h5>
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
                    =
                </span>
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

export const ErrorCorrectionLayout = ({
    section,
    wsIdx,
    sIdx,
    worksheets,
    setWorksheets,
    actions,
    isGeneratingPassageId,
}: WorksheetLayoutProps) => {
    const { handleWorksheetItemChange, removeWorksheetItem, addWorksheetItem, handleGeneratePassage } = actions;

    return (
        <div className="space-y-10">
            <div className="bg-white dark:bg-slate-900/80 dark:backdrop-blur-xl border-2 border-indigo-50 dark:border-white/5 rounded-[2.5rem] p-6 shadow-sm">
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
                    className="text-xl font-black text-indigo-900 bg-transparent border-none outline-none w-full mb-6 text-center"
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
                    className="w-full text-lg font-medium text-slate-800 leading-[2.5] bg-transparent border-none outline-none italic whitespace-pre-wrap"
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
};
