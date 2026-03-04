import React from 'react';
import { Heart } from 'lucide-react';
import { ReportSectionProps } from './types';

export default function TeacherNoteSection({
    state: { editableReport, readOnly },
    actions: { updateNestedField },
    t
}: ReportSectionProps) {
    return (
        <section className="bg-white dark:bg-slate-900/80 dark:backdrop-blur-xl p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-white/5 print:shadow-none print:p-0 print:break-inside-avoid">
            <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-rose-100 text-rose-500 flex items-center justify-center text-sm print:hidden">
                    <Heart className="w-4 h-4" />
                </span>
                <span className="print:text-lg">{t('report.teacherNote')}</span>
            </h3>

            <div className="grid gap-6">
                <div className="relative">
                    <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 rounded-full opacity-20"></div>
                    <div className="pl-6 py-2">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2 block">English Version</span>
                        {readOnly ? (
                            <div className="text-slate-700 text-sm italic leading-relaxed font-serif whitespace-pre-wrap">
                                {editableReport.teacherNote.en}
                            </div>
                        ) : (
                            <textarea
                                className="w-full text-slate-700 text-sm italic bg-transparent outline-none resize-none font-serif leading-relaxed focus:bg-slate-50 rounded p-2"
                                rows={3}
                                value={editableReport.teacherNote.en}
                                onChange={(e) => updateNestedField('teacherNote', 'en', e.target.value)}
                            />
                        )}
                    </div>
                </div>

                <div className="relative">
                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 rounded-full opacity-20"></div>
                    <div className="pl-6 py-2">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2 block">{t('report.chineseComment')}</span>
                        {readOnly ? (
                            <div className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
                                {editableReport.teacherNote.zh}
                            </div>
                        ) : (
                            <textarea
                                className="w-full text-slate-700 text-sm leading-relaxed bg-transparent outline-none resize-none focus:bg-slate-50 rounded p-2"
                                rows={3}
                                value={editableReport.teacherNote.zh}
                                onChange={(e) => updateNestedField('teacherNote', 'zh', e.target.value)}
                            />
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
