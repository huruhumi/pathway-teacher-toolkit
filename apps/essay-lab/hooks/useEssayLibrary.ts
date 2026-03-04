import { useState, useMemo, useCallback, useEffect } from 'react';
import { GeneratedEssay, SavedEssayFromCorrection, EssayItem, EssayGenre, StudentGrade, CEFRLevel } from '../types';
import { generateModelEssay } from '../services/essayGeneratorService';
import { getRecords } from '../components/CorrectionRecords';
import localforage from 'localforage';

const ESSAYS_KEY = 'essay_lab_essays';

async function getStoredEssays(): Promise<GeneratedEssay[]> {
    try {
        const raw = await localforage.getItem<GeneratedEssay[]>(ESSAYS_KEY);
        return raw || [];
    } catch { return []; }
}

async function saveStoredEssays(essays: GeneratedEssay[]) {
    await localforage.setItem(ESSAYS_KEY, essays);
}

async function getCorrectionEssays(): Promise<SavedEssayFromCorrection[]> {
    const records = await getRecords();
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

export function useEssayLibrary() {
    const [storedEssays, setStoredEssays] = useState<GeneratedEssay[]>([]);
    const [correctionEssays, setCorrectionEssays] = useState<SavedEssayFromCorrection[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);

    const [showGenerator, setShowGenerator] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            const essays = await getStoredEssays();
            const corrections = await getCorrectionEssays();
            setStoredEssays(essays);
            setCorrectionEssays(corrections);
            setIsLoaded(true);
        };
        load();
    }, []);

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
        } catch {
            // silently fail
        } finally {
            setGenerating(false);
        }
    }, [storedEssays]);

    const handleDelete = async (id: string) => {
        const updated = storedEssays.filter(e => e.id !== id);
        await saveStoredEssays(updated);
        setStoredEssays(updated);
    };

    const handleToggleFavorite = async (id: string) => {
        const updated = storedEssays.map(e => e.id === id ? { ...e, favorite: !e.favorite } : e);
        await saveStoredEssays(updated);
        setStoredEssays(updated);
    };

    const handleCopy = async (content: string, id: string) => {
        await navigator.clipboard.writeText(content);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    return {
        // Data
        isLoaded, filtered, allEssays,
        // UI state
        showGenerator, setShowGenerator,
        generating, expandedId, setExpandedId,
        copiedId,
        // Filters
        filterSource, setFilterSource,
        filterGrade, setFilterGrade,
        filterCefr, setFilterCefr,
        filterGenre, setFilterGenre,
        searchQuery, setSearchQuery,
        // Generator form
        genTopic, setGenTopic,
        genGrade, setGenGrade,
        genCefr, setGenCefr,
        genGenre, setGenGenre,
        genWords, setGenWords,
        genError,
        // Handlers
        handleGenerate, handleRegenerate, handleDelete, handleToggleFavorite, handleCopy,
    };
}
