import React from 'react';
import { Download, ExternalLink, Bot, Sparkles, Loader2, Plus, Trash2 } from 'lucide-react';
import { AutoResizeTextarea } from '../../common/AutoResizeTextarea';
import { StructuredLessonPlan } from '../../../types';

export interface GrammarTabProps {
    grammarInfographicUrl: string | null;
    customGrammarPrompt: string;
    isGeneratingGrammar: boolean;
    isGeneratingSingleGrammar: boolean;
    editablePlan: StructuredLessonPlan | null;

    setCustomGrammarPrompt: (val: string) => void;
    handleDownloadGrammarInfographic: () => void;
    handleGenerateGrammarInfographic: () => void;
    handleGenerateSingleGrammar: () => void;
    handleArrayChange: (field: 'objectives' | 'materials' | 'grammarSentences', index: number, value: string) => void;
    deleteArrayItem: (field: 'objectives' | 'materials' | 'grammarSentences', index: number) => void;
}

export const GrammarTab: React.FC<GrammarTabProps> = ({
    grammarInfographicUrl,
    customGrammarPrompt,
    isGeneratingGrammar,
    isGeneratingSingleGrammar,
    editablePlan,

    setCustomGrammarPrompt,
    handleDownloadGrammarInfographic,
    handleGenerateGrammarInfographic,
    handleGenerateSingleGrammar,
    handleArrayChange,
    deleteArrayItem
}) => {
    return (
        <div className="max-w-4xl mx-auto space-y-12 animate-fade-in">
            <div className="flex justify-between items-center no-print">
                <h3 className="text-lg font-bold text-slate-800">Lesson Infographic Generator</h3>
                <div className="flex gap-2">
                    {grammarInfographicUrl && (
                        <button onClick={handleDownloadGrammarInfographic} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all text-sm font-bold">
                            <Download className="w-4 h-4" /> Download Handout
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900/80 dark:backdrop-blur-xl p-6 rounded-3xl border border-slate-100 dark:border-white/5 shadow-sm space-y-6 no-print">
                <div className="space-y-4">
                    <h4 className="text-sm font-black text-indigo-900 uppercase tracking-widest flex items-center gap-2">
                        <Bot className="w-5 h-5 text-indigo-500" />
                        Customize Infographic Style
                    </h4>
                    <div className="flex gap-4">
                        <input
                            value={customGrammarPrompt}
                            onChange={(e) => setCustomGrammarPrompt(e.target.value)}
                            placeholder="e.g. Use a forest theme, make it very colorful for kids..."
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <button
                            onClick={handleGenerateGrammarInfographic}
                            disabled={isGeneratingGrammar}
                            className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
                        >
                            {isGeneratingGrammar ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                            {grammarInfographicUrl ? 'Regenerate Infographic' : 'Generate Infographic'}
                        </button>
                    </div>
                    <p className="text-[10px] text-slate-400 italic">This will integrate both Grammar Points and Target Vocabulary into a single visual handout.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Grammar Points Section */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">Key Grammar Points</h4>
                            <button onClick={handleGenerateSingleGrammar} disabled={isGeneratingSingleGrammar} className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1">
                                {isGeneratingSingleGrammar ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Add Smart Point
                            </button>
                        </div>
                        <div className="space-y-3">
                            {editablePlan?.lessonDetails.grammarSentences.map((s, i) => (
                                <div key={i} className="flex gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 group">
                                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-[10px] mt-1 shrink-0">{i + 1}</div>
                                    <AutoResizeTextarea
                                        value={s}
                                        onChange={(e) => handleArrayChange('grammarSentences', i, e.target.value)}
                                        className="flex-1 bg-transparent border-none outline-none text-sm text-slate-700 leading-relaxed font-medium"
                                    />
                                    <button onClick={() => deleteArrayItem('grammarSentences', i)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">Target Vocabulary</h4>
                        </div>
                        <div className="space-y-3">
                            {editablePlan?.lessonDetails.targetVocab.map((v, i) => (
                                <div key={i} className="flex gap-3 bg-teal-50/30 p-4 rounded-2xl border border-teal-100 group">
                                    <div className="w-6 h-6 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center font-black text-[10px] mt-1 shrink-0">{i + 1}</div>
                                    <div className="flex-1 space-y-1">
                                        <input
                                            value={v.word}
                                            readOnly
                                            className="w-full bg-transparent border-none outline-none text-sm font-black text-teal-900"
                                        />
                                        <input
                                            value={v.definition}
                                            readOnly
                                            className="w-full bg-transparent border-none outline-none text-[11px] text-teal-600 italic"
                                        />
                                    </div>
                                </div>
                            ))}
                            {(!editablePlan?.lessonDetails.targetVocab || editablePlan?.lessonDetails.targetVocab.length === 0) && (
                                <p className="text-xs text-slate-400 italic text-center py-4">No vocabulary items to illustrate yet.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {grammarInfographicUrl && (
                <div className="space-y-4 animate-fade-in-up">
                    <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest text-center">Generated Handout</h4>
                    <div className="bg-white p-4 rounded-[2.5rem] border-[12px] border-indigo-50 shadow-2xl overflow-hidden group text-center">
                        <img src={grammarInfographicUrl} className="w-full h-auto rounded-[1.5rem] mx-auto max-w-4xl" alt="infographic handout" />
                    </div>
                </div>
            )}
        </div>
    );
};
