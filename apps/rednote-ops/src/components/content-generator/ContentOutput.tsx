import { Save, Loader2, Sparkles, Download, Type as TypeIcon, Check, Copy, Smartphone, Monitor, Image as ImageIcon, Hash } from 'lucide-react';
import { motion } from 'motion/react';
import { useToast } from '@shared/stores/useToast';
import { ContentGeneratorChildProps } from './types';

// Xiaohongshu banned/sensitive words that trigger content restrictions
const BANNED_WORDS = [
    '最', '第一', '绝对', '100%', '全网最', '史上最', '顶级', '永远',
    '万能', '秒杀', '碾压', '吊打', '国家级', '世界级',
    '微信', 'wx', 'WeChat', 'QQ', '淘宝', '拼多多',
    '加我', '私聊', '私信我', 'ddd', '滴滴', '代购',
    '赚钱', '暴富', '躺赚', '割韭菜', '免费领',
    '药', '治疗', '根治', '祛痘', '减肥', '瘦身',
];

export default function ContentOutput({ state, actions }: ContentGeneratorChildProps) {
    if (!state.generatedContent) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-3xl p-12 min-h-[500px]">
                <Sparkles size={48} className="mb-4 opacity-20" />
                <p>在左侧输入主题，生成的内容将显示在这里</p>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
        >
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-200">生成结果</h3>
                <button
                    onClick={() => actions.setShowSaveModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors shadow-sm"
                >
                    <Save size={18} />
                    <span>保存到日历</span>
                </button>
            </div>

            {/* Version History Bar */}
            {state.contentHistory.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3">
                    <span className="text-xs font-medium text-amber-700 whitespace-nowrap">💾 历史版本:</span>
                    <div className="flex gap-2 overflow-x-auto">
                        {state.contentHistory.map((hist, i) => (
                            <button
                                key={i}
                                onClick={() => {
                                    actions.setContentHistory(prev => [state.generatedContent!, ...prev.filter((_, idx) => idx !== i)].slice(0, 3));
                                    actions.setGeneratedContent(hist);
                                    actions.setEditablePrompts(hist.image_prompts || []);
                                }}
                                className="text-xs bg-white dark:bg-slate-900/80 border border-amber-200 text-amber-700 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors whitespace-nowrap"
                            >
                                V{state.contentHistory.length - i} · {hist.titles?.[0]?.substring(0, 15) || '无标题'}...
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Content Moderation Warning */}
            {(() => {
                const content = state.generatedContent.content || '';
                const titles = Array.isArray(state.generatedContent.titles) ? state.generatedContent.titles : [];
                const foundWords = BANNED_WORDS.filter(w => content.includes(w) || titles.some((t: string) => t.includes(w)));
                if (foundWords.length === 0) return null;
                return (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                        <p className="text-xs font-medium text-red-600">
                            ⚠️ 检测到 {foundWords.length} 个小红书敏感词/违规词，可能导致限流或被删：
                            <span className="font-bold ml-1">{foundWords.join(', ')}</span>
                        </p>
                        <p className="text-xs text-red-400 mt-1">建议在复制前手动删除或替换标红词汇。</p>
                    </div>
                );
            })()}

            {/* Generated Images Gallery */}
            {state.imageState.images.length > 0 && (
                <div className="space-y-3">
                    {state.imageState.images.filter(Boolean).length > 1 && (
                        <button
                            onClick={() => {
                                state.imageState.images.filter(Boolean).forEach((img, idx) => {
                                    setTimeout(() => {
                                        const link = document.createElement('a');
                                        link.href = img;
                                        link.download = `xiaohongshu-${state.topic.substring(0, 10)}-${idx + 1}.png`;
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                    }, idx * 500);
                                });
                                useToast.getState().success(`正在下载 ${state.imageState.images.filter(Boolean).length} 张图片...`);
                            }}
                            className="w-full py-2.5 rounded-xl bg-slate-800 text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-slate-700 transition-colors"
                        >
                            <Download size={16} />
                            一键下载全部配图 ({state.imageState.images.filter(Boolean).length} 张)
                        </button>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                        {state.imageState.images.map((img, idx) => (
                            img ? (
                                <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 shadow-sm aspect-[3/4]">
                                    <img src={img} alt={`Generated ${idx}`} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <a
                                            href={img}
                                            download={`xiaohongshu-image-${idx}.png`}
                                            className="p-2 bg-white dark:bg-slate-900/80 rounded-full text-slate-900 dark:text-slate-200 hover:text-rose-500 transition-colors"
                                            title="下载图片"
                                        >
                                            <Download size={20} />
                                        </a>
                                    </div>
                                </div>
                            ) : (
                                <div key={idx} className="aspect-[3/4] rounded-xl border-2 border-dashed border-slate-200 dark:border-white/10 bg-slate-50 flex flex-col items-center justify-center text-slate-300">
                                    <span className="text-xs">图片 {idx + 1}</span>
                                    {state.imageState.generatingIndices.includes(idx) && <Loader2 size={16} className="animate-spin mt-2 text-purple-400" />}
                                </div>
                            )
                        ))}
                        {/* Show loading placeholder for bulk generation if we haven't reached the count yet */}
                        {state.imageState.isGenerating && state.imageState.images.length < state.imageCount && (
                            <div className="aspect-[3/4] rounded-xl border-2 border-dashed border-purple-200 bg-purple-50 flex flex-col items-center justify-center text-purple-400">
                                <Loader2 size={24} className="animate-spin mb-2" />
                                <span className="text-xs">绘制中...</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Titles */}
            <div className="bg-white dark:bg-slate-900/80 p-6 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
                <div className="flex items-center gap-2 mb-4 text-slate-900 dark:text-slate-200 font-bold">
                    <TypeIcon size={20} className="text-rose-500" />
                    <h3>爆款标题备选</h3>
                </div>
                <div className="space-y-3">
                    {Array.isArray(state.generatedContent.titles) && state.generatedContent.titles.map((t: string, i: number) => (
                        <div key={i} className="flex items-center justify-between group p-2 hover:bg-slate-50 rounded-lg transition-colors">
                            <span className="text-slate-700 dark:text-slate-400 font-medium">{t}</span>
                            <button
                                onClick={() => actions.copyToClipboard(t, `title-${i}`)}
                                className="text-slate-300 group-hover:text-rose-500 transition-colors"
                            >
                                {state.copiedField === `title-${i}` ? <Check size={16} /> : <Copy size={16} />}
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="bg-white dark:bg-slate-900/80 p-6 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm relative">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2 text-slate-900 dark:text-slate-200 font-bold">
                        <TypeIcon size={20} className="text-blue-500" />
                        <h3>正文内容</h3>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex bg-slate-100 p-1 rounded-lg">
                            <button
                                onClick={() => actions.setPreviewMode('mobile')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${state.previewMode === 'mobile' ? 'bg-white dark:bg-slate-900/80 shadow-sm text-slate-800 dark:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <Smartphone size={14} />
                                手机预览
                            </button>
                            <button
                                onClick={() => actions.setPreviewMode('web')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${state.previewMode === 'web' ? 'bg-white dark:bg-slate-900/80 shadow-sm text-slate-800 dark:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <Monitor size={14} />
                                纯文本
                            </button>
                        </div>
                        <button
                            onClick={() => actions.copyToClipboard(state.generatedContent.content, 'content')}
                            className="text-slate-400 hover:text-blue-500 transition-colors p-2 bg-slate-50 hover:bg-slate-100 rounded-lg"
                            title="复制正文"
                        >
                            {state.copiedField === 'content' ? <Check size={18} /> : <Copy size={18} />}
                        </button>
                    </div>
                </div>

                {state.previewMode === 'mobile' ? (
                    <div className="flex justify-center py-4 bg-slate-50/50 rounded-xl">
                        {/* iPhone Mockup */}
                        <div className="w-[340px] h-[660px] bg-white dark:bg-slate-900/80 rounded-[2.5rem] border-[10px] border-slate-800 shadow-2xl relative overflow-hidden flex flex-col">
                            {/* Notch */}
                            <div className="absolute top-0 inset-x-0 h-6 bg-slate-800 rounded-b-3xl w-32 mx-auto z-20"></div>

                            {/* Header bar simulated */}
                            <div className="h-12 flex justify-between items-end px-6 pb-2 text-[10px] font-medium text-slate-900 dark:text-slate-200 z-10 sticky top-0 bg-white dark:bg-slate-900/80/80 backdrop-blur-md">
                                <span>9:41</span>
                                <div className="flex gap-1 items-center">
                                    <span className="w-3 h-2 bg-slate-900 rounded-sm"></span>
                                    <span className="w-3 h-2 bg-slate-900 rounded-sm"></span>
                                    <span className="w-4 h-2 bg-transparent border border-slate-900 rounded-sm"></span>
                                </div>
                            </div>

                            {/* Image Area placeholder (Using first generated image) */}
                            <div className="w-full aspect-square bg-slate-100 relative group shrink-0">
                                {state.imageState.images[0] ? (
                                    <img src={state.imageState.images[0]} alt="Post visual" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                                        <ImageIcon size={32} />
                                    </div>
                                )}

                                {/* Fake Dots */}
                                <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-white dark:bg-slate-900/80 shadow-sm"></div>
                                    <div className="w-1.5 h-1.5 rounded-full bg-white dark:bg-slate-900/80/50 text shadow-sm"></div>
                                    <div className="w-1.5 h-1.5 rounded-full bg-white dark:bg-slate-900/80/50 shadow-sm"></div>
                                </div>
                            </div>

                            {/* Scrollable Content Area */}
                            <div className="p-4 overflow-y-auto overflow-x-hidden flex-1 custom-scrollbar pb-16">
                                <h4 className="font-bold text-lg leading-tight mb-3 text-slate-900 dark:text-slate-200">
                                    {state.generatedContent.titles[0]}
                                </h4>
                                <div className="prose prose-sm prose-slate max-w-none text-[14.5px] leading-relaxed text-[#333333]" style={{ whiteSpace: 'pre-line', wordBreak: 'break-word' }}>
                                    {state.generatedContent.content}
                                </div>

                                <div className="flex flex-wrap gap-1.5 mt-4">
                                    {state.generatedContent.tags.slice(0, 5).map((tag: string, i: number) => (
                                        <span key={i} className="text-[#13386b] text-sm hover:opacity-80 cursor-pointer">
                                            {tag.startsWith('#') ? tag : `#${tag}`}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="prose prose-slate prose-sm max-w-none bg-slate-50 p-6 rounded-xl border border-slate-100 dark:border-white/5 font-sans text-base leading-relaxed" style={{ whiteSpace: 'pre-line' }}>
                        {state.generatedContent.content}
                    </div>
                )}
            </div>

            {/* Tags */}
            <div className="bg-white dark:bg-slate-900/80 p-6 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
                <div className="flex items-center gap-2 mb-4 text-slate-900 dark:text-slate-200 font-bold">
                    <Hash size={20} className="text-emerald-500" />
                    <h3>推荐标签</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                    {Array.isArray(state.generatedContent.tags) && state.generatedContent.tags.map((tag: string, i: number) => (
                        <span key={i} className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-sm font-medium">
                            {tag.startsWith('#') ? tag : `#${tag}`}
                        </span>
                    ))}
                </div>
            </div>

            {/* Image Brief */}
            <div className="bg-white dark:bg-slate-900/80 p-6 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
                <div className="flex items-center gap-2 mb-4 text-slate-900 dark:text-slate-200 font-bold">
                    <ImageIcon size={20} className="text-purple-500" />
                    <h3>配图建议</h3>
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed bg-purple-50 p-4 rounded-xl border border-purple-100">
                    {state.generatedContent.image_brief}
                </p>
            </div>
        </motion.div>
    );
}
