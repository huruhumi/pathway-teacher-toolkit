import React, { useState } from 'react';

// Inline SVG icons to avoid lucide-react dependency in shared package
const iconProps = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const Clock: React.FC<{ size?: number; className?: string }> = ({ size = 16, className }) => (
    <svg {...iconProps} width={size} height={size} className={className}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
);
const ArrowRight: React.FC<{ size?: number; className?: string }> = ({ size = 16, className }) => (
    <svg {...iconProps} width={size} height={size} className={className}><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
);
const Download: React.FC<{ size?: number; className?: string }> = ({ size = 16, className }) => (
    <svg {...iconProps} width={size} height={size} className={className}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
);
const Edit2: React.FC<{ size?: number; className?: string }> = ({ size = 16, className }) => (
    <svg {...iconProps} width={size} height={size} className={className}><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
);
const Trash2: React.FC<{ size?: number; className?: string }> = ({ size = 16, className }) => (
    <svg {...iconProps} width={size} height={size} className={className}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
);
const Check: React.FC<{ size?: number; className?: string }> = ({ size = 16, className }) => (
    <svg {...iconProps} width={size} height={size} className={className}><polyline points="20 6 9 17 4 12" /></svg>
);
const X: React.FC<{ size?: number; className?: string }> = ({ size = 16, className }) => (
    <svg {...iconProps} width={size} height={size} className={className}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
);

export interface TagItem {
    icon: React.ReactNode;
    label: string;
    /** If true, uses accent color (colored bg). Otherwise uses slate-100. */
    accent?: boolean;
    /** Custom class override for the tag */
    className?: string;
}

export interface RecordCardProps {
    /** Card title */
    title: string;
    /** Optional description / overview text (line-clamp-2) */
    description?: string;
    /** Array of tag pills to display */
    tags: TagItem[];
    /** Timestamp (Date object or ISO string) */
    timestamp: string | number | Date;
    /** Primary action label, e.g. "Open Curriculum" */
    openLabel: string;
    /** Called when primary open button is clicked */
    onOpen: () => void;
    /** Called when delete button is clicked */
    onDelete: () => void;

    /** Called when export button is clicked. If omitted, export button is hidden. */
    onExport?: () => void;
    /** If true, shows a loading spinner on export button */
    exporting?: boolean;

    /** Called when rename is saved. If omitted, rename button is hidden. */
    onRename?: (newName: string) => void;

    /** Accent color for the primary action. Defaults to emerald. */
    accentColor?: 'emerald' | 'violet' | 'indigo';

    /** If true, card gets a highlighted ring */
    active?: boolean;
}

const COLOR_MAP = {
    emerald: {
        open: 'text-emerald-600 hover:text-emerald-800',
        exportHover: 'hover:text-emerald-600',
        accent: 'bg-emerald-50 text-emerald-700',
        hoverBorder: 'hover:border-emerald-100',
    },
    violet: {
        open: 'text-violet-600 hover:text-violet-800',
        exportHover: 'hover:text-violet-600',
        accent: 'bg-violet-50 text-violet-700',
        hoverBorder: 'hover:border-violet-100',
    },
    indigo: {
        open: 'text-indigo-600 hover:text-indigo-800',
        exportHover: 'hover:text-indigo-600',
        accent: 'bg-indigo-50 text-indigo-700',
        hoverBorder: 'hover:border-indigo-100',
    },
};

export const RecordCard: React.FC<RecordCardProps> = ({
    title, description, tags, timestamp, openLabel,
    onOpen, onDelete, onExport, exporting, onRename,
    accentColor = 'emerald', active = false,
}) => {
    const colors = COLOR_MAP[accentColor];
    const [editing, setEditing] = useState(false);
    const [editValue, setEditValue] = useState(title);

    const startEditing = (e: React.MouseEvent) => {
        e.stopPropagation();
        setEditValue(title);
        setEditing(true);
    };

    const saveEdit = (e: React.MouseEvent | React.KeyboardEvent) => {
        e.stopPropagation();
        if (editValue.trim() && onRename) {
            onRename(editValue.trim());
        }
        setEditing(false);
    };

    const cancelEdit = (e: React.MouseEvent | React.KeyboardEvent) => {
        e.stopPropagation();
        setEditing(false);
    };

    const ts = new Date(timestamp);
    const dateStr = `${ts.toLocaleDateString()} ${ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    return (
        <div
            className={`bg-white dark:bg-slate-900/80 dark:backdrop-blur-xl rounded-xl border shadow-sm hover:shadow-lg transition-all group flex flex-col overflow-hidden ${active
                ? 'border-violet-500 ring-1 ring-violet-500'
                : `border-slate-200 dark:border-white/5 ${colors.hoverBorder} dark:hover:border-white/10`
                }`}
        >
            {/* Content area */}
            <div className="p-4 flex-1">
                {/* Title */}
                {editing ? (
                    <div className="mb-2 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="flex-1 border border-violet-300 rounded-lg px-2 py-1 text-base font-bold text-slate-800 dark:text-slate-200 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500 min-w-0"
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEdit(e);
                                if (e.key === 'Escape') cancelEdit(e);
                            }}
                        />
                        <button onClick={saveEdit} className="p-1.5 text-green-600 bg-green-50 hover:bg-green-100 rounded shadow-sm">
                            <Check className="w-4 h-4" />
                        </button>
                        <button onClick={cancelEdit} className="p-1.5 text-red-500 bg-red-50 hover:bg-red-100 rounded shadow-sm">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ) : (
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-1 line-clamp-1" title={title}>
                        {title}
                    </h3>
                )}

                {/* Description */}
                {description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">{description}</p>
                )}

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                    {tags.map((tag, i) => (
                        <span
                            key={i}
                            className={`px-2 py-0.5 text-xs font-medium rounded-md flex items-center gap-1 ${tag.className
                                ? tag.className
                                : tag.accent
                                    ? `${colors.accent} font-bold`
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                }`}
                        >
                            {tag.icon} {tag.label}
                        </span>
                    ))}
                </div>

                {/* Timestamp */}
                <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                    <Clock size={14} />
                    <span>{dateStr}</span>
                </div>
            </div>

            {/* Footer action bar */}
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onOpen}
                        className={`text-sm font-bold ${colors.open} flex items-center gap-1.5 transition-all`}
                    >
                        {openLabel}
                        <ArrowRight size={16} />
                    </button>
                    {onExport && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onExport(); }}
                            disabled={exporting}
                            className={`text-sm text-slate-400 ${colors.exportHover} flex items-center gap-1.5 transition-colors`}
                        >
                            <Download size={16} /> Export
                        </button>
                    )}
                </div>
                <div className="flex gap-1">
                    {onRename && (
                        <button
                            onClick={startEditing}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                            title="Rename"
                        >
                            <Edit2 size={16} />
                        </button>
                    )}
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                        title="Delete"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};
