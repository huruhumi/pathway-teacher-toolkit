import React from 'react';
import { ExternalLink, Sparkles, Loader2, X, Trash2, ImageIcon } from 'lucide-react';
import { StructuredLessonPlan, PhonicsContent } from '../../../types';

export interface PhonicsTabProps {
    phonicsContent: PhonicsContent;
    setPhonicsContent: (content: PhonicsContent) => void;
    editablePlan: StructuredLessonPlan | null;
    isGeneratingPhonicsPoint: boolean;
    isGeneratingDecodableText: boolean;
    decodableTextImages: Record<number, string>;
    generatingDtImageIndex: number | null;

    openViewer: (tab: string, subTab: string) => void;
    handleAddPhonicsPoint: () => void;
    handleAddDecodableText: () => void;
    handleGenerateDtImage: (index: number) => void;
}

export const PhonicsTab: React.FC<PhonicsTabProps> = ({
    phonicsContent,
    setPhonicsContent,
    editablePlan,
    isGeneratingPhonicsPoint,
    isGeneratingDecodableText,
    decodableTextImages,
    generatingDtImageIndex,

    openViewer,
    handleAddPhonicsPoint,
    handleAddDecodableText,
    handleGenerateDtImage
}) => {
    return (
        <div className="space-y-12 animate-fade-in">
            <div className="flex justify-between items-center no-print">
                <h3 className="text-xl font-bold text-slate-800">Phonics & Decodable Practice</h3>
                <button onClick={() => openViewer('materials', 'phonics')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-sm font-bold">
                    <ExternalLink className="w-4 h-4" /> Print Preview
                </button>
            </div>

            <div className="flex flex-col space-y-12">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                    <div className="bg-purple-50 p-6 rounded-3xl border border-purple-100 shadow-sm relative overflow-hidden">
                        <div className="absolute -top-4 -right-4 bg-purple-200/20 w-16 h-16 rounded-full blur-xl"></div>
                        <div className="flex justify-between items-center mb-6">
                            <h4 className="text-[10px] font-black text-purple-900 uppercase tracking-widest">Target Sounds</h4>
                            <button onClick={handleAddPhonicsPoint} disabled={isGeneratingPhonicsPoint} className="text-[10px] font-black text-purple-600 hover:underline uppercase no-print">
                                {isGeneratingPhonicsPoint ? '...' : '+ Add Point'}
                            </button>
                        </div>
                        <div className="space-y-3">
                            {phonicsContent.keyPoints.map((point, idx) => (
                                <div key={idx} className="bg-white dark:bg-slate-900/80 dark:backdrop-blur-xl p-4 rounded-xl border border-purple-200 dark:border-purple-900/30 shadow-xs flex items-center justify-between group">
                                    <input
                                        value={point}
                                        onChange={(e) => {
                                            const updated = [...phonicsContent.keyPoints];
                                            updated[idx] = e.target.value;
                                            setPhonicsContent({ ...phonicsContent, keyPoints: updated });
                                        }}
                                        className="flex-1 bg-transparent border-none outline-none text-purple-900 font-bold"
                                    />
                                    <button
                                        onClick={() => {
                                            const updated = phonicsContent.keyPoints.filter((_, i) => i !== idx);
                                            setPhonicsContent({ ...phonicsContent, keyPoints: updated });
                                        }}
                                        className="text-purple-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all no-print"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            {phonicsContent.keyPoints.length === 0 && <p className="text-xs text-purple-400 italic text-center py-4">No phonics focus defined yet.</p>}
                        </div>
                    </div>

                    <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 shadow-sm relative overflow-hidden">
                        <div className="absolute -bottom-4 -left-4 bg-indigo-200/20 w-16 h-16 rounded-full blur-xl"></div>
                        <h4 className="text-[10px] font-black text-indigo-900 uppercase tracking-widest mb-4">Vocabulary Check</h4>
                        <div className="flex flex-wrap gap-2">
                            {editablePlan?.lessonDetails.targetVocab.map((v, i) => (
                                <span key={i} className="text-[10px] font-bold px-2 py-1 bg-white text-indigo-600 rounded-md border border-indigo-100 shadow-xs">{v.word}</span>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="w-full space-y-8">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Decodable Stories</h4>
                        <button onClick={handleAddDecodableText} disabled={isGeneratingDecodableText} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-md disabled:opacity-50 no-print flex items-center gap-2">
                            {isGeneratingDecodableText ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            Gen Story
                        </button>
                    </div>

                    {phonicsContent.decodableTexts.map((text, idx) => (
                        <div key={idx} className="space-y-6 animate-fade-in-up w-full">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch w-full">
                                <div className="w-full bg-white dark:bg-slate-900/80 dark:backdrop-blur-xl border-2 border-slate-100 dark:border-white/5 rounded-[2rem] p-8 shadow-sm relative group flex flex-col min-h-[400px]">
                                    <button
                                        onClick={() => {
                                            const newTexts = phonicsContent.decodableTexts.filter((_, i) => i !== idx);
                                            const newPrompts = phonicsContent.decodableTextPrompts.filter((_, i) => i !== idx);
                                            setPhonicsContent({ ...phonicsContent, decodableTexts: newTexts, decodableTextPrompts: newPrompts });
                                        }}
                                        className="absolute top-4 right-4 p-2 bg-slate-50 text-slate-300 hover:text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-all no-print z-10"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                    <div
                                        className="flex-1 w-full text-2xl font-medium text-slate-800 leading-[2.5] italic whitespace-pre-wrap outline-none"
                                        contentEditable
                                        suppressContentEditableWarning
                                        onBlur={(e) => {
                                            const newTexts = [...phonicsContent.decodableTexts];
                                            newTexts[idx] = e.currentTarget.innerHTML;
                                            setPhonicsContent({ ...phonicsContent, decodableTexts: newTexts });
                                        }}
                                        dangerouslySetInnerHTML={{ __html: text }}
                                    />
                                    <div className="mt-6 flex flex-wrap gap-4 pt-4 border-t border-slate-100 no-print">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[#10b981]"></div> Phonics Extension</span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[#eab308]"></div> Sight Words</span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[#8b5cf6]"></div> Target Words</span>
                                    </div>
                                </div>

                                <div className="w-full shrink-0 h-[500px] lg:h-auto">
                                    {decodableTextImages[idx] ? (
                                        <div className="h-full rounded-[2.5rem] overflow-hidden shadow-xl border-8 border-white animate-fade-in group w-full flex items-center justify-center bg-slate-50">
                                            <img src={decodableTextImages[idx]} className="max-h-full max-w-full object-contain" alt="story illustration" />
                                        </div>
                                    ) : (
                                        <div className="h-full rounded-[2.5rem] bg-slate-50 border-2 border-dashed border-slate-100 flex items-center justify-center">
                                            <ImageIcon className="w-12 h-12 text-slate-200" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-white/50 border border-slate-100 rounded-2xl p-6 flex justify-between items-center no-print">
                                <div className="flex-1 mr-6">
                                    <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-2">Visual Illustration Prompt</label>
                                    <input
                                        value={phonicsContent.decodableTextPrompts[idx] || ""}
                                        onChange={(e) => {
                                            const newPrompts = [...phonicsContent.decodableTextPrompts];
                                            newPrompts[idx] = e.target.value;
                                            setPhonicsContent({ ...phonicsContent, decodableTexts: phonicsContent.decodableTexts, decodableTextPrompts: newPrompts });
                                        }}
                                        placeholder="Describe the scene for AI illustration..."
                                        className="w-full text-sm text-slate-600 italic bg-transparent border-none outline-none focus:ring-1 focus:ring-indigo-100 rounded p-1"
                                    />
                                </div>
                                <button
                                    onClick={() => handleGenerateDtImage(idx)}
                                    disabled={generatingDtImageIndex === idx}
                                    className="px-6 py-3 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-100 transition-all shrink-0 shadow-xs flex items-center gap-2"
                                    title="Generate Story Illustration"
                                >
                                    {generatingDtImageIndex === idx ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
                                    <span className="text-xs font-black uppercase tracking-widest">{decodableTextImages[idx] ? 'Regenerate' : 'Generate'}</span>
                                </button>
                            </div>

                            {idx < phonicsContent.decodableTexts.length - 1 && <div className="border-b border-slate-100 opacity-50 my-16"></div>}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
