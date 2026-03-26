import React, { useState, useEffect, useCallback } from 'react';
import {
    User, Mail, Lock, AlertCircle, CheckCircle2,
    Loader2, Save, ArrowLeft, Eye, EyeOff,
} from 'lucide-react';
import * as edu from '@pathway/education';
import { useAuthStore } from '@pathway/platform';
import type { Student } from '@pathway/education';

// ── shared Field component (mirrors StudentLoginPage's Field) ──────────────
interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
}
const Field: React.FC<FieldProps> = ({ label, ...props }) => {
    const [show, setShow] = useState(false);
    const isPassword = props.type === 'password';
    return (
        <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest">{label}</label>
            <div className="relative">
                <input
                    {...props}
                    type={isPassword && show ? 'text' : props.type}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-400/50 focus:border-sky-400 transition-all text-sm pr-10"
                />
                {isPassword && (
                    <button type="button" onClick={() => setShow(s => !s)}
                        title={show ? '隐藏' : '显示'}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {show ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                )}
            </div>
        </div>
    );
};

// ── section wrapper ────────────────────────────────────────────────────────
const Section: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <span className="text-sky-500">{icon}</span>
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">{title}</h3>
        </div>
        <div className="p-5 flex flex-col gap-4">{children}</div>
    </div>
);

// ── inline result banner ───────────────────────────────────────────────────
const Banner: React.FC<{ type: 'success' | 'error' | 'info'; msg: string }> = ({ type, msg }) => {
    const styles = {
        success: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/20',
        error: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/20',
        info: 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-500/20',
    };
    return (
        <p className={`text-xs flex items-start gap-1.5 px-3 py-2 rounded-lg border ${styles[type]}`}>
            {type === 'success' ? <CheckCircle2 size={13} className="mt-0.5 shrink-0" /> : <AlertCircle size={13} className="mt-0.5 shrink-0" />}
            {msg}
        </p>
    );
};

