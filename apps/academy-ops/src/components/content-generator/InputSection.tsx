import { Sparkles, Loader2, PenTool, X } from 'lucide-react';
import { ContentGeneratorChildProps } from './types';
import { Textarea } from '@shared/components/ui/Textarea';
import { Select } from '@shared/components/ui/Select';
import { Card } from '@shared/components/ui/Card';

export default function InputSection({ state, actions }: ContentGeneratorChildProps) {
    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-2xl font-bold text-slate-900">内容创作工坊</h2>
                <p className="text-slate-500 mt-1">打造高转化、高互动的优质笔记。</p>
            </div>

            <Card className="space-y-6">
                {/* Quick Select from Plan */}
                {state.currentPlan.length > 0 && (
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">从计划中快速选择</label>
                        <div className="flex flex-wrap gap-2">
                            {state.currentPlan.map((item, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => actions.handleQuickSelect(item.topic)}
                                    title={item.topic}
                                    className="text-xs bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 hover:border-rose-200 px-3 py-2 rounded-lg transition-colors text-left truncate max-w-[200px]"
                                >
                                    {item.topic}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="space-y-4">
                    <Textarea
                        label="笔记主题"
                        value={state.topic}
                        onChange={(e) => actions.setTopic(e.target.value)}
                        placeholder="例如：如何培养孩子的英语思辨能力？"
                        className="p-4 min-h-[100px]"
                    />

                    {/* Prompt Framework Templates */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">内容框架模板</label>
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => actions.setSelectedFramework('')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${!state.selectedFramework ? 'bg-rose-500 text-white border-rose-500' : 'bg-white text-slate-600 border-slate-200 hover:border-rose-200 hover:text-rose-600'}`}
                            >
                                默认
                            </button>
                            {state.PROMPT_FRAMEWORKS.map(fw => (
                                <button
                                    key={fw.id}
                                    onClick={() => actions.setSelectedFramework(fw.id === state.selectedFramework ? '' : fw.id)}
                                    title={fw.desc}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${fw.id === state.selectedFramework ? 'bg-rose-500 text-white border-rose-500' : 'bg-white text-slate-600 border-slate-200 hover:border-rose-200 hover:text-rose-600'}`}
                                >
                                    {fw.label}
                                </button>
                            ))}
                        </div>
                        {state.selectedFramework && (
                            <p className="text-xs text-slate-400 mt-1">
                                {state.PROMPT_FRAMEWORKS.find(f => f.id === state.selectedFramework)?.desc}
                            </p>
                        )}
                    </div>

                    <Select
                        label="图文风格"
                        value={state.style}
                        onChange={(e) => actions.setStyle(e.target.value)}
                        className="cursor-pointer"
                    >
                        <option>专业干货 (Educational) - 强调知识点，权威感</option>
                        <option>情感共鸣 (Emotional) - 讲故事，触动家长焦虑或期望</option>
                        <option>种草安利 (Promotional) - 强吸引力，直接展示课程优势</option>
                        <option>生活方式 (Lifestyle) - 展示学习环境，轻松氛围</option>
                    </Select>
                </div>

                <button
                    onClick={actions.handleGenerate}
                    disabled={state.isGenerating}
                    className="btn w-full py-4 text-lg bg-gradient-to-r from-rose-500 to-orange-500 text-white hover:shadow-lg hover:shadow-rose-200 transform hover:-translate-y-0.5 border-none"
                >
                    {state.isGenerating ? (
                        <>
                            <Loader2 size={24} className="animate-spin" />
                            <span>正在撰写文案与构思配图...</span>
                        </>
                    ) : (
                        <>
                            <Sparkles size={24} />
                            <span>生成笔记</span>
                        </>
                    )}
                </button>

                {/* Custom Note Section */}
                <div className="pt-4 border-t border-slate-100">
                    {!state.showCustomPrompt ? (
                        <button
                            onClick={() => actions.setShowCustomPrompt(true)}
                            className="w-full py-3 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center gap-2 transition-colors"
                        >
                            <PenTool size={18} />
                            <span>添加自定义笔记</span>
                        </button>
                    ) : (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                    <PenTool size={16} className="text-rose-500" />
                                    自定义内容提示词
                                </label>
                                <button onClick={() => actions.setShowCustomPrompt(false)} className="text-slate-400 hover:text-slate-600">
                                    <X size={16} />
                                </button>
                            </div>
                            <textarea
                                value={state.customPrompt}
                                onChange={(e) => actions.setCustomPrompt(e.target.value)}
                                placeholder="在这里输入详细的提示词，例如：帮我写一篇关于如何为3岁孩子挑选英语启蒙绘本的笔记，语气要温柔，多用案例..."
                                className="w-full p-4 border border-rose-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 bg-rose-50/30 min-h-[120px] text-sm"
                            />
                            <button
                                onClick={actions.handleGenerateCustom}
                                disabled={state.isGenerating}
                                className="btn btn-secondary w-full py-3 border border-rose-200"
                            >
                                {state.isGenerating ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" />
                                        <span>正在撰写自定义笔记...</span>
                                    </>
                                ) : (
                                    <>
                                        <Sparkles size={18} />
                                        <span>通过提示词生成笔记</span>
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
}
