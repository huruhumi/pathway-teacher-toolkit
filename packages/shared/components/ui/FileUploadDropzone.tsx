import React, { useRef } from 'react';
import { UploadCloud, FileText, Image as ImageIcon, X } from 'lucide-react';

export interface FileItem {
    name: string;
    type: string;
    [key: string]: any;
}

export interface FileUploadDropzoneProps {
    label?: string;
    promptText: React.ReactNode;
    supportText: string;
    accept?: string;
    multiple?: boolean;
    onFilesAdded: (files: FileList) => void;
    onRemoveFile?: (index: number) => void;
    files?: FileItem[];
    hoverBorderColorClass?: string;
    iconHoverColorClass?: string;
    listLayout?: 'grid' | 'list';
}

export const FileUploadDropzone: React.FC<FileUploadDropzoneProps> = ({
    label,
    promptText,
    supportText,
    accept = "*",
    multiple = true,
    onFilesAdded,
    onRemoveFile,
    files = [],
    hoverBorderColorClass = "hover:border-indigo-400",
    iconHoverColorClass = "group-hover:text-indigo-500",
    listLayout = 'list'
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            onFilesAdded(e.dataTransfer.files);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            onFilesAdded(e.target.files);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div>
            {label && <label className="input-label">{label}</label>}

            <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className={`border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:bg-slate-50 transition-colors cursor-pointer group ${hoverBorderColorClass}`}
            >
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    multiple={multiple}
                    accept={accept}
                    className="hidden"
                />
                <div className="flex flex-col items-center gap-2 text-slate-500">
                    <div className={`p-3 bg-slate-100 rounded-full text-slate-400 transition-colors ${iconHoverColorClass}`}>
                        <UploadCloud className="w-6 h-6" />
                    </div>
                    <div className="text-sm font-medium">
                        {promptText}
                    </div>
                    <p className="text-xs text-slate-400">{supportText}</p>
                </div>
            </div>

            {files.length > 0 && onRemoveFile && (
                <div className={listLayout === 'grid' ? "mt-4 flex flex-wrap gap-3" : "mt-3 space-y-2"}>
                    {files.map((file, idx) => (
                        <div key={idx} className={listLayout === 'grid'
                            ? "relative flex items-center bg-slate-50 border rounded-md p-2 pr-8 max-w-full"
                            : "flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg"}>

                            <div className={`flex items-center ${listLayout === 'list' ? 'gap-3 overflow-hidden' : ''}`}>
                                <div className={listLayout === 'list' ? "p-2 bg-white rounded-md border border-slate-100 text-slate-500" : ""}>
                                    {file.type.includes('image')
                                        ? <ImageIcon className={`w-4 h-4 md:w-5 md:h-5 text-blue-500 ${listLayout === 'list' ? '' : 'mr-2 flex-shrink-0'}`} />
                                        : <FileText className={`w-4 h-4 md:w-5 md:h-5 text-red-500 ${listLayout === 'list' ? '' : 'mr-2 flex-shrink-0'}`} />}
                                </div>
                                <span className={`text-sm text-slate-700 truncate font-medium ${listLayout === 'grid' ? 'max-w-[120px] md:max-w-[150px] text-xs md:text-sm' : ''}`}>{file.name}</span>
                            </div>

                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onRemoveFile(idx); }}
                                className={listLayout === 'grid'
                                    ? "absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500"
                                    : "p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"}
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
