import React, { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuthStore } from '@shared/stores/useAuthStore';
import * as edu from '@pathway/education';
import type { EduStudentPackage } from '@pathway/education';
import {
    Wallet, TrendingUp, AlertCircle, RefreshCw, Receipt, Search
} from 'lucide-react';
import { Card, Button } from '@pathway/ui';
import { useToast } from '@shared/stores/useToast';

const FinancePage: React.FC = () => {
    const { lang } = useLanguage();
    const zh = lang === 'zh';
    const teacherId = useAuthStore(s => s.user?.id);
    const toast = useToast();

    const [packages, setPackages] = useState<(EduStudentPackage & { student_name?: string })[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchData = async () => {
        if (!teacherId) return;
        setLoading(true);
        // We will fetch students to map student names later, or we can just fetch students first
        try {
            const students = await edu.fetchStudents(teacherId);
            const studentMap = new Map(students.map(s => [s.id, s.name]));

            const data = await edu.fetchAllPackages(teacherId);
            const mapped = data.map((d: any) => ({
                ...d,
                student_name: studentMap.get(d.student_id) || 'Unknown'
            }));
            setPackages(mapped);
        } catch (e: any) {
            toast.error(zh ? '数据加载失败' : 'Failed to load data');
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [teacherId]);

    // Metrics
    const totalExpectedRevenue = packages.reduce((sum, p) => sum + Number(p.price || 0), 0);
    const totalCollected = packages.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);
    const renewalsNeeded = packages.filter(p => p.status === 'active' && (p.total_classes - p.used_classes) <= 2);

    const filteredPackages = packages.filter(p =>
        (p.student_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.package_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="max-w-7xl mx-auto py-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <Wallet className="text-amber-500" />
                        {zh ? '财务概览' : 'Finance Dashboard'}
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {zh ? '管理课时包、缴费分期与续费预警' : 'Manage student packages, payments, and renewal alerts'}
                    </p>
                </div>
                <Button variant="secondary" onClick={fetchData} disabled={loading} leftIcon={<RefreshCw size={16} className={loading ? 'animate-spin' : ''} />}>
                    {zh ? '刷新' : 'Refresh'}
                </Button>
            </div>

            {/* Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="px-6 py-5 border-l-4 border-l-amber-500">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{zh ? '预期总收入' : 'Expected Revenue'}</p>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">¥{totalExpectedRevenue.toLocaleString()}</h3>
                        </div>
                        <div className="p-2 bg-amber-50 dark:bg-amber-500/10 rounded-lg text-amber-600 dark:text-amber-400">
                            <TrendingUp size={20} />
                        </div>
                    </div>
                </Card>
                <Card className="px-6 py-5 border-l-4 border-l-emerald-500">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{zh ? '已收账款' : 'Collected Revenue'}</p>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">¥{totalCollected.toLocaleString()}</h3>
                        </div>
                        <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg text-emerald-600 dark:text-emerald-400">
                            <Receipt size={20} />
                        </div>
                    </div>
                </Card>
                <Card className={`px-6 py-5 border-l-4 ${renewalsNeeded.length > 0 ? 'border-l-rose-500' : 'border-l-slate-300'}`}>
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{zh ? '需续费学生' : 'Renewals Needed'}</p>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{renewalsNeeded.length}</h3>
                        </div>
                        <div className={`p-2 rounded-lg ${renewalsNeeded.length > 0 ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400' : 'bg-slate-50 dark:bg-slate-800 text-slate-400'}`}>
                            <AlertCircle size={20} />
                        </div>
                    </div>
                    {renewalsNeeded.length > 0 && (
                        <p className="text-xs text-rose-500 mt-2">
                            {zh ? '课时不足 2 节，请及时提醒家长' : 'Balance <= 2 classes, please notify parents'}
                        </p>
                    )}
                </Card>
            </div>

            {/* Packages List */}
            <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">
                        {zh ? '课时包明细' : 'Package Details'}
                    </h2>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder={zh ? "搜索学生或课包..." : "Search students or packages..."}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:text-white"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400">
                                <th className="py-3 px-4 font-medium">{zh ? '学生' : 'Student'}</th>
                                <th className="py-3 px-4 font-medium">{zh ? '课包名称' : 'Package Name'}</th>
                                <th className="py-3 px-4 font-medium">{zh ? '进度' : 'Progress'}</th>
                                <th className="py-3 px-4 font-medium">{zh ? '金额 (已付/总价)' : 'Amount (Paid/Total)'}</th>
                                <th className="py-3 px-4 font-medium">{zh ? '状态' : 'Status'}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredPackages.map(pkg => {
                                const remaining = pkg.total_classes - pkg.used_classes;
                                const isLow = remaining <= 2 && pkg.status === 'active';

                                return (
                                    <tr key={pkg.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                                            {pkg.student_name}
                                        </td>
                                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                                            {pkg.package_name}
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 max-w-[100px] h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                    <div className={`h-full ${isLow ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, Math.max(0, (pkg.used_classes / pkg.total_classes) * 100))}%` }} />
                                                </div>
                                                <span className={`text-xs ${isLow ? 'text-rose-600 font-bold' : 'text-slate-500'}`}>
                                                    {pkg.used_classes} / {pkg.total_classes}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex flex-col">
                                                <span className={pkg.payment_status === 'paid' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 font-bold'}>
                                                    ¥{pkg.amount_paid} <span className="text-slate-400 font-normal">/ ¥{pkg.price}</span>
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4">
                                            {pkg.status === 'active' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">{zh ? '活跃' : 'Active'}</span>}
                                            {pkg.status === 'exhausted' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{zh ? '已耗尽' : 'Exhausted'}</span>}
                                            {pkg.status === 'refunded' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">{zh ? '已退款' : 'Refunded'}</span>}
                                            {pkg.status === 'cancelled' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">{zh ? '已取消' : 'Cancelled'}</span>}
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredPackages.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="py-8 text-center text-slate-500">
                                        {zh ? '暂无数据' : 'No packages found.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

export default FinancePage;
