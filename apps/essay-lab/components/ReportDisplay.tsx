
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { CorrectionReport, Grade, GradeItem, GrammarError, IdiomSuggestion, VocabularyUpgrade, WordBankItem, TopicExtension } from '../types';
import GradeBadge from './GradeBadge';
import { generateAdditionalItem } from '../services/geminiService';
import { useLanguage } from '../i18n/LanguageContext';
import { Printer, GraduationCap, FileText, Eye, EyeOff, RotateCcw, Sparkles, Quote, Check, ArrowDown, Info, Tag, CheckCircle2, BarChart3, PieChart, Lightbulb, Stethoscope, PenLine, ArrowRight, TrendingUp, BookMarked, MessageSquare, Pencil, Heart, Pen, ChevronLeft, FileCheck, CheckCheck, Loader2, Plus, X } from 'lucide-react';

interface ReportDisplayProps {
  report: CorrectionReport;
  onReset: () => void;
  readOnly?: boolean;
  onTogglePreview?: (show: boolean) => void;
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Interface for a specific occurrence of an error in the text
interface ErrorMatch {
  id: number; // Sequential ID (1, 2, 3...)
  start: number;
  end: number;
  text: string;
  error: GrammarError;
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

  const updateField = (field: keyof CorrectionReport, value: any) => {
    if (readOnly) return;
    setEditableReport(prev => ({ ...prev, [field]: value }));
  };

  const updateNestedField = (parent: string, field: string, value: any) => {
    if (readOnly) return;
    setEditableReport(prev => ({
      ...prev,
      [parent]: { ...(prev as any)[parent], [field]: value }
    }));
  };

  const updateArrayItem = (field: keyof CorrectionReport, index: number, itemUpdate: any) => {
    if (readOnly) return;
    const arr = [...(editableReport[field] as any[])];
    arr[index] = { ...arr[index], ...itemUpdate };
    updateField(field, arr);
  };

  const addArrayItem = (field: keyof CorrectionReport, newItem: any) => {
    if (readOnly) return;
    updateField(field, [...(editableReport[field] as any[]), newItem]);
  };

