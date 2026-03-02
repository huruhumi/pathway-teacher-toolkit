import React from 'react';
import { Download, CircleStop, Sparkles, Loader2, Plus, ImageIcon, RefreshCw, FileText, Trash2 } from 'lucide-react';
import { AutoResizeTextarea } from '../../common/AutoResizeTextarea';
import { Flashcard } from '../../../types';

export interface FlashcardsTabProps {
    localFlashcards: Flashcard[];
    flashcardImages: Record<number, string>;
    isGeneratingAll: boolean;
    isAddingFlashcard: boolean;
    generatingCardIndex: number | null;

    handleDownloadAllFlashcards: () => void;
    handleStopGenerating: (e: React.MouseEvent) => void;
    handleGenerateAllImages: (e: React.MouseEvent) => void;
    addFlashcard: () => void;
    handleGenerateFlashcardImage: (index: number, prompt: string) => void;
    handleDownloadFlashcard: (index: number) => void;
    handleDownloadFlashcardText: (index: number) => void;
    handleDownloadFlashcardPDF: (index: number) => void;
    removeFlashcard: (index: number, e: React.MouseEvent) => void;
    handleFlashcardChange: (index: number, field: keyof Flashcard, value: string) => void;
}

export const FlashcardsTab: React.FC<FlashcardsTabProps> = ({
    localFlashcards,
    flashcardImages,
    isGeneratingAll,
    isAddingFlashcard,
    generatingCardIndex,

    handleDownloadAllFlashcards,
    handleStopGenerating,
    handleGenerateAllImages,
    addFlashcard,
    handleGenerateFlashcardImage,
    handleDownloadFlashcard,
    handleDownloadFlashcardText,
    handleDownloadFlashcardPDF,
    removeFlashcard,
    handleFlashcardChange
}) => {
    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <FileText size={18} className="text-indigo-600" />
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
                    <button onClick={handleDownloadAllFlashcards} className="text-xs font-bold px-3 py-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-2">
                        <Download size={14} /> PDF
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {localFlashcards.map((card, idx) => (
                    <div key={idx} className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm flex flex-col group relative hover:border-indigo-300 hover:shadow-md transition-all">
                        <div className="aspect-[4/3] bg-slate-100 relative group-hover:bg-slate-50 transition-colors">
                            {flashcardImages[idx] ? (
                                <div className="relative w-full h-full">
                                    <img src={flashcardImages[idx]} className="w-full h-full object-cover" alt={card.word} />
                                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity no-print">
                                        <button
                                            onClick={() => handleGenerateFlashcardImage(idx, card.visualPrompt || card.word)}
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
                                                onClick={() => handleGenerateFlashcardImage(idx, card.visualPrompt || card.word)}
                                                className="text-xs font-bold px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded transition-colors flex items-center justify-center gap-1"
                                            >
                                                <Sparkles size={12} /> Generate
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="p-3 border-t border-slate-100">
                            <div className="flex justify-between items-start mb-2">
                                <input
                                    value={card.word}
                                    onChange={(e) => handleFlashcardChange(idx, 'word', e.target.value)}
                                    className="text-base font-bold text-slate-800 bg-transparent border-b border-transparent focus:border-indigo-500 outline-none w-full mr-2"
                                />
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
                            />
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
};
