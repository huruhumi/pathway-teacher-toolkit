import React from 'react';
import { Download, ExternalLink, Sparkles, Loader2, PencilLine } from 'lucide-react';

export interface WhiteboardTabProps {
    blackboardImageUrl: string | null;
    customWhiteboardPrompt: string;
    isGeneratingWhiteboard: boolean;

    setCustomWhiteboardPrompt: (val: string) => void;
    handleDownloadWhiteboardDesign: () => void;
    handleGenerateWhiteboardDesign: () => void;
}

export const WhiteboardTab: React.FC<WhiteboardTabProps> = ({
    blackboardImageUrl,
    customWhiteboardPrompt,
    isGeneratingWhiteboard,

    setCustomWhiteboardPrompt,
    handleDownloadWhiteboardDesign,
    handleGenerateWhiteboardDesign
}) => {
    return (
        <div className="max-w-5xl mx-auto space-y-12 animate-fade-in">
            <div className="flex justify-between items-center no-print">
                <h3 className="text-lg font-bold text-slate-800">Whiteboard Design Reference</h3>
                <div className="flex gap-2">
                    {blackboardImageUrl && (
                        <button onClick={handleDownloadWhiteboardDesign} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all text-sm font-bold">
                            <Download className="w-4 h-4" /> Download Design
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900/80 dark:backdrop-blur-xl p-6 rounded-3xl border border-slate-100 dark:border-white/5 shadow-sm space-y-4 no-print">
                <div className="flex flex-col gap-4">
                    <h4 className="text-sm font-black text-indigo-900 uppercase tracking-widest flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-indigo-500" />
                        Smart Whiteboard Generation
                    </h4>
                    <p className="text-xs text-slate-500 leading-relaxed">Generate a classroom whiteboard reference based on your current topic and vocabulary. The design will combine text and illustrations with a clear structure.</p>
                    <div className="flex gap-4">
                        <input
                            value={customWhiteboardPrompt}
                            onChange={(e) => setCustomWhiteboardPrompt(e.target.value)}
                            placeholder="Add extra style notes (e.g. 'Use more animal sketches', 'Make vocabulary section larger')..."
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <button
                            onClick={handleGenerateWhiteboardDesign}
                            disabled={isGeneratingWhiteboard}
                            className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md disabled:opacity-50 flex items-center gap-2 shrink-0"
                        >
                            {isGeneratingWhiteboard ? <Loader2 className="w-5 h-5 animate-spin" /> : <PencilLine className="w-5 h-5" />}
                            {blackboardImageUrl ? 'Regenerate Design' : 'Generate Design'}
                        </button>
                    </div>
                </div>
            </div>

            {blackboardImageUrl ? (
                <div className="space-y-6 animate-fade-in-up">
                    <div className="bg-white p-4 rounded-[3rem] border-[16px] border-slate-100 shadow-2xl overflow-hidden group text-center relative">
                        <div className="absolute top-8 left-1/2 -translate-x-1/2 w-48 h-2 bg-slate-100 rounded-full blur-md no-print"></div>
                        <img src={blackboardImageUrl} className="w-full h-auto rounded-2xl mx-auto shadow-inner" alt="whiteboard design" />
                        <div className="absolute inset-0 flex items-center justify-center bg-white/40 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none no-print">
                            <div className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-black uppercase tracking-widest text-xs shadow-xl scale-95 group-hover:scale-100 transition-transform">
                                Classroom Whiteboard View
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="py-32 bg-slate-50 border-4 border-dashed border-slate-200 rounded-[3rem] flex flex-col items-center justify-center text-slate-300 gap-4">
                    <PencilLine className="w-16 h-16 opacity-20" />
                    <p className="font-bold uppercase tracking-[0.2em] text-sm">Design Ready to Generate</p>
                </div>
            )}
        </div>
    );
};
