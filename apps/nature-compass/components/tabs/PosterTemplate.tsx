import React, { forwardRef } from 'react';
import type { ThemePalette } from '../../services/gemini/poster';

interface PosterTemplateProps {
    platform: 'wechat' | 'xhs';
    bgImage: string;
    themeText: string;
    subText?: string;
    palette?: ThemePalette | null;
}

export const PosterTemplate = forwardRef<HTMLDivElement, PosterTemplateProps>(({
    platform,
    bgImage,
    themeText,
    subText = "Nature Discovery Workshop",
    palette,
}, ref) => {
    // WeChat moments: 1:1, XHS: 3:4
    const aspectClass = platform === 'wechat' ? 'aspect-square' : 'aspect-[3/4]';

    return (
        <div
            ref={ref}
            className={`relative w-full overflow-hidden bg-slate-900 ${aspectClass} flex flex-col items-center shadow-lg mx-auto max-w-sm`}
            style={{ fontFamily: "'Inter', sans-serif" }}
            id="poster-template-root"
        >
            {/* Background Image */}
            <div
                className="absolute inset-0 bg-cover bg-center z-0"
                style={{ backgroundImage: `url(${bgImage})` }}
            />

            {/* Gradient Overlay — Multi-layer soft blend for seamless transition */}
            {/* Layer 1: Tall atmospheric fade from bottom */}
            <div className="absolute inset-0 z-10" style={{
                background: 'linear-gradient(to top, rgba(2,6,23,1) 0%, rgba(2,6,23,0.95) 15%, rgba(2,6,23,0.7) 30%, rgba(2,6,23,0.3) 50%, rgba(2,6,23,0.05) 65%, transparent 80%)'
            }} />
            {/* Layer 2: Subtle mid-tone vignette for extra softness */}
            <div className="absolute inset-0 z-10" style={{
                background: 'radial-gradient(ellipse at center 70%, transparent 30%, rgba(2,6,23,0.4) 100%)'
            }} />

            {/* Content Area */}
            <div className="relative z-20 flex flex-col justify-end w-full h-full p-8 pb-10 text-white">

                {/* Typography Focus */}
                <div className="mt-auto space-y-3">
                    {/* Brand Header / Logo indicator */}
                    <div className="flex items-center gap-2 opacity-90 mb-2">
                        <img src="/nature-compass/brand-logo.png" alt="Nature Compass" className="w-7 h-7 rounded-full object-contain" />
                        <span className="font-bold tracking-widest text-[11px] uppercase text-emerald-50">Nature Compass 自然指针</span>
                    </div>

                    <h2 className="text-4xl font-extrabold leading-tight tracking-tight drop-shadow-md">
                        {themeText}
                    </h2>

                    {/* Decorative Line */}
                    <div className="w-10 h-1 bg-emerald-500 mt-5 rounded-full" />

                    {/* Subtitle */}
                    {subText && (
                        <p className="text-sm text-white/70 mt-3 tracking-wide font-medium">
                            {subText}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
});

PosterTemplate.displayName = 'PosterTemplate';
