import React from 'react';

export interface HeroBannerProps {
    /** Main heading */
    title: string;
    /** Description paragraph */
    description: string;
    /** Gradient CSS classes, e.g. "from-indigo-600 via-violet-600 to-purple-700" */
    gradient: string;
    /** Feature tags displayed at the bottom */
    tags?: { label: string; icon?: React.ReactNode }[];
}

/**
 * Shared hero banner with gradient background, title, description, and feature tags.
 * Placed below AppHeader in each sub-project.
 */
export const HeroBanner: React.FC<HeroBannerProps> = ({
    title,
    description,
    gradient,
    tags,
}) => {
    return (
        <div
            className={`print:hidden relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} px-6 py-8 sm:px-8 sm:py-10 shadow-lg`}
        >
            {/* Decorative blobs */}
            <div className="absolute -top-12 -right-12 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full blur-xl pointer-events-none" />

            <div className="relative z-10">
                <h2 className="text-xl sm:text-2xl font-extrabold text-white mb-2 tracking-tight">
                    {title}
                </h2>
                <p className="text-white/80 text-sm sm:text-base leading-relaxed max-w-2xl">
                    {description}
                </p>

                {tags && tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-5">
                        {tags.map((tag, i) => (
                            <span
                                key={i}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-sm text-white text-xs font-semibold tracking-wide border border-white/10"
                            >
                                {tag.icon}
                                {tag.label}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
