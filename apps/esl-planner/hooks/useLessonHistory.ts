import { useState, useEffect, useMemo } from 'react';
import { GeneratedContent, SavedLesson, SavedCurriculum, ESLCurriculum, CurriculumParams } from '../types';
import { safeStorage } from '@shared/safeStorage';
import { isToday, isThisWeek, isThisMonth } from '../utils/dateHelpers';

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

    // Load saved data on mount
    useEffect(() => {
        setSavedLessons(safeStorage.get('esl_smart_planner_history', []));
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

    const handleSaveLesson = (content: GeneratedContent) => {
        let updatedHistory = [...savedLessons];
        if (activeLessonId) {
            updatedHistory = updatedHistory.map(lesson => {
                if (lesson.id === activeLessonId) {
                    return { ...lesson, lastModified: Date.now(), topic: content.structuredLessonPlan.classInformation.topic || lesson.topic, level: content.structuredLessonPlan.classInformation.level, content };
                }
                return lesson;
            });
        } else {
            const id = Date.now().toString();
            const newRecord: SavedLesson = { id, timestamp: Date.now(), lastModified: Date.now(), topic: content.structuredLessonPlan.classInformation.topic || 'Untitled Lesson', level: content.structuredLessonPlan.classInformation.level, content };
            updatedHistory = [newRecord, ...updatedHistory];
            setActiveLessonId(id);
        }
        setSavedLessons(updatedHistory);
        safeStorage.set('esl_smart_planner_history', updatedHistory);
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
