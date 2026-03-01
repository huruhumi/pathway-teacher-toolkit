import { useState, useEffect, useMemo } from 'react';
import { GeneratedContent, SavedLesson, SavedCurriculum, ESLCurriculum, CurriculumParams } from '../types';
import { safeStorage } from '@shared/safeStorage';
import { imageStore } from '@shared/imageStore';
import { isToday, isThisWeek, isThisMonth } from '../utils/dateHelpers';

/** Check if a string looks like a base64 data URI (not an IndexedDB key reference) */
const isBase64 = (s?: string) => s?.startsWith('data:');

/** Extract all base64 images from GeneratedContent, store in IndexedDB, return content with key refs */
async function stripImages(lessonId: string, content: GeneratedContent): Promise<GeneratedContent> {
    const entries: Array<{ key: string; data: string }> = [];
    const stripped = { ...content };

    // flashcardImages
    if (stripped.flashcardImages) {
        const refs: Record<number, string> = {};
        for (const [idx, data] of Object.entries(stripped.flashcardImages)) {
            if (isBase64(data)) {
                const key = `esl-${lessonId}-fc-${idx}`;
                entries.push({ key, data });
                refs[Number(idx)] = key;
            } else {
                refs[Number(idx)] = data; // already a ref
            }
        }
        stripped.flashcardImages = refs;
    }

    // decodableTextImages
    if (stripped.decodableTextImages) {
        const refs: Record<number, string> = {};
        for (const [idx, data] of Object.entries(stripped.decodableTextImages)) {
            if (isBase64(data)) {
                const key = `esl-${lessonId}-dt-${idx}`;
                entries.push({ key, data });
                refs[Number(idx)] = key;
            } else {
                refs[Number(idx)] = data;
            }
        }
        stripped.decodableTextImages = refs;
    }

    // grammarInfographicUrl
    if (isBase64(stripped.grammarInfographicUrl)) {
        const key = `esl-${lessonId}-grammar`;
        entries.push({ key, data: stripped.grammarInfographicUrl! });
        stripped.grammarInfographicUrl = key;
    }

    // blackboardImageUrl
    if (isBase64(stripped.blackboardImageUrl)) {
        const key = `esl-${lessonId}-blackboard`;
        entries.push({ key, data: stripped.blackboardImageUrl! });
        stripped.blackboardImageUrl = key;
    }

    // worksheet item imageUrls
    if (stripped.worksheets) {
        stripped.worksheets = stripped.worksheets.map((ws, wi) => ({
            ...ws,
            sections: ws.sections?.map((sec, si) => ({
                ...sec,
                items: sec.items.map((item, ii) => {
                    if (isBase64(item.imageUrl)) {
                        const key = `esl-${lessonId}-ws-${wi}-${si}-${ii}`;
                        entries.push({ key, data: item.imageUrl! });
                        return { ...item, imageUrl: key };
                    }
                    return item;
                })
            })),
            items: ws.items?.map((item, ii) => {
                if (isBase64(item.imageUrl)) {
                    const key = `esl-${lessonId}-wsi-${wi}-${ii}`;
                    entries.push({ key, data: item.imageUrl! });
                    return { ...item, imageUrl: key };
                }
                return item;
            })
        }));
    }

    if (entries.length > 0) await imageStore.saveBatch(entries);
    return stripped;
}

/** Hydrate IndexedDB key references back to base64 data in a SavedLesson's content */
async function hydrateImages(lesson: SavedLesson): Promise<SavedLesson> {
    const c = { ...lesson.content };
    const keys: string[] = [];

    // Collect all non-base64 refs
    if (c.flashcardImages) Object.values(c.flashcardImages).forEach(v => { if (!isBase64(v)) keys.push(v); });
    if (c.decodableTextImages) Object.values(c.decodableTextImages).forEach(v => { if (!isBase64(v)) keys.push(v); });
    if (c.grammarInfographicUrl && !isBase64(c.grammarInfographicUrl)) keys.push(c.grammarInfographicUrl);
    if (c.blackboardImageUrl && !isBase64(c.blackboardImageUrl)) keys.push(c.blackboardImageUrl);
    c.worksheets?.forEach(ws => {
        ws.sections?.forEach(sec => sec.items.forEach(item => { if (item.imageUrl && !isBase64(item.imageUrl)) keys.push(item.imageUrl); }));
        ws.items?.forEach(item => { if (item.imageUrl && !isBase64(item.imageUrl)) keys.push(item.imageUrl); });
    });

    if (keys.length === 0) return lesson;

    const images = await imageStore.getBatch(keys);
    const resolve = (ref?: string) => (ref && images[ref]) || ref;

    // Hydrate
    if (c.flashcardImages) {
        const h: Record<number, string> = {};
        for (const [idx, ref] of Object.entries(c.flashcardImages)) h[Number(idx)] = resolve(ref) || ref;
        c.flashcardImages = h;
    }
    if (c.decodableTextImages) {
        const h: Record<number, string> = {};
        for (const [idx, ref] of Object.entries(c.decodableTextImages)) h[Number(idx)] = resolve(ref) || ref;
        c.decodableTextImages = h;
    }
    c.grammarInfographicUrl = resolve(c.grammarInfographicUrl);
    c.blackboardImageUrl = resolve(c.blackboardImageUrl);
    if (c.worksheets) {
        c.worksheets = c.worksheets.map(ws => ({
            ...ws,
            sections: ws.sections?.map(sec => ({
                ...sec,
                items: sec.items.map(item => ({ ...item, imageUrl: resolve(item.imageUrl) }))
            })),
            items: ws.items?.map(item => ({ ...item, imageUrl: resolve(item.imageUrl) }))
        }));
    }

    return { ...lesson, content: c };
}