  const removeArrayItem = (field: keyof CorrectionReport, index: number) => {
    if (readOnly) return;
    const arr = [...(editableReport[field] as any[])];
    arr.splice(index, 1);
    updateField(field, arr);
  };

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
    } catch (e) {
      console.error(e);
      alert(t('report.aiFailed'));
    } finally {
      setGenerating(null);
    }
  };

  const handleOpenPreview = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (onTogglePreview) {
      onTogglePreview(true);
    }
  }, [onTogglePreview]);

  const handleClosePreview = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (onTogglePreview) {
      onTogglePreview(false);
    }
  }, [onTogglePreview]);

  const handleQuizAnswer = (index: number, option: string) => {
    setQuizState(prev => ({ ...prev, [index]: option }));
    const isCorrect = option === editableReport.errorQuiz[index].correctAnswer;
    setQuizResult(prev => ({ ...prev, [index]: isCorrect }));
  };

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

    // Find all occurrences of all errors
    let allMatches: { start: number, end: number, text: string, error: GrammarError }[] = [];

    // Sort errors by length (descending) to prioritize longest matches
    const sortedErrors = [...errors].sort((a, b) => b.original.length - a.original.length);

    // We use a simple strategy: find all matches, then filter overlaps
    sortedErrors.forEach(err => {
      const regex = new RegExp(escapeRegExp(err.original), 'g');
      let match;
      while ((match = regex.exec(text)) !== null) {
        allMatches.push({
          start: match.index,
          end: match.index + match[0].length,
          text: match[0],
          error: err
        });
      }
    });

    // Sort matches by start index
    allMatches.sort((a, b) => a.start - b.start);

    // Filter overlapping matches (greedy: keep first/longest)
    const validMatches: ErrorMatch[] = [];
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
    // Split into paragraphs but keep track of global index
    const paragraphs = text.split('\n');
    let globalIndex = 0;

    const pClass = isLined
      ? "indent-12 text-justify text-slate-700 tracking-wide mb-0"
      : "mb-4 indent-8 leading-relaxed text-justify text-slate-700";

    // If highlights are disabled or showing Golden Version
    if (!enableHighlights || showGolden) {
      return paragraphs.map((p, idx) => {
        if (p.trim() === '') {
          globalIndex += 1; // newline char
          return null;
        }
        const el = <p key={idx} className={pClass}>{p}</p>;
        globalIndex += p.length + 1; // +1 for newline
        return el;
      }).filter(Boolean);
    }

    return paragraphs.map((p, idx) => {
      if (p.trim() === '') {
        globalIndex += 1;
        return null;
      }

      const pStart = globalIndex;
      const pEnd = globalIndex + p.length;

      // Find matches relevant to this paragraph
      const relevantMatches = orderedMatches.filter(m =>
        m.start >= pStart && m.end <= pEnd
      );

      // Slice paragraph string
      const elements: React.ReactNode[] = [];
      let currentIndex = pStart;

      relevantMatches.forEach((match, mIdx) => {
        // Text before match
        if (match.start > currentIndex) {
          elements.push(
            <span key={`text-${mIdx}`}>
              {text.slice(currentIndex, match.start)}
            </span>
          );
        }

        // The Match
        elements.push(
          <span
            key={`match-${match.id}`}
            // Changed from inline-block to inline to prevent wrapping issues
            // Added box-decoration-clone to ensure proper styling across lines
            className="relative inline bg-rose-100/80 decoration-rose-400 decoration-wavy underline text-slate-900 rounded-sm mx-0.5 px-0.5 box-decoration-clone"
            id={`error-highlight-${match.id}`}
          >
            {/* Number Badge */}
            <span className="absolute -top-3 -left-2 w-5 h-5 bg-indigo-600 text-white text-[10px] font-black flex items-center justify-center rounded-full shadow-sm z-10 border-2 border-white select-none whitespace-nowrap">
              {match.id}
            </span>
            {match.text}
          </span>
        );

        currentIndex = match.end;
      });

      // Remaining text
      if (currentIndex < pEnd) {
        elements.push(
          <span key="text-end">
            {text.slice(currentIndex, pEnd)}
          </span>
        );
      }

      globalIndex += p.length + 1;

      return (
        <p key={idx} className={pClass}>
          {elements}
        </p>
      );
    }).filter(Boolean);
  };

  const renderWithHighlights = (text: string, colorClass: string) => {
    const parts = text.split('*');
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        return <span key={index} className={`font-bold ${colorClass} bg-white/60 px-1 rounded mx-0.5 box-decoration-clone`}>{part}</span>;
      }
      return part;
    });
  };

  return (
    <div className={`space-y-8 pb-12 print:pb-0 print:space-y-6 print:w-full ${readOnly ? 'animate-in fade-in duration-500' : ''}`}>

      {/* Header Section */}
      <div className="bg-white dark:bg-slate-900/80 dark:backdrop-blur-xl p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-white/5 print:shadow-none print:border-b-2 print:border-slate-800 print:rounded-none relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-50 to-white rounded-bl-full -mr-8 -mt-8 print:hidden opacity-50"></div>
        {readOnly && (
          <button
            onClick={() => window.print()}
            className="absolute top-6 right-6 text-slate-300 hover:text-slate-600 print:hidden transition-colors"
            title="Print Report"
          >
            <Printer className="w-5 h-5" />
          </button>
        )}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center print:hidden shadow-sm shadow-indigo-200">
                <GraduationCap className="w-4 h-4" />
              </div>
              <h2 className="text-3xl font-black text-slate-800 tracking-tight">{t('report.title')} <span className="text-indigo-600">{t('report.titleAccent')}</span></h2>
            </div>
            <p className="text-slate-500 font-medium">{t('report.subtitle')}</p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">CEFR</span>
                {readOnly ? (
                  <span className="text-sm font-bold text-indigo-700">
                    {editableReport.approximateCEFR}
                  </span>
                ) : (
                  <input
                    className="text-sm font-bold text-indigo-700 bg-transparent outline-none w-20"
                    value={editableReport.approximateCEFR}
                    onChange={(e) => updateField('approximateCEFR', e.target.value)}
                  />
                )}
              </div>
              <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">CEQ</span>
                {readOnly ? (
                  <span className="text-sm font-bold text-emerald-700">
                    {editableReport.approximateCEQ}
                  </span>
                ) : (
                  <input
                    className="text-sm font-bold text-emerald-700 bg-transparent outline-none w-24"
                    value={editableReport.approximateCEQ}
                    onChange={(e) => updateField('approximateCEQ', e.target.value)}
                  />
                )}
              </div>
              <div className="hidden print:block text-slate-400 text-xs ml-auto">
                {new Date().toLocaleDateString()}
              </div>
            </div>
          </div>

          <div className="text-center bg-slate-50 p-4 rounded-2xl border border-slate-100 print:bg-transparent print:border-none print:p-0">
            <p className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-2">Overall Grade</p>
            {!readOnly ? (
              <div className="print:hidden mb-2">
                <select
                  value={editableReport.overallGrade}
                  onChange={(e) => updateField('overallGrade', e.target.value as Grade)}
                  className="bg-white border border-slate-200 rounded-lg px-3 py-1 text-slate-700 font-bold outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500/20"
                >
                  {Object.values(Grade).map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            ) : null}
            <div className={`${!readOnly ? 'hidden print:block' : ''}`}>
              <GradeBadge grade={editableReport.overallGrade} size="lg" />
            </div>
          </div>
        </div>
      </div>

      {/* 1. 原文转录 & Sidebar */}
      <section className="bg-white dark:bg-slate-900/80 dark:backdrop-blur-xl p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-white/5 print:shadow-none print:p-0 print:break-inside-avoid">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm print:hidden">
              <FileText className="w-4 h-4" />
            </span>
            <span className="print:text-lg">
              {showGolden ? t('report.goldenVersion') : t('report.originalText')}
            </span>
          </h3>
          <div className="flex items-center gap-2 print:hidden">
            {!showGolden && (
              <button
                onClick={() => setShowHighlights(!showHighlights)}
                className={`text-xs font-bold px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${showHighlights ? 'bg-rose-100 text-rose-600' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
              >
                {showHighlights ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                {showHighlights ? t('report.highlightsOn') : t('report.highlightsOff')}
              </button>
            )}
            <button
              onClick={() => setShowGolden(!showGolden)}
              className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-lg transition-colors flex items-center gap-2"
            >
              {showGolden ? <RotateCcw className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
              {showGolden ? t('report.viewOriginal') : t('report.viewGolden')}
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-0 border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
          {/* Left: Text Area */}
          <div className="lg:col-span-2 relative bg-white border-r border-slate-100 p-8">
            <Quote className="absolute top-4 left-4 w-10 h-10 text-slate-50 -z-0 print:hidden" />

            <div
              className={`relative z-10 w-full min-h-[16rem] font-serif text-lg leading-[3rem] tracking-wide transition-all duration-300 ${!showGolden ? 'bg-white' : 'bg-slate-50/50'}`}
              style={!showGolden ? {
                backgroundImage: 'linear-gradient(transparent calc(100% - 1px), #e2e8f0 calc(100% - 1px))',
                backgroundSize: '100% 3rem',
                backgroundAttachment: 'local',
                paddingTop: '0.1rem'
              } : {}}
            >
              {showGolden ? (
                renderParagraphs(editableReport.goldenVersion, false, false)
              ) : (
                renderParagraphs(editableReport.originalText, showHighlights, true)
              )}
            </div>

            <div className="hidden print:block mt-8 pt-6 border-t border-dashed border-slate-200">
              <h4 className="font-bold text-slate-800 mb-2 text-sm uppercase tracking-wider text-center">Golden Version (Rewrite)</h4>
              <div className="font-serif text-base text-slate-700 leading-relaxed text-justify">
                {renderParagraphs(editableReport.goldenVersion, false)}
              </div>
            </div>
          </div>

          {/* Right: Sidebar Corrections List */}
          <div className="bg-slate-50/50 flex flex-col h-full min-h-[400px] lg:max-h-[600px]">
            {/* Correction List */}
            {showGolden ? (
              <div className="p-8 flex flex-col items-center justify-center h-full text-center text-slate-400">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                  <Check className="w-6 h-6 text-emerald-400" />
                </div>
                <p className="font-bold text-slate-600">Golden Version</p>
                <p className="text-xs mt-2">Perfect native expression.</p>
              </div>
            ) : (
              <div className="overflow-y-auto p-4 space-y-4 custom-scrollbar h-full">
                {orderedMatches.length > 0 ? (
                  orderedMatches.map((match) => (
                    <div key={match.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                      {/* Number Badge */}
                      <div className="flex items-center gap-3 mb-3 border-b border-slate-50 pb-2">
                        <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shadow-sm flex-shrink-0 border-2 border-indigo-100">
                          {match.id}
                        </span>
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-wider">Correction</span>
                      </div>

                      {/* Original */}
                      <div className="mb-3">
                        <div className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-1">ORIGINAL</div>
                        <div className="bg-rose-50 border border-rose-100 text-rose-800 px-3 py-2 rounded-lg text-sm font-medium line-through decoration-rose-300/50 font-serif">
                          {match.error.original}
                        </div>
                      </div>

                      {/* Arrow */}
                      <div className="flex justify-center -my-2 relative z-10">
                        <ArrowDown className="w-3 h-3 text-slate-200 bg-white rounded-full p-0.5 border border-slate-50" />
                      </div>

                      {/* Better */}
                      <div className="mb-4">
                        <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1">BETTER</div>
                        <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 px-3 py-2 rounded-lg text-lg font-bold shadow-sm font-sans">
                          {match.error.refined}
                        </div>
                      </div>

                      {/* Reason */}
                      <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 leading-relaxed border border-slate-100 mb-2">
                        <div className="flex items-center gap-1.5 mb-1 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                          <Info className="w-3 h-3" /> Reason
                        </div>
                        {match.error.explanation}
                      </div>

                      {/* Type Tag */}
                      {match.error.type && (
                        <div className="flex justify-end">
                          <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide">
                            <Tag className="w-2.5 h-2.5 text-slate-400" />
                            {match.error.type}
                          </span>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-3 py-10">
                    <CheckCircle2 className="w-10 h-10 text-emerald-200" />
                    <p className="text-sm font-medium">No errors found!</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 2. 成绩单 & 句式分析 */}
      <div className="grid lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 bg-white dark:bg-slate-900/80 dark:backdrop-blur-xl p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-white/5 overflow-hidden print:shadow-none print:p-0 print:break-inside-avoid">
          <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm print:hidden">
              <BarChart3 className="w-4 h-4" />
            </span>
            <span className="print:text-lg">{t('report.gradeReport')}</span>
          </h3>

          <div className="overflow-hidden rounded-xl border border-slate-100 print:border-slate-200">
            <table className="w-full text-left">
              <thead className="bg-slate-50 print:bg-slate-100">
                <tr>
                  <th className="py-4 px-6 font-bold text-slate-700 text-sm tracking-wide">{t('report.dimension')}</th>
                  <th className="py-4 px-6 font-bold text-slate-700 text-sm tracking-wide w-24 text-center">{t('report.grade')}</th>
                  <th className="py-4 px-6 font-bold text-slate-700 text-sm tracking-wide">{t('report.comment')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {editableReport.grades.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors print:hover:bg-transparent">
                    <td className="py-3 px-6 align-top">
                      {readOnly ? (
                        <div className="py-2 font-bold text-slate-800 text-sm">{item.dimension}</div>
                      ) : (
                        <input
                          className="w-full bg-transparent py-2 rounded focus:bg-white focus:ring-1 focus:ring-indigo-100 outline-none font-bold text-slate-800 text-sm"
                          value={item.dimension}
                          onChange={(e) => updateArrayItem('grades', idx, { dimension: e.target.value })}
                        />
                      )}
                    </td>
                    <td className="py-3 px-6 align-top text-center">
                      {!readOnly ? (
                        <div className="print:hidden">
                          <select
                            value={item.grade}
                            onChange={(e) => updateArrayItem('grades', idx, { grade: e.target.value as Grade })}
                            className="w-full bg-transparent py-2 rounded focus:bg-white focus:ring-1 focus:ring-indigo-100 outline-none font-bold text-indigo-700 text-center"
                          >
                            {Object.values(Grade).map(g => <option key={g} value={g}>{g}</option>)}
                          </select>
                        </div>
                      ) : null}
                      <div className={`${!readOnly ? 'hidden print:block' : ''} flex justify-center pt-1`}>
                        <GradeBadge grade={item.grade} size="sm" />
                      </div>
                    </td>
                    <td className="py-3 px-6 align-top">
                      {readOnly ? (
                        <div className="py-2 text-slate-600 text-xs leading-relaxed whitespace-pre-wrap">{item.comment}</div>
                      ) : (
                        <textarea
                          className="w-full bg-transparent py-2 rounded focus:bg-white focus:ring-1 focus:ring-indigo-100 outline-none resize-none text-xs text-slate-600 leading-relaxed"
                          rows={2}
                          value={item.comment}
                          onChange={(e) => updateArrayItem('grades', idx, { comment: e.target.value })}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Sentence Variety Stats */}
        <section className="bg-white dark:bg-slate-900/80 dark:backdrop-blur-xl p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-white/5 print:shadow-none print:p-0 print:break-inside-avoid">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-indigo-500 print:hidden" />
            {t('report.sentenceVariety')}
          </h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-slate-600">
                <span>{t('report.simple')}</span>
                <span>{editableReport.sentenceVariety?.simple || 0}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${editableReport.sentenceVariety?.simple || 0}%` }}></div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-slate-600">
                <span>{t('report.compound')}</span>
                <span>{editableReport.sentenceVariety?.compound || 0}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-sky-400 rounded-full" style={{ width: `${editableReport.sentenceVariety?.compound || 0}%` }}></div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-slate-600">
                <span>{t('report.complex')}</span>
                <span>{editableReport.sentenceVariety?.complex || 0}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${editableReport.sentenceVariety?.complex || 0}%` }}></div>
              </div>
            </div>

            <div className="mt-4 p-3 bg-indigo-50 rounded-xl text-xs text-indigo-800 leading-relaxed">
              <Lightbulb className="w-3.5 h-3.5 mr-1 text-indigo-500 inline-block" />
              {editableReport.sentenceVariety?.advice || t('report.defaultAdvice')}
            </div>
          </div>
        </section>
      </div>

      {/* 3. 细节诊断 */}
      <section className="bg-white dark:bg-slate-900/80 dark:backdrop-blur-xl p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-white/5 print:shadow-none print:p-0 print:break-inside-avoid">
        <h3 className="text-xl font-bold text-slate-800 mb-8 flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-sm print:hidden">
            <Stethoscope className="w-4 h-4" />
          </span>
          <span className="print:text-lg">{t('report.detailedAnalysis')}</span>
        </h3>

        <div className="space-y-8">
          {/* Mechanics */}
          <div className="bg-slate-50/50 rounded-2xl p-6 border-l-4 border-blue-400 print:bg-white print:border-l-2 print:border-slate-300 print:p-0 print:pl-4">
            <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
              <PenLine className="w-3.5 h-3.5 text-blue-400 print:hidden" />
              {t('report.mechanics')}
            </h4>
            {readOnly ? (
              <div className="text-sm leading-relaxed text-slate-600 whitespace-pre-wrap">{editableReport.mechanicsAnalysis}</div>
            ) : (
              <textarea
                value={editableReport.mechanicsAnalysis}
                onChange={(e) => updateField('mechanicsAnalysis', e.target.value)}
                className="w-full bg-white p-3 rounded-lg border border-slate-200 text-sm leading-relaxed text-slate-600 focus:ring-1 focus:ring-blue-400 outline-none print:bg-white print:border-none print:p-0 print:h-auto"
              />
            )}
          </div>

          {/* Collocation Check */}
          {editableReport.collocationErrors && editableReport.collocationErrors.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-bold text-slate-800 flex items-center gap-2 border-l-4 border-purple-400 pl-4 py-1 print:border-slate-300 print:border-l-2">
                {t('report.collocation')}
              </h4>
              <div className="grid md:grid-cols-2 gap-4">
                {editableReport.collocationErrors.map((item, idx) => (
                  <div key={idx} className="bg-purple-50 p-4 rounded-xl border border-purple-100 relative">
                    <div className="flex items-center gap-2 text-xs font-bold text-purple-800 mb-2">
                      <span className="line-through text-rose-500 opacity-60 decoration-2">{item.original}</span>
                      <ArrowRight className="w-3 h-3 text-purple-400" />
                      <span className="text-emerald-600">{item.suggestion}</span>
                    </div>
                    <p className="text-xs text-purple-900/70 leading-relaxed">{item.explanation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grammar Summary (Simplified view since details are in sidebar) */}
          <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-amber-800 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                {t('report.grammarSummary')}
              </h4>
              <div className="text-xs text-amber-600">
                {lang === 'zh'
                  ? <>共发现 <strong>{orderedMatches.length}</strong> 处可优化点，详见上方原文侧边栏。</>
                  : <>Found <strong>{orderedMatches.length}</strong> optimizable point(s). See original text sidebar above.</>}
              </div>
            </div>
          </div>

          {/* Idioms Section (Moved here since sidebar is now for corrections) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="font-bold text-slate-700 flex items-center gap-2 text-sm uppercase tracking-wider border-l-4 border-amber-400 pl-4 py-1">
                Idioms & Phrasal Verbs
              </h4>
              {!readOnly && (
                <button
                  type="button"
                  disabled={generating === 'idiomSuggestions'}
                  onClick={() => handleAIAdd('idiomSuggestions')}
                  className="w-6 h-6 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center hover:bg-amber-500 hover:text-white transition-all disabled:opacity-50 print:hidden"
                >
                  {generating === 'idiomSuggestions' ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Plus className="w-2.5 h-2.5" />}
                </button>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {editableReport.idiomSuggestions && editableReport.idiomSuggestions.length > 0 ? (
                editableReport.idiomSuggestions.map((item, idx) => (
                  <div key={idx} className="relative group bg-amber-50/40 p-4 rounded-xl border border-amber-100/50 hover:border-amber-200 transition-colors">
                    {!readOnly && (
                      <button onClick={() => removeArrayItem('idiomSuggestions', idx)} className="absolute top-2 right-2 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all print:hidden">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                    <div className="mb-1 font-bold text-amber-700 text-sm">{item.expression}</div>
                    <div className="text-xs text-slate-500 mb-2">{item.meaning}</div>
                    <div className="text-xs text-slate-600 italic border-l-2 border-amber-200 pl-2">"{item.usage || item.originalContext}"</div>
                  </div>
                ))
              ) : (
                <div className="col-span-2 text-xs text-slate-400 italic text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  No idioms detected.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 4. Language Enhancement */}
      {editableReport.languageEnhancement && editableReport.languageEnhancement.length > 0 && (
        <section className="bg-white dark:bg-slate-900/80 dark:backdrop-blur-xl p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-white/5 print:shadow-none print:p-0 print:break-inside-avoid">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center text-sm print:hidden">
                <TrendingUp className="w-4 h-4" />
              </span>
              <span className="print:text-lg">{t('report.enhancement')}</span>
            </h3>
            {!readOnly && (
              <button
                type="button"
                disabled={generating === 'languageEnhancement'}
                onClick={() => handleAIAdd('languageEnhancement')}
                className="w-8 h-8 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center hover:bg-violet-500 hover:text-white transition-all disabled:opacity-50 print:hidden"
              >
                {generating === 'languageEnhancement' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              </button>
            )}
          </div>

          <div className="space-y-8">
            {editableReport.languageEnhancement.map((item, idx) => (
              <div key={idx} className="relative group">
                {!readOnly && (
                  <button onClick={() => removeArrayItem('languageEnhancement', idx)} className="absolute -top-3 -right-3 w-6 h-6 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center hover:bg-rose-500 hover:text-white opacity-0 group-hover:opacity-100 transition-all z-10 print:hidden shadow-sm">
                    <X className="w-3 h-3" />
                  </button>
                )}

                {/* Level 1 */}
                <div className="mb-2 relative pl-8">
                  <span className="absolute left-0 top-1 text-[10px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">L1</span>
                  {readOnly ? (
                    <div className="text-slate-500 text-sm font-medium">{item.original}</div>
                  ) : (
                    <input
                      className="w-full text-slate-500 text-sm font-medium bg-slate-50/50 rounded px-2 py-1 outline-none border border-transparent hover:border-slate-200"
                      value={item.original}
                      onChange={(e) => updateArrayItem('languageEnhancement', idx, { original: e.target.value })}
                    />
                  )}
                </div>

                {/* Arrow */}
                <div className="pl-9 mb-2 text-slate-200 text-xs">
                  <ArrowDown className="w-3 h-3" />
                </div>

                {/* Level 2 */}
                <div className="mb-2 relative pl-8">
                  <span className="absolute left-0 top-1 text-[10px] font-black text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">L2</span>
                  {readOnly ? (
                    <div className="text-slate-700 text-sm font-medium">{renderWithHighlights(item.level2, 'text-indigo-600')}</div>
                  ) : (
                    <input
                      className="w-full text-slate-700 text-sm font-medium bg-slate-50/50 rounded px-2 py-1 outline-none border border-transparent hover:border-indigo-200"
                      value={item.level2}
                      onChange={(e) => updateArrayItem('languageEnhancement', idx, { level2: e.target.value })}
                    />
                  )}
                </div>

                {/* Arrow */}
                <div className="pl-9 mb-2 text-indigo-100 text-xs">
                  <ArrowDown className="w-3 h-3" />
                </div>

                {/* Level 3 */}
                <div className="relative pl-8 bg-gradient-to-r from-violet-50 to-white p-3 rounded-xl border border-violet-100">
                  <span className="absolute left-3 top-4 text-[10px] font-black text-white bg-violet-500 px-1.5 py-0.5 rounded shadow-sm shadow-violet-200">L3</span>
                  {readOnly ? (
                    <div className="text-slate-800 text-base font-bold pl-2">{renderWithHighlights(item.level3, 'text-violet-700')}</div>
                  ) : (
                    <input
                      className="w-full text-slate-800 text-base font-bold bg-white/50 rounded px-2 py-1 outline-none border border-transparent hover:border-violet-200 pl-2"
                      value={item.level3}
                      onChange={(e) => updateArrayItem('languageEnhancement', idx, { level3: e.target.value })}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Word Bank & Topic Extensions */}
      <div className="grid md:grid-cols-2 gap-6 print:grid-cols-1 print:break-before-page">
        {/* Word Bank */}
        <section className="bg-white dark:bg-slate-900/80 dark:backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-white/5 print:shadow-none print:p-0 print:border-none">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center text-sm print:hidden">
                <BookMarked className="w-4 h-4" />
              </span>
              <span>{t('report.wordBank')}</span>
            </h3>
            {!readOnly && (
              <button
                type="button"
                disabled={generating === 'wordBank'}
                onClick={() => handleAIAdd('wordBank')}
                className="w-8 h-8 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center hover:bg-sky-500 hover:text-white transition-all disabled:opacity-50 print:hidden"
              >
                {generating === 'wordBank' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              </button>
            )}
          </div>

          <div className="space-y-4">
            {editableReport.wordBank.map((item, idx) => (
              <div key={idx} className={`p-4 bg-slate-50/50 rounded-2xl border border-slate-100 group relative hover:border-sky-200 hover:shadow-sm transition-all print:bg-white print:border-slate-200 print:p-3 print:break-inside-avoid ${readOnly ? 'bg-white' : ''}`}>
                {!readOnly && (
                  <button onClick={() => removeArrayItem('wordBank', idx)} className="absolute top-2 right-2 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all print:hidden">
                    <X className="w-3 h-3" />
                  </button>
                )}
                <div className="flex justify-between items-baseline mb-2 border-b border-slate-100 pb-2 border-dashed">
                  {readOnly ? (
                    <div className="font-bold text-slate-800">{item.word}</div>
                  ) : (
                    <input
                      className="font-bold text-slate-800 bg-transparent outline-none w-full"
                      value={item.word}
                      onChange={(e) => updateArrayItem('wordBank', idx, { word: e.target.value })}
                    />
                  )}
                  {readOnly ? (
                    <div className="text-xs font-medium text-slate-500 whitespace-nowrap ml-2">{item.meaning}</div>
                  ) : (
                    <input
                      className="text-xs font-medium text-slate-500 bg-transparent text-right outline-none w-1/3"
                      value={item.meaning}
                      onChange={(e) => updateArrayItem('wordBank', idx, { meaning: e.target.value })}
                    />
                  )}
                </div>
                {readOnly ? (
                  <div className="text-xs text-slate-600 leading-relaxed italic">{item.example}</div>
                ) : (
                  <textarea
                    className="w-full text-xs text-slate-600 leading-relaxed bg-transparent outline-none resize-none italic"
                    rows={2}
                    value={item.example}
                    onChange={(e) => updateArrayItem('wordBank', idx, { example: e.target.value })}
                  />
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Topic Extensions */}
        <section className="bg-white dark:bg-slate-900/80 dark:backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-white/5 print:shadow-none print:p-0 print:border-none">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-sm print:hidden">
                <MessageSquare className="w-4 h-4" />
              </span>
              <span>{t('report.expressions')}</span>
            </h3>
            {!readOnly && (
              <button
                type="button"
                disabled={generating === 'topicExtensions'}
                onClick={() => handleAIAdd('topicExtensions')}
                className="w-8 h-8 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center hover:bg-amber-500 hover:text-white transition-all disabled:opacity-50 print:hidden"
              >
                {generating === 'topicExtensions' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              </button>
            )}
          </div>

          <div className="space-y-4">
            {editableReport.topicExtensions.map((item, idx) => (
              <div key={idx} className={`p-4 bg-amber-50/20 rounded-2xl border border-amber-100/50 group relative hover:border-amber-200 hover:shadow-sm transition-all print:bg-white print:border-slate-200 print:p-3 print:break-inside-avoid ${readOnly ? 'bg-amber-50/10' : ''}`}>
                {!readOnly && (
                  <button onClick={() => removeArrayItem('topicExtensions', idx)} className="absolute top-2 right-2 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all print:hidden">
                    <X className="w-3 h-3" />
                  </button>
                )}
                <div className="mb-2">
                  {readOnly ? (
                    <div className="font-bold text-slate-800 text-sm">{item.expression}</div>
                  ) : (
                    <input
                      className="w-full font-bold text-slate-800 text-sm bg-transparent outline-none"
                      value={item.expression}
                      onChange={(e) => updateArrayItem('topicExtensions', idx, { expression: e.target.value })}
                    />
                  )}
                  {readOnly ? (
                    <div className="text-xs text-amber-700 font-medium mt-0.5">{item.meaning}</div>
                  ) : (
                    <input
                      className="w-full text-xs text-amber-700 font-medium bg-transparent outline-none"
                      value={item.meaning}
                      onChange={(e) => updateArrayItem('topicExtensions', idx, { meaning: e.target.value })}
                    />
                  )}
                </div>
                <div className="bg-white/50 p-2 rounded-lg text-xs text-slate-600 italic border border-amber-100/30 print:border-none print:p-0 print:bg-transparent">
                  {readOnly ? (
                    <div className="whitespace-pre-wrap">{item.usage}</div>
                  ) : (
                    <textarea
                      className="w-full bg-transparent outline-none resize-none"
                      rows={1}
                      value={item.usage}
                      onChange={(e) => updateArrayItem('topicExtensions', idx, { usage: e.target.value })}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Quiz Section */}
      {editableReport.errorQuiz && editableReport.errorQuiz.length > 0 && (
        <section className="bg-white dark:bg-slate-900/80 dark:backdrop-blur-xl p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-white/5 print:shadow-none print:p-0 print:break-inside-avoid">
          <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center text-sm print:hidden">
              <Pencil className="w-4 h-4" />
            </span>
            <span className="print:text-lg">{t('report.practice')}</span>
          </h3>
          <div className="space-y-6">
            {editableReport.errorQuiz.map((item, idx) => (
              <div key={idx} className="bg-teal-50/30 p-5 rounded-2xl border border-teal-100/50">
                <div className="flex items-start gap-3 mb-4">
                  <span className="bg-teal-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0">{idx + 1}</span>
                  <p className="font-medium text-slate-800">{item.question}</p>
                </div>
                <div className="space-y-2 ml-9">
                  {item.options.map((option, optIdx) => {
                    const isSelected = quizState[idx] === option;
                    const isCorrect = option === item.correctAnswer;
                    const showResult = !!quizState[idx];

                    let btnClass = "w-full text-left p-3 rounded-xl border transition-all text-sm ";
                    if (showResult) {
                      if (isCorrect) btnClass += "bg-emerald-100 border-emerald-300 text-emerald-800 font-bold";
                      else if (isSelected && !isCorrect) btnClass += "bg-rose-100 border-rose-300 text-rose-800";
                      else btnClass += "bg-white border-slate-200 text-slate-500 opacity-60";
                    } else {
                      btnClass += "bg-white border-slate-200 hover:border-teal-300 hover:bg-teal-50 text-slate-700";
                    }

                    return (
                      <button
                        key={optIdx}
                        onClick={() => !showResult && handleQuizAnswer(idx, option)}
                        className={btnClass}
                        disabled={showResult}
                      >
                        <span className="mr-2 font-bold opacity-50">{String.fromCharCode(65 + optIdx)}.</span>
                        {option}
                        {showResult && isCorrect && <Check className="w-4 h-4 float-right mt-1 text-emerald-600" />}
                        {showResult && isSelected && !isCorrect && <X className="w-4 h-4 float-right mt-1 text-rose-600" />}
                      </button>
                    )
                  })}
                </div>
                {quizState[idx] && (
                  <div className="ml-9 mt-4 text-xs text-slate-600 bg-white p-3 rounded-lg border border-teal-100 animate-in fade-in slide-in-from-top-2">
                    <span className="font-bold text-teal-700">{t('report.explanation')}</span> {item.explanation}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Teacher's Note */}
      <section className="bg-white dark:bg-slate-900/80 dark:backdrop-blur-xl p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-white/5 print:shadow-none print:p-0 print:break-inside-avoid">
        <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-rose-100 text-rose-500 flex items-center justify-center text-sm print:hidden">
            <Heart className="w-4 h-4" />
          </span>
          <span className="print:text-lg">{t('report.teacherNote')}</span>
        </h3>

        <div className="grid gap-6">
          <div className="relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 rounded-full opacity-20"></div>
            <div className="pl-6 py-2">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2 block">English Version</span>
              {readOnly ? (
                <div className="text-slate-700 text-sm italic leading-relaxed font-serif whitespace-pre-wrap">
                  {editableReport.teacherNote.en}
                </div>
              ) : (
                <textarea
                  className="w-full text-slate-700 text-sm italic bg-transparent outline-none resize-none font-serif leading-relaxed focus:bg-slate-50 rounded p-2"
                  rows={3}
                  value={editableReport.teacherNote.en}
                  onChange={(e) => updateNestedField('teacherNote', 'en', e.target.value)}
                />
              )}
            </div>
          </div>

          <div className="relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 rounded-full opacity-20"></div>
            <div className="pl-6 py-2">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2 block">{t('report.chineseComment')}</span>
              {readOnly ? (
                <div className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
                  {editableReport.teacherNote.zh}
                </div>
              ) : (
                <textarea
                  className="w-full text-slate-700 text-sm leading-relaxed bg-transparent outline-none resize-none focus:bg-slate-50 rounded p-2"
                  rows={3}
                  value={editableReport.teacherNote.zh}
                  onChange={(e) => updateNestedField('teacherNote', 'zh', e.target.value)}
                />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Actions */}
      <div className="flex flex-col md:flex-row justify-center gap-4 pt-4 print:hidden">
        {readOnly ? (
          <>
            <button
              type="button"
              onClick={handleClosePreview}
              className="px-8 py-4 bg-white text-slate-600 border border-slate-200 rounded-2xl font-bold hover:bg-slate-50 shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Pen className="w-4 h-4" />
              {t('report.backToEdit')}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onReset}
              className="px-8 py-4 bg-white text-slate-600 border border-slate-200 rounded-2xl font-bold hover:bg-slate-50 shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <ChevronLeft className="w-4 h-4" />
              {t('report.startOver')}
            </button>
            <button
              type="button"
              onClick={handleOpenPreview}
              className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
            >
              <FileCheck className="w-4 h-4" />
              {t('report.reportView')}
            </button>
            <button
              type="button"
              onClick={() => {
                console.log("Finalized Report:", editableReport);
                alert(t('report.saveConfirm'));
              }}
              className="px-12 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-black shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <CheckCheck className="w-4 h-4" />
              {t('report.finalize')}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ReportDisplay;
