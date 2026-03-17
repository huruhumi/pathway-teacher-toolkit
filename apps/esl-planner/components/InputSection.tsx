import React, { useState, useEffect, useMemo } from 'react';
import { CEFRLevel } from '../types';
import { FileText, Loader2 } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { GenerationButton } from '@shared/components/GenerationButton';
import { FileUploadDropzone } from '@shared/components/ui/FileUploadDropzone';
import { Input } from '@shared/components/ui/Input';
import { Select } from '@shared/components/ui/Select';
import { Textarea } from '@shared/components/ui/Textarea';
import { GenerationProgress } from '@shared/components/GenerationProgress';
import { FallbackPrompt } from '@shared/components/FallbackPrompt';
import type { FallbackPromptContent } from '@shared/hooks/useFallbackConfirm';
import {
  listSelectableTextbookLevels,
  groupTextbookLevelOptionViews,
  buildTextbookLevelOptionViews,
  type TextbookLevelGroupView,
  type TextbookLevelOptionView,
} from '@shared/config/eslAssessmentRegistry';
import {
  OTHER_TEXTBOOK_ID,
  isCustomTextbookLevelKey,
  listCustomTextbookLevelOptions,
} from '../utils/customTextbookLevels';
import { resolveCEFRFromTextbookLevelKey } from '../utils/textbookLevelCefr';

type GenerationSourceMode = 'notebook' | 'direct';

interface InputSectionProps {
  onGenerate: (
    text: string,
    files: File[],
    level: CEFRLevel,
    topic: string,
    slideCount: number,
    duration: string,
    studentCount: string,
    lessonTitle: string,
    textbookLevelKey: string,
    sourceMode: GenerationSourceMode,
    ageGroup?: string,
  ) => void;
  isLoading: boolean;
  initialValues?: {
    text: string;
    level: CEFRLevel;
    topic: string;
    slideCount: number;
    duration: string;
    studentCount: string;
    ageGroup?: string;
    lessonTitle: string;
    textbookLevelKey?: string;
    sourceMode?: GenerationSourceMode;
  } | null;
  onStop: () => void;
  generationProgress?: {
    stage: number;
    percent: number;
    statusText: string;
    stages: string[];
  };
  pendingFallback?: FallbackPromptContent | null;
  onFallbackChoice?: (choice: 'continue' | 'cancel') => void;
}