export function useLessonHistory() {
    const [savedLessons, setSavedLessons] = useState<SavedLesson[]>([]);
    const [savedCurricula, setSavedCurricula] = useState<SavedCurriculum[]>([]);
    const [activeLessonId, setActiveLessonId] = useState<string | null>(null);

    // Title editing state
    const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');

    // --- Curricula filter state ---
    const [curSearch, setCurSearch] = useState('');
    const [curLevel, setCurLevel] = useState('All Levels');
    const [curDate, setCurDate] = useState('all');
    const [curSort, setCurSort] = useState('newest');
    const [curLessonRange, setCurLessonRange] = useState('all');

    // --- Kits filter state ---
    const [kitSearch, setKitSearch] = useState('');
    const [kitLevel, setKitLevel] = useState('All Levels');
    const [kitDate, setKitDate] = useState('all');
    const [kitSort, setKitSort] = useState('newest');

    // Records sub-tab
    const [recordsTab, setRecordsTab] = useState<'curricula' | 'kits'>('curricula');

    // Load saved data on mount + hydrate images from IndexedDB
    useEffect(() => {
        const raw: SavedLesson[] = safeStorage.get('esl_smart_planner_history', []);
        setSavedLessons(raw);
        // Hydrate images async
        raw.forEach(lesson => {
            hydrateImages(lesson).then(hydrated => {
                setSavedLessons(prev => prev.map(l => l.id === hydrated.id ? hydrated : l));
            });
        });
        setSavedCurricula(safeStorage.get('esl_planner_curricula', []));
    }, []);

    // --- Filtered Curricula ---
    const filteredCurricula = useMemo(() => {
        let result = [...savedCurricula];
        if (curSearch.trim()) {
            const q = curSearch.toLowerCase();
            result = result.filter(c => c.textbookTitle.toLowerCase().includes(q) || c.targetLevel.toLowerCase().includes(q));
        }
        if (curLevel !== 'All Levels') result = result.filter(c => c.targetLevel === curLevel);
        if (curDate === 'today') result = result.filter(c => isToday(c.timestamp));
        else if (curDate === 'week') result = result.filter(c => isThisWeek(c.timestamp));
        else if (curDate === 'month') result = result.filter(c => isThisMonth(c.timestamp));
        if (curLessonRange !== 'all') {
            result = result.filter(c => {
                const n = c.totalLessons;
                if (curLessonRange === '1-10') return n >= 1 && n <= 10;
                if (curLessonRange === '11-20') return n >= 11 && n <= 20;
                if (curLessonRange === '21-40') return n >= 21 && n <= 40;
                if (curLessonRange === '40+') return n > 40;
                return true;
            });
        }
        result.sort((a, b) => {
            if (curSort === 'newest') return b.timestamp - a.timestamp;
            if (curSort === 'oldest') return a.timestamp - b.timestamp;
            if (curSort === 'az') return a.textbookTitle.localeCompare(b.textbookTitle);
            if (curSort === 'za') return b.textbookTitle.localeCompare(a.textbookTitle);
            return 0;
        });
        return result;
    }, [savedCurricula, curSearch, curLevel, curDate, curSort, curLessonRange]);

    // --- Filtered Kits ---
    const filteredKits = useMemo(() => {
        let result = [...savedLessons];
        if (kitSearch.trim()) {
            const q = kitSearch.toLowerCase();
            result = result.filter(l => l.topic.toLowerCase().includes(q));
        }
        if (kitLevel !== 'All Levels') result = result.filter(l => l.level === kitLevel);
        if (kitDate === 'today') result = result.filter(l => isToday(l.timestamp));
        else if (kitDate === 'week') result = result.filter(l => isThisWeek(l.timestamp));
        else if (kitDate === 'month') result = result.filter(l => isThisMonth(l.timestamp));
        result.sort((a, b) => {
            if (kitSort === 'newest') return b.timestamp - a.timestamp;
            if (kitSort === 'oldest') return a.timestamp - b.timestamp;
            if (kitSort === 'az') return a.topic.localeCompare(b.topic);
            if (kitSort === 'za') return b.topic.localeCompare(a.topic);
            return 0;
        });
        return result;
    }, [savedLessons, kitSearch, kitLevel, kitDate, kitSort]);

    // --- CRUD handlers ---

    const handleSaveLesson = async (content: GeneratedContent) => {
        const lessonId = activeLessonId || Date.now().toString();
        // Strip images to IndexedDB before saving to localStorage
        const strippedContent = await stripImages(lessonId, content);

        let updatedHistory = [...savedLessons];
        if (activeLessonId) {
            updatedHistory = updatedHistory.map(lesson => {
                if (lesson.id === activeLessonId) {
                    return { ...lesson, lastModified: Date.now(), topic: content.structuredLessonPlan.classInformation.topic || lesson.topic, level: content.structuredLessonPlan.classInformation.level, content: strippedContent };
                }
                return lesson;
            });
        } else {
            const newRecord: SavedLesson = { id: lessonId, timestamp: Date.now(), lastModified: Date.now(), topic: content.structuredLessonPlan.classInformation.topic || 'Untitled Lesson', level: content.structuredLessonPlan.classInformation.level, content: strippedContent };
            updatedHistory = [newRecord, ...updatedHistory];
            setActiveLessonId(lessonId);
        }
        // In-memory keeps full base64 for display
        setSavedLessons(updatedHistory.map(l =>
            l.id === lessonId ? { ...l, content } : l
        ));
        // localStorage gets stripped refs
        safeStorage.setWithLimit('esl_smart_planner_history', updatedHistory, 50);
    };

    const handleSaveCurriculum = (curriculum: ESLCurriculum, params: CurriculumParams) => {
        const exists = savedCurricula.find(c => c.textbookTitle === curriculum.textbookTitle && c.totalLessons === curriculum.totalLessons);
        let updated: SavedCurriculum[];
        if (exists) {
            updated = savedCurricula.map(c => c.id === exists.id ? { ...c, lastModified: Date.now(), curriculum, params } : c);
        } else {
            const newRecord: SavedCurriculum = {
                id: Date.now().toString(),
                timestamp: Date.now(),
                lastModified: Date.now(),
                textbookTitle: curriculum.textbookTitle,
                targetLevel: curriculum.targetLevel,
                totalLessons: curriculum.totalLessons,
                curriculum,
                params,
            };
            updated = [newRecord, ...savedCurricula];
        }
        setSavedCurricula(updated);
        safeStorage.set('esl_planner_curricula', updated);
    };

    const handleDeleteCurriculum = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const updated = savedCurricula.filter(c => c.id !== id);
        setSavedCurricula(updated);
        safeStorage.set('esl_planner_curricula', updated);
    };

    const handleDeleteRecord = (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const updated = savedLessons.filter(l => l.id !== id);
        if (activeLessonId === id) setActiveLessonId(null);
        setSavedLessons(updated);
        safeStorage.set('esl_smart_planner_history', updated);
        // Clean up IndexedDB images
        imageStore.removeByPrefix(`esl-${id}-`);
    };

    const startEditing = (lesson: SavedLesson, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingLessonId(lesson.id);
        setEditTitle(lesson.topic);
    };

    const saveTitle = (id: string, e?: React.MouseEvent | React.KeyboardEvent) => {
        if (e) e.stopPropagation();
        if (!editTitle.trim()) return;
        const updated = savedLessons.map(l => {
            if (l.id === id) {
                return { ...l, topic: editTitle, lastModified: Date.now(), content: { ...l.content, structuredLessonPlan: { ...l.content.structuredLessonPlan, classInformation: { ...l.content.structuredLessonPlan.classInformation, topic: editTitle } } } };
            }
            return l;
        });
        setSavedLessons(updated);
        safeStorage.set('esl_smart_planner_history', updated);
        setEditingLessonId(null);
    };

    const cancelEditing = (e: React.MouseEvent) => { e.stopPropagation(); setEditingLessonId(null); };

    return {
        // Data
        savedLessons, setSavedLessons,
        savedCurricula,
        activeLessonId, setActiveLessonId,
        filteredCurricula,
        filteredKits,

        // Filter state — curricula
        curSearch, setCurSearch,
        curLevel, setCurLevel,
        curDate, setCurDate,
        curSort, setCurSort,
        curLessonRange, setCurLessonRange,

        // Filter state — kits
        kitSearch, setKitSearch,
        kitLevel, setKitLevel,
        kitDate, setKitDate,
        kitSort, setKitSort,

        // Records sub-tab
        recordsTab, setRecordsTab,

        // Title editing
        editingLessonId, editTitle, setEditTitle,
        startEditing, saveTitle, cancelEditing,

        // CRUD
        handleSaveLesson,
        handleSaveCurriculum,
        handleDeleteCurriculum,
        handleDeleteRecord,
    };
}
