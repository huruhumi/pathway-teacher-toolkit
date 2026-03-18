import React from 'react';
import { Trash2, Plus } from 'lucide-react';
import { AutoResizeTextarea } from '../../../common/AutoResizeTextarea';
import { WorksheetLayoutProps } from './types';

/**
 * Tracing / Handwriting layout.
 * Renders each item's "question" text in a large dotted/traceable style
 * with four-line handwriting guide underneath for practice.
 */
export const TracingLayout = ({
    section,
    wsIdx,
    sIdx,
    actions,
}: WorksheetLayoutProps) => {
    const { handleWorksheetItemChange, removeWorksheetItem, addWorksheetItem } = actions;

    return (
        <div className="space-y-6 py-4">
            {section.items.map((item, idx) => (
                <div key={idx} className="group relative">
                    <div className="flex items-start gap-4">
                        {/* Number */}
                        <span className="text-lg font-black text-indigo-200 w-8 mt-2 shrink-0">{idx + 1}.</span>

                        <div className="flex-1 space-y-2">
                            {/* Editable text (what to trace) */}
                            <AutoResizeTextarea
                                value={item.question}
                                onChange={(e) =>
                                    handleWorksheetItemChange(wsIdx, sIdx, idx, 'question', e.target.value)
                                }
                                className="w-full text-xl font-bold text-indigo-900 bg-transparent border-none outline-none focus:bg-indigo-50/20 p-1 rounded"
                                placeholder="Word or phrase to trace..."
                                minRows={1}
                            />

                            {/* Tracing preview: dotted text + four-line grid */}
                            <div className="bg-amber-50/60 border border-amber-200/50 rounded-2xl p-4 space-y-3">
                                {/* Dotted traceable text */}
                                <div
                                    className="text-3xl font-bold tracking-widest text-center select-none"
                                    style={{
                                        color: 'transparent',
                                        WebkitTextStroke: '1px #c4b5a0',
                                        letterSpacing: '0.15em',
                                        fontFamily: "'Inter', sans-serif",
                                    }}
                                >
                                    {item.question || 'word'}
                                </div>

                                {/* Four-line handwriting grid */}
                                <div className="relative h-16">
                                    {/* Top line (ascender) — dashed */}
                                    <div className="absolute top-0 left-0 right-0 border-t border-dashed border-blue-300/50" />
                                    {/* Mid line — solid (x-height) */}
                                    <div className="absolute top-[33%] left-0 right-0 border-t border-red-300/60" style={{ borderStyle: 'dashed' }} />
                                    {/* Base line — solid */}
                                    <div className="absolute top-[66%] left-0 right-0 border-t-2 border-blue-400/70" />
                                    {/* Bottom line (descender) — dashed */}
                                    <div className="absolute bottom-0 left-0 right-0 border-t border-dashed border-blue-300/50" />
                                </div>
                            </div>
                        </div>

                        {/* Delete */}
                        <button
                            onClick={() => removeWorksheetItem(wsIdx, sIdx, idx)}
                            className="p-1.5 text-red-300 hover:text-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-all no-print shrink-0 mt-2"
                            title="Delete"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            ))}

            <button
                onClick={() => addWorksheetItem(wsIdx, sIdx)}
                className="w-full py-4 border-2 border-dashed border-amber-200 rounded-2xl text-amber-400 hover:text-amber-600 hover:bg-amber-50 transition-all flex items-center justify-center gap-2 text-sm font-black uppercase tracking-widest no-print"
            >
                <Plus className="w-5 h-5" /> Add Tracing Word
            </button>
        </div>
    );
};
