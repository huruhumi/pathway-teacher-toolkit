
import React, { useState, useRef, useEffect } from 'react';
import { CEFRLevel } from '../types';
import { Upload, FileText, Image as ImageIcon, X } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { GenerationButton } from '@shared/components/GenerationButton';
import { FileUploadDropzone } from '@shared/components/ui/FileUploadDropzone';
import { Input } from '@shared/components/ui/Input';
import { Select } from '@shared/components/ui/Select';
import { Textarea } from '@shared/components/ui/Textarea';

interface InputSectionProps {
  onGenerate: (
    text: string,
    files: File[],
    level: CEFRLevel,
    topic: string,
    slideCount: number,
    duration: string,
    studentCount: string,
    lessonTitle: string
  ) => void;
  isLoading: boolean;
  initialValues?: {
    text: string;
    level: CEFRLevel;
    topic: string;
    slideCount: number;
    duration: string;
    studentCount: string;
    lessonTitle: string;
  } | null;
  onStop: () => void;
}

export const InputSection: React.FC<InputSectionProps> = ({ onGenerate, isLoading, initialValues, onStop }) => {
  const { t } = useLanguage();
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [level, setLevel] = useState<CEFRLevel>(CEFRLevel.Beginner);
  const [topic, setTopic] = useState('');
  const [slideCount, setSlideCount] = useState<number>(15);
  const [duration, setDuration] = useState('90');
  const [studentCount, setStudentCount] = useState('6');
  const [lessonTitle, setLessonTitle] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pre-fill fields when initialValues changes (from curriculum)
  useEffect(() => {
    if (initialValues) {
      setText(initialValues.text);
      setLevel(initialValues.level);
      setTopic(initialValues.topic);
      setSlideCount(initialValues.slideCount);
      setDuration(initialValues.duration);
      setStudentCount(initialValues.studentCount);
      setLessonTitle(initialValues.lessonTitle);
    }
  }, [initialValues]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFilesAdded = (addedFiles: FileList) => {
    const newFiles = Array.from(addedFiles);
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onGenerate(text, files, level, topic, slideCount, duration, studentCount, lessonTitle);
  };

  return (
    <div className="space-y-8">
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Lesson Title Input */}
        <Input
          label={t('input.lessonTitle')}
          type="text"
          required
          value={lessonTitle}
          onChange={(e) => setLessonTitle(e.target.value)}
          placeholder={t('input.lessonTitlePlaceholder')}
          className="py-3 text-base font-bold"
        />

        {/* Class Context Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
          <Select
            label={t('input.targetLevel')}
            value={level}
            onChange={(e) => setLevel(e.target.value as CEFRLevel)}
            className="py-3"
            options={Object.values(CEFRLevel).map(lvl => ({ label: t(`cefr.${lvl}` as any) as string, value: lvl }))}
          />
          <Input
            label={t('input.classDuration')}
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="e.g. 60"
            className="py-3"
          />
          <Input
            label={t('input.studentCount')}
            type="number"
            value={studentCount}
            onChange={(e) => setStudentCount(e.target.value)}
            placeholder="e.g. 20"
            className="py-3"
          />
          <Input
            containerClassName="sm:col-span-2"
            label={t('input.specificTopic')}
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={t('input.specificTopicPlaceholder')}
            className="py-3"
          />
          <Select
            label={t('input.slides')}
            value={slideCount}
            onChange={(e) => setSlideCount(Number(e.target.value))}
            className="py-3"
            options={[5, 8, 10, 12, 15, 20, 25, 30].map(num => ({ label: `${num} ${t('input.slidesUnit')}`, value: num }))}
          />
        </div>

        {/* Text Input */}
        <Textarea
          label={t('input.textContent')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('input.textPlaceholder')}
          className="py-3 h-32 resize-none"
        />

        <FileUploadDropzone
          label={t('input.uploadMaterials')}
          promptText={<span><span className="text-indigo-600">{t('input.clickToUpload')}</span> {t('input.dragAndDrop')}</span>}
          supportText={t('input.fileFormats')}
          accept="image/*,application/pdf"
          multiple={true}
          onFilesAdded={handleFilesAdded}
          onRemoveFile={removeFile}
          files={files}
          hoverBorderColorClass="hover:border-indigo-400 group-hover:border-indigo-400"
          iconHoverColorClass="group-hover:text-indigo-500"
          listLayout="grid"
        />

        {/* Sticky Action Button */}
        <div className="sticky bottom-4 z-10 pt-2">
          {isLoading ? (
            <GenerationButton
              loading={false}
              onClick={onStop}
              defaultText="Stop Generation"
              theme="indigo"
              className="bg-red-500 hover:bg-red-600 shadow-lg"
              icon={null}
            />
          ) : (
            <GenerationButton
              loading={isLoading}
              disabled={!text && files.length === 0}
              onClick={handleSubmit}
              defaultText={t('input.generateKit')}
              theme="indigo"
              className="shadow-lg"
              icon={null}
            />
          )}
        </div>
      </form>
    </div>
  );
};
