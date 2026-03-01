import React, { useState, useMemo, useCallback } from 'react';
import { GeneratedEssay, SavedEssayFromCorrection, EssayItem, EssayGenre, StudentGrade, CEFRLevel } from '../types';
import { generateModelEssay } from '../services/essayGeneratorService';
import { getRecords } from './CorrectionRecords';
import { useLanguage } from '../i18n/LanguageContext';
import {
    BookOpen, Sparkles, Star, StarOff, Trash2, Copy, Check, RefreshCw,
    School, Gauge, FileText, Filter, ChevronDown, ChevronUp, Lightbulb,
    BookMarked, Layers, PenTool, Search, Plus, X, Loader2
} from 'lucide-react';

const ESSAYS_KEY = 'essay_lab_essays';

function getStoredEssays(): GeneratedEssay[] {
    try {
        const raw = localStorage.getItem(ESSAYS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

function saveStoredEssays(essays: GeneratedEssay[]) {
    localStorage.setItem(ESSAYS_KEY, JSON.stringify(essays));
}

function getCorrectionEssays(): SavedEssayFromCorrection[] {
    const records = getRecords();
    return records
        .filter(r => r.report.goldenVersion)
        .map(r => ({
            id: `corr_${r.id}`,
            timestamp: r.timestamp,
            topic: r.topicText || r.report.topicText || 'Untitled',
            grade: r.grade,
            cefr: r.cefr,
            content: r.report.goldenVersion,
            wordCount: r.report.goldenVersion.split(/\s+/).length,
            source: 'correction' as const,
            favorite: false,
            recordId: r.id,
        }));
}

const genreKeys: Record<EssayGenre, string> = {
    [EssayGenre.NARRATIVE]: 'genre.narrative',
    [EssayGenre.ARGUMENTATIVE]: 'genre.argumentative',
    [EssayGenre.EXPOSITORY]: 'genre.expository',
    [EssayGenre.PRACTICAL]: 'genre.practical',
    [EssayGenre.PICTURE]: 'genre.picture',
};

const EssayLibrary: React.FC = () => {
    const { t } = useLanguage();
    const [storedEssays, setStoredEssays] = useState<GeneratedEssay[]>(getStoredEssays);
    const [showGenerator, setShowGenerator] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // Filters
    const [filterSource, setFilterSource] = useState<'all' | 'generated' | 'correction'>('all');
    const [filterGrade, setFilterGrade] = useState<string>('all');
    const [filterCefr, setFilterCefr] = useState<string>('all');
    const [filterGenre, setFilterGenre] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Generator form
    const [genTopic, setGenTopic] = useState('');
    const [genGrade, setGenGrade] = useState<StudentGrade>(StudentGrade.G7);
    const [genCefr, setGenCefr] = useState<CEFRLevel>(CEFRLevel.B1);
    const [genGenre, setGenGenre] = useState<EssayGenre>(EssayGenre.NARRATIVE);
    const [genWords, setGenWords] = useState(150);
    const [genError, setGenError] = useState<string | null>(null);

    const correctionEssays = useMemo(() => getCorrectionEssays(), [storedEssays]);

    const allEssays: EssayItem[] = useMemo(() => {
        const combined = [...storedEssays, ...correctionEssays];
        return combined.sort((a, b) => b.timestamp - a.timestamp);
    }, [storedEssays, correctionEssays]);

    const filtered = useMemo(() => {
        return allEssays.filter(e => {
            if (filterSource !== 'all' && e.source !== filterSource) return false;
            if (filterGrade !== 'all' && e.grade !== filterGrade) return false;
            if (filterCefr !== 'all' && e.cefr !== filterCefr) return false;
            if (filterGenre !== 'all' && e.source === 'generated' && (e as GeneratedEssay).genre !== filterGenre) return false;
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const topicMatch = e.topic.toLowerCase().includes(q);
                const contentMatch = e.content.toLowerCase().includes(q);
                if (!topicMatch && !contentMatch) return false;
            }
            return true;
        });
    }, [allEssays, filterSource, filterGrade, filterCefr, filterGenre, searchQuery]);

    const handleGenerate = useCallback(async () => {
        if (!genTopic.trim()) return;
        setGenerating(true);
        setGenError(null);
        try {
            const essay = await generateModelEssay(genTopic, genGrade, genCefr, genGenre, genWords);
            const updated = [essay, ...storedEssays];
            saveStoredEssays(updated);
            setStoredEssays(updated);
            setShowGenerator(false);
            setGenTopic('');
            setExpandedId(essay.id);
        } catch (err: any) {
            setGenError(err.message || 'Generation failed');
        } finally {
            setGenerating(false);
        }
    }, [genTopic, genGrade, genCefr, genGenre, genWords, storedEssays]);

    const handleRegenerate = useCallback(async (essay: GeneratedEssay) => {
        setGenerating(true);
        try {
            const newEssay = await generateModelEssay(essay.topic, essay.grade, essay.cefr, essay.genre, essay.targetWords);
            const updated = [newEssay, ...storedEssays];
            saveStoredEssays(updated);
            setStoredEssays(updated);
            setExpandedId(newEssay.id);
        } catch (err) {
            // silently fail
        } finally {
            setGenerating(false);
        }
    }, [storedEssays]);

    const handleDelete = (id: string) => {
        const updated = storedEssays.filter(e => e.id !== id);
        saveStoredEssays(updated);
        setStoredEssays(updated);
    };

    const handleToggleFavorite = (id: string) => {
        const updated = storedEssays.map(e => e.id === id ? { ...e, favorite: !e.favorite } : e);
        saveStoredEssays(updated);
        setStoredEssays(updated);
    };

    const handleCopy = async (content: string, id: string) => {
        await navigator.clipboard.writeText(content);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    return (
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                        <BookOpen className="w-5 h-5 text-indigo-600" />
                    </div>
                    {t('essays.title')}
                    <span className="text-sm font-normal text-slate-400 ml-1">({filtered.length})</span>
                </h2>
                <button
                    onClick={() => setShowGenerator(!showGenerator)}
                    className="btn btn-primary flex items-center gap-2 text-sm px-4 py-2"
                >
                    {showGenerator ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {showGenerator ? t('essays.collapse') : t('essays.generate')}
                </button>
            </div>

            {/* Generator Panel */}
            {showGenerator && (
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100 p-6 space-y-4">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-indigo-600" />
                        {t('essays.generate')}
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2 space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('essays.topic')}</label>
                            <input
                                type="text"
                                value={genTopic}
                                onChange={e => setGenTopic(e.target.value)}
                                placeholder={t('essays.topicPlaceholder')}
                                className="input-field w-full"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                <School className="w-3 h-3" /> {t('input.grade')}
                            </label>
                            <select value={genGrade} onChange={e => setGenGrade(e.target.value as StudentGrade)} className="input-field w-full">
                                {Object.values(StudentGrade).map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                <Gauge className="w-3 h-3" /> {t('input.cefr')}
                            </label>
                            <select value={genCefr} onChange={e => setGenCefr(e.target.value as CEFRLevel)} className="input-field w-full">
                                {Object.values(CEFRLevel).map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                <PenTool className="w-3 h-3" /> {t('essays.genre')}
                            </label>
                            <select value={genGenre} onChange={e => setGenGenre(e.target.value as EssayGenre)} className="input-field w-full">
                                {Object.values(EssayGenre).map(g => <option key={g} value={g}>{t(genreKeys[g] as any)}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                <FileText className="w-3 h-3" /> {t('essays.targetWords')}
                            </label>
                            <select value={genWords} onChange={e => setGenWords(Number(e.target.value))} className="input-field w-full">
                                {[80, 120, 150, 200, 250, 300].map(w => (
                                    <option key={w} value={w}>{w} {t('essays.words')}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {genError && (
                        <p className="text-sm text-rose-600 bg-rose-50 p-3 rounded-lg">{genError}</p>
                    )}

                    <button
                        onClick={handleGenerate}
                        disabled={generating || !genTopic.trim()}
                        className="btn btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {generating ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> {t('essays.generating')}</>
                        ) : (
                            <><Sparkles className="w-4 h-4" /> {t('essays.generate')}</>
                        )}
                    </button>
                </div>
            )}

            {/* Filters */}
            {allEssays.length > 0 && (
                <div className="flex flex-wrap gap-3 items-center">
                    <Filter className="w-4 h-4 text-slate-400" />
                    <select value={filterSource} onChange={e => setFilterSource(e.target.value as any)} className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-indigo-200 outline-none">
                        <option value="all">{t('records.filterAll')}</option>
                        <option value="generated">{t('essays.aiGenerated')}</option>
                        <option value="correction">{t('essays.fromCorrection')}</option>
                    </select>
                    <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-indigo-200 outline-none">
                        <option value="all">{t('records.filterAll')}</option>
                        {Object.values(StudentGrade).map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                    <select value={filterCefr} onChange={e => setFilterCefr(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-indigo-200 outline-none">
                        <option value="all">{t('records.filterAll')}</option>
                        {Object.values(CEFRLevel).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select value={filterGenre} onChange={e => setFilterGenre(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-indigo-200 outline-none">
                        <option value="all">{t('records.filterAll')}</option>
                        {Object.values(EssayGenre).map(g => <option key={g} value={g}>{t(genreKeys[g] as any)}</option>)}
                    </select>
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search..."
                            className="w-full text-sm border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 bg-white focus:ring-2 focus:ring-indigo-200 outline-none"
                        />
                    </div>
                </div>
            )}

            {/* Essay List */}
            {filtered.length === 0 ? (
                <div className="text-center py-20 space-y-4">
                    <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto">
                        <BookMarked className="w-8 h-8 text-slate-300" />
                    </div>
                    <p className="text-slate-400 max-w-sm mx-auto">{t('essays.empty')}</p>
                    {!showGenerator && (
                        <button onClick={() => setShowGenerator(true)} className="btn btn-primary text-sm px-4 py-2">
                            <Plus className="w-4 h-4 inline mr-1" />
                            {t('essays.generate')}
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid gap-4">
                    {filtered.map(essay => {
                        const isExpanded = expandedId === essay.id;
                        const isGenerated = essay.source === 'generated';
                        const gen = isGenerated ? essay as GeneratedEssay : null;

                        return (
                            <div key={essay.id} className={`bg-white rounded-xl border transition-all ${isExpanded ? 'border-indigo-300 shadow-lg' : 'border-slate-200 hover:shadow-md hover:border-indigo-200'}`}>
                                {/* Card Header */}
                                <div className="p-5">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : essay.id)}>
                                            <div className="flex flex-wrap items-center gap-2 mb-2">
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isGenerated ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>
                                                    {isGenerated ? t('essays.aiGenerated') : t('essays.fromCorrection')}
                                                </span>
                                                <span className="inline-flex items-center gap-1 text-xs font-medium bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md">
                                                    <School className="w-3 h-3" /> {essay.grade}
                                                </span>
                                                <span className="inline-flex items-center gap-1 text-xs font-medium bg-purple-50 text-purple-700 px-2 py-0.5 rounded-md">
                                                    <Gauge className="w-3 h-3" /> {essay.cefr}
                                                </span>
                                                {gen && (
                                                    <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md">
                                                        <PenTool className="w-3 h-3" /> {t(genreKeys[gen.genre] as any)}
                                                    </span>
                                                )}
                                                <span className="text-xs text-slate-400">
                                                    {essay.wordCount} {t('essays.words')} · {new Date(essay.timestamp).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <h3 className="text-base font-bold text-slate-800 mb-1">
                                                {gen?.title || essay.topic}
                                            </h3>
                                            {!isExpanded && (
                                                <p className="text-sm text-slate-500 line-clamp-2">{essay.content}</p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            {isGenerated && (
                                                <button
                                                    onClick={() => handleToggleFavorite(essay.id)}
                                                    className={`p-2 rounded-lg transition-colors ${(essay as GeneratedEssay).favorite ? 'text-amber-500 bg-amber-50' : 'text-slate-300 hover:text-amber-500 hover:bg-amber-50'}`}
                                                >
                                                    {(essay as GeneratedEssay).favorite ? <Star className="w-4 h-4 fill-current" /> : <StarOff className="w-4 h-4" />}
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleCopy(essay.content, essay.id)}
                                                className="p-2 rounded-lg text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                            >
                                                {copiedId === essay.id ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                                            </button>
                                            <button
                                                onClick={() => setExpandedId(isExpanded ? null : essay.id)}
                                                className="p-2 rounded-lg text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                            >
                                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Content */}
                                {isExpanded && (
                                    <div className="border-t border-slate-100 p-5 space-y-5">
                                        {/* Essay Content */}
                                        <div className="prose prose-sm max-w-none">
                                            <div className="bg-slate-50 rounded-xl p-5 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap font-serif">
                                                {essay.content}
                                            </div>
                                        </div>

                                        {/* Generated essay extras */}
                                        {gen && (
                                            <>
                                                {/* Highlights */}
                                                {gen.highlights.length > 0 && (
                                                    <div className="space-y-2">
                                                        <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                                            <Lightbulb className="w-4 h-4 text-amber-500" />
                                                            {t('essays.highlights')}
                                                        </h4>
                                                        <ul className="space-y-1">
                                                            {gen.highlights.map((h, i) => (
                                                                <li key={i} className="text-sm text-slate-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 italic">
                                                                    "{h}"
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}

                                                {/* Vocabulary */}
                                                {gen.vocabulary.length > 0 && (
                                                    <div className="space-y-2">
                                                        <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                                            <BookMarked className="w-4 h-4 text-indigo-500" />
                                                            {t('essays.vocabulary')}
                                                        </h4>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                            {gen.vocabulary.map((v, i) => (
                                                                <div key={i} className="bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
                                                                    <span className="font-bold text-indigo-700 text-sm">{v.word}</span>
                                                                    <span className="text-slate-500 text-sm ml-2">— {v.meaning}</span>
                                                                    <p className="text-xs text-slate-400 mt-1 italic">{v.example}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Structure */}
                                                <div className="space-y-2">
                                                    <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                                        <Layers className="w-4 h-4 text-purple-500" />
                                                        {t('essays.structure')}
                                                    </h4>
                                                    <p className="text-sm text-slate-600 bg-purple-50 border border-purple-100 rounded-lg px-3 py-2">{gen.structure}</p>
                                                </div>

                                                {/* Teacher Tip */}
                                                <div className="space-y-2">
                                                    <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                                        <Lightbulb className="w-4 h-4 text-emerald-500" />
                                                        {t('essays.teacherTip')}
                                                    </h4>
                                                    <p className="text-sm text-slate-600 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">{gen.teacherTip}</p>
                                                </div>
                                            </>
                                        )}

                                        {/* Actions */}
                                        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                                            <button
                                                onClick={() => handleCopy(essay.content, essay.id)}
                                                className="text-sm text-slate-500 hover:text-indigo-600 flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
                                            >
                                                {copiedId === essay.id ? <><Check className="w-3 h-3" /> {t('essays.copied')}</> : <><Copy className="w-3 h-3" /> {t('essays.copy')}</>}
                                            </button>
                                            {gen && (
                                                <button
                                                    onClick={() => handleRegenerate(gen)}
                                                    disabled={generating}
                                                    className="text-sm text-slate-500 hover:text-purple-600 flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-purple-50 transition-colors disabled:opacity-50"
                                                >
                                                    <RefreshCw className={`w-3 h-3 ${generating ? 'animate-spin' : ''}`} /> {t('essays.regenerate')}
                                                </button>
                                            )}
                                            {isGenerated && (
                                                <button
                                                    onClick={() => handleDelete(essay.id)}
                                                    className="text-sm text-slate-500 hover:text-rose-600 flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-rose-50 transition-colors ml-auto"
                                                >
                                                    <Trash2 className="w-3 h-3" /> {t('essays.delete')}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default EssayLibrary;
