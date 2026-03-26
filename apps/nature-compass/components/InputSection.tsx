import React, { useRef, useState } from 'react';
import { LessonInput, UploadedFile, StructuredKnowledge, FactSheetSource, FactSheetFreshnessMeta, ThemeFreshnessTier, FreshnessRiskLevel, FreshnessWindow } from '../types';
import { ACTIVITY_FOCUS_OPTIONS, AGE_RANGES, CEFR_LEVELS, SAMPLE_THEMES, SEASONS } from '../constants';
import { Sun, CloudRain, Shuffle, Loader2, School, Heart, Layers, Sparkles, Wand2 } from 'lucide-react';
import { generateRandomTheme } from '../services/themeService';
import { useToast } from '@shared/stores/useToast';
import { useLanguage, TranslationKey } from '../i18n/LanguageContext';
import { FileUploadDropzone } from '@shared/components/ui/FileUploadDropzone';
import { Input } from '@shared/components/ui/Input';
import { Select } from '@shared/components/ui/Select';
import { Textarea } from '@shared/components/ui/Textarea';
import { Button } from '@shared/components/ui/Button';
import { StructuredHandbookInput } from './StructuredHandbookInput';
import { isSearchFailedKnowledgeContent } from '../services/knowledgeCache';

const WINDOW_RANK: Record<FreshnessWindow, number> = { '1y': 1, '3y': 2, '5y': 3 };
const RISK_RANK: Record<FreshnessRiskLevel, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };
const TIER_RANK: Record<ThemeFreshnessTier, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };

function aggregateKnowledgeMeta(knowledge: StructuredKnowledge[]): {
  sources: FactSheetSource[];
  freshnessMeta?: FactSheetFreshnessMeta;
  quality: 'good' | 'low' | 'insufficient';
} {
  const sourceMap = new Map<string, FactSheetSource>();
  const metas: FactSheetFreshnessMeta[] = [];

  for (const item of knowledge) {
    for (const source of item.sourceDetails || []) {
      if (!source?.url) continue;
      if (!sourceMap.has(source.url)) sourceMap.set(source.url, source);
    }
    if (item.freshnessMeta) metas.push(item.freshnessMeta);
  }

  const sources = Array.from(sourceMap.values());
  const quality: 'good' | 'low' | 'insufficient' =
    knowledge.length >= 3 && sources.length >= 3 ? 'good' : knowledge.length >= 1 ? 'low' : 'insufficient';

  if (!metas.length) return { sources, quality };

  const worstRisk = metas.reduce((worst, cur) => (RISK_RANK[cur.riskLevel] > RISK_RANK[worst.riskLevel] ? cur : worst));
  const widestWindow = metas.reduce((widest, cur) => (WINDOW_RANK[cur.effectiveWindow] > WINDOW_RANK[widest.effectiveWindow] ? cur : widest));
  const highestTier = metas.reduce((highest, cur) => (TIER_RANK[cur.themeTier] > TIER_RANK[highest.themeTier] ? cur : highest));
  const avgCoverage = metas.reduce((sum, cur) => sum + cur.coverage, 0) / metas.length;
  const degradeNotes = metas.flatMap((m) => m.degradeNotes || []).slice(0, 12);

  return {
    sources,
    quality,
    freshnessMeta: {
      themeTier: highestTier.themeTier,
      targetWindow: '1y',
      effectiveWindow: widestWindow.effectiveWindow,
      riskLevel: worstRisk.riskLevel,
      coverage: Number.isFinite(avgCoverage) ? avgCoverage : 0,
      degradeNotes: degradeNotes.length ? degradeNotes : undefined,
    },
  };
}

interface InputSectionProps {
  input: LessonInput;
  setInput: React.Dispatch<React.SetStateAction<LessonInput>>;
  onSubmit: () => void;
  onStop: () => void;
  isLoading: boolean;
}

