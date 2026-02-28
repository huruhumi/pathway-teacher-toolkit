import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Bold, Italic, List, Undo2 } from 'lucide-react';

interface RichTextEditorProps {
    value: string;
    onChange: (html: string) => void;
    placeholder?: string;
    className?: string;
    rows?: number;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange, placeholder = '', className = '', rows = 3 }) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const [showToolbar, setShowToolbar] = useState(false);
    const [toolbarPos, setToolbarPos] = useState({ top: 0, left: 0 });
    const isInternalUpdate = useRef(false);

    // Sync external value → editor (only when not actively editing)
    useEffect(() => {
        if (editorRef.current && !isInternalUpdate.current) {
            if (editorRef.current.innerHTML !== value) {
                editorRef.current.innerHTML = value;
            }
        }
    }, [value]);

    const handleInput = useCallback(() => {
        if (editorRef.current) {
            isInternalUpdate.current = true;
            onChange(editorRef.current.innerHTML);
            setTimeout(() => { isInternalUpdate.current = false; }, 0);
        }
    }, [onChange]);

    const execCommand = (command: string, val?: string) => {
        document.execCommand(command, false, val);
        editorRef.current?.focus();
        handleInput();
    };

    const handleSelect = useCallback(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || !editorRef.current) {
            setShowToolbar(false);
            return;
        }

        const range = sel.getRangeAt(0);
        if (!editorRef.current.contains(range.commonAncestorContainer)) {
            setShowToolbar(false);
            return;
        }

        const rect = range.getBoundingClientRect();
        const editorRect = editorRef.current.getBoundingClientRect();

        setToolbarPos({
            top: rect.top - editorRect.top - 40,
            left: rect.left - editorRect.left + rect.width / 2 - 70,
        });
        setShowToolbar(true);
    }, []);

    const handleBlur = useCallback(() => {
        // Delay to allow toolbar button clicks to register
        setTimeout(() => {
            if (!editorRef.current?.contains(document.activeElement)) {
                setShowToolbar(false);
            }
        }, 200);
    }, []);

    const minHeight = `${Math.max(rows * 1.5, 3)}em`;

    return (
        <div className="relative group">
            {/* Floating Toolbar */}
            {showToolbar && (
                <div
                    className="absolute z-40 flex items-center gap-0.5 bg-slate-800 text-white p-1 rounded-lg shadow-xl animate-fade-in"
                    style={{ top: toolbarPos.top, left: toolbarPos.left }}
                    onMouseDown={(e) => e.preventDefault()} // prevent blur on click
                >
                    <button
                        onClick={() => execCommand('bold')}
                        className="p-1.5 hover:bg-slate-700 rounded transition-colors"
                        title="Bold"
                    >
                        <Bold size={14} />
                    </button>
                    <button
                        onClick={() => execCommand('italic')}
                        className="p-1.5 hover:bg-slate-700 rounded transition-colors"
                        title="Italic"
                    >
                        <Italic size={14} />
                    </button>
                    <button
                        onClick={() => execCommand('insertUnorderedList')}
                        className="p-1.5 hover:bg-slate-700 rounded transition-colors"
                        title="Bullet List"
                    >
                        <List size={14} />
                    </button>
                    <div className="w-px h-4 bg-slate-600 mx-0.5" />
                    <button
                        onClick={() => execCommand('removeFormat')}
                        className="p-1.5 hover:bg-slate-700 rounded transition-colors"
                        title="Clear Formatting"
                    >
                        <Undo2 size={14} />
                    </button>
                </div>
            )}

            {/* Editor */}
            <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handleInput}
                onMouseUp={handleSelect}
                onKeyUp={handleSelect}
                onBlur={handleBlur}
                data-placeholder={placeholder}
                className={`
                    w-full outline-none resize-none leading-relaxed focus:ring-2 focus:ring-emerald-500/20 transition-all
                    [&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-slate-300 [&:empty]:before:italic
                    [&_b]:font-bold [&_i]:italic [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5
                    ${className}
                `}
                style={{ minHeight }}
            />
        </div>
    );
};
