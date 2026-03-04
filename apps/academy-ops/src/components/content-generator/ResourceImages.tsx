import { Globe, RefreshCw, Download, Image as ImageIcon } from 'lucide-react';
import { ContentGeneratorChildProps } from './types';

export default function ResourceImages({ state, actions }: ContentGeneratorChildProps) {
    if (!state.generatedContent?.resources || state.generatedContent.resources.length === 0) return null;

    return (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 border-blue-200 shadow-blue-50">
            <div className="flex items-center gap-2 mb-2 text-slate-900 font-bold">
                <Globe size={20} className="text-blue-500" />
                <h3>网络资源配图</h3>
            </div>
            <p className="text-sm text-slate-500">
                文章中提到的真实资源，直接从网络获取配图。
            </p>
            <div className="space-y-4">
                {state.generatedContent.resources.map((resource: any, idx: number) => (
                    <div key={idx} className="flex gap-4 p-4 border border-slate-100 rounded-xl bg-slate-50 hover:bg-white hover:shadow-md transition-all">
                        <div className="w-24 h-32 flex-shrink-0 bg-slate-200 rounded-lg overflow-hidden relative group">
                            {resource.image_url ? (
                                <>
                                    <img
                                        src={resource.image_url}
                                        alt={resource.name}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            // Try favicon from source_url domain as fallback
                                            const target = e.target as HTMLImageElement;
                                            if (resource.source_url && !target.dataset.triedFavicon) {
                                                target.dataset.triedFavicon = 'true';
                                                try {
                                                    const domain = new URL(resource.source_url).hostname;
                                                    target.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
                                                } catch {
                                                    target.style.display = 'none';
                                                }
                                            } else {
                                                target.style.display = 'none';
                                            }
                                        }}
                                    />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <a
                                            href={resource.image_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="p-2 bg-white rounded-full text-slate-900 hover:text-blue-500 transition-colors"
                                            title="新标签页打开图片以保存"
                                        >
                                            <Download size={16} />
                                        </a>
                                    </div>
                                </>
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-2 text-center bg-slate-100">
                                    <ImageIcon size={24} className="mb-1 opacity-20" />
                                    <span className="text-[10px]">暂无配图</span>
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col flex-1 overflow-hidden space-y-2 relative">
                            <div className="flex justify-between items-start gap-2">
                                <h4 className="font-bold text-slate-900 text-sm truncate pr-8">{resource.name}</h4>
                                <button
                                    onClick={() => actions.handleRefreshResourceImage(idx)}
                                    disabled={state.imageState.refreshingResource[idx]}
                                    title="重新搜索并替换配图"
                                    className="absolute top-0 right-0 p-1.5 text-slate-400 hover:text-blue-500 bg-white rounded-md border border-slate-200 shadow-sm transition-all disabled:opacity-50"
                                >
                                    <RefreshCw size={14} className={state.imageState.refreshingResource[idx] ? 'animate-spin text-blue-500' : ''} />
                                </button>
                            </div>
                            <div className="text-xs space-y-1">
                                <p className="text-slate-500 font-medium">图片链接：</p>
                                <a href={resource.image_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline truncate block">
                                    {resource.image_url || '无'}
                                </a>
                            </div>
                            {resource.source_url && (
                                <div className="text-xs space-y-1">
                                    <p className="text-slate-500 font-medium">资源链接：</p>
                                    <a href={resource.source_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline truncate block">
                                        {resource.source_url}
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
