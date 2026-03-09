
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { CorrectionReport, Grade, GrammarError } from '../types';
import { generateAdditionalItem } from '../services/geminiService';
import { useToast } from '@shared/stores/useToast';
import { useLanguage } from '../i18n/LanguageContext';
import {
  ReportHeader,
  TranscriptSection,
  GradeSection,
  DetailedAnalysis,
  EnhancementSection,
  WordBankSection,
  QuizSection,
  TeacherNoteSection,
  ReportActions,
} from './report';
import type { ReportState, ReportActions as ReportActionsType } from './report/types';

interface ReportDisplayProps {
  report: CorrectionReport;
  onReset: () => void;
  readOnly?: boolean;
  onTogglePreview?: (show: boolean) => void;
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const ReportDisplay: React.FC<ReportDisplayProps> = ({
  report: initialReport,
  onReset,
  readOnly = false,
  onTogglePreview
}) => {
  const { t, lang } = useLanguage();
  const [editableReport, setEditableReport] = useState<CorrectionReport>(initialReport);
  const [generating, setGenerating] = useState<string | null>(null);
  const [showGolden, setShowGolden] = useState(false);
  const [showHighlights, setShowHighlights] = useState(true);
  const [quizState, setQuizState] = useState<{ [key: number]: string | null }>({});
  const [quizResult, setQuizResult] = useState<{ [key: number]: boolean }>({});

  const updateField = useCallback((field: keyof CorrectionReport, value: any) => {
    if (readOnly) return;
    setEditableReport(prev => ({ ...prev, [field]: value }));
  }, [readOnly]);

  const updateNestedField = useCallback((parent: string, field: string, value: any) => {
    if (readOnly) return;
    setEditableReport(prev => ({
      ...prev,
      [parent]: { ...(prev as Record<string, unknown>)[parent] as Record<string, unknown>, [field]: value }
    }));
  }, [readOnly]);

  const updateArrayItem = useCallback((field: keyof CorrectionReport, index: number, itemUpdate: any) => {
    if (readOnly) return;
    setEditableReport(prev => {
      const arr = [...(prev[field] as any[])];
      arr[index] = { ...arr[index], ...itemUpdate };
      return { ...prev, [field]: arr };
    });
  }, [readOnly]);

  const addArrayItem = useCallback((field: keyof CorrectionReport, newItem: any) => {
    if (readOnly) return;
    setEditableReport(prev => ({ ...prev, [field]: [...(prev[field] as any[]), newItem] }));
  }, [readOnly]);

  const removeArrayItem = useCallback((field: keyof CorrectionReport, index: number) => {
    if (readOnly) return;
    setEditableReport(prev => {
      const arr = [...(prev[field] as any[])];
      arr.splice(index, 1);
      return { ...prev, [field]: arr };
    });
  }, [readOnly]);

  const handleAIAdd = async (type: any) => {
    if (readOnly) return;
    setGenerating(type);
    try {
      const newItem = await generateAdditionalItem(
        type,
        editableReport.originalText,
        editableReport.topicText || "",
        editableReport[type as keyof CorrectionReport] as any[]
      );
      addArrayItem(type, newItem);
    } catch (e: unknown) {
      console.error(e);
      useToast.getState().error(t('report.aiFailed'));
    } finally {
      setGenerating(null);
    }
  };

  const handleOpenPreview = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (onTogglePreview) onTogglePreview(true);
  }, [onTogglePreview]);

  const handleClosePreview = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (onTogglePreview) onTogglePreview(false);
  }, [onTogglePreview]);

  const handleQuizAnswer = useCallback((index: number, option: string) => {
    setQuizState(prev => ({ ...prev, [index]: option }));
    setEditableReport(currentReport => {
      const isCorrect = option === currentReport.errorQuiz[index].correctAnswer;
      setQuizResult(prev => ({ ...prev, [index]: isCorrect }));
      return currentReport;
    });
  }, []);

  const isGrammarResolved = editableReport.grammarErrors.length === 0;

  useEffect(() => {
    if (readOnly) {
      document.title = `ESL_Master_Report_${new Date().toLocaleDateString()}`;
    } else {
      document.title = t('report.docTitle');
    }
  }, [readOnly]);

  // Calculate ordered error matches for sequential highlighting
  const orderedMatches = useMemo(() => {
    if (!editableReport.originalText || !editableReport.grammarErrors.length) return [];

    const text = editableReport.originalText;
    const errors = editableReport.grammarErrors.filter(e => e.original);
    let allMatches: { start: number, end: number, text: string, error: GrammarError }[] = [];
    const sortedErrors = [...errors].sort((a, b) => b.original.length - a.original.length);

    sortedErrors.forEach(err => {
      const regex = new RegExp(escapeRegExp(err.original), 'g');
      let match;
      while ((match = regex.exec(text)) !== null) {
        allMatches.push({ start: match.index, end: match.index + match[0].length, text: match[0], error: err });
      }
    });

    allMatches.sort((a, b) => a.start - b.start);

    const validMatches: { id: number; start: number; end: number; text: string; error: GrammarError }[] = [];
    let lastEnd = 0;
    let idCounter = 1;

    allMatches.forEach(m => {
      if (m.start >= lastEnd) {
        validMatches.push({ ...m, id: idCounter++ });
        lastEnd = m.end;
      }
    });

    return validMatches;
  }, [editableReport.originalText, editableReport.grammarErrors]);

  const renderParagraphs = (text: string, enableHighlights: boolean = false, isLined: boolean = false) => {
    const paragraphs = text.split('\n');
    let globalIndex = 0;
    const pClass = isLined
      ? "indent-12 text-justify text-slate-700 dark:text-slate-400 tracking-wide mb-0"
      : "mb-4 indent-8 leading-relaxed text-justify text-slate-700 dark:text-slate-400";

    if (!enableHighlights || showGolden) {
      return paragraphs.map((p, idx) => {
        if (p.trim() === '') { globalIndex += 1; return null; }
        const el = <p key={idx} className={pClass}>{p}</p>;
        globalIndex += p.length + 1;
        return el;
      }).filter(Boolean);
    }

    return paragraphs.map((p, idx) => {
      if (p.trim() === '') { globalIndex += 1; return null; }
      const pStart = globalIndex;
      const pEnd = globalIndex + p.length;
      const relevantMatches = orderedMatches.filter(m => m.start >= pStart && m.end <= pEnd);
      const elements: React.ReactNode[] = [];
      let currentIndex = pStart;

      relevantMatches.forEach((match, mIdx) => {
        if (match.start > currentIndex) {
          elements.push(<span key={`text-${mIdx}`}>{text.slice(currentIndex, match.start)}</span>);
        }
        elements.push(
          <span key={`match-${match.id}`} className="relative inline bg-rose-100/80 decoration-rose-400 decoration-wavy underline text-slate-900 dark:text-slate-200 rounded-sm mx-0.5 px-0.5 box-decoration-clone" id={`error-highlight-${match.id}`}>
            <span className="absolute -top-3 -left-2 w-5 h-5 bg-indigo-600 text-white text-[10px] font-black flex items-center justify-center rounded-full shadow-sm z-10 border-2 border-white select-none whitespace-nowrap">{match.id}</span>
            {match.text}
          </span>
        );
        currentIndex = match.end;
      });

      if (currentIndex < pEnd) {
        elements.push(<span key="text-end">{text.slice(currentIndex, pEnd)}</span>);
      }
      globalIndex += p.length + 1;
      return <p key={idx} className={pClass}>{elements}</p>;
    }).filter(Boolean);
  };

  const renderWithHighlights = (text: string, colorClass: string) => {
    const parts = text.split('*');
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        return <span key={index} className={`font-bold ${colorClass} bg-white dark:bg-slate-900/80/60 px-1 rounded mx-0.5 box-decoration-clone`}>{part}</span>;
      }
      return part;
    });
  };

  // Build state & actions objects for sub-components
  const state: ReportState = {
    editableReport, generating, showGolden, showHighlights,
    quizState, quizResult, readOnly, orderedMatches, isGrammarResolved,
  };

  const actions: ReportActionsType = {
    updateField, updateNestedField, updateArrayItem, addArrayItem, removeArrayItem,
    handleAIAdd, setShowGolden, setShowHighlights, setQuizState, setQuizResult,
    handleOpenPreview, handleClosePreview, handleQuizAnswer,
    renderParagraphs, renderWithHighlights, onReset,
  };

  return (
    <div className={`space-y-8 pb-12 print:pb-0 print:space-y-6 print:w-full ${readOnly ? 'animate-in fade-in duration-500' : ''}`}>
      <ReportHeader state={state} actions={actions} t={t} lang={lang} />
      <TranscriptSection state={state} actions={actions} t={t} lang={lang} />
      <GradeSection state={state} actions={actions} t={t} lang={lang} />
      <DetailedAnalysis state={state} actions={actions} t={t} lang={lang} />
      <EnhancementSection state={state} actions={actions} t={t} lang={lang} />
      <WordBankSection state={state} actions={actions} t={t} lang={lang} />
      <QuizSection state={state} actions={actions} t={t} lang={lang} />
      <TeacherNoteSection state={state} actions={actions} t={t} lang={lang} />
      <ReportActions state={state} actions={actions} t={t} lang={lang} />
    </div>
  );
};

export default ReportDisplay;
