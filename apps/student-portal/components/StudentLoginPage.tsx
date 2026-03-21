import React, { useState } from 'react';
import { KeyRound, UserPlus, LogIn, Eye, EyeOff, CheckCircle2, Loader2, AlertCircle, User, ArrowRight, SkipForward } from 'lucide-react';
import * as edu from '@pathway/education';

type Tab = 'login' | 'activate';
type ActivateStep = 'code' | 'form' | 'profile';

const ERROR_MSG: Record<string, string> = {
    invite_code_invalid: '邀请码无效，请检查后重试',
    already_activated: '该邀请码已激活，请直接登录',
    username_taken: '用户名已被使用，请换一个',
    user_not_found: '用户名或邮箱不存在',
    link_failed: '账号绑定失败，请联系老师',
    signup_failed: '注册失败，请稍后重试',
    'Invalid login credentials': '密码错误，请重试',
    'Email not confirmed': '账号未激活，请先激活',
};
const te = (key: string) => ERROR_MSG[key] ?? key;

/** Shared form field */
interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
    hint?: string;
}
const Field: React.FC<FieldProps> = ({ label, hint, ...props }) => {
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
                        title={show ? '隐藏密码' : '显示密码'}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {show ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                )}
            </div>
            {hint && <p className="text-[10px] text-slate-400">{hint}</p>}
        </div>
    );
};

