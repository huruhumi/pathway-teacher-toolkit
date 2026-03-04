import React from 'react';
import { Pen, ChevronLeft, FileCheck, CheckCheck } from 'lucide-react';
import { useToast } from '@shared/stores/useToast';
import { ReportSectionProps } from './types';

export default function ReportActions({
    state: { readOnly },
    actions: { onReset, handleOpenPreview, handleClosePreview },
    t
}: ReportSectionProps) {
    return (
        <div className="flex flex-col md:flex-row justify-center gap-4 pt-4 print:hidden">
            {readOnly ? (
                <>
                    <button
                        type="button"
                        onClick={handleClosePreview}
                        className="px-8 py-4 bg-white text-slate-600 border border-slate-200 rounded-2xl font-bold hover:bg-slate-50 shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                        <Pen className="w-4 h-4" />
                        {t('report.backToEdit')}
                    </button>
                </>
            ) : (
                <>
                    <button
                        type="button"
                        onClick={onReset}
                        className="px-8 py-4 bg-white text-slate-600 border border-slate-200 rounded-2xl font-bold hover:bg-slate-50 shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        {t('report.startOver')}
                    </button>
                    <button
                        type="button"
                        onClick={handleOpenPreview}
                        className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                    >
                        <FileCheck className="w-4 h-4" />
                        {t('report.reportView')}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            useToast.getState().success(t('report.saveConfirm'));
                        }}
                        className="px-12 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-black shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                        <CheckCheck className="w-4 h-4" />
                        {t('report.finalize')}
                    </button>
                </>
            )}
        </div>
    );
}
