import React, { useRef, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { StudentGrade, CEFRLevel, FileData } from '../types';
import { Target, CloudUpload, Image as ImageIcon, X, PenTool, Camera, Sparkles, School, Gauge } from 'lucide-react';

interface EssayInputFormProps {
    onSubmit: (data: {
        essay: string | FileData;
        grade: StudentGrade;
        cefr: CEFRLevel;
        topic: string | FileData;
    }) => Promise<void>;
    disabled?: boolean;
}

export function EssayInputForm({ onSubmit, disabled }: EssayInputFormProps) {
    const { t } = useLanguage();

    // Settings
    const [selectedGrade, setSelectedGrade] = useState<StudentGrade>(StudentGrade.G7);
    const [selectedCEFR, setSelectedCEFR] = useState<CEFRLevel>(CEFRLevel.B1);

    // Topic Inputs
    const [topicText, setTopicText] = useState('');
    const [topicImage, setTopicImage] = useState<FileData | null>(null);

    // Essay Inputs
    const [essayText, setEssayText] = useState('');
    const [essayImage, setEssayImage] = useState<FileData | null>(null);

    const topicFileRef = useRef<HTMLInputElement>(null);
    const essayFileRef = useRef<HTMLInputElement>(null);

    const readFile = (file: File): Promise<FileData> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                resolve({
                    base64: (reader.result as string).split(',')[1],
                    mimeType: file.type,
                    name: file.name
                });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const handleTopicFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) setTopicImage(await readFile(file));
    };

    const handleEssayFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) setEssayImage(await readFile(file));
    };

    const handleSubmit = async () => {
        const finalEssay = essayImage ? { base64: essayImage.base64, mimeType: essayImage.mimeType, name: essayImage.name } : essayText;
        const finalTopic = topicImage ? { base64: topicImage.base64, mimeType: topicImage.mimeType, name: topicImage.name } : topicText;

        await onSubmit({
            essay: finalEssay,
            grade: selectedGrade,
            cefr: selectedCEFR,
            topic: finalTopic
        });
    };

    return (
        <div className="space-y-8">
            {/* Title */}
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-500" />
                {t('input.submit')}
            </h2>

            {/* Grade & CEFR Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <School className="w-4 h-4 text-indigo-500" />
                        {t('input.grade')}
                    </label>
                    <select
                        value={selectedGrade}
                        onChange={(e) => setSelectedGrade(e.target.value as StudentGrade)}
                        className="input-field appearance-none cursor-pointer py-3"
                        disabled={disabled}
                    >
                        {Object.values(StudentGrade).map(grade => (
                            <option key={grade} value={grade}>{grade}</option>
                        ))}
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <Gauge className="w-4 h-4 text-indigo-500" />
                        {t('input.cefr')}
                    </label>
                    <select
                        value={selectedCEFR}
                        onChange={(e) => setSelectedCEFR(e.target.value as CEFRLevel)}
                        className="input-field appearance-none cursor-pointer py-3"
                        disabled={disabled}
                    >
                        {Object.values(CEFRLevel).map(level => (
                            <option key={level} value={level}>{level}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Prompt & Essay Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Essay Prompt */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <Target className="w-4 h-4 text-indigo-500" />
                            {t('input.prompt')}
                        </label>
                        <button
                            onClick={() => topicFileRef.current?.click()}
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                            disabled={disabled}
                        >
                            <CloudUpload className="w-4 h-4" />
                            {topicImage ? t('input.changeImage') : t('input.uploadImage')}
                        </button>
                    </div>

                    {topicImage && (
                        <div className="bg-indigo-50 p-2 rounded-xl border border-indigo-100 flex items-center justify-between">
                            <div className="flex items-center gap-2 truncate">
                                <ImageIcon className="w-4 h-4 text-indigo-400" />
                                <span className="text-xs font-medium text-indigo-700 truncate">{topicImage.name}</span>
                            </div>
                            <button
                                onClick={() => setTopicImage(null)}
                                className="text-indigo-400 hover:text-rose-500"
                                disabled={disabled}
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    )}

                    <textarea
                        value={topicText}
                        onChange={(e) => setTopicText(e.target.value)}
                        placeholder={t('input.promptPlaceholder')}
                        className="input-field h-48 text-sm resize-none"
                        disabled={disabled}
                    />
                    <input type="file" ref={topicFileRef} onChange={handleTopicFileChange} className="hidden" accept="image/*" />
                </div>

                {/* Student Essay */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <PenTool className="w-4 h-4 text-indigo-500" />
                            {t('input.essay')}
                        </label>
                        <button
                            onClick={() => essayFileRef.current?.click()}
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                            disabled={disabled}
                        >
                            <Camera className="w-4 h-4" />
                            {essayImage ? t('input.changePhoto') : t('input.takePhoto')}
                        </button>
                    </div>

                    {essayImage && (
                        <div className="bg-indigo-50 p-2 rounded-xl border border-indigo-100 flex items-center justify-between">
                            <div className="flex items-center gap-2 truncate">
                                <ImageIcon className="w-4 h-4 text-indigo-400" />
                                <span className="text-xs font-medium text-indigo-700 truncate">{essayImage.name}</span>
                            </div>
                            <button
                                onClick={() => setEssayImage(null)}
                                className="text-indigo-400 hover:text-rose-500"
                                disabled={disabled}
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    )}

                    <textarea
                        value={essayText}
                        onChange={(e) => setEssayText(e.target.value)}
                        placeholder={t('input.essayPlaceholder')}
                        className="input-field h-48 text-sm resize-none font-sans"
                        disabled={disabled}
                    />
                    <input type="file" ref={essayFileRef} onChange={handleEssayFileChange} className="hidden" accept="image/*" />
                </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
                <button
                    onClick={handleSubmit}
                    className="w-full rounded-xl py-4 font-bold text-lg flex items-center justify-center gap-3 transition-all shadow-md bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={disabled || (!essayText && !essayImage)}
                >
                    <Sparkles className="w-5 h-5" />
                    {t('input.submit')}
                </button>
            </div>
        </div>
    );
}
