import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Modal } from '@shared/components/ui/Modal';
import { ContentGeneratorChildProps } from './types';

export default function SaveCalendarModal({ state, actions }: ContentGeneratorChildProps) {
    return (
        <Modal isOpen={state.showSaveModal} onClose={() => actions.setShowSaveModal(false)} maxWidth="max-w-md" className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-200">保存到运营日历</h3>
                <button onClick={() => actions.setShowSaveModal(false)} className="text-slate-400 hover:text-slate-600">
                    <X size={24} />
                </button>
            </div>

            <div className="space-y-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-400">选择发布日期</label>
                    <div className="border border-slate-200 dark:border-white/10 rounded-xl p-4 bg-slate-50">
                        <div className="flex items-center justify-between mb-4">
                            <button onClick={actions.handlePrevMonth} className="p-1 hover:bg-slate-200 rounded text-slate-500">
                                <ChevronLeft size={20} />
                            </button>
                            <span className="font-bold text-slate-700 dark:text-slate-400">
                                {state.calendarMonth.getFullYear()}年 {state.calendarMonth.getMonth() + 1}月
                            </span>
                            <button onClick={actions.handleNextMonth} className="p-1 hover:bg-slate-200 rounded text-slate-500">
                                <ChevronRight size={20} />
                            </button>
                        </div>
                        <div className="grid grid-cols-7 gap-1 text-center mb-2">
                            {['日', '一', '二', '三', '四', '五', '六'].map(d => (
                                <div key={d} className="text-xs text-slate-400 font-medium">{d}</div>
                            ))}
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                            {Array.from({ length: actions.getFirstDayOfMonth(state.calendarMonth) }).map((_, i) => (
                                <div key={`empty-${i}`} />
                            ))}
                            {Array.from({ length: actions.getDaysInMonth(state.calendarMonth) }).map((_, i) => {
                                const day = i + 1;
                                const dateStr = `${state.calendarMonth.getFullYear()}-${String(state.calendarMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                const isSelected = state.publishDate === dateStr;
                                const isOccupied = actions.isDateOccupied(dateStr);

                                return (
                                    <button
                                        key={day}
                                        onClick={() => actions.setPublishDate(dateStr)}
                                        className={`
                        h-8 w-8 rounded-full flex items-center justify-center text-sm transition-all relative
                        ${isSelected
                                                ? 'bg-rose-500 text-white font-bold shadow-md shadow-rose-200'
                                                : 'hover:bg-white hover:shadow-sm text-slate-700 dark:text-slate-400'
                                            }
                      `}
                                    >
                                        {day}
                                        {isOccupied && !isSelected && (
                                            <span className="absolute bottom-1 w-1 h-1 rounded-full bg-emerald-500"></span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="mt-3 flex items-center gap-4 text-xs text-slate-500 justify-center">
                            <div className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                                <span>当前选择</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                <span>已有安排</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 dark:border-white/5">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-200 mb-1">笔记主题</p>
                    <p className="text-sm text-slate-500 truncate">{state.topic}</p>
                </div>
            </div>

            <div className="flex gap-3">
                <button
                    onClick={() => actions.setShowSaveModal(false)}
                    className="flex-1 py-3 bg-slate-100 text-slate-600 dark:text-slate-400 rounded-xl font-medium hover:bg-slate-200 transition-colors"
                >
                    取消
                </button>
                <button
                    onClick={actions.handleSaveToCalendar}
                    className="flex-1 py-3 bg-rose-500 text-white rounded-xl font-medium hover:bg-rose-600 transition-colors shadow-md shadow-rose-200"
                >
                    确认保存
                </button>
            </div>
        </Modal>
    );
}
