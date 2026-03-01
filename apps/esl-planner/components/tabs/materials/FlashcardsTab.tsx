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
                <h3 className="text-xl font-bold text-slate-800">Teaching Flashcards</h3>
                <div className="flex gap-2">
                    <button onClick={handleDownloadAllFlashcards} className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-all text-sm font-bold">
                        <Download className="w-4 h-4" /> Download All
                    </button>
                    <button
                        onClick={isGeneratingAll ? handleStopGenerating : handleGenerateAllImages}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white font-bold transition-all text-sm shadow-md ${isGeneratingAll ? 'bg-red-500 hover:bg-red-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                    >
                        {isGeneratingAll ? <CircleStop className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                        {isGeneratingAll ? 'Stop Generating' : 'Generate Missing Images'}
                    </button>
                    <button onClick={addFlashcard} disabled={isAddingFlashcard} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all text-sm font-bold disabled:opacity-50">
                        {isAddingFlashcard ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        Add Word
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {localFlashcards.map((card, idx) => (
                    <div key={idx} className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm flex flex-col group relative">
                        <div className="aspect-[4/3] bg-slate-50 flex items-center justify-center p-4 border-b border-slate-100 relative">
                            {flashcardImages[idx] ? (
                                <img src={flashcardImages[idx]} className="w-full h-full object-contain" alt={card.word} />
                            ) : (
                                <div className="text-center">
                                    <ImageIcon className="w-12 h-12 text-slate-200 mx-auto mb-2" />
                                    <button
                                        onClick={() => handleGenerateFlashcardImage(idx, card.visualPrompt || card.word)}
                                        disabled={generatingCardIndex === idx}
                                        className="text-[10px] font-black uppercase tracking-widest text-indigo-500 hover:underline disabled:opacity-50"
                                    >
                                        {generatingCardIndex === idx ? 'Creating...' : 'Generate Image'}
                                    </button>
                                </div>
                            )}
                            <div className="absolute top-2 right-2 flex gap-1 no-print opacity-0 group-hover:opacity-100 transition-all">
                                {flashcardImages[idx] && (
                                    <button
                                        onClick={() => handleGenerateFlashcardImage(idx, card.visualPrompt || card.word)}
                                        disabled={generatingCardIndex === idx}
                                        className="p-1.5 bg-white/80 hover:bg-indigo-50 hover:text-white rounded-full text-slate-400 transition-all shadow-sm"
                                        title="Regenerate Image"
                                    >
                                        {generatingCardIndex === idx ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                    </button>
                                )}
                                {flashcardImages[idx] && (
                                    <button
                                        onClick={() => handleDownloadFlashcard(idx)}
                                        className="p-1.5 bg-white/80 hover:bg-indigo-50 hover:text-white rounded-full text-slate-400 transition-all shadow-sm"
                                        title="Download Front (Image)"
                                    >
                                        <ImageIcon className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                <button
                                    onClick={() => handleDownloadFlashcardText(idx)}
                                    className="p-1.5 bg-white/80 hover:bg-teal-500 hover:text-white rounded-full text-slate-400 transition-all shadow-sm"
                                    title="Download Back (Explanation)"
                                >
                                    <FileText className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => handleDownloadFlashcardPDF(idx)}
                                    className="p-1.5 bg-white/80 hover:bg-purple-500 hover:text-white rounded-full text-slate-400 transition-all shadow-sm"
                                    title="Download Complete PDF"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={(e) => removeFlashcard(idx, e)} className="p-1.5 bg-white/80 hover:bg-red-500 hover:text-white rounded-full text-slate-400 transition-all shadow-sm" title="Remove Flashcard">
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                        <div className="p-5 text-center flex-1 flex flex-col justify-center">
                            <input
                                value={card.word}
                                onChange={(e) => handleFlashcardChange(idx, 'word', e.target.value)}
                                className="text-xl font-black text-indigo-900 bg-transparent border-none text-center outline-none focus:ring-1 focus:ring-indigo-100 rounded"
                            />
                            <AutoResizeTextarea
                                value={card.definition}
                                onChange={(e) => handleFlashcardChange(idx, 'definition', e.target.value)}
                                className="text-xs text-slate-500 italic mt-2 text-center bg-transparent border-none outline-none"
                                minRows={1}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
