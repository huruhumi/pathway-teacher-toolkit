import React, { useRef, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { StudentGrade, CEFRLevel, FileData } from '../types';
import { Target, CloudUpload, Image as ImageIcon, X, PenTool, Camera, Sparkles, School, Gauge } from 'lucide-react';
import { Button } from '@shared/components/ui/Button';
import { Textarea } from '@shared/components/ui/Textarea';
import { Select } from '@shared/components/ui/Select';

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
                <Select
                    label={t('input.grade')}
                    value={selectedGrade}
                    onChange={(e) => setSelectedGrade(e.target.value as StudentGrade)}
                    disabled={disabled}
                    containerClassName="space-y-2"
                >
                    {Object.values(StudentGrade).map(grade => (
                        <option key={grade} value={grade}>{grade}</option>
                    ))}
                </Select>
                <Select
                    label={t('input.cefr')}
                    value={selectedCEFR}
                    onChange={(e) => setSelectedCEFR(e.target.value as CEFRLevel)}
                    disabled={disabled}
                    containerClassName="space-y-2"
                >
                    {Object.values(CEFRLevel).map(level => (
                        <option key={level} value={level}>{level}</option>
                    ))}
                </Select>
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
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => topicFileRef.current?.click()}
                            className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                            disabled={disabled}
                            leftIcon={<CloudUpload className="w-4 h-4" />}
                        >
                            {topicImage ? t('input.changeImage') : t('input.uploadImage')}
                        </Button>
                    </div>

                    {topicImage && (
                        <div className="bg-indigo-50 p-2 rounded-xl border border-indigo-100 flex items-center justify-between">
                            <div className="flex items-center gap-2 truncate">
                                <ImageIcon className="w-4 h-4 text-indigo-400" />
                                <span className="text-xs font-medium text-indigo-700 truncate">{topicImage.name}</span>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setTopicImage(null)}
                                className="text-indigo-400 hover:text-rose-500 p-1 h-auto"
                                disabled={disabled}
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    )}

                    <Textarea
                        value={topicText}
                        onChange={(e) => setTopicText(e.target.value)}
                        placeholder={t('input.promptPlaceholder')}
                        className="h-48 text-sm resize-none"
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
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => essayFileRef.current?.click()}
                            className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                            disabled={disabled}
                            leftIcon={<Camera className="w-4 h-4" />}
                        >
                            {essayImage ? t('input.changePhoto') : t('input.takePhoto')}
                        </Button>
                    </div>

                    {essayImage && (
                        <div className="bg-indigo-50 p-2 rounded-xl border border-indigo-100 flex items-center justify-between">
                            <div className="flex items-center gap-2 truncate">
                                <ImageIcon className="w-4 h-4 text-indigo-400" />
                                <span className="text-xs font-medium text-indigo-700 truncate">{essayImage.name}</span>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEssayImage(null)}
                                className="text-indigo-400 hover:text-rose-500 p-1 h-auto"
                                disabled={disabled}
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    )}

                    <Textarea
                        value={essayText}
                        onChange={(e) => setEssayText(e.target.value)}
                        placeholder={t('input.essayPlaceholder')}
                        className="h-48 text-sm resize-none font-sans"
                        disabled={disabled}
                    />
                    <input type="file" ref={essayFileRef} onChange={handleEssayFileChange} className="hidden" accept="image/*" />
                </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
                <Button
                    variant="primary"
                    size="lg"
                    onClick={handleSubmit}
                    className="w-full py-4 text-lg bg-gradient-to-r from-violet-600 to-indigo-600 border-none hover:-translate-y-0.5"
                    disabled={disabled || (!essayText && !essayImage)}
                    leftIcon={<Sparkles className="w-5 h-5" />}
                >
                    {t('input.submit')}
                </Button>
            </div>
        </div>
    );
}
