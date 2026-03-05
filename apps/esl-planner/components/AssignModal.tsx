import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2 } from 'lucide-react';
import { useAuthStore } from '@shared/stores/useAuthStore';
import * as edu from '@shared/services/educationService';
import type { EduClass } from '@shared/types/education';
import { useLanguage } from '../i18n/LanguageContext';

interface AssignModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAssign: (classId: string, dueDate: string) => Promise<void>;
    assignmentType: 'worksheet' | 'companion';
    isSaving?: boolean;
}

export const AssignModal: React.FC<AssignModalProps> = ({ isOpen, onClose, onAssign, assignmentType, isSaving }) => {
    const { t } = useLanguage();
    const user = useAuthStore(s => s.user);
    const teacherId = user?.id;

    const [classes, setClasses] = useState<EduClass[]>([]);
    const [loading, setLoading] = useState(true);
    const [classId, setClassId] = useState('');
    const [dueDate, setDueDate] = useState('');

    useEffect(() => {
        if (!isOpen || !teacherId) return;
        setLoading(true);
        edu.fetchClasses(teacherId).then(data => {
            setClasses(data);
            if (data.length > 0) setClassId(data[0].id);
            setLoading(false);
        });
    }, [isOpen, teacherId]);

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold font-outfit text-slate-800 dark:text-white">
                        {t('assign.title')}
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                        <X size={20} />
                    </button>
                </div>

                {loading ? (
                    <div className="flex justify-center py-8"><Loader2 className="animate-spin text-purple-600" size={24} /></div>
                ) : classes.length === 0 ? (
                    <div className="text-center py-6 text-slate-500">
                        {t('assign.noClasses')}
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-2">
                                🏫 {t('assign.selectClass')}
                            </label>
                            <select
                                value={classId}
                                onChange={e => setClassId(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all outline-none"
                            >
                                {classes.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-2">
                                📅 {t('assign.dueDate')}
                            </label>
                            <input
                                type="date"
                                value={dueDate}
                                onChange={e => setDueDate(e.target.value)}
                                min={new Date().toISOString().split('T')[0]}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all outline-none"
                            />
                        </div>

                        <div className="pt-4 flex gap-3">
                            <button
                                onClick={onClose}
                                disabled={isSaving}
                                className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={() => onAssign(classId, dueDate)}
                                disabled={isSaving || !classId}
                                className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 transition-colors shadow-md disabled:opacity-50 flex justify-center items-center gap-2"
                            >
                                {isSaving ? <Loader2 size={18} className="animate-spin" /> : '✨'}
                                {t('assign.confirm')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
        , document.body);
};
