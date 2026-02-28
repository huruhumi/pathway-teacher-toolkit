import React from 'react';
import { Image as ImageIcon, Loader2, Trash2, Plus } from 'lucide-react';
import { VisualReferenceItem } from '../../types';

const ART_STYLES = [
    "Realistic Photo",
    "Watercolor",
    "Cartoon Line Art",
    "3D Render",
    "Pixel Art",
    "Paper Cutout",
    "Claymation",
    "Technical Diagram",
    "Isometric View"
];

interface TabVisualsProps {
    visualRefs: VisualReferenceItem[];
    generatedVisuals: Record<number, string>;
    loadingVisuals: Set<number>;
    visualStyles: Record<number, string>;
    isAddingVisual: boolean;

    // Handlers
    setVisualStyles: (s: Record<number, string> | ((prev: Record<number, string>) => Record<number, string>)) => void;
    setVisualRefs: (v: VisualReferenceItem[] | ((prev: VisualReferenceItem[]) => VisualReferenceItem[])) => void;
    handleGenerateVisual: (index: number) => void;
    handleVisualRefChange: (index: number, field: keyof VisualReferenceItem, value: string) => void;
    handleAddVisualRef: () => void;
    setZoomedImage: (img: string | null) => void;
}

export const TabVisuals: React.FC<TabVisualsProps> = ({
    visualRefs,
    generatedVisuals,
    loadingVisuals,
    visualStyles,
    isAddingVisual,
    setVisualStyles,
    setVisualRefs,
    handleGenerateVisual,
    handleVisualRefChange,
    handleAddVisualRef,
    setZoomedImage
}) => {
    return (
        <div className="space-y-6 animate-fade-in">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <ImageIcon size={20} className="text-emerald-600" />
                Visual Reference Aids
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {visualRefs.map((item, idx) => (
                    <div key={idx} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex gap-4 group hover:border-emerald-300 transition-all">
                        <div className="w-1/3 aspect-square bg-slate-100 rounded-lg flex-shrink-0 relative overflow-hidden">
                            {generatedVisuals[idx] ? (
                                <img
                                    src={generatedVisuals[idx]}
                                    alt={item.label}
                                    className="w-full h-full object-cover cursor-pointer"
                                    onClick={() => setZoomedImage(generatedVisuals[idx])}
                                />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center">
                                    {loadingVisuals.has(idx) ? (
                                        <Loader2 size={20} className="animate-spin text-emerald-600" />
                                    ) : (
                                        <div className="flex flex-col items-center gap-2">
                                            <ImageIcon size={20} className="text-slate-300" />
                                            <div className="flex flex-col gap-1 w-full">
                                                <select
                                                    className="text-[10px] bg-white border border-slate-200 rounded px-1 py-0.5 outline-none focus:border-emerald-500"
                                                    value={visualStyles[idx] || "Realistic Photo"}
                                                    onChange={(e) => setVisualStyles(prev => ({ ...prev, [idx]: e.target.value }))}
                                                >
                                                    {ART_STYLES.map(style => <option key={style} value={style}>{style}</option>)}
                                                </select>
                                                <button
                                                    onClick={() => handleGenerateVisual(idx)}
                                                    className="text-[10px] font-bold px-2 py-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded transition-colors"
                                                >
                                                    Generate
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            <div className="absolute top-1 left-1 bg-black/50 backdrop-blur-sm text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                                {item.type}
                            </div>
                        </div>
                        <div className="flex-1">
                            <div className="flex justify-between items-start mb-1">
                                <input
                                    value={item.label}
                                    onChange={(e) => handleVisualRefChange(idx, 'label', e.target.value)}
                                    className="font-bold text-slate-800 bg-transparent border-b border-transparent focus:border-emerald-500 outline-none w-full"
                                />
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => setVisualRefs(prev => (prev as VisualReferenceItem[]).filter((_, i) => i !== idx))} className="text-slate-400 hover:text-red-500 p-1">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                            <div className="mb-2">
                                <input
                                    value={item.type}
                                    onChange={(e) => handleVisualRefChange(idx, 'type', e.target.value)}
                                    className="text-xs font-semibold text-emerald-600 uppercase bg-emerald-50 px-1.5 py-0.5 rounded border-none outline-none w-auto inline-block"
                                />
                            </div>
                            <textarea
                                value={item.description}
                                onChange={(e) => handleVisualRefChange(idx, 'description', e.target.value)}
                                className="text-sm text-slate-600 w-full bg-transparent border-none outline-none resize-none h-20"
                            />
                        </div>
                    </div>
                ))}

                <button
                    onClick={handleAddVisualRef}
                    disabled={isAddingVisual}
                    className="bg-slate-50 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center p-6 text-slate-400 hover:text-emerald-600 hover:border-emerald-400 hover:bg-emerald-50 transition-all min-h-[160px]"
                >
                    {isAddingVisual ? <Loader2 size={24} className="animate-spin mb-2" /> : <Plus size={32} className="mb-2" />}
                    <span className="font-semibold text-sm">Add Visual Reference</span>
                </button>
            </div>
        </div>
    );
};
