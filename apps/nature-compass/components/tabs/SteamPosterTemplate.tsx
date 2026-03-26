import React, { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import type { ThemePalette, SteamHighlight, SteamHookItem } from '../../services/gemini/poster';

interface SteamPosterTemplateProps {
    platform: 'wechat' | 'xhs';
    bgImage: string;
    title: string;
    subtitle?: string;
    highlights: SteamHighlight[];
    goal: string;
    englishLine?: string;
    hooks?: SteamHookItem[];
    hooksText?: string;
    highlightsTitle?: string;
    timeText?: string;
    dateText?: string;
    ageText?: string;
    infoLine: string;
    palette?: ThemePalette | null;
    overlayOpacity?: number;
}

const FIT_SCALES = [1, 0.95, 0.9, 0.86, 0.82, 0.78, 0.74];

export const SteamPosterTemplate = forwardRef<HTMLDivElement, SteamPosterTemplateProps>(({
    platform,
    bgImage,
    title,
    subtitle = 'STEAM Workshop · Nature Compass',
    highlights,
    goal,
    englishLine = '',
    hooks = [],
    hooksText = '',
    highlightsTitle = '活动亮点',
    timeText = '',
    dateText = '',
    ageText = '',
    infoLine,
    palette,
    overlayOpacity = 0.14,
}, ref) => {
    const aspectClass = platform === 'wechat' ? 'aspect-square' : 'aspect-[3/4]';
    const accent = palette?.accent || '#059669';
    const shownHighlights = highlights
        .filter((h) => (h?.label || '').trim().length > 0 || (h?.desc || '').trim().length > 0)
        .slice(0, 4);
    const shownHooks = hooks
        .filter((h) =>
            (h?.title || '').trim().length > 0
            || (h?.painPoint || '').trim().length > 0
            || (h?.salesLine || '').trim().length > 0
        )
        .slice(0, 3);
    const normalizedHooksText = (hooksText || '').trim() || shownHooks
        .map((h) => [h.title, h.painPoint, h.salesLine].filter(Boolean).join(' '))
        .filter(Boolean)
        .join('\n');

    const fitContainerRef = useRef<HTMLDivElement>(null); // glassmorphism panel
    const fitContentRef = useRef<HTMLDivElement>(null);   // scaled content
    const outerRef = useRef<HTMLDivElement>(null);         // outer wrapper, for poster height
    const [fitIndex, setFitIndex] = useState(0);

    const fitScale = FIT_SCALES[fitIndex] ?? FIT_SCALES[FIT_SCALES.length - 1];

    const contentDigest = useMemo(() => (
        JSON.stringify({
            title,
            subtitle,
            goal,
            highlightsTitle,
            englishLine,
            hooksText: normalizedHooksText,
            timeText,
            dateText,
            ageText,
            infoLine,
            highlights: shownHighlights,
        })
    ), [title, subtitle, goal, highlightsTitle, englishLine, normalizedHooksText, timeText, dateText, ageText, infoLine, shownHighlights]);

    useEffect(() => {
        setFitIndex(0);
    }, [contentDigest]);

    // Fit mechanism: scale down content when it exceeds max-h of the outer wrapper
    useEffect(() => {
        const container = outerRef.current; // CSS-constrained to max-h-[60%]
        const content = fitContentRef.current;
        if (!container || !content) return;

        const frame = requestAnimationFrame(() => {
            const containerHeight = container.getBoundingClientRect().height;
            const contentVisualH = content.getBoundingClientRect().height;
            if (contentVisualH > containerHeight + 1 && fitIndex < FIT_SCALES.length - 1) {
                setFitIndex((v) => Math.min(v + 1, FIT_SCALES.length - 1));
            }
        });
        return () => cancelAnimationFrame(frame);
    }, [fitIndex, contentDigest]);

    const compact = fitIndex >= 3;
    const tiny = fitIndex >= 5;

    return (
        <div
            ref={ref}
            className={`relative w-full overflow-hidden bg-slate-900 ${aspectClass} flex flex-col shadow-lg mx-auto max-w-sm`}
            style={{ fontFamily: "'Inter', 'Noto Sans SC', sans-serif" }}
            id="steam-poster-template-root"
        >
            <div
                className="absolute inset-0 bg-cover bg-center z-0"
                style={{ backgroundImage: `url(${bgImage})` }}
            />

            <div ref={outerRef} className="absolute z-20 bottom-3 left-3 right-3 max-h-[60%] overflow-hidden">
                <div
                    ref={fitContainerRef}
                    className="rounded-2xl p-3 overflow-hidden"
                    style={{
                        background: `rgba(15, 23, 42, ${overlayOpacity})`,
                        backdropFilter: 'blur(18px) saturate(145%)',
                        WebkitBackdropFilter: 'blur(18px) saturate(145%)',
                        border: '1px solid rgba(255,255,255,0.18)',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15), 0 8px 24px rgba(2,6,23,0.18)',
                    }}
                >
                    <div
                        ref={fitContentRef}
                        style={{
                            transform: `scale(${fitScale})`,
                            transformOrigin: 'top left',
                            width: `${100 / fitScale}%`,
                        }}
                    >
                        <h2 className={`font-extrabold text-white leading-tight tracking-tight break-words ${tiny ? 'text-[15px]' : compact ? 'text-[17px]' : 'text-[21px]'}`}>
                            {title}
                        </h2>

                        {subtitle && (
                            <div className={`flex items-center gap-1.5 min-w-0 ${compact ? 'mt-0.5 mb-1' : 'mt-1 mb-1.5'}`}>
                                <img
                                    src="/nature-compass/brand-logo.png"
                                    alt="Nature Compass"
                                    className="w-3.5 h-3.5 rounded-full object-contain flex-shrink-0 opacity-90"
                                />
                                <p className={`text-white/80 font-medium break-words min-w-0 ${tiny ? 'text-[8px]' : 'text-[10px]'}`}>
                                    {subtitle}
                                </p>
                            </div>
                        )}

                        <div className="w-8 h-0.5 rounded-full" style={{ background: accent }} />

                        {(timeText || dateText || ageText) && (
                            <div className={`flex flex-wrap gap-1.5 ${compact ? 'mt-1 mb-1' : 'mt-1.5 mb-1.5'}`}>
                                {timeText && (
                                    <span className={`rounded-full px-2 py-0.5 border text-white/95 bg-white/14 border-white/18 ${tiny ? 'text-[8px]' : 'text-[9px]'}`}>
                                        ⏱ {timeText}
                                    </span>
                                )}
                                {dateText && (
                                    <span className={`rounded-full px-2 py-0.5 border text-white/95 bg-white/14 border-white/18 ${tiny ? 'text-[8px]' : 'text-[9px]'}`}>
                                        📅 {dateText}
                                    </span>
                                )}
                                {ageText && (
                                    <span className={`rounded-full px-2 py-0.5 border text-white/95 bg-white/14 border-white/18 ${tiny ? 'text-[8px]' : 'text-[9px]'}`}>
                                        👧 {ageText}
                                    </span>
                                )}
                            </div>
                        )}

                        {goal && (
                            <div className={`flex items-start gap-1.5 ${compact ? 'mb-1' : 'mb-1.5'}`}>
                                <span className={tiny ? 'text-[9px] mt-0.5' : 'text-[11px] mt-0.5'}>🎯</span>
                                <p className={`text-white/90 leading-snug break-words ${tiny ? 'text-[8px]' : 'text-[10px]'}`}>{goal}</p>
                            </div>
                        )}

                        {englishLine && (
                            <div
                                className={`rounded-lg px-2 py-1 ${compact ? 'mb-1' : 'mb-1.5'}`}
                                style={{ background: 'rgba(14,165,233,0.16)', border: '1px solid rgba(125,211,252,0.28)' }}
                            >
                                <p className={`text-cyan-100/95 leading-snug break-words ${tiny ? 'text-[8px]' : 'text-[10px]'}`}>
                                    EN · {englishLine}
                                </p>
                            </div>
                        )}

                        {shownHighlights.length > 0 && (
                            <div className={compact ? 'mb-1' : 'mb-1.5'}>
                                <p className={`font-bold text-white/70 uppercase tracking-widest ${tiny ? 'text-[8px] mb-1' : 'text-[10px] mb-1.5'}`}>
                                    {highlightsTitle}
                                </p>
                                <div className={`grid grid-cols-2 ${compact ? 'gap-1' : 'gap-1.5'}`}>
                                    {shownHighlights.map((h, i) => (
                                        <div
                                            key={i}
                                            className="rounded-lg px-2 py-1 flex items-start gap-1.5"
                                            style={{
                                                background: 'rgba(255,255,255,0.14)',
                                                border: '1px solid rgba(255,255,255,0.14)',
                                            }}
                                        >
                                            <span className={tiny ? 'text-[10px] mt-0.5' : 'text-[12px] mt-0.5'}>{h.emoji}</span>
                                            <div className="min-w-0">
                                                <p className={`font-bold text-white/95 leading-tight break-words ${tiny ? 'text-[8px]' : 'text-[10px]'}`}>{h.label}</p>
                                                {h.desc && (
                                                    <p className={`text-white/80 leading-snug break-words ${tiny ? 'text-[7px] mt-0.5' : 'text-[9px] mt-0.5'}`}>{h.desc}</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {normalizedHooksText && (
                            <div
                                className={`rounded-lg px-2 py-1 ${compact ? 'mb-1' : 'mb-1.5'}`}
                                style={{
                                    background: 'rgba(255,255,255,0.12)',
                                    border: '1px solid rgba(255,255,255,0.14)',
                                }}
                            >
                                <p className={`text-white/92 leading-snug break-words whitespace-pre-line text-center ${tiny ? 'text-[7px]' : 'text-[9px]'}`}>
                                    {normalizedHooksText}
                                </p>
                            </div>
                        )}

                        {infoLine && (
                            <div
                                className="rounded-lg px-2.5 py-1 text-center"
                                style={{
                                    background: 'rgba(255,255,255,0.16)',
                                    border: '1px solid rgba(255,255,255,0.14)',
                                }}
                            >
                                <p className={`text-white/90 font-medium leading-snug break-words ${tiny ? 'text-[7px]' : 'text-[9px]'}`}>{infoLine}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});

SteamPosterTemplate.displayName = 'SteamPosterTemplate';
