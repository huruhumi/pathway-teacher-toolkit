import React, { forwardRef } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import type { ThemePalette } from '../../services/gemini/poster';

interface ContentIntroTemplateProps {
    platform: 'wechat' | 'xhs';
    bgImage: string;
    themeText: string;
    learningGoals: string[];
    subText?: string;
    palette?: ThemePalette | null;
}

export const ContentIntroTemplate = forwardRef<HTMLDivElement, ContentIntroTemplateProps>(({
    platform,
    bgImage,
    themeText,
    learningGoals,
    subText = "Nature Compass 自然指针 · 专属研学手册",
    palette,
}, ref) => {
    const { t } = useLanguage();
    // WeChat moments: 1:1, XHS: 3:4
    const aspectClass = platform === 'wechat' ? 'aspect-square' : 'aspect-[3/4]';
    const bg = palette
        ? `linear-gradient(${palette.gradientAngle}deg, ${palette.primary} 0%, ${palette.secondary} 50%, ${palette.primary} 100%)`
        : 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)';

    return (
        <div
            ref={ref}
            className={`relative w-full overflow-hidden bg-slate-900 ${aspectClass} flex flex-col items-center shadow-lg mx-auto max-w-sm`}
            style={{ fontFamily: "'Inter', sans-serif", background: bg }}
        >
            {/* Background Image */}
            <div
                className="absolute inset-0 bg-cover bg-center z-0"
                style={{ backgroundImage: `url(${bgImage})` }}
            />

            {/* Gradient Overlay covering more area for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/80 to-transparent z-10" />

            {/* Content Area */}
            <div className="relative z-20 flex flex-col justify-end w-full h-full p-8 pb-10 text-white">

                <div className="mt-auto space-y-4">
                    {/* Brand Header / Logo indicator */}
                    <div className="flex items-center gap-2 opacity-90 mb-2">
                        <img src="/nature-compass/brand-logo.png" alt="Nature Compass" className="w-7 h-7 rounded-full object-contain" />
                        <span className="font-bold tracking-widest text-[10px] uppercase text-emerald-50">{subText}</span>
                    </div>

                    <h2 className="text-3xl font-extrabold leading-tight tracking-tight drop-shadow-md">
                        {themeText}
                    </h2>

                    <div className="w-8 h-1 bg-emerald-500 rounded-full my-2" />

                    <div className="space-y-2 mt-4">
                        <h4 className="text-sm font-bold text-emerald-400 uppercase tracking-widest mb-3">
                            {t('poster.introTitle' as any) || 'Course Highlights'}
                        </h4>
                        {learningGoals.slice(0, 4).map((goal, index) => (
                            <div key={index} className="flex items-start gap-2 text-sm text-slate-200">
                                <span className="text-emerald-500 mt-1 flex-shrink-0">•</span>
                                <span className="leading-snug opacity-90">{goal}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
});
