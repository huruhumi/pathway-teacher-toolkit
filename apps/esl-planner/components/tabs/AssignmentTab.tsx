import React, { useState } from 'react';
import { AssignmentSheet, StructuredLessonPlan } from '../../types';
import { AutoResizeTextarea } from '../common/AutoResizeTextarea';
import { Plus, Trash2, Star, BookOpen, ClipboardList, MessageSquare, Eye, EyeOff, User, RefreshCw, Loader2, Sparkles } from 'lucide-react';
import { createAIClient } from '@pathway/ai';

const PLACEHOLDER_PREFIX = '__KEEP_TERM_';

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const collectInlineEnglishSegments = (objective: string): string[] => {
    const segments: string[] = [];

    objective.replace(/(["'`])([^"'`\n]*[A-Za-z][^"'`\n]*)\1/g, (_full, _quote, inner: string) => {
        const normalized = inner.trim();
        if (normalized) segments.push(normalized);
        return _full;
    });

    objective.replace(/([（(])([^）)\n]*[A-Za-z][^）)\n]*)([）)])/g, (_full, _left, inner: string) => {
        const normalized = inner.trim();
        if (normalized) segments.push(normalized);
        return _full;
    });

    return segments;
};

const buildMaskedObjectives = (
    objectives: string[],
    explicitProtectedTerms: string[],
): { maskedObjectives: string[]; placeholderMaps: Array<Record<string, string>> } => {
    let seq = 0;
    const placeholderMaps: Array<Record<string, string>> = [];

    const maskedObjectives = objectives.map((objective) => {
        const placeholderMap: Record<string, string> = {};
        const register = (value: string): string => {
            const token = `${PLACEHOLDER_PREFIX}${seq++}__`;
            placeholderMap[token] = value;
            return token;
        };

        let masked = objective;

        masked = masked.replace(/(["'`])([^"'`\n]*[A-Za-z][^"'`\n]*)\1/g, (_full, quote, inner: string) => {
            const normalized = inner.trim();
            if (!normalized) return _full;
            return `${quote}${register(normalized)}${quote}`;
        });

        masked = masked.replace(/([（(])([^）)\n]*[A-Za-z][^）)\n]*)([）)])/g, (_full, left, inner: string, right) => {
            const normalized = inner.trim();
            if (!normalized) return _full;
            return `${left}${register(normalized)}${right}`;
        });

        const perObjectiveTerms = Array.from(
            new Set([
                ...collectInlineEnglishSegments(objective),
                ...explicitProtectedTerms,
            ]
                .map((term) => String(term || '').trim())
                .filter((term) => term && /[A-Za-z]/.test(term))),
        ).sort((a, b) => b.length - a.length);

        perObjectiveTerms.forEach((term) => {
            const pattern = new RegExp(escapeRegExp(term), 'gi');
            masked = masked.replace(pattern, (match) => register(match));
        });

        placeholderMaps.push(placeholderMap);
        return masked;
    });

    return { maskedObjectives, placeholderMaps };
};

const restoreMaskedObjective = (translatedObjective: string, placeholderMap: Record<string, string>): string => {
    let restored = translatedObjective;
    Object.entries(placeholderMap).forEach(([token, value]) => {
        restored = restored.replace(new RegExp(escapeRegExp(token), 'g'), value);
    });
    return restored;
};

