import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuthStore } from '@shared/stores/useAuthStore';
import { supabase } from '@shared/services/supabaseClient';
import * as edu from '@pathway/education';
import type { Reward } from '@pathway/education';
import { Plus, Trash2, Edit3, Gift, Loader2, ToggleLeft, ToggleRight, X, ImagePlus } from 'lucide-react';

const BUCKET = 'generated-images';

async function uploadRewardImage(file: File, rewardId: string): Promise<string | null> {
    if (!supabase) return null;
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `rewards/${rewardId}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type });
    if (error) { console.warn('Upload failed:', error.message); return null; }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl + '?t=' + Date.now(); // cache-bust
}

const RewardsManagementPage: React.FC = () => {
    const { lang } = useLanguage();
    const zh = lang === 'zh';
    const user = useAuthStore(s => s.user);
    const teacherId = user?.id || '';
    const [rewards, setRewards] = useState<Reward[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({ name: '', description: '', cost_tokens: 100, max_stock: '', max_per_student_per_month: '' });
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const loadRewards = useCallback(async () => {
        if (!teacherId) return;
        setLoading(true);
        const data = await edu.fetchRewards(teacherId);
        setRewards(data);
        setLoading(false);
    }, [teacherId]);

    useEffect(() => { loadRewards(); }, [loadRewards]);

    const resetForm = () => {
        setForm({ name: '', description: '', cost_tokens: 100, max_stock: '', max_per_student_per_month: '' });
        setEditingId(null);
        setShowForm(false);
        setImageFile(null);
        setImagePreview(null);
    };

    const handleEdit = (r: Reward) => {
        setForm({
            name: r.name,
            description: r.description || '',
            cost_tokens: r.cost_tokens,
            max_stock: r.max_stock != null ? String(r.max_stock) : '',
            max_per_student_per_month: r.max_per_student_per_month != null ? String(r.max_per_student_per_month) : '',
        });
        setEditingId(r.id);
        setImageFile(null);
        setImagePreview(r.image_url || null);
        setShowForm(true);
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImageFile(file);
        const reader = new FileReader();
        reader.onload = () => setImagePreview(reader.result as string);
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        if (!form.name || !teacherId) return;
        setSaving(true);
        try {
            const payload: any = {
                teacher_id: teacherId,
                name: form.name,
                description: form.description || null,
                cost_tokens: form.cost_tokens,
                max_stock: form.max_stock ? parseInt(form.max_stock) : null,
                max_per_student_per_month: form.max_per_student_per_month ? parseInt(form.max_per_student_per_month) : null,
            };
            if (editingId) payload.id = editingId;

            const result = await edu.upsertReward(payload);
            const rewardId = result?.id || editingId;

            // Upload image if selected
            if (imageFile && rewardId) {
                const url = await uploadRewardImage(imageFile, rewardId);
                if (url) {
                    await edu.upsertReward({ id: rewardId, teacher_id: teacherId, name: form.name, cost_tokens: form.cost_tokens, image_url: url });
                }
            }

            resetForm();
            loadRewards();
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm(zh ? '确定删除此奖品？' : 'Delete this reward?')) return;
        await edu.deleteReward(id);
        loadRewards();
    };

    const handleToggleActive = async (r: Reward) => {
        await edu.upsertReward({ ...r, is_active: !r.is_active });
        loadRewards();
    };

    if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-amber-500" size={24} /></div>;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Gift className="text-amber-500" size={24} />
                        {zh ? '奖品管理' : 'Rewards Management'}
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">{zh ? '管理积分商城中的可兑换奖品' : 'Manage redeemable rewards in the token shop'}</p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowForm(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-colors shadow-sm"
                >
                    <Plus size={16} />{zh ? '添加奖品' : 'Add Reward'}
                </button>
            </div>

            {/* Add/Edit Form */}
            {showForm && (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-amber-200 dark:border-amber-900 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-slate-800 dark:text-white">
                            {editingId ? (zh ? '编辑奖品' : 'Edit Reward') : (zh ? '新建奖品' : 'New Reward')}
                        </h3>
                        <button onClick={resetForm} className="text-slate-400 hover:text-slate-600" title="Close"><X size={18} /></button>
                    </div>

                    <div className="flex gap-5">
                        {/* Image Upload Area */}
                        <div className="shrink-0">
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                                {zh ? '奖品图片' : 'Image'}
                            </label>
                            <div
                                onClick={() => fileRef.current?.click()}
                                className="w-28 h-28 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center cursor-pointer hover:border-amber-400 hover:bg-amber-50/30 dark:hover:border-amber-500/50 dark:hover:bg-amber-500/5 transition-all overflow-hidden group"
                            >
                                {imagePreview ? (
                                    <img src={imagePreview} alt="" className="w-full h-full object-cover rounded-lg" />
                                ) : (
                                    <div className="text-center">
                                        <ImagePlus size={24} className="mx-auto text-slate-400 group-hover:text-amber-500 transition-colors" />
                                        <span className="text-[10px] text-slate-400 mt-1 block">{zh ? '点击上传' : 'Upload'}</span>
                                    </div>
                                )}
                            </div>
                            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                            {imagePreview && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setImageFile(null); setImagePreview(null); }}
                                    className="text-xs text-red-400 hover:text-red-600 mt-1 w-full text-center"
                                >
                                    {zh ? '移除图片' : 'Remove'}
                                </button>
                            )}
                        </div>

                        {/* Form Fields */}
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">{zh ? '奖品名称' : 'Name'} *</label>
                                <input
                                    value={form.name}
                                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm"
                                    placeholder={zh ? '如：免作业卡' : 'e.g. Homework Pass'}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">{zh ? '积分定价' : 'Cost (tokens)'}</label>
                                <input
                                    type="number"
                                    value={form.cost_tokens}
                                    onChange={e => setForm(f => ({ ...f, cost_tokens: parseInt(e.target.value) || 0 }))}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm"
                                    min={1}
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">{zh ? '描述（可选）' : 'Description'}</label>
                                <input
                                    value={form.description}
                                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm"
                                    placeholder={zh ? '简短描述这个奖品' : 'Brief description'}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">{zh ? '库存上限（空=无限）' : 'Max Stock (empty=∞)'}</label>
                                <input
                                    type="number"
                                    value={form.max_stock}
                                    onChange={e => setForm(f => ({ ...f, max_stock: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm"
                                    placeholder="∞"
                                    min={0}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">{zh ? '每人每月限兑（空=无限）' : 'Per Student/Month (empty=∞)'}</label>
                                <input
                                    type="number"
                                    value={form.max_per_student_per_month}
                                    onChange={e => setForm(f => ({ ...f, max_per_student_per_month: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm"
                                    placeholder="∞"
                                    min={0}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 mt-5">
                        <button onClick={resetForm} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 rounded-lg">
                            {zh ? '取消' : 'Cancel'}
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!form.name || saving}
                            className="px-5 py-2 bg-amber-500 text-white rounded-lg font-bold text-sm hover:bg-amber-600 disabled:opacity-50 transition-colors flex items-center gap-2"
                        >
                            {saving && <Loader2 size={14} className="animate-spin" />}
                            {editingId ? (zh ? '保存' : 'Save') : (zh ? '创建' : 'Create')}
                        </button>
                    </div>
                </div>
            )}

            {/* Rewards List */}
            {rewards.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                    <Gift size={48} className="mx-auto mb-3 opacity-40" />
                    <p className="font-bold text-lg">{zh ? '还没有奖品' : 'No rewards yet'}</p>
                    <p className="text-sm mt-1">{zh ? '点击上方按钮添加第一个奖品' : 'Click the button above to add your first reward'}</p>
                </div>
            ) : (
                <div className="grid gap-3">
                    {rewards.map(r => (
                        <div key={r.id} className={`bg-white dark:bg-slate-800 rounded-xl border p-4 flex items-center justify-between transition-all ${r.is_active ? 'border-amber-200 dark:border-amber-900' : 'border-slate-200 dark:border-slate-700 opacity-60'}`}>
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                {(r as any).image_url ? (
                                    <img src={(r as any).image_url} alt={r.name} className="w-12 h-12 rounded-xl object-cover shrink-0 border border-slate-100 dark:border-slate-700" />
                                ) : (
                                    <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-xl shrink-0">🎁</div>
                                )}
                                <div className="min-w-0">
                                    <div className="font-bold text-slate-800 dark:text-white truncate">{r.name}</div>
                                    {r.description && <div className="text-xs text-slate-400 truncate">{r.description}</div>}
                                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                        <span className="font-bold text-amber-600">🪙 {r.cost_tokens}</span>
                                        {r.max_stock != null && <span>{zh ? '库存' : 'Stock'}: {r.max_stock}</span>}
                                        {r.max_per_student_per_month != null && <span>{zh ? '月限' : 'Monthly'}: {r.max_per_student_per_month}</span>}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                <button onClick={() => handleToggleActive(r)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" title={r.is_active ? 'Deactivate' : 'Activate'}>
                                    {r.is_active ? <ToggleRight size={20} className="text-emerald-500" /> : <ToggleLeft size={20} className="text-slate-400" />}
                                </button>
                                <button onClick={() => handleEdit(r)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" title="Edit">
                                    <Edit3 size={16} className="text-slate-500" />
                                </button>
                                <button onClick={() => handleDelete(r.id)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Delete">
                                    <Trash2 size={16} className="text-red-400" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default RewardsManagementPage;
