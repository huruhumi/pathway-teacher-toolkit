import React, { useRef, useState } from 'react';
import { LessonInput, UploadedFile } from '../types';
import { ACTIVITY_FOCUS_OPTIONS, AGE_RANGES, CEFR_LEVELS, SAMPLE_THEMES, SEASONS } from '../constants';
import { Sun, CloudRain, Shuffle, Loader2 } from 'lucide-react';
import { generateRandomTheme } from '../services/geminiService';
import { useToast } from '@shared/stores/useToast';
import { useLanguage, TranslationKey } from '../i18n/LanguageContext';
import { FileUploadDropzone } from '@shared/components/ui/FileUploadDropzone';
import { Input } from '@shared/components/ui/Input';
import { Select } from '@shared/components/ui/Select';
import { Textarea } from '@shared/components/ui/Textarea';
import { Button } from '@shared/components/ui/Button';

interface InputSectionProps {
  input: LessonInput;
  setInput: React.Dispatch<React.SetStateAction<LessonInput>>;
  onSubmit: () => void;
  onStop: () => void;
  isLoading: boolean;
}

export const InputSection: React.FC<InputSectionProps> = ({ input, setInput, onSubmit, onStop, isLoading }) => {
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isGeneratingTheme, setIsGeneratingTheme] = useState(false);

  const handleFocusChange = (id: string) => {
    setInput(prev => {
      const exists = prev.activityFocus.includes(id);
      if (exists) {
        return { ...prev, activityFocus: prev.activityFocus.filter(item => item !== id) };
      }
      return { ...prev, activityFocus: [...prev.activityFocus, id] };
    });
  };

  const handleRandomTheme = async () => {
    setIsGeneratingTheme(true);
    try {
      const result = await generateRandomTheme(
        input.season,
        input.weather,
        input.activityFocus,
        input.studentAge,
        input.uploadedFiles
      );
      setInput(prev => ({
        ...prev,
        theme: result.theme,
        topicIntroduction: result.introduction
      }));
    } catch (error) {
      console.error("Theme generation failed, using fallback.");
      const random = SAMPLE_THEMES[Math.floor(Math.random() * SAMPLE_THEMES.length)];
      setInput(prev => ({
        ...prev,
        theme: random,
        topicIntroduction: "An exciting journey to explore nature."
      }));
    } finally {
      setIsGeneratingTheme(false);
    }
  };

  const processFiles = async (files: FileList) => {
    const validFiles = Array.from(files).filter(file => {
      if (!file.type.match('image.*') && file.type !== 'application/pdf' && file.type !== 'text/plain') {
        useToast.getState().error(`File ${file.name} is not a supported format (PDF, Image, Text only).`);
        return false;
      }
      return true;
    });

    const filePromises = validFiles.map(file => {
      return new Promise<UploadedFile>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          const base64Data = result.split(',')[1];
          resolve({
            name: file.name,
            type: file.type,
            data: base64Data
          });
        };
        reader.readAsDataURL(file);
      });
    });

    const newFiles = await Promise.all(filePromises);

    setInput(prev => ({ ...prev, uploadedFiles: [...prev.uploadedFiles, ...newFiles] }));
  };

  const handleFilesAdded = (files: FileList) => {
    processFiles(files);
  };

  const removeFile = (index: number) => {
    setInput(prev => ({
      ...prev,
      uploadedFiles: prev.uploadedFiles.filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="space-y-8">

      {/* Environmental Context: Weather & Season */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="input-label">
            {t('input.weatherLabel')}</label>
          <div className="flex bg-slate-100 p-1 rounded-xl w-full">
            <button
              onClick={() => setInput({ ...input, weather: 'Sunny' })}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${input.weather === 'Sunny'
                ? 'bg-white text-amber-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              <Sun size={18} />
              {t('input.sunny')}</button>
            <button
              onClick={() => setInput({ ...input, weather: 'Rainy' })}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${input.weather === 'Rainy'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              <CloudRain size={18} />
              {t('input.rainy')}</button>
          </div>
        </div>

        <div>
          <label className="input-label">
            {t('input.seasonLabel')}</label>
          <div className="grid grid-cols-4 gap-1 bg-slate-100 p-1 rounded-xl">
            {SEASONS.map((s) => (
              <button
                key={s}
                onClick={() => setInput({ ...input, season: s })}
                className={`flex items-center justify-center py-2.5 rounded-lg text-sm font-medium transition-all ${input.season === s
                  ? 'bg-white text-emerald-600 shadow-sm font-bold'
                  : 'text-slate-500 hover:text-slate-700'
                  }`}
              >{t(`season.${s}` as TranslationKey)}</button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className="input-label">
          {t('input.focusLabel')}</label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {ACTIVITY_FOCUS_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isSelected = input.activityFocus.includes(opt.id);
            return (
              <button
                key={opt.id}
                onClick={() => handleFocusChange(opt.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-all text-left ${isSelected
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 hover:border-emerald-200 hover:bg-slate-50 text-slate-600'
                  }`}
              >
                <Icon size={18} className={isSelected ? 'text-emerald-600' : 'text-slate-400'} /> {t(`focus.${opt.label}` as TranslationKey) || opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Select
          label={t('input.ageLabel')}
          value={input.studentAge}
          onChange={(e) => setInput({ ...input, studentAge: e.target.value })}
          className="py-3"
          options={AGE_RANGES.map(age => ({ label: t(`age.${age}` as any), value: age }))}
        />
        <Input
          label={t('input.studentsLabel')}
          type="number"
          min={1}
          max={50}
          value={input.studentCount}
          onChange={(e) => setInput({ ...input, studentCount: parseInt(e.target.value) || 0 })}
          className="py-3"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Input
          label={t('input.durationLabel')}
          type="number"
          min={30}
          step={15}
          value={input.duration}
          onChange={(e) => setInput({ ...input, duration: parseInt(e.target.value) || 0 })}
          className="py-3"
        />
        <Select
          label={t('input.cefrLabel')}
          value={input.cefrLevel}
          onChange={(e) => setInput({ ...input, cefrLevel: e.target.value })}
          className="py-3"
          options={CEFR_LEVELS.map(level => ({ label: t(`cefr.${level}` as any), value: level }))}
        />
        <Input
          label={t('input.handbookLabel')}
          type="number"
          min={1}
          max={20}
          value={input.handbookPages}
          onChange={(e) => setInput({ ...input, handbookPages: parseInt(e.target.value) || 0 })}
          className="py-3"
          placeholder="e.g. 5"
        />
      </div>

      <div>
        <label className="input-label">
          {t('input.workshopTheme')}
        </label>
        <div className="relative">
          <Input
            type="text"
            value={input.theme}
            onChange={(e) => setInput({ ...input, theme: e.target.value })}
            placeholder={t('input.themePlaceholderLong')}
            className="py-3 pr-14"
          />
          <button
            onClick={handleRandomTheme}
            disabled={isGeneratingTheme}
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
            title={t('input.randomThemeTitle')}
          >
            {isGeneratingTheme ? <Loader2 className="animate-spin" size={18} /> : <Shuffle size={18} />}
          </button>
        </div>
      </div>

      <Textarea
        label={t('input.introLabel')}
        value={input.topicIntroduction}
        onChange={(e) => setInput({ ...input, topicIntroduction: e.target.value })}
        placeholder={t('input.introPlaceholderLong')}
        rows={3}
        className="py-3 resize-none"
      />

      <div>
        <FileUploadDropzone
          label={t('input.materialsLabel')}
          promptText={t('input.clickUpload')}
          supportText={t('input.fileTypes')}
          accept=".pdf,image/*,.txt"
          multiple={true}
          onFilesAdded={handleFilesAdded}
          onRemoveFile={removeFile}
          files={input.uploadedFiles}
          hoverBorderColorClass="hover:border-emerald-400 group-hover:border-emerald-400"
          iconHoverColorClass="group-hover:text-emerald-500"
          listLayout="list"
        />
      </div>

      {/* Sticky CTA */}
      <div className="sticky bottom-4 z-10 pt-2">
        <Button
          onClick={isLoading ? () => { } : onSubmit}
          disabled={isLoading || (!input.theme && input.uploadedFiles.length === 0)}
          className={`w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 ${isLoading
            ? 'bg-slate-400 cursor-wait'
            : (!input.theme && input.uploadedFiles.length === 0)
              ? 'bg-slate-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-emerald-600 to-teal-600'
            }`}
          leftIcon={isLoading ? <Loader2 className="animate-spin" size={20} /> : undefined}
        >
          {isLoading ? (t('input.generatingKit' as TranslationKey) || 'Generating...') : t('input.generateKit')}
        </Button>
      </div>
    </div>
  );
};