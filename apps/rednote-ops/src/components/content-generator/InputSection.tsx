import { Sparkles, Loader2, PenTool, X } from 'lucide-react';
import { ContentGeneratorChildProps } from './types';
import { Textarea } from '@shared/components/ui/Textarea';
import { Select } from '@shared/components/ui/Select';
import { Card } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';

export default function InputSection({ state, actions }: ContentGeneratorChildProps) {
    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">内容创作工坊</h2>
                <p className="text-slate-500 dark:text-slate-400 mt-1">打造高转化、高互动的优质笔记。</p>
            </div>

            <Card className="space-y-6">
                {/* Quick Select from Plan */}
                {state.currentPlan.length > 0 && (
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">从计划中快速选择</label>
                        <div className="flex flex-wrap gap-2">
                            {state.currentPlan.map((item, idx) => (
                                <Button
                                    key={idx}
                                    variant="outline"
                                    size="sm"
                                    onClick={() => actions.handleQuickSelect(item.topic)}
                                    title={item.topic}
                                    className="bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-600 hover:border-rose-200 text-left truncate max-w-[200px] h-auto py-2"
                                >
                                    {item.topic}
                                </Button>
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
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">内容框架模板</label>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => actions.setSelectedFramework('')}
                                className={`px-3 py-1.5 h-auto text-xs ${!state.selectedFramework ? 'bg-rose-500 text-white border-rose-500 hover:bg-rose-600 hover:text-white' : 'bg-white border-slate-200 hover:border-rose-200 hover:text-rose-600 text-slate-600'}`}
                            >
                                默认
                            </Button>
                            {state.PROMPT_FRAMEWORKS.map(fw => (
                                <Button
                                    key={fw.id}
                                    variant="outline"
                                    size="sm"
                                    onClick={() => actions.setSelectedFramework(fw.id === state.selectedFramework ? '' : fw.id)}
                                    title={fw.desc}
                                    className={`px-3 py-1.5 h-auto text-xs ${fw.id === state.selectedFramework ? 'bg-rose-500 text-white border-rose-500 hover:bg-rose-600 hover:text-white' : 'bg-white border-slate-200 hover:border-rose-200 hover:text-rose-600 text-slate-600'}`}
                                >
                                    {fw.label}
                                </Button>
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

                <Button
                    variant="primary"
                    size="lg"
                    onClick={actions.handleGenerate}
                    isLoading={state.isGenerating}
                    leftIcon={!state.isGenerating && <Sparkles size={24} />}
                    className="w-full py-4 text-lg bg-gradient-to-r from-rose-500 to-orange-500 border-none transform hover:-translate-y-0.5"
                >
                    {state.isGenerating ? '正在撰写文案与构思配图...' : '生成笔记'}
                </Button>

                {/* Custom Note Section */}
                <div className="pt-4 border-t border-slate-100">
                    {!state.showCustomPrompt ? (
                        <Button
                            variant="outline"
                            onClick={() => actions.setShowCustomPrompt(true)}
                            className="w-full py-3 border-dashed shadow-none text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                            leftIcon={<PenTool size={18} />}
                        >
                            添加自定义笔记
                        </Button>
                    ) : (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                    <PenTool size={16} className="text-rose-500" />
                                    自定义内容提示词
                                </label>
                                <Button variant="ghost" size="sm" onClick={() => actions.setShowCustomPrompt(false)} className="text-slate-400 hover:text-slate-600 p-1 h-auto">
                                    <X size={16} />
                                </Button>
                            </div>
                            <Textarea
                                value={state.customPrompt}
                                onChange={(e) => actions.setCustomPrompt(e.target.value)}
                                placeholder="在这里输入详细的提示词，例如：帮我写一篇关于如何为3岁孩子挑选英语启蒙绘本的笔记，语气要温柔，多用案例..."
                                className="min-h-[120px] text-sm bg-rose-50/30 border-rose-200 focus:ring-rose-500/20 focus:border-rose-500"
                            />
                            <Button
                                variant="secondary"
                                onClick={actions.handleGenerateCustom}
                                isLoading={state.isGenerating}
                                leftIcon={!state.isGenerating && <Sparkles size={18} />}
                                className="w-full py-3 border-rose-200"
                            >
                                {state.isGenerating ? '正在撰写自定义笔记...' : '通过提示词生成笔记'}
                            </Button>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
}
