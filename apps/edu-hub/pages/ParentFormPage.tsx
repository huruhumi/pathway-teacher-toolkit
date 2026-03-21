import React, { useState, useEffect } from 'react';
import { supabase } from '@shared/services/supabaseClient';

const LEVELS = ['Pre-K', 'K', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6'];
const PROFICIENCY = ['beginner', 'elementary', 'intermediate', 'advanced'];
const PROFICIENCY_LABELS: Record<string, { zh: string; en: string }> = {
    beginner: { zh: '零基础', en: 'Beginner' },
    elementary: { zh: '初级', en: 'Elementary' },
    intermediate: { zh: '中级', en: 'Intermediate' },
    advanced: { zh: '高级', en: 'Advanced' },
};
const INTEREST_OPTIONS = ['Animals', 'Sports', 'Music', 'Art', 'Science', 'Nature', 'Reading', 'Dance', 'Gaming', 'Cooking'];

type FormState = {
    date_of_birth: string;
    gender: string;
    level: string;
    parent_name: string;
    parent_wechat: string;
    parent_phone: string;
    health_notes: string;
    learning_notes: string;
    proficiency: string;
    interests: string[];
};

const ParentFormPage: React.FC = () => {
    const code = new URLSearchParams(window.location.search).get('invite_code') || '';
    const [lang, setLang] = useState<'zh' | 'en'>('zh');
    const [studentName, setStudentName] = useState('');
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const [form, setForm] = useState<FormState>({
        date_of_birth: '', gender: '', level: '', parent_name: '', parent_wechat: '',
        parent_phone: '', health_notes: '', learning_notes: '', proficiency: '', interests: [],
    });

    useEffect(() => {
        if (!code) { setNotFound(true); setLoading(false); return; }
        // Look up student by invite code
        const load = async () => {
            const { data, error: err } = await supabase!
                .from('students').select('name, english_name, date_of_birth, gender, level, parent_name, parent_wechat, parent_phone, health_notes, learning_notes, proficiency, interests')
                .eq('invite_code', code).single();
            if (err || !data) { setNotFound(true); setLoading(false); return; }
            setStudentName(`${data.name}${data.english_name ? ` (${data.english_name})` : ''}`);
            setForm({
                date_of_birth: data.date_of_birth || '',
                gender: data.gender || '',
                level: data.level || '',
                parent_name: data.parent_name || '',
                parent_wechat: data.parent_wechat || '',
                parent_phone: data.parent_phone || '',
                health_notes: data.health_notes || '',
                learning_notes: data.learning_notes || '',
                proficiency: data.proficiency || '',
                interests: data.interests || [],
            });
            setLoading(false);
        };
        load();
    }, [code]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            const { error: err } = await supabase!.from('students').update({
                date_of_birth: form.date_of_birth || null,
                gender: form.gender || null,
                level: form.level || null,
                parent_name: form.parent_name || null,
                parent_wechat: form.parent_wechat || null,
                parent_phone: form.parent_phone || null,
                health_notes: form.health_notes || null,
                learning_notes: form.learning_notes || null,
                proficiency: form.proficiency || null,
                interests: form.interests,
            }).eq('invite_code', code);
            if (err) throw err;
            setSubmitted(true);
        } catch (err: any) {
            setError(err.message || 'Submission failed');
        }
        setSaving(false);
    };

    const toggleInterest = (tag: string) => {
        setForm(f => ({
            ...f,
            interests: f.interests.includes(tag) ? f.interests.filter(t => t !== tag) : [...f.interests, tag],
        }));
    };

    const t = (zh: string, en: string) => lang === 'zh' ? zh : en;

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
        </div>
    );

    if (notFound) return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                <div className="text-4xl mb-4">🔗</div>
                <h1 className="text-xl font-bold text-slate-800 mb-2">Link Invalid</h1>
                <p className="text-slate-500 text-sm">The invite code is invalid or has expired. Please contact the teacher for a new link.</p>
            </div>
        </div>
    );

    if (submitted) return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                <div className="text-5xl mb-4">✅</div>
                <h1 className="text-xl font-bold text-slate-800 mb-2">{t('提交成功！', 'Submitted!')}</h1>
                <p className="text-slate-500 text-sm">{t('感谢您的填写，老师已可以查看这些信息。', 'Thank you! The teacher can now see your information.')}</p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 py-8 px-4">
            <div className="max-w-lg mx-auto">
                {/* Header */}
                <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white text-2xl font-bold mb-3 shadow-lg">
                        🎓
                    </div>
                    <h1 className="text-xl font-bold text-slate-800">{t('学生信息收集', 'Student Information Form')}</h1>
                    <p className="text-sm text-slate-500 mt-1">{t('请填写以下信息', 'Please fill in the details below')}</p>
                    <p className="text-sm font-semibold text-amber-600 mt-1">{studentName}</p>
                    <button onClick={() => setLang(l => l === 'zh' ? 'en' : 'zh')}
                        className="mt-2 text-xs text-slate-400 hover:text-amber-500 underline">{lang === 'zh' ? 'English' : '中文'}</button>
                </div>

                <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-6 space-y-5">
                    {/* Birthday */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">{t('生日', 'Birthday')}</label>
                        <input type="date" value={form.date_of_birth} onChange={e => setForm({ ...form, date_of_birth: e.target.value })}
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" />
                    </div>

                    {/* Gender */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">{t('性别', 'Gender')}</label>
                        <div className="flex gap-2">
                            {[{ v: 'male', zh: '男', en: 'Boy', emoji: '👦' }, { v: 'female', zh: '女', en: 'Girl', emoji: '👧' }].map(g => (
                                <button key={g.v} type="button" onClick={() => setForm({ ...form, gender: g.v })}
                                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${form.gender === g.v ? 'bg-amber-500 text-white border-amber-500 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300'
                                        }`}>{g.emoji} {t(g.zh, g.en)}</button>
                            ))}
                        </div>
                    </div>

                    {/* Level */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">{t('年级', 'Grade Level')}</label>
                        <div className="flex flex-wrap gap-1.5">
                            {LEVELS.map(l => (
                                <button key={l} type="button" onClick={() => setForm({ ...form, level: l })}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${form.level === l ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300'
                                        }`}>{l}</button>
                            ))}
                        </div>
                    </div>

                    {/* Proficiency */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">{t('英语水平', 'English Level')}</label>
                        <div className="flex flex-wrap gap-1.5">
                            {PROFICIENCY.map(p => (
                                <button key={p} type="button" onClick={() => setForm({ ...form, proficiency: p })}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${form.proficiency === p ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300'
                                        }`}>{t(PROFICIENCY_LABELS[p].zh, PROFICIENCY_LABELS[p].en)}</button>
                            ))}
                        </div>
                    </div>

                    <hr className="border-slate-100" />

                    {/* Parent Info */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-bold text-slate-800">{t('家长信息', 'Parent Information')}</h3>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">{t('家长姓名', 'Parent Name')}</label>
                            <input value={form.parent_name} onChange={e => setForm({ ...form, parent_name: e.target.value })}
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">{t('微信号', 'WeChat')}</label>
                                <input value={form.parent_wechat} onChange={e => setForm({ ...form, parent_wechat: e.target.value })}
                                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">{t('手机号', 'Phone')}</label>
                                <input value={form.parent_phone} onChange={e => setForm({ ...form, parent_phone: e.target.value })}
                                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" />
                            </div>
                        </div>
                    </div>

                    <hr className="border-slate-100" />

                    {/* Health */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">{t('健康/过敏信息', 'Health / Allergies')}</label>
                        <textarea value={form.health_notes} onChange={e => setForm({ ...form, health_notes: e.target.value })}
                            rows={2} placeholder={t('如有过敏或特殊健康状况请注明', 'Note any allergies or health conditions')}
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none resize-none" />
                    </div>

                    {/* Learning Preferences */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">{t('学习偏好/特点', 'Learning Preferences')}</label>
                        <textarea value={form.learning_notes} onChange={e => setForm({ ...form, learning_notes: e.target.value })}
                            rows={2} placeholder={t('例如：视觉型学习者、注意力较短等', 'e.g. visual learner, short attention span')}
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none resize-none" />
                    </div>

                    {/* Interests */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">{t('兴趣爱好', 'Interests')}</label>
                        <div className="flex flex-wrap gap-1.5">
                            {INTEREST_OPTIONS.map(tag => (
                                <button key={tag} type="button" onClick={() => toggleInterest(tag)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${form.interests.includes(tag) ? 'bg-violet-500 text-white border-violet-500' : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300'
                                        }`}>{tag}</button>
                            ))}
                        </div>
                    </div>

                    {error && <div className="text-red-500 text-sm bg-red-50 p-3 rounded-xl">{error}</div>}

                    <button type="submit" disabled={saving}
                        className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold text-sm hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 shadow-lg transition-all flex items-center justify-center gap-2">
                        {saving && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />}
                        {t('提交信息', 'Submit')}
                    </button>
                </form>

                <p className="text-center text-xs text-slate-400 mt-4">Pathway Academy</p>
            </div>
        </div>
    );
};

export default ParentFormPage;
