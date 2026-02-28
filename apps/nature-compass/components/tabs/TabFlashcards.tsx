import React from 'react';
import { BookOpen, Sparkles, Download, ImageIcon, Loader2, Trash2, Printer, Plus } from 'lucide-react';
import { VocabularyItem } from '../../types';
import { sanitizeFilename, downloadImage } from '../../utils/fileHelpers';
import { BasicInfoState } from '../../stores/useLessonStore';
import { useLanguage } from '../../i18n/LanguageContext';

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

interface TabFlashcardsProps {
    vocabList: VocabularyItem[];
    generatedImages: Record<number, string>;
    loadingImages: Set<number>;
    artStyles: Record<number, string>;
    isAddingWord: boolean;
    basicInfo: BasicInfoState;

    // Handlers
    setArtStyles: (s: Record<number, string> | ((prev: Record<number, string>) => Record<number, string>)) => void;
    handleGenerateMissingImages: () => void;
    handleDownloadAllFlashcards: () => void;
    handleGenerateSingleImage: (index: number) => void;
    updateVocab: (index: number, field: keyof VocabularyItem, value: string) => void;
    handleDownloadFlashcard: (index: number) => void;
    handleRemoveWord: (index: number) => void;
    handleAddWord: () => void;
    setZoomedImage: (img: string | null) => void;
}

export const TabFlashcards: React.FC<TabFlashcardsProps> = ({
    vocabList,
    generatedImages,
    loadingImages,
    artStyles,
    isAddingWord,
    basicInfo,
    setArtStyles,
    handleGenerateMissingImages,
    handleDownloadAllFlashcards,
    handleGenerateSingleImage,
    updateVocab,
    handleDownloadFlashcard,
    handleRemoveWord,
    handleAddWord,
    setZoomedImage
}) => {
    const { t } = useLanguage();
    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <BookOpen size={20} className="text-emerald-600" />
                    Vocabulary Flashcards
                </h3>
                <div className="flex gap-2">
                    <button
                        onClick={handleGenerateMissingImages}
                        className="text-xs font-bold px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-2"
                    >
                        <Sparkles size={14} /> Generate All Images
                    </button>
                    <button
                        onClick={handleDownloadAllFlashcards}
                        className="text-xs font-bold px-3 py-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-2"
                    >
                        <Download size={14} /> PDF
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {vocabList.map((item, idx) => (
                    <div key={idx} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden group hover:border-emerald-300 hover:shadow-md transition-all">
                        <div className="aspect-[4/3] bg-slate-100 relative group-hover:bg-slate-50 transition-colors">
                            {generatedImages[idx] ? (
                                <div className="relative w-full h-full">
                                    <img
                                        src={generatedImages[idx]}
                                        alt={item.word}
                                        className="w-full h-full object-cover cursor-pointer"
                                        onClick={() => setZoomedImage(generatedImages[idx])}
                                    />
                                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => downloadImage(generatedImages[idx], `${sanitizeFilename(basicInfo.theme)} - ${sanitizeFilename(item.word)}.png`)}
                                            className="p-1.5 bg-black/50 text-white rounded-md hover:bg-black/70 backdrop-blur-sm"
                                            title="Download Image"
                                        >
                                            <Download size={14} />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
                                    {loadingImages.has(idx) ? (
                                        <div className="flex flex-col items-center gap-2 text-emerald-600">
                                            <Loader2 size={24} className="animate-spin" />
                                            <span className="text-xs font-semibold">Generating...</span>
                                        </div>
                                    ) : (
                                        <>
                                            <ImageIcon size={32} className="text-slate-300 mb-2" />
                                            <span className="text-xs text-slate-400 mb-4">{t('fc.noImage')}</span>
                                            <div className="flex flex-col gap-2 w-full">
                                                <select
                                                    className="text-xs bg-white border border-slate-200 rounded px-2 py-1 outline-none focus:border-emerald-500"
                                                    value={artStyles[idx] || "Educational vector illustration"}
                                                    onChange={(e) => setArtStyles(prev => ({ ...prev, [idx]: e.target.value }))}
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <option value="Educational vector illustration">Vector Illustration</option>
                                                    {ART_STYLES.map(style => <option key={style} value={style}>{style}</option>)}
                                                </select>
                                                <button
                                                    onClick={() => handleGenerateSingleImage(idx)}
                                                    className="text-xs font-bold px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded transition-colors flex items-center justify-center gap-1"
                                                >
                                                    <Sparkles size={12} /> Generate
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-slate-100">
                            <div className="flex justify-between items-start mb-2">
                                <input
                                    value={item.word}
                                    onChange={(e) => updateVocab(idx, 'word', e.target.value)}
                                    className="text-lg font-bold text-slate-800 bg-transparent border-b border-transparent focus:border-emerald-500 outline-none w-full mr-2"
                                />
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleDownloadFlashcard(idx)} className="text-slate-400 hover:text-emerald-600 p-1">
                                        <Printer size={16} />
                                    </button>
                                    <button onClick={() => handleRemoveWord(idx)} className="text-slate-400 hover:text-red-500 p-1">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                            <textarea
                                value={item.definition}
                                onChange={(e) => updateVocab(idx, 'definition', e.target.value)}
                                className="text-sm text-slate-500 bg-transparent border-none outline-none resize-none w-full"
                                rows={2}
                            />
                        </div>
                    </div>
                ))}

                <button
                    onClick={handleAddWord}
                    disabled={isAddingWord}
                    className="bg-slate-50 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center p-6 text-slate-400 hover:text-emerald-600 hover:border-emerald-400 hover:bg-emerald-50 transition-all min-h-[300px]"
                >
                    {isAddingWord ? <Loader2 size={24} className="animate-spin mb-2" /> : <Plus size={32} className="mb-2" />}
                    <span className="font-semibold text-sm">{t('fc.addWord')}</span>
                </button>
            </div>
        </div>
    );
};
