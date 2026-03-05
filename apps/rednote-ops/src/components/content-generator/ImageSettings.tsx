import { Image as ImageIcon, Loader2, Sparkles, X } from 'lucide-react';
import { ContentGeneratorChildProps } from './types';

export default function ImageSettings({ state, actions }: ContentGeneratorChildProps) {
    if (!state.generatedContent) return null;

    return (
        <div className="card space-y-6">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-slate-900 font-bold">
                    <ImageIcon size={20} className="text-purple-500" />
                    <h3>AI 配图生成 (NanoBanana)</h3>
                </div>
                <select
                    value={state.imageStyle}
                    onChange={(e) => actions.setImageStyle(e.target.value)}
                    className="p-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 bg-slate-50"
                >
                    <option value="Photography, Realistic, High Quality">真实摄影</option>
                    <option value="Minimalist Illustration, Flat Design">扁平插画</option>
                    <option value="3D Render, Cute, Clay style">3D 可爱风</option>
                    <option value="Line Art, Clean, Educational">极简线条</option>
                </select>
            </div>

            {/* Logo Settings UI */}
            {state.brandData.logoUrl && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center gap-2 text-slate-700 font-medium text-sm">
                        <ImageIcon size={14} className="text-rose-500" />
                        Logo 叠加设置
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-500">尺寸</label>
                            <div className="flex bg-white rounded-lg border border-slate-200 p-1">
                                {['小', '中', '大'].map(size => (
                                    <button
                                        key={size}
                                        onClick={() => actions.setLogoSize(size as any)}
                                        className={`flex-1 py-1 text-xs rounded-md transition-colors ${state.logoSize === size ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                                    >
                                        {size}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-500">位置</label>
                            <select
                                value={state.logoPosition}
                                onChange={(e) => actions.setLogoPosition(e.target.value as any)}
                                className="w-full p-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500/50 bg-white"
                            >
                                <option value="左上">左上角</option>
                                <option value="右上">右上角</option>
                                <option value="左下">左下角</option>
                                <option value="右下">右下角</option>
                                <option value="居中">画面正中</option>
                            </select>
                        </div>
                    </div>
                </div>
            )}

            {/* Individual Prompt Cards */}
            {state.imageState.prompts.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-bold text-slate-700">逐张配图 ({state.imageState.prompts.length} 张)</label>
                        <button
                            onClick={() => {
                                // Add a new empty prompt
                                actions.setEditablePrompts(prev => [...prev, '']);
                            }}
                            className="text-xs text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
                        >
                            + 添加一张
                        </button>
                    </div>

                    <div className="space-y-3">
                        {state.imageState.prompts.map((prompt, idx) => (
                            <div key={idx} className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                                {/* Prompt Header */}
                                <div className="flex items-center justify-between px-4 py-2 bg-slate-100/50 border-b border-slate-200">
                                    <span className="text-xs font-bold text-slate-500">
                                        {idx === 0 ? '🖼️ 封面图' : `📷 配图 ${idx + 1}`}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        {state.brandData.logoUrl && (
                                            <button
                                                onClick={() => {
                                                    if (state.addLogoIndices.includes(idx)) {
                                                        actions.setAddLogoIndices(prev => prev.filter(i => i !== idx));
                                                    } else {
                                                        actions.setAddLogoIndices(prev => [...prev, idx]);
                                                    }
                                                }}
                                                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors border ${state.addLogoIndices.includes(idx) ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}
                                            >
                                                {state.addLogoIndices.includes(idx) ? '✓ Logo' : '+ Logo'}
                                            </button>
                                        )}
                                        <button
                                            onClick={() => {
                                                actions.setEditablePrompts(prev => prev.filter((_, i) => i !== idx));
                                                actions.setGeneratedImages(prev => {
                                                    const newImages = [...prev];
                                                    newImages.splice(idx, 1);
                                                    return newImages;
                                                });
                                            }}
                                            className="text-slate-400 hover:text-red-500 transition-colors"
                                            title="删除此提示词"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                </div>

                                {/* Prompt Body */}
                                <div className="p-4 space-y-3">
                                    <textarea
                                        value={prompt}
                                        onChange={(e) => {
                                            const newPrompts = [...state.imageState.prompts];
                                            newPrompts[idx] = e.target.value;
                                            actions.setEditablePrompts(newPrompts);
                                        }}
                                        placeholder="在此编辑图片提示词 (Prompt)..."
                                        className="w-full p-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 bg-white min-h-[80px] resize-y"
                                    />

                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => actions.handleGenerateSingleImage(idx)}
                                            disabled={state.imageState.generatingIndices.includes(idx) || state.imageState.isGenerating || !prompt.trim()}
                                            className={`flex-1 py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${state.imageState.generatingIndices.includes(idx)
                                                ? 'bg-purple-100 text-purple-400 cursor-not-allowed'
                                                : !prompt.trim()
                                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                    : 'bg-purple-500 text-white hover:bg-purple-600 shadow-sm'
                                                }`}
                                        >
                                            {state.imageState.generatingIndices.includes(idx) ? (
                                                <>
                                                    <Loader2 size={16} className="animate-spin" />
                                                    <span>生成中...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Sparkles size={16} />
                                                    <span>生成此图</span>
                                                </>
                                            )}
                                        </button>

                                        {/* Show generated image thumbnail inline */}
                                        {state.imageState.images[idx] && (
                                            <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-slate-200 shadow-sm">
                                                <img src={state.imageState.images[idx]} alt={`配图 ${idx + 1}`} className="w-full h-full object-cover" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Batch Generate (secondary) */}
                    <button
                        onClick={actions.handleGenerateImages}
                        disabled={state.imageState.isGenerating || state.imageState.prompts.every(p => !p.trim())}
                        className={`w-full py-2.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all border ${state.imageState.isGenerating
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200'
                            : 'bg-white text-purple-600 hover:bg-purple-50 border-purple-200'
                            }`}
                    >
                        {state.imageState.isGenerating ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                <span>正在批量绘图 ({state.imageState.images.filter(Boolean).length}/{state.imageState.prompts.length})...</span>
                            </>
                        ) : (
                            <>
                                <ImageIcon size={16} />
                                <span>一键批量生成全部配图</span>
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}
