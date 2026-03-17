/**
 * StructuredHandbookInput - Custom page-by-page outline input with knowledge research.
 * Used when handbookMode === 'structured'.
 */
import React, { useState } from 'react';
import { Search, ChevronDown, ChevronUp, CheckCircle2, Loader2, AlertCircle, FileText } from 'lucide-react';
import type { StructuredKnowledge } from '../types';
import { isSearchFailedKnowledgeContent } from '../services/knowledgeCache';
import { useStructuredKnowledgeResearch } from '../hooks/useStructuredKnowledgeResearch';

interface StructuredHandbookInputProps {
  structure: string;
  onStructureChange: (text: string) => void;
  knowledge: StructuredKnowledge[];
  onKnowledgeReady: (knowledge: StructuredKnowledge[]) => void;
  onMetaReady?: (meta: { theme: string; intro: string }) => void;
  lang?: 'en' | 'zh';
}

const EXAMPLE_PLACEHOLDER = `\u793a\u4f8b\u683c\u5f0f:

### \u7b2c\u4e00\u90e8\u5206\uff1a\u63a2\u9669\u96c6\u7ed3\uff08P1 - P5\uff09
* P1 \u5c01\u9762\uff1a\u300a\u5c11\u5e74\u63a2\u9669\u5bb6\u624b\u518c\u300b
* P2 \u961f\u5458\u6863\u6848\uff1a"\u6211\u7684\u63a2\u9669\u8eab\u4efd\u5361"
* P3 \u88c5\u5907 checklist\uff1a"\u63a2\u9669\u5305\u91cc\u6709\u4ec0\u4e48\uff1f"
* P4 \u5b89\u5168\u7ea6\u5b9a\uff1a"\u5c0f\u5c0f\u5b88\u62a4\u8005\u5ba3\u8a00"
* P5 \u5bfb\u5b9d\u5730\u56fe\uff1a\u7b80\u5316\u7248\u5bfc\u89c8\u56fe

### \u7b2c\u4e8c\u90e8\u5206\uff1a\u63a2\u7d22\u4e0e\u53d1\u73b0\uff08P6 - P15\uff09
* P6 \u7b2c\u4e00\u7ad9\uff1a"\u65f6\u5149\u4e4b\u95e8"\uff08\u5386\u53f2\u80cc\u666f\u4ecb\u7ecd\uff09
* P7 \u6311\u6218\u4efb\u52a1\uff1a"\u89c2\u5bdf\u4e0e\u8bb0\u5f55"
...`;

export const StructuredHandbookInput: React.FC<StructuredHandbookInputProps> = ({
  structure,
  onStructureChange,
  knowledge,
  onKnowledgeReady,
  onMetaReady,
  lang = 'zh',
}) => {
  const isZh = lang === 'zh';
  const [expandedTopics, setExpandedTopics] = useState<Set<number>>(new Set());
  const { status, progress, cacheStats, error, runResearch } = useStructuredKnowledgeResearch({
    structure,
    isZh,
    hasKnowledge: knowledge.length > 0,
    onKnowledgeReady,
    onMetaReady,
  });

  const toggleTopic = (idx: number) => {
    setExpandedTopics((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const pageCount = (structure.match(/\bP\d+\b/gi) || []).length;

  return (
    <div className="space-y-3">
      <label className="input-label">{isZh ? '\u81ea\u5b9a\u4e49\u9875\u9762\u5927\u7eb2' : 'Custom Page Outline'}</label>

      <div className="relative">
        <textarea
          value={structure}
          onChange={(e) => onStructureChange(e.target.value)}
          placeholder={EXAMPLE_PLACEHOLDER}
          rows={10}
          className="input-field py-3 text-sm font-mono resize-y min-h-[200px]"
        />
        {pageCount > 0 && (
          <span className="absolute top-2 right-2 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
            {pageCount} {isZh ? '\u9875' : 'pages'}
          </span>
        )}
      </div>

      <button
        onClick={runResearch}
        disabled={!structure.trim() || status === 'extracting' || status === 'searching'}
        className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all
          ${
            status === 'done'
              ? 'bg-emerald-50 border-2 border-emerald-300 text-emerald-700 hover:bg-emerald-100'
              : status === 'error'
                ? 'bg-red-50 border-2 border-red-300 text-red-700 hover:bg-red-100'
                : !structure.trim()
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-2 border-slate-200'
                  : 'bg-indigo-500 text-white hover:bg-indigo-600 border-2 border-indigo-500 shadow-sm'
          }`}
      >
        {status === 'extracting' && (
          <>
            <Loader2 size={16} className="animate-spin" />
            {isZh ? '\u63d0\u53d6\u7814\u7a76\u4e3b\u9898...' : 'Extracting topics...'}
          </>
        )}
        {status === 'searching' && (
          <>
            <Loader2 size={16} className="animate-spin" />
            {isZh
              ? `\u641c\u7d22\u77e5\u8bc6\u5e95\u5e93 (${progress.completed}/${progress.total})...`
              : `Researching (${progress.completed}/${progress.total})...`}
          </>
        )}
        {status === 'done' && (
          <>
            <CheckCircle2 size={16} />
            {isZh
              ? `\u77e5\u8bc6\u5e95\u5e93\u5df2\u5c31\u7eea (${knowledge.length} \u6761${
                  cacheStats ? `, \u7f13\u5b58${cacheStats.cached}/\u65b0\u641c${cacheStats.searched}` : ''
                }) - \u70b9\u51fb\u91cd\u65b0\u641c\u7d22`
              : `Knowledge ready (${knowledge.length}${
                  cacheStats ? `, ${cacheStats.cached} cached/${cacheStats.searched} new` : ''
                }) - Re-search`}
          </>
        )}
        {status === 'error' && (
          <>
            <AlertCircle size={16} />
            {error || (isZh ? '\u641c\u7d22\u5931\u8d25\uff0c\u70b9\u51fb\u91cd\u8bd5' : 'Failed, click to retry')}
          </>
        )}
        {status === 'idle' && (
          <>
            <Search size={16} />
            {isZh ? '\u641c\u7d22\u77e5\u8bc6\u5e95\u5e93' : 'Research Knowledge'}
          </>
        )}
      </button>

      {knowledge.length > 0 && (
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
            <FileText size={14} className="text-slate-400" />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {isZh ? '\u77e5\u8bc6\u5e95\u5e93\u9884\u89c8' : 'Knowledge Preview'}
            </span>
            <span className="text-xs text-slate-400 ml-auto">
              {knowledge.length} {isZh ? '\u6761' : 'items'}
            </span>
          </div>
          <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {knowledge.map((k, i) => (
              <div key={i} className="group">
                <button
                  onClick={() => toggleTopic(i)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                >
                  {expandedTopics.has(i) ? (
                    <ChevronUp size={14} className="text-slate-400 shrink-0" />
                  ) : (
                    <ChevronDown size={14} className="text-slate-400 shrink-0" />
                  )}
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{k.topic}</span>
                  {isSearchFailedKnowledgeContent(k.content) && <AlertCircle size={12} className="text-red-400 shrink-0" />}
                  {k.sources && k.sources.length > 0 && (
                    <span className="text-[10px] text-slate-400 shrink-0">[{k.sources.length} sources]</span>
                  )}
                </button>
                {expandedTopics.has(i) && (
                  <div className="px-4 pb-3 text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed max-h-[200px] overflow-y-auto">
                    {k.content.slice(0, 1500)}
                    {k.content.length > 1500 ? '...' : ''}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
