import React, { useState, useEffect } from 'react';
import * as edu from '@pathway/education';
import type { StudentDiagnostics } from '@pathway/education';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from 'recharts';
import { Loader2, BarChart3, Clock, Copy, CheckCircle2 } from 'lucide-react';

interface Props {
    studentId: string;
    studentName: string;
    teacherId: string;
}

const StudentRadarCard: React.FC<Props> = ({ studentId, studentName, teacherId }) => {
    const [diag, setDiag] = useState<StudentDiagnostics | null>(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        setLoading(true);
        edu.getStudentDiagnostics(studentId, teacherId).then(d => {
            setDiag(d);
            setLoading(false);
        });
    }, [studentId, teacherId]);

    const handleCopyReport = () => {
        if (!diag) return;
        const text = [
            `📊 ${studentName} 学情诊断报告`,
            ``,
            `出勤率: ${diag.summary.attendanceRate}%`,
            `作业完成率: ${diag.summary.completionRate}%`,
            `平均成绩: ${diag.summary.averageScore}/5`,
            `守时率: ${diag.summary.punctualityRate}%`,
            `积分余额: ${diag.summary.tokenBalance}`,
            ``,
            `数据样本: ${diag.attendanceCount} 次出勤 / ${diag.submissionCount} 次作业`,
        ].join('\n');
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin text-amber-500" size={20} />
            </div>
        );
    }

    if (!diag) return null;

    // Data not mature enough
    if (!diag.isReady) {
        return (
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2">
                    <Clock size={16} />
                    <span className="text-sm font-bold">学情数据积累中</span>
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                    需要至少 10 次作业提交 + 15 次出勤记录才能生成诊断雷达图。
                    当前：{diag.submissionCount}/10 作业、{diag.attendanceCount}/15 出勤
                </p>
                <div className="mt-3 flex gap-2">
                    <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                        <div className="bg-amber-400 h-2 rounded-full transition-all" style={{ width: `${Math.min(100, (diag.submissionCount / 10) * 100)}%` }} />
                    </div>
                    <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                        <div className="bg-emerald-400 h-2 rounded-full transition-all" style={{ width: `${Math.min(100, (diag.attendanceCount / 15) * 100)}%` }} />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-slate-700 dark:text-white flex items-center gap-2">
                    <BarChart3 size={16} className="text-amber-500" />
                    学情诊断雷达
                </h4>
                <button
                    onClick={handleCopyReport}
                    className="text-xs text-slate-500 hover:text-amber-600 flex items-center gap-1 px-2 py-1 rounded-md hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                    title="复制报告文本"
                >
                    {copied ? <CheckCircle2 size={12} className="text-emerald-500" /> : <Copy size={12} />}
                    {copied ? '已复制' : '复制报告'}
                </button>
            </div>

            {/* Radar Chart */}
            <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={diag.dimensions}>
                        <PolarGrid stroke="#e2e8f0" />
                        <PolarAngleAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
                        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                        <Radar
                            dataKey="value"
                            stroke="#f59e0b"
                            fill="#f59e0b"
                            fillOpacity={0.25}
                            strokeWidth={2}
                        />
                    </RadarChart>
                </ResponsiveContainer>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-5 gap-2 mt-3">
                {[
                    { label: '出勤', value: `${diag.summary.attendanceRate}%`, color: diag.summary.attendanceRate >= 80 ? 'text-emerald-600' : 'text-red-500' },
                    { label: '完成', value: `${diag.summary.completionRate}%`, color: diag.summary.completionRate >= 80 ? 'text-emerald-600' : 'text-amber-500' },
                    { label: '成绩', value: `${diag.summary.averageScore}`, color: diag.summary.averageScore >= 3.5 ? 'text-emerald-600' : 'text-amber-500' },
                    { label: '守时', value: `${diag.summary.punctualityRate}%`, color: diag.summary.punctualityRate >= 80 ? 'text-emerald-600' : 'text-amber-500' },
                    { label: '积分', value: `${diag.summary.tokenBalance}`, color: 'text-amber-600' },
                ].map(s => (
                    <div key={s.label} className="text-center">
                        <div className={`text-base font-bold ${s.color}`}>{s.value}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{s.label}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default StudentRadarCard;