// ── main ProfilePage ────────────────────────────────────────────────────────
interface ProfilePageProps {
    onBack: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ onBack }) => {
    const user = useAuthStore(s => s.user);
    const authUserId = user?.id ?? '';

    const [student, setStudent] = useState<Student | null>(null);
    const [loading, setLoading] = useState(true);

    // Section 1 – basic info state
    const [name, setName] = useState('');
    const [englishName, setEnglishName] = useState('');
    const [dob, setDob] = useState('');
    const [gender, setGender] = useState('');
    const [savingBasic, setSavingBasic] = useState(false);
    const [basicResult, setBasicResult] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

    // Section 2 – family contact state
    const [parentName, setParentName] = useState('');
    const [parentPhone, setParentPhone] = useState('');
    const [parentWechat, setParentWechat] = useState('');
    const [healthNotes, setHealthNotes] = useState('');
    const [savingContact, setSavingContact] = useState(false);
    const [contactResult, setContactResult] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

    // Section 3 – security state
    const [newEmail, setNewEmail] = useState('');
    const [savingEmail, setSavingEmail] = useState(false);
    const [emailResult, setEmailResult] = useState<{ type: 'success' | 'error' | 'info'; msg: string } | null>(null);

    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [savingPassword, setSavingPassword] = useState(false);
    const [passwordResult, setPasswordResult] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

    const load = useCallback(async () => {
        if (!authUserId) return;
        setLoading(true);
        const p = await edu.fetchStudentProfile(authUserId);
        if (p) {
            setStudent(p);
            setName(p.name ?? '');
            setEnglishName(p.english_name ?? '');
            setDob(p.date_of_birth ?? '');
            setGender(p.gender ?? '');
            setParentName(p.parent_name ?? '');
            setParentPhone(p.parent_phone ?? '');
            setParentWechat(p.parent_wechat ?? '');
            setHealthNotes(p.health_notes ?? '');
        }
        setLoading(false);
    }, [authUserId]);

    useEffect(() => { load(); }, [load]);

    const handleSaveBasic = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!student) return;
        setSavingBasic(true); setBasicResult(null);
        const ok = await edu.updateStudentProfile(student.id, { name, english_name: englishName, date_of_birth: dob || undefined, gender: gender || undefined });
        setSavingBasic(false);
        setBasicResult(ok
            ? { type: 'success', msg: '基础资料已保存' }
            : { type: 'error', msg: '保存失败，请稍后重试' });
        if (ok) load(); // refresh local state
    };

    const handleSaveContact = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!student) return;
        setSavingContact(true); setContactResult(null);
        const ok = await edu.updateStudentProfile(student.id, { parent_name: parentName, parent_phone: parentPhone, parent_wechat: parentWechat, health_notes: healthNotes });
        setSavingContact(false);
        setContactResult(ok
            ? { type: 'success', msg: '联系信息已保存' }
            : { type: 'error', msg: '保存失败，请稍后重试' });
    };

    const handleUpdateEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!student || !newEmail.includes('@')) return;
        setSavingEmail(true); setEmailResult(null);
        const res = await edu.updateStudentEmail(student.id, newEmail);
        setSavingEmail(false);
        if (!res.success) {
            setEmailResult({ type: 'error', msg: res.error || '邮箱更新失败' });
        } else {
            setEmailResult({ type: 'info', msg: '确认邮件已发送到新邮箱，点击邮件中的链接完成验证。验证后即可使用新邮箱登录。' });
            setNewEmail('');
        }
    };

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword.length < 6) return setPasswordResult({ type: 'error', msg: '新密码至少 6 位' });
        if (newPassword !== confirmPassword) return setPasswordResult({ type: 'error', msg: '两次密码不一致' });
        setSavingPassword(true); setPasswordResult(null);
        const res = await edu.updateStudentPassword(newPassword);
        setSavingPassword(false);
        if (!res.success) {
            setPasswordResult({ type: 'error', msg: res.error || '密码更新失败，请重新登录后再试' });
        } else {
            setPasswordResult({ type: 'success', msg: '密码已更新，下次请使用新密码登录' });
            setOldPassword(''); setNewPassword(''); setConfirmPassword('');
        }
    };

    if (loading) return (
        <div className="flex justify-center py-24">
            <Loader2 className="animate-spin text-sky-500" size={28} />
        </div>
    );

    return (
        <div className="max-w-2xl mx-auto space-y-6 pb-12">
            {/* Back header */}
            <div className="flex items-center gap-3">
                <button onClick={onBack} aria-label="返回" title="返回" className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <ArrowLeft size={20} />
                </button>
                <h2 className="text-xl font-black text-slate-800 dark:text-white">个人中心</h2>
            </div>

            {/* Section 1 — basic info */}
            <Section icon={<User size={16} />} title="基础资料">
                <form onSubmit={handleSaveBasic} className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="姓名 (中文)" type="text" placeholder="真实姓名" value={name} onChange={e => setName(e.target.value)} />
                        <Field label="英文名" type="text" placeholder="English Name" value={englishName} onChange={e => setEnglishName(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="出生日期" type="date" value={dob} onChange={e => setDob(e.target.value)} />
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest">性别</label>
                            <select value={gender} onChange={e => setGender(e.target.value)} title="性别"
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-400/50 focus:border-sky-400 transition-all text-sm">
                                <option value="">请选择</option>
                                <option value="male">男</option>
                                <option value="female">女</option>
                                <option value="other">其他</option>
                            </select>
                        </div>
                    </div>
                    {basicResult && <Banner type={basicResult.type} msg={basicResult.msg} />}
                    <button type="submit" disabled={savingBasic}
                        className="self-end flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-sm disabled:opacity-50 transition-colors shadow-sm">
                        {savingBasic ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} 保存
                    </button>
                </form>
            </Section>

            {/* Section 2 — family contact */}
            <Section icon={<User size={16} />} title="家长 / 联系信息">
                <form onSubmit={handleSaveContact} className="flex flex-col gap-4">
                    <Field label="家长姓名" type="text" placeholder="家长/监护人姓名" value={parentName} onChange={e => setParentName(e.target.value)} />
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="手机号" type="tel" placeholder="手机号" value={parentPhone} onChange={e => setParentPhone(e.target.value)} />
                        <Field label="微信（可选）" type="text" placeholder="微信号" value={parentWechat} onChange={e => setParentWechat(e.target.value)} />
                    </div>
                    <Field label="健康备注（可选）" type="text" placeholder="如：花粉过敏、近视等" value={healthNotes} onChange={e => setHealthNotes(e.target.value)} />
                    {contactResult && <Banner type={contactResult.type} msg={contactResult.msg} />}
                    <button type="submit" disabled={savingContact}
                        className="self-end flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-sm disabled:opacity-50 transition-colors shadow-sm">
                        {savingContact ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} 保存
                    </button>
                </form>
            </Section>

            {/* Section 3 — account security */}
            <Section icon={<Lock size={16} />} title="账号与安全">
                {/* Email binding */}
                <form onSubmit={handleUpdateEmail} className="flex flex-col gap-3 pb-5 border-b border-slate-100 dark:border-slate-700">
                    <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">绑定 / 更新邮箱</p>
                        <p className="text-xs text-slate-400">绑定邮箱后，可用邮箱登录，也可通过邮箱找回密码。修改邮箱需要在新邮箱中点击确认链接。</p>
                    </div>
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <Field label="" type="email" placeholder="输入新邮箱地址" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
                        </div>
                        <button type="submit" disabled={savingEmail || !newEmail.includes('@')}
                            className="self-end flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-semibold text-sm disabled:opacity-50 transition-colors whitespace-nowrap">
                            {savingEmail ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />} 绑定
                        </button>
                    </div>
                    {emailResult && <Banner type={emailResult.type} msg={emailResult.msg} />}
                </form>

                {/* Password change */}
                <form onSubmit={handleUpdatePassword} className="flex flex-col gap-3">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">修改密码</p>
                    <Field label="新密码（至少 6 位）" type="password" placeholder="输入新密码" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                    <Field label="确认新密码" type="password" placeholder="再输一次" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                    {passwordResult && <Banner type={passwordResult.type} msg={passwordResult.msg} />}
                    <button type="submit" disabled={savingPassword || !newPassword || !confirmPassword}
                        className="self-end flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm disabled:opacity-50 transition-colors shadow-sm">
                        {savingPassword ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />} 更新密码
                    </button>
                </form>
            </Section>
        </div>
    );
};
