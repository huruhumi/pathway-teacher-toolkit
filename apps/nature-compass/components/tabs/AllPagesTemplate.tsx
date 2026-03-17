import React, { forwardRef, useMemo } from 'react';
import type { ThemePalette } from '../../services/gemini/poster';

interface AllPagesTemplateProps {
    platform: 'wechat' | 'xhs';
    bgImage: string;
    themeText: string;
    images: string[];
    subText?: string;
    palette?: ThemePalette | null;
}

/** Returns a Tailwind text-size class that keeps the title on ~1 line */
function titleSizeClass(text: string): string {
    const len = text.length;
    if (len <= 6) return 'text-2xl';
    if (len <= 10) return 'text-xl';
    if (len <= 14) return 'text-lg';
    if (len <= 18) return 'text-base';
    return 'text-sm';
}

export const AllPagesTemplate = forwardRef<HTMLDivElement, AllPagesTemplateProps>(({
    platform,
    bgImage,
    themeText,
    images,
    subText = "Nature Compass 自然指针 · 专属研学手册",
    palette,
}, ref) => {
    const aspectClass = platform === 'wechat' ? 'aspect-square' : 'aspect-[3/4]';
    const titleClass = useMemo(() => titleSizeClass(themeText), [themeText]);
    const bg = palette
        ? `linear-gradient(${palette.gradientAngle}deg, ${palette.primary} 0%, ${palette.secondary} 50%, ${palette.primary} 100%)`
        : 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)';

    return (
        <div
            ref={ref}
            className={`relative w-full overflow-hidden ${aspectClass} flex flex-col items-center shadow-lg mx-auto max-w-sm`}
            style={{ fontFamily: "'Inter', sans-serif", background: bg }}
        >
            {/* Decorative Border Frame */}
            <div className="absolute inset-3 border border-white/15 rounded-2xl z-10 pointer-events-none" />
            <div className="absolute inset-5 border border-white/8 rounded-xl z-10 pointer-events-none" />

            {/* Corner Decorations */}
            <svg className="absolute top-4 left-4 w-8 h-8 text-emerald-500/40 z-10" viewBox="0 0 32 32" fill="none">
                <path d="M2 16C2 8 8 2 16 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M2 10C2 6 6 2 10 2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
                <circle cx="4" cy="4" r="1.5" fill="currentColor" opacity="0.6" />
            </svg>
            <svg className="absolute top-4 right-4 w-8 h-8 text-emerald-500/40 z-10 rotate-90" viewBox="0 0 32 32" fill="none">
                <path d="M2 16C2 8 8 2 16 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M2 10C2 6 6 2 10 2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
                <circle cx="4" cy="4" r="1.5" fill="currentColor" opacity="0.6" />
            </svg>
            <svg className="absolute bottom-4 left-4 w-8 h-8 text-emerald-500/40 z-10 -rotate-90" viewBox="0 0 32 32" fill="none">
                <path d="M2 16C2 8 8 2 16 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M2 10C2 6 6 2 10 2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
                <circle cx="4" cy="4" r="1.5" fill="currentColor" opacity="0.6" />
            </svg>
            <svg className="absolute bottom-4 right-4 w-8 h-8 text-emerald-500/40 z-10 rotate-180" viewBox="0 0 32 32" fill="none">
                <path d="M2 16C2 8 8 2 16 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M2 10C2 6 6 2 10 2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
                <circle cx="4" cy="4" r="1.5" fill="currentColor" opacity="0.6" />
            </svg>

            {/* Subtle leaf pattern overlay */}
            <div className="absolute inset-0 z-5 opacity-[0.03]" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 10c-5 8-15 12-20 18s2 14 10 14c5 0 8-3 10-8 2 5 5 8 10 8 8 0 15-8 10-14S35 18 30 10z' fill='%2310b981' fill-opacity='0.5'/%3E%3C/svg%3E")`,
                backgroundSize: '60px 60px'
            }} />

            {/* Grid Image Area — takes up most of the card */}
            <div className="absolute top-6 left-6 right-6 bottom-[22%] z-20 flex flex-col items-center justify-center overflow-hidden">
                {images.length === 0 ? (
                    <div className="text-white/50 text-sm border-2 border-dashed border-white/20 rounded-xl w-full h-full flex flex-col items-center justify-center p-8 bg-white/5 backdrop-blur-sm">
                        No Grid Image Uploaded
                        <p className="text-xs mt-2 opacity-70 text-center">Upload a single combined image showing all your pages in a grid to display here.</p>
                    </div>
                ) : (
                    <div className="w-full h-full flex items-start justify-center">
                        <div className="shadow-[0_15px_50px_-12px_rgba(0,0,0,0.7)] rounded-lg overflow-hidden border-2 border-white/90 bg-white w-full h-full">
                            <img src={images[0]} alt="All Pages Grid" className="w-full h-full object-contain" />
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Content Area — compact single-line title */}
            <div className="absolute bottom-0 left-0 right-0 z-30 px-7 pb-7 pt-4 text-white pointer-events-none bg-gradient-to-t from-slate-950/90 via-slate-900/50 to-transparent">
                <div className="flex items-center gap-2 opacity-90 mb-1">
                    <img src="/nature-compass/brand-logo.png" alt="Nature Compass" className="w-5 h-5 rounded-full object-contain" />
                    <span className="font-bold tracking-widest text-[9px] uppercase text-emerald-50 drop-shadow">{subText}</span>
                </div>

                <h2 className={`${titleClass} font-extrabold leading-tight tracking-tight drop-shadow-lg whitespace-nowrap overflow-hidden text-ellipsis`}>
                    {themeText}
                </h2>

                <div className="w-7 h-0.5 bg-emerald-500 rounded-full mt-1.5 shadow-sm" />
            </div>
        </div>
    );
});

AllPagesTemplate.displayName = 'AllPagesTemplate';
