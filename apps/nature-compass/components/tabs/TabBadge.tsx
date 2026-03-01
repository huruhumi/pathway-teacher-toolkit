import React from 'react';
import { BadgeCheck, Edit2, Download, Loader2, Sparkles } from 'lucide-react';
import { sanitizeFilename, downloadImage } from '../../utils/fileHelpers';
import { BasicInfoState } from '../../stores/useLessonStore';
import { useLanguage } from '../../i18n/LanguageContext';

interface TabBadgeProps {
    badgePrompt: string;
    badgeImage: string | null;
    loadingBadge: boolean;
    basicInfo: BasicInfoState;

    // Handlers
    setBadgePrompt: (p: string) => void;
    handleGenerateBadge: () => void;
}

export const TabBadge: React.FC<TabBadgeProps> = ({
    badgePrompt,
    badgeImage,
    loadingBadge,
    basicInfo,
    setBadgePrompt,
    handleGenerateBadge
}) => {
    const { t } = useLanguage();
    return (
        <div className="space-y-5 animate-fade-in flex flex-col items-center justify-center min-h-[300px]">
            <div className="text-center max-w-lg mx-auto mb-4 w-full px-4">
                <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center justify-center gap-2">
                    <BadgeCheck size={22} className="text-emerald-500" />
                    {t('badge.title')}
                </h3>

                <div className="w-full relative group">
                    <textarea
                        value={badgePrompt}
                        onChange={(e) => setBadgePrompt(e.target.value)}
                        className="w-full text-center text-slate-600 bg-slate-50 hover:bg-white focus:bg-white border border-transparent hover:border-emerald-200 focus:border-emerald-500 rounded-xl p-3 outline-none transition-all resize-none shadow-sm text-sm leading-relaxed"
                        rows={3}
                        placeholder="Enter badge description..."
                    />
                    <div className="absolute right-3 bottom-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <Edit2 size={14} />
                    </div>
                </div>
            </div>

            <div className="relative group">
                {badgeImage ? (
                    <div className="relative p-3 bg-white rounded-full shadow-xl border-4 border-slate-100">
                        <img
                            src={badgeImage}
                            alt="Achievement Badge"
                            className="w-48 h-48 object-contain rounded-full"
                        />
                        <button
                            onClick={() => downloadImage(badgeImage, `${sanitizeFilename(basicInfo.theme)} - Badge.png`)}
                            className="absolute bottom-0 right-0 p-3 bg-emerald-600 text-white rounded-full shadow-lg hover:bg-emerald-700 transition-transform hover:scale-110"
                            title="Download Badge"
                        >
                            <Download size={24} />
                        </button>
                    </div>
                ) : (
                    <div className="w-48 h-48 rounded-full bg-slate-50 border-4 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400">
                        {loadingBadge ? (
                            <Loader2 size={48} className="animate-spin text-emerald-500" />
                        ) : (
                            <>
                                <BadgeCheck size={48} className="mb-2 opacity-50" />
                                <span className="text-sm font-semibold">{t('badge.noBadge')}</span>
                            </>
                        )}
                    </div>
                )}
            </div>

            <div className="flex gap-4">
                <button
                    onClick={handleGenerateBadge}
                    disabled={loadingBadge}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {loadingBadge ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
                    {badgeImage ? t("badge.regenerate") : t("badge.generate")}
                </button>
            </div>
        </div>
    );
};
