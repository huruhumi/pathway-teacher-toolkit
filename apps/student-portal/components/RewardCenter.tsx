import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { Gift, Trophy, Star, Lock, History, ShoppingBag, Coins, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import * as edu from '@pathway/education';
import type { Reward, TokenEvent } from '@pathway/education';

interface RewardCenterProps {
    pointsBalance: number;
    studentId: string;
    onClose: () => void;
    onBalanceChange?: (newBalance: number) => void;
}

type TabType = 'shop' | 'history';

export const RewardCenter: React.FC<RewardCenterProps> = ({ pointsBalance, studentId, onClose, onBalanceChange }) => {
    const { lang } = useLanguage();
    const [tab, setTab] = useState<TabType>('shop');
    const [rewards, setRewards] = useState<Reward[]>([]);
    const [tokenHistory, setTokenHistory] = useState<TokenEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [balance, setBalance] = useState(pointsBalance);
    const [redeemingId, setRedeemingId] = useState<string | null>(null);
    const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        const [rw, th, bal] = await Promise.all([
            edu.fetchActiveRewards(),
            edu.fetchTokenHistory(studentId),
            edu.getTokenBalance(studentId),
        ]);
        setRewards(rw);
        setTokenHistory(th);
        setBalance(bal);
        setLoading(false);
    }, [studentId]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleRedeem = async (reward: Reward) => {
        if (!window.confirm(
            lang === 'zh'
                ? `确定要用 ${reward.cost_tokens} 金币兑换「${reward.name}」吗？此操作不可撤销。`
                : `Redeem "${reward.name}" for ${reward.cost_tokens} coins? This cannot be undone.`
        )) return;

        setRedeemingId(reward.id);
        // We need teacher_id from the reward itself
        const result = await edu.redeemReward(studentId, reward, reward.teacher_id);
        if (result.success) {
            setToast({ msg: lang === 'zh' ? '🎉 兑换成功！' : '🎉 Redeemed!', ok: true });
            const newBal = await edu.getTokenBalance(studentId);
            setBalance(newBal);
            onBalanceChange?.(newBal);
            // Refresh history
            const th = await edu.fetchTokenHistory(studentId);
            setTokenHistory(th);
        } else {
            setToast({ msg: result.message, ok: false });
        }
        setRedeemingId(null);
        setTimeout(() => setToast(null), 3000);
    };

    const sourceLabel = (evt: TokenEvent) => {
        const labels: Record<string, string> = lang === 'zh'
            ? { attendance: '出勤奖励', submission: '作业奖励', bonus: '额外奖励', redemption: '兑换扣除' }
            : { attendance: 'Attendance', submission: 'Submission', bonus: 'Bonus', redemption: 'Redemption' };
        return labels[evt.source_type] || evt.source_type;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300 max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-amber-400 to-orange-500 p-6 relative shrink-0">
                    <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-black/10 hover:bg-black/20 rounded-full text-white transition-colors" title="Close">
                        ✕
                    </button>
                    <div className="flex items-center gap-4 text-white">
                        <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center shadow-inner">
                            <Trophy size={32} className="text-yellow-200" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold">{lang === 'zh' ? '成就大厅' : 'Reward Center'}</h2>
                            <p className="text-white/80 flex items-center gap-1 font-medium mt-1">
                                <span className="text-yellow-200">🪙</span> {balance} {lang === 'zh' ? '积分可用' : 'Points'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200 dark:border-slate-700 shrink-0">
                    <button
                        onClick={() => setTab('shop')}
                        className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-1.5 transition-colors ${tab === 'shop' ? 'text-amber-600 border-b-2 border-amber-500' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <ShoppingBag size={16} />{lang === 'zh' ? '兑换商城' : 'Shop'}
                    </button>
                    <button
                        onClick={() => setTab('history')}
                        className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-1.5 transition-colors ${tab === 'history' ? 'text-amber-600 border-b-2 border-amber-500' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <History size={16} />{lang === 'zh' ? '积分流水' : 'History'}
                    </button>
                </div>

                {/* Toast */}
                {toast && (
                    <div className={`mx-4 mt-3 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 ${toast.ok ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
                        {toast.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                        {toast.msg}
                    </div>
                )}

                {/* Body */}
                <div className="p-5 overflow-y-auto flex-1">
                    {loading ? (
                        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-amber-500" size={24} /></div>
                    ) : tab === 'shop' ? (
                        <div className="space-y-3">
                            {rewards.length === 0 ? (
                                <div className="text-center py-8 text-slate-400">
                                    <Gift size={40} className="mx-auto mb-2 opacity-50" />
                                    <p className="font-medium">{lang === 'zh' ? '老师还没有上架奖品哦' : 'No rewards available yet'}</p>
                                </div>
                            ) : rewards.map(r => {
                                const canAfford = balance >= r.cost_tokens;
                                const isRedeeming = redeemingId === r.id;
                                return (
                                    <div key={r.id} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${canAfford ? 'bg-white dark:bg-slate-800 border-amber-200 dark:border-amber-900 shadow-sm' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 opacity-70'}`}>
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${canAfford ? 'bg-amber-100' : 'bg-slate-200'}`}>
                                                🎁
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-800 dark:text-slate-200">{r.name}</div>
                                                {r.description && <div className="text-xs text-slate-400 mt-0.5">{r.description}</div>}
                                                <div className="text-xs font-bold text-amber-500 mt-0.5">🪙 {r.cost_tokens}</div>
                                            </div>
                                        </div>
                                        <button
                                            disabled={!canAfford || isRedeeming}
                                            onClick={() => handleRedeem(r)}
                                            className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1 transition-all ${canAfford
                                                    ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm active:scale-95'
                                                    : 'bg-slate-200 text-slate-400 dark:bg-slate-700 dark:text-slate-500 cursor-not-allowed'
                                                }`}
                                        >
                                            {isRedeeming ? <Loader2 size={14} className="animate-spin" /> : !canAfford ? <Lock size={14} /> : <Coins size={14} />}
                                            {lang === 'zh' ? '兑换' : 'Redeem'}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {tokenHistory.length === 0 ? (
                                <div className="text-center py-8 text-slate-400">
                                    <History size={40} className="mx-auto mb-2 opacity-50" />
                                    <p className="font-medium">{lang === 'zh' ? '还没有积分记录' : 'No token events yet'}</p>
                                </div>
                            ) : tokenHistory.map(evt => (
                                <div key={evt.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${evt.delta >= 0 ? 'bg-emerald-500' : 'bg-red-400'}`} />
                                        <div>
                                            <div className="text-sm font-medium text-slate-700 dark:text-slate-300">{sourceLabel(evt)}</div>
                                            <div className="text-[10px] text-slate-400">{new Date(evt.created_at).toLocaleDateString()}</div>
                                        </div>
                                    </div>
                                    <div className={`text-sm font-bold ${evt.delta >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                        {evt.delta >= 0 ? '+' : ''}{evt.delta}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
