import React, { useState } from 'react';
import { Save, Check as CheckIcon } from 'lucide-react';
import {
    Sparkles, MapPin, CloudRain, BookOpen, Users,
    GraduationCap, ArrowRight, Loader2,
    Trees, FileText, ArrowLeft,
    ChevronDown, ChevronUp
} from 'lucide-react';
import { Curriculum, CurriculumLesson, CurriculumParams } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { BatchItemStatus } from '../hooks/useBatchGenerate';

interface CurriculumResultDisplayProps {
    curriculumEN: Curriculum | null;
    curriculumCN: Curriculum | null;
    activeLanguage: 'en' | 'zh';
    setActiveLanguage: (lang: 'en' | 'zh') => void;
    savedParams: CurriculumParams | null;
    onBack: () => void;
    onNew: () => void;
    onSave?: (curriculum: Curriculum, params: CurriculumParams, language: 'en' | 'zh') => void;
    onGenerateKit: (lesson: CurriculumLesson, params: CurriculumParams, language: 'en' | 'zh') => void;
    // Batch generate
    batchStatus?: Record<number, BatchItemStatus>;
    batchLessonMap?: Record<number, string>;
    batchRunning?: boolean;
    batchProgress?: { done: number; total: number; errors: number };
    onBatchGenerate?: (lessons: CurriculumLesson[], params: CurriculumParams, language: 'en' | 'zh') => void;
    onCancelBatch?: () => void;
    onOpenPlan?: (savedId: string) => void;
}

