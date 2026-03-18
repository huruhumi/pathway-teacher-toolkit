import React, { useState } from 'react';
import { Download, CircleStop, Sparkles, Loader2, Plus, ImageIcon, RefreshCw, FileText, Trash2, Check } from 'lucide-react';
import { AutoResizeTextarea } from '../../common/AutoResizeTextarea';
import { Flashcard } from '../../../types';

export interface FlashcardsTabProps {
    localFlashcards: Flashcard[];
    flashcardImages: Record<number, string>;
    isGeneratingAll: boolean;
    isAddingFlashcard: boolean;
    generatingCardIndex: number | null;

    handleDownloadAllFlashcards: () => void;
    handleDownloadFlashcardImageGrid: () => void;
    handleDownloadFlashcardTextGrid: () => void;
    handleStopGenerating: (e: React.MouseEvent) => void;
    handleGenerateAllImages: (e: React.MouseEvent) => void;
    addFlashcard: () => void;
    handleGenerateFlashcardImage: (index: number, prompt: string) => void;
    handleDownloadFlashcard: (index: number) => void;
    handleDownloadFlashcardText: (index: number) => void;
    handleDownloadFlashcardPDF: (index: number) => void;
    removeFlashcard: (index: number, e: React.MouseEvent) => void;
    handleFlashcardChange: (index: number, field: keyof Flashcard, value: string) => void;
    onGenerateDefinition?: (index: number) => Promise<void>;
}