const translateObjectivesToChinese = async (objectives: string[], protectedTerms: string[] = []) => {
    if (!objectives.length) return [];
    const normalizedProtectedTerms = Array.from(
        new Set(
            protectedTerms
                .map((term) => String(term || '').trim())
                .filter((term) => term && /[A-Za-z]/.test(term)),
        ),
    );
    const { maskedObjectives, placeholderMaps } = buildMaskedObjectives(objectives, normalizedProtectedTerms);

    try {
        const ai = createAIClient();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Translate the following ESL lesson objectives into concise, natural Simplified Chinese for parent-facing homework sheets.
Return JSON only in this format: {"items":["..."]}.
Keep objective count exactly the same.
CRITICAL:
1) Keep all placeholder tokens exactly unchanged (format: ${PLACEHOLDER_PREFIX}number__).
2) Do NOT translate English teaching targets/commands/model language (including words/phrases like hello, goodbye, clap, stamp, stretch, touch, turn, "What's your name?", "My name is...").
3) Chinese connective wording can be translated naturally, but protected English teaching content must remain in English.
Protected teaching terms reference:
${JSON.stringify(normalizedProtectedTerms)}
Objectives:
${JSON.stringify(maskedObjectives)}`,
            config: { responseMimeType: 'application/json' },
        });
        const parsed = JSON.parse(response.text || '{}');
        const items = Array.isArray(parsed?.items) ? parsed.items : [];
        if (items.length === objectives.length) {
            return items.map((item: unknown, idx: number) => {
                const translated = String(item || maskedObjectives[idx]).trim() || maskedObjectives[idx];
                const restored = restoreMaskedObjective(translated, placeholderMaps[idx] || {});
                return restored || objectives[idx];
            });
        }
    } catch (error) {
        console.warn('Objective translation skipped:', error);
    }
    return objectives;
};

interface AssignmentTabProps {
    assignmentSheet: AssignmentSheet;
    setAssignmentSheet: (sheet: AssignmentSheet) => void;
    editablePlan: StructuredLessonPlan | null;
    /** Phonics keyPoints from parent content (for re-extraction) */
    phonicsKeyPoints?: string[];
}

const StarRating: React.FC<{ score: number; onChange: (score: number) => void }> = ({ score, onChange }) => (
    <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((s) => (
            <button
                key={s}
                onClick={() => onChange(s === score ? 0 : s)}
                className="p-0 border-none bg-transparent cursor-pointer transition-transform hover:scale-110"
                title={`${s}星`}
            >
                <Star
                    className={`w-4 h-4 ${s <= score ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`}
                />
            </button>
        ))}
    </div>
);

export const AssignmentTab: React.FC<AssignmentTabProps> = React.memo(({
    assignmentSheet,
    setAssignmentSheet,
    editablePlan,
    phonicsKeyPoints,
}) => {
    const update = (patch: Partial<AssignmentSheet>) =>
        setAssignmentSheet({ ...assignmentSheet, ...patch });

    const updateKeyPoint = (idx: number, value: string) => {
        const kp = [...assignmentSheet.keyPoints];
        kp[idx] = value;
        update({ keyPoints: kp });
    };

    const removeKeyPoint = (idx: number) =>
        update({ keyPoints: assignmentSheet.keyPoints.filter((_, i) => i !== idx) });

    const addKeyPoint = () => {
        if (assignmentSheet.keyPoints.length >= 6) return;
        update({ keyPoints: [...assignmentSheet.keyPoints, ''] });
    };

    const [isGeneratingComment, setIsGeneratingComment] = useState(false);

    const regenerateKeyPoints = async () => {
        if (!editablePlan) return;
        const kp: string[] = [];
        const objs = editablePlan.lessonDetails.objectives || [];
        const protectedTerms = [
            ...(editablePlan.lessonDetails.targetVocab || []).map((v) => String(v.word || '').trim()),
            ...(editablePlan.lessonDetails.grammarSentences || []).map((s) => String(s || '').trim()),
        ].filter(Boolean);
        const translatedObjs = await translateObjectivesToChinese(objs, protectedTerms);
        const objLines = translatedObjs.map((o, i) => `${i + 1}. ${o}`).join('\n');
        kp.push(`【课程简介】${editablePlan.classInformation.topic}${objLines ? '\n' + objLines : ''}`);
        if (editablePlan.lessonDetails.targetVocab?.length > 0)
            kp.push(`【本课词汇】${editablePlan.lessonDetails.targetVocab.map(v => v.word).join('、')}`);
        if (editablePlan.lessonDetails.grammarSentences?.length > 0)
            kp.push(`【语法/句型】\n${editablePlan.lessonDetails.grammarSentences.join('\n')}`);
        if (phonicsKeyPoints && phonicsKeyPoints.length > 0)
            kp.push(`【Phonics】\n${phonicsKeyPoints.join('\n')}`);
        update({ keyPoints: kp });
    };

    const updateAssignment = (idx: number, field: 'title' | 'description', value: string) => {
        const items = [...assignmentSheet.assignments];
        items[idx] = { ...items[idx], [field]: value };
        update({ assignments: items });
    };

    const removeAssignment = (idx: number) =>
        update({ assignments: assignmentSheet.assignments.filter((_, i) => i !== idx) });

    const addAssignment = () => {
        if (assignmentSheet.assignments.length >= 4) return;
        update({ assignments: [...assignmentSheet.assignments, { title: '', description: '' }] });
    };

    const updateRating = (idx: number, score: number) => {
        const ratings = [...assignmentSheet.feedback.ratings];
        ratings[idx] = { ...ratings[idx], score };
        update({ feedback: { ...assignmentSheet.feedback, ratings } });
    };

    // Derive category color from 【】 prefix
    const getCategoryStyle = (text: string) => {
        if (text.startsWith('【课程简介】')) return { color: 'text-violet-600', bg: 'bg-violet-50', label: '📖' };
        if (text.startsWith('【本课词汇】')) return { color: 'text-teal-600', bg: 'bg-teal-50', label: '📝' };
        if (text.startsWith('【语法/句型】')) return { color: 'text-indigo-600', bg: 'bg-indigo-50', label: '📐' };
        if (text.startsWith('【Phonics】')) return { color: 'text-pink-600', bg: 'bg-pink-50', label: '🔤' };
        return { color: 'text-slate-600', bg: 'bg-slate-50', label: '•' };
    };

    return (
        <div className="space-y-5 animate-fade-in">
            {/* Header with student name */}
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
                <div className="flex items-center gap-3">
                    <img id="pathway-logo" src={`${import.meta.env.BASE_URL}logo.png`} alt="Pathway Academy" className="w-10 h-10 object-contain" />
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">课后作业单</h3>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5">
                        <User className="w-3.5 h-3.5 text-indigo-500" />
                        <input
                            value={assignmentSheet.studentName}
                            onChange={(e) => update({ studentName: e.target.value })}
                            className="text-sm font-bold text-slate-700 dark:text-slate-300 bg-transparent border-none outline-none w-32"
                            placeholder="学生姓名"
                        />
                    </div>
                    <div className="text-xs text-slate-400">A4 打印</div>
                </div>
            </div>

            {/* Section 1: 课堂总结 & 重点 */}
            <div className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-white/10 p-5 shadow-sm">
                <h4 className="text-sm font-black text-indigo-900 dark:text-indigo-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-indigo-500" />
                    本课内容总结
                </h4>
                <AutoResizeTextarea
                    value={assignmentSheet.lessonSummary}
                    onChange={(e) => update({ lessonSummary: e.target.value })}
                    className="w-full text-sm text-slate-700 dark:text-slate-400 leading-relaxed bg-slate-50/50 border border-transparent hover:border-slate-200 focus:border-indigo-300 rounded-xl p-3 outline-none transition-all"
                    minRows={2}
                    placeholder="本课学习了……"
                />

                <div className="mt-3">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">学习重点（分类提取，可编辑）</span>
                        {assignmentSheet.keyPoints.length < 6 && (
                            <button onClick={addKeyPoint} className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 flex items-center gap-1 no-print">
                                <Plus className="w-3 h-3" /> 添加
                            </button>
                        )}
                        {editablePlan && (
                            <button onClick={regenerateKeyPoints} className="text-[10px] font-bold text-amber-500 hover:text-amber-700 flex items-center gap-1 no-print" title="从 Lesson Plan 重新提取">
                                <RefreshCw className="w-3 h-3" /> 重新提取
                            </button>
                        )}
                    </div>
                    <div className="space-y-2">
                        {assignmentSheet.keyPoints.map((kp, i) => {
                            const style = getCategoryStyle(kp);
                            return (
                                <div key={i} className={`flex items-start gap-2 group p-2 rounded-lg ${style.bg} border border-transparent`}>
                                    <span className="text-sm flex-shrink-0 mt-1">{style.label}</span>
                                    <AutoResizeTextarea
                                        value={kp}
                                        onChange={(e) => updateKeyPoint(i, e.target.value)}
                                        className={`flex-1 text-sm ${style.color} bg-transparent border-none outline-none py-0.5 leading-relaxed resize-none`}
                                        placeholder="重点内容…"
                                        minRows={1}
                                    />
                                    <button onClick={() => removeKeyPoint(i)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity no-print flex-shrink-0 mt-1">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Section 2: 作业清单 */}
            <div className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-white/10 p-5 shadow-sm">
                <h4 className="text-sm font-black text-indigo-900 dark:text-indigo-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-indigo-500" />
                    作业清单
                </h4>
                <div className="space-y-3">
                    {assignmentSheet.assignments.map((item, i) => (
                        <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border group ${item.isFixed ? 'bg-amber-50/50 border-amber-200' : 'bg-slate-50/50 border-slate-200 dark:border-white/10'}`}>
                            <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5">
                                {i + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                                <input
                                    value={item.title}
                                    onChange={(e) => updateAssignment(i, 'title', e.target.value)}
                                    className="w-full text-sm font-bold text-slate-800 dark:text-slate-200 bg-transparent border-none outline-none"
                                    placeholder="作业标题"
                                    readOnly={item.isFixed}
                                />
                                <input
                                    value={item.description}
                                    onChange={(e) => updateAssignment(i, 'description', e.target.value)}
                                    className="w-full text-xs text-slate-500 bg-transparent border-none outline-none mt-0.5"
                                    placeholder="作业说明（可选）"
                                />
                            </div>
                            {!item.isFixed && (
                                <button onClick={() => removeAssignment(i)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity no-print flex-shrink-0">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                            {item.isFixed && (
                                <span className="text-[9px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded uppercase flex-shrink-0">固定</span>
                            )}
                        </div>
                    ))}
                    {assignmentSheet.assignments.length < 4 && (
                        <button onClick={addAssignment} className="w-full p-2 border border-dashed border-slate-300 rounded-xl text-slate-400 hover:text-indigo-500 hover:border-indigo-300 transition-all flex items-center justify-center gap-1 text-xs font-bold no-print">
                            <Plus className="w-3 h-3" /> 添加作业
                        </button>
                    )}
                </div>
            </div>

            {/* Section 3: 课堂反馈 */}
            <div className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-white/10 p-5 shadow-sm">
                <h4 className="text-sm font-black text-indigo-900 dark:text-indigo-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-indigo-500" />
                    课堂表现反馈
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                    {assignmentSheet.feedback.ratings.map((r, i) => (
                        <div key={i} className="flex items-center justify-between bg-slate-50/50 rounded-lg px-3 py-2 border border-slate-100 dark:border-white/5">
                            <div>
                                <div className="text-xs font-bold text-slate-700 dark:text-slate-300">{r.dimension}</div>
                                <div className="text-[10px] text-slate-400">{r.dimension_en}</div>
                            </div>
                            <StarRating score={r.score} onChange={(s) => updateRating(i, s)} />
                        </div>
                    ))}
                </div>

                {/* AI Generate Comment Button */}
                <div className="flex justify-center mb-3 no-print">
                    <button
                        onClick={async () => {
                            if (isGeneratingComment) return;
                            setIsGeneratingComment(true);
                            try {
                                const ai = createAIClient();
                                const ratingSummary = assignmentSheet.feedback.ratings
                                    .map(r => `${r.dimension}(${r.dimension_en}): ${r.score || 0}/5`)
                                    .join(', ');
                                const topic = editablePlan?.classInformation?.topic || '本节课';
                                const seed = Math.floor(Math.random() * 10000);
                                const res = await ai.models.generateContent({
                                    model: 'gemini-2.5-flash',
                                    contents: `课程主题: ${topic}\n学生各维度星级: ${ratingSummary}\n随机种子: ${seed}\n\n请根据以上星级，用中文写一段简短的老师评语（2-3句话，约40-60字）。要求：\n1. 说人话！像老师随口跟家长聊天的语气，简洁干脆，不要文绉绉的，不要肉麻煽情\n2. 结合课程主题说一个具体的点就行，比如"今天学动物词汇，bear和monkey分得很清楚"\n3. 好的就简单夸一句，不好的轻描淡写带过，比如"发音还可以再多练练"\n4. 禁止使用："表现出色""令人印象深刻""在...方面""展现了""值得肯定""我注意到"这类AI套话\n5. 如果所有维度都没打分(0分)，就写一句简短鼓励的话\n6. 每次生成的措辞要有变化\n7. 直接输出评语文字，不要加引号、标题或任何格式标记`,
                                });
                                const comment = res.text?.trim() || '';
                                if (comment) {
                                    update({ feedback: { ...assignmentSheet.feedback, overallComment: comment }, showComment: true });
                                }
                            } catch (e) {
                                console.error('Failed to generate comment', e);
                            } finally {
                                setIsGeneratingComment(false);
                            }
                        }}
                        disabled={isGeneratingComment}
                        className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-indigo-500 text-white text-xs font-bold hover:from-violet-600 hover:to-indigo-600 transition-all shadow-sm flex items-center gap-1.5"
                    >
                        {isGeneratingComment ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        {isGeneratingComment ? 'AI 正在生成…' : 'AI 生成评语'}
                    </button>
                </div>

                {/* Comment toggle + textarea */}
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">老师寄语 / 总体评语</div>
                        <button
                            onClick={() => update({ showComment: !assignmentSheet.showComment })}
                            className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md no-print transition-colors"
                            style={{ color: assignmentSheet.showComment ? '#4f46e5' : '#94a3b8', background: assignmentSheet.showComment ? '#eef2ff' : '#f8fafc' }}
                        >
                            {assignmentSheet.showComment ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                            {assignmentSheet.showComment ? '显示在打印中' : '已隐藏（不打印）'}
                        </button>
                    </div>
                    <AutoResizeTextarea
                        value={assignmentSheet.feedback.overallComment}
                        onChange={(e) => update({ feedback: { ...assignmentSheet.feedback, overallComment: e.target.value } })}
                        className={`w-full text-sm leading-relaxed bg-slate-50/50 border border-transparent hover:border-slate-200 focus:border-indigo-300 rounded-xl p-3 outline-none transition-all ${assignmentSheet.showComment ? 'text-slate-700 dark:text-slate-400' : 'text-slate-400 dark:text-slate-600 italic'}`}
                        minRows={2}
                        placeholder="本节课该同学表现……"
                    />
                    {!assignmentSheet.showComment && (
                        <div className="text-[10px] text-amber-500 mt-1 italic">⚠ 此评语已设置为不显示在打印视图中</div>
                    )}
                </div>
            </div>
        </div>
    );
});