export const CurriculumResultDisplay: React.FC<CurriculumResultDisplayProps> = ({
    curriculumEN, curriculumCN,
    activeLanguage, setActiveLanguage,
    savedParams,
    onBack, onNew, onSave, onGenerateKit,
    batchStatus = {}, batchLessonMap = {}, batchRunning = false, batchProgress,
    onBatchGenerate, onCancelBatch, onOpenPlan,
}) => {
    const { t } = useLanguage();
    const [expandedLessons, setExpandedLessons] = useState<Set<number>>(new Set());
    const [isSavedEN, setIsSavedEN] = useState(false);
    const [isSavedCN, setIsSavedCN] = useState(false);

    const curriculum = activeLanguage === 'zh' ? curriculumCN : curriculumEN;
    const isSaved = activeLanguage === 'zh' ? isSavedCN : isSavedEN;
    const setIsSaved = activeLanguage === 'zh' ? setIsSavedCN : setIsSavedEN;

    const toggleLesson = (index: number) => {
        setExpandedLessons(prev => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });
    };

    if (!curriculum) return null;

    return (
        <div className="space-y-6 animate-fade-in-up">


            {/* Action buttons — unified row */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex bg-slate-100 rounded-xl p-1">
                    <button
                        onClick={() => setActiveLanguage('en')}
                        disabled={!curriculumEN}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeLanguage === 'en'
                            ? 'bg-white text-emerald-700 shadow-sm'
                            : curriculumEN
                                ? 'text-slate-500 hover:text-slate-700'
                                : 'text-slate-300 cursor-not-allowed'
                            }`}
                    >
                        🇬🇧 English
                    </button>
                    <button
                        onClick={() => setActiveLanguage('zh')}
                        disabled={!curriculumCN}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeLanguage === 'zh'
                            ? 'bg-white text-emerald-700 shadow-sm'
                            : curriculumCN
                                ? 'text-slate-500 hover:text-slate-700'
                                : 'text-slate-300 cursor-not-allowed'
                            }`}
                    >
                        🇨🇳 中文
                    </button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Batch generate */}
                    {onBatchGenerate && curriculum && (
                        batchRunning ? (
                            <>
                                <button
                                    onClick={onCancelBatch}
                                    className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl text-sm font-semibold hover:bg-red-100 transition-all"
                                >
                                    <Loader2 size={15} className="animate-spin" />
                                    {t('cp.batchStop')}
                                </button>
                                {batchProgress && (
                                    <span className="text-sm text-slate-500 font-medium">
                                        {batchProgress.done}/{batchProgress.total} {t('cp.batchProgress')}
                                        {batchProgress.errors > 0 && <span className="text-red-400 ml-1">({batchProgress.errors} errors)</span>}
                                    </span>
                                )}
                            </>
                        ) : (
                            <button
                                onClick={() => onBatchGenerate(curriculum.lessons, savedParams!, activeLanguage)}
                                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-sm font-semibold hover:from-emerald-600 hover:to-teal-600 shadow-sm transition-all"
                            >
                                <Sparkles size={15} />
                                {t('cp.batchGenerate')}
                            </button>
                        )
                    )}
                    {/* Save */}
                    {onSave && (
                        <button
                            onClick={() => {
                                onSave(curriculum, savedParams!, activeLanguage);
                                setIsSaved(true);
                            }}
                            disabled={isSaved}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${isSaved
                                ? 'bg-emerald-50 text-emerald-600 cursor-default border border-emerald-200'
                                : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                                }`}
                        >
                            {isSaved ? <><CheckIcon size={15} /> {t('cp.saved')}</> : <><Save size={15} /> {t('cp.save')}</>}
                        </button>
                    )}
                    {/* New */}
                    <button
                        onClick={onNew}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 hover:border-slate-300 transition-all"
                    >
                        <ArrowLeft size={15} />
                        {t('cp.new')}
                    </button>
                </div>
            </div>

            {/* Overview */}
            <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">{curriculum.theme}</h2>
                <p className="text-slate-600 leading-relaxed">{curriculum.overview}</p>
                <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-500">
                    <span className="px-3 py-1 bg-slate-100 rounded-lg flex items-center gap-1.5"><MapPin size={14} /> {savedParams?.city}</span>
                    <span className="px-3 py-1 bg-slate-100 rounded-lg flex items-center gap-1.5"><Users size={14} /> {savedParams?.ageGroup}</span>
                    <span className="px-3 py-1 bg-slate-100 rounded-lg flex items-center gap-1.5"><BookOpen size={14} /> {curriculum.lessons.length} {t('saved.lessons')}</span>
                </div>
            </div>

            {/* Lesson Cards — collapsible */}
            {curriculum.lessons.map((lesson, index) => {
                const isExpanded = expandedLessons.has(index);
                return (
                    <div
                        key={index}
                        className="rounded-xl border border-slate-100 overflow-hidden"
                    >
                        {/* Header — always visible, click to toggle */}
                        <div
                            className="p-5 cursor-pointer hover:bg-slate-50/50 transition-colors"
                            onClick={() => toggleLesson(index)}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <span className="text-xs font-bold text-white bg-emerald-600 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0">
                                        {String(index + 1).padStart(2, '0')}
                                    </span>
                                    <div className="min-w-0">
                                        <h3 className="text-lg font-bold text-slate-900 truncate">{lesson.title}</h3>
                                        {lesson.location && <p className="text-sm text-slate-500 truncate">{lesson.location}</p>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 ml-2">
                                    {isExpanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                                </div>
                            </div>
                            {!isExpanded && (
                                <p className="text-sm text-slate-500 mt-2 line-clamp-2">{lesson.description}</p>
                            )}
                        </div>

                        {/* Expanded content */}
                        {isExpanded && (
                            <div className="px-5 pb-5 space-y-4 border-t border-slate-100 pt-4">
                                <p className="text-slate-600 leading-relaxed">{lesson.description}</p>

                                {/* Detail Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
                                            <Sparkles size={12} /> {t('cp.steamFocus')}
                                        </span>
                                        <div className="font-medium text-slate-700 mt-1 space-y-1">
                                            {lesson.steam_focus.split(/(?=[STEAM]:)/).filter(Boolean).map((seg, i) => (
                                                <p key={i}>{seg.trim().replace(/\*\*/g, '')}</p>
                                            ))}
                                        </div>
                                    </div>
                                    {activeLanguage === 'en' && lesson.esl_focus && (
                                        <div>
                                            <span className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
                                                <GraduationCap size={12} /> {t('cp.eslFocus')}
                                            </span>
                                            <div className="font-medium text-slate-700 mt-1 space-y-1">
                                                {lesson.esl_focus.split(/(?<=\.)\s+/).filter(Boolean).map((seg, i) => (
                                                    <p key={i}>{seg.trim().replace(/\*\*/g, '')}</p>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    <div>
                                        <span className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
                                            <MapPin size={12} /> {t('cp.location')}
                                        </span>
                                        <p className="font-medium text-slate-700 mt-1">{lesson.location}</p>
                                    </div>
                                </div>

                                {/* Activities */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                                    <div className="flex items-start gap-2">
                                        <Trees size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <span className="text-xs font-bold text-slate-400 uppercase">{t('cp.outdoor')}</span>
                                            <div className="text-sm text-slate-600 mt-1 space-y-1.5">
                                                {lesson.outdoor_activity.split(/(?=\d+\.\s)/).filter(Boolean).map((step, i) => (
                                                    <p key={i}>{step.trim().replace(/\*\*/g, '')}</p>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <CloudRain size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <span className="text-xs font-bold text-slate-400 uppercase">{t('cp.indoor')}</span>
                                            <div className="text-sm text-slate-600 mt-1 space-y-1.5">
                                                {lesson.indoor_alternative.split(/(?=\d+\.\s)/).filter(Boolean).map((step, i) => (
                                                    <p key={i}>{step.trim().replace(/\*\*/g, '')}</p>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Vocab Tags — EN only */}
                                {activeLanguage === 'en' && lesson.english_vocabulary.length > 0 && (
                                    <div className="flex flex-wrap gap-2 pt-2">
                                        {lesson.english_vocabulary.map((word, i) => (
                                            <span key={i} className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-lg">
                                                {word}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Generate Kit / Status Button */}
                                {batchStatus[index] === 'generating' ? (
                                    <div className="w-full mt-2 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-xl py-3 font-semibold flex items-center justify-center gap-2">
                                        <Loader2 size={18} className="animate-spin" /> {t('cp.batchGenerating')}
                                    </div>
                                ) : batchStatus[index] === 'done' && batchLessonMap[index] ? (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onOpenPlan?.(batchLessonMap[index]); }}
                                        className="w-full mt-2 py-3 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
                                    >
                                        <CheckIcon size={18} />
                                        {t('cp.openKit')}
                                        <ArrowRight size={16} />
                                    </button>
                                ) : batchStatus[index] === 'error' ? (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onGenerateKit(lesson, savedParams!, activeLanguage); }}
                                        className="w-full mt-2 py-3 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
                                    >
                                        <FileText size={18} />
                                        {t('cp.retryKit')}
                                        <ArrowRight size={16} />
                                    </button>
                                ) : (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onGenerateKit(lesson, savedParams!, activeLanguage); }}
                                        className="w-full mt-2 py-3 bg-slate-50 text-slate-700 border border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
                                    >
                                        <FileText size={18} />
                                        {t('cp.genKit')}
                                        <ArrowRight size={16} />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