export const FlashcardsTab: React.FC<FlashcardsTabProps> = React.memo(({
    localFlashcards,
    flashcardImages,
    isGeneratingAll,
    isAddingFlashcard,
    generatingCardIndex,

    handleDownloadAllFlashcards,
    handleDownloadFlashcardImageGrid,
    handleDownloadFlashcardTextGrid,
    handleStopGenerating,
    handleGenerateAllImages,
    addFlashcard,
    handleGenerateFlashcardImage,
    handleDownloadFlashcard,
    handleDownloadFlashcardText,
    handleDownloadFlashcardPDF,
    removeFlashcard,
    handleFlashcardChange,
    onGenerateDefinition,
}) => {
    const [generatingDefIdx, setGeneratingDefIdx] = useState<number | null>(null);

    const handleDefClick = async (idx: number) => {
        if (!onGenerateDefinition || generatingDefIdx !== null) return;
        setGeneratingDefIdx(idx);
        try {
            await onGenerateDefinition(idx);
        } finally {
            setGeneratingDefIdx(null);
        }
    };
    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <img id="pathway-logo" src={`${import.meta.env.BASE_URL}logo.png`} alt="Pathway Academy" className="w-8 h-8 object-contain" />
                    Teaching Flashcards
                </h3>
                <div className="flex gap-2">
                    <button
                        onClick={isGeneratingAll ? handleStopGenerating : handleGenerateAllImages}
                        className="text-xs font-bold px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-2"
                    >
                        {isGeneratingAll ? <CircleStop size={14} /> : <Sparkles size={14} />}
                        {isGeneratingAll ? 'Stop Generating' : 'Generate Missing Images'}
                    </button>
                    <button onClick={handleDownloadAllFlashcards} className="text-xs font-bold px-3 py-1.5 bg-slate-100 text-slate-600 dark:text-slate-400 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-2" title="Download all flashcards as a single PDF">
                        <Download size={14} /> PDF
                    </button>
                    <button onClick={handleDownloadFlashcardImageGrid} className="text-xs font-bold px-3 py-1.5 bg-slate-100 text-slate-600 dark:text-slate-400 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-2" title="Download images grid PDF (4 per page)">
                        <ImageIcon size={14} /> Images
                    </button>
                    <button onClick={handleDownloadFlashcardTextGrid} className="text-xs font-bold px-3 py-1.5 bg-slate-100 text-slate-600 dark:text-slate-400 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-2" title="Download text grid PDF (4 per page)">
                        <FileText size={14} /> Text
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {localFlashcards.map((card, idx) => (
                    <div key={idx} className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 rounded-3xl overflow-hidden shadow-sm flex flex-col group relative hover:border-indigo-300 hover:shadow-md transition-all">
                        <div className="aspect-square bg-slate-100 relative group-hover:bg-slate-50 transition-colors">
                            {flashcardImages[idx] && (flashcardImages[idx].startsWith('data:') || flashcardImages[idx].startsWith('http')) ? (
                                <div className="relative w-full h-full">
                                    <img src={flashcardImages[idx]} className="w-full h-full object-cover" alt={card.word} />
                                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity no-print">
                                        <button
                                            onClick={() => handleGenerateFlashcardImage(idx, card.visualPrompt || card.definition || card.word)}
                                            disabled={generatingCardIndex === idx}
                                            className="p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-md backdrop-blur-sm transition-all"
                                            title="Regenerate Image"
                                        >
                                            {generatingCardIndex === idx ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                        </button>
                                        <button
                                            onClick={() => handleDownloadFlashcard(idx)}
                                            className="p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-md backdrop-blur-sm transition-all shadow-sm"
                                            title="Download Image"
                                        >
                                            <Download size={14} />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
                                    {generatingCardIndex === idx ? (
                                        <div className="flex flex-col items-center gap-2 text-indigo-600">
                                            <Loader2 size={24} className="animate-spin" />
                                            <span className="text-xs font-semibold">Generating...</span>
                                        </div>
                                    ) : (
                                        <>
                                            <ImageIcon size={32} className="text-slate-300 mb-2" />
                                            <span className="text-xs text-slate-400 mb-4">No Image</span>
                                            <button
                                                onClick={() => handleGenerateFlashcardImage(idx, card.visualPrompt || card.definition || card.word)}
                                                className="text-xs font-bold px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded transition-colors flex items-center justify-center gap-1"
                                            >
                                                <Sparkles size={12} /> Generate
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="p-3 border-t border-slate-100 dark:border-white/5">
                            <div className="flex justify-between items-start mb-2">
                                <input
                                    value={card.word}
                                    onChange={(e) => handleFlashcardChange(idx, 'word', e.target.value)}
                                    className="text-base font-bold text-slate-800 dark:text-slate-200 bg-transparent border-b border-transparent focus:border-indigo-500 outline-none flex-1 mr-1"
                                    title="Flashcard Word"
                                    placeholder="Enter word"
                                />
                                {card.word.trim() && (
                                    <button
                                        onClick={() => handleDefClick(idx)}
                                        disabled={generatingDefIdx === idx}
                                        className="p-1 text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-all shrink-0 no-print"
                                        title="Auto-generate definition"
                                    >
                                        {generatingDefIdx === idx ? <Loader2 size={16} className="animate-spin text-emerald-500" /> : <Check size={16} />}
                                    </button>
                                )}
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity no-print">
                                    <button onClick={() => handleDownloadFlashcardPDF(idx)} className="text-slate-400 hover:text-indigo-600 p-1" title="Download Complete PDF">
                                        <Download size={16} />
                                    </button>
                                    <button onClick={() => handleDownloadFlashcardText(idx)} className="text-slate-400 hover:text-indigo-600 p-1" title="Download Back (Text only)">
                                        <FileText size={16} />
                                    </button>
                                    <button onClick={(e) => removeFlashcard(idx, e)} className="text-slate-400 hover:text-red-500 p-1" title="Remove Flashcard">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                            <textarea
                                value={card.definition}
                                onChange={(e) => handleFlashcardChange(idx, 'definition', e.target.value)}
                                className="text-sm text-slate-500 bg-transparent border-none outline-none resize-none w-full"
                                rows={2}
                                title="Flashcard Definition"
                                placeholder="Enter definition"
                            />
                            {/* Editable image prompt — not included in PDF */}
                            <div className="mt-1 no-print">
                                <label className="text-[10px] font-semibold text-slate-400 flex items-center gap-1 mb-0.5">
                                    <Sparkles size={10} /> Image Prompt
                                </label>
                                <textarea
                                    value={card.visualPrompt || card.definition || card.word}
                                    onChange={(e) => handleFlashcardChange(idx, 'visualPrompt', e.target.value)}
                                    className="text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded px-2 py-1 border-none outline-none resize-none w-full focus:ring-1 focus:ring-indigo-300"
                                    rows={2}
                                    title="Image generation prompt"
                                    placeholder="Describe what the image should show..."
                                />
                            </div>
                        </div>
                    </div>
                ))}

                <button
                    onClick={addFlashcard}
                    disabled={isAddingFlashcard}
                    className="bg-slate-50 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center p-4 text-slate-400 hover:text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50 transition-all min-h-[200px]"
                >
                    {isAddingFlashcard ? <Loader2 size={24} className="animate-spin mb-2" /> : <Plus size={32} className="mb-2" />}
                    <span className="font-semibold text-sm">Add Word</span>
                </button>
            </div>
        </div>
    );
});
