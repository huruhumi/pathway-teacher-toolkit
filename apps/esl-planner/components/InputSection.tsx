
import React, { useState, useRef, useEffect } from 'react';
import { CEFRLevel } from '../types';
import { Upload, FileText, Image as ImageIcon, X, ArrowRight } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

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
}

export const InputSection: React.FC<InputSectionProps> = ({ onGenerate, isLoading, initialValues }) => {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerate(text, files, level, topic, slideCount, duration, studentCount, lessonTitle);
  };


  return (
    <div className="bg-white rounded-xl shadow-lg p-4 md:p-8 mb-8 border border-gray-100">
      <div className="mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-2">{t('input.title')}</h2>
        <p className="text-sm md:text-base text-gray-500">{t('input.desc')}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Lesson Title Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{t('input.lessonTitle')}</label>
          <input
            type="text"
            required
            value={lessonTitle}
            onChange={(e) => setLessonTitle(e.target.value)}
            placeholder={t('input.lessonTitlePlaceholder')}
            className="w-full rounded-lg border-gray-300 border p-4 text-base font-bold focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
          />
        </div>

        {/* Class Context Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('input.targetLevel')}</label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as CEFRLevel)}
              className="w-full rounded-lg border-gray-300 border p-3 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
            >
              {Object.values(CEFRLevel).map((lvl) => (
                <option key={lvl} value={lvl}>{t(`cefr.${lvl}` as any)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('input.classDuration')}</label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="e.g. 60"
              className="w-full rounded-lg border-gray-300 border p-3 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('input.studentCount')}</label>
            <input
              type="number"
              value={studentCount}
              onChange={(e) => setStudentCount(e.target.value)}
              placeholder="e.g. 20"
              className="w-full rounded-lg border-gray-300 border p-3 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('input.specificTopic')}</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={t('input.specificTopicPlaceholder')}
              className="w-full rounded-lg border-gray-300 border p-3 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('input.slides')}</label>
            <select
              value={slideCount}
              onChange={(e) => setSlideCount(Number(e.target.value))}
              className="w-full rounded-lg border-gray-300 border p-3 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
            >
              {[5, 8, 10, 12, 15, 20, 25, 30].map((num) => (
                <option key={num} value={num}>{num} {t('input.slidesUnit')}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Text Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{t('input.textContent')}</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('input.textPlaceholder')}
            className="w-full h-32 rounded-lg border-gray-300 border p-3 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all resize-none"
          />
        </div>

        {/* File Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{t('input.uploadMaterials')}</label>
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-lg p-4 md:p-6 flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-gray-50 transition-all group"
          >
            <Upload className="w-8 h-8 md:w-10 md:h-10 text-gray-400 group-hover:text-primary mb-3" />
            <p className="text-xs md:text-sm text-gray-500 text-center">
              <span className="font-semibold text-primary">{t('input.clickToUpload')}</span> {t('input.dragAndDrop')}<br />
              {t('input.fileFormats')}
            </p>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple
              accept="image/*,application/pdf"
              className="hidden"
            />
          </div>

          {files.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-3">
              {files.map((file, index) => (
                <div key={index} className="relative flex items-center bg-gray-50 border rounded-md p-2 pr-8 max-w-full">
                  {file.type.startsWith('image/') ? (
                    <ImageIcon className="w-4 h-4 md:w-5 md:h-5 text-blue-500 mr-2 flex-shrink-0" />
                  ) : (
                    <FileText className="w-4 h-4 md:w-5 md:h-5 text-red-500 mr-2 flex-shrink-0" />
                  )}
                  <span className="text-xs md:text-sm text-gray-700 truncate max-w-[120px] md:max-w-[150px]">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isLoading || (!text && files.length === 0)}
            className={`w-full py-3 md:py-4 rounded-xl font-bold text-base md:text-lg text-white shadow-md transition-all flex items-center justify-center gap-2
              ${isLoading || (!text && files.length === 0)
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-primary to-indigo-600 hover:from-indigo-600 hover:to-primary hover:shadow-lg transform hover:-translate-y-0.5'
              }`}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 md:h-5 md:w-5 border-b-2 border-white"></div>
                {t('input.generatingKit')}
              </>
            ) : (
              <>
                {t('input.generateKit')}
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
