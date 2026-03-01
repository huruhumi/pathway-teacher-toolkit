import React from 'react';
import { Box, Plus, X, Shield } from 'lucide-react';
import { SupplyList } from '../../types';
import { useLanguage } from '../../i18n/LanguageContext';

interface TabSuppliesProps {
    supplies: SupplyList;
    safetyProtocol: string[];
    handleSupplyChange: (type: 'permanent' | 'consumables', index: number, value: string) => void;
    addSupplyItem: (type: 'permanent' | 'consumables') => void;
    removeSupplyItem: (type: 'permanent' | 'consumables', index: number) => void;
    handleSafetyChange: (index: number, value: string) => void;
    addSafetyItem: () => void;
    removeSafetyItem: (index: number) => void;
}

export const TabSupplies: React.FC<TabSuppliesProps> = ({
    supplies,
    safetyProtocol,
    handleSupplyChange,
    addSupplyItem,
    removeSupplyItem,
    handleSafetyChange,
    addSafetyItem,
    removeSafetyItem
}) => {
    const { t } = useLanguage();
    return (
        <div className="space-y-8 animate-fade-in">
            <div className="bg-white dark:bg-slate-900/80 dark:backdrop-blur-xl rounded-xl border border-slate-200 dark:border-white/5 p-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Box size={20} className="text-emerald-600" />
                    {t('sup.supplyList')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="text-xs font-bold text-slate-400 uppercase">{t('sup.permanentTools')}</h4>
                        </div>
                        <div className="space-y-2">
                            {supplies.permanent.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-2 group">
                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300 flex-shrink-0" />
                                    <input
                                        value={item}
                                        onChange={(e) => handleSupplyChange('permanent', idx, e.target.value)}
                                        className="flex-1 text-sm text-slate-700 border-b border-transparent hover:border-slate-200 focus:border-emerald-500 outline-none py-1 bg-transparent"
                                    />
                                    <button onClick={() => removeSupplyItem('permanent', idx)} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity">
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                            <button onClick={() => addSupplyItem('permanent')} className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 mt-2">
                                <Plus size={14} /> {t('sup.addItem')}
                            </button>
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="text-xs font-bold text-slate-400 uppercase">{t('sup.consumables')}</h4>
                        </div>
                        <div className="space-y-2">
                            {supplies.consumables.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-2 group">
                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300 flex-shrink-0" />
                                    <input
                                        value={item}
                                        onChange={(e) => handleSupplyChange('consumables', idx, e.target.value)}
                                        className="flex-1 text-sm text-slate-700 border-b border-transparent hover:border-slate-200 focus:border-emerald-500 outline-none py-1 bg-transparent"
                                    />
                                    <button onClick={() => removeSupplyItem('consumables', idx)} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity">
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                            <button onClick={() => addSupplyItem('consumables')} className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 mt-2">
                                <Plus size={14} /> {t('sup.addItem')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-amber-50 rounded-xl border border-amber-100 p-6 shadow-sm">
                <h3 className="text-lg font-bold text-amber-900 mb-4 flex items-center gap-2">
                    <Shield size={20} className="text-amber-600" />
                    {t('sup.safetyProtocol')}
                </h3>
                <div className="space-y-2">
                    {safetyProtocol.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-3 group">
                            <span className="text-amber-400 font-bold text-sm mt-1.5">{idx + 1}.</span>
                            <textarea
                                value={item}
                                onChange={(e) => handleSafetyChange(idx, e.target.value)}
                                className="flex-1 text-sm text-amber-900 bg-transparent border-b border-transparent focus:border-amber-300 outline-none resize-none"
                                rows={1}
                                style={{ minHeight: '1.5em', height: 'auto' }}
                                onInput={(e) => { e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px'; }}
                            />
                            <button onClick={() => removeSafetyItem(idx)} className="opacity-0 group-hover:opacity-100 text-amber-400 hover:text-red-500 transition-opacity mt-1">
                                <X size={14} />
                            </button>
                        </div>
                    ))}
                    <button onClick={addSafetyItem} className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 mt-2">
                        <Plus size={14} /> {t('sup.addItem')}
                    </button>
                </div>
            </div>
        </div>
    );
};