/** Shared select field */
const SelectField: React.FC<{ label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }> = ({ label, value, onChange, options }) => (
    <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest">{label}</label>
        <select value={value} onChange={e => onChange(e.target.value)} title={label}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-400/50 focus:border-sky-400 transition-all text-sm">
            <option value="">请选择</option>
            {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
    </div>
);

/* ─── Profile Step (after activation) ─────────────────────────────────────── */
interface ProfileStepProps {
    studentId: string;
    studentName: string;
    onDone: () => void;
}
const ProfileStep: React.FC<ProfileStepProps> = ({ studentId, studentName, onDone }) => {
    const [englishName, setEnglishName] = useState('');
    const [dob, setDob] = useState('');
    const [gender, setGender] = useState('');
    const [parentName, setParentName] = useState('');
    const [parentWechat, setParentWechat] = useState('');
    const [parentPhone, setParentPhone] = useState('');
    const [healthNotes, setHealthNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async (skip = false) => {
        if (skip) { onDone(); return; }
        setLoading(true); setError('');
        try {
            const ok = await edu.updateStudentProfile(studentId, {
                english_name: englishName || undefined,
                date_of_birth: dob || undefined,
                gender: gender || undefined,
                parent_name: parentName || undefined,
                parent_wechat: parentWechat || undefined,
                parent_phone: parentPhone || undefined,
                health_notes: healthNotes || undefined,
            });
            if (!ok) setError('保存失败，请稍后在个人资料中补充');
            else onDone();
        } catch {
            setError('网络错误，请稍后重试');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-4 animate-fade-in">
            <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-xl px-4 py-2.5 text-sm text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-2">
                <CheckCircle2 size={16} />
                账号已激活！请完善基本资料（可跳过，稍后再填）
            </div>

            <div className="grid grid-cols-2 gap-3">
                <Field label="英文名" type="text" placeholder="English Name"
                    value={englishName} onChange={e => setEnglishName(e.target.value)} />
                <Field label="出生日期" type="date"
                    value={dob} onChange={e => setDob(e.target.value)} />
            </div>

            <SelectField label="性别" value={gender} onChange={setGender}
                options={[{ value: 'male', label: '男' }, { value: 'female', label: '女' }, { value: 'other', label: '其他' }]} />

            <div className="border-t border-slate-100 dark:border-white/10 pt-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">家长信息</p>
                <div className="flex flex-col gap-3">
                    <Field label="家长姓名" type="text" placeholder="家长/监护人姓名"
                        value={parentName} onChange={e => setParentName(e.target.value)} />
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="家长微信" type="text" placeholder="微信号"
                            value={parentWechat} onChange={e => setParentWechat(e.target.value)} />
                        <Field label="家长电话" type="tel" placeholder="手机号"
                            value={parentPhone} onChange={e => setParentPhone(e.target.value)} />
                    </div>
                </div>
            </div>

            <Field label="健康备注（可选）" type="text" placeholder="如：花粉过敏、近视等"
                value={healthNotes} onChange={e => setHealthNotes(e.target.value)} />

            {error && <p className="text-red-500 text-xs flex items-center gap-1.5"><AlertCircle size={14} />{error}</p>}

            <div className="flex gap-2 pt-1">
                <button onClick={() => handleSave(true)} disabled={loading}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-500 text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-slate-50 dark:hover:bg-white/5 transition-all">
                    <SkipForward size={14} />
                    稍后再填
                </button>
                <button onClick={() => handleSave(false)} disabled={loading}
                    className="flex-[2] py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all">
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                    保存并进入
                </button>
            </div>
        </div>
    );
};

/* ─── Activate Tab ─────────────────────────────────────────────────────────── */
const ActivateTab: React.FC = () => {
    const [step, setStep] = useState<ActivateStep>('code');
    const [inviteCode, setInviteCode] = useState('');
    const [studentName, setStudentName] = useState('');
    const [studentId, setStudentId] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleVerify = async () => {
        setError(''); setLoading(true);
        try {
            const found = await edu.lookupStudentByInviteCode(inviteCode);
            if (!found) return setError('邀请码无效，请检查后重试');
            if (found.is_activated) return setError('该邀请码已激活，请切换到「登录」标签');
            setStudentName(found.name);
            setStudentId(found.id);
            setStep('form');
        } catch {
            setError('网络错误，请稍后重试');
        } finally {
            setLoading(false);
        }
    };

    const handleActivate = async () => {
        setError('');
        if (password.length < 6) return setError('密码至少 6 位');
        if (password !== confirm) return setError('两次密码不一致');
        if (!/^[a-z0-9_]{3,20}$/.test(username.toLowerCase()))
            return setError('用户名 3-20 位，只能含字母、数字、下划线');
        setLoading(true);
        try {
            const res = await edu.activateStudentAccount({
                inviteCode, username, password,
                email: email || undefined,
            });
            if (!res.success) return setError(te(res.error ?? ''));
            // Move to profile step
            setStep('profile');
        } finally {
            setLoading(false);
        }
    };

    // Profile step fills in basic info, then onDone signs in automatically
    if (step === 'profile') {
        return (
            <ProfileStep
                studentId={studentId}
                studentName={studentName}
                onDone={async () => {
                    // Auto-login after profile save
                    await edu.loginStudent({ usernameOrEmail: username, password });
                }}
            />
        );
    }

    return (
        <div className="flex flex-col gap-4 animate-fade-in">
            {step === 'code' ? (
                <>
                    <Field label="邀请码" type="text" placeholder="请输入老师提供的 6 位邀请码"
                        value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())}
                        maxLength={6} onKeyDown={e => e.key === 'Enter' && handleVerify()}
                    />
                    {error && <p className="text-red-500 text-xs flex items-center gap-1.5"><AlertCircle size={14} />{error}</p>}
                    <button onClick={handleVerify} disabled={loading || inviteCode.length < 4}
                        className="w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all">
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
                        验证邀请码
                    </button>
                </>
            ) : (
                <>
                    <div className="bg-sky-50 dark:bg-sky-500/10 rounded-xl px-4 py-2.5 text-sm text-sky-700 dark:text-sky-300 font-medium flex items-center gap-2">
                        <User size={15} />
                        欢迎，{studentName}！请设置你的登录信息
                    </div>
                    <Field label="用户名" type="text" placeholder="3-20 位字母/数字/下划线"
                        value={username} onChange={e => setUsername(e.target.value.toLowerCase())}
                        hint="用于以后登录，设置后不能更改" />
                    <Field label="密码" type="password" placeholder="至少 6 位"
                        value={password} onChange={e => setPassword(e.target.value)} />
                    <Field label="确认密码" type="password" placeholder="再输一次"
                        value={confirm} onChange={e => setConfirm(e.target.value)} />
                    <Field label="邮箱（可选）" type="email" placeholder="绑定后可用邮箱登录"
                        value={email} onChange={e => setEmail(e.target.value)}
                        hint="填写后可用邮箱+密码登录" />
                    {error && <p className="text-red-500 text-xs flex items-center gap-1.5"><AlertCircle size={14} />{error}</p>}
                    <button onClick={handleActivate} disabled={loading || !username || !password}
                        className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all">
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                        完成激活
                    </button>
                </>
            )}
        </div>
    );
};

/* ─── Login Tab ────────────────────────────────────────────────────────────── */
const LoginTab: React.FC = () => {
    const [cred, setCred] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async () => {
        setError(''); setLoading(true);
        const res = await edu.loginStudent({ usernameOrEmail: cred, password });
        setLoading(false);
        if (!res.success) setError(te(res.error ?? ''));
        // On success, AuthGate's useAuthStore picks up the session via onAuthStateChange
    };

    return (
        <div className="flex flex-col gap-4 animate-fade-in">
            <Field label="用户名 / 邮箱" type="text" placeholder="输入用户名或邮箱"
                value={cred} onChange={e => setCred(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            <Field label="密码" type="password" placeholder="输入密码"
                value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            {error && <p className="text-red-500 text-xs flex items-center gap-1.5"><AlertCircle size={14} />{error}</p>}
            <button onClick={handleLogin} disabled={loading || !cred || !password}
                className="w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
                登录
            </button>
        </div>
    );
};

/* ─── Page Shell ───────────────────────────────────────────────────────────── */
export const StudentLoginPage: React.FC = () => {
    const [tab, setTab] = useState<Tab>('login');

    return (
        <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo + Title */}
                <div className="flex flex-col items-center gap-3 mb-8">
                    <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl shadow-lg flex items-center justify-center">
                        <img src="/assets/logo.png" alt="Pathway" className="w-10 h-10 object-contain"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </div>
                    <div className="text-center">
                        <p className="text-xs font-bold tracking-widest text-sky-500 uppercase mb-0.5">Pathway Academy</p>
                        <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100">学生平台</h1>
                    </div>
                </div>

                {/* Card */}
                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/60 dark:border-white/10 p-6">
                    {/* Tabs */}
                    <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-2xl p-1 mb-6">
                        {([['login', '登录', LogIn], ['activate', '首次激活', UserPlus]] as const).map(([key, label, Icon]) => (
                            <button key={key} onClick={() => setTab(key)}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold transition-all ${tab === key
                                        ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                    }`}>
                                <Icon size={14} />
                                {label}
                            </button>
                        ))}
                    </div>

                    {tab === 'login' ? <LoginTab /> : <ActivateTab />}
                </div>

                <p className="text-center text-[10px] text-slate-400 mt-6">没有邀请码？请联系你的老师</p>
            </div>
        </div>
    );
};