export const InputSection: React.FC<InputSectionProps> = ({ onGenerate, isLoading, initialValues, onStop, generationProgress, pendingFallback, onFallbackChoice }) => {
  const { t, lang } = useLanguage();
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [topic, setTopic] = useState('');
  const [slideCount, setSlideCount] = useState<number>(15);
  const [duration, setDuration] = useState('90');
  const [studentCount, setStudentCount] = useState('6');
  const [lessonTitle, setLessonTitle] = useState('');
  const [sourceMode, setSourceMode] = useState<GenerationSourceMode>('notebook');
  const [ageGroup, setAgeGroup] = useState('');
  const [textbookLevelKey, setTextbookLevelKey] = useState('');
  const [textbookId, setTextbookId] = useState('');
  const textbookLevels = listSelectableTextbookLevels();
  const textbookGroupsBase = useMemo(() => groupTextbookLevelOptionViews(textbookLevels), [textbookLevels]);
  const textbookOptionsBase = useMemo(() => buildTextbookLevelOptionViews(textbookLevels), [textbookLevels]);
  const customLevelOptions = useMemo<TextbookLevelOptionView[]>(
    () =>
      listCustomTextbookLevelOptions().map((item) => ({
        levelKey: item.levelKey,
        status: 'ready',
        textbookId: OTHER_TEXTBOOK_ID,
        textbookName: lang === 'zh' ? 'Other（其他教材）' : 'Other',
        volumeLabel: item.label,
        levelLabel: item.label,
        levelDisplayName: item.label,
      })),
    [lang],
  );
  const textbookGroups = useMemo<TextbookLevelGroupView[]>(
    () => [
      ...textbookGroupsBase,
      {
        textbookId: OTHER_TEXTBOOK_ID,
        textbookName: lang === 'zh' ? 'Other（其他教材）' : 'Other',
        options: customLevelOptions,
      },
    ],
    [customLevelOptions, lang, textbookGroupsBase],
  );
  const textbookOptions = useMemo<TextbookLevelOptionView[]>(
    () => [...textbookOptionsBase, ...customLevelOptions],
    [customLevelOptions, textbookOptionsBase],
  );
  const activeTextbookGroup = useMemo(
    () => textbookGroups.find((group) => group.textbookId === textbookId) || null,
    [textbookGroups, textbookId],
  );
  const hasVideoUrlInText = /(?:youtube\.com\/watch\?v=|youtu\.be\/)/i.test(text);
  const hasTranscriptHintInText = /(transcript|caption|lyrics|summary|key points|字幕|歌词|台词|视频要点|视频摘要)/i.test(text);

  // Pre-fill fields when initialValues changes (from curriculum)
  useEffect(() => {
    if (initialValues) {
      setText(initialValues.text);
      setTopic(initialValues.topic);
      setSlideCount(initialValues.slideCount);
      setDuration(initialValues.duration);
      setStudentCount(initialValues.studentCount);
      setAgeGroup(initialValues.ageGroup || '');
      setLessonTitle(initialValues.lessonTitle);
      setSourceMode(initialValues.sourceMode || 'notebook');
      setTextbookLevelKey(initialValues.textbookLevelKey || '');
      if (initialValues.textbookLevelKey) {
        if (isCustomTextbookLevelKey(initialValues.textbookLevelKey)) {
          setTextbookId(OTHER_TEXTBOOK_ID);
        }
        const selected = textbookOptions.find((item) => item.levelKey === initialValues.textbookLevelKey);
        if (selected) setTextbookId(selected.textbookId);
      }
    }
  }, [initialValues, textbookOptions]);

  useEffect(() => {
    if (!textbookGroups.length) return;
    if (!textbookId) {
      setTextbookId(textbookGroups[0].textbookId);
      return;
    }
    const valid = textbookGroups.some((group) => group.textbookId === textbookId);
    if (!valid) {
      setTextbookId(textbookGroups[0].textbookId);
    }
  }, [textbookGroups, textbookId]);

  useEffect(() => {
    if (!textbookLevelKey) return;
    if (isCustomTextbookLevelKey(textbookLevelKey)) {
      if (textbookId !== OTHER_TEXTBOOK_ID) setTextbookId(OTHER_TEXTBOOK_ID);
      return;
    }
    const selected = textbookOptions.find((item) => item.levelKey === textbookLevelKey);
    if (selected && selected.textbookId !== textbookId) {
      setTextbookId(selected.textbookId);
    }
  }, [textbookLevelKey, textbookId, textbookOptions]);

  useEffect(() => {
    if (!activeTextbookGroup?.options?.length) return;
    const stillValid = activeTextbookGroup.options.some((item) => item.levelKey === textbookLevelKey);
    if (!stillValid) {
      setTextbookLevelKey(activeTextbookGroup.options[0].levelKey);
    }
  }, [activeTextbookGroup, textbookLevelKey]);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFilesAdded = (addedFiles: FileList) => {
    const newFiles = Array.from(addedFiles);
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const resolvedLevel = resolveCEFRFromTextbookLevelKey(textbookLevelKey, textbookOptions, CEFRLevel.Beginner);
    onGenerate(text, files, resolvedLevel, topic, slideCount, duration, studentCount, lessonTitle, textbookLevelKey, sourceMode, ageGroup || undefined);
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Select
            label={lang === 'zh' ? '教材名称' : 'Textbook'}
            value={textbookId}
            onChange={(e) => {
              const nextTextbookId = e.target.value;
              setTextbookId(nextTextbookId);
              const stillValid = textbookOptions.some(
                (item) => item.levelKey === textbookLevelKey && item.textbookId === nextTextbookId,
              );
              if (!stillValid) setTextbookLevelKey('');
            }}
            className="py-3"
            options={textbookGroups.map((group) => ({
              label: group.textbookName,
              value: group.textbookId,
            }))}
          />
          <Select
            label={lang === 'zh' ? '级别' : 'Level'}
            value={textbookLevelKey}
            onChange={(e) => setTextbookLevelKey(e.target.value)}
            className="py-3"
            options={[
              ...((activeTextbookGroup?.options || []).map((item) => ({
                label: item.textbookId === OTHER_TEXTBOOK_ID ? item.levelDisplayName : `${item.levelDisplayName} (${item.status})`,
                value: item.levelKey,
              }))),
            ]}
          />
          <Select
            label={t('input.sourceMode')}
            value={sourceMode}
            onChange={(e) => setSourceMode(e.target.value as GenerationSourceMode)}
            className="py-3"
            options={[
              { label: t('input.modeNotebook') as string, value: 'notebook' },
              { label: t('input.modeDirect') as string, value: 'direct' },
            ]}
          />
        </div>

        {/* Class Context Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
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
            containerClassName="sm:col-span-2 order-2"
            label={t('input.specificTopic')}
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={t('input.specificTopicPlaceholder')}
            className="py-3"
          />
          <Select
            label={t('input.slides')}
            containerClassName="order-3"
            value={slideCount}
            onChange={(e) => setSlideCount(Number(e.target.value))}
            className="py-3"
            options={[5, 8, 10, 12, 15, 20, 25, 30].map(num => ({ label: `${num} ${t('input.slidesUnit')}`, value: num }))}
          />
          <Select
            label={lang === 'zh' ? 'Age Group（年龄段）' : 'Age Group'}
            containerClassName="order-1"
            value={ageGroup}
            onChange={(e) => setAgeGroup(e.target.value)}
            className="py-3"
            options={[
              { label: lang === 'zh' ? '自动（根据级别推断）' : 'Auto (infer from level)', value: '' },
              { label: '4-6 (K)', value: '4-6' },
              { label: '6-8 (G1-G2)', value: '6-8' },
              { label: '8-10 (G3-G4)', value: '8-10' },
              { label: '10-12 (G5-G6)', value: '10-12' },
              { label: '12-14 (G7-G8)', value: '12-14' },
              { label: '14-16 (G9-G10)', value: '14-16' },
              { label: '16-18 (G11-G12)', value: '16-18' },
            ]}
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
        {hasVideoUrlInText && !hasTranscriptHintInText && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            {lang === 'zh'
              ? '检测到视频链接：系统会先尝试提取字幕；若失败会自动检索回退证据，并在继续生成前让你确认歌词/要点。建议仍补充关键要点以提升准确性。'
              : 'Video URL detected: the planner will first try transcript extraction. If it fails, it will auto-find fallback evidence and ask for your confirmation before generation. Adding key points still improves accuracy.'}
          </p>
        )}

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
            <>
              <GenerationButton
                loading={false}
                onClick={onStop}
                defaultText={<><Loader2 className="animate-spin" size={20} /> Stop Generation</>}
                theme="indigo"
                className="bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 shadow-lg"
                icon={null}
              />
              <GenerationProgress
                statusText={generationProgress?.statusText || (lang === 'zh' ? '正在生成课程套件...' : 'Generating lesson kit...')}
                progress={generationProgress?.percent}
                stages={generationProgress?.stages}
                currentStage={generationProgress?.stage}
                theme="indigo"
              />
              {pendingFallback && onFallbackChoice && (
                <FallbackPrompt
                  title={pendingFallback.title}
                  detail={pendingFallback.detail}
                  onContinue={() => onFallbackChoice('continue')}
                  onCancel={() => onFallbackChoice('cancel')}
                  continueLabel={lang === 'zh' ? '继续 Fallback 生成' : 'Continue with Fallback'}
                  cancelLabel={lang === 'zh' ? '停止生成' : 'Stop Generation'}
                />
              )}
            </>
          ) : (
            <GenerationButton
              loading={isLoading}
              disabled={!lessonTitle.trim() || (!text && files.length === 0) || !textbookLevelKey}
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