export const InputSection: React.FC<InputSectionProps> = ({ input, setInput, onSubmit, onStop, isLoading }) => {
  const { t, lang } = useLanguage();
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

  const isFamily = input.mode === 'family';

  return (
    <div className="space-y-8">

      {/* Mode Toggle: School vs Family */}
      <div>
        <label className="input-label">{t('input.modeLabel' as TranslationKey)}</label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setInput(prev => ({ ...prev, mode: 'school', familyEslEnabled: false, studentCount: 12 }))}
            className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 text-sm font-semibold transition-all ${!isFamily
              ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm'
              : 'border-slate-200 hover:border-emerald-200 hover:bg-slate-50 text-slate-500'
              }`}
          >
            <School size={20} className={!isFamily ? 'text-emerald-600' : 'text-slate-400'} />
            {t('input.modeSchool' as TranslationKey)}
          </button>
          <button
            onClick={() => setInput(prev => ({ ...prev, mode: 'family', studentCount: 2 }))}
            className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 text-sm font-semibold transition-all ${isFamily
              ? 'border-pink-500 bg-pink-50 text-pink-800 shadow-sm'
              : 'border-slate-200 hover:border-pink-200 hover:bg-slate-50 text-slate-500'
              }`}
          >
            <Heart size={20} className={isFamily ? 'text-pink-500' : 'text-slate-400'} />
            {t('input.modeFamily' as TranslationKey)}
          </button>
        </div>

        {/* Family sub-option: ESL toggle */}
        {isFamily && (
          <div className="mt-3 flex items-center gap-3 px-4 py-3 bg-pink-50/50 border border-pink-100 rounded-xl">
            <span className="text-sm text-pink-700 font-medium">{t('input.familyEslOff' as TranslationKey)}</span>
            <button
              onClick={() => setInput(prev => ({ ...prev, familyEslEnabled: !prev.familyEslEnabled }))}
              className={`relative w-11 h-6 rounded-full transition-colors ${input.familyEslEnabled ? 'bg-indigo-500' : 'bg-slate-300'}`}
              title={t('input.familyEslToggle' as TranslationKey)}
            >
              <span className={`block w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${input.familyEslEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-sm text-indigo-700 font-medium">{t('input.familyEslOn' as TranslationKey)}</span>
          </div>
        )}
      </div>

      {/* Environmental Context: Weather & Season */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="input-label">
            {t('input.weatherLabel')}</label>
          <div className="flex bg-slate-100 p-1 rounded-xl w-full">
            <button
              onClick={() => setInput({ ...input, weather: 'Sunny' })}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${input.weather === 'Sunny'
                ? 'bg-white dark:bg-slate-900/80 text-amber-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              <Sun size={18} />
              {t('input.sunny')}</button>
            <button
              onClick={() => setInput({ ...input, weather: 'Rainy' })}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${input.weather === 'Rainy'
                ? 'bg-white dark:bg-slate-900/80 text-indigo-600 shadow-sm'
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
                  ? 'bg-white dark:bg-slate-900/80 text-emerald-600 shadow-sm font-bold'
                  : 'text-slate-500 hover:text-slate-700'
                  }`}
              >{t(`season.${s}` as TranslationKey)}</button>
            ))}
          </div>
        </div>
      </div>


      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Select
          label={t('input.ageLabel')}
          value={input.studentAge}
          onChange={(e) => setInput({ ...input, studentAge: e.target.value })}
          className="py-3"
          options={AGE_RANGES.map(age => ({ label: t(`age.${age}`), value: age }))}
        />
        {!isFamily && (
          <Input
            label={t('input.studentsLabel')}
            type="number"
            min={1}
            max={50}
            value={input.studentCount}
            onChange={(e) => setInput({ ...input, studentCount: parseInt(e.target.value) || 0 })}
            className="py-3"
          />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input
          label={t('input.durationLabel')}
          type="number"
          min={30}
          step={15}
          value={input.duration}
          onChange={(e) => setInput({ ...input, duration: parseInt(e.target.value) || 0 })}
          className="py-3"
        />
        {(!isFamily || input.familyEslEnabled) && (
          <Select
            label={t('input.cefrLabel')}
            value={input.cefrLevel}
            onChange={(e) => setInput({ ...input, cefrLevel: e.target.value })}
            className="py-3"
            options={CEFR_LEVELS.map(level => ({ label: t(`cefr.${level}`), value: level }))}
          />
        )}
      </div>

      {/* Handbook Mode Selector: Standard vs Structured */}
      <div>
        <label className="input-label">{lang === 'zh' ? '手册生成模式' : 'Handbook Mode'}</label>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            onClick={() => setInput(prev => ({ ...prev, handbookMode: prev.handbookMode === 'structured' ? 'auto' : prev.handbookMode }))}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border-2 text-xs font-semibold transition-all ${input.handbookMode !== 'structured'
              ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
              : 'border-slate-200 text-slate-500 hover:border-emerald-200'
              }`}
          >
            <Sparkles size={14} /> {lang === 'zh' ? 'AI 自动生成' : 'AI Auto'}
          </button>
          <button
            onClick={() => setInput(prev => ({ ...prev, handbookMode: 'structured' }))}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border-2 text-xs font-semibold transition-all ${input.handbookMode === 'structured'
              ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
              : 'border-slate-200 text-slate-500 hover:border-indigo-200'
              }`}
          >
            <Layers size={14} /> {lang === 'zh' ? '自定义结构' : 'Custom Structure'}
          </button>
        </div>

        {input.handbookMode !== 'structured' ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-3 text-xs text-emerald-700">
            {lang === 'zh'
              ? '手册分页配置将放在 Phase1 生成 roadmap 后进行。你可以在每个阶段单独调配页面，再进入 Phase2 生成。'
              : 'Handbook page allocation is configured after Phase1 roadmap generation. You can tune pages per phase before running Phase2.'}
          </div>
        ) : (
          <StructuredHandbookInput
            structure={input.customStructure || ''}
            onStructureChange={(text) => setInput(prev => ({ ...prev, customStructure: text }))}
            knowledge={input.structuredKnowledge || []}
            onKnowledgeReady={(k) => {
              const usable = k.filter((item) => !isSearchFailedKnowledgeContent(item.content));
              const { sources, freshnessMeta, quality } = aggregateKnowledgeMeta(usable);
              const factSheet = usable
                .map((item) => `## ${item.topic}\n${item.content}`)
                .join('\n\n---\n\n');

              setInput((prev) => ({
                ...prev,
                structuredKnowledge: k,
                factSheet: factSheet || undefined,
                factSheetQuality: quality,
                factSheetSources: sources.length ? sources : undefined,
                factSheetMeta: freshnessMeta,
              }));
            }}
            onMetaReady={({ theme, intro }) => setInput(prev => ({
              ...prev,
              theme: theme || prev.theme,
              topicIntroduction: intro || prev.topicIntroduction,
            }))}
            lang={lang}
          />
        )}
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

      {/* Activity Focus — moved below Topic Introduction */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="input-label mb-0">
            {t('input.focusLabel')}</label>
          {input.handbookMode === 'structured' && (input.structuredKnowledge?.length || input.customStructure) && (
            <button
              onClick={() => {
                const text = [
                  input.theme || '',
                  input.topicIntroduction || '',
                  input.customStructure || '',
                  ...(input.structuredKnowledge || []).map(k => `${k.topic} ${k.content}`),
                ].join(' ').toLowerCase();
                const allScored = ACTIVITY_FOCUS_OPTIONS
                  .map(opt => {
                    const keywords: Record<string, string[]> = {
                      biology: ['生物', '生态', '植物', '动物', '昆虫', '鸟', '花', '树', '种', 'biology', 'ecology', 'plant', 'animal', 'insect', 'bird', 'flower', 'tree', 'species', 'photosynthesis', 'pollination', 'ecosystem'],
                      physics: ['物理', '力', '能量', '运动', '光', '声', 'physics', 'force', 'energy', 'motion', 'light', 'sound', 'gravity', 'kinetic'],
                      chemistry: ['化学', '物质', '反应', '元素', '分子', 'chemistry', 'matter', 'reaction', 'element', 'molecule', 'acid', 'pigment'],
                      engineering: ['工程', '设计', '建造', '结构', '机械', 'engineering', 'design', 'build', 'structure', 'robot', 'bridge', 'shelter'],
                      earth: ['地球', '地质', '天文', '气象', '土壤', '岩石', '水', 'earth', 'geology', 'astronomy', 'weather', 'soil', 'rock', 'water', 'moon', 'climate', 'volcano'],
                      math: ['数学', '逻辑', '测量', '统计', '几何', 'math', 'logic', 'measure', 'statistics', 'geometry', 'calculate'],
                      art: ['美术', '绘画', '雕塑', '视觉', '艺术', 'art', 'painting', 'sculpture', 'visual', 'drawing', 'craft'],
                      theater: ['戏剧', '表演', '角色', '舞台', 'theater', 'drama', 'performance', 'role', 'stage', 'act'],
                      music: ['音乐', '声音', '乐器', '节奏', '歌', 'music', 'sound', 'instrument', 'rhythm', 'song'],
                      social: ['社会', '社区', '人文', '心理', 'social', 'community', 'society', 'psychology', 'sociology'],
                      economy: ['经济', '贸易', '市场', '商业', '金融', 'economy', 'trade', 'market', 'business', 'finance', 'commerce'],
                      history: ['历史', '文化', '遗产', '古代', '传统', '朝代', '文物', 'history', 'culture', 'heritage', 'ancient', 'tradition', 'dynasty', 'museum', 'monument'],
                    };
                    const hits = (keywords[opt.id] || []).filter(kw => text.includes(kw)).length;
                    return { id: opt.id, hits };
                  });
                const scored = allScored
                  .filter(r => r.hits > 0)
                  .sort((a, b) => b.hits - a.hits);
                // Take top 3-5: always at least 3 if available, up to 5
                const top = scored.slice(0, Math.max(3, Math.min(5, scored.length)));
                if (top.length > 0) {
                  setInput(prev => ({ ...prev, activityFocus: top.map(r => r.id) }));
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              title={lang === 'zh' ? '根据知识底稿和大纲自动选择' : 'Auto-select based on knowledge base & outline'}
            >
              <Wand2 size={14} />
              {lang === 'zh' ? '智能推荐' : 'Auto-detect'}
            </button>
          )}
        </div>
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
                  : 'border-slate-200 dark:border-white/10 hover:border-emerald-200 hover:bg-slate-50 text-slate-600 dark:text-slate-400'
                  }`}
              >
                <Icon size={18} className={isSelected ? 'text-emerald-600' : 'text-slate-400'} /> {t(`focus.${opt.label}` as TranslationKey) || opt.label}
              </button>
            );
          })}
        </div>
      </div>

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
        {isLoading ? (
          <Button
            onClick={onStop}
            className="w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600"
          >
            <Loader2 className="animate-spin" size={20} />
            {t('input.stopGeneration' as TranslationKey) || 'Stop Generation'}
          </Button>
        ) : (
          <Button
            onClick={onSubmit}
            disabled={!input.theme && input.uploadedFiles.length === 0}
            className={`w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 ${(!input.theme && input.uploadedFiles.length === 0)
              ? 'bg-slate-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-emerald-600 to-teal-600'
              }`}
          >
            {t('input.generateKit')}
          </Button>
        )}
      </div>
    </div>
  );
};
